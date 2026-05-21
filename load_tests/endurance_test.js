import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/socket.io/?EIO=4&transport=websocket';
const QUIZ_ID = '817de27f-7146-4f77-a737-72db6f7e7ae4';

export const options = {
  vus: 250,        // Sustained 250 users
  duration: '10m', // Run for exactly 10 minutes
  thresholds: {
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const studentIndex = __VU;
  const email = `test_student_${studentIndex}@kmit.in`;
  const password = 'KMIT@1234';

  // 1. LOGIN OVER HTTP
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  });

  if (loginRes.status !== 200) {
    sleep(2);
    return;
  }

  const token = loginRes.json('token');

  // 2. PROFILE FETCH
  const meRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers: { 'x-auth-token': token },
    timeout: '10s',
  });

  if (meRes.status !== 200) {
    sleep(2);
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
    let questionCounter = 0;

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

        // Periodic application heartbeat (every 5 seconds)
        heartbeatTimer = setInterval(function () {
          const hbPayload = JSON.stringify([
            'heartbeat',
            {
              quizId: QUIZ_ID,
              userId: studentId
            }
          ]);
          socket.send(`42${hbPayload}`);
          
          // Periodically submit simulated answers to simulate progress and trigger Prisma DB writes
          questionCounter++;
          if (questionCounter % 6 === 0) { // Every 30 seconds
            const qIdx = Math.floor(Math.random() * 10);
            const answerPayload = JSON.stringify([
              'submit_question_answer',
              {
                quizId: QUIZ_ID,
                studentId: studentId,
                questionIndex: qIdx,
                answer: 'Central Processing Unit',
                timeRemaining: 15
              }
            ]);
            socket.send(`42${answerPayload}`);
          }
        }, 5000);
      }
    });

    socket.on('close', function () {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    });

    socket.on('error', function (e) {
      // Log errors silently during endurance to keep console clean
    });

    sleep(90); // Keep socket open for 1.5 minutes per iteration
    socket.close();
  });

  check(response, {
    'websocket handshake status is 101': (r) => r && r.status === 101,
  });

  sleep(5); // Wait 5 seconds before the virtual user logs in and connects again
}
