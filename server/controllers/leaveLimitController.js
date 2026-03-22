const { pool } = require('../config/db');

const currentYear = () => new Date().getFullYear();
const currentMonthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);

const normalizePeriodDate = (rawValue, isEndDate = false) => {
    if (!rawValue) return null;

    const value = String(rawValue).trim();
    if (!value) return null;

    // Supports both YYYY-MM and YYYY-MM-DD
    if (/^\d{4}-\d{2}$/.test(value)) {
        if (!isEndDate) return `${value}-01`;
        const [y, m] = value.split('-').map(Number);
        return new Date(y, m, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    return null;
};

const toMonthKey = (dateValue) => {
    if (!dateValue) return null;
    return String(dateValue).slice(0, 7);
};

const sanitizeLimit = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(365, parsed));
};

// Ensure a leave_limits row exists for an employee for the given year, also fix NULLs
const ensureLimitRow = async (client, emp_id, year) => {
    await client.query(`
        INSERT INTO leave_limits (emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit, permission_limit)
        VALUES ($1, $2, 12, 12, 10, 6, 30, 2)
        ON CONFLICT (emp_id, year) DO UPDATE SET
            cl_limit   = COALESCE(leave_limits.cl_limit,   EXCLUDED.cl_limit),
            ml_limit   = COALESCE(leave_limits.ml_limit,   EXCLUDED.ml_limit),
            od_limit   = COALESCE(leave_limits.od_limit,   EXCLUDED.od_limit),
            comp_limit = COALESCE(leave_limits.comp_limit, EXCLUDED.comp_limit),
            lop_limit  = COALESCE(leave_limits.lop_limit,  EXCLUDED.lop_limit),
            permission_limit = COALESCE(leave_limits.permission_limit, EXCLUDED.permission_limit)
    `, [emp_id, year]);
};

const ensureMonthlyPermissionReset = async (client, emp_id, year, monthKey) => {
    await client.query(
        `INSERT INTO leave_balances (emp_id, year, permission_taken, last_permission_reset_month)
         VALUES ($1, $2, 0, $3)
         ON CONFLICT (emp_id, year)
         DO UPDATE SET
             permission_taken = CASE
                 WHEN leave_balances.last_permission_reset_month IS DISTINCT FROM $3 THEN 0
                 ELSE COALESCE(leave_balances.permission_taken, 0)
             END,
             last_permission_reset_month = $3`,
        [emp_id, year, monthKey]
    );
};

// @desc    Get leave limits for all staff (Admin only) with their taken balance
// @route   GET /api/leave-limits
// @access  Admin
exports.getAllLeaveLimits = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || currentYear();
        const monthKey = currentMonthKey();

        // Get all employees with an employee id
        const { rows: employees } = await pool.query(`
            SELECT emp_id, name, designation, role, department_id
            FROM users
            WHERE emp_id IS NOT NULL
            ORDER BY name ASC
        `);

        // Ensure all employees have a limit record for this year
        const client = await pool.connect();
        try {
            for (const emp of employees) {
                await ensureLimitRow(client, emp.emp_id, year);
                await ensureMonthlyPermissionReset(client, emp.emp_id, year, monthKey);
            }
        } finally {
            client.release();
        }

        // Fetch limits + balances + dept name
        const { rows } = await pool.query(`
            SELECT 
                u.emp_id, u.name, u.designation, u.role, u.profile_pic, d.name AS department_name,
                ll.id AS limit_id, ll.year, ll.from_month, ll.to_month,
                ll.updated_at,
                COALESCE(ll.cl_limit, 12)   AS cl_limit,
                COALESCE(ll.ml_limit, 12)   AS ml_limit,
                COALESCE(ll.od_limit, 10)   AS od_limit,
                COALESCE(ll.comp_limit, 6)  AS comp_limit,
                COALESCE(ll.lop_limit, 30)  AS lop_limit,
                COALESCE(ll.permission_limit, 2) AS permission_limit,
                COALESCE(lb.cl_taken, 0)    AS cl_taken,
                COALESCE(lb.ml_taken, 0)    AS ml_taken,
                COALESCE(lb.od_taken, 0)    AS od_taken,
                COALESCE(lb.comp_taken, 0)  AS comp_taken,
                COALESCE(lb.lop_taken, 0)   AS lop_taken,
                COALESCE(lb.permission_taken, 0) AS permission_taken,
                COALESCE(comp_earned.cnt, 0) AS comp_earned
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN leave_limits ll ON ll.emp_id = u.emp_id AND ll.year = $1
            LEFT JOIN leave_balances lb ON lb.emp_id = u.emp_id AND lb.year = $1
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS cnt FROM leave_requests lr
                WHERE lr.emp_id = u.emp_id
                  AND lr.request_type = 'comp_credit'
                  AND lr.status = 'Approved'
                  AND EXTRACT(YEAR FROM lr.from_date) = $1
            ) comp_earned ON true
            WHERE u.emp_id IS NOT NULL
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
        const monthKey = currentMonthKey();

        // Ensure row exists
        const client = await pool.connect();
        try {
            await ensureLimitRow(client, emp_id, year);
            await ensureMonthlyPermissionReset(client, emp_id, year, monthKey);
        } finally {
            client.release();
        }

        const { rows } = await pool.query(`
            SELECT 
                ll.year,
                ll.updated_at,
                ll.from_month,
                ll.to_month,
                COALESCE(ll.cl_limit, 12)   AS cl_limit,
                COALESCE(ll.ml_limit, 12)   AS ml_limit,
                COALESCE(ll.od_limit, 10)   AS od_limit,
                COALESCE(ll.comp_limit, 6)  AS comp_limit,
                COALESCE(ll.lop_limit, 30)  AS lop_limit,
                COALESCE(ll.permission_limit, 2) AS permission_limit,
                COALESCE(lb.cl_taken, 0)   AS cl_taken,
                COALESCE(lb.ml_taken, 0)   AS ml_taken,
                COALESCE(lb.od_taken, 0)   AS od_taken,
                COALESCE(lb.comp_taken, 0) AS comp_taken,
                COALESCE(lb.lop_taken, 0)  AS lop_taken,
                COALESCE(lb.permission_taken, 0) AS permission_taken,
                COALESCE(comp_earned.cnt, 0) AS comp_earned
            FROM leave_limits ll
            LEFT JOIN leave_balances lb ON lb.emp_id = ll.emp_id AND lb.year = ll.year
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS cnt FROM leave_requests lr
                WHERE lr.emp_id = ll.emp_id
                  AND lr.request_type = 'comp_credit'
                  AND lr.status = 'Approved'
                  AND EXTRACT(YEAR FROM lr.from_date) = ll.year
            ) comp_earned ON true
            WHERE ll.emp_id = $1 AND ll.year = $2
        `, [emp_id, year]);

        if (rows.length === 0) {
            return res.json({
                year,
                updated_at: null,
                from_month: null,
                to_month: null,
                cl_limit: 12, ml_limit: 12, od_limit: 10, comp_limit: 6, lop_limit: 30, permission_limit: 2,
                cl_taken: 0, ml_taken: 0, od_taken: 0, comp_taken: 0, lop_taken: 0, permission_taken: 0,
                comp_earned: 0
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
        const {
            cl_limit,
            ml_limit,
            od_limit,
            comp_limit,
            comp_leave_limit,
            lop_limit,
            permission_limit,
            fromMonth,
            toMonth,
            fromDate,
            toDate
        } = req.body;

        const normalizedCompLimit = sanitizeLimit(comp_limit ?? comp_leave_limit, null);
        const normalizedClLimit = sanitizeLimit(cl_limit, null);
        const normalizedMlLimit = sanitizeLimit(ml_limit, null);
        const normalizedOdLimit = sanitizeLimit(od_limit, null);
        const normalizedLopLimit = sanitizeLimit(lop_limit, null);
        const normalizedPermissionLimit = sanitizeLimit(permission_limit, null);

        const resolvedFromDate = normalizePeriodDate(fromDate || fromMonth, false);
        const resolvedToDate = normalizePeriodDate(toDate || toMonth, true);

        await pool.query(`
            INSERT INTO leave_limits (emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit, permission_limit, from_month, to_month, updated_at)
            VALUES ($1, $2, COALESCE($3, 12), COALESCE($4, 12), COALESCE($5, 10), COALESCE($6, 6), COALESCE($7, 30), COALESCE($8, 2), $9, $10, NOW())
            ON CONFLICT (emp_id, year) 
            DO UPDATE SET
                cl_limit = COALESCE($3, leave_limits.cl_limit),
                ml_limit = COALESCE($4, leave_limits.ml_limit),
                od_limit = COALESCE($5, leave_limits.od_limit),
                comp_limit = COALESCE($6, leave_limits.comp_limit),
                lop_limit = COALESCE($7, leave_limits.lop_limit),
                permission_limit = COALESCE($8, leave_limits.permission_limit),
                from_month = COALESCE($9, leave_limits.from_month),
                to_month = COALESCE($10, leave_limits.to_month),
                updated_at = NOW()
        `, [
            emp_id,
            year,
            normalizedClLimit,
            normalizedMlLimit,
            normalizedOdLimit,
            normalizedCompLimit,
            normalizedLopLimit,
            normalizedPermissionLimit,
            resolvedFromDate !== undefined ? resolvedFromDate : null,
            resolvedToDate !== undefined ? resolvedToDate : null
        ]);

        // Keep monthly PL counters aligned with month change semantics.
        const monthKey = currentMonthKey();
        const client = await pool.connect();
        try {
            await ensureMonthlyPermissionReset(client, emp_id, year, monthKey);
        } finally {
            client.release();
        }

        // Notify all clients that leave limits were updated
        const io = req.app.get('io');
        if (io) io.emit('leave_limits_updated', { emp_id, year });

        res.json({ message: 'Leave limits updated successfully' });
    } catch (error) {
        console.error('updateLeaveLimit ERROR:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Bulk update leave limits for all employees (Admin only)
// @route   POST /api/leave-limits/bulk
// @access  Admin
exports.bulkUpdateLeaveLimits = async (req, res) => {
    const client = await pool.connect();
    try {
        const year = parseInt(req.body.year) || currentYear();
        const {
            cl_limit,
            ml_limit,
            od_limit,
            comp_limit,
            comp_leave_limit,
            lop_limit,
            permission_limit,
            fromMonth,
            toMonth,
            fromDate,
            toDate
        } = req.body;

        const normalizedCompLimit = sanitizeLimit(comp_limit ?? comp_leave_limit, null);
        const normalizedClLimit = sanitizeLimit(cl_limit, null);
        const normalizedMlLimit = sanitizeLimit(ml_limit, null);
        const normalizedOdLimit = sanitizeLimit(od_limit, null);
        const normalizedLopLimit = sanitizeLimit(lop_limit, null);
        const normalizedPermissionLimit = sanitizeLimit(permission_limit, null);

        const resolvedFromDate = normalizePeriodDate(fromDate || fromMonth, false);
        const resolvedToDate = normalizePeriodDate(toDate || toMonth, true);

        if (!resolvedFromDate || !resolvedToDate) {
            return res.status(400).json({ message: 'Invalid period. From Date and To Date are required in YYYY-MM-DD format.' });
        }
        if (new Date(resolvedFromDate) > new Date(resolvedToDate)) {
            return res.status(400).json({ message: 'Invalid period. From Date cannot be after To Date.' });
        }

        await client.query('BEGIN');

        const { rows: employees } = await client.query(
            `SELECT emp_id FROM users WHERE emp_id IS NOT NULL`
        );

        for (const emp of employees) {
            await ensureLimitRow(client, emp.emp_id, year);

            await client.query(
                `INSERT INTO leave_limits (emp_id, year, cl_limit, ml_limit, od_limit, comp_limit, lop_limit, permission_limit, from_month, to_month, updated_at)
                 VALUES ($1, $2, COALESCE($3, 12), COALESCE($4, 12), COALESCE($5, 10), COALESCE($6, 6), COALESCE($7, 30), COALESCE($8, 2), $9, $10, NOW())
                 ON CONFLICT (emp_id, year)
                 DO UPDATE SET
                    cl_limit = COALESCE($3, leave_limits.cl_limit),
                    ml_limit = COALESCE($4, leave_limits.ml_limit),
                    od_limit = COALESCE($5, leave_limits.od_limit),
                    comp_limit = COALESCE($6, leave_limits.comp_limit),
                    lop_limit = COALESCE($7, leave_limits.lop_limit),
                    permission_limit = COALESCE($8, leave_limits.permission_limit),
                    from_month = COALESCE($9, leave_limits.from_month),
                    to_month = COALESCE($10, leave_limits.to_month),
                    updated_at = NOW()`,
                [
                    emp.emp_id,
                    year,
                    normalizedClLimit,
                    normalizedMlLimit,
                    normalizedOdLimit,
                    normalizedCompLimit,
                    normalizedLopLimit,
                    normalizedPermissionLimit,
                    resolvedFromDate,
                    resolvedToDate
                ]
            );

            // If period moves to a new month, PL counters reset for that month.
            const resetMonthKey = toMonthKey(resolvedFromDate) || currentMonthKey();
            await ensureMonthlyPermissionReset(client, emp.emp_id, year, resetMonthKey);
        }

        await client.query('COMMIT');

        const io = req.app.get('io');
        if (io) io.emit('leave_limits_updated', { year, bulk: true });

        res.json({ message: 'Bulk leave limits updated successfully', updatedCount: employees.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('bulkUpdateLeaveLimits ERROR:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        client.release();
    }
};
