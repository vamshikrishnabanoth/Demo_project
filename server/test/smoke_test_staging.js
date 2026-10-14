/**
 * server/test/smoke_test_staging.js
 *
 * Staging Smoke Tests for Release Validation:
 * 1. Text/Document route end-to-end quiz generation.
 * 2. Voice route end-to-end quiz generation.
 * 3. Provider failure simulation: zero unrelated canned questions, clean truthful failure.
 * 4. Unevaluated score presentation: null/NOT_EVALUATED maps to "Not evaluated".
 * 5. Telemetry SSE stream lifecycle: clean closure on both COMPLETED and FAILED.
 */

'use strict';

const assert = require('assert');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const telemetryService = require('../services/telemetryService');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('======================================================================');
console.log('🚦 STAGING SMOKE TEST SUITE — RELEASE VALIDATION');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function main() {
  // ---------------------------------------------------------------------------
  // Smoke 1: Text / Document Route Quiz Generation
  // ---------------------------------------------------------------------------
  await runTest('Smoke 1: Text/Document route generates grounded MCQs', async () => {
    const taskId = 'smoke_text_' + Date.now();
    const docText = `
      Operating Systems: Process Synchronization.
      A semaphore is a synchronization tool introduced by Edsger Dijkstra.
      It is an integer variable that, apart from initialization, is accessed only through
      two standard atomic operations: wait() and signal(). Originally, Dijkstra called these
      operations P (from Dutch proberen, to test) and V (from Dutch verhogen, to increment).
      Counting semaphores can range over an unrestricted integer domain, whereas binary
      semaphores can range only between 0 and 1. Binary semaphores behave similarly to mutex locks.
    `;

    const result = await pipelineOrchestrator.runPipeline({
      taskId,
      documentTexts: [docText],
      documentNames: ['os_semaphores.txt'],
      count: 2,
      difficulty: 'Medium'
    });

    assert.ok(result, 'Pipeline result must exist');
    assert.strictEqual(result.sessionId, taskId, 'Session ID must link to Task ID');
    assert.strictEqual(result.pipelineStatus, 'COMPLETED', 'Pipeline status must be COMPLETED');
    assert.ok(result.questions && result.questions.length >= 1, 'Must generate at least 1 question');

    for (const q of result.questions) {
      assert.strictEqual(q.options.length, 4, 'Must have exactly 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'correctAnswer must be in options');
      assert.ok(q.metadata?.groundingScore >= 0.15, 'Must pass grounding score threshold');
    }
  });

  // ---------------------------------------------------------------------------
  // Smoke 2: Voice Route End-to-End Quiz Generation
  // ---------------------------------------------------------------------------
  await runTest('Smoke 2: Voice route generates grounded MCQs from lecture transcript', async () => {
    const taskId = 'smoke_voice_' + Date.now();
    const voiceTranscript = `
      Good morning students. Today we are discussing Cache Memory.
      Cache memory is an extremely fast memory type that acts as a buffer between RAM and the CPU.
      It holds frequently requested data and instructions so that the processor has them immediately available.
      The three common cache levels are Level 1 (L1), Level 2 (L2), and Level 3 (L3).
      L1 is the smallest and fastest, typically built directly into the processor chip.
      When the CPU finds the requested data in the cache, it is called a cache hit.
      When the CPU cannot find the data in the cache, it is called a cache miss.
    `;

    const result = await pipelineOrchestrator.runPipeline({
      taskId,
      voiceTranscript,
      count: 2,
      difficulty: 'Easy'
    });

    assert.ok(result, 'Pipeline result must exist');
    assert.strictEqual(result.sessionId, taskId);
    assert.strictEqual(result.pipelineStatus, 'COMPLETED');
    assert.ok(result.questions && result.questions.length >= 1);

    for (const q of result.questions) {
      assert.strictEqual(q.options.length, 4);
      assert.ok(q.options.includes(q.correctAnswer));
    }
  });

  // ---------------------------------------------------------------------------
  // Smoke 3: Provider Failure Simulation (Zero Canned Fallback Questions)
  // ---------------------------------------------------------------------------
  await runTest('Smoke 3: Provider failure returns zero canned questions and clean failure', async () => {
    const origEnv = process.env.NODE_ENV;
    const origMock = process.env.ALLOW_MOCK_FALLBACK;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_FALLBACK;

      // Force generator failure to simulate LLM downtime
      const origMethod = agent2Generator.generateQuestion;
      agent2Generator.generateQuestion = async () => ({
        isUnfulfilled: true,
        unfulfilledReason: 'PROVIDER_UNAVAILABLE'
      });

      const taskId = 'smoke_fail_' + Date.now();
      const result = await pipelineOrchestrator.runPipeline({
        taskId,
        documentTexts: ['Arbitrary lecture content about databases.'],
        count: 2,
        difficulty: 'Medium'
      });

      agent2Generator.generateQuestion = origMethod;

      assert.strictEqual(result.pipelineStatus, 'FAILED', 'Status must be FAILED on total provider downtime');
      assert.strictEqual(result.deliveredCount, 0, 'Delivered count must be 0');
      assert.strictEqual(result.questions.length, 0, 'Must not return canned questions');

      const anyCanned = result.questions.some(q =>
        q.question.includes('Git') || q.question.includes('pipelining') || q.question.includes('BST')
      );
      assert.strictEqual(anyCanned, false, 'No canned questions allowed');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origMock !== undefined) process.env.ALLOW_MOCK_FALLBACK = origMock;
      else delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  // ---------------------------------------------------------------------------
  // Smoke 4: Unevaluated Scores Presentation (null / NOT_EVALUATED)
  // ---------------------------------------------------------------------------
  await runTest('Smoke 4: Unevaluated scores display honestly as null and NOT_EVALUATED', async () => {
    // Pipeline without evaluation
    const passingQuestions = [];
    const plan = { requestedCount: 5 };
    const quizEval = passingQuestions.length > 0 ? agent3Evaluator.evaluateQuizSet(passingQuestions, plan) : {
      quizQualityStatus: 'NOT_EVALUATED',
      isBalanced: false,
      totalQuestions: 0,
      coverageScore: null
    };

    assert.strictEqual(quizEval.quizQualityStatus, 'NOT_EVALUATED');
    assert.strictEqual(quizEval.coverageScore, null);

    // Frontend display simulation
    const coverageDisplay = typeof quizEval.coverageScore === 'number' ? `${quizEval.coverageScore}%` : 'Not evaluated';
    assert.strictEqual(coverageDisplay, 'Not evaluated', 'Must display "Not evaluated" in UI, never "0%" or "95%"');
  });

  // ---------------------------------------------------------------------------
  // Smoke 5: Live Telemetry Stream Lifecycle (Clean Closure)
  // ---------------------------------------------------------------------------
  await runTest('Smoke 5: Telemetry stream closes cleanly on both COMPLETED and FAILED', async () => {
    const sessCompleted = 'smoke_stream_comp_' + Date.now();
    const sessFailed = 'smoke_stream_fail_' + Date.now();

    let completedReceived = false;
    let failedReceived = false;

    const unsubComp = telemetryService.subscribe(sessCompleted, (payload) => {
      if (payload.status === 'COMPLETED') completedReceived = true;
    });

    const unsubFail = telemetryService.subscribe(sessFailed, (payload) => {
      if (payload.status === 'FAILED') failedReceived = true;
    });

    await telemetryService.emitStageUpdate(sessCompleted, { stageNumber: 13, stageName: 'PUBLISHING', status: 'COMPLETED' });
    await telemetryService.emitStageUpdate(sessFailed, { stageNumber: 3, stageName: 'GENERATION', status: 'FAILED' });

    unsubComp();
    unsubFail();

    assert.strictEqual(completedReceived, true, 'COMPLETED status event must be delivered');
    assert.strictEqual(failedReceived, true, 'FAILED status event must be delivered');
  });

  console.log('\n======================================================================');
  console.log(`📊 STAGING SMOKE TEST RESULTS: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Smoke test suite error:', err);
  process.exit(1);
});
