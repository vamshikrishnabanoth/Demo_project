/**
 * server/test/test_answer_key_distribution.js
 *
 * PHASE 3.4 CONTRACT TEST SUITE:
 * Semantic Answer Identity -> Position Assignment -> Integrity Verification.
 *
 * Verifies:
 * 1. Balanced Key Allocation Planner Invariant: max(count) - min(count) <= 1 for N in {1, 2, 3, 4, 5, 6, 7, 8, 10, 100}.
 * 2. Diagnostic Randomness Sanity Check: 10,000 trials for N=5 testing unbiased extra-slot distribution.
 * 3. Semantic Normalization Contract: Strict 4-option, 1-answer, 3-distractor enforcement; rejects duplicate answers/distractors.
 * 4. Hard Reference Integrity: options[targetKey] === correctAnswerText, exactly 1 match, synchronized fields.
 * 5. Exclusivity Preservation: Single-key validity is preserved after distractor permutation and repositioning.
 * 6. Idempotence Safety: Repeated calls to Stage 06 never re-shuffle or corrupt already-assigned MCQs.
 * 7. End-to-End Quiz Simulation: 5-question quiz strictly delivers {2, 1, 1, 1} distribution with all 4 keys present.
 */

'use strict';

const assert = require('assert');
const deterministicValidator = require('../engine/validators/deterministicValidator');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    console.error(`         Reason: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n============================================================');
console.log('🧪 RUNNING PHASE 3.4 ANSWER-KEY DISTRIBUTION & INTEGRITY TESTS');
console.log('============================================================\n');

// ──────────────────────────────────────────────────────────────────────────
// Suite 1: Balanced Target-Key Allocation Planner Invariant
// ──────────────────────────────────────────────────────────────────────────
console.log('--- Suite 1: Balanced Target-Key Allocation Planner Invariant ---');

const testCasesN = [
  { N: 1, expectedCounts: [1, 0, 0, 0], maxMinDiff: 1 },
  { N: 2, expectedCounts: [1, 1, 0, 0], maxMinDiff: 1 },
  { N: 3, expectedCounts: [1, 1, 1, 0], maxMinDiff: 1 },
  { N: 4, expectedCounts: [1, 1, 1, 1], maxMinDiff: 0 },
  { N: 5, expectedCounts: [2, 1, 1, 1], maxMinDiff: 1 },
  { N: 6, expectedCounts: [2, 2, 1, 1], maxMinDiff: 1 },
  { N: 7, expectedCounts: [2, 2, 2, 1], maxMinDiff: 1 },
  { N: 8, expectedCounts: [2, 2, 2, 2], maxMinDiff: 0 },
  { N: 9, expectedCounts: [3, 2, 2, 2], maxMinDiff: 1 },
  { N: 10, expectedCounts: [3, 3, 2, 2], maxMinDiff: 1 },
  { N: 100, expectedCounts: [25, 25, 25, 25], maxMinDiff: 0 }
];

testCasesN.forEach(({ N, expectedCounts, maxMinDiff }) => {
  runTest(`Planner Allocation Invariant for N=${N} (max-min diff <= 1)`, () => {
    const keys = deterministicValidator.planBalancedKeyDistribution(N);
    assert.strictEqual(keys.length, N, `Expected exactly ${N} keys, got ${keys.length}`);

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    keys.forEach(k => {
      assert.ok(['A', 'B', 'C', 'D'].includes(k), `Invalid key ${k}`);
      counts[k]++;
    });

    const sortedCounts = Object.values(counts).sort((a, b) => b - a);
    const sortedExpected = [...expectedCounts].sort((a, b) => b - a);
    assert.deepStrictEqual(sortedCounts, sortedExpected, `For N=${N}, counts ${JSON.stringify(sortedCounts)} !== expected ${JSON.stringify(sortedExpected)}`);

    const maxCount = Math.max(...sortedCounts);
    const minCount = Math.min(...sortedCounts);
    assert.ok(maxCount - minCount <= 1, `Spread ${maxCount - minCount} exceeds 1 for N=${N}`);
    assert.strictEqual(maxCount - minCount, maxMinDiff, `Spread ${maxCount - minCount} !== expected ${maxMinDiff} for N=${N}`);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 2: Diagnostic Randomness Sanity Check
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 2: Diagnostic Randomness Sanity Check (10,000 runs) ---');

runTest('Randomness Sanity Check: Unbiased extra-slot distribution across 10,000 iterations for N=5', () => {
  const TRIALS = 10000;
  const extraSlotCounts = { A: 0, B: 0, C: 0, D: 0 };
  const firstKeyCounts = { A: 0, B: 0, C: 0, D: 0 };

  for (let i = 0; i < TRIALS; i++) {
    const keys = deterministicValidator.planBalancedKeyDistribution(5);
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    keys.forEach(k => counts[k]++);

    // Find which key received count === 2
    for (const [k, c] of Object.entries(counts)) {
      if (c === 2) extraSlotCounts[k]++;
    }
    firstKeyCounts[keys[0]]++;
  }

  // Diagnostic check: each key should be chosen as the extra slot ~25% (between 21% and 29%)
  for (const k of ['A', 'B', 'C', 'D']) {
    const extraRatio = extraSlotCounts[k] / TRIALS;
    assert.ok(extraRatio >= 0.21 && extraRatio <= 0.29, `Key ${k} extra-slot ratio ${extraRatio.toFixed(3)} out of expected ~0.25`);
    const firstRatio = firstKeyCounts[k] / TRIALS;
    assert.ok(firstRatio >= 0.21 && firstRatio <= 0.29, `Key ${k} first-slot ratio ${firstRatio.toFixed(3)} out of expected ~0.25`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 3: Semantic Normalization Boundary & Strict Contract
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 3: Semantic Normalization Boundary & Strict Contract ---');

runTest('Semantic Normalization: Extracts correctAnswerText and exactly 3 distractors', () => {
  const mcq = {
    questionText: 'What is the primary function of the Operating System page table?',
    options: [
      'Translates virtual addresses to physical frame addresses',
      'Schedules CPU bursts for high-priority processes',
      'Manages direct memory access transfers between I/O and RAM',
      'Maintains the transaction log for journaling filesystems'
    ],
    correctAnswer: 'Translates virtual addresses to physical frame addresses'
  };

  const normalized = deterministicValidator.normalizeSemanticMCQ(mcq);
  assert.ok(normalized.semanticIdentity, 'Missing semanticIdentity');
  assert.strictEqual(normalized.semanticIdentity.correctAnswerText, 'Translates virtual addresses to physical frame addresses');
  assert.strictEqual(normalized.semanticIdentity.distractorTexts.length, 3);
  assert.ok(!normalized.semanticIdentity.distractorTexts.includes(normalized.semanticIdentity.correctAnswerText));
});

runTest('Contract Enforcement: Throws on duplicate correctAnswer in options', () => {
  const mcq = {
    questionText: 'Which command initializes a new Git repository?',
    options: ['git init', 'git init', 'git clone', 'git status'],
    correctAnswer: 'git init'
  };

  assert.throws(() => {
    deterministicValidator.normalizeSemanticMCQ(mcq);
  }, /KEY_ASSIGNMENT_INTEGRITY_ERROR/);
});

runTest('Contract Enforcement: Throws on duplicate distractors in options', () => {
  const mcq = {
    questionText: 'Which command stages all modified files?',
    options: ['git add .', 'git commit', 'git commit', 'git push'],
    correctAnswer: 'git add .'
  };

  assert.throws(() => {
    deterministicValidator.normalizeSemanticMCQ(mcq);
  }, /KEY_ASSIGNMENT_INTEGRITY_ERROR/);
});

runTest('Contract Enforcement: Throws on missing correctAnswer in options', () => {
  const mcq = {
    questionText: 'What is the paging unit?',
    options: ['Frame', 'Page', 'Segment', 'Block'],
    correctAnswer: 'NonExistentOption'
  };

  assert.throws(() => {
    deterministicValidator.normalizeSemanticMCQ(mcq);
  }, /KEY_ASSIGNMENT_INTEGRITY_ERROR/);
});

runTest('Contract Enforcement: Throws when options count is not 4', () => {
  const mcq = {
    questionText: 'What is the paging unit?',
    options: ['Frame', 'Page', 'Segment'],
    correctAnswer: 'Page'
  };

  assert.throws(() => {
    deterministicValidator.normalizeSemanticMCQ(mcq);
  }, /KEY_ASSIGNMENT_INTEGRITY_ERROR/);
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 4: Hard Reference Integrity & Positional Placement
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 4: Hard Reference Integrity & Positional Placement ---');

['A', 'B', 'C', 'D'].forEach(targetKey => {
  runTest(`Reference Integrity: Correct answer placed strictly at target slot ${targetKey}`, () => {
    const mcq = {
      questionText: 'What is the purpose of the Translation Lookaside Buffer (TLB)?',
      options: [
        'Hardware cache for fast virtual-to-physical address translation',
        'Software queue managing pending disk I/O requests',
        'Register bank storing intermediate ALU results',
        'Kernel table tracking active open file descriptors'
      ],
      correctAnswer: 'Hardware cache for fast virtual-to-physical address translation'
    };

    const assigned = deterministicValidator.assignAndVerifyKeyPositions(mcq, targetKey);
    const keyMap = { A: 0, B: 1, C: 2, D: 3 };
    const expectedIdx = keyMap[targetKey];

    // Assert presentation position
    assert.strictEqual(assigned.options[expectedIdx], 'Hardware cache for fast virtual-to-physical address translation');

    // Assert exact single occurrence
    const matches = assigned.options.filter(o => o === 'Hardware cache for fast virtual-to-physical address translation');
    assert.strictEqual(matches.length, 1, 'Correct answer must appear exactly once in options');

    // Assert synchronized fields for downstream consumers
    assert.strictEqual(assigned.correctAnswer, 'Hardware cache for fast virtual-to-physical address translation');
    assert.strictEqual(assigned.correctAnswerText, 'Hardware cache for fast virtual-to-physical address translation');
    assert.strictEqual(assigned.correctAnswerKey, targetKey);
    assert.strictEqual(assigned.correct_answer, targetKey);
    assert.strictEqual(assigned.correct_answer_text, 'Hardware cache for fast virtual-to-physical address translation');
    assert.strictEqual(assigned.__positionAssigned, true);
  });
});

runTest('1,000 Randomized Item Integrity Verification', () => {
  const KEYS = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 1000; i++) {
    const correctText = `Correct Answer Statement ${i}`;
    const d1 = `Distractor Option 1_${i}`;
    const d2 = `Distractor Option 2_${i}`;
    const d3 = `Distractor Option 3_${i}`;

    // Random initial placement among 0..3
    const initialOpts = [correctText, d1, d2, d3];
    deterministicValidator.shuffleArrayCrypto(initialOpts);

    const mcq = {
      questionText: `Test question prompt text for item index ${i}?`,
      options: initialOpts,
      correctAnswer: correctText
    };

    const targetKey = KEYS[i % 4];
    const assigned = deterministicValidator.assignAndVerifyKeyPositions(mcq, targetKey);
    const expectedIdx = { A: 0, B: 1, C: 2, D: 3 }[targetKey];

    assert.strictEqual(assigned.options[expectedIdx], correctText);
    assert.strictEqual(assigned.correctAnswer, correctText);
    assert.strictEqual(assigned.correctAnswerKey, targetKey);
    assert.strictEqual(assigned.options.filter(o => o === correctText).length, 1);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 5: Exclusivity Preservation Invariant
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 5: Single-Key Exclusivity Preservation Invariant ---');

runTest('Exclusivity Preservation: Shuffling distractors does not alter single-key validity', () => {
  const mcq = {
    questionText: 'Which git command creates and switches to a new branch?',
    options: [
      'git checkout -b <branch>',
      'git branch <branch>',
      'git merge <branch>',
      'git rebase <branch>'
    ],
    correctAnswer: 'git checkout -b <branch>'
  };

  const preAmbiguity = deterministicValidator.detectOptionAmbiguity(mcq.questionText, mcq.options, mcq.correctAnswer);
  assert.strictEqual(preAmbiguity.classification, 'NO_NESTING');

  const assigned = deterministicValidator.assignAndVerifyKeyPositions(mcq, 'C');
  const postAmbiguity = deterministicValidator.detectOptionAmbiguity(assigned.questionText, assigned.options, assigned.correctAnswer);
  assert.strictEqual(postAmbiguity.classification, 'NO_NESTING');
  assert.strictEqual(assigned.options[2], 'git checkout -b <branch>');
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 6: Idempotence Safety
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 6: Idempotence Safety ---');

runTest('Idempotence: Second invocation of Stage 06 never mutates already-assigned MCQ', () => {
  const mcq = {
    questionText: 'What data structure represents the hierarchical page directory?',
    options: ['Multi-level tree', 'Hash table', 'Circular linked list', 'Bit vector array'],
    correctAnswer: 'Multi-level tree'
  };

  const firstPass = deterministicValidator.assignAndVerifyKeyPositions(mcq, 'B');
  const optionsSnapshot = [...firstPass.options];
  const assignedKeySnapshot = firstPass.correctAnswerKey;

  // Accidental second invocation
  const secondPass = deterministicValidator.assignAndVerifyKeyPositions(firstPass, 'D');

  assert.deepStrictEqual(secondPass.options, optionsSnapshot, 'Options must not be re-shuffled on second invocation');
  assert.strictEqual(secondPass.correctAnswerKey, assignedKeySnapshot, 'Key must not be re-assigned on second invocation');
  assert.strictEqual(secondPass.__positionAssigned, true);
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 7: End-to-End Quiz Delivery Simulation
// ──────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 7: End-to-End Quiz Delivery Simulation ---');

runTest('End-to-End: 5-question quiz produces strictly {2, 1, 1, 1} distribution with all 4 keys present', () => {
  const quiz = [
    {
      questionText: 'Question 1 about Operating Systems paging?',
      options: ['Ans 1', 'Dist 1A', 'Dist 1B', 'Dist 1C'],
      correctAnswer: 'Ans 1'
    },
    {
      questionText: 'Question 2 about Computer Architecture pipelining?',
      options: ['Dist 2A', 'Ans 2', 'Dist 2B', 'Dist 2C'],
      correctAnswer: 'Ans 2'
    },
    {
      questionText: 'Question 3 about Data Structures recursion?',
      options: ['Dist 3A', 'Dist 3B', 'Ans 3', 'Dist 3C'],
      correctAnswer: 'Ans 3'
    },
    {
      questionText: 'Question 4 about Git version control commands?',
      options: ['Dist 4A', 'Dist 4B', 'Dist 4C', 'Ans 4'],
      correctAnswer: 'Ans 4'
    },
    {
      questionText: 'Question 5 about Database MongoDB aggregation?',
      options: ['Ans 5', 'Dist 5A', 'Dist 5B', 'Dist 5C'],
      correctAnswer: 'Ans 5'
    }
  ];

  const processed = deterministicValidator.runPostChecks(quiz);
  assert.strictEqual(processed.length, 5);

  const keyCounts = { A: 0, B: 0, C: 0, D: 0 };
  processed.forEach((q, idx) => {
    const key = q.correctAnswerKey;
    assert.ok(key in keyCounts);
    keyCounts[key]++;

    // Verify option letter matches target text
    const keyIdx = { A: 0, B: 1, C: 2, D: 3 }[key];
    assert.strictEqual(q.options[keyIdx], `Ans ${idx + 1}`);
  });

  const sortedCounts = Object.values(keyCounts).sort((a, b) => b - a);
  assert.deepStrictEqual(sortedCounts, [2, 1, 1, 1], `Counts ${JSON.stringify(keyCounts)} must be strictly {2, 1, 1, 1}`);

  const distinctKeys = Object.values(keyCounts).filter(c => c > 0).length;
  assert.strictEqual(distinctKeys, 4, `All 4 keys must be present, found ${distinctKeys}`);

  const maxOptionImbalance = Math.max(...sortedCounts) / 5;
  assert.strictEqual(maxOptionImbalance, 0.4, `Max option imbalance must be 0.400, got ${maxOptionImbalance}`);
});

console.log('\n============================================================');
console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
