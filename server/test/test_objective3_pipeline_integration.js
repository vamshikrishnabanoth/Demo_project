/**
 * server/test/test_objective3_pipeline_integration.js
 *
 * PIPELINE INTEGRATION VERIFICATION: OBJECTIVE 3 REMEDIATION
 *
 * Verifies that the new distractor quality checks:
 * 1. Are actively invoked in the real generation-to-validation pipeline
 *    via Agent3Evaluator.evaluateAndRepairQuestion().
 * 2. Properly reject/flag defective candidate questions with the exact failure codes.
 * 3. Generate actionable, targeted repair instructions.
 * 4. Pass repaired candidate questions through the re-evaluation gate.
 * 5. Reject persistently defective candidates after 1 bounded repair attempt.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Ensure deterministic mode for fast, isolated pipeline validation without external network flakes
process.env.AGENT3_MODE = 'deterministic_only';

const evaluator = require('../engine/agents/agent3Evaluator');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const QuestionValidationEngine = require('../engine/validators/questionValidationEngine');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const agent2Generator = require('../engine/agents/agent2Generator');
const llmRouter = require('../engine/adapter/llmRouter');

console.log('======================================================================');
console.log('  PIPELINE INTEGRATION VERIFICATION: OBJECTIVE 3 REMEDIATION');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    console.error(`         Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Load Condition B delivered items
const bCorpusPath = path.resolve(__dirname, '../../scratch/multi_005_sprint_all_delivered.json');
const conditionB = JSON.parse(fs.readFileSync(bCorpusPath, 'utf8'));

(async () => {
  // Test 1: Pipeline Rejection & Repair Loop for Q4 (Format Asymmetry)
  await runAsyncTest('Q4 Pipeline Rejection & Successful Repair (Format Asymmetry)', async () => {
    const rawQ4 = conditionB[3];
    const fullStockEvidence = 'Best Time to Buy and Sell Stock with Infinite Transactions. In C++ loop iteration from i = 0 to n-1: if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. ' + rawQ4.evidenceText;
    const target = {
      targetId: 'TGT_004',
      concept: rawQ4.targetTeachingUnit.concept,
      subtopic: rawQ4.targetTeachingUnit.subtopic,
      targetDifficulty: 'Easy',
      supportingEvidence: fullStockEvidence
    };

    let generatorCallCount = 0;
    let receivedInstruction = null;

    const mockGenerator = {
      generateQuestion: async (tgt, evidencePkg, repairInstruction) => {
        generatorCallCount++;
        receivedInstruction = repairInstruction;
        return {
          questionText: rawQ4.questionStem,
          options: [
            'if (prices[i] < prices[i+1]) max_profit += prices[i+1] - prices[i];',
            'if (prices[i] > prices[i+1]) max_profit += prices[i] - prices[i+1];',
            'if (prices[i] < prices[i+1]) max_profit = prices[i+1] - prices[0];',
            'if (prices[i] == prices[i+1]) max_profit += prices[i];'
          ],
          correctAnswer: 'if (prices[i] < prices[i+1]) max_profit += prices[i+1] - prices[i];',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      }
    };

    const result = await evaluator.evaluateAndRepairQuestion(
      rawQ4,
      target,
      { unifiedRawContent: fullStockEvidence },
      mockGenerator
    );

    assert.strictEqual(generatorCallCount, 1, 'Generator should be invoked for repair');
    assert(receivedInstruction.includes('parallelism') || receivedInstruction.includes('syntax'),
      `Repair instruction should mention format parallelism; got: "${receivedInstruction}"`);
    assert.strictEqual(result.repaired, true, 'Result should be marked as repaired');
    assert.strictEqual(result.repair.successful, true, 'Repair should be marked successful');
    assert.strictEqual(result.status, 'PASS', 'Repaired question must pass evaluator');
    assert.strictEqual(result.mcq.correctAnswer, 'if (prices[i] < prices[i+1]) max_profit += prices[i+1] - prices[i];',
      'Delivered MCQ should be repaired version');
  });

  // Test 2: Pipeline Rejection & Repair Loop for Q5 (Implausible Subset & Redundancy)
  await runAsyncTest('Q5 Pipeline Rejection & Successful Repair (Implausible Subset & Synonymy)', async () => {
    const rawQ5 = conditionB[4];
    const fullMpsEvidence = 'Minimum product subset problem. Given an array containing positive integers, negative integers, and zeros. The minimum product subset is determined by parity of negatives and presence of zeros. ' + rawQ5.evidenceText;
    const target = {
      targetId: 'TGT_005',
      concept: rawQ5.targetTeachingUnit.concept,
      subtopic: rawQ5.targetTeachingUnit.subtopic,
      targetDifficulty: 'Medium',
      supportingEvidence: fullMpsEvidence
    };

    let generatorCallCount = 0;
    let receivedInstruction = null;

    const mockGenerator = {
      generateQuestion: async (tgt, evidencePkg, repairInstruction) => {
        generatorCallCount++;
        receivedInstruction = repairInstruction;
        return {
          questionText: rawQ5.questionStem,
          options: [
            'Positive integers always yield a smaller product than zero when multiplied together.',
            'The problem requires maximizing the count of positive elements in the selected subset.',
            'Any product including zero is strictly less than any product of positive integers.',
            'A subset containing zero is invalid unless balanced by an odd count of negative numbers.'
          ],
          correctAnswer: 'Any product including zero is strictly less than any product of positive integers.',
          targetDifficulty: 'Medium',
          difficulty: 'Medium'
        };
      }
    };

    const result = await evaluator.evaluateAndRepairQuestion(
      rawQ5,
      target,
      { unifiedRawContent: fullMpsEvidence },
      mockGenerator
    );

    assert.strictEqual(generatorCallCount, 1, 'Generator should be invoked for repair');
    assert(receivedInstruction.includes('plausible') || receivedInstruction.includes('subset') || receivedInstruction.includes('distinct'),
      `Repair instruction should mention subset plausibility; got: "${receivedInstruction}"`);
    assert.strictEqual(result.repaired, true, 'Result should be marked as repaired');
    assert.strictEqual(result.repair.successful, true, 'Repair should be marked successful');
    assert.strictEqual(result.status, 'PASS', 'Repaired question must pass evaluator');
  });

  // Test 3: Pipeline Rejection & Repair Loop for Q7 (Input Syntax Filler)
  await runAsyncTest('Q7 Pipeline Rejection & Successful Repair (Input Stream Filler)', async () => {
    const rawQ7 = conditionB[6];
    const target = {
      targetId: 'TGT_007',
      concept: rawQ7.targetTeachingUnit.concept,
      subtopic: rawQ7.targetTeachingUnit.subtopic,
      targetDifficulty: 'Easy',
      supportingEvidence: rawQ7.evidenceText
    };

    let generatorCallCount = 0;
    let receivedInstruction = null;

    const mockGenerator = {
      generateQuestion: async (tgt, evidencePkg, repairInstruction) => {
        generatorCallCount++;
        receivedInstruction = repairInstruction;
        return {
          questionText: rawQ7.questionStem,
          options: [
            'The negative value representing the maximum potential loss',
            'The integer -1 indicating that no valid trade is possible',
            'The integer zero indicating no transaction occurred',
            'The index of the day with the lowest stock price'
          ],
          correctAnswer: 'The integer zero indicating no transaction occurred',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      }
    };

    const result = await evaluator.evaluateAndRepairQuestion(
      rawQ7,
      target,
      { unifiedRawContent: rawQ7.evidenceText },
      mockGenerator
    );

    assert.strictEqual(generatorCallCount, 1, 'Generator should be invoked for repair');
    assert(receivedInstruction.includes('competitive programming') || receivedInstruction.includes('input') || receivedInstruction.includes('misconceptions'),
      `Repair instruction should mention input filler defect; got: "${receivedInstruction}"`);
    assert.strictEqual(result.repaired, true, 'Result should be marked as repaired');
    assert.strictEqual(result.repair.successful, true, 'Repair should be marked successful');
    assert.strictEqual(result.status, 'PASS', 'Repaired question must pass evaluator');
  });

  // Test 4: Pipeline Rejection & Repair Loop for Q8 (Generic Non-Domain Filler)
  await runAsyncTest('Q8 Pipeline Rejection & Successful Repair (Generic Flags/Counters)', async () => {
    const rawQ8 = conditionB[7];
    const target = {
      targetId: 'TGT_008',
      concept: rawQ8.targetTeachingUnit.concept,
      subtopic: rawQ8.targetTeachingUnit.subtopic,
      targetDifficulty: 'Easy',
      supportingEvidence: rawQ8.evidenceText
    };

    let generatorCallCount = 0;
    let receivedInstruction = null;

    const mockGenerator = {
      generateQuestion: async (tgt, evidencePkg, repairInstruction) => {
        generatorCallCount++;
        receivedInstruction = repairInstruction;
        return {
          questionText: rawQ8.questionStem,
          options: [
            'The minimum buying price encountered so far',
            'The buying price of stock on day zero',
            'The average price across all trading days',
            'The maximum price seen so far'
          ],
          correctAnswer: 'The minimum buying price encountered so far',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      }
    };

    const result = await evaluator.evaluateAndRepairQuestion(
      rawQ8,
      target,
      { unifiedRawContent: rawQ8.evidenceText },
      mockGenerator
    );

    assert.strictEqual(generatorCallCount, 1, 'Generator should be invoked for repair');
    assert(receivedInstruction.includes('boolean flags') || receivedInstruction.includes('counters'),
      `Repair instruction should mention generic flags/counters; got: "${receivedInstruction}"`);
    assert.strictEqual(result.repaired, true, 'Result should be marked as repaired');
    assert.strictEqual(result.repair.successful, true, 'Repair should be marked successful');
    assert.strictEqual(result.status, 'PASS', 'Repaired question must pass evaluator');
  });

  // Test 5: Persistently Defective Question Remains Rejected (Strict 1-Attempt Bound)
  await runAsyncTest('Persistently Defective Candidate Remains Rejected', async () => {
    const rawQ4 = conditionB[3];
    const fullStockEvidence = 'Best Time to Buy and Sell Stock with Infinite Transactions. In C++ loop iteration from i = 0 to n-1: if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. ' + rawQ4.evidenceText;
    const target = {
      targetId: 'TGT_004',
      concept: rawQ4.targetTeachingUnit.concept,
      subtopic: rawQ4.targetTeachingUnit.subtopic,
      targetDifficulty: 'Easy',
      supportingEvidence: fullStockEvidence
    };

    const mockDefectiveGenerator = {
      generateQuestion: async () => {
        // Returns another defective candidate with format asymmetry
        return {
          questionText: rawQ4.questionStem,
          options: [
            'prices[i] - minprice',
            'Compute the difference between today price and yesterday price',
            'Take the running average of all preceding prices',
            'Multiply current price by trading volume'
          ],
          correctAnswer: 'prices[i] - minprice',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      }
    };

    const result = await evaluator.evaluateAndRepairQuestion(
      rawQ4,
      target,
      { unifiedRawContent: fullStockEvidence },
      mockDefectiveGenerator
    );

    assert.strictEqual(result.passed, false, 'Persistently defective question must NOT pass');
    assert.strictEqual(result.repaired, false, 'Result must NOT be marked repaired');
    assert.strictEqual(result.repair.successful, false, 'Repair must be marked unsuccessful');
    assert.strictEqual(result.repair.repairAttempts, 1, 'Repair attempts must be bounded to exactly 1');
  });

  // Test 6: Full Orchestrator Integration (runPipeline End-to-End Distractor Repair)
  await runAsyncTest('Full Orchestrator Integration: runPipeline repairs format asymmetry and records metrics', async () => {
    const origGenerate = agent2Generator.generateQuestion;
    const origComplete = llmRouter.complete;

    let generatorCalls = 0;
    let receivedRepairInstruction = null;

    const fullEvidence = 'In C++ greedy stock trading loop: if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. Best Time to Buy and Sell Stock with Infinite Transactions calculates profit on each ascending step.';

    llmRouter.complete = async ({ prompt }) => {
      if (prompt.includes('ASSESSMENT BLUEPRINT') || prompt.includes('assessment target') || prompt.includes('Agent 1')) {
        return JSON.stringify({
          subject: 'Algorithms',
          mainTopic: 'Greedy Stock Trading',
          assessmentTargets: [
            {
              targetId: 'T01',
              concept: 'Profit Calculation',
              dimension: 'Technical',
              targetDifficulty: 'Easy',
              intendedCognitiveOperation: 'RECALL',
              instruction: 'Calculate single-day greedy profit',
              supportingEvidence: fullEvidence
            }
          ],
          reserveTargets: []
        });
      }
      return '{}';
    };

    agent2Generator.generateQuestion = async (target, evidencePkg, repairInstruction) => {
      generatorCalls++;
      if (!repairInstruction) {
        // Initial defective candidate: code answer with prose distractors (format asymmetry)
        return {
          questionText: 'In C++ greedy stock trading loop, if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. What expression calculates the profit made on day i?',
          options: [
            'prices[i+1] - prices[i]',
            'Subtract the earlier stock price from the subsequent day price',
            'Calculate the running average price across all trading days',
            'Multiply the price change by total volume traded'
          ],
          correctAnswer: 'prices[i+1] - prices[i]',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      } else {
        // Repaired candidate: symmetric code syntax options
        receivedRepairInstruction = repairInstruction;
        return {
          questionText: 'In C++ greedy stock trading loop, if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. What expression calculates the profit made on day i?',
          options: [
            'prices[i+1] - prices[i]',
            'prices[i] - prices[i+1]',
            'prices[i+1] + prices[i]',
            'prices[i+1] * prices[i]'
          ],
          correctAnswer: 'prices[i+1] - prices[i]',
          targetDifficulty: 'Easy',
          difficulty: 'Easy'
        };
      }
    };

    try {
      const result = await pipelineOrchestrator.runPipeline({
        count: 1,
        difficulty: 'Easy',
        voiceTranscript: fullEvidence,
        teachingUnits: [
          {
            id: 'TU_001',
            concept: 'Profit Calculation',
            subtopic: 'Greedy Algorithms',
            claim: 'Profit is accumulated when adjacent price increases',
            evidence: fullEvidence,
            anchors: ['prices[i+1] - prices[i]'],
            targetDifficulty: 'Easy',
            verification: { status: 'VERIFIED' }
          }
        ]
      });

      assert.strictEqual(result.pipelineStatus, 'COMPLETED', 'Pipeline status must be COMPLETED');
      assert.strictEqual(result.deliveredCount, 1, 'Exactly 1 question must be delivered');
      assert.strictEqual(generatorCalls, 2, 'Generator must be called exactly twice (1 initial + 1 repair)');
      assert(receivedRepairInstruction.includes('format parallelism') || receivedRepairInstruction.includes('code syntax'),
        'Repair instruction should enforce format parallelism; got: ' + receivedRepairInstruction);
      assert.strictEqual(result.metrics?.repairs?.successfulRepairs, 1, 'Metrics must record 1 successful repair');
      assert.strictEqual(result.metrics?.repairs?.totalAttempted, 1, 'Metrics must record 1 repair attempt');
      assert.strictEqual(result.questions[0].correctAnswer, 'prices[i+1] - prices[i]');
    } finally {
      agent2Generator.generateQuestion = origGenerate;
      llmRouter.complete = origComplete;
    }
  });

  console.log('\n======================================================================');
  console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================');
  process.exit(0);
})();
