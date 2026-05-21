import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/socket.io/?EIO=4&transport=websocket';
const QUIZ_ID = '817de27f-7146-4f77-a737-72db6f7e7ae4';

export const options = {
  stages: [
    { duration: '30s', target: 1000 }, // Phase 1: Ramp up rapidly to 1000 users (Normal operation)
    { duration: '30s', target: 1500 }, // Phase 2: Push to 1500 users (Stress stage)
    { duration: '30s', target: 2000 }, // Phase 3: Push to 2000 users (Extreme stage)
    { duration: '30s', target: 2000 }, // Hold 2000 users to observe failures
    { duration: '15s', target: 0 },    // Cool down
  ],
};

export default function () {
  const studentIndex = __VU;
  const email = `test_student_${studentIndex}@kmit.in`;
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
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    });

    socket.on('error', function (e) {
      console.error(`❌ STRESS: Socket error for ${username}: ${e.error()}`);
    });

    sleep(45); // Keep socket open to maintain concurrency load
    socket.close();
  });

  check(response, {
    'websocket handshake status is 101': (r) => r && r.status === 101,
  });
}
