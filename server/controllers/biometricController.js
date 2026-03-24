const { pool } = require('../config/db');
const { createNotification } = require('./notificationController');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PENDING_DIR = path.join(__dirname, '..', 'data');
const PENDING_FILE = path.join(PENDING_DIR, 'biometric_pending_logs.jsonl');

const isTransientDbError = (error) => {
    if (!error) return false;
    const code = String(error.code || '').toUpperCase();
    const msg = String(error.message || '').toLowerCase();
    return (
        ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', '53300'].includes(code) ||
        msg.includes('maxclientsinsessionmode') ||
        msg.includes('getaddrinfo enotfound') ||
        msg.includes('too many clients')
    );
};

const queuePendingBiometricLog = (payload, error) => {
    try {
        if (!fs.existsSync(PENDING_DIR)) {
            fs.mkdirSync(PENDING_DIR, { recursive: true });
        }

        const entry = {
            queued_at: new Date().toISOString(),
            reason: error?.message || 'Unknown DB error',
            payload,
        };

        fs.appendFileSync(PENDING_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (queueErr) {
        console.error('Failed to queue pending biometric log:', queueErr.message);
    }
};

const drainPendingBiometricLogs = async (limit = 25) => {
    if (!fs.existsSync(PENDING_FILE)) return { replayed: 0, remaining: 0 };

    const raw = fs.readFileSync(PENDING_FILE, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) return { replayed: 0, remaining: 0 };

    let replayed = 0;
    const keep = [];

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (replayed >= limit) {
            keep.push(line);
            continue;
        }

        try {
            const entry = JSON.parse(line);
            const payload = entry && entry.payload ? entry.payload : {};
            const queuedEmpId = String(payload.emp_id || '').trim();
            if (!queuedEmpId) {
                continue;
            }

            const queuedLogDate = payload.timestamp ? new Date(payload.timestamp) : new Date(entry.queued_at || Date.now());
            await ensureBiometricUser(queuedEmpId);
            await runWithSequenceFix(
                'INSERT INTO biometric_logs (device_id, emp_id, log_time, type) VALUES ($1, $2, $3, $4)',
                [payload.device_id || 'PENDING_QUEUE', queuedEmpId, queuedLogDate, payload.type || (queuedLogDate.getHours() < 12 ? 'IN' : 'OUT')],
                'biometric_logs'
            );
            replayed += 1;
        } catch (err) {
            keep.push(line);
        }
    }

    if (keep.length > 0) {
        fs.writeFileSync(PENDING_FILE, `${keep.join('\n')}\n`, 'utf8');
    } else {
        fs.unlinkSync(PENDING_FILE);
    }

    return { replayed, remaining: keep.length };
};

const ensureBiometricUser = async (empId) => {
    const safeEmpId = String(empId || '').trim();
    if (!safeEmpId) return;

    const placeholderPassword = `AUTO_BIOMETRIC_${safeEmpId}_${Date.now()}`;
    const passwordHash = await bcrypt.hash(placeholderPassword, 10);

    await pool.query(
        `INSERT INTO users (emp_id, password, role, name, designation)
         VALUES ($1, $2, 'staff', $3, 'Biometric Imported')
         ON CONFLICT (emp_id) DO NOTHING`,
        [safeEmpId, passwordHash, `Biometric User ${safeEmpId}`]
    );
};

// Helper: run a query, and on unique-violation (23505) attempt to reset sequence for given table and retry once
async function runWithSequenceFix(queryText, params = [], tableName = null) {
    try {
        return await pool.query(queryText, params);
    } catch (err) {
        if (err && err.code === '23505' && tableName) {
            try {
                const seqRes = await pool.query("SELECT pg_get_serial_sequence($1, 'id') as seqname", [tableName]);
                const seqName = seqRes.rows[0] && seqRes.rows[0].seqname;
                if (seqName) {
                    const maxRes = await pool.query(`SELECT COALESCE(MAX(id), 0) as maxid FROM ${tableName}`);
                    const next = parseInt(maxRes.rows[0].maxid, 10) + 1;
                    await pool.query('SELECT setval($1, $2, false)', [seqName, next]);
                    console.warn(`Sequence ${seqName} for ${tableName} was out of sync. Reset to ${next} and retrying query.`);
                    return await pool.query(queryText, params);
                }
            } catch (fixErr) {
                console.error('Error fixing sequence for', tableName, fixErr);
            }
        }
        throw err;
    }
}

// @desc    Receive biometric log from device
// @route   POST /api/biometric/log
// @access  Public (or protected with device key)
exports.receiveLog = async (req, res) => {
    const { device_id, emp_id, timestamp, type } = req.body;

    if (!emp_id) {
        return res.status(400).json({ message: 'emp_id is required' });
    }

    try {
        const normalizedEmpId = String(emp_id).trim();
        console.log(`Processing punch for User: ${normalizedEmpId}, Device: ${device_id}`);

        // Use provided timestamp or current server time
        const logDate = timestamp ? new Date(timestamp) : new Date();
        const dateStr = logDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
        const timeStr = logDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }); // HH:MM AM/PM in IST

        // 1. Check if User exists in the system
        const { rows: userRows } = await pool.query(
            'SELECT id, name, emp_id FROM users WHERE emp_id = $1',
            [normalizedEmpId]
        );

        let userExists = userRows.length > 0;
        if (!userExists) {
            await ensureBiometricUser(normalizedEmpId);
        }

        const { rows: refreshedUserRows } = await pool.query(
            'SELECT id, name, emp_id FROM users WHERE emp_id = $1',
            [normalizedEmpId]
        );

        userExists = refreshedUserRows.length > 0;
        const userName = userExists ? refreshedUserRows[0].name : `Unknown (${normalizedEmpId})`;

        // 2. Store raw log in biometric_logs (Audit Trail)
        try {
            await runWithSequenceFix(
                'INSERT INTO biometric_logs (device_id, emp_id, log_time, type) VALUES ($1, $2, $3, $4)',
                [device_id, normalizedEmpId, logDate, type || (logDate.getHours() < 12 ? 'IN' : 'OUT')],
                'biometric_logs'
            );
        } catch (logInsertError) {
            const isUserFkError =
                logInsertError &&
                logInsertError.code === '23503' &&
                String(logInsertError.constraint || '').includes('biometric_logs_emp_id_fkey');

            if (!isUserFkError) {
                throw logInsertError;
            }

            // Race-safe fallback: create user again and retry insert once.
            await ensureBiometricUser(normalizedEmpId);
            await runWithSequenceFix(
                'INSERT INTO biometric_logs (device_id, emp_id, log_time, type) VALUES ($1, $2, $3, $4)',
                [device_id, normalizedEmpId, logDate, type || (logDate.getHours() < 12 ? 'IN' : 'OUT')],
                'biometric_logs'
            );
        }

        if (!userExists) {
            console.warn(`⚠️ User ${emp_id} not found in users table. Skipping attendance sync.`);
            return res.status(200).json({
                message: 'Log saved, but user not found in system for attendance sync'
            });
        }

        // 3. Update biometric_attendance summary
        const { rows: existing } = await pool.query(
            'SELECT * FROM biometric_attendance WHERE user_id = $1 AND date = $2',
            [normalizedEmpId, dateStr]
        );

        const isFirstPunch = existing.length === 0;
        if (existing.length === 0) {
            await runWithSequenceFix(
                'INSERT INTO biometric_attendance (user_id, date, intime) VALUES ($1, $2, $3)',
                [normalizedEmpId, dateStr, timeStr],
                'biometric_attendance'
            );
        } else {
            await pool.query(
                'UPDATE biometric_attendance SET outtime = $1 WHERE id = $2',
                [timeStr, existing[0].id]
            );
        }

        // 4. Sync with main attendance table (attendance_records)
        // Reconstruct the daily timeline for the remarks field
            try {
            const COLLEGE_START = '09:00';
            const COLLEGE_END = '16:45';

            // Utility to convert HH:MM to minutes for comparison
            const toMins = (t) => {
                if (!t) return 0;
                const [h, m] = t.split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };

            // Get all physical punches for today
            const { rows: allPunches } = await pool.query(
                `SELECT log_time FROM biometric_logs 
                 WHERE emp_id = $1 AND (log_time AT TIME ZONE 'Asia/Kolkata')::date = $2::date 
                 ORDER BY log_time ASC`,
                [emp_id, dateStr]
            );

            // Get all approved leave segments
            const { rows: approvedLeaves } = await pool.query(
                `SELECT leave_type, is_half_day, dates_detail FROM leave_requests 
                 WHERE emp_id = $1 AND status = 'Approved' 
                 AND from_date <= $2 AND to_date >= $2`,
                [emp_id, dateStr]
            );

            // Get all approved permissions
            const { rows: approvedPerms } = await pool.query(
                `SELECT from_time, to_time FROM permission_requests 
                 WHERE emp_id = $1 AND status = 'Approved' AND date = $2`,
                [emp_id, dateStr]
            );

            let segments = [];

            // 1. Add Physical presence segments
            let physIn = null;
            let physOut = null;
            if (allPunches.length > 0) {
                physIn = new Date(allPunches[0].log_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
                if (allPunches.length > 1) {
                    physOut = new Date(allPunches[allPunches.length - 1].log_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
                }
                segments.push({ type: 'Present', from: physIn, to: physOut || physIn, fromMins: toMins(physIn), toMins: toMins(physOut || physIn) });
            }

            // 2. Add Leave/OD segments
            approvedLeaves.forEach(leave => {
                let details = [];
                try {
                    details = Array.isArray(leave.dates_detail) ? leave.dates_detail : (typeof leave.dates_detail === 'string' ? JSON.parse(leave.dates_detail) : []);
                } catch (e) { details = []; }

                const dayDetail = details.find(d => d.date === dateStr);
                if (dayDetail && (dayDetail.day_type || !dayDetail.is_full_day)) {
                    let f, t;
                    if (dayDetail.day_type === 'Half Day AM') { f = '09:00'; t = '13:00'; }
                    else if (dayDetail.day_type === 'Half Day PM') { f = '13:30'; t = '16:45'; }
                    else { f = dayDetail.from_time || '09:00'; t = dayDetail.to_time || '16:45'; }
                    segments.push({ type: leave.leave_type, from: f, to: t, fromMins: toMins(f), toMins: toMins(t), day_type: dayDetail.day_type });
                } else if (!leave.is_half_day) {
                    segments.push({ type: leave.leave_type, from: '09:00', to: '16:45', fromMins: toMins('09:00'), toMins: toMins('16:45'), isFull: true });
                }
            });

            // 3. Add Permission segments
            approvedPerms.forEach(perm => {
                segments.push({ type: 'Permission', from: perm.from_time, to: perm.to_time, fromMins: toMins(perm.from_time), toMins: toMins(perm.to_time) });
            });

            // 4. Detailed Calculation for Late Entry / Early Exit / Working Hours
            const STD_IN_MINS = 540;   // 09:00
            const STD_OUT_MINS = 1005; // 16:45

            let flags = [];
            let workingHoursStr = '0h 0m';
            let dbStatus = 'Present';

            if (physIn) {
                const inMins = toMins(physIn);
                const outMins = physOut ? toMins(physOut) : inMins;
                
                // Calculate Working Hours
                const diff = outMins - inMins;
                workingHoursStr = `${Math.floor(diff / 60)}h ${diff % 60}m`;

                // Check Late Entry: if punch-in is after standard 9:00
                let isLateEntry = false;
                let isEarlyExit = false;
                let isLateCovered = true;
                let isEarlyCovered = true;

                if (inMins > STD_IN_MINS) {
                    isLateEntry = true;
                    // Any approved leave or permission cancels the automatic LOP for being late
                    isLateCovered = segments.some(s => s.type !== 'Present'); 
                    flags.push(`Late Entry (${physIn})`);
                }

                // Check Early Exit: if punch-out is before standard 16:45
                // Only evaluate if there's actually a punch out
                if (physOut && outMins < STD_OUT_MINS) {
                    isEarlyExit = true;
                    // Any approved leave or permission cancels the automatic LOP for early exit
                    isEarlyCovered = segments.some(s => s.type !== 'Present');
                    flags.push(`Early Exit (${physOut})`);
                }

                // Status Logic: 
                const leaveSegments = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission');
                const leaveInfo = leaveSegments.length > 0 ? leaveSegments.map(s => `${s.type} (${s.from}-${s.to})`).join(' + ') : null;

                const hasUncovered = (isLateEntry && !isLateCovered) || (isEarlyExit && !isEarlyCovered);

                // 1. Uncovered late/early -> LOP (+ Leaves if any)
                if (hasUncovered) {
                    dbStatus = leaveInfo ? `LOP + ${leaveInfo}` : 'LOP';
                } else {
                    // 2. Covered -> Present (+ Leaves if any)
                    dbStatus = leaveInfo ? `Present + ${leaveInfo}` : 'Present';
                }
            } else {
                const fullDay = segments.find(s => s.isFull);
                const otherSegments = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission' && !s.isFull);
                const leaveInfo = otherSegments.length > 0 ? otherSegments.map(s => `${s.type} (${s.from}-${s.to})`).join(' + ') : null;

                if (fullDay) {
                    dbStatus = fullDay.type;
                } else if (leaveInfo) {
                    // Has partial leaves but no punch -> Absent + Leaves
                    dbStatus = `Absent + ${leaveInfo}`; 
                } else {
                    dbStatus = 'Absent';
                }
            }

            // Reconstruct Remarks: Work Duration | Status Flags | Approved Segments with Period & Duration
            const approvedInfoList = segments
                .filter(s => s.type !== 'Present')
                .map(s => {
                    const fromTimeStr = new Date(`2000-01-01T${s.from}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const toTimeStr = new Date(`2000-01-01T${s.to}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const durationInMins = s.toMins - s.fromMins;
                    const h = Math.floor(durationInMins / 60);
                    const m = durationInMins % 60;
                    return `${s.type}${s.day_type ? ' (' + s.day_type + ')' : ''}: ${fromTimeStr}-${toTimeStr} (${h}h ${m}m)`;
                });

            const finalRemarks = [
                `Working Hours: ${workingHoursStr}`,
                flags.length > 0 ? `Alerts: ${flags.join(', ')}` : null,
                approvedInfoList.length > 0 ? `Approved Segments: ${approvedInfoList.join(' | ')}` : null
            ].filter(Boolean).join(' | ');

            console.log(`Syncing Attendance for ${refreshedUserRows[0].emp_id} on ${dateStr}: Status=${dbStatus}, In=${physIn}, Out=${physOut}`);

            // We ALWAYS overwrite status, in_time, and out_time here because segments reflect the full truth
            await runWithSequenceFix(
                `INSERT INTO attendance_records (emp_id, date, in_time, out_time, status, remarks) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT (emp_id, date) 
                 DO UPDATE SET 
                    in_time = EXCLUDED.in_time, 
                    out_time = EXCLUDED.out_time,
                    status = EXCLUDED.status,
                    remarks = EXCLUDED.remarks`,
                [refreshedUserRows[0].emp_id, dateStr, physIn || null, physOut || null, dbStatus, finalRemarks || null],
                'attendance_records'
            );

        } catch (syncError) {
            console.error('Attendance reconstruction/sync error for', emp_id, ':', syncError.message);
            if (syncError.detail) console.error('Error detail:', syncError.detail);
        }

        // 5. Send persistent notifications to the user and all admins
        const message = `Biometric Punch Recorded: ${type || (isFirstPunch ? 'IN' : 'OUT')} at ${timeStr} for ${userName}`;

        // Notification for the user
        await createNotification(normalizedEmpId, message, 'attendance', null, null, false);

        // Notifications for all admins
        const { rows: admins } = await pool.query("SELECT emp_id, id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            if (admin.emp_id !== normalizedEmpId) { // Don't duplicate if user is also an admin
                await createNotification(admin.emp_id, message, 'attendance', null, null, false);
            }
        }

        // 6. Real-time update via socket - ONLY to user and admins
        const io = req.app.get('io');
        if (io) {
            const punchData = {
                emp_id: normalizedEmpId,
                name: userName,
                type: type || (isFirstPunch ? 'IN' : 'OUT'),
                time: timeStr,
                date: dateStr
            };

            // Emit to the user (identified by their ID as sent in the join event)
            if (refreshedUserRows[0].id) {
                io.to(refreshedUserRows[0].id).emit('biometric_punch', punchData);
            }

            // Emit to each admin
            admins.forEach(admin => {
                if (admin.id && admin.id !== refreshedUserRows[0].id) {
                    io.to(admin.id).emit('biometric_punch', punchData);
                }
            });
        }

        // Best-effort replay of previously queued logs whenever DB is healthy again.
        try {
            const replay = await drainPendingBiometricLogs(25);
            if (replay.replayed > 0) {
                console.log(`Replayed ${replay.replayed} queued biometric logs. Remaining: ${replay.remaining}`);
            }
        } catch (replayErr) {
            console.warn('Queued biometric replay skipped:', replayErr.message);
        }

        res.status(200).json({ message: 'Log processed successfully' });
    } catch (error) {
        console.error('🔴 Biometric processing error:', error);
        if (isTransientDbError(error)) {
            queuePendingBiometricLog(req.body, error);
            return res.status(202).json({
                message: 'Biometric punch queued due to temporary DB connectivity issue',
                error: error.message,
            });
        }
        res.status(500).json({
            message: 'Server Error during biometric processing',
            error: error.message
        });
    }
};

// @desc    Get biometric attendance data
// @route   GET /api/biometric/data
exports.getBiometricData = async (req, res) => {
    try {
        const { emp_id, date, month, startDate, endDate } = req.query;
        let query = `
            SELECT b.*, u.name, u.role, d.name as department_name
            FROM biometric_attendance b
            JOIN users u ON b.user_id = u.emp_id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (emp_id) {
            params.push(emp_id);
            query += ` AND b.user_id = $${params.length}`;
        }
        if (date) {
            params.push(date);
            query += ` AND b.date = $${params.length}`;
        } else if (startDate && endDate) {
            params.push(startDate, endDate);
            query += ` AND b.date >= $${params.length - 1} AND b.date <= $${params.length}`;
        } else if (month) {
            params.push(`${month}%`);
            query += ` AND b.date::text LIKE $${params.length}`;
        }

        query += ` ORDER BY b.date DESC, b.intime DESC`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching biometric data:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get biometric statistics
// @route   GET /api/biometric/stats
exports.getBiometricStats = async (req, res) => {
    try {
        const { rows: stats } = await pool.query(`
            SELECT 
                COUNT(DISTINCT user_id) as total_users,
                COUNT(*) as total_punches_today,
                (SELECT COUNT(*) FROM users) as total_registered
            FROM biometric_attendance
            WHERE date = CURRENT_DATE
        `);
        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching biometric stats:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
