/* eslint-disable */
const http = require('http');

const data = JSON.stringify({
  name: "Test User",
  email: "testuser" + Date.now() + "@test.com",
  password: "test123456"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
    if (res.statusCode === 201) {
      console.log('\nSUCCESS: Registration worked! MongoDB connection is live.');
    } else {
      console.log('\nFAILED: See response above.');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();