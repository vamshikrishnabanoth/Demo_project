/**
 * in_process_load_test.js — In-process memory load simulation for quizState
 *
 * Tests the answer processing path (the hot path) at 100, 500, and 1000 
 * concurrent simulated students WITHOUT needing a running server or DB.
 *
 * Measures:
 *   - Answer processing throughput (answers/sec)
 *   - Per-answer latency (µs)
 *   - Memory usage
 *   - Duplicate rejection rate
 *   - Final leaderboard correctness
 *
 * Run: node in_process_load_test.js
 */
'use strict';

// Mock prisma before anything
const Module = require('module');
const originalLoad = Module._load;
const upsertCalls = [];
Module._load = function(request, parent, isMain) {
    if (request === './prisma' || (request.endsWith('/prisma') && !request.includes('node_modules'))) {
        return {
            result: {
                upsert: async (args) => { upsertCalls.push(args); return {}; },
                update: async () => ({}),
                create: async () => ({}),
            }
        };
    }
    return originalLoad.apply(this, arguments);
};

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.DATABASE_POOL_SIZE = '10';

const {
    initQuiz, processAnswer, getLeaderboard,
    closeQuiz, cleanupQuiz, getStats, shutdown
} = require('../server/lib/quizState');

function gradeAnswer(answer, question) {
    const isCorrect = answer === question.correctAnswer;
    const points = isCorrect ? (question.points || 10) : 0;
    return { isCorrect, points, resolvedCorrect: question.correctAnswer };
}

// Build a 10-question quiz
function buildMockQuiz(quizId) {
    return {
        id: quizId, joinCode: `PIN${quizId.slice(-4)}`, title: `Load Test Quiz ${quizId}`,
        duration: 0, timerPerQuestion: 30,
        questions: Array.from({ length: 10 }, (_, i) => ({
            questionText: `Question ${i}`,
            options: ['A','B','C','D'],
            correctAnswer: i % 2 === 0 ? 'A' : 'B',
            points: 10
        }))
    };
}

function fmtMs(ns) { return (ns / 1e6).toFixed(3) + 'ms'; }
function fmtµs(ns) { return (ns / 1e3).toFixed(1) + 'µs'; }

async function runScenario(label, numStudents, numQuestions = 5) {
    const quizId = `load-test-${numStudents}-${Date.now()}`;
    const quiz = buildMockQuiz(quizId);
    quiz.questions = quiz.questions.slice(0, numQuestions);

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 Scenario: ${label} — ${numStudents} students × ${numQuestions} questions`);
    console.log('─'.repeat(50));

    initQuiz(quizId, quiz, { currentQuestion: 0, endTime: Date.now() + 300000 });

    const students = Array.from({ length: numStudents }, (_, i) => ({
        studentId: `student-${i}`,
        username: `User${i}`,
        // Every other student gets the correct answer
        answers: quiz.questions.map((q, qi) => (i % 2 === 0 ? q.correctAnswer : 'D'))
    }));

    const latencies = [];
    let accepted = 0;
    let rejected = 0;
    let correct  = 0;

    const memBefore = process.memoryUsage();
    const tStart    = process.hrtime.bigint();

    // Simulate ALL students answering ALL questions
    for (let qi = 0; qi < numQuestions; qi++) {
        for (let si = 0; si < numStudents; si++) {
            const { studentId, username, answers } = students[si];
            const answer = answers[qi];

            const t0 = process.hrtime.bigint();
            const result = processAnswer({
                quizId, studentId, username,
                questionIndex: qi,
                answer,
                qTimeTaken: 5 + Math.random() * 20,
                gradeAnswer
            });
            const t1 = process.hrtime.bigint();
            latencies.push(Number(t1 - t0));

            if (result.accepted) {
                accepted++;
                if (result.isCorrect) correct++;
            } else {
                rejected++;
            }
        }
    }

    const tEnd   = process.hrtime.bigint();
    const totalNs = Number(tEnd - tStart);
    const memAfter = process.memoryUsage();

    // Compute stats
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const max = latencies[latencies.length - 1];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const throughput = ((accepted + rejected) / (totalNs / 1e9)).toFixed(0);

    // Validate leaderboard
    const lb = getLeaderboard(quizId);
    const expectedTopScore = numQuestions * 10; // all-correct student max
    const topScore = lb[0]?.currentScore || 0;

    console.log(`Total answers submitted : ${numStudents * numQuestions}`);
    console.log(`Accepted               : ${accepted}`);
    console.log(`Rejected (duplicate)   : ${rejected}`);
    console.log(`Correct answers        : ${correct}`);
    console.log(`Total wall time        : ${fmtMs(totalNs)}`);
    console.log(`Throughput             : ${throughput} answers/sec`);
    console.log(`Latency p50            : ${fmtµs(p50)}`);
    console.log(`Latency p95            : ${fmtµs(p95)}`);
    console.log(`Latency p99            : ${fmtµs(p99)}`);
    console.log(`Latency max            : ${fmtµs(max)}`);
    console.log(`Latency avg            : ${fmtµs(avg)}`);
    console.log(`Memory delta heap      : +${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Leaderboard size       : ${lb.length}`);
    console.log(`Top student score      : ${topScore} (expected max: ${expectedTopScore})`);
    console.log(`Leaderboard correct    : ${lb.length === numStudents ? '✅' : '❌ MISMATCH'}`);

    // Validate: every student who answered should appear in leaderboard
    if (lb.length !== numStudents) {
        console.error(`❌ LEADERBOARD MISMATCH: expected ${numStudents} got ${lb.length}`);
    }

    // Validate top score
    const correctStudents = students.filter((_, i) => i % 2 === 0);
    const wrongStudents   = students.filter((_, i) => i % 2 !== 0);
    const expectedCorrect = correctStudents.length * numQuestions;
    if (correct !== expectedCorrect) {
        console.error(`❌ CORRECT COUNT MISMATCH: expected ${expectedCorrect} got ${correct}`);
    } else {
        console.log(`Correct count check    : ✅ (${correct}/${expectedCorrect})`);
    }

    const stats = getStats();
    console.log(`Write buffer pending   : ${stats.pendingWrites} (flushed async)`);

    closeQuiz(quizId);
    cleanupQuiz(quizId);

    return {
        numStudents, numQuestions, accepted, rejected, correct,
        throughput: Number(throughput), p50ns: p50, p95ns: p95, p99ns: p99,
        maxNs: max, totalNs
    };
}

async function runDuplicateRejectionTest() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log('🔒 Scenario: Duplicate Rejection Test');
    console.log('─'.repeat(50));

    const quizId = 'dup-test-001';
    const quiz = buildMockQuiz(quizId);
    initQuiz(quizId, quiz, { currentQuestion: 0, endTime: Date.now() + 60000 });

    const studentId = 'dup-student';
    let accepted = 0, rejected = 0;

    // Submit same answer 10 times
    for (let i = 0; i < 10; i++) {
        const r = processAnswer({ quizId, studentId, username: 'DupTester', questionIndex: 0, answer: 'A', qTimeTaken: 5, gradeAnswer });
        if (r.accepted) accepted++;
        else rejected++;
    }

    console.log(`Submissions: 10, accepted: ${accepted}, rejected: ${rejected}`);
    console.assert(accepted === 1, `Only 1 should be accepted (got ${accepted})`);
    console.assert(rejected === 9, `9 should be rejected as duplicates (got ${rejected})`);
    if (accepted === 1 && rejected === 9) {
        console.log('Duplicate rejection: ✅ PASS');
    } else {
        console.log('Duplicate rejection: ❌ FAIL');
    }

    cleanupQuiz(quizId);
}

async function runClosedQuizTest() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log('🔒 Scenario: Closed Quiz Rejection Test');
    console.log('─'.repeat(50));

    const quizId = 'close-test-001';
    const quiz = buildMockQuiz(quizId);
    initQuiz(quizId, quiz, { currentQuestion: 0, endTime: Date.now() + 60000 });

    // Accept one answer
    const r1 = processAnswer({ quizId, studentId: 's1', username: 'A', questionIndex: 0, answer: 'A', qTimeTaken: 5, gradeAnswer });
    console.assert(r1.accepted === true, 'First answer should be accepted');

    // Close the quiz
    closeQuiz(quizId);

    // Try to submit after close
    const r2 = processAnswer({ quizId, studentId: 's2', username: 'B', questionIndex: 0, answer: 'B', qTimeTaken: 5, gradeAnswer });
    console.assert(r2.accepted === false && r2.reason === 'quiz_ended', 'Post-close answer should be rejected');

    if (r2.accepted === false && r2.reason === 'quiz_ended') {
        console.log('Closed quiz rejection: ✅ PASS');
    } else {
        console.log('Closed quiz rejection: ❌ FAIL');
    }
    cleanupQuiz(quizId);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   quizState In-Process Load Test             ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} (${process.arch})`);
    console.log(`Memory: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB heap`);

    const results = [];

    results.push(await runScenario('100 Students',  100, 5));
    results.push(await runScenario('500 Students',  500, 5));
    results.push(await runScenario('1000 Students', 1000, 5));
    results.push(await runScenario('1000 Students × 10 Questions', 1000, 10));

    await runDuplicateRejectionTest();
    await runClosedQuizTest();

    // Summary table
    console.log('\n\n╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                          ║');
    console.log('╠══════════════╦══════════════╦══════════╦════════════╦═══════════════════╣');
    console.log('║ Students     ║ Answers/sec  ║ p50 lat  ║ p99 lat    ║ Wall time         ║');
    console.log('╠══════════════╬══════════════╬══════════╬════════════╬═══════════════════╣');
    for (const r of results) {
        const label = `${r.numStudents}×${r.numQuestions}`.padEnd(12);
        const tps   = String(r.throughput).padEnd(12);
        const p50   = fmtµs(r.p50ns).padEnd(8);
        const p99   = fmtµs(r.p99ns).padEnd(10);
        const wall  = fmtMs(r.totalNs).padEnd(17);
        console.log(`║ ${label} ║ ${tps} ║ ${p50} ║ ${p99} ║ ${wall} ║`);
    }
    console.log('╚══════════════╩══════════════╩══════════╩════════════╩═══════════════════╝');

    console.log('\n📌 Note: These are in-process measurements of the pure memory path.');
    console.log('   Real WebSocket latency will be higher (+WS frame + network + event loop).');
    console.log('   DB write load: ZERO per answer (async flush every 2s via write buffer).\n');

    await shutdown();
    process.exit(0);
})();
