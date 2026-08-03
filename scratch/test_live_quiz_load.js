/**
 * Real-Time Live Quiz Load Tester
 * Simulates N virtual students joining a live quiz room via WebSockets and submitting answers.
 * 
 * Usage:
 *   node scratch/test_live_quiz_load.js <QUIZ_PIN_OR_ID> [NUM_STUDENTS] [SERVER_URL]
 * Example:
 *   node scratch/test_live_quiz_load.js 457364 50
 */

const path = require('path');
const fs = require('fs');
const http = require('https');

let io;
const clientPath = path.resolve(__dirname, '../client/node_modules/socket.io-client');
const serverPath = path.resolve(__dirname, '../server/node_modules/socket.io-client');

if (fs.existsSync(clientPath)) {
    io = require(clientPath).io;
} else if (fs.existsSync(serverPath)) {
    io = require(serverPath).io;
} else {
    try {
        io = require('socket.io-client').io;
    } catch (e) {
        console.error('❌ Could not locate socket.io-client module.');
        process.exit(1);
    }
}

const args = process.argv.slice(2);
const inputPin = args[0] || 'DEMO';
const numStudents = parseInt(args[1] || '50', 10);
const serverUrl = args[2] || 'https://quiz-backend-qgro.onrender.com';

let targetQuizId = inputPin;

// Helper to resolve 6-digit PIN to DB Quiz ID via HTTP API
function resolvePinToQuizId(pin) {
    return new Promise((resolve) => {
        if (!/^\d{6}$/.test(pin)) return resolve(pin);
        
        console.log(`🔍 Resolving 6-digit PIN (${pin}) to backend Quiz ID...`);
        const url = `${serverUrl}/api/quiz/join`;
        const postData = JSON.stringify({ code: pin });
        
        const parsedUrl = new URL(url);
        const req = http.request(parsedUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.quizId) {
                        console.log(`✅ Resolved PIN ${pin} => Real Quiz ID: ${json.quizId}`);
                        return resolve(json.quizId);
                    }
                } catch (e) {}
                resolve(pin);
            });
        });
        req.on('error', () => resolve(pin));
        req.write(postData);
        req.end();
    });
}

console.log(`\n🚀 Starting Real-Time Live Quiz Load Test`);
console.log(`=========================================`);
console.log(`🎯 Target Server: ${serverUrl}`);
console.log(`📌 Input PIN / ID: ${inputPin}`);
console.log(`👥 Virtual Students: ${numStudents}\n`);

let connectedCount = 0;
let joinedCount = 0;
let answerSubmittedCount = 0;
let errorsCount = 0;
const responseTimes = [];

const sockets = [];
const heartbeatIntervals = [];

async function startLoadTest() {
    targetQuizId = await resolvePinToQuizId(inputPin);
    console.log(`⏳ Connecting ${numStudents} virtual student WebSockets to Room ${targetQuizId}...`);

    for (let i = 1; i <= numStudents; i++) {
        const studentId = `bot_student_${i}`;
        const studentName = `Student_${i}`;
        const botIndex = i;

        const socket = io(serverUrl, {
            auth: {
                user: { id: studentId, username: studentName, role: 'student' },
                token: 'bot_test_token'
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 30,
            reconnectionDelay: 500
        });

        sockets.push(socket);

        socket.on('connect', () => {
            connectedCount++;
            
            // Join live quiz room using resolved targetQuizId
            socket.emit('join_room', {
                quizId: targetQuizId,
                user: {
                    _id: studentId,
                    username: studentName,
                    role: 'student'
                }
            });
            joinedCount++;

            // Active Heartbeat Loop every 3s
            const hb = setInterval(() => {
                if (socket.connected) {
                    socket.emit('heartbeat', { quizId: targetQuizId, userId: studentId, username: studentName });
                }
            }, 3000);
            heartbeatIntervals.push(hb);
        });

        const submitAnswer = async (qIndex) => {
            // Realistic human answer delay jitter (100ms - 800ms)
            await new Promise(r => setTimeout(r, 100 + Math.random() * 700));

            const startTime = Date.now();
            const optionChoice = ['A', 'B', 'C', 'D'][botIndex % 4];

            socket.emit('submit_question_answer', {
                quizId: targetQuizId,
                studentId: studentId,
                questionIndex: parseInt(qIndex) || 0,
                answer: optionChoice,
                timeRemaining: 20
            });

            answerSubmittedCount++;
            responseTimes.push(Date.now() - startTime);
        };

        // Submit answer on both quiz_started and change_question events
        socket.on('quiz_started', () => submitAnswer(0));
        socket.on('change_question', ({ questionIndex }) => submitAnswer(questionIndex));

        socket.on('connect_error', () => {
            errorsCount++;
        });

        socket.on('error_alert', (err) => {
            console.warn(`[Socket ${studentName}] Error Alert:`, err);
        });

        // Stagger connection rate (30ms delay) for smooth joining
        await new Promise(r => setTimeout(r, 30));
    }

    const monitorInterval = setInterval(() => {
        const avgLatency = responseTimes.length 
            ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
            : '0';

        console.log(`📊 [Live Monitor] Connected: ${connectedCount}/${numStudents} | Room Joined: ${joinedCount} | Answers Submitted: ${answerSubmittedCount} | Avg Latency: ${avgLatency}ms | Errors: ${errorsCount}`);
    }, 2000);

    // Keep test active for 10 minutes
    setTimeout(() => {
        clearInterval(monitorInterval);
        heartbeatIntervals.forEach(hb => clearInterval(hb));
        console.log(`\n🏁 Test finished. Closing all ${sockets.length} student sockets.`);
        sockets.forEach(s => s.disconnect());
        process.exit(0);
    }, 600000);
}

startLoadTest().catch(err => {
    console.error('Fatal load test error:', err);
});
