const { pool } = require('./config/db');

async function inspect() {
    try {
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('USERS COLUMNS:', JSON.stringify(columns, null, 2));

        const { rows: salaryRecordsColumns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'salary_records'
        `);
        console.log('SALARY_RECORDS COLUMNS:', JSON.stringify(salaryRecordsColumns, null, 2));
    } catch (err) {
        console.error('INSPECTION ERROR:', err);
    } finally {
        await pool.end();
    }
}

inspect();
