/**
 * server/test/test_live_e2e_browser_db.js
 *
 * Real Live Browser-to-Database End-to-End Smoke Test Suite
 * Executes full HTTP request-response journeys against live Express routes and Supabase PostgreSQL:
 *
 * 1. Server boot & DB health verification
 * 2. Teacher, Student, and Admin authentication & JWT token issuance
 * 3. Teacher Quiz Lifecycle: Creation, Scheduling, Publication, and Immutability Locking
 * 4. Quiz Assignment: POST /api/quiz/assign/:id (Verifying newly mounted route)
 * 5. Student Journey: Discovery (/api/quiz/available), Taking Quiz (/api/quiz/submit), Scoring, & Review
 * 6. Admin Journey: User Directory, Student Suspension (PATCH /api/admin/users/:id/suspend), and Real-time Auth Denial
 * 7. External Integrations: Gemini STT unconfigured fallback safety
 * 8. Comprehensive DB Teardown & Connection Cleanup
 */

'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { server } = require('../index');
const { transcribeChunkWithGemini } = require('../utils/audioChunker');
const { resolveGenerationErrorCode } = require('../controllers/quizController');

console.log('======================================================================');
console.log('🌐 REAL BROWSER-TO-DATABASE END-TO-END SMOKE TEST SUITE');
console.log('======================================================================\n');

let baseUrl = '';
let httpServer = null;
let passCount = 0;

function runTest(name, fn) {
  return async () => {
    try {
      await fn();
      passCount++;
      console.log(` ✅ PASS [${passCount}]: ${name}`);
    } catch (err) {
      console.error(` ❌ FAIL: ${name}`);
      console.error(err);
      throw err;
    }
  };
}

// HTTP request helper simulating browser fetch / axios
function httpRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (_) {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test State
const timestamp = Date.now();
const testPassword = 'Password123!';
let teacherUser = null;
let studentUser = null;
let adminUser = null;
let teacherToken = '';
let studentToken = '';
let adminToken = '';
let createdQuizId = '';

async function main() {
  try {
    // -------------------------------------------------------------------------
    // Setup 1: Boot HTTP server on dynamic port
    // -------------------------------------------------------------------------
    await new Promise((resolve) => {
      httpServer = server.listen(0, '127.0.0.1', () => {
        const port = httpServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`🚀 Live test server listening on ${baseUrl}\n`);
        resolve();
      });
    });

    // -------------------------------------------------------------------------
    // Setup 2: Provision test users in Supabase PostgreSQL
    // -------------------------------------------------------------------------
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    teacherUser = await prisma.user.create({
      data: {
        username: `e2e_teacher_${timestamp}`,
        email: `e2e_teacher_${timestamp}@test.edu`,
        password: hashedPassword,
        role: 'teacher',
        name: 'Prof. E2E Teacher',
        studentBranch: 'CSE',
        section: 'A'
      }
    });

    studentUser = await prisma.user.create({
      data: {
        username: `e2e_student_${timestamp}`,
        email: `e2e_student_${timestamp}@test.edu`,
        password: hashedPassword,
        role: 'student',
        name: 'Alex Student',
        year: '2',
        studentBranch: 'CSE',
        section: 'A'
      }
    });

    adminUser = await prisma.user.create({
      data: {
        username: `e2e_admin_${timestamp}`,
        email: `e2e_admin_${timestamp}@test.edu`,
        password: hashedPassword,
        role: 'admin',
        name: 'System Admin'
      }
    });

    console.log(`👤 Provisioned test users: Teacher (${teacherUser.id}), Student (${studentUser.id}), Admin (${adminUser.id})\n`);

    // -------------------------------------------------------------------------
    // Journey 1: Authentication & Token Issuance
    // -------------------------------------------------------------------------
    await runTest('J1: Teacher, Student, and Admin login via POST /api/auth/login and receive valid JWTs', async () => {
      // 1. Teacher login
      const tRes = await httpRequest('/api/auth/login', {
        method: 'POST',
        body: { email: teacherUser.email, password: testPassword }
      });
      assert.strictEqual(tRes.status, 200, 'Teacher login must return 200');
      assert.ok(tRes.data.token, 'Teacher response must include JWT token');
      assert.strictEqual(tRes.data.user.role, 'teacher');
      teacherToken = tRes.data.token;

      // 2. Student login
      const sRes = await httpRequest('/api/auth/login', {
        method: 'POST',
        body: { email: studentUser.email, password: testPassword }
      });
      assert.strictEqual(sRes.status, 200, 'Student login must return 200');
      assert.ok(sRes.data.token, 'Student response must include JWT token');
      assert.strictEqual(sRes.data.user.role, 'student');
      studentToken = sRes.data.token;

      // 3. Admin login
      const aRes = await httpRequest('/api/auth/login', {
        method: 'POST',
        body: { email: adminUser.email, password: testPassword }
      });
      assert.strictEqual(aRes.status, 200, 'Admin login must return 200');
      assert.ok(aRes.data.token, 'Admin response must include JWT token');
      assert.strictEqual(aRes.data.user.role, 'admin');
      adminToken = aRes.data.token;

      // 4. Verify /api/auth/me identity
      const meRes = await httpRequest('/api/auth/me', { token: teacherToken });
      assert.strictEqual(meRes.status, 200);
      assert.strictEqual(meRes.data.id, teacherUser.id);
    })();

    // -------------------------------------------------------------------------
    // Journey 2: Teacher Quiz Creation, Scheduling, & Publication
    // -------------------------------------------------------------------------
    await runTest('J2: Teacher creates quiz, updates schedule, and publishes to database', async () => {
      const quizPayload = {
        title: `Operating Systems Concurrency E2E ${timestamp}`,
        topic: 'Concurrency & Semaphores',
        difficulty: 'Medium',
        timerPerQuestion: 30,
        isAssessment: false,
        isActive: false,
        questions: [
          {
            question: 'What is the primary function of a counting semaphore in operating systems?',
            questionText: 'What is the primary function of a counting semaphore in operating systems?',
            options: [
              'To control access to a finite number of identical resources',
              'To allocate virtual memory page frames to threads',
              'To compile binary executables without runtime linking',
              'To terminate zombie processes in user space'
            ],
            correctAnswer: 'To control access to a finite number of identical resources',
            points: 10
          },
          {
            question: 'Which condition is NOT one of the four Coffman conditions required for deadlock?',
            questionText: 'Which condition is NOT one of the four Coffman conditions required for deadlock?',
            options: [
              'Mutual exclusion',
              'Preemption allowed by kernel priority',
              'Hold and wait',
              'Circular wait'
            ],
            correctAnswer: 'Preemption allowed by kernel priority',
            points: 10
          },
          {
            question: 'In Peterson algorithm for mutual exclusion, what does the turn variable determine?',
            questionText: 'In Peterson algorithm for mutual exclusion, what does the turn variable determine?',
            options: [
              'Which process is granted priority to enter the critical section',
              'The quantum duration allocated by the CPU scheduler',
              'The memory address offset for thread local storage',
              'The signal handler callback registered by the parent'
            ],
            correctAnswer: 'Which process is granted priority to enter the critical section',
            points: 10
          }
        ]
      };

      const createRes = await httpRequest('/api/quiz/create', {
        method: 'POST',
        token: teacherToken,
        body: quizPayload
      });
      assert.ok([200, 201].includes(createRes.status), `Quiz creation must succeed (got ${createRes.status})`);
      assert.ok(createRes.data.id || (createRes.data.quiz && createRes.data.quiz.id), 'Must return created quiz payload');
      createdQuizId = createRes.data.id || (createRes.data.quiz && createRes.data.quiz.id);
      assert.ok(createdQuizId, 'Must have valid quiz ID');

      // Verify quiz persisted in PostgreSQL
      const dbQuiz = await prisma.quiz.findUnique({ where: { id: createdQuizId } });
      assert.ok(dbQuiz, 'Quiz must exist in database');
      assert.strictEqual(dbQuiz.createdById, teacherUser.id);
      assert.strictEqual(dbQuiz.questions.length, 3);

      // Schedule quiz
      const schedRes = await httpRequest(`/api/quiz/${createdQuizId}/schedule`, {
        method: 'PATCH',
        token: teacherToken,
        body: {
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString()
        }
      });
      assert.strictEqual(schedRes.status, 200, 'Schedule update must succeed');

      // Publish quiz
      const pubRes = await httpRequest(`/api/quiz/publish/${createdQuizId}`, {
        method: 'PUT',
        token: teacherToken,
        body: { isPublished: true }
      });
      assert.strictEqual(pubRes.status, 200, 'Publish must succeed');

      const publishedDb = await prisma.quiz.findUnique({ where: { id: createdQuizId } });
      assert.strictEqual(publishedDb.isActive, true, 'Quiz must be active');
    })();

    // -------------------------------------------------------------------------
    // Journey 3: Quiz Assignment (Verifying Commit dddfe5b fix!)
    // -------------------------------------------------------------------------
    await runTest('J3: Teacher assigns quiz to student cohort via POST /api/quiz/assign/:id', async () => {
      const assignRes = await httpRequest(`/api/quiz/assign/${createdQuizId}`, {
        method: 'POST',
        token: teacherToken,
        body: {
          assignedGroups: [{ year: '2', branch: 'CSE', section: 'A' }],
          assignedStudents: [studentUser.id]
        }
      });

      assert.strictEqual(assignRes.status, 200, 'Assignment route must return 200');
      assert.ok(assignRes.data.msg.includes('assigned successfully'));

      // Verify in PostgreSQL that assignment fields were persisted
      const assignedDb = await prisma.quiz.findUnique({ where: { id: createdQuizId } });
      assert.ok(assignedDb.assignedStudents.includes(studentUser.id), 'Assigned students must include studentUser.id');
      assert.ok(Array.isArray(assignedDb.assignedGroups), 'Assigned groups must be an array');
      assert.strictEqual(assignedDb.assignedGroups[0].branch, 'CSE');
    })();

    // -------------------------------------------------------------------------
    // Journey 4: Student Discovery, Quiz Taking, Scoring, & Results Review
    // -------------------------------------------------------------------------
    await runTest('J4: Student discovers assigned quiz, submits answers, and receives graded result in DB', async () => {
      // 1. Discover available quizzes
      const availRes = await httpRequest('/api/quiz/available', { token: studentToken });
      assert.strictEqual(availRes.status, 200, 'Available quizzes route must return 200');
      const found = Array.isArray(availRes.data) && availRes.data.some(q => q.id === createdQuizId);
      assert.ok(found, 'Assigned quiz must appear in student available list');

      // 2. Fetch quiz questions
      const quizRes = await httpRequest(`/api/quiz/${createdQuizId}`, { token: studentToken });
      assert.strictEqual(quizRes.status, 200);
      assert.strictEqual(quizRes.data.questions.length, 3);

      // 3. Submit 2 correct answers and 1 incorrect answer
      const submitRes = await httpRequest('/api/quiz/submit', {
        method: 'POST',
        token: studentToken,
        body: {
          quizId: createdQuizId,
          answers: [
            {
              selectedOption: 'To control access to a finite number of identical resources',
              timeTaken: 8
            },
            {
              selectedOption: 'Preemption allowed by kernel priority',
              timeTaken: 12
            },
            {
              selectedOption: 'The memory address offset for thread local storage', // incorrect
              timeTaken: 6
            }
          ]
        }
      });

      assert.strictEqual(submitRes.status, 200, 'Quiz submission must return 200');
      assert.strictEqual(submitRes.data.score, 20, 'Score must be 20 points (2 of 3 correct)');
      assert.strictEqual(submitRes.data.totalQuestions, 3);
      assert.strictEqual(submitRes.data.status, 'completed');

      // 4. Verify in PostgreSQL that Result record exists
      const dbResult = await prisma.result.findUnique({
        where: {
          quizId_studentId: {
            quizId: createdQuizId,
            studentId: studentUser.id
          }
        }
      });
      assert.ok(dbResult, 'Result record must be stored in database');
      assert.strictEqual(dbResult.score, 20);
      assert.strictEqual(dbResult.status, 'completed');

      // 5. Review results via /api/quiz/result/:quizId
      const reviewRes = await httpRequest(`/api/quiz/result/${createdQuizId}`, { token: studentToken });
      assert.strictEqual(reviewRes.status, 200, 'Result review must return 200');
      assert.strictEqual(reviewRes.data.score, 20);
    })();

    // -------------------------------------------------------------------------
    // Journey 5: Admin User Suspension & Security Gate (Verifying Commit dddfe5b fix!)
    // -------------------------------------------------------------------------
    await runTest('J5: Admin suspends student via PATCH /api/admin/users/:id/suspend, immediately blocking session', async () => {
      // 1. Admin lists users
      const usersRes = await httpRequest('/api/admin/users', { token: adminToken });
      assert.strictEqual(usersRes.status, 200, 'Admin directory must return 200');

      // 2. Admin suspends student using PATCH method
      const suspendRes = await httpRequest(`/api/admin/users/${studentUser.id}/suspend`, {
        method: 'PATCH',
        token: adminToken
      });
      assert.strictEqual(suspendRes.status, 200, 'PATCH /users/:id/suspend must return 200');
      assert.strictEqual(suspendRes.data.isSuspended, true, 'isSuspended must become true');

      // 3. Verify in PostgreSQL that student is suspended and tokenVersion was bumped
      const suspendedStudentDb = await prisma.user.findUnique({ where: { id: studentUser.id } });
      assert.strictEqual(suspendedStudentDb.isSuspended, true);
      assert.ok(suspendedStudentDb.tokenVersion >= 1, 'tokenVersion must be incremented');

      // 4. Verify student is immediately denied access using previous JWT
      const blockedRes = await httpRequest('/api/quiz/available', { token: studentToken });
      assert.ok(
        blockedRes.status === 401 || blockedRes.status === 403,
        `Suspended student must be denied (got ${blockedRes.status})`
      );

      // 5. Admin reinstates student using PATCH method
      const reinstateRes = await httpRequest(`/api/admin/users/${studentUser.id}/suspend`, {
        method: 'PATCH',
        token: adminToken
      });
      assert.strictEqual(reinstateRes.status, 200, 'PATCH /users/:id/suspend reinstate must return 200');
      assert.strictEqual(reinstateRes.data.isSuspended, false, 'isSuspended must become false');

      const reinstatedDb = await prisma.user.findUnique({ where: { id: studentUser.id } });
      assert.strictEqual(reinstatedDb.isSuspended, false);
    })();

    // -------------------------------------------------------------------------
    // Journey 6: External Integration Safety (Gemini STT Fallback & Error Mapping)
    // -------------------------------------------------------------------------
    await runTest('J6: Gemini STT unconfigured fallback safely returns null without uncaught exception', async () => {
      // When GEMINI_API_KEY is unset or empty, transcribeChunkWithGemini must return null safely
      const origKey = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        const res = await transcribeChunkWithGemini('dummy_test.mp3');
        assert.strictEqual(res, null, 'Must safely return null when API key is missing');
      } finally {
        if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
      }

      // Verify resolveGenerationErrorCode handles provider rate limits accurately
      const rateLimitCode = resolveGenerationErrorCode(new Error('429 Too Many Requests'), null);
      assert.strictEqual(rateLimitCode, 'PROVIDER_RATE_LIMITED');

      const deficitCode = resolveGenerationErrorCode(new Error('insufficient lecture depth'), null);
      assert.strictEqual(deficitCode, 'INSUFFICIENT_EVIDENCE');
    })();

    console.log('\n======================================================================');
    console.log(`🎉 ALL ${passCount} BROWSER-TO-DATABASE E2E JOURNEYS PASSED WITH 100% SUCCESS!`);
    console.log('======================================================================\n');

  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up test artifacts from database and close server
    // -------------------------------------------------------------------------
    console.log('🧹 Cleaning up database test records...');
    try {
      const testUserIds = [teacherUser?.id, studentUser?.id, adminUser?.id].filter(Boolean);
      if (testUserIds.length > 0) {
        await prisma.teacherFeedback.deleteMany({ where: { teacherId: { in: testUserIds } } }).catch(() => {});
        await prisma.pointTransaction.deleteMany({ where: { studentId: { in: testUserIds } } }).catch(() => {});
        await prisma.result.deleteMany({ where: { OR: [{ studentId: { in: testUserIds } }, { quiz: { createdById: { in: testUserIds } } }] } }).catch(() => {});
        await prisma.quiz.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
      }
      console.log('✅ Database records cleaned up cleanly.');
    } catch (cleanupErr) {
      console.warn('⚠️ Cleanup note:', cleanupErr.message);
    }

    if (httpServer) {
      await new Promise(r => httpServer.close(r));
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
