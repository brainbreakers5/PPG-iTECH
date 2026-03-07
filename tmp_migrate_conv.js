const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'server', '.env') });
const { pool } = require('./server/config/db');

async function migrate() {
    try {
        await pool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS target_user_ids TEXT[]');
        console.log('Migration successful: target_user_ids added to conversations');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
