const { Pool } = require('pg');
require('dotenv').config();

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
        console.log("--- ATTENDANCE SCHEMA ---");
        const res1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance'");
        console.log(res1.rows);

        console.log("--- ATTENDANCE_RECORDS SCHEMA ---");
        try {
            const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance_records'");
            console.log(res2.rows);
        } catch (e) { console.log("Not found"); }
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}
check();
