const { pool } = require('../config/db');
const { createNotification } = require('./notificationController');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PENDING_DIR = path.join(__dirname, '..', 'data');
const PENDING_FILE = path.join(PENDING_DIR, 'biometric_pending_logs.jsonl');
const MIN_PUNCH_INTERVAL_MS = 10 * 60 * 1000;

const admsLastSeenState = {
    heartbeat: null,
    heartbeatMeta: null,
    cdata: null,
    cdataMeta: null,
};

const admsCommandQueue = []; // Queue of { sn: string, command: string, id: string }

const toIsoNow = () => new Date().toISOString();

exports.markAdmsHeartbeatSeen = (meta = null) => {
    admsLastSeenState.heartbeat = toIsoNow();
    admsLastSeenState.heartbeatMeta = meta;
};

exports.markAdmsCdataSeen = (meta = null) => {
    admsLastSeenState.cdata = toIsoNow();
    admsLastSeenState.cdataMeta = meta;
};

// @desc    Store a command for an ADMS device to pick up on its next heartbeat poll
exports.enqueueAdmsCommand = (sn, commandText) => {
    const id = `CMD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    admsCommandQueue.push({ id, sn, command: commandText, status: 'pending' });
    console.log(`[BIOMETRIC] Command enqueued for SN=${sn}: ${commandText} (ID: ${id})`);
    return id;
};

// @desc    Retrieve the next pending command for a device SN
exports.getNextAdmsCommand = (sn) => {
    const idx = admsCommandQueue.findIndex(c => c.sn === sn && c.status === 'pending');
    if (idx !== -1) {
        const cmd = admsCommandQueue[idx];
        cmd.status = 'sent';
        cmd.sentAt = toIsoNow();
        // ZKTeco format: C:ID:COMMANDNAME ARGS
        return `C:${cmd.id}:${cmd.command}`;
    }
    return null;
};

// @desc    Confirm command execution from device
exports.reportAdmsCommandStatus = (id, status) => {
    const cmd = admsCommandQueue.find(c => c.id === id);
    if (cmd) {
        cmd.status = status || 'completed';
        cmd.completedAt = toIsoNow();
        console.log(`[BIOMETRIC] Command ${id} marked as ${cmd.status}`);
    }
};

// @desc    Get ADMS last heartbeat/cdata seen times
// @route   GET /api/biometric/adms-last-seen
// @access  Private (Admin)
exports.getAdmsLastSeen = async (req, res) => {
    return res.status(200).json({
        heartbeat_last_seen_at: admsLastSeenState.heartbeat,
        cdata_last_seen_at: admsLastSeenState.cdata,
        heartbeat_meta: admsLastSeenState.heartbeatMeta,
        cdata_meta: admsLastSeenState.cdataMeta,
        now: toIsoNow(),
    });
};

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
            // No longer forcing user creation here
            await runWithSequenceFix(
                'INSERT INTO biometric_logs (device_id, emp_id, log_time, type) VALUES ($1, $2, $3, $4)',
                [payload.device_id || 'PENDING_QUEUE', queuedEmpId, queuedLogDate, payload.type || (queuedLogDate.getHours() < 12 ? 'IN' : 'OUT')],
                'biometric_logs'
            );
            const queuedDateStr = queuedLogDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            await rebuildAttendanceFromBiometricTimeline(queuedEmpId, queuedDateStr);
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

exports.rebuildAttendanceFromBiometricTimeline = async (normalizedEmpId, dateStr) => {
    const toMins = (t) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const { rows: allPunches } = await pool.query(
        `SELECT log_time FROM biometric_logs
         WHERE TRIM(emp_id) = $1 AND (log_time AT TIME ZONE 'Asia/Kolkata')::date = $2::date
         ORDER BY log_time ASC`,
        [normalizedEmpId, dateStr]
    );

    const { rows: approvedLeaves } = await pool.query(
        `SELECT leave_type, is_half_day, dates_detail FROM leave_requests
         WHERE emp_id = $1 AND status = 'Approved'
         AND from_date <= $2 AND to_date >= $2`,
        [normalizedEmpId, dateStr]
    );

    const { rows: approvedPerms } = await pool.query(
        `SELECT from_time, to_time FROM permission_requests
         WHERE emp_id = $1 AND status = 'Approved' AND date = $2`,
        [normalizedEmpId, dateStr]
    );

    let segments = [];
    let physIn = null;
    let physOut = null;

    if (allPunches.length > 0) {
        physIn = new Date(allPunches[0].log_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
        if (allPunches.length > 1) {
            physOut = new Date(allPunches[allPunches.length - 1].log_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
        }
        segments.push({ type: 'Present', from: physIn, to: physOut || physIn, fromMins: toMins(physIn), toMins: toMins(physOut || physIn) });
    }

    approvedLeaves.forEach((leave) => {
        let details = [];
        try {
            details = Array.isArray(leave.dates_detail) ? leave.dates_detail : (typeof leave.dates_detail === 'string' ? JSON.parse(leave.dates_detail) : []);
        } catch (e) { details = []; }

        const dayDetail = details.find((d) => d.date === dateStr);
        if (dayDetail && (dayDetail.day_type || !dayDetail.is_full_day)) {
            let f;
            let t;
            if (dayDetail.day_type === 'Half Day AM') { f = '09:00'; t = '13:00'; }
            else if (dayDetail.day_type === 'Half Day PM') { f = '13:30'; t = '16:45'; }
            else { f = dayDetail.from_time || '09:00'; t = dayDetail.to_time || '16:45'; }
            segments.push({ type: leave.leave_type, from: f, to: t, fromMins: toMins(f), toMins: toMins(t), day_type: dayDetail.day_type });
        } else if (!leave.is_half_day) {
            segments.push({ type: leave.leave_type, from: '09:00', to: '16:45', fromMins: toMins('09:00'), toMins: toMins('16:45'), isFull: true });
        }
    });

    approvedPerms.forEach((perm) => {
        segments.push({ type: 'Permission', from: perm.from_time, to: perm.to_time, fromMins: toMins(perm.from_time), toMins: toMins(perm.to_time) });
    });

    const STD_IN_MINS = 540;
    const STD_OUT_MINS = 1005;
    const MORNING_HALF_DAY_END_MINS = 755;
    const EVENING_HALF_DAY_START_MINS = 810;

    let flags = [];
    let workingHoursStr = '0h 0m';
    let dbStatus = 'Present';

    if (physIn) {
        const inMins = toMins(physIn);
        const outMins = physOut ? toMins(physOut) : inMins;
        const diff = outMins - inMins;
        workingHoursStr = `${Math.floor(diff / 60)}h ${diff % 60}m`;

        let isLateEntry = false;
        let isEarlyExit = false;
        let isLateCovered = true;
        let isEarlyCovered = true;
        let lateLopUnits = 0;
        let earlyLopUnits = 0;

        if (inMins > STD_IN_MINS) {
            isLateEntry = true;
            isLateCovered = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission').some(s => s.fromMins <= STD_IN_MINS && s.toMins >= inMins);
            flags.push(`Late Entry (${physIn})`);
            if (!isLateCovered) {
                // If late after 9:00 and not covered by leave, mark as LOP
                lateLopUnits = inMins <= MORNING_HALF_DAY_END_MINS ? 0.5 : 1;
                if (lateLopUnits === 0.5) flags.push('Late LOP (Morning)');
                else flags.push('Late LOP (Full Day)');
            }
        }

        if (physOut && outMins < STD_OUT_MINS && outMins > inMins) {
            isEarlyExit = true;
            isEarlyCovered = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission').some(s => s.fromMins <= outMins && s.toMins >= STD_OUT_MINS);
            flags.push(`Early Exit (${physOut})`);
            if (!isEarlyCovered) {
                earlyLopUnits = outMins >= EVENING_HALF_DAY_START_MINS ? 0.5 : 1;
                if (earlyLopUnits === 0.5) flags.push('Early Exit LOP (Evening)');
                else flags.push('Early Exit LOP (Full Day)');
            }
        }

        const leaveSegments = segments.filter((s) => s.type !== 'Present' && s.type !== 'Permission');
        const leaveInfo = leaveSegments.length > 0 ? leaveSegments.map((s) => `${s.type} (${s.from}-${s.to})`).join(' + ') : null;
        const lopUnits = Math.min(1, lateLopUnits + earlyLopUnits);

        if (lopUnits >= 1) {
            dbStatus = leaveInfo ? `LOP + ${leaveInfo}` : 'LOP';
        } else if (lopUnits === 0.5) {
            // Check if it was Late Entry specifically
            if (isLateEntry && !isLateCovered) {
                dbStatus = leaveInfo ? `LOP (Late) + ${leaveInfo}` : 'LOP (Late Entry) + Present';
            } else if (isEarlyExit && !isEarlyCovered) {
                dbStatus = leaveInfo ? `LOP (Early) + ${leaveInfo}` : 'LOP (Early Exit) + Present';
            } else {
                dbStatus = 'LOP + Present';
            }
        } else {
            dbStatus = leaveInfo ? (isLateEntry ? `Present (Late) + ${leaveInfo}` : `Present + ${leaveInfo}`) : (isLateEntry ? 'Present (Late Entry)' : 'Present');
        }
    } else {
        const fullDay = segments.find((s) => s.isFull);
        const otherSegments = segments.filter((s) => s.type !== 'Present' && s.type !== 'Permission' && !s.isFull);
        const leaveInfo = otherSegments.length > 0 ? otherSegments.map((s) => `${s.type} (${s.from}-${s.to})`).join(' + ') : null;
        if (fullDay) dbStatus = fullDay.type;
        else if (leaveInfo) dbStatus = `Absent + ${leaveInfo}`;
        else dbStatus = 'Absent';
    }

    // MAP TO VALID DATABASE ENUM VALUES (Present, LOP, Absent, CL, ML, OD, etc.)
    // Detailed info like "LOP (Late) + CL" must go in remarks because the status column is a strict ENUM.
    let enumStatus = 'Present';
    if (dbStatus.includes('LOP')) {
        enumStatus = 'LOP';
    } else if (dbStatus.includes('Absent')) {
        enumStatus = 'Absent';
    } else if (dbStatus.includes('CL')) {
        enumStatus = 'CL';
    } else if (dbStatus.includes('ML')) {
        enumStatus = 'ML';
    } else if (dbStatus.includes('OD')) {
        enumStatus = 'OD';
    } else if (dbStatus.includes('Comp Leave')) {
        enumStatus = 'Comp Leave';
    } else if (dbStatus.includes('Holiday')) {
        enumStatus = 'Holiday';
    } else if (dbStatus.includes('Weekend')) {
        enumStatus = 'Weekend';
    } else if (dbStatus.includes('Present')) {
        enumStatus = 'Present';
    }


    const approvedInfoList = segments
        .filter((s) => s.type !== 'Present')
        .map((s) => {
            const fromTimeStr = new Date(`2000-01-01T${s.from}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const toTimeStr = new Date(`2000-01-01T${s.to}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const durationInMins = s.toMins - s.fromMins;
            const h = Math.floor(durationInMins / 60);
            const m = durationInMins % 60;
            return `${s.type}${s.day_type ? ' (' + s.day_type + ')' : ''}: ${fromTimeStr}-${toTimeStr} (${h}h ${m}m)`;
        });

    const finalRemarks = [
        `Status: ${dbStatus}`, // Keep the detailed string here for UI
        `Working Hours: ${workingHoursStr}`,
        flags.length > 0 ? `Alerts: ${flags.join(', ')}` : null,
        approvedInfoList.length > 0 ? `Approved Segments: ${approvedInfoList.join(' | ')}` : null
    ].filter(Boolean).join(' | ');


    await runWithSequenceFix(
        `INSERT INTO biometric_attendance (user_id, date, intime, outtime)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, date)
         DO UPDATE SET
            intime = EXCLUDED.intime,
            outtime = EXCLUDED.outtime`,
        [normalizedEmpId, dateStr, physIn || null, physOut || null],
        'biometric_attendance'
    );

    await runWithSequenceFix(
        `INSERT INTO attendance_records (emp_id, date, in_time, out_time, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (emp_id, date)
         DO UPDATE SET
            in_time = EXCLUDED.in_time,
            out_time = EXCLUDED.out_time,
            status = EXCLUDED.status,
            remarks = EXCLUDED.remarks`,
        [normalizedEmpId, dateStr, physIn || null, physOut || null, enumStatus, finalRemarks || null],
        'attendance_records'
    );

    return { dbStatus, physIn, physOut };
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
    const { device_id, emp_id, user_id, timestamp, recordTime, type, device_ip, skipDuplicateGuard } = req.body;
    const finalEmpId = String(emp_id || user_id || '').trim();

    if (!finalEmpId) {
        return res.status(400).json({ message: 'emp_id or user_id is required' });
    }

    try {
        const normalizedEmpId = finalEmpId;
        const deviceId = device_id || device_ip || 'ZK_ZKTECO';
        const finalTimestamp = timestamp || recordTime;
        console.log(`Processing punch for User: ${normalizedEmpId}, Device: ${deviceId}`);

        // Use provided timestamp or current server time
        const logDate = finalTimestamp ? new Date(finalTimestamp) : new Date();
        if (Number.isNaN(logDate.getTime())) {
            return res.status(400).json({ message: 'Invalid timestamp format' });
        }
        const dateStr = logDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
        const timeStr = logDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }); // HH:MM AM/PM in IST

        // 1. Only accept logs for employees that exist in the users table.
        const { rows: userRows } = await pool.query(
            'SELECT 1 FROM users WHERE TRIM(emp_id) = $1 LIMIT 1',
            [normalizedEmpId]
        );

        if (userRows.length === 0) {
            return res.status(200).json({
                message: `Unknown employee ${normalizedEmpId}. Log ignored.`,
                skipped: true,
                reason: 'UNKNOWN_EMPLOYEE'
            });
        }

        // 2. Optionally block rapid duplicate punches for the same employee within 10 minutes.
        if (!skipDuplicateGuard) {
            const marginMs = MIN_PUNCH_INTERVAL_MS;
            const startTime = new Date(logDate.getTime() - marginMs);
            const endTime = new Date(logDate.getTime() + marginMs);

            const { rows: nearPunchRows } = await pool.query(
                `SELECT id, log_time
                 FROM biometric_logs
                 WHERE TRIM(emp_id) = $1
                 AND log_time >= $2 AND log_time <= $3
                 LIMIT 1`,
                [normalizedEmpId, startTime, endTime]
            );

            if (nearPunchRows.length > 0) {
                console.log(`[BIOMETRIC] Duplicate punch ignored for ${normalizedEmpId} at ${logDate.toISOString()} (Found existing at ${nearPunchRows[0].log_time})`);
                return res.status(200).json({
                    message: `Duplicate punch ignored. Punch already exists within 10 minutes.`,
                    skipped: true,
                    reason: 'DUPLICATE_OR_TOO_SOON'
                });
            }
        }

        // 3. Store raw log in biometric_logs (Audit Trail)
        // This log table stores EVERYTHING (minutely/hourly records for full history)
        // Uses ON CONFLICT to swallow exact duplicates sent by device/sync scripts
        await runWithSequenceFix(
            `INSERT INTO biometric_logs (device_id, emp_id, log_time, type) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (emp_id, log_time) 
             DO UPDATE SET device_id = EXCLUDED.device_id, type = EXCLUDED.type`,
            [deviceId || 'ADMS', normalizedEmpId, logDate, type || (logDate.getHours() < 12 ? 'IN' : 'OUT')],
            'biometric_logs'
        );

        // 4. Sync summaries (biometric_attendance and attendance_records)
        // We use the unified rebuild function to ensure consistency and handle past-date updates properly.
        // This function automatically picks min(time) as in, max(time) as out, and replaces existing values.
        let syncResult = { dbStatus: 'Present', physIn: null, physOut: null };
        if (!req.body.skipRebuild) {
            syncResult = await rebuildAttendanceFromBiometricTimeline(normalizedEmpId, dateStr);
        }

        // 5. Real-time notifications and socket updates
        const userName = `User ${normalizedEmpId}`; // Fallback if name not looked up
        const isFirstPunch = !syncResult.physOut; // If physOut is null, it's either the first punch or only one punch exists
        const message = `Biometric Punch Recorded: ${type || (isFirstPunch ? 'IN' : 'OUT')} at ${timeStr} for ${normalizedEmpId}`;

        // Notifications (best-effort)
        try {
            await createNotification(normalizedEmpId, message, 'attendance', null, null, true);
        } catch (e) {}

        // Socket emitter
        const io = req.app.get('io');
        if (io) {
            const punchData = {
                emp_id: normalizedEmpId,
                type: type || (isFirstPunch ? 'IN' : 'OUT'),
                time: timeStr,
                date: dateStr
            };
            io.emit('biometric_punch', punchData); // Broadcast for updates
        }

        // 6. Best-effort replay of previously queued logs
        try {
            await drainPendingBiometricLogs(5);
        } catch (e) {}

        return res.status(200).json({ message: 'Log processed successfully (Attendance Synced)' });
    } catch (error) {
        console.error('🔴 Biometric processing error:', error);
        if (isTransientDbError(error)) {
            queuePendingBiometricLog(req.body, error);
            return res.status(202).json({ message: 'Biometric punch queued due to temporary DB issue' });
        }
        queuePendingBiometricLog(req.body, error);
        return res.status(202).json({ message: 'Biometric punch queued for retry' });
    }
};

// @desc    Get biometric attendance data
// @route   GET /api/biometric/data
// @desc    Get raw biometric punch logs for auditing
// @route   GET /api/biometric/raw-logs
exports.getRawBiometricLogs = async (req, res) => {
    try {
        const { emp_id, date, limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT l.*, u.name 
            FROM biometric_logs l
            LEFT JOIN users u ON TRIM(l.emp_id) = u.emp_id
            WHERE 1=1
        `;
        const params = [];
        if (emp_id) {
            params.push(emp_id);
            query += ` AND TRIM(l.emp_id) = $${params.length}`;
        }
        if (date) {
            params.push(date);
            query += ` AND (l.log_time AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}`;
        }
        query += ` ORDER BY l.log_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching raw biometric logs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get biometric attendance data
exports.getBiometricData = async (req, res) => {
    try {
        const { emp_id, date, month, startDate, endDate } = req.query;
        let query = `
            SELECT b.*, u.name, u.role, d.name as department_name, 
                   ar.status as att_status, ar.remarks as att_remarks
            FROM biometric_attendance b
            JOIN users u ON TRIM(b.user_id) = TRIM(u.emp_id)
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN attendance_records ar ON TRIM(b.user_id) = TRIM(ar.emp_id) AND b.date = ar.date
            WHERE 1=1
        `;
        const params = [];

        if (emp_id) {
            params.push(String(emp_id).trim());
            query += ` AND TRIM(b.user_id) = $${params.length}`;
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

// @desc    Get all registered employee IDs (internal bridge utility)
exports.getRegisteredEmpIds = async (req, res) => {
    try {
        console.log('📡 Bridge is fetching Employee IDs...');
        const result = await pool.query('SELECT emp_id FROM users');
        const ids = result.rows
            .filter(r => r.emp_id) // Skip users with no ID
            .map(r => String(r.emp_id).trim());
            
        console.log(`✅ Bridge Sync: Sending list of ${ids.length} registered users.`);
        res.json(ids);
    } catch (error) {
        // 🎯 Catch the exact error reason
        console.error('❌ Database Access Error:', error.message);
        res.status(500).json({ 
            message: 'Database Access Error', 
            error: error.message 
        });
    }
};

// @desc    Get biometric statistics
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

// @desc    Retroactively rebuild attendance status from biometric logs for a range or today
// @route   POST /api/biometric/rebuild-today
// @access  Private (Admin)
exports.rebuildTodayPunches = async (req, res) => {
    try {
        const { fromDate, toDate } = req.body;
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        const start = fromDate || todayStr;
        const end = toDate || todayStr;

        console.log(`[BIOMETRIC] Rebuilding attendance from ${start} to ${end}`);

        // Get all employees who have biometric logs in the range
        const { rows: affectedEmployees } = await pool.query(
            `SELECT DISTINCT TRIM(emp_id) as emp_id, (log_time AT TIME ZONE 'Asia/Kolkata')::date as log_date
             FROM biometric_logs
             WHERE (log_time AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
               AND (log_time AT TIME ZONE 'Asia/Kolkata')::date <= $2::date`,
            [start, end]
        );

        if (affectedEmployees.length === 0) {
            return res.status(200).json({ message: 'No biometric punches found for the specified range.', updated: 0 });
        }

        let updated = 0;
        let errors = 0;
        const results = [];

        for (const row of affectedEmployees) {
            try {
                const dateStr = row.log_date; // This will be YYYY-MM-DD string due to pg-types parser
                const result = await rebuildAttendanceFromBiometricTimeline(row.emp_id, dateStr);
                updated++;
                results.push({ emp_id: row.emp_id, date: dateStr, status: result.dbStatus, in: result.physIn, out: result.physOut });
            } catch (err) {
                errors++;
                console.error(`Failed to rebuild attendance for ${row.emp_id} on ${row.log_date}:`, err.message);
            }
        }

        // Emit real-time update so dashboards refresh
        const io = req.app.get('io');
        if (io) io.emit('attendance_updated', { range: { start, end }, action: 'rebuild', count: updated });

        return res.status(200).json({
            message: `Rebuilt attendance for ${updated} records (${errors} errors).`,
            range: { start, end },
            updated,
            errors,
            results: results.slice(0, 50) // Don't overwhelm response if thousands
        });
    } catch (error) {
        console.error('Error rebuilding attendance from logs:', error);
        return res.status(500).json({ message: 'Failed to rebuild attendance', error: error.message });
    }
};

// @desc    Backfill today's manual attendance times into biometric live tables
// @route   POST /api/biometric/backfill-today-from-attendance
// @access  Private (Admin/Management)
exports.backfillTodayFromAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertLogsResult = await client.query(`
            WITH source_rows AS (
                SELECT
                    ar.emp_id,
                    ar.date::date AS att_date,
                    NULLIF(TRIM(ar.in_time::text), '')::time AS in_time_val,
                    NULLIF(TRIM(ar.out_time::text), '')::time AS out_time_val
                FROM attendance_records ar
                WHERE ar.date::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
                  AND (ar.in_time IS NOT NULL OR ar.out_time IS NOT NULL)
            ), candidate_logs AS (
                SELECT emp_id, (att_date::timestamp + in_time_val) AS log_time, 'IN'::text AS log_type
                FROM source_rows
                WHERE in_time_val IS NOT NULL
                UNION ALL
                SELECT emp_id, (att_date::timestamp + out_time_val) AS log_time, 'OUT'::text AS log_type
                FROM source_rows
                WHERE out_time_val IS NOT NULL
            )
            INSERT INTO biometric_logs (device_id, emp_id, log_time, type)
            SELECT
                'MANUAL_ATTENDANCE_SYNC',
                cl.emp_id,
                cl.log_time,
                cl.log_type::biometric_log_type
            FROM candidate_logs cl
            WHERE NOT EXISTS (
                SELECT 1
                FROM biometric_logs b
                WHERE b.emp_id = cl.emp_id
                  AND b.log_time = cl.log_time
                  AND COALESCE(b.type::text, '') = cl.log_type
            )
            RETURNING emp_id
        `);

        const upsertBiometricAttendanceResult = await client.query(`
            WITH today_rollup AS (
                SELECT
                    b.emp_id AS user_id,
                    (b.log_time AT TIME ZONE 'Asia/Kolkata')::date AS punch_date,
                    MIN((b.log_time AT TIME ZONE 'Asia/Kolkata')::time) AS first_punch,
                    MAX((b.log_time AT TIME ZONE 'Asia/Kolkata')::time) AS last_punch
                FROM biometric_logs b
                WHERE (b.log_time AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
                GROUP BY b.emp_id, (b.log_time AT TIME ZONE 'Asia/Kolkata')::date
            )
            INSERT INTO biometric_attendance (user_id, date, intime, outtime)
            SELECT user_id, punch_date, first_punch, last_punch
            FROM today_rollup
            ON CONFLICT (user_id, date)
            DO UPDATE SET
                intime = EXCLUDED.intime,
                outtime = EXCLUDED.outtime
            RETURNING user_id
        `);

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Today attendance backfill to biometric live data completed',
            insertedBiometricLogs: insertLogsResult.rowCount,
            upsertedBiometricAttendanceRows: upsertBiometricAttendanceResult.rowCount,
            date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error backfilling today attendance to biometric data:', error);
        return res.status(500).json({
            message: 'Failed to backfill today attendance into biometric live data',
            error: error.message,
        });
    } finally {
        client.release();
    }
};
// @desc    Initiate a pull of all logs from the device memory
// @route   POST /api/biometric/pull-logs
// @access  Private (Admin)
exports.pullLogs = async (req, res) => {
    try {
        const { sn } = req.body;
        if (!sn) return res.status(400).json({ message: 'Device Serial Number (SN) is required' });

        // DATA QUERY ATTLOG is the standard ADMS command to request all attendance logs
        exports.enqueueAdmsCommand(sn, 'DATA QUERY ATTLOG');

        return res.status(200).json({ 
            message: `Pull Logs command enqueued for device ${sn}. It will be delivered on the next device poll.`,
            sn 
        });
    } catch (error) {
        console.error('Error enqueuing pull logs command:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
