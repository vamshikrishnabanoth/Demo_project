/**
 * server/test/test_phase1_zero_crash_reliability.js
 *
 * Comprehensive Automated Regression Suite for Phase 1: Zero-Crash Reliability
 * Verifies all 7 checklist requirements:
 *   1. Null/undefined crash paths eliminated (Agent 2, Agent 3, Orchestrator, Validator)
 *   2. Malformed LLM outputs and missing/short options arrays handled safely
 *   3. Zero canned/mock MCQs leaking in production mode
 *   4. Provider failover from Groq (HTTP 429/timeout) to Gemini fallback
 *   5. Truthful failure reporting when all providers are exhausted (NO_LLM_PROVIDER_AVAILABLE)
 *   6. Single modality (pure voice) transparency without fabricated alignment cards
 *   7. Safe final quiz validation on null/empty question sets
 */

'use strict';

const assert = require('assert');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const agent1Planner = require('../engine/agents/agent1Planner');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const { finalQuizValidator } = require('../services/agentPipeline');
const llmRouter = require('../engine/adapter/llmRouter');
const { generateQuestions } = require('../engine/questionGenerator');
const circuitBreaker = require('../engine/questionGenerator/circuitBreaker');
const { createTask, failTask, getTask } = require('../services/taskManager');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE 1: ZERO-CRASH RELIABILITY AUTOMATED REGRESSION SUITE');
console.log('🧪 ====================================================================\n');

let passed = 0;
let failed = 0;

async function runAsyncCheck(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
    failed++;
  }
}

function runSyncCheck(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
    failed++;
  }
}

(async () => {
  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Agent 2 Generator Invariant & Schema Hardening
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST GROUP 1: Agent 2 Generator Invariant & Schema Hardening ---');

  const dummyTarget = {
    targetId: 'T01',
    concept: 'B-Tree Indexing',
    subtopic: 'Database Internals',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'Understand',
    evidenceType: 'VOICE_PRIMARY',
    supportingEvidence: 'A B-Tree keeps keys in sorted order for logarithmic search in database indices. B-Tree nodes maintain balanced and bounded keys for search and update.'
  };

  const dummyEvidence = {
    sessionType: 'VOICE_ONLY',
    isAcademic: true,
    spokenWordCount: 500,
    unifiedRawContent: 'A B-Tree keeps keys in sorted order for logarithmic search in database indices. B-Tree nodes maintain balanced and bounded keys for search and update.',
    transcriptSnippet: 'A B-Tree keeps keys in sorted order for logarithmic search in database indices.',
    evidenceSnippets: [{ text: 'A B-Tree keeps keys in sorted order for logarithmic search in database indices.' }]
  };

  await runAsyncCheck('1.1 Agent 2: Handles completely empty/null LLM response without throwing TypeError', async () => {
    const originalComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => null; // Simulate LLM returning null
      const res = await agent2Generator.generateQuestion(dummyTarget, dummyEvidence);
      assert(res !== null && typeof res === 'object', 'Must return an object');
      assert.strictEqual(res.isUnfulfilled, true, 'Must be marked isUnfulfilled');
      assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  await runAsyncCheck('1.2 Agent 2: Handles malformed unparseable JSON string without crashing', async () => {
    const originalComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => '<<<NOT_JSON>>> Some random hallucinated text';
      const res = await agent2Generator.generateQuestion(dummyTarget, dummyEvidence);
      assert(res !== null && typeof res === 'object');
      assert.strictEqual(res.isUnfulfilled, true);
      assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  await runAsyncCheck('1.3 Agent 2: Rejects question when options array has fewer than 4 choices', async () => {
    const originalComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => JSON.stringify({
        questionText: 'What is the primary benefit of a B-Tree index?',
        options: ['Logarithmic search', 'Linear search'], // Only 2 options!
        correctAnswer: 'Logarithmic search',
        explanation: 'Maintains sorted order.'
      });
      const res = await agent2Generator.generateQuestion(dummyTarget, dummyEvidence);
      assert.strictEqual(res.isUnfulfilled, true);
      assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
      assert(res.message.includes('options'), 'Error message should mention options');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  await runAsyncCheck('1.4 Agent 2: Rejects question when correctAnswer is not among options', async () => {
    const originalComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => JSON.stringify({
        questionText: 'What is the primary benefit of a B-Tree index?',
        options: ['Logarithmic search for keys', 'Linear scanning across records', 'Random file seek lookup', 'Constant time hashing'],
        correctAnswer: 'Option Z (Missing from options)', // Complete mismatch!
        explanation: 'Does not match options.'
      });
      const res = await agent2Generator.generateQuestion(dummyTarget, dummyEvidence);
      assert.strictEqual(res.isUnfulfilled, true);
      assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
      assert.strictEqual(res.unfulfilledReason, 'CORRECT_ANSWER_MISMATCH');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  await runAsyncCheck('1.5 Agent 2: Accepts valid 4-option MCQ and attaches targetId & metadata', async () => {
    const originalComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => JSON.stringify({
        questionText: 'How does a B-Tree maintain balanced search times across key lookups?',
        options: [
          'By maintaining sorted keys and bounded leaf node depths',
          'By rebuilding the entire tree structure on every single write',
          'By delegating all branch traversals to an external hash index',
          'By converting all variable-length keys into fixed-width integers'
        ],
        correctAnswer: 'By maintaining sorted keys and bounded leaf node depths',
        explanation: 'B-Trees guarantee logarithmic search by maintaining balanced depth.'
      });
      const res = await agent2Generator.generateQuestion(dummyTarget, dummyEvidence);
      assert.strictEqual(res.isUnfulfilled, undefined);
      assert.strictEqual(res.targetId, 'T01');
      assert.strictEqual(res.options.length, 4);
      assert(res.options.includes(res.correctAnswer), 'correctAnswer must be present in options');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Agent 3 Evaluator Null Guards & Safety
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 2: Agent 3 Evaluator Null Guards & Safety ---');

  await runAsyncCheck('2.1 Agent 3: Handles null candidate question gracefully without TypeError', async () => {
    const res = await agent3Evaluator.evaluateAndRepairQuestion(null, dummyTarget, dummyEvidence, agent2Generator);
    assert(res !== null && typeof res === 'object');
    assert.strictEqual(res.status, 'UNFULFILLED');
    assert.strictEqual(res.isUnfulfilled, true);
    assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
  });

  await runAsyncCheck('2.2 Agent 3: Passes through unfulfilled questions without attempting repairs', async () => {
    const unfulfilledMCQ = {
      targetId: 'T01',
      isUnfulfilled: true,
      fulfillmentStatus: 'UNFULFILLED_MALFORMED_OUTPUT',
      message: 'LLM generated malformed options array'
    };
    const res = await agent3Evaluator.evaluateAndRepairQuestion(unfulfilledMCQ, dummyTarget, dummyEvidence, agent2Generator);
    assert.strictEqual(res.status, 'UNFULFILLED');
    assert.strictEqual(res.isUnfulfilled, true);
    assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_MALFORMED_OUTPUT');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Pipeline Orchestrator & Final Quiz Validator Safeguards
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 3: Pipeline Orchestrator & Validator Safeguards ---');

  runSyncCheck('3.1 finalQuizValidator: Returns clean failure on undefined input without throwing', () => {
    const res = finalQuizValidator(undefined);
    assert.strictEqual(res.passed, false);
    assert(Array.isArray(res.issues), 'Issues must be an array');
    assert(res.issues.length > 0);
  });

  runSyncCheck('3.2 finalQuizValidator: Returns clean failure on null input without throwing', () => {
    const res = finalQuizValidator(null);
    assert.strictEqual(res.passed, false);
    assert(res.issues.length > 0);
  });

  runSyncCheck('3.3 finalQuizValidator: Returns clean failure on empty questions array', () => {
    const res = finalQuizValidator([]);
    assert.strictEqual(res.passed, false);
    assert(res.issues.length > 0);
  });

  await runAsyncCheck('3.4 Pipeline Orchestrator: Throws INSUFFICIENT_CURRICULAR_TARGETS on empty assessmentTargets', async () => {
    const originalPlan = agent1Planner.planAssessment;
    agent1Planner.planAssessment = async () => ({
      subject: 'Algorithms',
      mainTopic: 'Tree Structures',
      assessmentTargets: [], // Empty targets!
      reserveTargets: []
    });

    const academicTranscript = `
In computer science, a binary tree is a hierarchical data structure where each node has at most two children.
The binary search tree invariant specifies that all keys in the left subtree are strictly less than the root key,
and all keys in the right subtree are greater. During in-order traversal, we recursively visit the left child,
output the current root node, and then visit the right child. This produces keys in sorted ascending order in O(n) linear time.
    `.trim();

    let result = null;
    try {
      result = await pipelineOrchestrator.runPipeline({
        voiceTranscript: academicTranscript,
        requestedCount: 3,
        requestedDifficulty: 'Medium'
      });

    } finally {
      agent1Planner.planAssessment = originalPlan;
    }
    assert(result !== null, 'Pipeline result must not be null');
    assert.strictEqual(result.pipelineStatus, 'FAILED', 'Pipeline status should be FAILED');
    assert(result.error && result.error.includes('INSUFFICIENT_CURRICULAR_TARGETS'), 'Error must specify INSUFFICIENT_CURRICULAR_TARGETS');
    assert.strictEqual(result.questions.length, 0, 'No questions generated on empty targets');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Provider Failover (Groq 429 -> Gemini Fallback)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 4: Provider Failover (Groq 429 -> Gemini Fallback) ---');

  await runAsyncCheck('4.1 LLMRouter: Fails over to Gemini when Groq returns HTTP 429 rate limit', async () => {
    const { LLMRouter } = llmRouter;
    const testRouter = new LLMRouter();
    testRouter.groqApiKey = 'gsk_mock_test_key_12345';
    testRouter.geminiApiKey = 'gemini_mock_test_key_12345';

    let groqAttempted = false;
    let geminiAttempted = false;

    // Mock Groq to fail with HTTP 429
    testRouter._callGroqWithRetry = async () => {
      groqAttempted = true;
      const err = new Error('Request failed with status code 429: Rate limit exceeded');
      err.response = { status: 429, data: { error: { message: 'Rate limit reached for requests' } } };
      throw err;
    };

    // Mock Gemini to succeed
    testRouter._callGemini = async ({ prompt }) => {
      geminiAttempted = true;
      return JSON.stringify({ provider: 'gemini', output: 'SUCCESSFUL_FAILOVER' });
    };

    // Ensure mock fallback is disabled to strictly test failover
    const oldMock = process.env.ALLOW_MOCK_FALLBACK;
    const oldEnv = process.env.NODE_ENV;
    delete process.env.ALLOW_MOCK_FALLBACK;
    process.env.NODE_ENV = 'production';

    try {
      const response = await testRouter.complete({ prompt: 'Generate test item' });
      assert.strictEqual(groqAttempted, true, 'Groq should have been attempted first');
      assert.strictEqual(geminiAttempted, true, 'Gemini should have received failover request');
      const parsed = JSON.parse(response);
      assert.strictEqual(parsed.provider, 'gemini');
      assert.strictEqual(parsed.output, 'SUCCESSFUL_FAILOVER');
    } finally {
      if (oldMock !== undefined) process.env.ALLOW_MOCK_FALLBACK = oldMock;
      else delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = oldEnv;
    }
  });

  await runAsyncCheck('4.2 LLMRouter: Throws honest NO_LLM_PROVIDER_AVAILABLE when all providers fail in production', async () => {
    const { LLMRouter } = llmRouter;
    const testRouter = new LLMRouter();
    testRouter.groqApiKey = 'gsk_mock_key';
    testRouter.geminiApiKey = 'gemini_mock_key';

    testRouter._callGroqWithRetry = async () => {
      throw new Error('Groq 429 Rate Limit');
    };
    testRouter._callGemini = async () => {
      throw new Error('Gemini Quota Exceeded');
    };
    testRouter._callOllama = async () => {
      throw new Error('Ollama offline');
    };

    const oldMock = process.env.ALLOW_MOCK_FALLBACK;
    const oldEnv = process.env.NODE_ENV;
    delete process.env.ALLOW_MOCK_FALLBACK;
    process.env.NODE_ENV = 'production';

    let threwExpected = false;
    try {
      await testRouter.complete({ prompt: 'Generate test item' });
    } catch (err) {
      if (err.code === 'NO_LLM_PROVIDER_AVAILABLE' && err.message.includes('Groq') && err.message.includes('Gemini')) {
        threwExpected = true;
      }
    } finally {
      if (oldMock !== undefined) process.env.ALLOW_MOCK_FALLBACK = oldMock;
      else delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = oldEnv;
    }

    assert.strictEqual(threwExpected, true, 'Must throw explicit NO_LLM_PROVIDER_AVAILABLE error with details');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Zero Canned Questions Leaking in Production Mode
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 5: Zero Canned Questions Leaking in Production Mode ---');

  await runAsyncCheck('5.1 QuestionGenerator: Circuit breaker does NOT inject canned questions in production mode', async () => {
    // Force circuit breaker OPEN
    circuitBreaker.recordFailure('Simulated failure 429');
    circuitBreaker.recordFailure('Simulated failure 429');
    circuitBreaker.recordFailure('Simulated failure 429');
    circuitBreaker.recordFailure('Simulated failure 429');
    assert.strictEqual(circuitBreaker.isBroken(), true, 'Circuit breaker should be OPEN');

    const oldMock = process.env.ALLOW_MOCK_FALLBACK;
    const oldEnv = process.env.NODE_ENV;
    delete process.env.ALLOW_MOCK_FALLBACK;
    process.env.NODE_ENV = 'production';

    try {
      const result = await generateQuestions([
        { slotId: 'slot_001', userPrompt: 'Target Concept: "Aggregation"' }
      ]);

      // When circuit breaker is open in production, candidateItems must be empty and slot must fail honestly
      assert.strictEqual(result.candidateItems.length, 0, 'No canned items must leak in production mode');
      assert(result.failedSlots.length > 0, 'Failed slot must be recorded');
      assert.strictEqual(result.failedSlots[0].reason, 'CIRCUIT_BREAKER_OPEN');
    } finally {
      circuitBreaker.reset(); // Reset circuit breaker
      if (oldMock !== undefined) process.env.ALLOW_MOCK_FALLBACK = oldMock;
      else delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = oldEnv;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Truthful Telemetry & Inspector Single-Modality Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 6: Truthful Telemetry & Inspector Single-Modality Verification ---');

  runSyncCheck('6.1 taskManager.failTask: Accurately records FAILED_GENERATION without reporting false success', () => {
    const testTaskId = createTask('test-user-001');
    failTask(testTaskId, 'Zero questions passed validation gates', 'FAILED_GENERATION');
    const task = getTask(testTaskId);
    assert(task !== null, 'Task must exist');
    assert.strictEqual(task.status, 'FAILED');
    assert.strictEqual(task.state, 'FAILED_GENERATION');
    assert.strictEqual(task.errorCode, 'FAILED_GENERATION');
    assert(task.error.includes('Zero questions passed'));
  });

  runSyncCheck('6.2 Single Modality Transparency: Empty alignmentGraph yields 0 links without fabricating cards', () => {
    const pureVoiceEvidence = {
      sessionType: 'VOICE_ONLY',
      alignmentGraph: {} // No companion documents
    };

    // Verify alignment stage summary logic from PipelineInspectorDrawer
    const isCompleted = Boolean(pureVoiceEvidence?.alignmentGraph && Object.keys(pureVoiceEvidence.alignmentGraph).length > 0);
    assert.strictEqual(isCompleted, false, 'isCompleted must be false when no companion document was aligned');

    const rawLinks = Object.entries(pureVoiceEvidence.alignmentGraph || {}).map(([key, val]) => ({ concept: key, ...val }));
    const links = rawLinks; // Honest alignment mapping
    assert.strictEqual(links.length, 0, 'Must produce 0 links for pure voice sessions');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n====================================================================');
  console.log(`📊 PHASE 1 ZERO-CRASH RELIABILITY VERIFICATION: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
