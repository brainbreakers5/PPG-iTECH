const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

const DATA_DIR = 'd:/project IT/PPG-iTECH-main/datas';

function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"'; i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur.trim());
    return result;
}

async function run() {
    const client = new Client(config);
    await client.connect();
    console.log('Connected.');

    try {
        await client.query("SET session_replication_role = 'replica'");

        const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
        files.sort((a, b) => {
            if (a.includes('departments')) return -1;
            if (b.includes('departments')) return 1;
            if (a.includes('users')) return -1;
            if (b.includes('users')) return 1;
            return 0;
        });

        for (const file of files) {
            const tableName = file.replace('_rows.csv', '').replace('.csv', '');
            console.log(`\nProcessing ${tableName}...`);

            const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
            const lines = content.split('\n').filter(l => l.trim().length > 0);
            if (lines.length < 1) continue;

            const headers = parseCsvLine(lines[0]);
            
            // Ensure table exists
            await client.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (id SERIAL PRIMARY KEY)`);

            // Relax ALL columns that are user-defined types (enums)
            const { rows: columns } = await client.query(`
                SELECT column_name, udt_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [tableName]);
            
            for (const col of columns) {
                if (col.data_type === 'USER-DEFINED') {
                    console.log(`   Changing enum column ${col.column_name} to TEXT`);
                    try {
                        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.column_name}" TYPE TEXT`);
                    } catch (e) {
                         console.error(`   Failed to relax column ${col.column_name}: ${e.message}`);
                    }
                }
            }

            // Check missing columns from CSV
            const colSet = new Set(columns.map(c => c.column_name));
            for (const col of headers) {
                if (!colSet.has(col)) {
                    console.log(`   Creating missing column ${col}`);
                    await client.query(`ALTER TABLE "${tableName}" ADD COLUMN "${col}" TEXT`);
                    colSet.add(col);
                }
            }

            // TRUNCATE
            await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);

            // INSERT
            let insertCount = 0;
            let skipCount = 0;
            const hasId = colSet.has('id');

            for (let i = 1; i < lines.length; i++) {
                const rawValues = parseCsvLine(lines[i]);
                if (rawValues.join(',') === headers.join(',')) { skipCount++; continue; }
                if (rawValues.length !== headers.length) { continue; }

                const values = rawValues.map(v => (v === '' || v === 'NULL' || v === 'null') ? null : v);
                const placeholders = headers.map((_, idx) => `$${idx + 1}`).join(', ');
                const colsStr = headers.map(h => `"${h}"`).join(', ');

                let sql = `INSERT INTO "${tableName}" (${colsStr}) VALUES (${placeholders})`;
                if (hasId) sql += ` ON CONFLICT (id) DO NOTHING`;

                try {
                    const r = await client.query(sql, values);
                    if (r.rowCount > 0) insertCount++;
                    else skipCount++;
                } catch (e) {
                    if (i < 5) console.error(`   Row ${i} error: ${e.message}`);
                }
            }
            console.log(`   Result: ${insertCount} inserted, ${skipCount} skipped.`);
        }

        // Sequences
        console.log('\nResetting sequences...');
        const { rows: tabs } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
        for (const t of tabs) {
            try {
                await client.query(`SELECT setval(pg_get_serial_sequence('"${t.table_name}"', 'id'), COALESCE(MAX(id), 1)) FROM "${t.table_name}"`);
            } catch (e) {}
        }

        console.log('DONE!');
    } catch (err) {
        console.error('FATAL:', err.message);
    } finally {
        await client.end();
    }
}
run();
