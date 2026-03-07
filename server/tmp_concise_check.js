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
        const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        for (const table of tables.map(r => r.table_name)) {
            const { rows } = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`TABLE: ${table} | COUNT: ${rows[0].count}`);
        }
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}
check();
