require('dotenv').config({ path: __dirname + '/server/.env' });
const { pool } = require('./server/config/db');

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS permission_requests (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                from_time TIME NOT NULL,
                to_time TIME NOT NULL,
                subject VARCHAR(255),
                reason TEXT,
                status VARCHAR(20) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (emp_id) REFERENCES users(emp_id) ON DELETE CASCADE
            )
        `);
        console.log('Table permission_requests created');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS permission_approvals (
                id SERIAL PRIMARY KEY,
                permission_id INT NOT NULL,
                approver_id VARCHAR(20) NOT NULL,
                approver_type VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pending',
                comments TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (permission_id) REFERENCES permission_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (approver_id) REFERENCES users(emp_id)
            )
        `);
        console.log('Table permission_approvals created');

        console.log('Migration OK');
        process.exit(0);
    } catch(e) {
        console.error(e.message);
        process.exit(1);
    }
})();
