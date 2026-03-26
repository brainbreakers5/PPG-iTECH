const { pool } = require('../config/db');

async function run() {
  const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

  const monthRows = await q("SELECT to_char((NOW() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM') AS ym");
  const ym = monthRows[0].ym;

  const users = await q(
    'SELECT id, emp_id, name, role, designation FROM users WHERE emp_id IN ($1, $2) ORDER BY emp_id',
    ['942', '943']
  );

  const attendanceThisMonth = await q(
    "SELECT emp_id, COUNT(*)::int AS c FROM attendance_records WHERE to_char(date, 'YYYY-MM') = $1 AND emp_id IN ($2, $3) GROUP BY emp_id ORDER BY emp_id",
    [ym, '942', '943']
  );

  const biometricAttendance = await q(
    'SELECT user_id, COUNT(*)::int AS c FROM biometric_attendance WHERE user_id IN ($1, $2) GROUP BY user_id ORDER BY user_id',
    ['942', '943']
  );

  const biometricLogs = await q(
    'SELECT emp_id, COUNT(*)::int AS c FROM biometric_logs WHERE emp_id IN ($1, $2) GROUP BY emp_id ORDER BY emp_id',
    ['942', '943']
  );

  console.log(JSON.stringify({ ym, users, attendanceThisMonth, biometricAttendance, biometricLogs }, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
