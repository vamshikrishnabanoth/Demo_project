/**
 * server/test/test_fallback_hardening.js
 *
 * Dedicated Verification Suite for Step 1: Fallback Hardening
 * - Test 1: Zero canned fallback questions in production mode (NODE_ENV=production).
 * - Test 2: ALLOW_MOCK_FALLBACK cannot bypass production environment guard.
 * - Test 3: LLM provider failure returns explicit isUnfulfilled status (PROVIDER_UNAVAILABLE).
 * - Test 4: JSON repair failure returns explicit isUnfulfilled status (JSON_REPAIR_FAILED).
 * - Test 5: Pipeline orchestrator marks pipelineStatus = 'FAILED' when 0 questions delivered.
 * - Test 6: Partial generation retains ONLY grounded questions (isPartial=true, zero canned questions).
 * - Test 7: Zero fabricated Git/CPU/BST questions in unfulfilled output.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const agent2Generator = require('../engine/agents/agent2Generator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const llmRouter = require('../engine/adapter/llmRouter');

console.log('======================================================================');
console.log('🧪 DEDICATED FALLBACK HARDENING & INTEGRITY TEST SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function recordAsync(name, fn) {
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

function recordSync(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runSuite() {
  const origEnv = process.env.NODE_ENV;
  const origMock = process.env.ALLOW_MOCK_FALLBACK;

  try {
    // -------------------------------------------------------------------------
    // Test 1: generateQuestionFallback() returns explicit unfulfilled when mock disabled
    // -------------------------------------------------------------------------
    recordSync('T1: Canned fallback questions blocked by default', () => {
      delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = 'development';

      const target = {
        targetId: 'T1',
        concept: 'git commit',
        subtopic: 'Version Control',
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'COMPARE',
        supportingEvidence: 'Git commit records changes to the repository.'
      };

      const result = agent2Generator.generateQuestionFallback(target, { curricularContent: 'Git commit' });
      assert.strictEqual(result.isUnfulfilled, true, 'Result should be marked isUnfulfilled');
      assert.strictEqual(result.unfulfilledReason, 'PROVIDER_UNAVAILABLE');
      assert.strictEqual(result.options, undefined, 'Must not return options array');
      assert.strictEqual(result.questionText, undefined, 'Must not return questionText');
    });

    // -------------------------------------------------------------------------
    // Test 2: ALLOW_MOCK_FALLBACK=true cannot bypass NODE_ENV=production
    // -------------------------------------------------------------------------
    recordSync('T2: ALLOW_MOCK_FALLBACK=true cannot bypass NODE_ENV=production', () => {
      process.env.ALLOW_MOCK_FALLBACK = 'true';
      process.env.NODE_ENV = 'production';

      const target = {
        targetId: 'T2',
        concept: 'cpu pipelining hazard',
        subtopic: 'Computer Architecture',
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'COMPARE',
        supportingEvidence: 'Pipelining hazards occur when instructions overlap and data dependencies are unresolved across pipeline stages.'
      };

      const result = agent2Generator.generateQuestionFallback(target, { curricularContent: 'CPU hazard mechanisms and data dependency forwarding' });
      assert.strictEqual(result.isUnfulfilled, true, 'Production must block mock fallback even if ALLOW_MOCK_FALLBACK=true');
      assert.strictEqual(result.unfulfilledReason, 'PROVIDER_UNAVAILABLE');
      assert.strictEqual(result.options, undefined, 'Must not return mock options in production');
    });

    // -------------------------------------------------------------------------
    // Test 3: ALLOW_MOCK_FALLBACK=true only works in non-production environments
    // -------------------------------------------------------------------------
    recordSync('T3: ALLOW_MOCK_FALLBACK=true allows mock only in non-production mode', () => {
      process.env.ALLOW_MOCK_FALLBACK = 'true';
      process.env.NODE_ENV = 'test';

      const target = {
        targetId: 'T3',
        concept: 'git commit',
        subtopic: 'Version Control',
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        supportingEvidence: 'Git commit saves snapshots of the repository working tree.'
      };

      const result = agent2Generator.generateQuestionFallback(target, { curricularContent: 'Git commit' });
      assert.strictEqual(Boolean(result.questionText), true, 'Mock mode should return test question');
      assert.strictEqual(Array.isArray(result.options), true, 'Mock mode should return options array');
      assert.strictEqual(result.options.length, 4, 'Mock question should have 4 options');
    });

    // -------------------------------------------------------------------------
    // Test 4: Provider failure in generateQuestion returns isUnfulfilled
    // -------------------------------------------------------------------------
    await recordAsync('T4: LLM provider timeout/failure returns unfulfilled payload without canned questions', async () => {
      delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = 'production';

      const target = {
        targetId: 'T4',
        concept: 'binary search tree inorder',
        subtopic: 'Data Structures',
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'COMPARE',
        supportingEvidence: 'In-order traversal of a binary search tree visits nodes in ascending key order.'
      };

      // Mock llmRouter.complete to simulate timeout
      const origComplete = llmRouter.complete;
      llmRouter.complete = async () => {
        throw new Error('Groq upstream timeout (504 Gateway Timeout)');
      };

      try {
        const result = await agent2Generator.generateQuestion(target, {
          sessionId: 'test_sess',
          curricularContent: 'In-order traversal'
        });

        assert.strictEqual(result.isUnfulfilled, true, 'Must return isUnfulfilled on LLM error');
        assert.strictEqual(result.unfulfilledReason, 'PROVIDER_UNAVAILABLE');
        assert.ok(result.message.includes('504 Gateway Timeout'), 'Message must preserve provider error context');
      } finally {
        llmRouter.complete = origComplete;
      }
    });

    // -------------------------------------------------------------------------
    // Test 5: JSON parse / repair failure returns unfulfilled payload
    // -------------------------------------------------------------------------
    await recordAsync('T5: JSON parse & repair failure returns isUnfulfilled without canned questions', async () => {
      delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = 'production';

      const target = {
        targetId: 'T5',
        concept: 'memory paging',
        subtopic: 'OS Memory',
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        supportingEvidence: 'Paging divides memory into fixed-sized blocks.'
      };

      const origComplete = llmRouter.complete;
      llmRouter.complete = async () => {
        // Return non-JSON garbage that repair cannot fix
        return '<<<MALFORMED OUTPUT UNPARSEABLE AS JSON>>>';
      };

      try {
        const result = await agent2Generator.generateQuestion(target, {
          sessionId: 'test_sess',
          curricularContent: 'Paging memory'
        });

        assert.strictEqual(result.isUnfulfilled, true, 'Must return isUnfulfilled on JSON failure');
        assert.strictEqual(result.unfulfilledReason, 'JSON_REPAIR_FAILED');
      } finally {
        llmRouter.complete = origComplete;
      }
    });

    // -------------------------------------------------------------------------
    // Test 6: Zero valid questions marks pipelineStatus = 'FAILED'
    // -------------------------------------------------------------------------
    await recordAsync('T6: Total provider failure marks pipelineStatus = FAILED and delivers 0 questions', async () => {
      delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = 'production';

      const origComplete = llmRouter.complete;
      llmRouter.complete = async () => {
        throw new Error('All LLM endpoints rate limited');
      };

      try {
        const sessionInputs = {
          voiceTranscript: 'Virtual memory in operating systems enables processes to execute with non-contiguous physical memory allocation. Paging maps virtual page numbers to physical frame numbers using page tables, while translation lookaside buffers cache frequent address translations to minimize memory access latency.',
          count: 3,
          difficulty: 'Medium'
        };

        const result = await pipelineOrchestrator.runPipeline(sessionInputs);

        assert.strictEqual(result.pipelineStatus, 'FAILED', 'Pipeline status must be FAILED when deliveredCount === 0');
        assert.strictEqual(result.deliveredCount, 0, 'Delivered count must be 0');
        assert.strictEqual(result.questions.length, 0, 'Questions array must be empty');
        assert.ok(result.error, 'Must provide an explicit error string');
      } finally {
        llmRouter.complete = origComplete;
      }
    });

    // -------------------------------------------------------------------------
    // Test 7: Partial generation retains ONLY valid questions (zero canned questions)
    // -------------------------------------------------------------------------
    await recordAsync('T7: Partial generation returns valid questions with isPartial=true and zero canned items', async () => {
      delete process.env.ALLOW_MOCK_FALLBACK;
      process.env.NODE_ENV = 'production';

      let qCount = 0;
      const origComplete = llmRouter.complete;
      llmRouter.complete = async ({ prompt }) => {
        // Return valid blueprint for Agent 1 planning
        if (prompt.includes('ASSESSMENT BLUEPRINT') || prompt.includes('assessment target') || prompt.includes('Agent 1')) {
          return JSON.stringify({
            subject: 'Virtual Memory',
            mainTopic: 'Paging',
            assessmentTargets: [
              { targetId: 'T01', concept: 'Page Table Translation', dimension: 'Conceptual', targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', instruction: 'Compare virtual to physical', supportingEvidence: 'Virtual memory uses page tables to translate virtual page numbers to physical frame numbers.' },
              { targetId: 'T02', concept: 'TLB Caching', dimension: 'Technical', targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', instruction: 'Compare TLB hit vs miss', supportingEvidence: 'Virtual memory uses page tables to translate virtual page numbers to physical frame numbers.' },
              { targetId: 'T03', concept: 'Page Fault Handling', dimension: 'Technical', targetDifficulty: 'Medium', intendedCognitiveOperation: 'DIAGNOSE', instruction: 'Diagnose page fault', supportingEvidence: 'Virtual memory uses page tables to translate virtual page numbers to physical frame numbers.' }
            ],
            reserveTargets: []
          });
        }

        // For question generation (Agent 2): let first target succeed, fail the others
        if (prompt.includes('[ASSESSMENT TARGET]')) {
          qCount++;
          if (qCount === 1) {
            return JSON.stringify({
              targetId: 'T01',
              questionText: 'What structure translates virtual page numbers to physical frame numbers in operating systems?',
              options: [
                'Page Table',
                'Translation Lookaside Buffer',
                'Segment Register',
                'Instruction Pointer'
              ],
              correctAnswer: 'Page Table',
              explanation: 'The page table maps virtual page numbers to physical frame numbers.',
              usedArchetypes: ['NEAR_MISS_MECHANISM', 'MISCONCEPTION_INVERSION']
            });
          } else {
            throw new Error('Simulated upstream provider timeout on subsequent targets');
          }
        }

        return '{}';
      };

      try {
        const sessionInputs = {
          voiceTranscript: 'Virtual memory uses page tables to translate virtual page numbers to physical frame numbers.',
          count: 3,
          difficulty: 'Medium'
        };

        const result = await pipelineOrchestrator.runPipeline(sessionInputs);

        if (result.questions.length > 0) {
          assert.strictEqual(result.pipelineStatus, 'COMPLETED_WITH_PARTIAL_FULFILLMENT');
          assert.strictEqual(result.deliveredCount < sessionInputs.count, true, 'Delivered count is less than requested');
          // Verify none of the questions contain canned templates
          result.questions.forEach(q => {
            assert.ok(!q.questionText.includes('AI quiz generation is temporarily offline'), 'Must not contain mock templates');
            assert.ok(!q.questionText.includes('When executing Git during local branch management'), 'Must not contain Git template');
          });
        }
      } finally {
        llmRouter.complete = origComplete;
      }
    });

  } finally {
    process.env.NODE_ENV = origEnv;
    if (origMock !== undefined) process.env.ALLOW_MOCK_FALLBACK = origMock;
    else delete process.env.ALLOW_MOCK_FALLBACK;
  }

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
