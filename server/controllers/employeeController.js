const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const logActivity = require('../utils/activityLogger');
const { createNotification } = require('./notificationController');

// @desc    Check all birthdays and send notifications (Internal use)
exports.checkAllBirthdaysAndNotify = async () => {
    try {
        const { rows: birthdayPeople } = await pool.query(`
            SELECT id, name, emp_id, dob, email
            FROM users
            WHERE dob IS NOT NULL
              AND EXTRACT(MONTH FROM dob) = EXTRACT(MONTH FROM CURRENT_DATE) 
              AND EXTRACT(DAY FROM dob) = EXTRACT(DAY FROM CURRENT_DATE)
        `);

        for (const person of birthdayPeople) {
            const message = `🎉 Happy Birthday, ${person.name}! Have a wonderful day! 🎂`;
            // This will send both in-app and email
            await createNotification(person.emp_id, message, 'birthday', { emp_id: person.emp_id });
            console.log(`Birthday wish sent to ${person.name} (${person.emp_id})`);
        }
    } catch (error) {
        console.error('Birthday Job Error:', error);
    }
};

// @desc    Get employees with birthday today
// @route   GET /api/employees/birthdays/today
// @access  Private
exports.getTodayBirthdays = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, name, emp_id, profile_pic, role, department_id, dob
            FROM users
            WHERE EXTRACT(MONTH FROM dob) = EXTRACT(MONTH FROM CURRENT_DATE) 
              AND EXTRACT(DAY FROM dob) = EXTRACT(DAY FROM CURRENT_DATE)
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Private (Admin)
exports.createEmployee = async (req, res) => {
    const {
        emp_id, emp_code, pin, role, name, email, department_id, designation,
        dob, doj, gender, mobile, profile_pic,
        blood_group, religion, nationality, caste, community, whatsapp,
        aadhar, pan, account_no, bank_name, branch, ifsc, pin_code,
        pf_number, uan_number, permanent_address, communication_address,
        father_name, mother_name, marital_status, monthly_salary, experience,
        deductions
    } = req.body;

    // Trim critical fields
    const trimmedEmpId = emp_id?.trim();
    const trimmedPin = pin?.trim();

    // Validation
    if (!trimmedEmpId || !role || !name) {
        return res.status(400).json({ message: 'Please provide required fields (Emp ID, Role, Name)' });
    }

    try {
        const { rows: existing } = await pool.query('SELECT emp_id FROM users WHERE emp_id = $1', [trimmedEmpId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Employee with this ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(trimmedPin || '1234', 10);

        const query = `
            INSERT INTO users (
                emp_id, emp_code, pin, role, name, email, department_id, designation,
                dob, doj, gender, mobile, profile_pic,
                blood_group, religion, nationality, caste, community, whatsapp,
                aadhar, pan, account_no, bank_name, branch, ifsc, pin_code,
                pf_number, uan_number, permanent_address, communication_address,
                father_name, mother_name, marital_status, monthly_salary, experience, password, deductions
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
            )
        `;

        await pool.query(query, [
            trimmedEmpId, emp_code || null, trimmedPin, role, name, email || null, department_id || null, designation || null,
            dob || null, doj || null, gender || 'Male', mobile || null, profile_pic || null,
            blood_group || null, religion || null, nationality || 'Indian', caste || null, community || null, whatsapp || null,
            aadhar || null, pan || null, account_no || null, bank_name || null, branch || null, ifsc || null, pin_code || null,
            pf_number || null, uan_number || null, permanent_address || null, communication_address || null,
            father_name || null, mother_name || null, marital_status || 'Single', monthly_salary || 0, experience || null, hashedPassword,
            deductions || null
        ]);

        // Broadcast real-time employee update to all connected clients
        const io = req.app.get('io');
        if (io) io.emit('employee_updated', { action: 'created', role, name });

        res.status(201).json({ message: 'Employee created successfully' });
        await logActivity(req.user.id, 'CREATE_EMPLOYEE', { 
            emp_id: trimmedEmpId, 
            name, 
            role, 
            department_id, 
            designation 
        }, req.ip);

        // Send Email Notification
        if (email) {
            try {
                const message = `
Welcome to PPG EMP HUB!

Your employee account has been successfully created.
--------------------------------------------------
Employee ID: ${emp_id}
Login PIN/Password: ${pin || '1234'}
--------------------------------------------------
Please log in to the portal using these credentials.
`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Welcome to PPG EMP HUB!</h2>
                        <p>Your employee account has been successfully created.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Employee ID:</strong> ${emp_id}</p>
                            <p><strong>Login PIN/Password:</strong> ${pin || '1234'}</p>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">Please log in to the portal using these credentials.</p>
                    </div>
                `;

                await sendEmail({
                    email: email,
                    subject: 'Welcome to PPG EMP HUB - Your Account Credentials',
                    message: message,
                    html: html
                });
            } catch (mailError) {
                console.error('FAILED TO SEND WELCOME EMAIL:', mailError);
                // We don't fail the request if email fails, but we log it
            }
        }
    } catch (error) {
        console.error('CREATE EMPLOYEE ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (Admin, Principal, HOD)
exports.getEmployees = async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.emp_id, u.emp_code, u.name, u.role, u.email, u.mobile,
                   u.department_id, u.designation, u.profile_pic,
                   u.monthly_salary,
                   TO_CHAR(u.dob, 'YYYY-MM-DD') as dob,
                   TO_CHAR(u.doj, 'YYYY-MM-DD') as doj,
                   d.name as department_name 
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
        `;
        const params = [];

        // Role-based filtering
        if (req.user.role === 'hod' || req.user.role === 'staff') {
            // If ?all=true is passed, HOD/Staff can see all staff/hod/principal profiles (e.g. for conversation participant selection)
            if (req.query.all === 'true') {
                query += ` WHERE u.role NOT IN ('admin')`;
            } else if (req.user.role === 'hod') {
                // HOD can see their own department's staff AND HODs from all departments
                query += ` WHERE (u.department_id = $1 OR u.role = 'hod') AND u.role NOT IN ('admin', 'principal')`;
                params.push(req.user.department_id);
            } else if (req.user.department_id) {
                // Staff can only see their own department
                query += ` WHERE u.department_id = $1 AND u.role NOT IN ('admin', 'principal')`;
                params.push(req.user.department_id);
            } else {
                // Return an empty list if not assigned a department (for security)
                return res.status(200).json([]);
            }
        }
        // Admin and Principal still see everyone

        query += ` ORDER BY u.name ASC`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get employee by ID or Emp ID
// @route   GET /api/employees/:id
// @access  Private
exports.getEmployeeById = async (req, res) => {
    try {
        const paramId = req.params.id;

        // Build a safe query: only compare to u.id if the param looks like a number
        // to avoid a PostgreSQL integer cast error on string emp_ids like '@PPG ZORVIAN'
        const isNumeric = /^\d+$/.test(paramId);

        let query, values;
        if (isNumeric) {
            // Priority 1: Exact emp_id match (trimmed)
            // Priority 2: Database ID match (numeric)
            query = `
                SELECT u.*, 
                       TO_CHAR(u.dob, 'YYYY-MM-DD') as dob,
                       TO_CHAR(u.doj, 'YYYY-MM-DD') as doj,
                       d.name as department_name
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE TRIM(u.emp_id) = $1 OR u.id = $2
                ORDER BY CASE WHEN TRIM(u.emp_id) = $1 THEN 0 ELSE 1 END ASC
                LIMIT 1
            `;
            values = [paramId.trim(), parseInt(paramId)];
        } else {
            query = `
                SELECT u.*, 
                       TO_CHAR(u.dob, 'YYYY-MM-DD') as dob,
                       TO_CHAR(u.doj, 'YYYY-MM-DD') as doj,
                       d.name as department_name
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE TRIM(u.emp_id) = $1
            `;
            values = [paramId.trim()];
        }

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const targetUser = rows[0];
        // Allow users to see their own profile, or allow higher roles to see any
        if (req.user.role === 'staff' && req.user.id !== targetUser.id) {
            return res.status(403).json({ message: 'Not authorized to view this profile' });
        }

        delete targetUser.password;
        res.json(targetUser);
    } catch (error) {
        console.error('getEmployeeById ERROR:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin)
exports.updateEmployee = async (req, res) => {
    const {
        name, emp_code, role, department_id, designation,
        mobile, email, dob, doj, gender, profile_pic,
        blood_group, religion, nationality, caste, community, whatsapp,
        aadhar, pan, account_no, bank_name, branch, ifsc, pin_code,
        pf_number, uan_number, permanent_address, communication_address,
        father_name, mother_name, marital_status, monthly_salary, experience, pin, deductions
    } = req.body;

    try {
        let hashedPassword;
        if (pin) {
            hashedPassword = await bcrypt.hash(pin, 10);
        }

        // Fetch the emp_id for audit logging before update
        const { rows: targetUser } = await pool.query('SELECT emp_id FROM users WHERE id = $1', [req.params.id]);
        const target_emp_id = targetUser[0]?.emp_id || 'Unknown';

        const query = `
            UPDATE users SET 
                name = $1, emp_code = $2, role = $3, department_id = $4, designation = $5, 
                mobile = $6, email = $7, dob = $8, doj = $9, gender = $10, profile_pic = $11,
                blood_group = $12, religion = $13, nationality = $14, caste = $15, community = $16, whatsapp = $17,
                aadhar = $18, pan = $19, account_no = $20, bank_name = $21, branch = $22, ifsc = $23, pin_code = $24,
                pf_number = $25, uan_number = $26, permanent_address = $27, communication_address = $28,
                father_name = $29, mother_name = $30, marital_status = $31, monthly_salary = $32, experience = $33, 
                pin = $34, password = COALESCE($35, password), deductions = $36
            WHERE id = $37
        `;

        await pool.query(query, [
            name, emp_code || null, role, department_id || null, designation || null,
            mobile || null, email || null, dob || null, doj || null, gender || 'Male', profile_pic || null,
            blood_group || null, religion || null, nationality || 'Indian', caste || null, community || null, whatsapp || null,
            aadhar || null, pan || null, account_no || null, bank_name || null, branch || null, ifsc || null, pin_code || null,
            pf_number || null, uan_number || null, permanent_address || null, communication_address || null,
            father_name || null, mother_name || null, marital_status || 'Single', monthly_salary || 0, experience || null,
            pin || null, hashedPassword || null, deductions || null,
            req.params.id
        ]);

        const io = req.app.get('io');
        if (io) io.emit('employee_updated', { action: 'updated' });

        res.json({ message: 'Employee updated successfully' });
        await logActivity(req.user.id, 'UPDATE_EMPLOYEE', { 
            target_id: req.params.id, 
            emp_id: target_emp_id,
            name, 
            role, 
            department_id, 
            designation 
        }, req.ip);
    } catch (error) {
        console.error('UPDATE ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
exports.deleteEmployee = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: userRows } = await client.query(
            'SELECT emp_id, name, role FROM users WHERE id = $1',
            [req.params.id]
        );

        if (userRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Employee not found' });
        }
        const { emp_id, name, role } = userRows[0];

        // Protection for @ppg zorvian
        if (emp_id.toLowerCase() === '@ppg zorvian') {
            const { rows: otherAdmins } = await client.query(
                "SELECT id FROM users WHERE role = 'admin' AND emp_id != $1",
                [emp_id]
            );
            if (otherAdmins.length === 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    message: 'Cannot delete the primary admin account (@ppg zorvian) unless another admin account exists.' 
                });
            }
        }

        // For HOD and Staff: auto-reject any pending leave requests before deletion
        if (role === 'hod' || role === 'staff') {
            // Get all pending leave requests by this user
            const { rows: pendingLeaves } = await client.query(
                "SELECT id FROM leave_requests WHERE emp_id = $1 AND status = 'Pending'",
                [emp_id]
            );

            for (const leave of pendingLeaves) {
                // Mark the leave request as Rejected
                await client.query(
                    "UPDATE leave_requests SET status = 'Rejected' WHERE id = $1",
                    [leave.id]
                );

                // Mark any pending approval steps as Rejected too
                await client.query(
                    "UPDATE leave_approvals SET status = 'Rejected', comments = 'Employee account deleted by admin' WHERE leave_request_id = $1 AND status = 'Pending'",
                    [leave.id]
                );
            }

            // Also reject pending requests where this user is an approver
            const { rows: pendingAsApprover } = await client.query(
                "SELECT leave_request_id FROM leave_approvals WHERE approver_id = $1 AND status = 'Pending'",
                [emp_id]
            );

            for (const item of pendingAsApprover) {
                await client.query(
                    "UPDATE leave_approvals SET status = 'Rejected', comments = 'Approver account deleted by admin' WHERE leave_request_id = $1 AND approver_id = $2 AND status = 'Pending'",
                    [item.leave_request_id, emp_id]
                );
                // Also mark parent leave request as Rejected so it doesn't stay stuck
                await client.query(
                    "UPDATE leave_requests SET status = 'Rejected' WHERE id = $1 AND status = 'Pending'",
                    [item.leave_request_id]
                );
            }
        }

        // Now delete the user (CASCADE will clean up related records)
        await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);

        await client.query('COMMIT');
        
        // Immediately clear auth cache for this deleted user
        const { clearUserCache } = require('../middleware/authMiddleware');
        clearUserCache(req.params.id);

        const io = req.app.get('io');
        if (io) io.emit('employee_updated', { action: 'deleted' });

        res.json({ message: `Employee ${name} deleted successfully. Any pending leave requests have been cancelled.` });
        await logActivity(req.user.id, 'DELETE_EMPLOYEE', { emp_id, name }, req.ip);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DELETE EMPLOYEE ERROR:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    } finally {
        client.release();
    }
};
