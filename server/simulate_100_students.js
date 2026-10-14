/**
 * server/simulate_100_students.js
 * 
 * Simulates 100 students joining a specific live quiz by QUIZ_ID or Join Code.
 * Signs simulation tokens using the multi-secret verification protocol for instant, 
 * rate-limit-free connection on both Render and Local environments.
 * 
 * Usage:
 *   node server/simulate_100_students.js <QUIZ_ID_OR_PIN> [COUNT] [BASE_URL]
 * 
 * Examples:
 *   node server/simulate_100_students.js 349722
 *   node server/simulate_100_students.js 349722 100 https://quiz-backend-qgro.onrender.com
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const axios = require('axios');
let prisma = null;
try {
    prisma = require('./lib/prisma');
} catch (_) {}

const args = process.argv.slice(2);
const QUIZ_TARGET = args[0] || process.env.QUIZ_ID || process.env.QUIZ_CODE;
const STUDENT_COUNT = parseInt(args[1] || process.env.STUDENT_COUNT || '100', 10);
const BASE_URL = (args[2] || process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const jwtSecret = process.env.JWT_SECRET || 'KMIT_SIMULATION_2026_SECRET_KEY';

if (!QUIZ_TARGET) {
    console.error('\n❌ ERROR: Quiz ID or Join Code is required!');
    console.error('\nUsage:');
    console.error('  node server/simulate_100_students.js <QUIZ_ID_OR_PIN> [STUDENT_COUNT] [BASE_URL]\n');
    console.error('Example:');
    console.error('  node server/simulate_100_students.js 349722 100 https://quiz-backend-qgro.onrender.com\n');
    process.exit(1);
}

console.log('======================================================================');
console.log(`🚀 LIVE QUIZ STUDENT SIMULATOR`);
console.log(`🎯 Target Quiz : ${QUIZ_TARGET}`);
console.log(`👥 Students    : ${STUDENT_COUNT}`);
console.log(`🌐 Server URL  : ${BASE_URL}`);
console.log('======================================================================\n');

const sockets = [];
const connectedSocketIds = new Set();
let joinedCount = 0;
let currentQIdx = 0;

async function resolveRealQuizId(target) {
    if (!prisma) return target;
    try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
        if (isUUID) return target;
        const found = await prisma.quiz.findFirst({
            where: { OR: [{ id: target }, { joinCode: target }] },
            select: { id: true }
        });
        return found ? found.id : target;
    } catch (_) {
        return target;
    }
}

async function runSimulation() {
    const realQuizId = await resolveRealQuizId(QUIZ_TARGET);
    console.log(`📌 Resolved Quiz Room ID: ${realQuizId}`);

    // Try fetching real student users from database if available
    let dbStudents = [];
    let quizQuestions = [];
    if (prisma) {
        try {
            dbStudents = await prisma.user.findMany({
                where: { role: 'student' },
                take: STUDENT_COUNT,
                select: { id: true, username: true, role: true }
            });
            console.log(`📦 Loaded ${dbStudents.length} real student accounts from database.`);
        } catch (_) {}

        try {
            const q = await prisma.quiz.findUnique({
                where: { id: realQuizId },
                select: { questions: true }
            });
            if (q && q.questions) {
                quizQuestions = typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions;
                console.log(`📝 Loaded ${quizQuestions.length} quiz questions for realistic option selection.`);
            }
        } catch (_) {}
    }

    if (quizQuestions.length === 0) {
        try {
            const sampleToken = jwt.sign({ user: { id: 'sim-fetcher', username: 'Fetcher', role: 'simulation' } }, jwtSecret, { expiresIn: '1h' });
            const res = await axios.get(`${BASE_URL}/api/quiz/${realQuizId}`, {
                headers: { Authorization: `Bearer ${sampleToken}` },
                timeout: 5000
            });
            const qData = res.data?.quiz?.questions || res.data?.questions;
            if (qData) {
                quizQuestions = typeof qData === 'string' ? JSON.parse(qData) : qData;
                console.log(`📝 Loaded ${quizQuestions.length} quiz questions via API for realistic option selection.`);
            }
        } catch (_) {}
    }

    console.log(`⏳ Connecting ${STUDENT_COUNT} student bots to live room...`);

    for (let i = 1; i <= STUDENT_COUNT; i++) {
        const dbUser = dbStudents[i - 1];
        const studentId = dbUser ? dbUser.id : `sim_student_${i}_${Date.now()}`;
        const username = dbUser ? dbUser.username : `Student_Bot_${i}`;
        const role = 'simulation';

        // Sign simulation token using configured JWT secret
        const token = jwt.sign(
            { user: { id: studentId, username, role } },
            jwtSecret,
            { expiresIn: '24h' }
        );

        const socket = io(BASE_URL, {
            auth: { token },
            transports: ['websocket'], // Pure WebSocket: eliminates 30s-40s HTTP polling upgrade delays and connection drops
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000
        });

        let heartbeatTimer = null;
        socket.on('connect', () => {
            connectedSocketIds.add(socket.id);

            // Emit join_room
            socket.emit('join_room', {
                quizId: realQuizId,
                user: { username, role: 'student', _id: studentId }
            });

            // Maintain active heartbeat every 10s (reduced frequency saves server CPU & network)
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                if (socket.connected) {
                    socket.emit('heartbeat', { quizId: realQuizId, userId: studentId, username });
                }
            }, 10000);
        });

        const submittedQuestions = new Set();

        const submitAnswer = (idx) => {
            const nextIdx = parseInt(idx);
            if (isNaN(nextIdx) || nextIdx < 0) return;
            if (submittedQuestions.has(nextIdx)) return;
            submittedQuestions.add(nextIdx);

            // Realistic reaction delay between 200ms and 1500ms
            const delay = Math.floor(Math.random() * 1300) + 200;
            setTimeout(() => {
                let selectedOption = 'Option A';
                const curQ = quizQuestions[nextIdx];
                if (curQ && Array.isArray(curQ.options) && curQ.options.length > 0) {
                    const opt = curQ.options[Math.floor(Math.random() * curQ.options.length)];
                    selectedOption = typeof opt === 'string' ? opt : (opt.text || opt.label || String(opt));
                } else {
                    const sampleOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
                    selectedOption = sampleOptions[Math.floor(Math.random() * sampleOptions.length)];
                }

                const doEmit = () => {
                    socket.emit('submit_question_answer', {
                        quizId: realQuizId,
                        studentId,
                        questionIndex: nextIdx,
                        answer: selectedOption,
                        timeRemaining: 20
                    });
                };

                if (socket.connected) {
                    doEmit();
                } else {
                    socket.once('connect', doEmit);
                }
            }, delay);
        };

        socket.on('quiz_started', () => {
            currentQIdx = 0;
            submitAnswer(0);
        });

        socket.on('change_question', ({ questionIndex }) => {
            const nextIdx = parseInt(questionIndex);
            currentQIdx = nextIdx;
            submitAnswer(nextIdx);
        });

        // If joining mid-quiz or reconnecting, attempt the active question immediately
        socket.on('restoreState', (state) => {
            if (state && (state.quizStatus === 'started' || state.quizStatus === 'in-progress')) {
                const qIdx = parseInt(state.currentQuestionIndex ?? 0);
                if (!isNaN(qIdx) && qIdx >= 0) {
                    currentQIdx = qIdx;
                    submitAnswer(qIdx);
                }
            }
        });

        socket.on('quiz_ended', () => {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        });

        socket.on('disconnect', () => {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            connectedSocketIds.delete(socket.id);
        });

        sockets.push(socket);

        // Stagger connections slightly (15ms)
        await new Promise(r => setTimeout(r, 15));
    }

    // Throttled single status logger (eliminates 90,000 blocking console writes that froze Node event loop for 40s)
    const logInterval = setInterval(() => {
        process.stdout.write(`\r🟢 Sockets Connected: ${connectedSocketIds.size}/${STUDENT_COUNT}`);
    }, 500);

    console.log(`\n\n✅ SIMULATION INITIALIZED!`);
    console.log(`🔒 ${STUDENT_COUNT} Student sockets connected and waiting in room.`);
    console.log(`💡 As the teacher starts the quiz & changes questions, students will automatically attempt options and stay connected until quiz ends.\n`);
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Disconnecting all student bots...');
    sockets.forEach(s => s.disconnect());
    if (prisma) prisma.$disconnect();
    console.log('Done.');
    process.exit(0);
});

runSimulation().catch(err => {
    console.error('❌ Simulation Error:', err);
    if (prisma) prisma.$disconnect();
    process.exit(1);
});
