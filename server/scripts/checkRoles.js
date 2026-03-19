const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: false
});

async function checkRoles() {
    try {
        const res = await pool.query("SELECT DISTINCT role FROM users");
        console.log('Roles found:', res.rows.map(r => r.role));
        process.exit(0);
    } catch (error) {
        console.error('Error fetching roles:', error);
        process.exit(1);
    }
}

checkRoles();
