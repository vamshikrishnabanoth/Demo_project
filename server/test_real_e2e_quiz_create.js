/**
 * server/test_real_e2e_quiz_create.js
 *
 * MANDATORY REAL END-TO-END VERIFICATION SUITE
 * 
 * Rules:
 * - Does NOT mock the controller or pipeline components.
 * - Submits real HTTP requests to the actual /api/quiz/create endpoint.
 * - Verifies that a valid, grounded MCQ is returned for each supported document type.
 * - Verifies controlled failure (INSUFFICIENT_READABLE_EVIDENCE) for unreadable documents.
 * 
 * Test Cases:
 * 1. Normal Text PDF (ANN vs CNN lecture document)
 * 2. Word Document (.docx) with Tabular Comparison (B-Tree vs Hash Indexing)
 * 3. Scanned Image Document (OCR Paging & Memory Management)
 * 4. Raw Text / Topic (Deadlock Conditions)
 * 5. Unreadable / Corrupt Document (Controlled Failure verification)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const prisma = require('./lib/prisma');

async function runRealE2EVerification() {
  console.log('======================================================================');
  console.log('🧪 MANDATORY REAL END-TO-END TEST SUITE: /api/quiz/create');
  console.log('======================================================================\n');

  // 1. Resolve teacher credentials for auth
  const teacher = await prisma.user.findFirst({
    where: { role: 'teacher' }
  });

  if (!teacher) {
    throw new Error('No teacher user found in database for E2E testing.');
  }

  const token = jwt.sign(
    {
      user: {
        id: teacher.id,
        role: teacher.role,
        email: teacher.email,
        tokenVersion: teacher.tokenVersion
      }
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log(`🔑 Authenticated E2E test session for teacher: ${teacher.email} (${teacher.id})\n`);

  // 2. Launch Dedicated Express Server on ephemeral port
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Mount real quiz routes
  app.use('/api/quiz', require('./routes/quiz'));

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error during E2E test:', err);
    res.status(500).json({ msg: err.message, code: err.code || 'SERVER_ERROR' });
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 In-Process Test Server listening at ${baseUrl}\n`);

  // Unique suffix so reruns never collide with previously created quizzes
  const RUN_ID = Date.now();

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    console.log(`----------------------------------------------------------------------`);
    console.log(`▶ RUNNING TEST [${total}]: ${name}`);
    console.log(`----------------------------------------------------------------------`);
    const start = Date.now();
    try {
      await fn();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ PASS [${total}]: ${name} (${elapsed}s)\n`);
      passed++;
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`❌ FAIL [${total}]: ${name} (${elapsed}s)`);
      if (err.response) {
        console.error('HTTP Response Status:', err.response.status);
        console.error('HTTP Response Data:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.error(err.message);
      }
      console.log('\n');
    }
  }

  try {
    // ── TEST 1: Normal Text PDF ──
    await testCase('Real Normal Text PDF Upload -> /api/quiz/create -> Grounded MCQ', async () => {
      const pdfPath = 'C:\\Users\\Akshitha\\CNN_exam\\CNN_exam\\theory\\SKILLING-MODULE2-SESSION1-ANN VS CNN.pdf';
      assert.ok(fs.existsSync(pdfPath), `Test PDF file must exist at ${pdfPath}`);

      const form = new FormData();
      form.append('title', `CNN vs ANN Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('timerPerQuestion', '30');
      form.append('file', fs.createReadStream(pdfPath), {
        filename: 'ANN_vs_CNN.pdf',
        contentType: 'application/pdf'
      });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: {
          ...form.getHeaders(),
          'x-auth-token': token
        },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status), `Expected status 200 or 201, got ${res.status}`);
      assert.ok(res.data, 'Response should contain data');
      
      const quiz = res.data.quiz || res.data;
      const questions = quiz.questions || [];
      assert.ok(questions.length >= 1, `Expected at least 1 question, got ${questions.length}`);

      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);

      assert.ok(q.questionText || q.question, 'Question text must be non-empty');
      assert.strictEqual((q.options || []).length, 4, 'Must have exactly 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'Correct answer must match one of the 4 options verbatim');
    });

    // ── TEST 2: Word Document (.docx) with Table ──
    await testCase('Real Word Document (.docx with Table) Upload -> /api/quiz/create -> Grounded MCQ', async () => {
      const docxPath = path.join(__dirname, 'test_materials', 'academic_table.docx');
      assert.ok(fs.existsSync(docxPath), `Test DOCX must exist at ${docxPath}`);

      const form = new FormData();
      form.append('title', `Database Indexing Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(docxPath), {
        filename: 'academic_table.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: {
          ...form.getHeaders(),
          'x-auth-token': token
        },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status), `Expected status 200 or 201, got ${res.status}`);
      const quiz = res.data.quiz || res.data;
      const questions = quiz.questions || [];
      assert.ok(questions.length >= 1, `Expected at least 1 question, got ${questions.length}`);

      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);

      assert.ok(q.questionText || q.question, 'Question text must be non-empty');
      assert.strictEqual((q.options || []).length, 4, 'Must have exactly 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'Correct answer must match one of the 4 options verbatim');
    });

    // ── TEST 3: Scanned / OCR Document (Image with Text) ──
    await testCase('Real Scanned Document (Image OCR) Upload -> /api/quiz/create -> Grounded MCQ', async () => {
      const imgPath = path.join(__dirname, 'test_materials', 'scanned_paging.png');
      assert.ok(fs.existsSync(imgPath), `Test image must exist at ${imgPath}`);

      const form = new FormData();
      form.append('title', `OS Paging Architecture Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(imgPath), {
        filename: 'scanned_paging.png',
        contentType: 'image/png'
      });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: {
          ...form.getHeaders(),
          'x-auth-token': token
        },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status), `Expected status 200 or 201, got ${res.status}`);
      const quiz = res.data.quiz || res.data;
      const questions = quiz.questions || [];
      assert.ok(questions.length >= 1, `Expected at least 1 question, got ${questions.length}`);

      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);

      assert.ok(q.questionText || q.question, 'Question text must be non-empty');
      assert.strictEqual((q.options || []).length, 4, 'Must have exactly 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'Correct answer must match one of the 4 options verbatim');
    });

    // ── TEST 4: Raw Text / Topic Input ──
    await testCase('Raw Text / Topic -> /api/quiz/create -> Grounded MCQ', async () => {
      const payload = {
        title: `Deadlock Conditions Quiz ${RUN_ID}`,
        topic: 'Operating Systems Deadlock: The four Coffman conditions necessary for deadlock are mutual exclusion, hold and wait, no preemption, and circular wait. Preventing any one of these conditions avoids system deadlocks.',
        questionCount: 1,
        difficulty: 'Medium'
      };

      const res = await axios.post(`${baseUrl}/api/quiz/create`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status), `Expected status 200 or 201, got ${res.status}`);
      const quiz = res.data.quiz || res.data;
      const questions = quiz.questions || [];
      assert.ok(questions.length >= 1, `Expected at least 1 question, got ${questions.length}`);

      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);

      assert.ok(q.questionText || q.question, 'Question text must be non-empty');
      assert.strictEqual((q.options || []).length, 4, 'Must have exactly 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'Correct answer must match one of the 4 options verbatim');
    });

    // ── TEST 5: Unreadable / Corrupt Document -> Controlled Failure ──
    await testCase('Unreadable / Blank Document Upload -> Controlled Failure (INSUFFICIENT_READABLE_EVIDENCE)', async () => {
      const emptyPdfPath = path.join(__dirname, 'test_materials', 'blank_corrupt.pdf');
      assert.ok(fs.existsSync(emptyPdfPath), `Test blank PDF must exist at ${emptyPdfPath}`);

      const form = new FormData();
      form.append('title', `Blank Corrupt Upload ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(emptyPdfPath), {
        filename: 'blank_corrupt.pdf',
        contentType: 'application/pdf'
      });

      try {
        const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
          headers: {
            ...form.getHeaders(),
            'x-auth-token': token
          },
          timeout: 60000
        });

        // If it succeeded, it fabricated content on a blank document!
        assert.fail(`Expected HTTP 400 with INSUFFICIENT_READABLE_EVIDENCE, but request succeeded with status ${res.status}`);
      } catch (err) {
        assert.ok(err.response, `Expected HTTP error response, got: ${err.message}`);
        console.log('   Received expected HTTP status:', err.response.status);
        console.log('   Response message:', err.response.data?.msg || err.response.data?.message);
        console.log('   Response code:', err.response.data?.code);

        assert.strictEqual(err.response.status, 400, 'Must return HTTP 400 for unreadable document');
        assert.strictEqual(err.response.data?.code, 'INSUFFICIENT_READABLE_EVIDENCE', 'Must return INSUFFICIENT_READABLE_EVIDENCE error code');
      }
    });

  } finally {
    server.close();
  }

  console.log('======================================================================');
  console.log(`📊 REAL E2E TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('======================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRealE2EVerification()
    .then(() => {
      console.log('🎉 All E2E verification tests successfully finished!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal E2E error:', err);
      process.exit(1);
    });
}

module.exports = { runRealE2EVerification };
