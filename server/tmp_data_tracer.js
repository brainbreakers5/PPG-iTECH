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

async function findData() {
    try {
        console.log("--- SEARCHING FOR ATTENDANCE RECORDS ---");
        const tables = ['attendance', 'attendance_record', 'attendance_records', 'personnel_attendance'];
        for (const t of tables) {
            try {
                const { rows } = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
                console.log(`Table '${t}' has ${rows[0].count} records.`);
                if (parseInt(rows[0].count) > 0) {
                    const sample = await pool.query(`SELECT * FROM "${t}" LIMIT 2`);
                    console.log(`Sample from ${t}:`, JSON.stringify(sample.rows, null, 2));
                }
            } catch (e) {
                console.log(`Table '${t}' not found or inaccessible.`);
            }
        }
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}
findData();
