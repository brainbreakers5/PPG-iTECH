const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'leave_requests'
        `);
        console.log('Columns in leave_requests:', rows.map(r => r.column_name));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkColumns();
