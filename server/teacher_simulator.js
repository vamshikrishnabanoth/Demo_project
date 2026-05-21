const axios = require('axios');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';
const QUIZ_ID = '817de27f-7146-4f77-a737-72db6f7e7ae4';

async function run() {
  console.log('🤖 Teacher Simulator: Logging in...');
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'teacher1@kmit.in',
      password: 'teacher1@kk'
    });
    const token = loginRes.data.token;
    console.log('🤖 Teacher Simulator: Login successful.');

    const socket = io(BASE_URL, {
      extraHeaders: {
        'x-auth-token': token
      }
    });

    socket.on('connect', () => {
      console.log(`🤖 Teacher Simulator: Connected. Socket ID: ${socket.id}`);
      
      // Join room
      socket.emit('join_room', {
        quizId: QUIZ_ID,
        user: { username: 'teacher1' }
      });
      console.log(`🤖 Teacher Simulator: Joined room: ${QUIZ_ID}`);

      // Start quiz
      socket.emit('start_quiz', QUIZ_ID);
      console.log('🤖 Teacher Simulator: Quiz started.');

      // Cycle through questions
      let currentQuestion = 0;
      const interval = setInterval(() => {
        if (currentQuestion >= 10) {
          console.log('🤖 Teacher Simulator: All questions cycled. Ending quiz...');
          socket.emit('end_quiz', QUIZ_ID);
          clearInterval(interval);
          setTimeout(() => {
            socket.disconnect();
            console.log('🤖 Teacher Simulator: Disconnected.');
            process.exit(0);
          }, 3000);
          return;
        }

        console.log(`🤖 Teacher Simulator: Advancing to question index: ${currentQuestion}`);
        socket.emit('change_question', {
          quizId: QUIZ_ID,
          questionIndex: currentQuestion
        });
        currentQuestion++;
      }, 10000); // 10 seconds per question (matches the k6 ws_test.js stages which stay at 1000 users for 60 seconds)
    });

    socket.on('participants_update', (participants) => {
      // Throttle logs for participants updates
      if (Math.random() < 0.05) {
        console.log(`🤖 Teacher Simulator Event: ${participants.filter(p => p.isOnline).length} participants are online.`);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('🤖 Teacher Simulator Connection Error:', err.message);
    });
  } catch (err) {
    const errMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error('🤖 Teacher Simulator Error:', errMsg);
  }
}

run();
