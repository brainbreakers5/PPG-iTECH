const { pool } = require('./server/config/db');

async function fix() {
    try {
        console.log("Applying unique constraint to salary_records...");
        await pool.query('ALTER TABLE salary_records ADD CONSTRAINT unique_salary_record UNIQUE (emp_id, month, year)');
        console.log("Success!");
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log("Constraint already exists. Skipping.");
        } else {
            console.error("Error:", e.message);
        }
    } finally {
        process.exit();
    }
}

fix();
