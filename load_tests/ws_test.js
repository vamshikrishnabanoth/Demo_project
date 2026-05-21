import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/socket.io/?EIO=4&transport=websocket';
const QUIZ_ID = '817de27f-7146-4f77-a737-72db6f7e7ae4';
const QUIZ_CODE = '999999';

export const options = {
  stages: [
    { duration: '30s', target: 500 },  // Ramp up to 500 WebSocket connections
    { duration: '30s', target: 1000 }, // Ramp up to 1000 connections
    { duration: '1m', target: 1000 },  // Stay at 1000 connections
    { duration: '15s', target: 0 },    // Ramp down connections
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // Unique login credentials per VU
  const studentIndex = __VU;
  const email = `test_student_${studentIndex}@kmit.in`;
  const password = 'KMIT@1234';

  // 1. GET JWT TOKEN OVER HTTP
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    console.error(`❌ WS Login failed for ${email}: ${loginRes.status}`);
    sleep(1);
    return;
  }

  const token = loginRes.json('token');

  // 2. FETCH ME TO GET USER ID
  const meRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers: { 'x-auth-token': token },
  });
  if (meRes.status !== 200) {
    console.error(`❌ WS Fetch profile failed for ${email}`);
    sleep(1);
    return;
  }

  const studentId = meRes.json('id');
  const username = meRes.json('username');

  // 3. INITIATE SOCKET.IO WEBSOCKET CONNECTION
  const params = {
    headers: {
      'x-auth-token': token,
    },
  };

  const response = ws.connect(WS_URL, params, function (socket) {
    let hasConnectedHandshake = false;
    let heartbeatTimer = null;

    socket.on('open', function () {
      // Connection open, waiting for server's EIO handshake (packet 0)
    });

    socket.on('message', function (data) {
      // Socket.IO message parsing
      if (data === '2') {
        // Socket.IO Ping. We must respond with Pong (3) to keep socket alive
        socket.send('3');
        return;
      }

      if (data.startsWith('0{')) {
        // Server EIO Handshake packet. We respond with a Socket.IO connection request (40)
        socket.send('40');
        return;
      }

      if (data.startsWith('40')) {
        // Socket.IO connection accepted!
        hasConnectedHandshake = true;

        // Emit join_room event: 42["join_room", {"quizId":"...", "user":{"username":"..."}}]
        const joinPayload = JSON.stringify([
          'join_room',
          {
            quizId: QUIZ_ID,
            user: { username: username }
          }
        ]);
        socket.send(`42${joinPayload}`);

        // Start periodic heartbeat every 5 seconds to prevent backend heartbeat timeout
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
        return;
      }

      if (data.startsWith('42[')) {
        // Standard event packet: 42["event_name", payload]
        const jsonStr = data.substring(2);
        try {
          const parsed = JSON.parse(jsonStr);
          const eventName = parsed[0];
          const payload = parsed[1];

          if (eventName === 'change_question') {
            const questionIdx = payload.questionIndex;
            
            // Simulate randomized thinking time (1 to 2.5 seconds)
            sleep(1 + Math.random() * 1.5);

            // Options mapping: Central Processing Unit is correct for question 0, etc.
            const answers = [
              'Central Processing Unit',
              'WS',
              '5432',
              'Load Testing',
              'Prisma ORM',
              'JavaScript',
              '299,792 km/s',
              '201',
              'Node.js',
              'Yes'
            ];
            const answer = answers[questionIdx % 10];

            // Emit submit_question_answer event
            const answerPayload = JSON.stringify([
              'submit_question_answer',
              {
                quizId: QUIZ_ID,
                studentId: studentId,
                questionIndex: questionIdx,
                answer: answer,
                timeRemaining: 20
              }
            ]);
            socket.send(`42${answerPayload}`);
          }
        } catch (e) {
          // Parsing failure
        }
      }
    });

    socket.on('close', function () {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    });

    socket.on('error', function (e) {
      console.error(`❌ Socket error for ${username}: ${e.error()}`);
    });

    // Hold the connection open for the duration of the VU task lifecycle
    sleep(110);
    socket.close();
  });

  check(response, {
    'websocket handshake status is 101': (r) => r && r.status === 101,
  });
}
