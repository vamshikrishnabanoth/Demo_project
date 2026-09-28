/**
 * server/test_agent3_evaluator_truthfulness.js
 *
 * Dedicated verification test suite for Phase 1.1:
 * Verifies that Agent 3 evaluator:
 * 1. Correctly handles normal successful LLM evaluations.
 * 2. Enforces hard rejections for UNSUPPORTED_FOREIGN and low answerability prerequisites.
 * 3. Never returns a fake PASS with fabricated 0.90 groundingScore when LLM fails.
 * 4. Transparently engages deterministic lexical fallback, reporting real matchRatio and UNAUDITED_HEURISTIC_FALLBACK.
 * 5. Rejects candidate questions with zero or insufficient evidence overlap when LLM is unavailable.
 * 6. Handles malformed/invalid LLM outputs gracefully into deterministic fallback.
 * 7. Confirms that a failed LLM evaluation can NEVER appear as a normal PASS with a fabricated confidence score.
 */

'use strict';

const assert = require('assert');
const agent3Evaluator = require('./engine/agents/agent3Evaluator');
const llmRouter = require('./engine/adapter/llmRouter');

// Sample test targets and evidence
const sampleTarget = {
  targetId: 'target_cpu_01',
  concept: 'Round Robin Scheduling',
  subtopic: 'Time Quantum Preemption',
  dimension: 'Conceptual',
  targetDifficulty: 'Medium'
};

const sampleEvidencePackage = {
  sessionId: 'test_sess_truthfulness',
  evidenceDepth: { rating: 'COMPREHENSIVE', depthScore: 85 },
  unifiedRawContent: `
    Round Robin is a CPU scheduling algorithm where each process is assigned a fixed time slot or time quantum.
    Once the time quantum expires, the operating system preempts the running process and moves it to the back of the ready queue.
    Context switching overhead increases if the time quantum is made extremely small.
  `
};

const groundedMCQ = {
  questionText: 'What occurs when the assigned time quantum expires in Round Robin CPU scheduling?',
  options: [
    'The process is preempted and moved to the ready queue',
    'The process is immediately terminated by the kernel',
    'The process is placed in the I/O waiting state indefinitely',
    'The CPU enters an idle power-saving cycle'
  ],
  correctAnswer: 'The process is preempted and moved to the ready queue'
};

const foreignUngroundedMCQ = {
  questionText: 'Which query uses the $lookup operator to perform a left outer join in MongoDB?',
  options: [
    'db.orders.aggregate([ { $lookup: { from: "inventory" } } ])',
    'db.users.find({ status: "active" })',
    'SELECT * FROM orders LEFT JOIN inventory',
    'MATCH (n:User) RETURN n'
  ],
  correctAnswer: 'db.orders.aggregate([ { $lookup: { from: "inventory" } } ])'
};

const malformedMCQ = {
  questionText: 'Too short',
  options: ['Only one'],
  correctAnswer: 'Not in options'
};

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log(' 🧪 AGENT 3 EVALUATOR TRUTHFULNESS & RESILIENCE TEST SUITE (PHASE 1.1)');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(` ✅ PASS [${totalTests}]: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(` ❌ FAIL [${totalTests}]: ${name}`);
      console.error(`    Error: ${err.message}\n`);
    }
  }

  async function runAsyncTest(name, fn) {
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

  // Backup original llmRouter.complete
  const originalComplete = llmRouter.complete;

  try {
    // ── TEST 1: Normal Successful Agent 3 Evaluation ──
    await runAsyncTest('Normal successful LLM evaluation preserves parsed status and sets LLM_EVALUATION', async () => {
      llmRouter.complete = async () => JSON.stringify({
        status: 'PASS',
        tier: 'DIRECT_EVIDENCE',
        studentAnswerability: 'HIGH',
        failureReason: null,
        repairInstruction: null,
        groundingScore: 0.96
      });

      const res = await agent3Evaluator.evaluateQuestion(groundedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'PASS', 'Status should be PASS');
      assert.strictEqual(res.tier, 'DIRECT_EVIDENCE', 'Tier should match LLM response');
      assert.strictEqual(res.verificationMethod, 'LLM_EVALUATION', 'Method must be LLM_EVALUATION');
      assert.strictEqual(res.isFallback, false, 'isFallback must be false on successful LLM call');
      assert.strictEqual(res.groundingScore, 0.96, 'groundingScore should match LLM score');
    });

    // ── TEST 2: Hard Enforcement of UNSUPPORTED_FOREIGN ──
    await runAsyncTest('Enforces hard rejection when LLM flags UNSUPPORTED_FOREIGN', async () => {
      llmRouter.complete = async () => JSON.stringify({
        status: 'PASS', // LLM returned PASS mistakenly but tier is UNSUPPORTED_FOREIGN
        tier: 'UNSUPPORTED_FOREIGN',
        studentAnswerability: 'LOW',
        failureReason: 'Question demands un-taught NoSQL knowledge'
      });

      const res = await agent3Evaluator.evaluateQuestion(foreignUngroundedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'FAIL', 'Status must be overridden to FAIL on UNSUPPORTED_FOREIGN');
      assert.strictEqual(res.tier, 'UNSUPPORTED_FOREIGN', 'Tier should be preserved');
      assert.strictEqual(res.verificationMethod, 'LLM_EVALUATION', 'Method should be LLM_EVALUATION');
    });

    // ── TEST 3: LLM Timeout / Failure with Grounded Evidence (Fallback PASS) ──
    await runAsyncTest('LLM timeout triggers deterministic fallback that passes grounded question truthfully', async () => {
      llmRouter.complete = async () => {
        throw new Error('LLM call timed out after 30000ms');
      };

      const res = await agent3Evaluator.evaluateQuestion(groundedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'PASS', 'Status should be PASS because terms exist in evidence');
      assert.strictEqual(res.tier, 'VERIFICATION_FALLBACK', 'Tier must be VERIFICATION_FALLBACK');
      assert.strictEqual(res.verificationMethod, 'UNAUDITED_HEURISTIC_FALLBACK', 'Method must be UNAUDITED_HEURISTIC_FALLBACK');
      assert.strictEqual(res.isFallback, true, 'isFallback flag must be true');
      assert.notStrictEqual(res.groundingScore, 0.90, 'groundingScore MUST NOT be fabricated 0.90');
      assert.ok(typeof res.groundingScore === 'number' && res.groundingScore > 0, 'groundingScore must be a positive computed ratio');
      assert.ok(res.auditNotice && res.auditNotice.includes('deterministic lexical evidence match'), 'auditNotice must describe fallback verification');
    });

    // ── TEST 4: LLM Failure with Foreign Ungrounded MCQ (Fallback FAIL) ──
    await runAsyncTest('LLM failure on ungrounded MCQ triggers deterministic fallback that FAILS honestly', async () => {
      llmRouter.complete = async () => {
        throw new Error('Groq 429 Rate Limit Exceeded');
      };

      const res = await agent3Evaluator.evaluateQuestion(foreignUngroundedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'FAIL', 'Status MUST be FAIL when question terms do not match evidence');
      assert.strictEqual(res.tier, 'UNSUPPORTED_FOREIGN', 'Tier should be UNSUPPORTED_FOREIGN');
      assert.strictEqual(res.verificationMethod, 'UNAUDITED_HEURISTIC_FALLBACK', 'Method must be UNAUDITED_HEURISTIC_FALLBACK');
      assert.strictEqual(res.isFallback, true, 'isFallback flag must be true');
      assert.notStrictEqual(res.groundingScore, 0.90, 'groundingScore MUST NOT be 0.90');
      assert.ok(res.failureReason && res.failureReason.includes('insufficient evidence overlap'), 'failureReason must explain low evidence overlap');
    });

    // ── TEST 5: LLM Returns Malformed / Invalid JSON ──
    await runAsyncTest('Malformed LLM output triggers deterministic fallback gracefully', async () => {
      llmRouter.complete = async () => {
        return 'Sorry, as an AI language model I cannot output JSON: { broken syntax ...';
      };

      const res = await agent3Evaluator.evaluateQuestion(groundedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'PASS', 'Should recover into deterministic fallback');
      assert.strictEqual(res.verificationMethod, 'UNAUDITED_HEURISTIC_FALLBACK', 'Must be marked as fallback');
      assert.strictEqual(res.isFallback, true, 'Must flag isFallback: true');
      assert.notStrictEqual(res.groundingScore, 0.90, 'groundingScore MUST NOT be 0.90');
    });

    // ── TEST 6: Malformed MCQ Structure in Fallback ──
    await runAsyncTest('Malformed candidate MCQ fails pre-checks in fallback mode', async () => {
      llmRouter.complete = async () => {
        throw new Error('Connection reset by peer');
      };

      const res = await agent3Evaluator.evaluateQuestion(malformedMCQ, sampleTarget, sampleEvidencePackage);
      assert.strictEqual(res.status, 'FAIL', 'Malformed MCQ must FAIL pre-checks');
      assert.ok(res.failureReason && res.failureReason.includes('Pre-checks failed'), 'failureReason must cite pre-check failures');
    });

    // ── TEST 7: Negative Invariant — Failed LLM Call Can NEVER Be Fabricated PASS ──
    await runAsyncTest('INVARIANT: Failed LLM call can NEVER return status: PASS with tier: EVIDENCE_DERIVED and score: 0.90', async () => {
      const simulatedErrors = [
        new Error('Network timeout'),
        new Error('HTTP 429 rate limit'),
        new Error('JSON parse failed'),
        new Error('ETIMEDOUT')
      ];

      for (const err of simulatedErrors) {
        llmRouter.complete = async () => { throw err; };
        const resGrounded = await agent3Evaluator.evaluateQuestion(groundedMCQ, sampleTarget, sampleEvidencePackage);
        const resForeign = await agent3Evaluator.evaluateQuestion(foreignUngroundedMCQ, sampleTarget, sampleEvidencePackage);

        // Neither response should ever claim to be a normal unflagged EVIDENCE_DERIVED 0.90
        assert.ok(
          !(resGrounded.tier === 'EVIDENCE_DERIVED' && resGrounded.groundingScore === 0.90 && resGrounded.isFallback === false),
          'Grounded fallback must never impersonate an authentic 0.90 LLM evaluation'
        );
        assert.notStrictEqual(resGrounded.groundingScore, 0.90, 'groundingScore must not be 0.90');

        assert.strictEqual(resForeign.status, 'FAIL', 'Foreign topic must FAIL on LLM outage');
        assert.notStrictEqual(resForeign.groundingScore, 0.90, 'Foreign topic must not receive 0.90');
      }
    });

    // ── TEST 8: evaluateQuizSet Tracks Fallback Tier Truthfully ──
    runTest('evaluateQuizSet includes VERIFICATION_FALLBACK in derivabilityTiers', () => {
      const mockQuestions = [
        { metadata: { dimension: 'Conceptual', tier: 'DIRECT_EVIDENCE', concept: 'Paging' } },
        { metadata: { dimension: 'Conceptual', tier: 'VERIFICATION_FALLBACK', concept: 'Paging' } },
        { metadata: { dimension: 'Procedural', tier: 'VERIFICATION_FALLBACK', concept: 'Segmentation' } }
      ];

      const report = agent3Evaluator.evaluateQuizSet(mockQuestions, { requestedCount: 3 });
      assert.strictEqual(report.derivabilityTiers.DIRECT_EVIDENCE, 1, 'DIRECT_EVIDENCE count should be 1');
      assert.strictEqual(report.derivabilityTiers.VERIFICATION_FALLBACK, 2, 'VERIFICATION_FALLBACK count should be 2');
      assert.strictEqual(report.derivabilityTiers.EVIDENCE_DERIVED, 0, 'EVIDENCE_DERIVED count should be 0');
    });

  } finally {
    // Restore original llmRouter.complete
    llmRouter.complete = originalComplete;
  }

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
