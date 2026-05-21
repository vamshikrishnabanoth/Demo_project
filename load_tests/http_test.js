import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Config: override via k6 env vars ──────────────────────────────────────────
// Usage: k6 run -e BASE_URL=http://myserver:5000 -e QUIZ_CODE=999999 http_test.js
const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:5000';
const QUIZ_CODE = __ENV.QUIZ_CODE || '999999';
// Maximum seeded test students (seed_load_test_students.js creates 2000)
const MAX_STUDENTS = 2000;

export const options = {
  stages: [
    { duration: '15s', target: 500  }, // Ramp up to 500 users
    { duration: '30s', target: 1000 }, // Ramp up to 1000 users
    { duration: '45s', target: 1000 }, // Sustain 1000 users
    { duration: '15s', target: 0    }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests complete under 1 s
    http_req_failed:   ['rate<0.01'],  // < 1% failure rate
  },
};

export default function () {
  // Wrap VU index into the seeded range so we never exceed 2000 students
  const studentIndex = ((__VU - 1) % MAX_STUDENTS) + 1;
  const email    = `test_student_${studentIndex}@kmit.in`;
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
  const joinPayload = JSON.stringify({ code: QUIZ_CODE });
  const joinRes = http.post(`${BASE_URL}/api/quiz/join`, joinPayload, authParams);
  check(joinRes, {
    'join quiz status is 200': (r) => r.status === 200,
    'has quizId in response': (r) => {
      try { return !!r.json('quizId'); } catch (_) { return false; }
    },
  });

  if (joinRes.status !== 200) {
    sleep(1);
    return;
  }

  const quizId = joinRes.json('quizId');

  sleep(1);

  // 4. FETCH LEADERBOARD (uses the dynamic quizId returned by join)
  const lbRes = http.get(`${BASE_URL}/api/quiz/leaderboard/${quizId}`, authParams);
  check(lbRes, {
    'leaderboard status is 200': (r) => r.status === 200,
    'has leaderboard data': (r) => {
      try {
        const body = r.json();
        // leaderboard may be an array at root or under a 'results'/'leaderboard' key
        return Array.isArray(body) || Array.isArray(body.results) || Array.isArray(body.leaderboard);
      } catch (_) { return false; }
    },
  });

  sleep(2 + Math.random() * 2); // Simulated thinking time before next iteration
}
