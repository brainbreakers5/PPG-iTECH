const { Pool, types } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Prevent pg from converting DATE columns to JS Date objects (which shifts timezone).
// Return DATE values as plain 'YYYY-MM-DD' strings so they stay accurate.
types.setTypeParser(1082, (val) => val);

const normalizeFlag = (value) => String(value || '').trim().toLowerCase();
const sslFlag = normalizeFlag(process.env.DB_SSL || process.env.PGSSLMODE);
const host = String(process.env.DB_HOST || '').toLowerCase();
const sslDisabled = ['0', 'false', 'no', 'disable'].includes(sslFlag);
const sslEnabledByFlag = ['1', 'true', 'yes', 'require', 'verify-ca', 'verify-full'].includes(sslFlag);
const sslEnabledByHost = host.includes('supabase.co') || host.includes('neon.tech') || host.includes('render.com');
const useSsl = !sslDisabled && (sslEnabledByFlag || (!sslFlag && sslEnabledByHost));
const configuredPoolMax = Number(process.env.DB_POOL_MAX || process.env.PGPOOL_MAX || 5);
const poolMax = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 5;

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
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
