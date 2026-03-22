const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function checkTableInfo() {
    const client = await pool.connect();
    try {
        console.log('--- attendance ---');
        const att = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance'");
        console.log(att.rows);

        console.log('--- attendance_records ---');
        const attRec = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance_records'");
        console.log(attRec.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkTableInfo();
