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

async function runMigration() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Adding is_half_day and hours columns to leave_requests...');

        await client.query(`
            ALTER TABLE leave_requests 
            ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS hours NUMERIC(5, 2)
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

runMigration();
