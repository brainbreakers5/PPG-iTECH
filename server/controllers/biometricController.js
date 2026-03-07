const { pool } = require('../config/db');

// @desc    Receive biometric log from device
// @route   POST /api/biometric/log
// @access  Public (or protected with device key)
exports.receiveLog = async (req, res) => {
    const { device_id, emp_id, timestamp, type } = req.body;

    if (!emp_id) {
        return res.status(400).json({ message: 'emp_id is required' });
    }

    try {
        console.log(`Processing punch for User: ${emp_id}, Device: ${device_id}`);

        // Use provided timestamp or current server time
        const logDate = timestamp ? new Date(timestamp) : new Date();
        const dateStr = logDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = logDate.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS

        // 1. Check if User exists in the system
        const { rows: userRows } = await pool.query(
            'SELECT name, emp_id FROM users WHERE emp_id = $1',
            [emp_id]
        );

        const userExists = userRows.length > 0;
        const userName = userExists ? userRows[0].name : `Unknown (${emp_id})`;

        // 2. Store raw log in biometric_logs (Audit Trail) - No foreign key constraint usually here, but let's be safe
        await pool.query(
            'INSERT INTO biometric_logs (device_id, emp_id, log_time, type) VALUES ($1, $2, $3, $4)',
            [device_id, emp_id, logDate, type || (logDate.getHours() < 12 ? 'IN' : 'OUT')]
        );

        if (!userExists) {
            console.warn(`⚠️ User ${emp_id} not found in users table. Skipping attendance sync.`);
            return res.status(200).json({
                message: 'Log saved, but user not found in system for attendance sync'
            });
        }

        // 3. Update biometric_attendance summary
        const { rows: existing } = await pool.query(
            'SELECT * FROM biometric_attendance WHERE user_id = $1 AND date = $2',
            [emp_id, dateStr]
        );

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO biometric_attendance (user_id, date, intime) VALUES ($1, $2, $3)',
                [emp_id, dateStr, timeStr]
            );
        } else {
            await pool.query(
                'UPDATE biometric_attendance SET outtime = $1 WHERE id = $2',
                [timeStr, existing[0].id]
            );
        }

        // 4. Sync with main attendance table (attendance_records)
        // Using 'attendance_records' as it's the table used in attendanceController.js
        try {
            await pool.query(
                `INSERT INTO attendance_records (emp_id, date, in_time, status) 
                 VALUES ($1, $2, $3, 'Present') 
                 ON CONFLICT (emp_id, date) 
                 DO UPDATE SET out_time = $4, status = 'Present'`,
                [emp_id, dateStr, timeStr, timeStr]
            );
        } catch (syncError) {
            console.error('Main attendance sync failed (trying fallback table name):', syncError.message);
            // Fallback to 'attendance' if 'attendance_records' fails
            await pool.query(
                `INSERT INTO attendance (emp_id, date, in_time, status) 
                 VALUES ($1, $2, $3, 'Present') 
                 ON CONFLICT (emp_id, date) 
                 DO UPDATE SET out_time = $4, status = 'Present'`,
                [emp_id, dateStr, timeStr, timeStr]
            );
        }

        // 5. Real-time update via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('biometric_punch', {
                emp_id,
                name: userName,
                type: type || (existing.length === 0 ? 'IN' : 'OUT'),
                time: timeStr,
                date: dateStr
            });
        }

        res.status(200).json({ message: 'Log processed successfully' });
    } catch (error) {
        console.error('🔴 Biometric processing error:', error);
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
        const { emp_id, date, month } = req.query;
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
