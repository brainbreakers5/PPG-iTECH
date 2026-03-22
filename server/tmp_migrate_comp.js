const { pool } = require('./config/db');

async function migrate() {
    try {
        await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) DEFAULT 'leave'`);
        console.log('Column added');
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_request_type ON leave_requests(request_type)`);
        console.log('Index created');
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_comp_credit ON leave_requests(emp_id, request_type, status, from_date)`);
        console.log('All migrations done');
        process.exit(0);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

migrate();
