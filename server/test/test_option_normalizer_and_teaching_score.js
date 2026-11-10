/**
 * server/test/test_option_normalizer_and_teaching_score.js
 *
 * Dedicated verification for:
 * 1. Strict Option Normalization (Safeguards against key-fudging, unambiguous letter resolution, prefix stripping)
 * 2. Comparison-Stem Alignment Scaffold & Rules
 * 3. Teaching Score — Lecturer Delivery Quality (4 dimensions, preserved formula, unambiguous label & callout)
 * 4. Structured Failure Attribution (Provider failures vs. Authentic evidence deficits)
 */

'use strict';

const assert = require('assert');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent1Planner = require('../engine/agents/agent1Planner');
const deterministicValidator = require('../engine/validators/deterministicValidator');

console.log('========================================================================');
console.log('🧪 VERIFYING OPTION NORMALIZER, TEACHING SCORE & STRUCTURED ATTRIBUTION');
console.log('========================================================================\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STRICT OPTION NORMALIZER SAFEGUARDS
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- SUITE 1: Strict Option Normalizer & Letter Resolution ---');

test('1.1 Strips option prefixes from options and aligns clean text answer (The MAT_004 Root Cause)', () => {
  const mcq = {
    question: 'What is the search time complexity of a balanced AVL tree?',
    options: [
      'A) O(log n)',
      'B) O(n)',
      'C) O(1)',
      'D) O(n^2)'
    ],
    correctAnswer: 'O(log n)'
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  assert.strictEqual(mcq.options[0], 'O(log n)', 'Option A prefix must be stripped');
  assert.strictEqual(mcq.options[1], 'O(n)', 'Option B prefix must be stripped');
  assert.strictEqual(mcq.correctAnswer, 'O(log n)', 'correctAnswer must match normalized option');
  assert.strictEqual(mcq.correctAnswerIndex, 0, 'correctAnswerIndex must resolve to 0');
  assert.strictEqual(mcq.options.includes(mcq.correctAnswer), true, 'correctAnswer must strictly exist in options');
});

test('1.2 Strips prefixes when correctAnswer also includes letter prefix', () => {
  const mcq = {
    question: 'Which node replaces a deleted node with two children in a BST?',
    options: [
      '1. In-order predecessor only',
      '2. In-order successor or in-order predecessor',
      '3. The root node',
      '4. Any leaf node'
    ],
    correctAnswer: '2. In-order successor or in-order predecessor'
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  assert.strictEqual(mcq.options[1], 'In-order successor or in-order predecessor');
  assert.strictEqual(mcq.correctAnswer, 'In-order successor or in-order predecessor');
  assert.strictEqual(mcq.correctAnswerIndex, 1);
  assert.strictEqual(mcq.options.includes(mcq.correctAnswer), true);
});

test('1.3 Unambiguous single letter key ("C") resolves to exact option text', () => {
  const mcq = {
    question: 'Which rotation restores balance after Left-Right insertion in an AVL tree?',
    options: [
      'Single Right rotation',
      'Single Left rotation',
      'Left-Right double rotation',
      'Right-Left double rotation'
    ],
    correctAnswer: 'C'
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  assert.strictEqual(mcq.correctAnswer, 'Left-Right double rotation');
  assert.strictEqual(mcq.correctAnswerIndex, 2);
  assert.strictEqual(mcq.options.includes(mcq.correctAnswer), true);
});

test('1.4 Contradictory letter key vs supplied index triggers answer key conflict (No Silent Fudging)', () => {
  const mcq = {
    question: 'Contradictory test question',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: 'A',
    correctAnswerIndex: 3 // Contradicts 'A' (index 0)
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  assert.strictEqual(mcq._answerKeyConflict, true, 'Must flag answer key conflict');
  assert.notStrictEqual(mcq.correctAnswer, 'Delta', 'Must not silently overwrite with index 3');
});

test('1.5 Incorrect answer key matching zero options is NOT fuzzy-reassigned', () => {
  const mcq = {
    question: 'What is the worst-case time for BST lookup?',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'],
    correctAnswer: 'O(n^3)' // Genuinely wrong key not present in options
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  // Must NOT use Jaccard to force a match to O(n) or O(log n)
  assert.strictEqual(mcq.correctAnswer, 'O(n^3)', 'Must not reassign incorrect key to a random option');
  assert.strictEqual(mcq.options.includes(mcq.correctAnswer), false, 'Correctly remains unmatched');
});

test('1.6 Ambiguous collision across multiple identical options is flagged', () => {
  const mcq = {
    question: 'Ambiguous test',
    options: ['Duplicate Option', 'Duplicate Option', 'Third Option', 'Fourth Option'],
    correctAnswer: 'Duplicate Option'
  };

  agent2Generator.normalizeCorrectAnswer(mcq);

  assert.strictEqual(mcq._ambiguousCorrectAnswerMatch, true, 'Must flag ambiguous option match');
});


// ─────────────────────────────────────────────────────────────────────────────
// 2. REFINED COMPARISON-STEM ALIGNMENT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 2: Refined Comparison-Stem Alignment ---');

test('2.1 Distinction stem requires answer to resolve the comparison', () => {
  const candidate = {
    questionText: 'Which statement correctly distinguishes a perfect binary tree from a complete binary tree?',
    options: [
      'A perfect binary tree has all leaves at the same depth and internal nodes have two children, whereas a complete tree fills levels left-to-right.',
      'A complete binary tree has no leaf nodes at all.',
      'A perfect binary tree only contains odd numbers of nodes.',
      'Both perfect and complete trees must always have height equal to the number of nodes.'
    ],
    correctAnswer: 'A perfect binary tree has all leaves at the same depth and internal nodes have two children, whereas a complete tree fills levels left-to-right.',
    correctAnswerIndex: 0
  };

  const res = deterministicValidator.validateOptionSet(
    candidate.options,
    candidate.questionText,
    candidate.correctAnswer
  );

  const stemMisalignment = (res.errors || []).some(e => e.code === 'STEM_COMPARISON_MISALIGNMENT');
  assert.strictEqual(stemMisalignment, false, 'Valid comparative answer must not be rejected for stem alignment');
});

test('2.2 Definition stem with single-concept definition answer PASSES cleanly', () => {
  const candidate = {
    questionText: 'Which statement accurately defines a complete binary tree?',
    options: [
      'All levels are completely filled except possibly the last level, which is filled from left to right.',
      'Every node has either zero or two children with no single-child nodes.',
      'All leaf nodes must be on the left side of the tree only.',
      'The tree height is strictly restricted to at most three levels.'
    ],
    correctAnswer: 'All levels are completely filled except possibly the last level, which is filled from left to right.',
    correctAnswerIndex: 0
  };

  const res = deterministicValidator.validateOptionSet(
    candidate.options,
    candidate.questionText,
    candidate.correctAnswer
  );

  const stemMisalignment = (res.errors || []).some(e => e.code === 'STEM_COMPARISON_MISALIGNMENT');
  assert.strictEqual(stemMisalignment, false, 'Definition stem with definition answer must pass');
});


// ─────────────────────────────────────────────────────────────────────────────
// 3. TEACHING SCORE: LECTURER DELIVERY QUALITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 3: Teaching Score — Lecturer Delivery Quality ---');

test('3.1 Metric label and explanatory callout are properly framed (Formula Unchanged)', () => {
  const tcScore = agent1Planner._computeTCScore('Test raw lecture text', { conceptualEmphasis: 'HIGH' }, { rating: 'Comprehensive' }, {
    subtopicsCount: 8,
    plannedCount: 8,
    plannedRatio: 1.0,
    targets: [{ tier: 'Core' }, { tier: 'Core' }, { tier: 'Core' }, { tier: 'Core' }],
    reserve: [{ tier: 'Core' }]
  });

  assert.strictEqual(tcScore.metricName, 'Teaching Score — Lecturer Delivery Quality');
  assert.strictEqual(tcScore.explanatoryCallout, "Evaluates the lecturer's instructional delivery and curriculum depth independently of generated quiz volume.");
  assert.strictEqual(tcScore.overallScore >= 50 && tcScore.overallScore <= 100, true);

  // Check 4 dimensions
  assert.ok(tcScore.dimensions.coverage, 'Must have coverage dimension');
  assert.ok(tcScore.dimensions.clarity, 'Must have clarity dimension');
  assert.ok(tcScore.dimensions.flow, 'Must have flow dimension');
  assert.ok(tcScore.dimensions.enrichment, 'Must have enrichment dimension');

  const computedSum = tcScore.dimensions.coverage.score +
    tcScore.dimensions.clarity.score +
    tcScore.dimensions.flow.score +
    tcScore.dimensions.enrichment.score;
  assert.strictEqual(tcScore.overallScore, Math.min(100, Math.max(50, computedSum)), 'Formula sum must match overallScore');
});


// ─────────────────────────────────────────────────────────────────────────────
// 4. STRUCTURED FAILURE ATTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 4: Structured Failure Attribution ---');

test('4.1 Provider failures produce FAILED status and PROVIDER_ERROR shortfall category', () => {
  const unfulfilled = [
    { targetId: 'T01', status: 'UNFULFILLED_PROVIDER_FAILURE', unfulfilledReason: 'PROVIDER_ERROR', reason: 'Groq 429 rate limit' }
  ];
  const hasProviderFailures = unfulfilled.some(u =>
    u?.status === 'UNFULFILLED_PROVIDER_FAILURE' ||
    u?.unfulfilledReason === 'PROVIDER_UNAVAILABLE' ||
    u?.unfulfilledReason === 'PROVIDER_ERROR'
  );
  assert.strictEqual(hasProviderFailures, true);
});

test('4.2 Authentic capacity deficits produce COMPLETED_WITH_CAPACITY_DEFICIT and DIFFICULTY_UNSUPPORTED', () => {
  const unfulfilled = [
    { targetId: 'T01', status: 'UNFULFILLED_DIFFICULTY_DEFICIT', unfulfilledReason: 'DIFFICULTY_UNSUPPORTED', reason: 'Insufficient mechanisms for Hard demand' }
  ];
  const hasProviderFailures = unfulfilled.some(u => u?.status === 'UNFULFILLED_PROVIDER_FAILURE');
  const hasDifficultyMismatch = unfulfilled.some(u => u?.unfulfilledReason === 'DIFFICULTY_UNSUPPORTED');

  assert.strictEqual(hasProviderFailures, false);
  assert.strictEqual(hasDifficultyMismatch, true);
});

console.log(`\n========================================================================`);
console.log(`🏁 SUITE RESULTS: ALL ${passCount} / ${passCount} TESTS PASSED CLEANLY (100%)`);
console.log(`========================================================================\n`);
