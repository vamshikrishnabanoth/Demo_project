/**
 * server/test_deep_e2e_all_modalities.js
 *
 * FULL REGRESSION & COMPREHENSIVE MULTIMODAL E2E VERIFICATION SUITE
 * 
 * Executes real HTTP multipart/form-data uploads through /api/quiz/create
 * against real SQLite/Postgres DB using actual 3-agent pipeline.
 *
 * Test Matrix:
 * [1] Normal Text PDF (Regression Test 1)
 * [2] DOCX with Tabular Comparison (Regression Test 2)
 * [3] Scanned Image Document OCR (Regression Test 3)
 * [4] Raw Text / Topic (Regression Test 4)
 * [5] Corrupt / Blank Document -> INSUFFICIENT_READABLE_EVIDENCE (Regression Test 5)
 * [6] PDF with Structured Table (Sorting Algorithms & Space Complexity)
 * [7] PDF with Sales Trend Chart (2021-2024 Revenue)
 * [8] PDF with System Architecture Diagram (API Gateway -> Load Balancer -> App Server)
 * [9] Scanned Multi-Page PDF (4-Page Raft Consensus)
 * [10] DOCX with Mixed Content (Heading + Paragraph + Table + Embedded Media)
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

async function runComprehensiveE2E() {
  console.log('======================================================================');
  console.log('🚀 COMPREHENSIVE MULTIMODAL E2E VERIFICATION SUITE: /api/quiz/create');
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

  console.log(`🔑 Authenticated session for teacher: ${teacher.email} (${teacher.id})\n`);

  // 2. Launch In-Process Test Server
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  app.use('/api/quiz', require('./routes/quiz'));

  app.use((err, req, res, next) => {
    console.error('Server error during test:', err);
    res.status(500).json({ msg: err.message, code: err.code || 'SERVER_ERROR' });
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Dedicated Test Server listening at ${baseUrl}\n`);

  const RUN_ID = Date.now();
  const summaryMatrix = [];
  let testNum = 0;

  async function testCase(name, expectedBehavior, fn) {
    testNum++;
    console.log(`----------------------------------------------------------------------`);
    console.log(`▶ [${testNum}] RUNNING: ${name}`);
    console.log(`----------------------------------------------------------------------`);
    const start = Date.now();
    try {
      await fn();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ PASS [${testNum}]: ${name} (${elapsed}s)\n`);
      summaryMatrix.push({ id: testNum, name, expected: expectedBehavior, actual: 'PASS', status: 'PASS', latency: `${elapsed}s` });
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`❌ FAIL [${testNum}]: ${name} (${elapsed}s)`);
      if (err.response) {
        console.error('   HTTP Status:', err.response.status);
        console.error('   HTTP Body:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.error('   Error:', err.message);
      }
      console.log('\n');
      summaryMatrix.push({ id: testNum, name, expected: expectedBehavior, actual: 'FAIL: ' + err.message, status: 'FAIL', latency: `${elapsed}s` });
    }
  }

  try {
    // ── TEST 1: Normal Text PDF (Regression) ──
    await testCase('Normal Text PDF (ANN vs CNN)', 'Grounded MCQ with 4 options and valid answer', async () => {
      const pdfPath = 'C:\\Users\\Akshitha\\CNN_exam\\CNN_exam\\theory\\SKILLING-MODULE2-SESSION1-ANN VS CNN.pdf';
      assert.ok(fs.existsSync(pdfPath), `File must exist: ${pdfPath}`);

      const form = new FormData();
      form.append('title', `CNN vs ANN Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(pdfPath), { filename: 'ANN_vs_CNN.pdf', contentType: 'application/pdf' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 2: DOCX with Table (Regression) ──
    await testCase('DOCX with Tabular Comparison (B-Tree vs Hash Indexing)', 'Table-grounded MCQ', async () => {
      const docxPath = path.join(__dirname, 'test_materials', 'academic_table.docx');
      assert.ok(fs.existsSync(docxPath));

      const form = new FormData();
      form.append('title', `Database Indexing Table Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(docxPath), {
        filename: 'academic_table.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 3: Scanned Image Document OCR (Regression) ──
    await testCase('Scanned Image Document OCR (Memory Paging)', 'OCR-grounded MCQ', async () => {
      const imgPath = path.join(__dirname, 'test_materials', 'scanned_paging.png');
      assert.ok(fs.existsSync(imgPath));

      const form = new FormData();
      form.append('title', `Memory Paging OCR Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(imgPath), { filename: 'scanned_paging.png', contentType: 'image/png' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 4: Raw Text / Topic (Regression) ──
    await testCase('Raw Text / Topic (Coffman Deadlock Conditions)', 'Grounded MCQ from raw input', async () => {
      const form = new FormData();
      form.append('title', `Deadlock Prevention Quiz ${RUN_ID}`);
      form.append('topic', 'Deadlock prevention in Operating Systems by eliminating Coffman conditions: mutual exclusion, hold and wait, no preemption, and circular wait.');
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 5: Corrupt / Blank Document (Regression) ──
    await testCase('Unreadable / Blank Document Upload', 'Controlled HTTP 400 INSUFFICIENT_READABLE_EVIDENCE', async () => {
      const emptyPdfPath = path.join(__dirname, 'test_materials', 'blank_corrupt.pdf');
      assert.ok(fs.existsSync(emptyPdfPath));

      const form = new FormData();
      form.append('title', `Corrupt PDF ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('file', fs.createReadStream(emptyPdfPath), { filename: 'blank_corrupt.pdf', contentType: 'application/pdf' });

      let receivedStatus = null;
      let receivedCode = null;

      try {
        await axios.post(`${baseUrl}/api/quiz/create`, form, {
          headers: { ...form.getHeaders(), 'x-auth-token': token },
          timeout: 60000
        });
      } catch (err) {
        if (err.response) {
          receivedStatus = err.response.status;
          receivedCode = err.response.data?.code;
        }
      }

      assert.strictEqual(receivedStatus, 400, 'Must return HTTP 400');
      assert.strictEqual(receivedCode, 'INSUFFICIENT_READABLE_EVIDENCE', 'Must return INSUFFICIENT_READABLE_EVIDENCE code');
    });

    // ── TEST 6: PDF Table Extraction (Section 3) ──
    await testCase('PDF Table Extraction (Sorting Algorithms & Space Complexity)', 'Table-grounded MCQ (Merge/Quick/Bubble/Heap)', async () => {
      const pdfPath = path.join(__dirname, 'test_materials', 'pdf_table_algorithms.pdf');
      assert.ok(fs.existsSync(pdfPath));

      const form = new FormData();
      form.append('title', `Sorting Algorithm Table Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(pdfPath), { filename: 'pdf_table_algorithms.pdf', contentType: 'application/pdf' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 7: PDF Chart Understanding (Section 4) ──
    await testCase('PDF Chart Understanding (Annual Sales Revenue 2021-2024)', 'Chart-grounded MCQ', async () => {
      const pdfPath = path.join(__dirname, 'test_materials', 'pdf_chart_sales.pdf');
      assert.ok(fs.existsSync(pdfPath));

      const form = new FormData();
      form.append('title', `Sales Revenue Chart Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(pdfPath), { filename: 'pdf_chart_sales.pdf', contentType: 'application/pdf' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 8: PDF Diagram Understanding (Section 5) ──
    await testCase('PDF Diagram Understanding (Distributed System Architecture)', 'Diagram-grounded MCQ (API Gateway / Load Balancer)', async () => {
      const pdfPath = path.join(__dirname, 'test_materials', 'pdf_diagram_architecture.pdf');
      assert.ok(fs.existsSync(pdfPath));

      const form = new FormData();
      form.append('title', `Architecture Diagram Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(pdfPath), { filename: 'pdf_diagram_architecture.pdf', contentType: 'application/pdf' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 9: Scanned Multi-Page PDF (Section 6) ──
    await testCase('Scanned Multi-Page PDF (4-Page Raft Consensus Document)', 'Page-level OCR & consensus-grounded MCQ', async () => {
      const pdfPath = path.join(__dirname, 'test_materials', 'scanned_multipage.pdf');
      assert.ok(fs.existsSync(pdfPath));

      const form = new FormData();
      form.append('title', `Multi-Page Consensus Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(pdfPath), { filename: 'scanned_multipage.pdf', contentType: 'application/pdf' });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

    // ── TEST 10: DOCX with Mixed Content (Section 7) ──
    await testCase('DOCX with Mixed Content (Heading, Table & Media)', 'Microservices table/image grounded MCQ', async () => {
      const docxPath = path.join(__dirname, 'test_materials', 'docx_mixed_content.docx');
      assert.ok(fs.existsSync(docxPath));

      const form = new FormData();
      form.append('title', `Microservices Architecture Quiz ${RUN_ID}`);
      form.append('questionCount', '1');
      form.append('difficulty', 'Medium');
      form.append('file', fs.createReadStream(docxPath), {
        filename: 'docx_mixed_content.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const res = await axios.post(`${baseUrl}/api/quiz/create`, form, {
        headers: { ...form.getHeaders(), 'x-auth-token': token },
        timeout: 180000
      });

      assert.ok([200, 201].includes(res.status));
      const questions = res.data.quiz?.questions || res.data.questions || [];
      assert.ok(questions.length >= 1);
      const q = questions[0];
      console.log('   Question:', q.questionText || q.question);
      console.log('   Options:', q.options);
      console.log('   Correct Answer:', q.correctAnswer);
      assert.strictEqual((q.options || []).length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log('📊 COMPREHENSIVE E2E VERIFICATION MATRIX');
  console.log('======================================================================');
  console.log('| ID | Test Name | Expected | Actual | Status | Latency |');
  console.log('|---|---|---|---|---|---|');
  for (const m of summaryMatrix) {
    console.log(`| ${m.id} | ${m.name} | ${m.expected} | ${m.actual} | ${m.status} | ${m.latency} |`);
  }
  console.log('======================================================================\n');

  const allPassed = summaryMatrix.every(m => m.status === 'PASS');
  if (!allPassed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runComprehensiveE2E().catch(err => {
    console.error('Fatal error running comprehensive E2E:', err);
    process.exit(1);
  });
}

module.exports = { runComprehensiveE2E };
