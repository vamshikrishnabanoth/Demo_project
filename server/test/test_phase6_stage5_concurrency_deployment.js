/**
 * server/test/test_phase6_stage5_concurrency_deployment.js
 *
 * Phase 6 / Stage 5: Concurrency & Deployment Flow Verification Suite
 *
 * Verifies the complete teacher-to-student live quiz lifecycle under realistic concurrency:
 * 1. Live room initialization: Teacher authenticates via JWT, binds to ephemeral server, and initializes live room.
 * 2. Staged student concurrency joins: 10 -> 25 -> 50 concurrent simulation bots + 1 registered DB student.
 * 3. Connection latency characterization: Measures p50, p95, min, and max connect latencies across all 51 sockets.
 * 4. Start quiz lifecycle: Teacher emits start_quiz, initializes in-memory quizState, broadcasts question 0 to all clients.
 * 5. Concurrent answer submissions: 51 simultaneous answers with randomized delays, zero dropped answers, 0% error rate.
 * 6. Leaderboard throttle & aggregation: Verifies throttle protects outbound socket buffers while maintaining accurate rankings.
 * 7. Disconnect and reconnection protocol: Student disconnects, reconnects via reconnectUser, and restores live state.
 * 8. Quiz finalization & write buffer drain: Teacher ends quiz, drains persistence buffer to PostgreSQL, verifies DB status and student result.
 * 9. Security error boundaries: Rejects unauthorized start_quiz/end_quiz and malformed payloads without process crashes.
 */

'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
const { io: ClientIO } = require('socket.io-client');
const prisma = require('../lib/prisma');
const quizState = require('../lib/quizState');
const {
  server,
  io,
  roomParticipants,
  participantBroadcastDebouncers
} = require('../index');

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStage5ConcurrencyTests() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 6 / Stage 5: Concurrency & Deployment Flow Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: [${total}] ${name}`);
      console.error(`     Error: ${err.message}\n${err.stack}\n`);
    }
  }

  // 1. Setup Ephemeral Test Server
  const port = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
  const serverUrl = `http://127.0.0.1:${port}`;
  console.log(`  🌐 Ephemeral live test server listening on ${serverUrl}`);

  const jwtSecret = process.env.JWT_SECRET || 'KMIT_SIMULATION_2026_SECRET_KEY';

  // 2. Fetch Teacher & Real Student from DB
  const teacherUser = await prisma.user.findFirst({ where: { role: 'teacher' } });
  assert.ok(teacherUser, 'Must have at least one teacher user in the database');

  const realStudentUser = await prisma.user.findFirst({ where: { role: 'student' } });
  assert.ok(realStudentUser, 'Must have at least one registered student user in the database');

  console.log(`  👤 Using Teacher: ${teacherUser.username} (${teacherUser.id})`);
  console.log(`  👤 Using Real DB Student: ${realStudentUser.username} (${realStudentUser.id})`);

  // 3. Create a test quiz row in DB
  const testQuizJoinCode = String(Math.floor(100000 + Math.random() * 900000));
  const testQuiz = await prisma.quiz.create({
    data: {
      title: `Phase 6 Stage 5 Concurrency Quiz ${Date.now()}`,
      description: 'Automated Concurrency & Deployment Test Quiz',
      joinCode: testQuizJoinCode,
      duration: 10,
      timerPerQuestion: 30,
      status: 'waiting',
      createdById: teacherUser.id,
      questions: [
        {
          questionText: 'What is the time complexity of searching a balanced BST?',
          options: ['O(log n)', 'O(n)', 'O(1)', 'O(n log n)'],
          correctAnswer: 'O(log n)',
          points: 10
        },
        {
          questionText: 'Which property ensures FIFO ordering in an OS scheduling queue?',
          options: ['First-In First-Out', 'Last-In First-Out', 'Priority Inversion', 'Round Robin Quantum'],
          correctAnswer: 'First-In First-Out',
          points: 10
        }
      ]
    }
  });
  const quizId = testQuiz.id;
  console.log(`  📋 Created live test quiz: ID=${quizId}, PIN=${testQuizJoinCode}\n`);

  const allSockets = [];

  function createClientSocket(userPayload) {
    const token = jwt.sign({ user: userPayload }, jwtSecret, { expiresIn: '2h' });
    const client = ClientIO(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
      forceNew: true
    });
    allSockets.push(client);
    return client;
  }

  let teacherSocket = null;
  let realStudentSocket = null;
  const simStudentSockets = [];
  const connectLatencies = [];

  try {
    // --- TEST 1: Teacher Connection & Room Initialization ---
    await testCase('Teacher Connection: Teacher connects via WebSocket and initializes live room', async () => {
      const t0 = Date.now();
      teacherSocket = createClientSocket({
        id: teacherUser.id,
        username: teacherUser.username,
        role: 'teacher'
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Teacher socket connect timeout')), 5000);
        teacherSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        teacherSocket.on('connect_error', reject);
      });

      connectLatencies.push(Date.now() - t0);

      // Teacher emits join_room
      const joinedPromise = new Promise((resolve) => {
        teacherSocket.on('participants_update', (participants) => {
          if (Array.isArray(participants) && participants.some(p => p.username === teacherUser.username)) {
            resolve(participants);
          }
        });
      });

      teacherSocket.emit('join_room', {
        quizId,
        user: { username: teacherUser.username, role: 'teacher', _id: teacherUser.id }
      });

      const participants = await joinedPromise;
      assert.ok(participants.length >= 1, 'Teacher must appear in room participants');
    });

    // --- TEST 2: Staged Concurrency Joins (10 -> 25 -> 50 sim bots + 1 real student) ---
    await testCase('Staged Concurrency Joins: 50 sim bots + 1 DB student join across 3 staged bursts', async () => {
      const TOTAL_SIM_BOTS = 50;
      const batches = [10, 15, 25]; // 10 -> 25 -> 50 total

      let botIndex = 1;
      for (let b = 0; b < batches.length; b++) {
        const batchSize = batches[b];
        const batchPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const currentBotIdx = botIndex++;
          const studentId = `sim_student_${currentBotIdx}_${Date.now()}`;
          const username = `Student_Bot_${currentBotIdx}`;

          const p = (async () => {
            const t0 = Date.now();
            const s = createClientSocket({
              id: studentId,
              username,
              role: 'simulation'
            });

            await new Promise((res, rej) => {
              const to = setTimeout(() => rej(new Error(`Bot ${username} connect timeout`)), 8000);
              s.on('connect', () => {
                clearTimeout(to);
                connectLatencies.push(Date.now() - t0);
                res();
              });
              s.on('connect_error', rej);
            });

            // Join room
            s.emit('join_room', {
              quizId,
              user: { username, role: 'student', _id: studentId }
            });

            simStudentSockets.push({ socket: s, studentId, username });
          })();

          batchPromises.push(p);
        }

        await Promise.all(batchPromises);
        await wait(50); // slight stage yield
      }

      // Connect 1 real registered student
      const t0Real = Date.now();
      realStudentSocket = createClientSocket({
        id: realStudentUser.id,
        username: realStudentUser.username,
        role: 'student'
      });

      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('Real student connect timeout')), 8000);
        realStudentSocket.on('connect', () => {
          clearTimeout(to);
          connectLatencies.push(Date.now() - t0Real);
          res();
        });
        realStudentSocket.on('connect_error', rej);
      });

      realStudentSocket.emit('join_room', {
        quizId,
        user: { username: realStudentUser.username, role: 'student', _id: realStudentUser.id }
      });

      // Wait briefly for debounced participant broadcast to settle
      await wait(600);

      const stats = calculatePercentiles(connectLatencies);
      console.log(`     📊 Connection Latency Stats across ${connectLatencies.length} sockets:`);
      console.log(`        p50: ${stats.p50}ms | p95: ${stats.p95}ms | min: ${stats.min}ms | max: ${stats.max}ms | avg: ${stats.avg}ms`);

      assert.strictEqual(simStudentSockets.length, 50, 'All 50 simulation bots must be connected');
      assert.ok(stats.p95 < 2000, `p95 connect latency (${stats.p95}ms) must remain well under 2000ms`);

      const currentRoomParticipants = roomParticipants.get(quizId) || [];
      assert.ok(currentRoomParticipants.length >= 51, `Expected at least 51 participants in room, got ${currentRoomParticipants.length}`);
    });

    // --- TEST 3: Start Quiz Lifecycle ---
    await testCase('Start Quiz Lifecycle: Teacher starts quiz, state initializes in memory, broadcasts question 0', async () => {
      const startPromises = [];

      // Verify real student receives quiz_started & change_question
      const realStudentStartedPromise = new Promise((resolve) => {
        let gotStarted = false;
        let gotQuestion = false;
        realStudentSocket.on('quiz_started', () => {
          gotStarted = true;
          if (gotStarted && gotQuestion) resolve();
        });
        realStudentSocket.on('change_question', (data) => {
          if (data.questionIndex === 0) gotQuestion = true;
          if (gotStarted && gotQuestion) resolve();
        });
      });
      startPromises.push(realStudentStartedPromise);

      // Verify a sample of 10 sim bots receive quiz_started
      for (let i = 0; i < 10; i++) {
        const bot = simStudentSockets[i];
        const p = new Promise((resolve) => {
          bot.socket.on('quiz_started', resolve);
        });
        startPromises.push(p);
      }

      teacherSocket.emit('start_quiz', quizId);

      await Promise.all(startPromises);

      const memState = quizState.getQuizState(quizId);
      assert.ok(memState !== null, 'In-memory quizState must be initialized');
      assert.strictEqual(memState.status, 'started', 'Quiz memory state must be started');
      assert.strictEqual(memState.currentQuestion, 0, 'Current question index must be 0');
    });

    // --- TEST 4: Concurrent Answer Submissions & Response Times ---
    await testCase('Concurrent Answer Submissions: 51 students submit answers concurrently with 0% error rate', async () => {
      const answerStart = Date.now();
      const answerLatencies = [];
      let teacherProgressUpdates = 0;

      teacherSocket.on('student_progress_update', (data) => {
        if (data.questionIndex === 0) {
          teacherProgressUpdates++;
        }
      });

      // Prepare answer submissions for all 50 bots + 1 real student
      const submissionPromises = [];

      // 1. Real Student answers correctly ('O(log n)')
      const realStudentPromise = new Promise((resolve, reject) => {
        const t0 = Date.now();
        realStudentSocket.on('answer_feedback', (fb) => {
          answerLatencies.push(Date.now() - t0);
          assert.strictEqual(fb.isUnattempted, false);
          resolve();
        });

        // Small simulated network jitter
        setTimeout(() => {
          realStudentSocket.emit('submit_question_answer', {
            quizId,
            studentId: realStudentUser.id,
            questionIndex: 0,
            answer: 'O(log n)',
            timeRemaining: 28
          });
        }, Math.floor(Math.random() * 80) + 10);
      });
      submissionPromises.push(realStudentPromise);

      // 2. 50 Simulation Bots answer (35 choose 'O(log n)', 15 choose 'O(n)')
      for (let i = 0; i < simStudentSockets.length; i++) {
        const bot = simStudentSockets[i];
        const selectedAnswer = i < 35 ? 'O(log n)' : 'O(n)';

        const botPromise = new Promise((resolve) => {
          const t0 = Date.now();
          setTimeout(() => {
            bot.socket.emit('submit_question_answer', {
              quizId,
              studentId: bot.studentId,
              questionIndex: 0,
              answer: selectedAnswer,
              timeRemaining: Math.floor(Math.random() * 20) + 10
            });
            // Record submission time
            answerLatencies.push(Date.now() - t0);
            resolve();
          }, Math.floor(Math.random() * 150) + 10);
        });
        submissionPromises.push(botPromise);
      }

      await Promise.all(submissionPromises);

      // Allow a brief period for all server progress updates to reach teacher socket
      await wait(800);

      const totalSubmissionDuration = Date.now() - answerStart;
      const ansStats = calculatePercentiles(answerLatencies);

      console.log(`     📊 Answer Submission Stats across 51 concurrent students:`);
      console.log(`        p50: ${ansStats.p50}ms | p95: ${ansStats.p95}ms | min: ${ansStats.min}ms | max: ${ansStats.max}ms | avg: ${ansStats.avg}ms`);
      console.log(`        Total burst handling time: ${totalSubmissionDuration}ms`);
      console.log(`        Teacher progress updates received: ${teacherProgressUpdates} / 51`);

      assert.strictEqual(teacherProgressUpdates, 51, 'Teacher must receive progress updates for all 51 submissions');

      const memLeaderboard = quizState.getLeaderboard(quizId);
      assert.strictEqual(memLeaderboard.length, 51, 'In-memory leaderboard must contain all 51 student scores');

      // Verify real student scored 10 points for correct answer
      const realStudentEntry = memLeaderboard.find(e => e.studentId === realStudentUser.id);
      assert.ok(realStudentEntry, 'Real student must exist in leaderboard');
      assert.strictEqual(realStudentEntry.currentScore, 10, 'Real student should have 10 points for correct answer');
    });

    // --- TEST 5: Leaderboard Throttling & In-Memory Integrity ---
    await testCase('Leaderboard Throttling: Outbound leaderboard broadcasts are throttled under high burst', async () => {
      const throttleMs = quizState.getLeaderboardThrottleMs();
      assert.ok(throttleMs >= 400, `Leaderboard throttle should be >= 400ms (configured: ${throttleMs}ms)`);

      // Verify that shouldBroadcastLeaderboard properly enforces the cooldown
      const shouldBroadcastNow = quizState.shouldBroadcastLeaderboard(quizId);
      // Immediately subsequent call should be throttled
      const shouldBroadcastImmediate = quizState.shouldBroadcastLeaderboard(quizId);
      assert.strictEqual(shouldBroadcastImmediate, false, 'Immediate back-to-back broadcast must be throttled');

      const fullLeaderboard = quizState.getLeaderboard(quizId);
      assert.strictEqual(fullLeaderboard.length, 51);
      // Verify rank ordering: rank 1 has highest score
      assert.strictEqual(fullLeaderboard[0].rank, 1);
      assert.ok(fullLeaderboard[0].currentScore >= fullLeaderboard[fullLeaderboard.length - 1].currentScore);
    });

    // --- TEST 6: Student Disconnection and Reconnection Protocol ---
    await testCase('Reconnection Protocol: Student disconnects, reconnects via reconnectUser, and restores state', async () => {
      const botToReconnect = simStudentSockets[0];

      // 1. Force disconnect the student socket
      botToReconnect.socket.disconnect();
      await wait(100);

      // 2. Connect a new socket with the same student credentials
      const reconnectedSocket = createClientSocket({
        id: botToReconnect.studentId,
        username: botToReconnect.username,
        role: 'simulation'
      });

      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('Reconnection socket connect timeout')), 5000);
        reconnectedSocket.on('connect', () => {
          clearTimeout(to);
          res();
        });
        reconnectedSocket.on('connect_error', rej);
      });

      // 3. Emit reconnectUser and wait for restoreState
      const restoredState = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('restoreState event timeout')), 5000);
        reconnectedSocket.on('restoreState', (state) => {
          clearTimeout(to);
          resolve(state);
        });

        reconnectedSocket.emit('reconnectUser', {
          quizId,
          user: { username: botToReconnect.username, role: 'student', _id: botToReconnect.studentId }
        });
      });

      assert.strictEqual(restoredState.currentQuestionIndex, 0, 'Restored state must have current question index 0');
      assert.strictEqual(restoredState.quizStatus, 'started', 'Restored state must have quizStatus started');
      assert.ok(Array.isArray(restoredState.leaderboard), 'Restored state must include leaderboard');
      assert.ok(restoredState.leaderboard.length >= 50, 'Restored leaderboard must have active students');
      assert.ok(restoredState.remainingTime >= 0, 'Restored remaining time must be valid');
    });

    // --- TEST 7: Teacher Quiz End & Write Buffer Drain to PostgreSQL ---
    await testCase('Quiz Finalization & Persistence: Teacher ends quiz, write buffer drains, DB records updated', async () => {
      const endedPromises = [];

      // Real student socket listens for quiz_ended
      const realStudentEndPromise = new Promise((resolve) => {
        realStudentSocket.on('quiz_ended', resolve);
      });
      endedPromises.push(realStudentEndPromise);

      // Teacher listens for quiz_ended_success
      const teacherEndPromise = new Promise((resolve) => {
        teacherSocket.on('quiz_ended_success', resolve);
      });
      endedPromises.push(teacherEndPromise);

      // Teacher emits end_quiz
      teacherSocket.emit('end_quiz', quizId);

      await Promise.all(endedPromises);

      // Wait a moment for background DB writes to complete
      await wait(600);

      // 1. Verify Quiz row in database
      const finalizedQuiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: { status: true, finalLeaderboard: true }
      });

      assert.strictEqual(finalizedQuiz.status, 'finished', 'Quiz status in database must be finished');
      assert.ok(Array.isArray(finalizedQuiz.finalLeaderboard), 'Final leaderboard must be saved in database');
      assert.ok(finalizedQuiz.finalLeaderboard.length >= 1, 'Final leaderboard in DB must not be empty');

      // 2. Verify Real Student Result record in database
      const dbResult = await prisma.result.findUnique({
        where: {
          quizId_studentId: {
            quizId,
            studentId: realStudentUser.id
          }
        }
      });

      assert.ok(dbResult !== null, 'Real student Result record must be persisted in database');
      assert.strictEqual(dbResult.status, 'completed', 'Result status must be completed');
      assert.strictEqual(dbResult.score, 10, 'Persisted score must match graded points (10)');

      const savedAnswers = Array.isArray(dbResult.answers) ? dbResult.answers : [];
      assert.strictEqual(savedAnswers.length, 1, 'Persisted answers array must contain Question 0');
      assert.strictEqual(savedAnswers[0].isCorrect, true, 'Question 0 answer must be marked correct');
      assert.strictEqual(savedAnswers[0].selectedOption, 'O(log n)');
    });

    // --- TEST 8: Security & Top-Level Error Boundaries ---
    await testCase('Security Boundaries: Rejects unauthorized actions and malformed payloads without crash', async () => {
      // 1. Student attempts to start_quiz
      let studentAlert = null;
      realStudentSocket.on('error_alert', (p) => { studentAlert = p; });
      realStudentSocket.emit('start_quiz', quizId);
      await wait(100);
      assert.ok(studentAlert !== null, 'Student start_quiz must trigger error_alert');
      assert.strictEqual(studentAlert.msg, 'Unauthorized action.');

      // 2. Student attempts to end_quiz
      studentAlert = null;
      realStudentSocket.emit('end_quiz', quizId);
      await wait(100);
      assert.ok(studentAlert !== null, 'Student end_quiz must trigger error_alert');
      assert.strictEqual(studentAlert.msg, 'Unauthorized action.');

      // 3. Malformed submit_question_answer payloads (null, spoofed ID, negative index)
      let submitAlert = null;
      teacherSocket.on('error_alert', (p) => { submitAlert = p; });

      // Identity spoofing attempt
      teacherSocket.emit('submit_question_answer', {
        quizId,
        studentId: 'some_other_spoofed_id',
        questionIndex: 0,
        answer: 'O(log n)'
      });
      await wait(100);
      assert.ok(submitAlert !== null, 'Spoofed submission must trigger error_alert');
      assert.strictEqual(submitAlert.msg, 'Unauthorized action.');

      // Null payload
      submitAlert = null;
      teacherSocket.emit('submit_question_answer', null);
      await wait(100);
      assert.ok(submitAlert !== null, 'Null submission must trigger error_alert');
      assert.strictEqual(submitAlert.msg, 'Unauthorized action.');

      // Negative index
      submitAlert = null;
      teacherSocket.emit('submit_question_answer', {
        quizId,
        studentId: teacherUser.id,
        questionIndex: -1,
        answer: 'O(log n)'
      });
      await wait(100);
      assert.ok(submitAlert !== null, 'Negative question index must trigger error_alert');
      assert.strictEqual(submitAlert.msg, 'Invalid question index.');
    });

  } finally {
    // Teardown: Disconnect all sockets and clean up database
    console.log('\n  🧹 Cleaning up test sockets and ephemeral resources...');
    for (const s of allSockets) {
      if (s.connected) s.disconnect();
    }

    try {
      quizState.cleanupQuiz(quizId);
    } catch (_) {}

    try {
      await prisma.result.deleteMany({ where: { quizId } });
      await prisma.quiz.delete({ where: { id: quizId } });
      console.log('  🗑️ Removed ephemeral test quiz and results from database.');
    } catch (e) {
      console.warn('  ⚠️ Note during cleanup:', e.message);
    }

    await new Promise((resolve) => server.close(resolve));
    console.log('  🔒 Ephemeral test server closed cleanly.\n');
  }

  // --- SUMMARY ---
  console.log('================================================================');
  if (passed === total) {
    console.log(`🏁 RESULT: ALL ${passed} / ${total} TESTS PASSED CLEANLY (100%)`);
  } else {
    console.error(`❌ RESULT: ${total - passed} / ${total} TESTS FAILED (${passed} passed)`);
  }
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage5ConcurrencyTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('🔥 Fatal Uncaught Error in Stage 5 Suite:', err);
    process.exit(1);
  });
