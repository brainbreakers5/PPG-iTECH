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

async function addDatesDetailColumn() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Adding dates_detail column to leave_requests...');
        await client.query(`
            ALTER TABLE leave_requests 
            ADD COLUMN IF NOT EXISTS dates_detail JSONB;
        `);
        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

addDatesDetailColumn();
