const { Pool, types } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Prevent pg from converting DATE columns to JS Date objects (which shifts timezone).
// Return DATE values as plain 'YYYY-MM-DD' strings so they stay accurate.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false // Required for Supabase connection
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log('PostgreSQL Database (Supabase) Connected Successfully');
        client.release();
    } catch (error) {
        console.error('Database Connection Failed:', error.message);
    }
};

module.exports = { pool, connectDB };
