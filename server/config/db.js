const { Pool, types } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Prevent pg from converting DATE columns to JS Date objects (which shifts timezone).
// Return DATE values as plain 'YYYY-MM-DD' strings so they stay accurate.
types.setTypeParser(1082, (val) => val);

const normalizeFlag = (value) => String(value || '').trim().toLowerCase();
const sslFlag = normalizeFlag(process.env.DB_SSL || process.env.PGSSLMODE);
const connectionString = String(process.env.DATABASE_URL || '').trim();
const host = String(process.env.DB_HOST || '').toLowerCase();
let hostFromConnectionString = '';

if (connectionString) {
    try {
        hostFromConnectionString = String(new URL(connectionString).hostname || '').toLowerCase();
    } catch (error) {
        console.warn('Invalid DATABASE_URL format. Falling back to DB_HOST/DB_* variables.');
    }
}

const resolvedHost = hostFromConnectionString || host;
const sslDisabled = ['0', 'false', 'no', 'disable'].includes(sslFlag);
const sslEnabledByFlag = ['1', 'true', 'yes', 'require', 'verify-ca', 'verify-full'].includes(sslFlag);
const sslEnabledByHost = resolvedHost.includes('supabase.co') || resolvedHost.includes('neon.tech') || resolvedHost.includes('render.com');
const useSsl = !sslDisabled && (sslEnabledByFlag || (!sslFlag && sslEnabledByHost));
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const defaultPoolMax = isProduction ? 1 : 5;
const parsedPoolMax = Number(process.env.DB_POOL_MAX || process.env.PGPOOL_MAX || defaultPoolMax);
const poolMax = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : defaultPoolMax;
const poolConfig = {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
    keepAlive: true,
};

if ((process.env.NODE_ENV === 'production' || process.env.RENDER) && !connectionString) {
    console.warn('DATABASE_URL is not set in production. Falling back to DB_* variables.');
}

if (!connectionString) {
    delete poolConfig.connectionString;
    poolConfig.host = process.env.DB_HOST;
    poolConfig.user = process.env.DB_USER;
    poolConfig.password = process.env.DB_PASSWORD;
    poolConfig.database = process.env.DB_NAME;
    poolConfig.port = process.env.DB_PORT || 5432;
}

const pool = new Pool(poolConfig);

const connectDB = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('PostgreSQL Database (Supabase) Connected Successfully');
    } catch (error) {
        console.error('Database Connection Failed:', error.message);
    }
};

module.exports = { pool, poolConfig, connectDB };
