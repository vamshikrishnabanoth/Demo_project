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
 *   node server/simulate_100_students.js 349722 100 https://demo-project-3izc.onrender.com
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
let prisma = null;
try {
    prisma = require('./lib/prisma');
} catch (_) {}

const args = process.argv.slice(2);
const QUIZ_TARGET = args[0] || process.env.QUIZ_ID || process.env.QUIZ_CODE;
const STUDENT_COUNT = parseInt(args[1] || process.env.STUDENT_COUNT || '100', 10);
const BASE_URL = (args[2] || process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const SIMULATION_SECRET = process.env.JWT_SECRET || 'secret123';

if (!QUIZ_TARGET) {
    console.error('\n❌ ERROR: Quiz ID or Join Code is required!');
    console.error('\nUsage:');
    console.error('  node server/simulate_100_students.js <QUIZ_ID_OR_PIN> [STUDENT_COUNT] [BASE_URL]\n');
    console.error('Example:');
    console.error('  node server/simulate_100_students.js 349722 100 https://demo-project-3izc.onrender.com\n');
    process.exit(1);
}

console.log('======================================================================');
console.log(`🚀 LIVE QUIZ STUDENT SIMULATOR`);
console.log(`🎯 Target Quiz : ${QUIZ_TARGET}`);
console.log(`👥 Students    : ${STUDENT_COUNT}`);
console.log(`🌐 Server URL  : ${BASE_URL}`);
console.log('======================================================================\n');

const sockets = [];
let connectedCount = 0;
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
    if (prisma) {
        try {
            dbStudents = await prisma.user.findMany({
                where: { role: 'student' },
                take: STUDENT_COUNT,
                select: { id: true, username: true, role: true }
            });
            console.log(`📦 Loaded ${dbStudents.length} real student accounts from database.`);
        } catch (_) {}
    }

    console.log(`⏳ Connecting ${STUDENT_COUNT} student bots to live room...`);

    for (let i = 1; i <= STUDENT_COUNT; i++) {
        const dbUser = dbStudents[i - 1];
        const studentId = dbUser ? dbUser.id : `sim_student_${i}_${Date.now()}`;
        const username = dbUser ? dbUser.username : `Student_Bot_${i}`;
        const role = dbUser ? dbUser.role : 'student';

        // Sign simulation token using unified fallback secret
        const token = jwt.sign(
            { user: { id: studentId, username, role } },
            SIMULATION_SECRET,
            { expiresIn: '24h' }
        );

        const socket = io(BASE_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10
        });

        socket.on('connect', () => {
            connectedCount++;

            // Emit join_room
            socket.emit('join_room', {
                quizId: realQuizId,
                user: { username, role: 'student', _id: studentId }
            });
        });

        socket.on('participants_update', (participants = []) => {
            joinedCount = participants.filter(p => p.role?.toLowerCase() !== 'teacher').length;
            process.stdout.write(`\r🟢 Sockets Connected: ${connectedCount}/${STUDENT_COUNT} | Live Participants in Room: ${joinedCount}`);
        });

        socket.on('error_alert', (err) => {
            console.error(`\n⚠️  [${username}] Socket Error Alert:`, err?.msg || err);
        });

        socket.on('connect_error', (err) => {
            console.error(`\n⚠️  [${username}] Connection Error:`, err.message);
        });

        socket.on('quiz_started', () => {
            console.log(`\n🔔 Quiz Started notification received by ${username}`);
            currentQIdx = 0;
        });

        socket.on('change_question', ({ questionIndex }) => {
            const nextIdx = parseInt(questionIndex);
            currentQIdx = nextIdx;
            
            // Random reaction delay between 800ms and 2500ms
            const delay = Math.floor(Math.random() * 1700) + 800;
            setTimeout(() => {
                const sampleOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
                const selectedOption = sampleOptions[Math.floor(Math.random() * sampleOptions.length)];

                socket.emit('submit_question_answer', {
                    quizId: realQuizId,
                    studentId,
                    questionIndex: nextIdx,
                    answer: selectedOption,
                    timeRemaining: 20
                });
            }, delay);
        });

        socket.on('quiz_ended', () => {
            console.log(`\n🏁 Quiz Ended event received by student bots.`);
        });

        socket.on('disconnect', () => {
            connectedCount = Math.max(0, connectedCount - 1);
        });

        sockets.push(socket);

        // Stagger connections slightly (10ms) to avoid TCP SYN flood
        await new Promise(r => setTimeout(r, 10));
    }

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
