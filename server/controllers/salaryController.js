const { pool } = require('../config/db');

// Helper: count working days in a date range excluding weekends
const getWorkingDays = (from, to) => {
    let count = 0;
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++; // Exclude Sunday(0) and Saturday(6)
        cur.setDate(cur.getDate() + 1);
    }
    return count;
};

// @desc    Calculate Salary (supports exact date range)
// @route   POST /api/salary/calculate
// @access  Private (Admin)
exports.calculateSalary = async (req, res) => {
    const {
        month,
        year,
        emp_id,
        paidStatuses = ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday'],
        unpaidStatuses = ['Absent', 'LOP'],
        fromDate,
        toDate
    } = req.body;

    try {
        // Ensure table schema is up to date
        await pool.query(`
            ALTER TABLE salary_records 
            ADD COLUMN IF NOT EXISTS with_pay_count NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS without_pay_count NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS deductions_applied NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_days_in_period INTEGER DEFAULT 0
        `).catch(err => console.error('Silent migration failed (might be ok if already exists):', err.message));
        // Determine date range for attendance lookup
        // Use provided fromDate/toDate if available, else fallback to full month
        const rangeFrom = fromDate || `${year}-${String(month).padStart(2, '0')}-01`;
        const rangeTo   = toDate   || `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

        // Total calendar days in range (for proration denominator)
        const diffTime = new Date(rangeTo) - new Date(rangeFrom);
        const totalDaysInRange = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

        console.log(`Calculating salaries for range ${rangeFrom} → ${rangeTo} (${totalDaysInRange} days)`);

        // 1. Fetch all eligible employees
        let usersQuery = `
            SELECT id, emp_id, name, monthly_salary, role, deductions
            FROM users
            WHERE LOWER(role) IN ('principal', 'hod', 'staff', 'management')
        `;
        const usersParams = [];
        if (emp_id) {
            usersQuery += ' AND TRIM(emp_id) = $1';
            usersParams.push(emp_id.trim());
        }
        const { rows: users } = await pool.query(usersQuery, usersParams);
        if (users.length === 0) {
            return res.json({ message: 'No eligible employees found', results: [] });
        }

        // 2. Fetch attendance within the exact date range
        const { rows: attendanceStats } = await pool.query(`
            SELECT
                TRIM(emp_id) as emp_id,
                SUM(
                    CASE
                        WHEN status::text LIKE '%+%' THEN
                            (CASE WHEN split_part(status::text, ' + ', 1) = ANY($3::text[]) THEN 0.5 ELSE 0 END +
                             CASE WHEN split_part(status::text, ' + ', 2) = ANY($3::text[]) THEN 0.5 ELSE 0 END)
                        WHEN status::text = ANY($3::text[]) THEN
                            CASE
                                WHEN remarks ILIKE '%Half Day%' OR
                                     remarks ILIKE '%half%' OR
                                     remarks ILIKE '%0.5%' OR
                                     remarks ILIKE '%1/2%'
                                THEN 0.5
                                ELSE 1.0
                            END
                        ELSE 0
                    END
                ) as payable_days,
                SUM(
                    CASE
                        WHEN status::text LIKE '%+%' THEN
                            (CASE WHEN split_part(status::text, ' + ', 1) = ANY($4::text[]) THEN 0.5 ELSE 0 END +
                             CASE WHEN split_part(status::text, ' + ', 2) = ANY($4::text[]) THEN 0.5 ELSE 0 END)
                        WHEN status::text = ANY($4::text[]) THEN
                            CASE
                                WHEN remarks ILIKE '%Half Day%' OR
                                     remarks ILIKE '%half%' OR
                                     remarks ILIKE '%0.5%' OR
                                     remarks ILIKE '%1/2%'
                                THEN 0.5
                                ELSE 1.0
                            END
                        ELSE 0
                    END
                ) as unpaid_days,
                COUNT(*) as total_records
            FROM attendance_records
            WHERE date::date >= $1::date AND date::date <= $2::date
            GROUP BY TRIM(emp_id)
        `, [rangeFrom, rangeTo, paidStatuses, unpaidStatuses]);

        const statsMap = {};
        attendanceStats.forEach(row => {
            statsMap[row.emp_id] = {
                payable_days: parseFloat(row.payable_days) || 0,
                unpaid_days: parseFloat(row.unpaid_days) || 0,
                total_records: parseInt(row.total_records) || 0
            };
        });

        // 3. Calculate and persist — SKIP records already marked as Paid
        const results = [];
        for (const user of users) {
            const userEmpId = (user.emp_id || '').trim();
            if (!userEmpId) continue;

            // Check if already published (Paid) — do NOT overwrite paid records
            const { rows: existing } = await pool.query(
                `SELECT status FROM salary_records WHERE TRIM(emp_id) = $1 AND month = $2 AND year = $3`,
                [userEmpId, month, year]
            );
            if (existing.length > 0 && existing[0].status === 'Paid') {
                // Skip: protect paid records from drift
                continue;
            }

            const stats = statsMap[userEmpId] || { payable_days: 0, unpaid_days: 0 };
            // Ensure numbers, default to 0
            const payableDays = isNaN(stats.payable_days) ? 0 : stats.payable_days;
            const unpaidDays = isNaN(stats.unpaid_days) ? 0 : stats.unpaid_days;
            const baseSalary = isNaN(parseFloat(user.monthly_salary)) ? 0 : parseFloat(user.monthly_salary);

            // Compute total deductions
            let totalDeductions = 0;
            if (user.deductions) {
                try {
                    const parsedDeductions = typeof user.deductions === 'string' ? JSON.parse(user.deductions) : user.deductions;
                    if (Array.isArray(parsedDeductions)) {
                        totalDeductions = parsedDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                    }
                } catch (e) {
                    console.error('Failed to parse deductions for', userEmpId);
                }
            }

            // Real-time calculation logic:
            // "based on attendance - with pay, without pay total counts"
            // Use Positive Accrual: Employee earns their salary based on days present/with pay.
            // If they are marked Present, they earn `dailyRate` for that day.
            const dailyRate = totalDaysInRange > 0 ? baseSalary / totalDaysInRange : 0;
            let grossAmount = dailyRate * payableDays;
            
            // Subtract manual fixed monthly deductions (floor at 0)
            let calcAmountRaw = Math.max(0, grossAmount - totalDeductions);
            if (isNaN(calcAmountRaw)) calcAmountRaw = 0;
            let netSalary = calcAmountRaw.toFixed(2);
            
            const totalLop = unpaidDays;

            await pool.query(`
                INSERT INTO salary_records (
                    emp_id, month, year, total_present, total_leave, total_lop, 
                    calculated_salary, status, with_pay_count, without_pay_count, 
                    deductions_applied, gross_salary, total_days_in_period
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8, $9, $10, $11, $12)
                ON CONFLICT (emp_id, month, year) DO UPDATE SET
                    total_present = EXCLUDED.total_present,
                    total_leave = EXCLUDED.total_leave,
                    total_lop = EXCLUDED.total_lop,
                    calculated_salary = EXCLUDED.calculated_salary,
                    with_pay_count = EXCLUDED.with_pay_count,
                    without_pay_count = EXCLUDED.without_pay_count,
                    deductions_applied = EXCLUDED.deductions_applied,
                    gross_salary = EXCLUDED.gross_salary,
                    total_days_in_period = EXCLUDED.total_days_in_period,
                    status = CASE WHEN salary_records.status = 'Paid' THEN salary_records.status ELSE EXCLUDED.status END
            `, [
                userEmpId, month, year, 
                payableDays, 0, totalLop, 
                netSalary,
                payableDays, totalLop,
                totalDeductions.toFixed(2), grossAmount.toFixed(2), totalDaysInRange
            ]);

            results.push({
                emp_id: userEmpId,
                name: user.name,
                role: user.role,
                monthly_salary: baseSalary,
                calculated_salary: netSalary,
                payable_days: payableDays,
                total_lop: totalLop,
                range_days: totalDaysInRange,
                gross_salary: grossAmount.toFixed(2),
                deductions_applied: totalDeductions.toFixed(2)
            });
        }

        // Emit real-time update to all connected clients
        const io = req.app.get('io');
        if (io) io.emit('salary_calculated', { month, year, count: results.length });

        res.json({ message: `Recalculated salaries for ${results.length} employees.`, results });
    } catch (error) {
        console.error('SALARY CALCULATION ERROR:', error);
        res.status(500).json({ message: 'Payroll calculation failed.', details: error.message });
    }
};

// @desc    Get Salary Records
// @route   GET /api/salary
// @access  Private
exports.getSalaryRecords = async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = `
            SELECT 
                s.*,
                u.name,
                u.role,
                u.profile_pic,
                u.monthly_salary,
                d.name as department_name
            FROM salary_records s
            JOIN users u ON TRIM(s.emp_id) = TRIM(u.emp_id)
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE LOWER(u.role) != 'admin'
        `;
        const params = [];

        if (month) { query += ' AND s.month = $' + (params.push(month)); }
        if (year)  { query += ' AND s.year = $'  + (params.push(year));  }

        // Role-based filter: restrict non-admin users to their own records only
        const role = req.user.role;
        if (role === 'staff' || role === 'principal') {
            query += ' AND TRIM(s.emp_id) = TRIM($' + (params.push(req.user.emp_id)) + ')';
        } else if (role === 'hod') {
            query += ' AND u.department_id = $' + (params.push(req.user.department_id));
        }
        // admin and management: no additional filter — see all

        query += `
            ORDER BY
                CASE LOWER(u.role)
                    WHEN 'principal' THEN 1
                    WHEN 'hod'       THEN 2
                    WHEN 'staff'     THEN 3
                    ELSE 4
                END,
                u.name ASC
        `;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('GET SALARY ERROR:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get Daily Salary Breakdown for a specific employee + period
// @route   GET /api/salary/daily?emp_id=&fromDate=&toDate=&paidStatuses=
// @access  Private
exports.getDailyBreakdown = async (req, res) => {
    try {
        const { emp_id, fromDate, toDate } = req.query;
        const paidStatuses = req.query.paidStatuses
            ? JSON.parse(req.query.paidStatuses)
            : ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday'];

        if (!emp_id || !fromDate || !toDate) {
            return res.status(400).json({ message: 'emp_id, fromDate, toDate are required' });
        }

        // Fetch employee base salary
        const { rows: empRows } = await pool.query(
            `SELECT monthly_salary FROM users WHERE TRIM(emp_id) = $1`,
            [emp_id.trim()]
        );
        if (!empRows.length) return res.status(404).json({ message: 'Employee not found' });
        const baseSalary = parseFloat(empRows[0].monthly_salary) || 0;

        // Total days in range
        const diffTime = new Date(toDate) - new Date(fromDate);
        const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const dailyRate = totalDays > 0 ? baseSalary / totalDays : 0;

        // Fetch daily attendance
        const { rows: attendance } = await pool.query(`
            SELECT date, status, remarks, punch_in, punch_out
            FROM attendance_records
            WHERE TRIM(emp_id) = $1 AND date::date >= $2::date AND date::date <= $3::date
            ORDER BY date ASC
        `, [emp_id.trim(), fromDate, toDate]);

        // Build day-wise breakdown
        const breakdown = attendance.map(a => {
            let dayFactor = 0;
            const st = (a.status || '').trim();
            if (st.includes('+')) {
                const parts = st.split('+').map(p => p.trim());
                parts.forEach(p => { if (paidStatuses.includes(p)) dayFactor += 0.5; });
            } else if (paidStatuses.includes(st)) {
                const isHalf = (a.remarks || '').toLowerCase().includes('half') ||
                               (a.remarks || '').includes('0.5') ||
                               st.toLowerCase().includes('half');
                dayFactor = isHalf ? 0.5 : 1.0;
            }

            const grossEarned = (dailyRate * dayFactor).toFixed(2);
            return {
                date: a.date,
                status: st,
                punch_in: a.punch_in,
                punch_out: a.punch_out,
                day_factor: dayFactor,
                gross_earned: grossEarned,
                net_earned: grossEarned // Currently no per-day deductions beyond LOP
            };
        });

        const totalGross = breakdown.reduce((acc, d) => acc + parseFloat(d.gross_earned), 0);
        res.json({
            emp_id,
            fromDate,
            toDate,
            total_days: totalDays,
            daily_rate: dailyRate.toFixed(2),
            base_salary: baseSalary,
            days_recorded: breakdown.length,
            total_gross: totalGross.toFixed(2),
            breakdown
        });
    } catch (error) {
        console.error('DAILY BREAKDOWN ERROR:', error);
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

// @desc    Notify employee via email when salary is marked as Paid
// @route   POST /api/salary/notify-paid
// @access  Private (Admin)
exports.notifyPaid = async (req, res) => {
    const { emp_id, name, email, fromDate, toDate, amount } = req.body;

    try {
        // Fetch employee email if not provided in body
        let recipientEmail = email;
        if (!recipientEmail) {
            const { rows } = await pool.query('SELECT email FROM users WHERE TRIM(emp_id) = $1', [emp_id?.trim()]);
            recipientEmail = rows[0]?.email;
        }

        if (recipientEmail) {
            const sendEmail = require('../utils/sendEmail');
            const periodText = `${fromDate} to ${toDate}`;
            const amountFormatted = Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

            await sendEmail({
                email: recipientEmail,
                subject: `Salary Credited – PPG Management (${periodText})`,
                message: `Dear ${name},\n\nYour salary for the period ${periodText} has been credited.\nAmount: ${amountFormatted}\n\nPlease check your bank account.\n\nRegards,\nPPG Management`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <div style="text-align:center; margin-bottom:24px;">
                            <h2 style="color:#1e3a8a; margin:0;">PPG EMP HUB</h2>
                            <p style="color:#64748b; font-size:13px; margin:4px 0;">Salary Management System</p>
                        </div>
                        <div style="background: linear-gradient(135deg, #10b981, #059669); border-radius:12px; padding:20px; text-align:center; margin-bottom:24px;">
                            <p style="color:white; font-size:13px; margin:0; font-weight:600;">✅ SALARY CREDITED</p>
                            <h1 style="color:white; font-size:32px; margin:8px 0;">${amountFormatted}</h1>
                        </div>
                        <p style="color:#374151;">Dear <strong>${name}</strong>,</p>
                        <p style="color:#374151;">Your salary for the period <strong>${periodText}</strong> has been credited to your registered bank account.</p>
                        <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:20px 0;">
                            <table style="width:100%; font-size:13px;">
                                <tr><td style="color:#64748b; padding:4px 0;">Period</td><td style="font-weight:600; text-align:right;">${periodText}</td></tr>
                                <tr><td style="color:#64748b; padding:4px 0;">Net Amount</td><td style="font-weight:600; color:#10b981; text-align:right;">${amountFormatted}</td></tr>
                                <tr><td style="color:#64748b; padding:4px 0;">Status</td><td style="font-weight:600; color:#10b981; text-align:right;">✅ PAID</td></tr>
                            </table>
                        </div>
                        <p style="color:#374151;">Please check your bank account and verify the credit. For any queries, contact PPG Management.</p>
                        <div style="text-align:center; margin-top:30px; padding-top:20px; border-top:1px solid #e2e8f0;">
                            <p style="color:#94a3b8; font-size:11px;">PPG Education Institutions · Powered by ZORVIAN TECHNOLOGIES</p>
                        </div>
                    </div>
                `
            });
        }

        res.json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error('NOTIFY PAID ERROR:', error);
        // Don't fail if email bounces – just log and return OK
        res.json({ message: 'Salary marked paid (email notification may have failed)' });
    }
};

