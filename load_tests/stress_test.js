import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Config: override via k6 env vars ──────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const WS_URL   = `${BASE_URL.replace('http', 'ws')}/socket.io/?EIO=4&transport=websocket`;
const QUIZ_ID  = __ENV.QUIZ_ID  || '817de27f-7146-4f77-a737-72db6f7e7ae4';
const MAX_STUDENTS = 2000;

export const options = {
  stages: [
    { duration: '30s', target: 1000 }, // Phase 1: Ramp to 1000 (normal load)
    { duration: '30s', target: 1500 }, // Phase 2: Push to 1500 (stress)
    { duration: '30s', target: 2000 }, // Phase 3: Push to 2000 (extreme)
    { duration: '30s', target: 2000 }, // Phase 4: Hold at 2000 (observe failures)
    { duration: '15s', target: 0    }, // Cool down
  ],
  thresholds: {
    http_req_failed:                   ['rate<0.05'], // < 5% HTTP failure under extreme stress
    'websocket_handshake_status_101': ['rate>0.80'], // > 80% WS connections established
  },
};

export default function () {
  const studentIndex = ((__VU - 1) % MAX_STUDENTS) + 1;
  const email    = `test_student_${studentIndex}@kmit.in`;
  const password = 'KMIT@1234';

  // 1. LOGIN OVER HTTP
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s',
  });

  if (loginRes.status !== 200) {
    console.error(`❌ STRESS: HTTP Login failed at ${__VU} VUs for ${email}: ${loginRes.status}`);
    sleep(1);
    return;
  }

  const token = loginRes.json('token');

  // 2. PROFILE FETCH
  const meRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers: { 'x-auth-token': token },
    timeout: '15s',
  });

  if (meRes.status !== 200) {
    console.error(`❌ STRESS: HTTP Fetch profile failed for ${email}`);
    sleep(1);
    return;
  }

  const studentId = meRes.json('id');
  const username = meRes.json('username');

  // 3. WS CONNECTION
  const params = {
    headers: {
      'x-auth-token': token,
    },
  };

  const response = ws.connect(WS_URL, params, function (socket) {
    let heartbeatTimer = null;

    socket.on('message', function (data) {
      if (data === '2') {
        socket.send('3');
        return;
      }
      if (data.startsWith('0{')) {
        socket.send('40');
        return;
      }
      if (data.startsWith('40')) {
        const joinPayload = JSON.stringify([
          'join_room',
          {
            quizId: QUIZ_ID,
            user: { username: username }
          }
        ]);
        socket.send(`42${joinPayload}`);

        heartbeatTimer = setInterval(function () {
          const hbPayload = JSON.stringify([
            'heartbeat',
            {
              quizId: QUIZ_ID,
              userId: studentId
            }
          ]);
          socket.send(`42${hbPayload}`);
        }, 5000);
      }
    });

    socket.on('close', function () {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    });

    socket.on('error', function (e) {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      console.error(`❌ STRESS: Socket error for ${username}: ${e.error()}`);
    });

    // Hold the connection open; 40s fits within each stage window
    sleep(40);
    socket.close();
  });

  check(response, {
    'websocket handshake status is 101': (r) => r && r.status === 101,
  });
}
