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

const toIsoNow = () => new Date().toISOString();

exports.markAdmsHeartbeatSeen = (meta = null) => {
    admsLastSeenState.heartbeat = toIsoNow();
    admsLastSeenState.heartbeatMeta = meta;
};

exports.markAdmsCdataSeen = (meta = null) => {
    admsLastSeenState.cdata = toIsoNow();
    admsLastSeenState.cdataMeta = meta;
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
            await ensureBiometricUser(queuedEmpId);
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

const rebuildAttendanceFromBiometricTimeline = async (normalizedEmpId, dateStr) => {
    const toMins = (t) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const { rows: allPunches } = await pool.query(
        `SELECT log_time FROM biometric_logs
         WHERE emp_id = $1 AND (log_time AT TIME ZONE 'Asia/Kolkata')::date = $2::date
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

        if (physOut && outMins < STD_OUT_MINS) {
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
        [normalizedEmpId, dateStr, physIn || null, physOut || null, dbStatus, finalRemarks || null],
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
    const { device_id, emp_id, timestamp, type } = req.body;

    if (!emp_id) {
        return res.status(400).json({ message: 'emp_id is required' });
    }

    try {
        const normalizedEmpId = String(emp_id).trim();
        console.log(`Processing punch for User: ${normalizedEmpId}, Device: ${device_id}`);

        // Use provided timestamp or current server time
        const logDate = timestamp ? new Date(timestamp) : new Date();
        if (Number.isNaN(logDate.getTime())) {
            return res.status(400).json({ message: 'Invalid timestamp format' });
        }
        const dateStr = logDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
        const timeStr = logDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }); // HH:MM AM/PM in IST

        // Block rapid duplicate punches only for the SAME employee ID.
        // Different employee IDs are always allowed, even at the same second.
        const { rows: lastPunchRows } = await pool.query(
            `SELECT log_time
             FROM biometric_logs
             WHERE TRIM(emp_id) = $1
             ORDER BY log_time DESC
             LIMIT 1`,
            [normalizedEmpId]
        );

        if (lastPunchRows.length > 0) {
            const lastLogDate = new Date(lastPunchRows[0].log_time);
            const lastMs = lastLogDate.getTime();
            const currentMs = logDate.getTime();
            const nextAllowedAtMs = lastMs + MIN_PUNCH_INTERVAL_MS;

            if (currentMs <= nextAllowedAtMs) {
                const waitMs = Math.max(0, nextAllowedAtMs - currentMs);
                const mins = Math.floor(waitMs / 60000);
                const secs = Math.floor((waitMs % 60000) / 1000);
                return res.status(200).json({
                    message: `Duplicate punch ignored. Same employee can punch again only after 10 minutes. Please wait ${mins}m ${secs}s.`,
                    skipped: true,
                    reason: 'TOO_SOON'
                });
            }
        }

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
            console.warn(`⚠️ User ${normalizedEmpId} not found in users table. Skipping attendance sync.`);
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
                [normalizedEmpId, dateStr]
            );

            // Get all approved leave segments
            const { rows: approvedLeaves } = await pool.query(
                `SELECT leave_type, is_half_day, dates_detail FROM leave_requests 
                 WHERE emp_id = $1 AND status = 'Approved' 
                 AND from_date <= $2 AND to_date >= $2`,
                [normalizedEmpId, dateStr]
            );

            // Get all approved permissions
            const { rows: approvedPerms } = await pool.query(
                `SELECT from_time, to_time FROM permission_requests 
                 WHERE emp_id = $1 AND status = 'Approved' AND date = $2`,
                [normalizedEmpId, dateStr]
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
            const MORNING_HALF_DAY_END_MINS = 755; // 12:35
            const EVENING_HALF_DAY_START_MINS = 810; // 13:30

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
                let lateLopUnits = 0;
                let earlyLopUnits = 0;

                if (inMins > STD_IN_MINS) {
                    isLateEntry = true;
                    // Any approved leave or permission cancels the automatic LOP for being late
                    isLateCovered = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission').some(s => s.fromMins <= STD_IN_MINS && s.toMins >= inMins);
                    flags.push(`Late Entry (${physIn})`);

                    if (!isLateCovered) {
                        // Morning-only LOP window: 09:00 to 12:35 counts as half-day LOP.
                        lateLopUnits = inMins <= MORNING_HALF_DAY_END_MINS ? 0.5 : 1;
                        if (lateLopUnits === 0.5) {
                            flags.push('Late LOP (Morning)');
                        } else {
                            flags.push('Late LOP (Full Day)');
                        }
                    }
                }

                // Check Early Exit: if punch-out is before standard 16:45
                // Only evaluate if there's actually a punch out
                if (physOut && outMins < STD_OUT_MINS) {
                    isEarlyExit = true;
                    // Any approved leave or permission cancels the automatic LOP for early exit
                    isEarlyCovered = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission').some(s => s.fromMins <= outMins && s.toMins >= STD_OUT_MINS);
                    flags.push(`Early Exit (${physOut})`);

                    if (!isEarlyCovered) {
                        // Evening-only LOP window: 13:30 to 16:45 counts as half-day LOP.
                        earlyLopUnits = outMins >= EVENING_HALF_DAY_START_MINS ? 0.5 : 1;
                        if (earlyLopUnits === 0.5) {
                            flags.push('Early Exit LOP (Evening)');
                        } else {
                            flags.push('Early Exit LOP (Full Day)');
                        }
                    }
                }

                // Status Logic: 
                const leaveSegments = segments.filter(s => s.type !== 'Present' && s.type !== 'Permission');
                const leaveInfo = leaveSegments.length > 0 ? leaveSegments.map(s => `${s.type} (${s.from}-${s.to})`).join(' + ') : null;

                const lopUnits = Math.min(1, lateLopUnits + earlyLopUnits);

                // 1. Uncovered late/early -> LOP
                //    Half-day LOP is represented as "LOP + Present" so salary aggregation counts 0.5 unpaid.
                if (lopUnits >= 1) {
                    dbStatus = leaveInfo ? `LOP + ${leaveInfo}` : 'LOP';
                } else if (lopUnits === 0.5) {
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

        // Notification for the user (skip email for punch events)
        await createNotification(normalizedEmpId, message, 'attendance', null, null, true);

        // Notifications for all admins
        const { rows: admins } = await pool.query("SELECT emp_id, id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            if (admin.emp_id !== normalizedEmpId) { // Don't duplicate if user is also an admin
                await createNotification(admin.emp_id, message, 'attendance', null, null, true);
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

        // Reliability fallback: keep punch payload for replay even on non-transient failures.
        queuePendingBiometricLog(req.body, error);
        res.status(202).json({
            message: 'Biometric punch queued for retry due to processing error',
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
            SELECT b.*, u.name, u.role, d.name as department_name, 
                   ar.status as att_status, ar.remarks as att_remarks
            FROM biometric_attendance b
            JOIN users u ON b.user_id = u.emp_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN attendance_records ar ON b.user_id = ar.emp_id AND b.date = ar.date
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
