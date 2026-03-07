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

async function checkRange() {
    try {
        const { rows } = await pool.query(`
            SELECT 
                MIN(date) as earliest, 
                MAX(date) as latest, 
                COUNT(*) as total 
            FROM attendance
        `);
        console.log("Attendance Date Range:", rows[0]);

        const { rows: FebCount } = await pool.query(`
            SELECT COUNT(*) FROM attendance 
            WHERE (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN '2026-02-01' AND '2026-02-28'
        `);
        console.log("February Records (IST):", FebCount[0].count);

        const { rows: MarCount } = await pool.query(`
            SELECT COUNT(*) FROM attendance 
            WHERE (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN '2026-03-01' AND '2026-03-31'
        `);
        console.log("March Records (IST):", MarCount[0].count);

    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}
checkRange();
