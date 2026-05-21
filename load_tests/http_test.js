import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:5000';
const QUIZ_ID = '817de27f-7146-4f77-a737-72db6f7e7ae4'; // Upserted quiz ID
const QUIZ_CODE = '999999';

export const options = {
  stages: [
    { duration: '15s', target: 500 },  // Ramp up to 500 users
    { duration: '30s', target: 1000 }, // Ramp up to 1000 users
    { duration: '45s', target: 1000 }, // Stay at 1000 users
    { duration: '15s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete under 1s
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

export default function () {
  // Use __VU (Virtual User index) to assign a unique student login
  const studentIndex = __VU; 
  const email = `test_student_${studentIndex}@kmit.in`;
  const password = 'KMIT@1234';

  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // 1. LOGIN
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, params);
  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    console.error(`❌ Login failed for ${email}: Status ${loginRes.status}, Body: ${loginRes.body}`);
    sleep(1);
    return;
  }

  const token = loginRes.json('token');
  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token,
    },
  };

  sleep(0.5);

  // 2. FETCH ME
  const meRes = http.get(`${BASE_URL}/api/auth/me`, authParams);
  check(meRes, {
    'fetch me status is 200': (r) => r.status === 200,
    'has username': (r) => r.json('username') !== undefined,
  });

  sleep(0.5);

  // 3. JOIN QUIZ
  const joinPayload = JSON.stringify({
    code: QUIZ_CODE,
  });
  const joinRes = http.post(`${BASE_URL}/api/quiz/join`, joinPayload, authParams);
  check(joinRes, {
    'join quiz status is 200': (r) => r.status === 200,
    'joined successfully': (r) => r.json('quizId') === QUIZ_ID,
  });

  sleep(1);

  // 4. FETCH LEADERBOARD
  const lbRes = http.get(`${BASE_URL}/api/quiz/leaderboard/${QUIZ_ID}`, authParams);
  check(lbRes, {
    'leaderboard status is 200': (r) => r.status === 200,
    'has leaderboard array': (r) => Array.isArray(r.json('results')),
  });

  sleep(2 + Math.random() * 2); // Simulated thinking time before next iteration
}
