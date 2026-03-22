const http = require('http');

function doRequest(path, method='GET', data=null, token=null) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path,
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (token) options.headers['Authorization'] = 'Bearer ' + token;

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (err) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async function(){
  try {
    console.log('Logging in as Principal...');
    const login = await doRequest('/api/auth/login','POST',{ emp_id: 'EMP001', pin: '0000' });
    console.log('Login response status:', login.statusCode);
    console.log(login.body && login.body.token ? 'Got token' : JSON.stringify(login.body));
    const token = login.body && login.body.token;
    if (!token) return process.exit(1);

    console.log('\nApproving permission id 5 as Principal...');
    const approve = await doRequest('/api/permissions/5/approve','PUT',{ status: 'Approved', comments: 'OK Principal' }, token);
    console.log('Approve status:', approve.statusCode);
    console.log('Approve body:', JSON.stringify(approve.body));

    console.log('\nFetching attendance for emp_id=1196 date=2026-03-11...');
    const attPath = '/api/attendance?date=2026-03-11&emp_id=1196&onlyUploaded=true';
    const attendance = await doRequest(attPath,'GET',null, token);
    console.log('Attendance status:', attendance.statusCode);
    console.log('Attendance body:', JSON.stringify(attendance.body, null, 2));

  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
