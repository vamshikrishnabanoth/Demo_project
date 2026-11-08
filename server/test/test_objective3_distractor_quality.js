/**
 * server/test/test_objective3_distractor_quality.js
 *
 * REGRESSION & VERIFICATION SUITE: OBJECTIVE 3 DISTRACTOR QUALITY IMPROVEMENTS
 *
 * Verifies that the distractor-quality improvements across:
 * - DifficultyAwareDistractorValidator
 * - QuestionValidationEngine
 * - Agent3Evaluator
 * - Agent2Generator
 *
 * accurately:
 * 1. Catch all 9 documented Condition B distractor defects:
 *    - Q4: 3 format-asymmetry failures (code key vs prose distractors)
 *    - Q5: 1 implausible subset claim & 2 semantically redundant distractors (zero exclusion)
 *    - Q7: 1 arbitrary competitive programming input-syntax filler
 *    - Q8: 2 generic non-domain fillers (boolean flag, transaction counter)
 * 2. Cleanly pass all 10 non-defective Condition B questions with ZERO false positives:
 *    - Q1, Q2, Q3, Q6, Q9, Q10, Q11, Q12, Q13, Q14
 * 3. Cleanly pass all 4 repaired items (Repaired Q4, Q5, Q7, Q8).
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const QuestionValidationEngine = require('../engine/validators/questionValidationEngine');
const evaluator = require('../engine/agents/agent3Evaluator');

console.log('======================================================================');
console.log('  TEST SUITE: OBJECTIVE 3 DISTRACTOR QUALITY REMEDIATION');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    console.error(`         Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Load Condition B Delivered Questions
// ─────────────────────────────────────────────────────────────────────────────
const bCorpusPath = path.resolve(__dirname, '../../scratch/multi_005_sprint_all_delivered.json');
const conditionB = JSON.parse(fs.readFileSync(bCorpusPath, 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: Defect Detection on Documented Flawed Items
// ─────────────────────────────────────────────────────────────────────────────

// Defect 1: Q4 Format Asymmetry
runTest('Q4 Format Asymmetry Detection (Code Key vs Prose Distractors)', () => {
  const q4 = conditionB[3]; // 0-indexed Q4
  const target = { targetDifficulty: 'Medium', concept: 'Best Time to Buy and Sell Stock' };
  
  // 1. DifficultyAwareDistractorValidator
  const distractorReport = DifficultyAwareDistractorValidator.validate(q4, target);
  assert.strictEqual(distractorReport.verdict, 'REJECT', 'Q4 should be REJECTED for format asymmetry');
  const formatFlaw = distractorReport.flaws.find(f => f.code === 'ERR_FORMAT_ASYMMETRY');
  assert(formatFlaw, 'Q4 must have ERR_FORMAT_ASYMMETRY flaw');

  // 2. QuestionValidationEngine
  const qveReport = QuestionValidationEngine.validateQuestion(q4);
  const qveFormatFailure = qveReport.criticalFailures.some(f => f.includes('FORMAT_ASYMMETRY'));
  assert(qveFormatFailure, 'QuestionValidationEngine must flag FORMAT_ASYMMETRY as critical failure');

  // 3. Agent3Evaluator
  const evalResult = evaluator._runDeterministicAudit(q4, target, 'stocks prices algorithm');
  assert(evalResult.failureReasons.includes('DISTRACTOR_FORMAT_ASYMMETRY'), 'Agent3 must flag DISTRACTOR_FORMAT_ASYMMETRY');
});

// Defect 2: Q5 Implausible Distractor & Semantic Redundancy
runTest('Q5 Implausible Subset Assertion & Semantic Redundancy', () => {
  const q5 = conditionB[4]; // 0-indexed Q5
  const target = { targetDifficulty: 'Medium', concept: 'Minimum Product Subset' };

  // 1. DifficultyAwareDistractorValidator
  const distractorReport = DifficultyAwareDistractorValidator.validate(q5, target);
  assert.strictEqual(distractorReport.verdict, 'REJECT', 'Q5 should be REJECTED for implausible subset');
  const subsetFlaw = distractorReport.flaws.find(f => f.code === 'ERR_IMPLAUSIBLE_SUBSET_RULE');
  assert(subsetFlaw, 'Q5 must have ERR_IMPLAUSIBLE_SUBSET_RULE flaw');
  const synonymFlaw = distractorReport.flaws.find(f => f.code === 'SYNONYMOUS_DISTRACTORS');
  assert(synonymFlaw, 'Q5 must have SYNONYMOUS_DISTRACTORS flaw for zero-exclusion redundancy');

  // 2. QuestionValidationEngine
  const qveReport = QuestionValidationEngine.validateQuestion(q5);
  const qveWeak = qveReport.hasUnresolvedWeakDistractor;
  assert(qveWeak, 'QuestionValidationEngine must flag weak distractor for Q5');
  const qveSemantic = qveReport.criticalFailures.some(f => f.includes('SEMANTIC_REDUNDANCY'));
  assert(qveSemantic, 'QuestionValidationEngine must flag SEMANTIC_REDUNDANCY critical failure');

  // 3. Agent3Evaluator
  const evalResult = evaluator._runDeterministicAudit(q5, target, 'minimum product subset negative parity zero');
  assert(evalResult.failureReasons.includes('DISTRACTOR_IMPLAUSIBLE_SUBSET'), 'Agent3 must flag DISTRACTOR_IMPLAUSIBLE_SUBSET');
  assert(evalResult.failureReasons.includes('AMBIGUOUS_DISTRACTOR'), 'Agent3 must flag AMBIGUOUS_DISTRACTOR for semantic redundancy');
});

// Defect 3: Q7 Arbitrary Input-Syntax Filler
runTest('Q7 Arbitrary Input-Syntax Token Distractor', () => {
  const q7 = conditionB[6]; // 0-indexed Q7
  const target = { targetDifficulty: 'Easy', concept: "Prim's Algorithm Starting Vertex" };

  // 1. DifficultyAwareDistractorValidator
  const distractorReport = DifficultyAwareDistractorValidator.validate(q7, target);
  assert.strictEqual(distractorReport.verdict, 'REJECT', 'Q7 should be REJECTED for input syntax filler');
  const inputFlaw = distractorReport.flaws.find(f => f.code === 'ERR_INPUT_SYNTAX_FILLER');
  assert(inputFlaw, 'Q7 must have ERR_INPUT_SYNTAX_FILLER flaw');

  // 2. QuestionValidationEngine
  const qveReport = QuestionValidationEngine.validateQuestion(q7);
  assert(qveReport.hasUnresolvedWeakDistractor, 'QuestionValidationEngine must flag unresolved weak distractor');

  // 3. Agent3Evaluator
  const evalResult = evaluator._runDeterministicAudit(q7, target, "prim's algorithm source vertex");
  assert(evalResult.failureReasons.includes('DISTRACTOR_WEAK_FILLER'), 'Agent3 must flag DISTRACTOR_WEAK_FILLER');
});

// Defect 4: Q8 Generic Non-Domain Fillers (Boolean Flag & Transaction Counter)
runTest('Q8 Generic Non-Domain Variable Fillers', () => {
  const q8 = conditionB[7]; // 0-indexed Q8
  const target = { targetDifficulty: 'Easy', concept: 'minprice Tracking Variable' };

  // 1. DifficultyAwareDistractorValidator
  const distractorReport = DifficultyAwareDistractorValidator.validate(q8, target);
  assert.strictEqual(distractorReport.verdict, 'REJECT', 'Q8 should be REJECTED for generic variable fillers');
  const genericFlaw = distractorReport.flaws.find(f => f.code === 'ERR_GENERIC_NON_DOMAIN_FILLER');
  assert(genericFlaw, 'Q8 must have ERR_GENERIC_NON_DOMAIN_FILLER flaw');

  // 2. QuestionValidationEngine
  const qveReport = QuestionValidationEngine.validateQuestion(q8);
  assert(qveReport.hasUnresolvedWeakDistractor, 'QuestionValidationEngine must flag unresolved weak distractor');

  // 3. Agent3Evaluator
  const evalResult = evaluator._runDeterministicAudit(q8, target, 'minprice minimum purchase price tracking');
  assert(evalResult.failureReasons.includes('DISTRACTOR_GENERIC_FILLER'), 'Agent3 must flag DISTRACTOR_GENERIC_FILLER');
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Zero False Positives on All 10 Valid Condition B Questions
// ─────────────────────────────────────────────────────────────────────────────
const validIndices = [0, 1, 2, 5, 8, 9, 10, 11, 12, 13]; // Q1, Q2, Q3, Q6, Q9, Q10, Q11, Q12, Q13, Q14

runTest('Zero False Positives Across All 10 Non-Defective Condition B Items', () => {
  validIndices.forEach(idx => {
    const q = conditionB[idx];
    const target = { targetDifficulty: q.targetDifficulty || 'Medium', concept: q.runName };
    const report = DifficultyAwareDistractorValidator.validate(q, target);
    
    // Assert no distractor quality flaws
    const forbiddenFlawCodes = [
      'ERR_FORMAT_ASYMMETRY',
      'ERR_IMPLAUSIBLE_SUBSET_RULE',
      'ERR_INPUT_SYNTAX_FILLER',
      'ERR_GENERIC_NON_DOMAIN_FILLER',
      'SYNONYMOUS_DISTRACTORS',
      'ABSURD_DISTRACTOR'
    ];
    
    const triggeredForbidden = report.flaws.filter(f => forbiddenFlawCodes.includes(f.code));
    assert.strictEqual(
      triggeredForbidden.length,
      0,
      `Q${idx+1} [${q.runName}] was falsely flagged with: ${JSON.stringify(triggeredForbidden)}`
    );
    assert.strictEqual(report.verdict, 'PASS', `Q${idx+1} [${q.runName}] must PASS distractor fitness`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 4: Clean Passing on All 4 Repaired Questions
// ─────────────────────────────────────────────────────────────────────────────

const repairedQ4 = {
  questionText: 'In the single-pass C++ implementation for Best Time to Buy and Sell Stock, how is the potential profit for day i updated using the current price prices[i] and the tracked minimum price minprice?',
  options: [
    'prices[i] - minprice',
    'minprice - prices[i]',
    'prices[i] + minprice',
    'prices[i] * minprice'
  ],
  correctAnswer: 'prices[i] - minprice',
  targetDifficulty: 'Medium'
};

const repairedQ5 = {
  questionText: 'When finding the minimum product subset of an array containing only positive integers, which rule determines the correct subset selection?',
  options: [
    'When the array contains only positive numbers, the single smallest positive number forms the minimum product subset.',
    'When all elements are negative and the count of negatives is odd, the negative number with the smallest absolute value must be excluded.',
    'If the array contains zero, the minimum product subset can never have a product of zero.',
    'Even if zero is present, a subset containing only negative numbers is always strictly smaller than zero, regardless of negative parity.'
  ],
  correctAnswer: 'When the array contains only positive numbers, the single smallest positive number forms the minimum product subset.',
  targetDifficulty: 'Medium'
};

const repairedQ7 = {
  questionText: "In Prim's algorithm for finding a Minimum Spanning Tree, what role does the source vertex provided in the input play during execution?",
  options: [
    "The starting vertex from which Prim's algorithm initializes the minimum spanning tree",
    "The total weight or cost accumulator of the minimum spanning tree",
    "A Boolean flag indicating whether the input graph is connected or bipartite",
    "The terminal vertex at which Prim's algorithm terminates its priority queue traversal"
  ],
  correctAnswer: "The starting vertex from which Prim's algorithm initializes the minimum spanning tree",
  targetDifficulty: 'Easy'
};

const repairedQ8 = {
  questionText: 'In the single-pass algorithm for Best Time to Buy and Sell Stock, what operational role does the minprice variable serve during array traversal?',
  options: [
    'The minimum stock purchase price observed up to the current day in the iteration',
    'The absolute minimum purchase price across the entire array discovered via precomputation',
    'The maximum selling price allowable for a legal transaction',
    'The cumulative profit accumulated from all preceding trading days'
  ],
  correctAnswer: 'The minimum stock purchase price observed up to the current day in the iteration',
  targetDifficulty: 'Easy'
};

runTest('Repaired Q4 Passes Cleanly with Parallel Code Formats', () => {
  const report = DifficultyAwareDistractorValidator.validate(repairedQ4, 'Medium');
  assert.strictEqual(report.verdict, 'PASS', 'Repaired Q4 must PASS distractor validator');
  assert.strictEqual(report.flaws.length, 0, 'Repaired Q4 should have 0 flaws');

  const qveReport = QuestionValidationEngine.validateQuestion(repairedQ4);
  assert.strictEqual(qveReport.isStructurallyValid, true, 'Repaired Q4 must be structurally valid in QVE');
  assert.strictEqual(qveReport.hasUnresolvedWeakDistractor, false, 'Repaired Q4 must have no weak distractors in QVE');
});

runTest('Repaired Q5 Passes Cleanly with Distinct Mathematical Misconceptions', () => {
  const report = DifficultyAwareDistractorValidator.validate(repairedQ5, 'Medium');
  assert.strictEqual(report.verdict, 'PASS', 'Repaired Q5 must PASS distractor validator');
  assert.strictEqual(report.flaws.length, 0, 'Repaired Q5 should have 0 flaws');

  const qveReport = QuestionValidationEngine.validateQuestion(repairedQ5);
  assert.strictEqual(qveReport.isStructurallyValid, true, 'Repaired Q5 must be structurally valid in QVE');
  assert.strictEqual(qveReport.hasUnresolvedWeakDistractor, false, 'Repaired Q5 must have no weak distractors in QVE');
});

runTest('Repaired Q7 Passes Cleanly with Valid Graph Role Distractors', () => {
  const report = DifficultyAwareDistractorValidator.validate(repairedQ7, 'Easy');
  assert.strictEqual(report.verdict, 'PASS', 'Repaired Q7 must PASS distractor validator');
  assert.strictEqual(report.flaws.length, 0, 'Repaired Q7 should have 0 flaws');

  const qveReport = QuestionValidationEngine.validateQuestion(repairedQ7);
  assert.strictEqual(qveReport.isStructurallyValid, true, 'Repaired Q7 must be structurally valid in QVE');
  assert.strictEqual(qveReport.hasUnresolvedWeakDistractor, false, 'Repaired Q7 must have no weak distractors in QVE');
});

runTest('Repaired Q8 Passes Cleanly with Algorithmic State Distractors', () => {
  const report = DifficultyAwareDistractorValidator.validate(repairedQ8, 'Easy');
  assert.strictEqual(report.verdict, 'PASS', 'Repaired Q8 must PASS distractor validator');
  assert.strictEqual(report.flaws.length, 0, 'Repaired Q8 should have 0 flaws');

  const qveReport = QuestionValidationEngine.validateQuestion(repairedQ8);
  assert.strictEqual(qveReport.isStructurallyValid, true, 'Repaired Q8 must be structurally valid in QVE');
  assert.strictEqual(qveReport.hasUnresolvedWeakDistractor, false, 'Repaired Q8 must have no weak distractors in QVE');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
console.log('======================================================================');
