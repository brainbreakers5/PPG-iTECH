const { pool } = require('../config/db');

// @desc    Apply for permission
// @route   POST /api/permissions
// @access  Private
exports.applyPermission = async (req, res) => {
    const { date, from_time, to_time, subject, reason } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create permission request
        const { rows } = await client.query(
            `INSERT INTO permission_requests (emp_id, date, from_time, to_time, subject, reason, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Pending') RETURNING id`,
            [req.user.emp_id, date, from_time, to_time, subject || 'Permission Request', reason]
        );
        const permissionId = rows[0].id;

        // 2. Determine next approver: If applicant is HOD, send directly to Principal; otherwise send to department HOD (if exists) or Principal
        if (req.user.role === 'hod') {
            const { rows: principalRows } = await client.query(
                `SELECT emp_id FROM users WHERE role = 'principal' LIMIT 1`
            );
            if (principalRows.length > 0) {
                await client.query(
                    `INSERT INTO permission_approvals (permission_id, approver_id, approver_type, status)
                     VALUES ($1, $2, 'principal', 'Pending')`,
                    [permissionId, principalRows[0].emp_id]
                );
                await client.query(
                    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                    [principalRows[0].emp_id, `New permission request from HOD ${req.user.name} requires your approval.`]
                );
            }
        } else {
            // Send to HOD for approval if available, otherwise to Principal
            const { rows: hodRows } = await client.query(
                `SELECT emp_id FROM users WHERE department_id = $1 AND role = 'hod'`,
                [req.user.department_id]
            );

            if (hodRows.length > 0) {
                await client.query(
                    `INSERT INTO permission_approvals (permission_id, approver_id, approver_type, status)
                     VALUES ($1, $2, 'hod', 'Pending')`,
                    [permissionId, hodRows[0].emp_id]
                );

                await client.query(
                    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                    [hodRows[0].emp_id, `New permission request from ${req.user.name} for ${new Date(date).toLocaleDateString('en-IN')}.`]
                );
            } else {
                const { rows: principalRows } = await client.query(
                    `SELECT emp_id FROM users WHERE role = 'principal' LIMIT 1`
                );
                if (principalRows.length > 0) {
                    await client.query(
                        `INSERT INTO permission_approvals (permission_id, approver_id, approver_type, status)
                         VALUES ($1, $2, 'principal', 'Pending')`,
                        [permissionId, principalRows[0].emp_id]
                    );
                    await client.query(
                        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                        [principalRows[0].emp_id, `New permission request from ${req.user.name} requires your approval.`]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Permission request submitted.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('APPLY PERMISSION ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Get permission requests (own + those needing approval)
// @route   GET /api/permissions
// @access  Private
exports.getPermissions = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT p.*, u.name as applicant_name, u.role as applicant_role, 
                   u.profile_pic as applicant_pic, d.name as department_name,
                   pa.status as my_approval_status, pa.approver_type as my_approver_type, 
                   pa.comments as approval_notes, pa.updated_at as approval_acted_at
            FROM permission_requests p
            JOIN users u ON p.emp_id = u.emp_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN permission_approvals pa ON p.id = pa.permission_id AND pa.approver_id = $1
            WHERE p.emp_id = $2 OR pa.approver_id = $3
            ORDER BY p.created_at DESC
        `, [req.user.emp_id, req.user.emp_id, req.user.emp_id]);

        res.json(rows);
    } catch (error) {
        console.error('GET PERMISSIONS ERROR:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Approve/Reject permission request
// @route   PUT /api/permissions/:id/approve
// @access  Private
exports.approvePermission = async (req, res) => {
    const { status, comments } = req.body;
    const permissionId = req.params.id;
    const userId = req.user.emp_id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find pending approval for this user
        const { rows: approval } = await client.query(
            `SELECT * FROM permission_approvals WHERE permission_id = $1 AND approver_id = $2 AND status = 'Pending'`,
            [permissionId, userId]
        );

        if (approval.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pending approval not found' });
        }

        const currentStep = approval[0];

        // 2. Update approval status
        await client.query(
            'UPDATE permission_approvals SET status = $1, comments = $2, updated_at = NOW() WHERE id = $3',
            [status, comments, currentStep.id]
        );

        // 3. Handle Rejection
        if (status === 'Rejected') {
            await client.query(
                'UPDATE permission_requests SET status = $1 WHERE id = $2',
                ['Rejected', permissionId]
            );

            const { rows: reqRows } = await client.query(
                'SELECT emp_id FROM permission_requests WHERE id = $1',
                [permissionId]
            );

            await client.query(
                `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                [reqRows[0].emp_id, `Your permission request has been REJECTED by ${req.user.name}.`]
            );
        }

        // 4. Handle Approval & Escalation
        if (status === 'Approved') {
            if (currentStep.approver_type === 'hod') {
                // Escalate to principal
                const { rows: principalRows } = await client.query(
                    `SELECT emp_id FROM users WHERE role = 'principal' LIMIT 1`
                );

                if (principalRows.length > 0) {
                    await client.query(
                        `INSERT INTO permission_approvals (permission_id, approver_id, approver_type, status)
                         VALUES ($1, $2, 'principal', 'Pending')`,
                        [permissionId, principalRows[0].emp_id]
                    );
                    await client.query(
                        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                        [principalRows[0].emp_id, `Permission request escalated to Principal for final approval.`]
                    );
                }
            } else if (currentStep.approver_type === 'principal' || currentStep.approver_type === 'admin') {
                // Final approval — mark permission as approved
                await client.query(
                    'UPDATE permission_requests SET status = $1 WHERE id = $2',
                    ['Approved', permissionId]
                );

                // Get the permission details to mark attendance as Present
                const { rows: permReq } = await client.query(
                    'SELECT emp_id, date, from_time FROM permission_requests WHERE id = $1',
                    [permissionId]
                );

                if (permReq.length > 0) {
                    const { emp_id, date, from_time } = permReq[0];
                    const dateStr = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

                    // Try to update attendance_records; if no row was updated, insert a new attendance record
                    const updRec = await client.query(
                        `UPDATE attendance_records SET status = 'Present', in_time = COALESCE(in_time, $3) 
                         WHERE emp_id = $1 AND date = $2 RETURNING *`,
                        [emp_id, dateStr, from_time]
                    );

                    if (updRec.rowCount === 0) {
                        // No attendance_records row existed — insert one
                        try {
                            await client.query(
                                `INSERT INTO attendance_records (emp_id, date, status, in_time) VALUES ($1, $2, 'Present', $3)`,
                                [emp_id, dateStr, from_time]
                            );
                        } catch (e) {
                            // Fallback to legacy `attendance` table if present
                            const updLegacy = await client.query(
                                `UPDATE attendance SET status = 'Present', in_time = COALESCE(in_time, $3) WHERE emp_id = $1 AND date = $2 RETURNING *`,
                                [emp_id, dateStr, from_time]
                            );
                            if (updLegacy.rowCount === 0) {
                                await client.query(
                                    `INSERT INTO attendance (emp_id, date, status, in_time) VALUES ($1, $2, 'Present', $3)`,
                                    [emp_id, dateStr, from_time]
                                );
                            }
                        }
                    }
                }
                    await client.query(
                        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                        [emp_id, `Your permission request for ${new Date(date).toLocaleDateString('en-IN')} has been APPROVED. Attendance marked as Present.`]
                    );

                    const io = req.app.get('io');
                    if (io) {
                        io.emit('attendance_updated', { emp_id });
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: `Permission ${status} successfully at ${currentStep.approver_type} level.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('APPROVE PERMISSION ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Delete permission request (only own & pending)
// @route   DELETE /api/permissions/:id
// @access  Private
exports.deletePermission = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `DELETE FROM permission_requests WHERE id = $1 AND emp_id = $2 AND status = 'Pending' RETURNING id`,
            [req.params.id, req.user.emp_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Permission request not found or cannot be deleted.' });
        }

        res.json({ message: 'Permission request deleted.' });
    } catch (error) {
        console.error('DELETE PERMISSION ERROR:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
