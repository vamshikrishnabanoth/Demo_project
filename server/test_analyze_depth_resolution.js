/**
 * server/test_analyze_depth_resolution.js
 *
 * Dedicated verification test suite for Phase 1.2:
 * Tests that analyzeDepth:
 * 1. Uses depthAnalyzer deterministically (<5ms, zero LLM timeouts).
 * 2. Extracts real concepts from transcript into keyTopics and whatWasTaught.
 * 3. Never produces filename junk (e.g. 'WT 18-8-26.m4a Principles').
 * 4. Correctly handles:
 *    a. Valid academic transcript
 *    b. Short transcript (<15 chars)
 *    c. Non-academic transcript (administrative / casual chatter)
 *    d. Transcript with no detectable concepts
 *    e. Filename containing dates/extensions
 */

'use strict';

const assert = require('assert');
const quizController = require('./controllers/quizController');

// Mock Express req/res
function createMockContext(body) {
  return new Promise((resolve) => {
    const req = { body };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        resolve({ statusCode: this.statusCode || 200, data });
      }
    };
    quizController.analyzeDepth(req, res);
  });
}

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log(' 🧪 ANALYZEDEPTH DETERMINISTIC OVERVIEW TEST SUITE (PHASE 1.2)');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function runCase(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(` ✅ PASS [${totalTests}]: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(` ❌ FAIL [${totalTests}]: ${name}`);
      console.error(`    Error: ${err.message}\n`);
    }
  }

  // ── CASE A: Valid Academic Transcript ──
  await runCase('Case A: Valid academic transcript yields real concepts without filename pollution', async () => {
    const text = `
      Today we explore Round Robin CPU scheduling. Round Robin is a preemptive scheduling algorithm
      where each process is given a fixed time slice or time quantum. When the time quantum expires,
      an interrupt occurs and the operating system performs a context switch, placing the process
      at the tail of the ready queue.
    `;
    const title = 'WT 18-8-26.m4a';

    const t0 = Date.now();
    const { statusCode, data } = await createMockContext({ text, title });
    const duration = Date.now() - t0;

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(data.isAcademic, true);
    assert.ok(duration < 100, `Execution should be instantaneous (<100ms), took ${duration}ms`);

    // Verify keyTopics are from the transcript, NOT the filename
    assert.ok(Array.isArray(data.keyTopics) && data.keyTopics.length > 0, 'keyTopics must be non-empty');
    assert.ok(
      !data.keyTopics.some(t => t.toLowerCase().includes('.m4a') || t.toLowerCase().includes('18-8-26')),
      'keyTopics MUST NOT contain raw filename or date tokens'
    );
    assert.ok(
      data.keyTopics.some(t => t.toLowerCase().includes('round robin') || t.toLowerCase().includes('quantum') || t.toLowerCase().includes('scheduling')),
      `keyTopics must contain actual academic concepts: ${JSON.stringify(data.keyTopics)}`
    );

    // Verify whatWasTaught describes the real material
    assert.ok(
      !data.whatWasTaught.toLowerCase().includes('wt 18-8-26.m4a'),
      'whatWasTaught MUST NOT echo the raw filename'
    );
    assert.ok(data.whatWasTaught.length > 20, 'whatWasTaught must be an informative summary');
  });

  // ── CASE B: Short Transcript (<15 chars) ──
  await runCase('Case B: Short transcript is correctly classified non-academic with empty overview', async () => {
    const text = 'Hello class.';
    const title = 'Lecture_01.mp3';

    const { statusCode, data } = await createMockContext({ text, title });
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(data.isAcademic, false);
    assert.strictEqual(data.reason, 'INSUFFICIENT_CONTENT');
    assert.strictEqual(data.whatWasTaught, '', 'whatWasTaught must be empty for short non-academic text');
    assert.deepStrictEqual(data.keyTopics, [], 'keyTopics must be empty for non-academic text');
  });

  // ── CASE C: Non-Academic Transcript (Administrative / Casual Chatter) ──
  await runCase('Case C: Administrative chatter is flagged non-academic with no fake academic topics', async () => {
    const text = `
      Please close your laptops and be quiet in the back benches.
      Roll numbers 1 to 40, please stand up and collect your hall tickets.
      The mid-term examination will be held next Tuesday. Make sure you bring your identity cards.
    `;
    const title = 'Class_Notice.mp3';

    const { statusCode, data } = await createMockContext({ text, title });
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(data.isAcademic, false);
    assert.ok(data.reason && data.reason.includes('INSUFFICIENT_CURRICULAR_CONTENT'));
    assert.strictEqual(data.whatWasTaught, '');
    assert.deepStrictEqual(data.keyTopics, []);
  });

  // ── CASE D: Transcript with No Detectable Concepts (Generic Curricular Words) ──
  await runCase('Case D: Transcript with generic concepts falls back gracefully without filename leakage', async () => {
    const text = `
      First, we initialize the structure. Then we compute the values step by step.
      After that, the function evaluates the input, transforms the parameters, and returns the result.
      This process continues until all elements have been handled in order.
    `;
    const title = '18-08-2024_session_recording.wav';

    const { statusCode, data } = await createMockContext({ text, title });
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(data.isAcademic, true);
    assert.ok(Array.isArray(data.keyTopics) && data.keyTopics.length > 0);
    assert.ok(
      !data.keyTopics.some(t => t.includes('.wav') || t.includes('18-08-2024') || t.includes('session_recording')),
      'keyTopics MUST NOT contain raw filename or date tokens'
    );
    assert.ok(
      !data.whatWasTaught.includes('.wav') && !data.whatWasTaught.includes('18-08-2024'),
      'whatWasTaught must not contain raw filename or date tokens'
    );
  });

  // ── CASE E: Filename Containing Dates, Prefixes, and Extensions ──
  await runCase('Case E: Raw noisy filenames are sanitized and never override valid transcript concepts', async () => {
    const text = `
      Virtual memory uses paging to manage processes. A page fault occurs when an address is referenced
      outside physical RAM. The operating system kernel allocates available page frames dynamically.
    `;
    const title = 'Y2Mate.is - Operating_Systems_Lecture_05_2024-03-15.mp3';

    const { statusCode, data } = await createMockContext({ text, title });
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(data.isAcademic, true);

    // keyTopics must reflect Virtual Memory / Paging concepts
    assert.ok(
      data.keyTopics.some(t => t.toLowerCase().includes('page') || t.toLowerCase().includes('memory') || t.toLowerCase().includes('virtual')),
      `keyTopics must reflect transcript concepts: ${JSON.stringify(data.keyTopics)}`
    );

    // Neither keyTopics nor whatWasTaught should have Y2Mate or .mp3 or date
    assert.ok(!data.whatWasTaught.includes('Y2Mate'));
    assert.ok(!data.whatWasTaught.includes('.mp3'));
    assert.ok(!data.whatWasTaught.includes('2024-03-15'));
  });

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
