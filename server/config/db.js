const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false // Required for Supabase connection
    }
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
