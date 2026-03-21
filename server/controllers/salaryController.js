const { pool } = require('../config/db');

// @desc    Calculate Salary
// @route   POST /api/salary/calculate
// @access  Private (Admin)
exports.calculateSalary = async (req, res) => {
    const { month, year, emp_id, paidStatuses = ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday', 'Weekend'] } = req.body;

    try {
        // Get actual days in the specified month
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let usersQuery = `SELECT id, emp_id, name, monthly_salary, role, department_id FROM users WHERE role != 'admin'`;
        const usersParams = [];

        if (emp_id) {
            usersQuery += ' AND emp_id = $1';
            usersParams.push(emp_id);
        }

        const { rows: users } = await pool.query(usersQuery, usersParams);
        const results = [];

        for (const user of users) {
             // Precise attendance query
             const { rows: stats } = await pool.query(`
                SELECT 
                    SUM(
                        CASE 
                            -- Case 1: Combined status like "Present + CL" or "Present + OD"
                            WHEN status::text LIKE '%+%' THEN
                                (
                                    -- Calculate 0.5 for each part of the combined status that is in paidStatuses
                                    SELECT COALESCE(SUM(0.5), 0) 
                                    FROM unnest(string_to_array(status::text, ' + ')) AS s 
                                    WHERE s = ANY($4::text[])
                                )
                            
                            -- Case 2: Standard status check
                            WHEN status::text = ANY($4::text[]) THEN
                                CASE 
                                    -- Half-day detection in remarks or status
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
                WHERE emp_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
             `, [user.emp_id, month, year, paidStatuses]);

            const payableDays = parseFloat(stats[0].payable_days) || 0;
            const baseSalary = parseFloat(user.monthly_salary) || 0;
            
            // Accurate calculation: (Monthly Salary / Days in Month) * Payable Days
            const calculatedAmount = ((baseSalary / daysInMonth) * payableDays).toFixed(2);
            
            // Total LOP for reporting
            const totalLop = Math.max(0, daysInMonth - payableDays);
            
            // Ensure we don't insert "NaN"
            const finalPay = isNaN(calculatedAmount) ? "0.00" : calculatedAmount;

            await pool.query(`
                INSERT INTO salary_records (emp_id, month, year, total_present, total_leave, total_lop, calculated_salary, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
                ON CONFLICT (emp_id, month, year) DO UPDATE SET 
                total_present = EXCLUDED.total_present,
                total_leave = EXCLUDED.total_leave, 
                total_lop = EXCLUDED.total_lop,
                calculated_salary = EXCLUDED.calculated_salary
             `, [user.emp_id, month, year, payableDays, 0, totalLop, finalPay]);

            results.push({
                emp_id: user.emp_id,
                name: user.name,
                calculated_salary: finalPay,
                payable_days: payableDays,
                total_lop: totalLop
            });
        }

        res.json({ message: `Salary calculated for ${users.length} employees`, results });
    } catch (error) {
        console.error('CalculateSalary Error:', error);
        res.status(500).json({ message: 'Server Error during calculation' });
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
