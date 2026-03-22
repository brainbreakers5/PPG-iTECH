const { pool } = require('./server/config/db');

async function inspect() {
    try {
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'salary_records'
        `);
        console.log('SALARY_RECORDS COLUMNS:', JSON.stringify(columns, null, 2));

        const { rows: usersColumns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('USERS COLUMNS:', JSON.stringify(usersColumns, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

inspect();
