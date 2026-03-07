const { pool } = require('../config/db');

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private
exports.applyLeave = async (req, res) => {
    const {
        leave_type, from_date, to_date, days_count,
        reason, subject, replacements, is_half_day, hours
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Check Leave Limits — per-employee first, fall back to global settings
        const currentYear = new Date().getFullYear();
        const columnLimitMap = {
            'CL': 'cl_limit', 'ML': 'ml_limit', 'OD': 'od_limit',
            'Comp Leave': 'comp_limit', 'LOP': 'lop_limit'
        };
        const columnTakenMap = {
            'CL': 'cl_taken', 'ML': 'ml_taken', 'OD': 'od_taken',
            'Comp Leave': 'comp_taken', 'LOP': 'lop_taken'
        };

        const limitCol = columnLimitMap[leave_type];
        const takenCol = columnTakenMap[leave_type];

        // Check per-employee limit for this year
        const { rows: perEmpLimit } = await client.query(
            `SELECT ${limitCol} AS max_days FROM leave_limits WHERE emp_id = $1 AND year = $2`,
            [req.user.emp_id, currentYear]
        );

        let maxDaysAllowed;
        if (perEmpLimit.length > 0 && perEmpLimit[0].max_days !== null) {
            maxDaysAllowed = perEmpLimit[0].max_days;
        } else {
            // Fall back to global settings
            const { rows: settings } = await client.query(
                'SELECT max_days FROM leave_settings WHERE leave_type = $1',
                [leave_type]
            );
            maxDaysAllowed = settings[0]?.max_days ?? 15;
        }

        const { rows: balance } = await client.query(
            'SELECT * FROM leave_balances WHERE emp_id = $1 AND year = $2',
            [req.user.emp_id, currentYear]
        );

        // If no balance record, create one
        if (balance.length === 0) {
            await client.query(
                'INSERT INTO leave_balances (emp_id, year) VALUES ($1, $2)',
                [req.user.emp_id, currentYear]
            );
        }

        const taken = balance[0] ? (balance[0][takenCol] || 0) : 0;
        const totalDays = parseFloat(days_count) || 0;

        if (taken + totalDays > maxDaysAllowed) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Leave limit exceeded for ${leave_type}. Allowed: ${maxDaysAllowed} days, Already taken: ${taken} days, Remaining: ${Math.max(0, maxDaysAllowed - taken)} days.`
            });
        }

        // Increment the taken count in leave_balances immediately upon application
        await client.query(
            `UPDATE leave_balances SET ${takenCol} = COALESCE(${takenCol}, 0) + $1 WHERE emp_id = $2 AND year = $3`,
            [totalDays, req.user.emp_id, currentYear]
        );

        // 1. Create main leave request
        const validReplacements = replacements ? replacements.filter(r => r.staff_id && r.staff_id !== '') : [];
        const firstReplacementId = validReplacements.length > 0 ? validReplacements[0].staff_id : null;

        const { rows: resultRows } = await client.query(
            `INSERT INTO leave_requests (emp_id, leave_type, from_date, to_date, days_count, reason, subject, alternative_staff_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
             RETURNING id`,
            [req.user.emp_id, leave_type, from_date, to_date, totalDays, reason, subject || 'Leave Request', firstReplacementId]
        );

        const requestId = resultRows[0].id;

        // 2. Initial Approval Step: Replacements or HOD
        if (validReplacements.length > 0) {
            for (const rep of validReplacements) {
                await client.query(
                    `INSERT INTO leave_approvals (leave_request_id, approver_id, approver_type, status, comments)
                     VALUES ($1, $2, 'replacement', 'Pending', $3)`,
                    [requestId, rep.staff_id, rep.periods ? `Periods: ${rep.periods}` : 'Standard Replacement']
                );

                await client.query(
                    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                    [rep.staff_id, `${req.user.name} has requested you as a replacement (${rep.periods || 'Standard'}) for their leave.`]
                );
            }
        } else {
            // Straight to HOD
            const { rows: hodRows } = await client.query(
                `SELECT emp_id FROM users WHERE department_id = $1 AND role = 'hod'`,
                [req.user.department_id]
            );
            const hodId = hodRows.length > 0 ? hodRows[0].emp_id : null;

            if (hodId) {
                await client.query(
                    `INSERT INTO leave_approvals (leave_request_id, approver_id, approver_type, status)
                     VALUES ($1, $2, 'hod', 'Pending')`,
                    [requestId, hodId]
                );

                await client.query(
                    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'leave')`,
                    [hodId, `New leave request from ${req.user.name} requires your approval.`]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Leave application submitted for approval chain.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('APPLY LEAVE ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Get leave requests for the user or those requiring their approval
// @route   GET /api/leaves
// @access  Private
exports.getLeaveRequests = async (req, res) => {
    try {
        // Complex query to get requests where the user is either:
        // 1. The applicant
        // 2. The CURRENT pending approver
        const query = `
            SELECT l.*, u.name as applicant_name, u.role as applicant_role, d.name as department_name, 
                   ap.status as my_approval_status, ap.approver_type as my_approver_type, ap.comments as approval_notes
            FROM leave_requests l
            JOIN users u ON l.emp_id = u.emp_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN leave_approvals ap ON l.id = ap.leave_request_id AND ap.approver_id = $1
            WHERE l.emp_id = $2 
               OR (ap.approver_id = $3 AND ap.status = 'Pending')
            ORDER BY (ap.status = 'Pending') DESC, l.created_at DESC
        `;

        const { rows } = await pool.query(query, [req.user.emp_id, req.user.emp_id, req.user.emp_id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Action on leave request (Approve/Reject) at a specific level
// @route   PUT /api/leaves/:id/approve
// @access  Private
exports.approveLeaveStep = async (req, res) => {
    const { status, comments } = req.body; // Approved or Rejected
    const requestId = req.params.id;
    const userId = req.user.emp_id;

    const client = await pool.connect(); // Changed from connection to client, and getConnection() to connect()
    try {
        await client.query('BEGIN'); // Changed from connection.beginTransaction() to client.query('BEGIN')

        // 1. Update current approval status
        const { rows: approval } = await client.query(
            'SELECT * FROM leave_approvals WHERE leave_request_id = $1 AND approver_id = $2 AND status = \'Pending\'',
            [requestId, userId]
        );

        if (approval.length === 0) {
            await client.query('ROLLBACK'); // Added rollback before returning
            return res.status(404).json({ message: 'Pending approval record not found' });
        }

        const currentStep = approval[0];
        await client.query(
            'UPDATE leave_approvals SET status = $1, comments = $2 WHERE id = $3',
            [status, comments, currentStep.id]
        );

        // 2. Handle Rejection (Universal)
        if (status === 'Rejected') {
            await client.query('UPDATE leave_requests SET status = \'Rejected\' WHERE id = $1', [requestId]);

            // Revert leave balance
            const { rows: reqDetails } = await client.query('SELECT emp_id, leave_type, from_date, days_count FROM leave_requests WHERE id = $1', [requestId]);
            if (reqDetails.length > 0) {
                const { emp_id, leave_type, from_date, days_count } = reqDetails[0];
                const currentYear = new Date(from_date).getFullYear();
                const columnTakenMap = {
                    'CL': 'cl_taken', 'ML': 'ml_taken', 'OD': 'od_taken',
                    'Comp Leave': 'comp_taken', 'LOP': 'lop_taken'
                };
                const takenCol = columnTakenMap[leave_type];
                if (takenCol) {
                    await client.query(
                        `UPDATE leave_balances SET ${takenCol} = GREATEST(0, COALESCE(${takenCol}, 0) - $1) WHERE emp_id = $2 AND year = $3`,
                        [days_count, emp_id, currentYear]
                    );
                }
            }

            // Notify applicant
            const { rows: applicantRows } = await client.query('SELECT emp_id FROM leave_requests WHERE id = $1', [requestId]);
            await client.query(`
                INSERT INTO notifications (user_id, message, type)
                VALUES ($1, $2, 'leave')
            `, [applicantRows[0].emp_id, `Your leave request has been REJECTED by ${req.user.name}.`]);
        }

        // 3. Handle Approval & Escalate
        else if (status === 'Approved') {
            if (currentStep.approver_type === 'replacement') {
                // ... (existing replacement logic)
                const { rows: pendingReps } = await client.query(
                    'SELECT COUNT(*) as count FROM leave_approvals WHERE leave_request_id = $1 AND approver_type = \'replacement\' AND status = \'Pending\'',
                    [requestId]
                );

                if (parseInt(pendingReps[0].count) === 0) {
                    const { rows: applicantRows } = await client.query(`
                        SELECT u.department_id, u.name FROM leave_requests l 
                        JOIN users u ON l.emp_id = u.emp_id WHERE l.id = $1
                    `, [requestId]);

                    const { rows: hodRows } = await client.query('SELECT emp_id FROM users WHERE department_id = $1 AND role = \'hod\'', [applicantRows[0].department_id]);

                    if (hodRows.length > 0) {
                        await client.query(`
                            INSERT INTO leave_approvals (leave_request_id, approver_id, approver_type, status)
                            VALUES ($1, $2, 'hod', 'Pending')
                        `, [requestId, hodRows[0].emp_id]);

                        await client.query(`
                            INSERT INTO notifications (user_id, message, type)
                            VALUES ($1, $2, 'leave')
                        `, [hodRows[0].emp_id, `Leave request from ${applicantRows[0].name} (All replacements approved) requires your HOD approval.`]);
                    }
                }
            }
            else if (currentStep.approver_type === 'hod') {
                const { rows: principalRows } = await client.query('SELECT emp_id FROM users WHERE role = \'principal\' LIMIT 1');

                if (principalRows.length > 0) {
                    await client.query(`
                        INSERT INTO leave_approvals (leave_request_id, approver_id, approver_type, status)
                        VALUES ($1, $2, 'principal', 'Pending')
                    `, [requestId, principalRows[0].emp_id]);

                    await client.query(`
                        INSERT INTO notifications (user_id, message, type)
                        VALUES ($1, $2, 'leave')
                    `, [principalRows[0].emp_id, `Leave request escalated to Principal level for final approval.`]);
                }
            }
            else if (currentStep.approver_type === 'principal' || currentStep.approver_type === 'admin') {
                // Final Approval
                await client.query('UPDATE leave_requests SET status = \'Approved\' WHERE id = $1', [requestId]);

                const { rows: reqDetails } = await client.query('SELECT emp_id, leave_type, from_date, to_date, days_count FROM leave_requests WHERE id = $1', [requestId]);
                const { emp_id, leave_type, from_date, to_date, days_count } = reqDetails[0];

                // Balance updated at application time, so no update needed here.

                // Automatically update attendance_records for each date in the range
                const start = new Date(from_date);
                const end = new Date(to_date);

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

                    await client.query(`
                        INSERT INTO attendance_records (emp_id, date, status)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (emp_id, date) 
                        DO UPDATE SET status = EXCLUDED.status
                    `, [emp_id, dateStr, leave_type]);
                }

                await client.query(`
                    INSERT INTO notifications (user_id, message, type)
                    VALUES ($1, $2, 'leave')
                `, [emp_id, `Congratulations! Your leave request has been FINALLY APPROVED.`]);

                const io = req.app.get('io');
                if (io) {
                    io.emit('attendance_updated', { emp_id, leave_type });
                }
            }
        }

        await client.query('COMMIT'); // Changed from connection.commit() to client.query('COMMIT')
        res.json({ message: `Leave ${status} successfully at ${currentStep.approver_type} level.` });
    } catch (error) {
        await client.query('ROLLBACK'); // Changed from connection.rollback() to client.query('ROLLBACK')
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release(); // Changed from connection.release() to client.release()
    }
};

// @desc    Delete leave request
exports.deleteLeaveRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: reqData } = await client.query('SELECT emp_id, leave_type, from_date, days_count, status FROM leave_requests WHERE id = $1', [req.params.id]);
        if (reqData.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Request not found' });
        }

        const request = reqData[0];

        if (req.user.role !== 'admin' && request.emp_id !== req.user.emp_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (request.status !== 'Pending' && req.user.role !== 'admin') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot delete processed request' });
        }

        // Only revert balance for Pending or Approved requests
        // Rejected requests were already reverted during rejection
        if (request.status === 'Pending' || request.status === 'Approved') {
            const currentYear = new Date(request.from_date).getFullYear();
            const columnTakenMap = {
                'CL': 'cl_taken', 'ML': 'ml_taken', 'OD': 'od_taken',
                'Comp Leave': 'comp_taken', 'LOP': 'lop_taken'
            };
            const takenCol = columnTakenMap[request.leave_type];
            if (takenCol) {
                await client.query(
                    `UPDATE leave_balances SET ${takenCol} = GREATEST(0, COALESCE(${takenCol}, 0) - $1) WHERE emp_id = $2 AND year = $3`,
                    [request.days_count, request.emp_id, currentYear]
                );
            }
        }

        await client.query('DELETE FROM leave_requests WHERE id = $1', [req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Leave request deleted and balance reverted if applicable' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
};
// @desc    Get all employees on leave for a date range
exports.getLeaveConflicts = async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.json([]);

    try {
        const query = `
            SELECT emp_id FROM leave_requests 
            WHERE status IN ('Approved', 'Pending')
            AND (
                (from_date <= $1 AND to_date >= $2) OR
                (from_date <= $3 AND to_date >= $4) OR
                (from_date >= $5 AND to_date <= $6)
            )
        `;
        const { rows } = await pool.query(query, [from, from, to, to, from, to]);
        res.json(rows.map(r => r.emp_id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
