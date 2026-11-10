/* eslint-disable */
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING AUTHENTICATION VERIFICATION SUITE ===\n");
  const uniqueEmail = `test_${Date.now()}@example.com`;
  const correctPassword = "securePassword123";

  // Test 1: Register with missing fields -> expect 400 MISSING_FIELDS
  const t1 = await post('/api/auth/register', { email: uniqueEmail });
  console.log(`Test 1 [Missing Fields]: Status=${t1.status}, Code=${t1.data.code}`);
  console.assert(t1.status === 400 && t1.data.code === 'MISSING_FIELDS', "T1 Failed");

  // Test 2: Register with short password -> expect 400 PASSWORD_TOO_SHORT
  const t2 = await post('/api/auth/register', { name: "Test", email: uniqueEmail, password: "123" });
  console.log(`Test 2 [Short Password]: Status=${t2.status}, Code=${t2.data.code}`);
  console.assert(t2.status === 400 && t2.data.code === 'PASSWORD_TOO_SHORT', "T2 Failed");

  // Test 3: Register valid user -> expect 201
  const t3 = await post('/api/auth/register', { name: "Test User", email: uniqueEmail, password: correctPassword });
  console.log(`Test 3 [Valid Register]: Status=${t3.status}, User=${t3.data.user?.email}`);
  console.assert(t3.status === 201, "T3 Failed");

  // Test 4: Register duplicate user -> expect 409 USER_ALREADY_EXISTS
  const t4 = await post('/api/auth/register', { name: "Test User 2", email: uniqueEmail, password: correctPassword });
  console.log(`Test 4 [Duplicate Register]: Status=${t4.status}, Code=${t4.data.code}`);
  console.assert(t4.status === 409 && t4.data.code === 'USER_ALREADY_EXISTS', "T4 Failed");

  // Test 5: Login with non-existent email -> expect 401 USER_NOT_FOUND
  const t5 = await post('/api/auth/login', { email: "nonexistent_user@example.com", password: "somePassword" });
  console.log(`Test 5 [User Not Found]: Status=${t5.status}, Code=${t5.data.code}`);
  console.assert(t5.status === 401 && t5.data.code === 'USER_NOT_FOUND', "T5 Failed");

  // Test 6: Login with wrong password -> expect 401 INVALID_PASSWORD
  const t6 = await post('/api/auth/login', { email: uniqueEmail, password: "wrongPassword" });
  console.log(`Test 6 [Wrong Password]: Status=${t6.status}, Code=${t6.data.code}`);
  console.assert(t6.status === 401 && t6.data.code === 'INVALID_PASSWORD', "T6 Failed");

  // Test 7: Login with correct credentials -> expect 200 OK
  const t7 = await post('/api/auth/login', { email: uniqueEmail, password: correctPassword });
  console.log(`Test 7 [Valid Login]: Status=${t7.status}, Success=${t7.data.success}`);
  console.assert(t7.status === 200 && t7.data.success === true, "T7 Failed");

  console.log("\nALL 7 TESTS PASSED SUCCESSFULLY!");
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
