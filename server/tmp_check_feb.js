const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log("--- USERS ---");
        const { rows: users } = await pool.query("SELECT emp_id, name, role FROM users LIMIT 10");
        console.log(users);
        console.log("--- FEB ATTENDANCE ---");
        const { rows: att } = await pool.query("SELECT b.name, a.date, a.status FROM attendance a JOIN users b ON a.emp_id = b.emp_id WHERE TO_CHAR(a.date, 'YYYY-MM') = '2026-02' LIMIT 10");
        console.log(att);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
