/**
 * inject_live_students.js — Live WebSocket Student Injector for Live Quizzes
 *
 * Connects 50 to 500+ simulated live students directly to an ACTIVE Live Quiz room
 * via real Socket.IO WebSocket connections.
 *
 * Features:
 *  - Joins the teacher's live room with real-time presence
 *  - Displays live connection count on teacher's dashboard (e.g. 500 ONLINE)
 *  - Listens to teacher question transitions (quiz_started, change_question, timer_update)
 *  - Automatically answers questions with realistic delays (1–4s)
 *  - Keeps connections alive with heartbeats
 *  - Defaults to deployed Render backend (https://quiz-backend-qgro.onrender.com)
 *
 * Usage:
 *   node load_tests/inject_live_students.js --pin <6_DIGIT_PIN_OR_QUIZ_ID> --count 500
 *   node load_tests/inject_live_students.js --pin 123456 --count 500 --local
 */

'use strict';

const path = require('path');
const { io } = require('../client/node_modules/socket.io-client');

// ── Parse Command Line Arguments ─────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(key, defaultValue) {
    const idx = args.indexOf(key);
    if (idx !== -1 && args[idx + 1]) {
        return args[idx + 1];
    }
    return defaultValue;
}

const isLocal = args.includes('--local') || args.includes('-l');
const DEFAULT_URL = isLocal ? 'http://localhost:5000' : 'https://quiz-backend-qgro.onrender.com';

const PIN_OR_QUIZ_ID = getArg('--pin', getArg('-p', ''));
const STUDENT_COUNT  = parseInt(getArg('--count', getArg('-c', '500')), 10);
const SERVER_URL     = getArg('--url', getArg('-u', DEFAULT_URL));
const CONCURRENT_BATCH = 50; // Connect in batches of 50 to avoid network congestion

if (!PIN_OR_QUIZ_ID) {
    console.log('\n❌ ERROR: Missing required --pin argument!\n');
    console.log('Usage:');
    console.log('  node load_tests/inject_live_students.js --pin <PIN_OR_QUIZ_ID> [--count 500]\n');
    console.log('Examples:');
    console.log('  node load_tests/inject_live_students.js --pin 815422 --count 500');
    console.log('  node load_tests/inject_live_students.js --pin 815422 --count 100 --local\n');
    process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║       ⚡ LIVE QUIZ MULTI-STUDENT BOT INJECTOR (500 STUDENTS)         ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`Target Server  : ${SERVER_URL}`);
console.log(`Room PIN / ID  : ${PIN_OR_QUIZ_ID}`);
console.log(`Student Count  : ${STUDENT_COUNT} concurrent live bots`);
console.log(`Batch Pace     : ${CONCURRENT_BATCH} connections per wave\n`);

const students = [];
let connectedCount = 0;
let answeredTotal = 0;
let currentQuestionIndex = 0;
let activeQuizQuestions = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Spawn a Single Student Bot ───────────────────────────────────────────────
function createStudentBot(index) {
    const studentNum = String(index + 1).padStart(4, '0');
    const studentId = `bot_student_${studentNum}`;
    const username = `Student_${studentNum}`;

    const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        auth: {
            isBot: true,
            user: {
                id: studentId,
                _id: studentId,
                username: username,
                role: 'student'
            }
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 15000
    });

    const bot = {
        index,
        studentId,
        username,
        socket,
        connected: false,
        heartbeatTimer: null
    };

    socket.on('connect', () => {
        bot.connected = true;
        connectedCount++;

        // 1. Join the Live Quiz Room
        socket.emit('join_room', {
            quizId: PIN_OR_QUIZ_ID,
            user: {
                _id: studentId,
                id: studentId,
                username: username,
                role: 'student'
            }
        });

        // 2. Start heartbeat to maintain online status on teacher's dashboard
        bot.heartbeatTimer = setInterval(() => {
            if (socket.connected) {
                socket.emit('heartbeat', { quizId: PIN_OR_QUIZ_ID, userId: studentId });
            }
        }, 5000);
    });

    socket.on('connect_error', (err) => {
        if (index === 0) {
            console.warn(`\n⚠️ Connection diagnostic (Bot 1): ${err.message}`);
        }
    });

    socket.on('disconnect', () => {
        if (bot.connected) {
            bot.connected = false;
            connectedCount = Math.max(0, connectedCount - 1);
        }
        clearInterval(bot.heartbeatTimer);
    });

    // ── Handle Quiz Events from Teacher ──────────────────────────────────────
    socket.on('quiz_started', (data) => {
        currentQuestionIndex = 0;
        if (data && data.questions && Array.isArray(data.questions)) {
            activeQuizQuestions = data.questions;
        }
        scheduleAnswer(bot, 0);
    });

    socket.on('change_question', ({ questionIndex }) => {
        const qIdx = parseInt(questionIndex, 10);
        currentQuestionIndex = qIdx;
        scheduleAnswer(bot, qIdx);
    });

    socket.on('quiz_ended', () => {
        clearInterval(bot.heartbeatTimer);
    });

    return bot;
}

// ── Schedule a Realistic Human Answer Submission ─────────────────────────────
function scheduleAnswer(bot, questionIndex) {
    // Random human reaction delay between 1.0s and 4.5s
    const delayMs = Math.floor(1000 + Math.random() * 3500);

    setTimeout(() => {
        if (!bot.socket.connected) return;

        // Choose answer: 75% pick correct / sensible option, 25% pick random
        const question = activeQuizQuestions[questionIndex];
        let chosenAnswer = 'Option A';

        if (question && Array.isArray(question.options) && question.options.length > 0) {
            const isSmart = (bot.index % 4) !== 0;
            if (isSmart && question.correctAnswer) {
                chosenAnswer = question.correctAnswer;
            } else {
                const randomIdx = Math.floor(Math.random() * question.options.length);
                chosenAnswer = question.options[randomIdx];
            }
        } else {
            // Default choices for uninspected questions
            const defaultOptions = ['A', 'B', 'C', 'D'];
            chosenAnswer = defaultOptions[bot.index % defaultOptions.length];
        }

        const timeRemaining = Math.floor(5 + Math.random() * 20);

        bot.socket.emit('submit_question_answer', {
            quizId: PIN_OR_QUIZ_ID,
            studentId: bot.studentId,
            questionIndex,
            answer: chosenAnswer,
            timeRemaining
        });

        answeredTotal++;
    }, delayMs);
}

// ── Live Progress Monitor in Terminal ─────────────────────────────────────────
function startTerminalReporter() {
    setInterval(() => {
        process.stdout.write(`\r📡 [LIVE STATUS] Connected Bots: ${connectedCount}/${STUDENT_COUNT} | Current Q: ${currentQuestionIndex + 1} | Total Submissions: ${answeredTotal}  `);
    }, 500);
}

// ── Connect Bots in Waves ────────────────────────────────────────────────────
async function launch() {
    console.log(`Connecting ${STUDENT_COUNT} student bots to room ${PIN_OR_QUIZ_ID}...`);

    startTerminalReporter();

    for (let i = 0; i < STUDENT_COUNT; i += CONCURRENT_BATCH) {
        const batchEnd = Math.min(i + CONCURRENT_BATCH, STUDENT_COUNT);
        for (let j = i; j < batchEnd; j++) {
            students.push(createStudentBot(j));
        }
        // Small 150ms breather between connection waves
        await sleep(150);
    }

    console.log(`\n\n🎉 ALL ${STUDENT_COUNT} BOTS SPAWNED & JOINED ROOM ${PIN_OR_QUIZ_ID}!`);
    console.log('👉 Look at your Teacher Dashboard screen — you should see the student count and live tracker populate in real-time!');
    console.log('👉 Advance questions or start the quiz from the teacher dashboard. The bots will answer automatically.\n');
    console.log('Press Ctrl + C at any time to disconnect all bots.\n');
}

launch().catch(err => {
    console.error('Bot launch error:', err);
    process.exit(1);
});

// Clean shutdown on Ctrl + C
process.on('SIGINT', () => {
    console.log('\n\n🛑 Disconnecting all student bots...');
    students.forEach(b => {
        clearInterval(b.heartbeatTimer);
        b.socket.disconnect();
    });
    console.log('✅ All student bots disconnected successfully. Exiting.');
    process.exit(0);
});
