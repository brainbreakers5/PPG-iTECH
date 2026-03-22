const { pool } = require('./config/db');

(async () => {
    try {
        const r = await pool.query(`
            SELECT 
                SUM(CASE WHEN status::text = ANY($4::text[]) THEN 1 ELSE 0 END) as payable_days,
                SUM(CASE WHEN status::text = 'LOP' THEN 1 ELSE 0 END) as lop
            FROM attendance_records
            WHERE emp_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
        `, ['802', 3, 2026, ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Leave', 'Holiday', 'Weekend']]);
        console.log('Query test result:', r.rows);
    } catch (e) {
        console.log('Query test ERROR:', e.message);
    }
    process.exit(0);
})();
