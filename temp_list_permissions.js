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
    const token = login.body && login.body.token;
    console.log('Login status:', login.statusCode);
    if (!token) { console.error('No token found:', login.body); process.exit(1); }

    console.log('\nGetting /api/permissions for Principal...');
    const res = await doRequest('/api/permissions','GET',null,token);
    console.log('Status:', res.statusCode);
    console.log(JSON.stringify(res.body, null, 2));

  } catch (e) {
    console.error('Error:', e);
  }
})();
