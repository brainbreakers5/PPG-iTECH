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

const toIsoDate = (v) => String(v || '').slice(0, 10);

const isInstitutionWideRole = (role) => ['admin', 'management'].includes(String(role || '').toLowerCase());

const buildPeriod = ({ month, year, fromDate, toDate }) => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (fromDate && toDate) {
        return {
            fromDate: toIsoDate(fromDate),
            toDate: toIsoDate(toDate),
            month: new Date(toDate).getMonth() + 1,
            year: new Date(toDate).getFullYear()
        };
    }

    const safeYear = Number.isFinite(y) ? y : new Date().getFullYear();
    const safeMonth = Number.isFinite(m) ? m : (new Date().getMonth() + 1);
    const from = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`;
    const to = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${new Date(safeYear, safeMonth, 0).getDate()}`;
    return { fromDate: from, toDate: to, month: safeMonth, year: safeYear };
};

const parseDeductions = (raw) => {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return 0;
        return parsed.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    } catch {
        return 0;
    }
};

const ensureSalarySchema = async () => {
    await pool.query(`
        ALTER TABLE salary_records
        ADD COLUMN IF NOT EXISTS with_pay_count NUMERIC(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS without_pay_count NUMERIC(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS deductions_applied NUMERIC(12, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_days_in_period INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS from_date DATE,
        ADD COLUMN IF NOT EXISTS to_date DATE,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
    `);
};

const getAttendanceAggregateMap = async ({ fromDate, toDate, paidStatuses, unpaidStatuses }) => {
    const { rows } = await pool.query(`
        SELECT
            TRIM(emp_id) AS emp_id,
            SUM(
                CASE
                    WHEN status::text LIKE '%+%' THEN
                        (CASE WHEN split_part(status::text, ' + ', 1) = ANY($3::text[]) THEN 0.5 ELSE 0 END +
                         CASE WHEN split_part(status::text, ' + ', 2) = ANY($3::text[]) THEN 0.5 ELSE 0 END)
                    WHEN status::text = ANY($3::text[]) THEN
                        CASE
                            WHEN remarks ILIKE '%Half Day%' OR remarks ILIKE '%half%' OR remarks ILIKE '%0.5%' OR remarks ILIKE '%1/2%'
                            THEN 0.5
                            ELSE 1.0
                        END
                    ELSE 0
                END
            ) AS payable_days,
            SUM(
                CASE
                    WHEN status::text LIKE '%+%' THEN
                        (CASE WHEN split_part(status::text, ' + ', 1) = ANY($4::text[]) THEN 0.5 ELSE 0 END +
                         CASE WHEN split_part(status::text, ' + ', 2) = ANY($4::text[]) THEN 0.5 ELSE 0 END)
                    WHEN status::text = ANY($4::text[]) THEN
                        CASE
                            WHEN remarks ILIKE '%Half Day%' OR remarks ILIKE '%half%' OR remarks ILIKE '%0.5%' OR remarks ILIKE '%1/2%'
                            THEN 0.5
                            ELSE 1.0
                        END
                    ELSE 0
                END
            ) AS unpaid_days,
            COUNT(*) AS total_records
        FROM attendance_records
        WHERE date::date >= $1::date AND date::date <= $2::date
        GROUP BY TRIM(emp_id)
    `, [fromDate, toDate, paidStatuses, unpaidStatuses]);

    const map = {};
    rows.forEach((r) => {
        map[r.emp_id] = {
            payable_days: parseFloat(r.payable_days) || 0,
            unpaid_days: parseFloat(r.unpaid_days) || 0,
            total_records: parseInt(r.total_records, 10) || 0
        };
    });
    return map;
};

const computeSalaryMetrics = ({ monthlySalary, deductions, workingDaysInPeriod, payableDays }) => {
    const grossSalary = Number(monthlySalary || 0);
    const fixedDeductions = Number(deductions || 0);
    const divisor = workingDaysInPeriod > 0 ? workingDaysInPeriod : 1;
    const dailySalary = grossSalary / divisor;
    const normalizedPayable = Math.max(0, Math.min(workingDaysInPeriod, Number(payableDays || 0)));
    const lopDays = Math.max(0, workingDaysInPeriod - normalizedPayable);
    const lopAmount = lopDays * dailySalary;
    const deductionsApplied = lopAmount + fixedDeductions;
    const netSalary = Math.max(0, grossSalary - deductionsApplied);

    return {
        grossSalary,
        dailySalary,
        payableDays: normalizedPayable,
        lopDays,
        deductionsApplied,
        netSalary
    };
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
        await ensureSalarySchema();
        const period = buildPeriod({ month, year, fromDate, toDate });
        const rangeFrom = period.fromDate;
        const rangeTo = period.toDate;
        const totalWorkingDays = getWorkingDays(rangeFrom, rangeTo);

        // 1. Fetch all eligible employees
        let usersQuery = `
            SELECT id, emp_id, name, monthly_salary, base_salary, role, deductions
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

        // 2. Fetch attendance aggregate within exact date range
        const statsMap = await getAttendanceAggregateMap({
            fromDate: rangeFrom,
            toDate: rangeTo,
            paidStatuses,
            unpaidStatuses
        });

        // 3. Calculate and persist — SKIP records already marked as Paid for same period
        const results = [];
        for (const user of users) {
            const userEmpId = (user.emp_id || '').trim();
            if (!userEmpId) continue;

            // Check if already published (Paid) — do NOT overwrite paid records
            const { rows: existing } = await pool.query(
                `SELECT id, status FROM salary_records WHERE TRIM(emp_id) = $1 AND from_date = $2::date AND to_date = $3::date LIMIT 1`,
                [userEmpId, rangeFrom, rangeTo]
            );
            if (existing.length > 0 && existing[0].status === 'Paid') {
                // Skip: protect paid records from drift
                continue;
            }

            const stats = statsMap[userEmpId] || { payable_days: 0, unpaid_days: 0 };
            const grossSource = parseFloat(user.monthly_salary) || parseFloat(user.base_salary) || 0;
            const fixedDeductions = parseDeductions(user.deductions);
            const metrics = computeSalaryMetrics({
                monthlySalary: grossSource,
                deductions: fixedDeductions,
                workingDaysInPeriod: totalWorkingDays,
                payableDays: stats.payable_days
            });

            if (existing.length > 0) {
                await pool.query(`
                    UPDATE salary_records
                    SET month = $2,
                        year = $3,
                        total_present = $4,
                        total_leave = $5,
                        total_lop = $6,
                        calculated_salary = $7,
                        with_pay_count = $8,
                        without_pay_count = $9,
                        deductions_applied = $10,
                        gross_salary = $11,
                        total_days_in_period = $12,
                        status = CASE WHEN status = 'Paid' THEN status ELSE 'Pending' END
                    WHERE id = $1
                `, [
                    existing[0].id,
                    period.month,
                    period.year,
                    metrics.payableDays,
                    0,
                    metrics.lopDays,
                    metrics.netSalary.toFixed(2),
                    metrics.payableDays,
                    metrics.lopDays,
                    metrics.deductionsApplied.toFixed(2),
                    metrics.grossSalary.toFixed(2),
                    totalWorkingDays
                ]);
            } else {
                await pool.query(`
                    INSERT INTO salary_records (
                        emp_id, month, year, total_present, total_leave, total_lop,
                        calculated_salary, status, with_pay_count, without_pay_count,
                        deductions_applied, gross_salary, total_days_in_period, from_date, to_date
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, 'Pending', $8, $9,
                        $10, $11, $12, $13::date, $14::date
                    )
                `, [
                    userEmpId,
                    period.month,
                    period.year,
                    metrics.payableDays,
                    0,
                    metrics.lopDays,
                    metrics.netSalary.toFixed(2),
                    metrics.payableDays,
                    metrics.lopDays,
                    metrics.deductionsApplied.toFixed(2),
                    metrics.grossSalary.toFixed(2),
                    totalWorkingDays,
                    rangeFrom,
                    rangeTo
                ]);
            }

            results.push({
                emp_id: userEmpId,
                name: user.name,
                role: user.role,
                monthly_salary: metrics.grossSalary,
                calculated_salary: metrics.netSalary.toFixed(2),
                payable_days: metrics.payableDays,
                total_lop: metrics.lopDays,
                range_days: totalWorkingDays,
                gross_salary: metrics.grossSalary.toFixed(2),
                deductions_applied: metrics.deductionsApplied.toFixed(2),
                from_date: rangeFrom,
                to_date: rangeTo
            });
        }

        // Emit real-time update to all connected clients
        const io = req.app.get('io');
        if (io) io.emit('salary_calculated', { month: period.month, year: period.year, fromDate: rangeFrom, toDate: rangeTo, count: results.length });

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
        await ensureSalarySchema();
        const { month, year, fromDate, toDate } = req.query;
        const paidStatuses = req.query.paidStatuses
            ? JSON.parse(req.query.paidStatuses)
            : ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday'];
        const unpaidStatuses = req.query.unpaidStatuses
            ? JSON.parse(req.query.unpaidStatuses)
            : ['Absent', 'LOP'];
        const period = buildPeriod({ month, year, fromDate, toDate });
        const scopeWide = isInstitutionWideRole(req.user.role);

        let usersQuery = `
            SELECT u.emp_id, u.name, u.role, u.profile_pic, u.monthly_salary, u.base_salary, u.deductions, d.name AS department_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE LOWER(u.role) IN ('principal', 'hod', 'staff', 'management')
        `;
        const usersParams = [];

        if (!scopeWide) {
            usersQuery += ` AND TRIM(u.emp_id) = TRIM($1)`;
            usersParams.push(req.user.emp_id);
        }
        usersQuery += ` ORDER BY u.name ASC`;

        const { rows: users } = await pool.query(usersQuery, usersParams);
        if (users.length === 0) return res.json([]);

        const empIds = users.map((u) => u.emp_id.trim());
        const { rows: records } = await pool.query(`
            SELECT s.*
            FROM salary_records s
            WHERE TRIM(s.emp_id) = ANY($1::text[])
              AND s.from_date = $2::date
              AND s.to_date = $3::date
        `, [empIds, period.fromDate, period.toDate]);

        const recMap = {};
        records.forEach((r) => {
            recMap[String(r.emp_id || '').trim()] = r;
        });

        const attendanceMap = await getAttendanceAggregateMap({
            fromDate: period.fromDate,
            toDate: period.toDate,
            paidStatuses,
            unpaidStatuses
        });
        const totalWorkingDays = getWorkingDays(period.fromDate, period.toDate);

        const merged = users.map((u) => {
            const key = String(u.emp_id || '').trim();
            const existing = recMap[key];
            if (existing) {
                if (existing.status !== 'Paid') {
                    const metrics = computeSalaryMetrics({
                        monthlySalary: parseFloat(u.monthly_salary) || parseFloat(u.base_salary) || 0,
                        deductions: parseDeductions(u.deductions),
                        workingDaysInPeriod: totalWorkingDays,
                        payableDays: attendanceMap[key]?.payable_days || existing.total_present || 0
                    });

                    return {
                        ...existing,
                        name: u.name,
                        role: u.role,
                        profile_pic: u.profile_pic,
                        monthly_salary: parseFloat(u.monthly_salary) || parseFloat(u.base_salary) || 0,
                        department_name: u.department_name,
                        deductions: u.deductions,
                        total_present: metrics.payableDays,
                        total_lop: metrics.lopDays,
                        with_pay_count: metrics.payableDays,
                        without_pay_count: metrics.lopDays,
                        deductions_applied: metrics.deductionsApplied.toFixed(2),
                        calculated_salary: metrics.netSalary.toFixed(2),
                        gross_salary: metrics.grossSalary.toFixed(2),
                        total_days_in_period: totalWorkingDays,
                        from_date: toIsoDate(existing.from_date) || period.fromDate,
                        to_date: toIsoDate(existing.to_date) || period.toDate
                    };
                }

                return {
                    ...existing,
                    name: u.name,
                    role: u.role,
                    profile_pic: u.profile_pic,
                    monthly_salary: parseFloat(u.monthly_salary) || parseFloat(u.base_salary) || 0,
                    department_name: u.department_name,
                    deductions: u.deductions,
                    from_date: toIsoDate(existing.from_date) || period.fromDate,
                    to_date: toIsoDate(existing.to_date) || period.toDate
                };
            }

            const gross = parseFloat(u.monthly_salary) || parseFloat(u.base_salary) || 0;
            const metrics = computeSalaryMetrics({
                monthlySalary: gross,
                deductions: parseDeductions(u.deductions),
                workingDaysInPeriod: totalWorkingDays,
                payableDays: attendanceMap[key]?.payable_days || 0
            });

            return {
                id: `preview_${key}_${period.fromDate}_${period.toDate}`,
                emp_id: key,
                name: u.name,
                role: u.role,
                profile_pic: u.profile_pic,
                department_name: u.department_name,
                monthly_salary: gross,
                gross_salary: metrics.grossSalary.toFixed(2),
                calculated_salary: metrics.netSalary.toFixed(2),
                total_present: metrics.payableDays,
                total_lop: metrics.lopDays,
                with_pay_count: metrics.payableDays,
                without_pay_count: metrics.lopDays,
                deductions_applied: metrics.deductionsApplied.toFixed(2),
                total_days_in_period: totalWorkingDays,
                from_date: period.fromDate,
                to_date: period.toDate,
                status: 'Pending',
                month: period.month,
                year: period.year,
                is_preview: true
            };
        });

        res.json(merged);
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

        if (!isInstitutionWideRole(req.user.role) && String(req.user.emp_id || '').trim() !== String(emp_id || '').trim()) {
            return res.status(403).json({ message: 'Not authorized to view this salary breakdown' });
        }

        // Fetch employee base salary
        const { rows: empRows } = await pool.query(
            `SELECT monthly_salary, base_salary FROM users WHERE TRIM(emp_id) = $1`,
            [emp_id.trim()]
        );
        if (!empRows.length) return res.status(404).json({ message: 'Employee not found' });
        const baseSalary = parseFloat(empRows[0].monthly_salary) || parseFloat(empRows[0].base_salary) || 0;

        // Working days in range are the proration denominator
        const totalDays = Math.max(1, getWorkingDays(fromDate, toDate));
        const dailyRate = baseSalary / totalDays;

        // Fetch daily attendance
        const { rows: attendance } = await pool.query(`
            SELECT date, status, remarks, punch_in, punch_out
            FROM attendance_records
            WHERE TRIM(emp_id) = $1 AND date::date >= $2::date AND date::date <= $3::date
            ORDER BY date ASC
        `, [emp_id.trim(), fromDate, toDate]);

        const attMap = {};
        attendance.forEach((a) => {
            attMap[toIsoDate(a.date)] = a;
        });

        // Build day-wise breakdown including missing days for full transparency
        const breakdown = [];
        const cursor = new Date(fromDate);
        const end = new Date(toDate);
        while (cursor <= end) {
            const iso = toIsoDate(cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
            const dayOfWeek = cursor.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const rec = attMap[iso];
            const st = (rec?.status || (isWeekend ? 'Holiday' : 'Absent')).trim();
            let dayFactor = 0;

            if (!isWeekend) {
                if (st.includes('+')) {
                    const parts = st.split('+').map((p) => p.trim());
                    parts.forEach((p) => { if (paidStatuses.includes(p)) dayFactor += 0.5; });
                } else if (paidStatuses.includes(st)) {
                    const remarks = (rec?.remarks || '').toLowerCase();
                    const isHalf = remarks.includes('half') || remarks.includes('0.5') || st.toLowerCase().includes('half');
                    dayFactor = isHalf ? 0.5 : 1.0;
                }
            }

            const grossEarned = (dailyRate * dayFactor).toFixed(2);
            breakdown.push({
                date: iso,
                status: st,
                punch_in: rec?.punch_in || null,
                punch_out: rec?.punch_out || null,
                day_factor: dayFactor,
                gross_earned: grossEarned,
                net_earned: grossEarned
            });
            cursor.setDate(cursor.getDate() + 1);
        }

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
        const { rows } = await pool.query('SELECT status FROM salary_records WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Salary record not found' });

        if (rows[0].status === 'Paid' && status !== 'Paid') {
            return res.status(400).json({ message: 'Paid salary records are immutable and cannot be reverted' });
        }

        await pool.query(
            'UPDATE salary_records SET status = $1, paid_at = CASE WHEN $1 = \'Paid\' THEN COALESCE(paid_at, NOW()) ELSE paid_at END WHERE id = $2',
            [status, req.params.id]
        );
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
    const { month, year, fromDate, toDate } = req.body;
    const period = buildPeriod({ month, year, fromDate, toDate });

    try {
        await ensureSalarySchema();
        const { rowCount } = await pool.query(
            `UPDATE salary_records
             SET status = 'Paid', paid_at = COALESCE(paid_at, NOW())
             WHERE from_date = $1::date AND to_date = $2::date AND status = 'Pending'`,
            [period.fromDate, period.toDate]
        );

        const io = req.app.get('io');
        if (io) io.emit('salary_published', { month: period.month, year: period.year, fromDate: period.fromDate, toDate: period.toDate });

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

