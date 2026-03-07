const { pool } = require('../config/db');

const currentYear = () => new Date().getFullYear();

// Ensure a leave_limits row exists for an employee for the given year
const ensureLimitRow = async (client, emp_id, year) => {
    await client.query(`
        INSERT INTO leave_limits (emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit)
        VALUES ($1, $2, 12, 12, 10, 6, 30)
        ON CONFLICT (emp_id, year) DO NOTHING
    `, [emp_id, year]);
};

// @desc    Get leave limits for all staff (Admin only) with their taken balance
// @route   GET /api/leave-limits
// @access  Admin
exports.getAllLeaveLimits = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || currentYear();

        // Get all staff/hod employees
        const { rows: employees } = await pool.query(`
            SELECT emp_id, name, designation, role, department_id
            FROM users
            WHERE role IN ('staff', 'hod')
            ORDER BY name ASC
        `);

        // Ensure all employees have a limit record for this year
        const client = await pool.connect();
        try {
            for (const emp of employees) {
                await ensureLimitRow(client, emp.emp_id, year);
            }
        } finally {
            client.release();
        }

        // Fetch limits + balances + dept name
        const { rows } = await pool.query(`
            SELECT 
                u.emp_id, u.name, u.designation, u.role, d.name AS department_name,
                ll.id AS limit_id, ll.year,
                ll.cl_limit, ll.ml_limit, ll.od_limit, ll.comp_limit, ll.lop_limit,
                COALESCE(lb.cl_taken, 0)   AS cl_taken,
                COALESCE(lb.ml_taken, 0)   AS ml_taken,
                COALESCE(lb.od_taken, 0)   AS od_taken,
                COALESCE(lb.comp_taken, 0) AS comp_taken,
                COALESCE(lb.lop_taken, 0)  AS lop_taken
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN leave_limits ll ON ll.emp_id = u.emp_id AND ll.year = $1
            LEFT JOIN leave_balances lb ON lb.emp_id = u.emp_id AND lb.year = $1
            WHERE u.role IN ('staff', 'hod')
            ORDER BY u.name ASC
        `, [year]);

        res.json(rows);
    } catch (error) {
        console.error('getAllLeaveLimits ERROR:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get leave limits for the logged-in staff member (staff view)
// @route   GET /api/leave-limits/my
// @access  Private
exports.getMyLeaveLimits = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || currentYear();
        const emp_id = req.user.emp_id;

        // Ensure row exists
        const client = await pool.connect();
        try {
            await ensureLimitRow(client, emp_id, year);
        } finally {
            client.release();
        }

        const { rows } = await pool.query(`
            SELECT 
                ll.year,
                ll.cl_limit, ll.ml_limit, ll.od_limit, ll.comp_limit, ll.lop_limit,
                COALESCE(lb.cl_taken, 0)   AS cl_taken,
                COALESCE(lb.ml_taken, 0)   AS ml_taken,
                COALESCE(lb.od_taken, 0)   AS od_taken,
                COALESCE(lb.comp_taken, 0) AS comp_taken,
                COALESCE(lb.lop_taken, 0)  AS lop_taken
            FROM leave_limits ll
            LEFT JOIN leave_balances lb ON lb.emp_id = ll.emp_id AND lb.year = ll.year
            WHERE ll.emp_id = $1 AND ll.year = $2
        `, [emp_id, year]);

        if (rows.length === 0) {
            return res.json({
                year,
                cl_limit: 12, ml_limit: 12, od_limit: 10, comp_limit: 6, lop_limit: 30,
                cl_taken: 0, ml_taken: 0, od_taken: 0, comp_taken: 0, lop_taken: 0
            });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('getMyLeaveLimits ERROR:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update leave limits for a specific employee (Admin only)
// @route   PUT /api/leave-limits/:emp_id
// @access  Admin
exports.updateLeaveLimit = async (req, res) => {
    try {
        const { emp_id } = req.params;
        const year = parseInt(req.body.year) || currentYear();
        const { cl_limit, ml_limit, od_limit, comp_limit, lop_limit } = req.body;

        await pool.query(`
            INSERT INTO leave_limits (emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (emp_id, year) 
            DO UPDATE SET
                cl_limit = EXCLUDED.cl_limit,
                ml_limit = EXCLUDED.ml_limit,
                od_limit = EXCLUDED.od_limit,
                comp_limit = EXCLUDED.comp_limit,
                lop_limit = EXCLUDED.lop_limit,
                updated_at = NOW()
        `, [emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit]);

        res.json({ message: 'Leave limits updated successfully' });
    } catch (error) {
        console.error('updateLeaveLimit ERROR:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
