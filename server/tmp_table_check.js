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

async function listTables() {
    try {
        const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables in public schema:");
        console.log(rows.map(r => r.table_name));

        const { rows: attCount } = await pool.query("SELECT COUNT(*) FROM attendance");
        console.log(`Count in 'attendance': ${attCount[0].count}`);

        try {
            const { rows: attRecCount } = await pool.query("SELECT COUNT(*) FROM attendance_records");
            console.log(`Count in 'attendance_records': ${attRecCount[0].count}`);
        } catch (e) {
            console.log("'attendance_records' table does not exist.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listTables();
