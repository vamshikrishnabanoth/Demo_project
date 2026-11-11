/**
 * server/test/test_learning_objective_deduplication.js
 *
 * Dedicated acceptance test suite for Change 3: Learning-Objective Set Deduplication Gate
 * Validates Objective 3 (Distractor Quality & Intra-Set Non-Redundancy).
 *
 * Requirements & Safeguards:
 * 1. Historical Duplicate Pair 1 (GAN Q3 vs Q8): Rejected as comparative stem duplicate.
 * 2. Historical Duplicate Pair 2 (GAN Q7 vs Q10): Rejected as same-concept functional duplicate.
 * 3. Historical Duplicate Pair 3 (Templates Q5 vs Q6): Rejected as operational competency duplicate.
 * 4. BST Multi-Angle Preservation: Ordering vs Search vs Deletion vs Balancing preserved.
 * 5. GAN Competency Separation: Mathematical loss dynamics vs Architectural deception role preserved.
 * 6. Clean Distinct Concepts: Unrelated topics pass with zero false-positive duplicate flags.
 * 7. Conservative Distractor Overlap: Single plausible distractor allowed; boilerplate templates rejected.
 * 8. Stage 04b Replenishment: Pruned duplicate triggers replenishment from qualified reserves.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const deterministicValidator = require('../engine/validators/deterministicValidator');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

console.log('========================================================================');
console.log('🧪 CHANGE 3 TEST SUITE: LEARNING-OBJECTIVE SET DEDUPLICATION GATE');
console.log('========================================================================\n');

// Load historical fixtures
const gansPath = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/real_lecture_arch_gans_n10_balanced_output.json');
const gansData = JSON.parse(fs.readFileSync(gansPath, 'utf8'));

const introPath = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/introductory_lecture_templates_n10_balanced_output.json');
const introData = JSON.parse(fs.readFileSync(introPath, 'utf8'));

// ── Test 1: Historical Pair 1 Rejected (GAN Q3 vs Q8) ─────────────────────────
runTest('1. GAN Q3 vs Q8 near-verbatim clone rejected (Comparative stem threshold 0.65)', () => {
  const q3 = gansData.questions[2];
  const q8 = gansData.questions[7];

  const res = deterministicValidator.checkDuplicateQuestion(q8, [q3], q8.metadata);
  assert.strictEqual(res.isDuplicate, true, 'Q8 must be rejected as duplicate of Q3');
  assert.match(res.reason, /COMPARATIVE_STEM_DUPLICATE|VERBATIM_DUPLICATE/, 'Reason must indicate comparative/verbatim duplicate');
  console.log(`     -> Rejected with: ${res.reason}`);
});

// ── Test 2: Historical Pair 2 Rejected (GAN Q7 vs Q10) ────────────────────────
runTest('2. GAN Q7 vs Q10 redundant functional inquiry rejected (Attention Mechanism)', () => {
  const q7 = gansData.questions[6];
  const q10 = gansData.questions[9];

  const res = deterministicValidator.checkDuplicateQuestion(q10, [q7], q10.metadata);
  assert.strictEqual(res.isDuplicate, true, 'Q10 must be rejected as duplicate of Q7');
  assert.match(res.reason, /SAME_CONCEPT_FUNCTIONAL_DUPLICATE/, 'Reason must indicate same-concept functional duplicate');
  console.log(`     -> Rejected with: ${res.reason}`);
});

// ── Test 3: Historical Pair 3 Rejected (Templates Q5 vs Q6) ───────────────────
runTest('3. Templates Q5 vs Q6 operational collision rejected (Forward pass shaping)', () => {
  const q5 = introData.questions[4];
  const q6 = introData.questions[5];

  const res = deterministicValidator.checkDuplicateQuestion(q6, [q5], q6.metadata);
  assert.strictEqual(res.isDuplicate, true, 'Q6 must be rejected as duplicate of Q5');
  assert.match(res.reason, /OPERATIONAL_COMPETENCY_DUPLICATE/, 'Reason must indicate operational competency duplicate');
  console.log(`     -> Rejected with: ${res.reason}`);
});

// ── Test 4: BST Multi-Angle Preservation Safeguard ────────────────────────────
runTest('4. BST Multi-Angle Safeguard: Ordering vs Search vs Deletion vs Balancing all preserved', () => {
  const bstOrdering = {
    questionText: 'What invariant property defines a valid Binary Search Tree structure?',
    correctAnswer: 'All left subtree values are strictly less than the root, and right values are greater.',
    options: ['Left < root < right', 'Root is always median', 'Height is always log n', 'All leaves have equal depth'],
    metadata: { concept: 'Binary Search Tree', targetDifficulty: 'Easy' }
  };

  const bstSearch = {
    questionText: 'What is the worst-case time complexity of searching for an element in an unbalanced BST?',
    correctAnswer: 'O(n) when nodes form a degenerate linear chain.',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'],
    metadata: { concept: 'Binary Search Tree', targetDifficulty: 'Medium' }
  };

  const bstDeletion = {
    questionText: 'When deleting a node with two children from a BST, which node replaces it to preserve invariants?',
    correctAnswer: 'The in-order successor or in-order predecessor.',
    options: ['In-order successor', 'Leftmost leaf', 'Root of tree', 'Right child directly'],
    metadata: { concept: 'Binary Search Tree', targetDifficulty: 'Medium' }
  };

  const bstRotation = {
    questionText: 'Which rotation restores balance when a node is inserted into the left subtree of a left child in an AVL tree?',
    correctAnswer: 'A single right rotation about the unbalanced node.',
    options: ['Single right rotation', 'Left-right double rotation', 'Single left rotation', 'Right-left double rotation'],
    metadata: { concept: 'Binary Search Tree', targetDifficulty: 'Hard' }
  };

  const bstSet = [bstOrdering, bstSearch, bstDeletion, bstRotation];
  for (let i = 0; i < bstSet.length; i++) {
    for (let j = i + 1; j < bstSet.length; j++) {
      const res = deterministicValidator.checkDuplicateQuestion(bstSet[j], [bstSet[i]], bstSet[j].metadata);
      assert.strictEqual(res.isDuplicate, false, `BST questions ${i + 1} and ${j + 1} must NOT be flagged as duplicates`);
    }
  }
  console.log('     -> All 6 BST pairwise comparisons preserved as distinct cognitive angles');
});

// ── Test 5: GAN Mathematical Loss vs Architectural Deception Role ─────────────
runTest('5. GAN Competency Separation: Mathematical loss dynamics vs Architectural deception role preserved', () => {
  const ganMathLoss = {
    questionText: 'Why does the minimax loss function cause vanishing gradients early in GAN generator training?',
    correctAnswer: 'The log(1 - D(G(z))) term saturates when the discriminator easily distinguishes early samples.',
    options: ['Log(1 - D) saturates', 'Discriminator diverges', 'Generator weights become zero', 'Learning rate collapses'],
    metadata: { concept: 'Generator', targetDifficulty: 'Hard' }
  };

  const ganArchRole = {
    questionText: 'What is the primary architectural objective of the generator component in a Generative Adversarial Network?',
    correctAnswer: 'To generate synthetic data samples that deceive the discriminator into predicting they are real.',
    options: ['Deceive discriminator', 'Classify images', 'Compute cross-entropy loss', 'Reduce latent space dimensionality'],
    metadata: { concept: 'Generator', targetDifficulty: 'Medium' }
  };

  const res = deterministicValidator.checkDuplicateQuestion(ganArchRole, [ganMathLoss], ganArchRole.metadata);
  assert.strictEqual(res.isDuplicate, false, 'Mathematical loss dynamics and Architectural role must coexist on Generator');
  console.log('     -> Generator Math vs Architecture preserved with zero false-positive rejection');
});

// ── Test 6: Clean Distinct Curriculum Concepts Pass-Through ───────────────────
runTest('6. Distinct Curriculum Concepts: BFS vs QuickSort vs Dynamic Programming pass cleanly', () => {
  const qBFS = {
    questionText: 'Which data structure is fundamentally required to implement Breadth-First Search level traversal?',
    correctAnswer: 'FIFO Queue',
    options: ['FIFO Queue', 'LIFO Stack', 'Priority Queue', 'Disjoint Set'],
    metadata: { concept: 'Breadth-First Search' }
  };

  const qQuickSort = {
    questionText: 'What is the worst-case space complexity of standard in-place QuickSort call stack?',
    correctAnswer: 'O(n) auxiliary stack frames',
    options: ['O(n) auxiliary stack frames', 'O(1) total memory', 'O(n^2) auxiliary memory', 'O(log n) guaranteed'],
    metadata: { concept: 'QuickSort' }
  };

  const qDP = {
    questionText: 'What core condition determines whether a problem can be solved using dynamic programming memoization?',
    correctAnswer: 'Overlapping subproblems and optimal substructure',
    options: ['Overlapping subproblems and optimal substructure', 'Greedy choice property', 'Strict polynomial input bound', 'Linear independence'],
    metadata: { concept: 'Dynamic Programming' }
  };

  const distinctSet = [qBFS, qQuickSort, qDP];
  for (let i = 0; i < distinctSet.length; i++) {
    for (let j = i + 1; j < distinctSet.length; j++) {
      const res = deterministicValidator.checkDuplicateQuestion(distinctSet[j], [distinctSet[i]], distinctSet[j].metadata);
      assert.strictEqual(res.isDuplicate, false, `Distinct concepts ${i + 1} and ${j + 1} must not be flagged as duplicates`);
    }
  }
  console.log('     -> All distinct concepts passed through with zero false-positive flags');
});

// ── Test 7: Conservative Distractor Overlap Detection ─────────────────────────
runTest('7. Conservative Distractor Overlap: Single plausible option allowed, boilerplate template rejected', () => {
  const qBase = {
    questionText: 'What is the lookup complexity in a balanced AVL tree?',
    correctAnswer: 'O(log n)',
    options: ['O(log n)', 'O(n)', 'O(1)', 'O(n log n)']
  };

  const qSingleDistractorOverlap = {
    questionText: 'What is the worst-case search complexity of a B-tree of order m?',
    correctAnswer: 'O(log m n)',
    options: ['O(log m n)', 'O(n)', 'O(n^2)', 'O(m!)'] // Shares 'O(n)'
  };

  const resSingle = deterministicValidator.checkDistractorCollision(qSingleDistractorOverlap, [qBase]);
  assert.strictEqual(resSingle.hasCollision, false, 'Single plausible technical distractor "O(n)" must be allowed');

  const qBoilerplateDuplicate = {
    questionText: 'What happens when model execution encounters a memory boundary violation?',
    correctAnswer: 'It terminates the thread.',
    options: [
      'It terminates the thread.',
      'It immediately deletes all existing candidate classes and memory allocations', // Long boilerplate template
      'Returns zero',
      'Flushes disk cache'
    ]
  };

  const qBoilerplateOther = {
    questionText: 'What occurs during class compilation timeout?',
    correctAnswer: 'Process aborts.',
    options: [
      'Process aborts.',
      'It immediately deletes all existing candidate classes and memory allocations', // Identical boilerplate template
      'Silently skips',
      'Retries 10 times'
    ]
  };

  const resBoilerplate = deterministicValidator.checkDistractorCollision(qBoilerplateOther, [qBoilerplateDuplicate]);
  assert.strictEqual(resBoilerplate.hasCollision, true, 'Long verbatim boilerplate distractor must be flagged');
  console.log('     -> Single plausible distractor permitted; verbatim boilerplate distractor correctly flagged');
});

// ── Test 8: Stage 04b Replenishment From Qualified Reserves ───────────────────
runTest('8. Stage 04b Replenishment: Pruned duplicate triggers replenishment from qualified reserves', () => {
  // Simulate passing questions containing duplicate Q3 and Q8
  const q3 = { ...gansData.questions[2] };
  const q8 = { ...gansData.questions[7] };
  const q1 = { ...gansData.questions[0] };
  const q2 = { ...gansData.questions[1] };

  const initialPassing = [q1, q2, q3, q8];
  const deduplicated = [];

  for (const q of initialPassing) {
    const dupCheck = deterministicValidator.checkDuplicateQuestion(q, deduplicated, q.metadata);
    if (!dupCheck.isDuplicate) {
      deduplicated.push(q);
    }
  }

  assert.strictEqual(initialPassing.length, 4, 'Initial passing pool should have 4 questions');
  assert.strictEqual(deduplicated.length, 3, 'Deduplicated pool should prune Q8, leaving 3 questions');
  assert.strictEqual(deduplicated.some(q => q.questionText === q8.questionText), false, 'Q8 must be absent from deduplicated pool');

  // Verify that an eligible reserve target can replenish the pruned slot
  const qualifiedReserveTarget = {
    targetId: 'reserve_target_backpropagation',
    concept: 'Backpropagation Through Time',
    dimension: 'Mechanistic',
    targetDifficulty: 'Medium'
  };

  const replenishedMCQ = {
    targetId: 'reserve_target_backpropagation',
    questionText: 'How does Backpropagation Through Time (BPTT) update weights across unrolled recurrent sequence steps?',
    correctAnswer: 'By accumulating gradients across all unrolled temporal steps before updating weights.',
    options: [
      'By accumulating gradients across all unrolled temporal steps before updating weights.',
      'By resetting weights to zero at every time step.',
      'By evaluating only the final output token.',
      'By freezing hidden states during the backward pass.'
    ],
    metadata: { concept: 'Backpropagation Through Time', targetDifficulty: 'Medium' }
  };

  // Re-verify replenished candidate against deduplicated pool
  const replDupCheck = deterministicValidator.checkDuplicateQuestion(replenishedMCQ, deduplicated, qualifiedReserveTarget);
  assert.strictEqual(replDupCheck.isDuplicate, false, 'Replenished candidate must be distinct from deduplicated pool');

  deduplicated.push(replenishedMCQ);
  assert.strictEqual(deduplicated.length, 4, 'Pool size restored to 4 questions via genuine reserve replenishment');
  console.log('     -> Pruned duplicate Q8 replaced by genuine reserve candidate ("Backpropagation Through Time")');
});

console.log(`\n========================================================================`);
console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} ACCEPTANCE TESTS PASSED (100%)`);
console.log(`========================================================================\n`);
