const { pool } = require('../config/db');

// @desc    Calculate Salary
// @route   POST /api/salary/calculate
// @access  Private (Admin)
exports.calculateSalary = async (req, res) => {
    const { month, year, emp_id, paidStatuses = ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday', 'Weekend'] } = req.body;

    try {
        console.log(`Starting calculation for ${month}/${year}`);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // 1. Fetch all eligible employees (all except admin)
        let usersQuery = `
            SELECT id, emp_id, name, monthly_salary, role 
            FROM users 
            WHERE role IN ('principal', 'hod', 'staff')
        `;
        const usersParams = [];
        if (emp_id) {
            usersQuery += ' AND emp_id = $1';
            usersParams.push(emp_id);
        }
        const { rows: users } = await pool.query(usersQuery, usersParams);
        console.log(`Found ${users.length} eligible employees`);

        if (users.length === 0) {
            return res.json({ message: 'No eligible employees found for calculation', results: [] });
        }

        // 2. Aggregate attendance data for all users in one query for efficiency
        const { rows: attendanceStats } = await pool.query(`
            SELECT 
                emp_id,
                SUM(
                    CASE 
                        -- Combined status (e.g., 'Present + CL')
                        WHEN status::text LIKE '%+%' THEN
                            (CASE WHEN split_part(status::text, ' + ', 1) = ANY($3::text[]) THEN 0.5 ELSE 0 END +
                             CASE WHEN split_part(status::text, ' + ', 2) = ANY($3::text[]) THEN 0.5 ELSE 0 END)
                        
                        -- Standard paid status
                        WHEN status::text = ANY($3::text[]) THEN
                            CASE 
                                WHEN remarks ILIKE '%Half Day%' OR 
                                     remarks ILIKE '%0.5 day%' OR 
                                     remarks ILIKE '%1/2 day%' OR
                                     status::text ILIKE '%Half%' THEN 0.5
                                ELSE 1.0
                            END
                        ELSE 0 
                    END
                ) as payable_days
            FROM attendance_records
            WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2
            GROUP BY emp_id
        `, [month, year, paidStatuses]);

        // Map stats by emp_id for quick lookup
        const statsMap = attendanceStats.reduce((acc, curr) => {
            acc[curr.emp_id] = parseFloat(curr.payable_days) || 0;
            return acc;
        }, {});

        // 3. Process and persist each record
        const results = [];
        for (const user of users) {
            const payableDays = statsMap[user.emp_id] || 0;
            const baseSalary = parseFloat(user.monthly_salary) || 0;
            
            // Core Formula: (Base Salary / Actual Month Days) * Payable Days
            const calculatedAmount = ((baseSalary / daysInMonth) * payableDays).toFixed(2);
            const totalLop = Math.max(0, daysInMonth - payableDays);
            const finalPay = isNaN(calculatedAmount) ? "0.00" : calculatedAmount;

            await pool.query(`
                INSERT INTO salary_records (emp_id, month, year, total_present, total_leave, total_lop, calculated_salary, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
                ON CONFLICT (emp_id, month, year) DO UPDATE SET 
                total_present = EXCLUDED.total_present,
                total_leave = EXCLUDED.total_leave, 
                total_lop = EXCLUDED.total_lop,
                calculated_salary = EXCLUDED.calculated_salary,
                status = EXCLUDED.status
            `, [user.emp_id, month, year, payableDays, 0, totalLop, finalPay]);

            results.push({
                emp_id: user.emp_id,
                name: user.name,
                role: user.role,
                calculated_salary: finalPay,
                payable_days: payableDays
            });
        }

        console.log(`Successfully processed ${results.length} salary records.`);
        res.json({ message: `Successfully recalculated salaries for ${results.length} personnel.`, results });
    } catch (error) {
        console.error('FATAL CALCULATION ERROR:', error);
        res.status(500).json({ 
            message: 'Payroll calculation failed due to an internal server error.',
            details: error.message 
        });
    }
};

// @desc    Get Salary Records
// @route   GET /api/salary
// @access  Private
exports.getSalaryRecords = async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = `
            SELECT s.*, u.name, u.role, u.profile_pic, d.name as department_name, u.monthly_salary
            FROM salary_records s
            JOIN users u ON s.emp_id = u.emp_id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.role != 'admin'
        `;
        const params = [];

        if (month) { query += ' AND s.month = $' + (params.push(month)); }
        if (year) { query += ' AND s.year = $' + (params.push(year)); }

        if (req.user.role === 'staff' || req.user.role === 'principal') {
            query += ' AND s.emp_id = $' + (params.push(req.user.emp_id));
        } else if (req.user.role === 'hod') {
            query += ' AND u.department_id = $' + (params.push(req.user.department_id));
        }

        query += ` ORDER BY 
            CASE u.role 
                WHEN 'principal' THEN 1 
                WHEN 'hod' THEN 2 
                WHEN 'staff' THEN 3 
                ELSE 4 
            END, 
            u.name ASC`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update Salary Status (Mark as Paid)
// @route   PUT /api/salary/:id/status
// @access  Private (Admin)
exports.updateSalaryStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE salary_records SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: `Salary marked as ${status}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Publish all pending salaries for a month/year
// @route   POST /api/salary/publish
// @access  Private (Admin)
exports.publishSalaries = async (req, res) => {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: 'Month and year are required' });

    try {
        const { rowCount } = await pool.query(
            `UPDATE salary_records SET status = 'Paid' WHERE month = $1 AND year = $2 AND status = 'Pending'`,
            [month, year]
        );

        const io = req.app.get('io');
        if (io) io.emit('salary_published', { month, year });

        res.json({ message: `${rowCount} salary records published`, count: rowCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
