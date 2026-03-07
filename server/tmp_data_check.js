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
        console.log("--- ATTENDANCE DATA SAMPLE ---");
        const res1 = await pool.query("SELECT * FROM attendance LIMIT 5");
        console.log(JSON.stringify(res1.rows, null, 2));

        console.log("--- TABLE LIST ---");
        const res2 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(res2.rows.map(r => r.table_name));
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}
check();
