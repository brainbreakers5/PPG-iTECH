const http = require('http');
function doRequest(path, method='GET', data=null, token=null) {
  const options = { hostname: 'localhost', port: 5000, path, method, headers: { 'Content-Type': 'application/json' } };
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null }); }
        catch (e) { resolve({ statusCode: res.statusCode, body }); }
      });
    });
    req.on('error', e => reject(e));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}
(async ()=>{
  try {
    console.log('Login principal');
    const login = await doRequest('/api/auth/login','POST',{ emp_id: 'EMP001', pin: '0000' });
    const token = login.body && login.body.token;
    console.log('token?', !!token);
    console.log('Approving id=4');
    const approve = await doRequest('/api/permissions/4/approve','PUT',{ status: 'Approved', comments: 'OK Principal' }, token);
    console.log('approve', approve.statusCode, approve.body);
    const attendance = await doRequest('/api/attendance?date=2026-03-11&emp_id=5045&onlyUploaded=true','GET',null, token);
    console.log('attendance', attendance.statusCode, attendance.body);
  } catch (e) { console.error(e); process.exit(1); }
})();
