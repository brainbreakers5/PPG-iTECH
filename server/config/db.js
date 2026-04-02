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
const defaultPoolMax = isProduction ? 3 : 5;
const parsedPoolMax = Number(process.env.DB_POOL_MAX || process.env.PGPOOL_MAX || defaultPoolMax);
const poolMaxRaw = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : defaultPoolMax;
const poolMax = Math.min(5, poolMaxRaw);
const DEFAULT_QUERY_RETRIES = Math.max(0, Number(process.env.DB_QUERY_RETRIES || 2));
const DEFAULT_RETRY_DELAY_MS = Math.max(100, Number(process.env.DB_QUERY_RETRY_DELAY_MS || 350));
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

const isRetryableDbError = (error) => {
    const code = String(error?.code || '').toUpperCase();
    const msg = String(error?.message || '').toLowerCase();
    return (
        [
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            '57P01',
            '57P03',
            '53300',
            'XX000',
        ].includes(code) ||
        msg.includes('connection terminated') ||
        msg.includes('connection timeout') ||
        msg.includes('max clients reached') ||
        msg.includes('maxclientsinsessionmode') ||
        msg.includes('too many clients')
    );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

const queryWithRetry = async (text, params = [], options = {}) => {
    const retries = Number.isFinite(options.retries) ? Number(options.retries) : DEFAULT_QUERY_RETRIES;
    const retryDelayMs = Number.isFinite(options.retryDelayMs) ? Number(options.retryDelayMs) : DEFAULT_RETRY_DELAY_MS;

    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
        try {
            return await pool.query(text, params);
        } catch (error) {
            lastError = error;
            if (attempt >= retries || !isRetryableDbError(error)) {
                throw error;
            }
            attempt += 1;
            await sleep(retryDelayMs);
        }
    }

    throw lastError;
};

const withDbClient = async (handler) => {
    const client = await pool.connect();
    try {
        return await handler(client);
    } finally {
        client.release();
    }
};

const connectDB = async () => {
    try {
        await queryWithRetry('SELECT 1');
        console.log('PostgreSQL Database (Supabase) Connected Successfully');
    } catch (error) {
        console.error('Database Connection Failed:', error.message);
    }
};

module.exports = { pool, poolConfig, connectDB, queryWithRetry, withDbClient, isRetryableDbError };
