/**
 * server/test/test_independent_answer_verification.js
 *
 * RIGOROUS REGRESSION SUITE: INDEPENDENT ANSWER VERIFICATION
 *
 * Verifies:
 * 1. GAN non-saturating loss with false key -> MUST REJECT.
 * 2. BST invariant & recurrence -> MUST PASS only when exact.
 * 3. Mathematical complexity and Big-O algebra -> MUST PASS when correct.
 * 4. Causal systems reasoning -> MUST PASS with supported causal direction.
 * 5. Two mathematically equivalent options -> MUST REJECT (Ambiguity).
 * 6. Repair bypass prevention -> Repaired candidate must re-run through the entire gate.
 */

'use strict';

const assert = require('assert');
const verifier = require('../engine/validators/independentAnswerVerifier');
const agent3 = require('../engine/agents/agent3Evaluator');

async function runRegressionSuite() {
  console.log('=== RUNNING INDEPENDENT ANSWER VERIFICATION REGRESSION SUITE ===\n');
  let passedCount = 0;
  let totalCount = 0;

  function recordTest(name, passed, details = '') {
    totalCount++;
    if (passed) {
      passedCount++;
      console.log(`✅ [PASS] ${name}`);
    } else {
      console.error(`❌ [FAIL] ${name} -> ${details}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: GAN Non-Saturating Loss with False Key (Must REJECT)
  // ─────────────────────────────────────────────────────────────────────────────
  const ganQuestion = {
    questionText: 'During early GAN training, the discriminator rapidly achieves high accuracy, causing the generator\'s gradient updates to vanish. An engineer proposes switching from the standard minimax objective to the non-saturating heuristic loss to resolve this. What is the specific causal mechanism by which the non-saturating loss prevents gradient vanishing in this scenario, and what is the primary trade-off regarding the discriminator\'s signal strength compared to the original minimax formulation?',
    options: [
      'The non-saturating loss prevents vanishing by maximizing the log probability of the discriminator classifying generated samples as real, which keeps the gradient magnitude high even when the discriminator is confident; the trade-off is that the generator is incentivized to produce only a limited variety of outputs to maintain this high probability, exacerbating mode collapse.',
      'The non-saturating loss prevents vanishing by forcing the discriminator to output exactly 0.5, which ensures the generator receives a constant, non-zero gradient; the trade-off is that the discriminator can no longer distinguish between real and fake data, leading to immediate mode collapse.',
      'The non-saturating loss prevents vanishing by inverting the roles of the generator and discriminator, causing the discriminator to minimize the probability of detecting fakes; the trade-off is that the system loses its zero-sum property, resulting in a stable equilibrium where the generator captures only a subset of the true data distribution.',
      'The non-saturating loss prevents vanishing by replacing the saturated log(1 - D(G(z))) term with -log(D(G(z))), which provides a strong gradient signal when the discriminator assigns low probability to generated samples; the trade-off is that the generator is penalized less severely for obvious failures, potentially slowing the initial convergence of the generator\'s distribution towards the true data distribution.'
    ],
    // The flawed stored benchmark key was Option B (index 1)
    correctAnswer: 'The non-saturating loss prevents vanishing by forcing the discriminator to output exactly 0.5, which ensures the generator receives a constant, non-zero gradient; the trade-off is that the discriminator can no longer distinguish between real and fake data, leading to immediate mode collapse.',
    correctAnswerIndex: 1
  };

  const res1 = await verifier.verifyAnswerIndependently(ganQuestion, { targetDifficulty: 'Hard', concept: 'Generative Adversarial Network (GAN)' });
  recordTest(
    'Test 1: GAN non-saturating loss with false key must be REJECTED',
    res1.passed === false && res1.status === 'REJECT',
    `Status: ${res1.status}, Reason: ${res1.failureReason}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: BST Node Deletion Invariant (Must PASS when exact)
  // ─────────────────────────────────────────────────────────────────────────────
  const bstQuestion = {
    questionText: 'When deleting a node with two children from a Binary Search Tree (BST), what replacement procedure ensures all BST ordering invariants remain valid across both subtrees?',
    options: [
      'Deletes the target node and moves its left child directly to the root position without re-balancing the right subtree.',
      'Finds the inorder successor (minimum key in the right subtree), replaces the target node\'s key with the successor\'s key, and recursively deletes the successor node from the right subtree.',
      'Replaces the target node with an arbitrary leaf node from the left subtree without key comparison.',
      'Promotes both child subtrees simultaneously by allocating a new root pointer in memory.'
    ],
    correctAnswer: 'Finds the inorder successor (minimum key in the right subtree), replaces the target node\'s key with the successor\'s key, and recursively deletes the successor node from the right subtree.',
    correctAnswerIndex: 1
  };

  const res2 = await verifier.verifyAnswerIndependently(
    bstQuestion,
    { targetDifficulty: 'Medium', concept: 'Binary Search Tree Deletion' },
    'In a binary search tree, deleting a node with two children requires finding the inorder successor (smallest node in the right subtree) or inorder predecessor to preserve the BST invariant.'
  );
  recordTest(
    'Test 2: BST invariant node deletion must PASS when exact',
    res2.passed === true && res2.status === 'PASS' && res2.verifiedAnswerIndex === 1,
    `Status: ${res2.status}, Reason: ${res2.failureReason}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Mathematical Complexity & Big-O Algebra (Must PASS when algebra is correct)
  // ─────────────────────────────────────────────────────────────────────────────
  const bigOQuestion = {
    questionText: 'Given the recurrence relation T(n) = 2T(n/2) + O(n), which asymptotic complexity bound characterizes its tight running time according to the Master Theorem?',
    options: [
      'Theta(n log n)',
      'Theta(n^2)',
      'Theta(log n)',
      'Theta(2^n)'
    ],
    correctAnswer: 'Theta(n log n)',
    correctAnswerIndex: 0
  };

  const res3 = await verifier.verifyAnswerIndependently(
    bigOQuestion,
    { targetDifficulty: 'Medium', concept: 'Master Theorem Recurrence' },
    'For T(n) = 2T(n/2) + O(n), with a=2, b=2, log_b(a) = 1. Since f(n) = O(n^1), Case 2 of the Master Theorem applies, yielding T(n) = Theta(n log n).'
  );
  recordTest(
    'Test 3: Master Theorem Big-O algebra must PASS when correct',
    res3.passed === true && res3.status === 'PASS' && res3.verifiedAnswerIndex === 0,
    `Status: ${res3.status}, Reason: ${res3.failureReason}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Biology / System Architecture Causal Reasoning (Must PASS with correct causal direction)
  // ─────────────────────────────────────────────────────────────────────────────
  const causalQuestion = {
    questionText: 'In an operating system paging subsystem, why does a Translation Lookaside Buffer (TLB) miss increase the total effective memory access latency?',
    options: [
      'Because a TLB miss prevents the CPU clock from ticking until the entire disk swap space is scanned.',
      'Because a TLB miss forces the memory management unit to perform additional sequential memory accesses to traverse the multi-level page table before retrieving the physical frame.',
      'Because a TLB miss overwrites the CPU instruction pointer with an invalid physical address.',
      'Because a TLB miss immediately terminates the running process and flushes all user caches.'
    ],
    correctAnswer: 'Because a TLB miss forces the memory management unit to perform additional sequential memory accesses to traverse the multi-level page table before retrieving the physical frame.',
    correctAnswerIndex: 1
  };

  const res4 = await verifier.verifyAnswerIndependently(
    causalQuestion,
    { targetDifficulty: 'Medium', concept: 'TLB Miss and Paging Latency' },
    'When a TLB miss occurs, the MMU must walk the page directory and page tables in physical RAM, adding 1 to 4 extra memory lookups before the target data can be fetched.'
  );
  recordTest(
    'Test 4: System Architecture causal mechanism must PASS with correct direction',
    res4.passed === true && res4.status === 'PASS' && res4.verifiedAnswerIndex === 1,
    `Status: ${res4.status}, Reason: ${res4.failureReason}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Two Mathematically Equivalent Options (Must REJECT for Ambiguity)
  // ─────────────────────────────────────────────────────────────────────────────
  const ambiguousQuestion = {
    questionText: 'What is the tight asymptotic time complexity of sorting an array of n elements using standard MergeSort in the worst case?',
    options: [
      'O(n log n)',
      'O(n^2)',
      'O(n log n)', // Duplicate / Equivalent option!
      'O(2^n)'
    ],
    correctAnswer: 'O(n log n)',
    correctAnswerIndex: 0
  };

  const res5 = await verifier.verifyAnswerIndependently(ambiguousQuestion, { targetDifficulty: 'Easy', concept: 'MergeSort Complexity' });
  recordTest(
    'Test 5: Two mathematically equivalent options must REJECT for ambiguity',
    res5.passed === false && res5.failureReason === 'AMBIGUOUS_EQUIVALENT_OPTIONS',
    `Status: ${res5.status}, Reason: ${res5.failureReason}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Repair Cannot Bypass Verification Gate
  // ─────────────────────────────────────────────────────────────────────────────
  // Verify that an invalid candidate passing through agent3.evaluateAndRepairQuestion
  // is still rejected if the repaired question fails Independent Answer Verification!
  const invalidRepairedAttempt = {
    questionText: 'What is the worst-case time complexity of QuickSort when the pivot is always chosen as the smallest element in an already sorted array?',
    options: [
      'O(n log n)',
      'O(n^2)',
      'O(log n)',
      'O(1)'
    ],
    correctAnswer: 'O(1)', // Wrong key!
    correctAnswerIndex: 3
  };

  // Mock generator that attempts to "repair" by returning another flawed question with equivalent ambiguity
  const mockGenerator = {
    async generateQuestion() {
      return {
        questionText: 'What is the worst-case time complexity of QuickSort?',
        options: ['O(n^2)', 'O(n^2)', 'O(n log n)', 'O(log n)'], // Ambiguous options
        correctAnswer: 'O(n^2)',
        correctAnswerIndex: 0
      };
    }
  };

  const res6 = await agent3.evaluateAndRepairQuestion(
    invalidRepairedAttempt,
    { targetDifficulty: 'Medium', concept: 'QuickSort Complexity' },
    { unifiedRawContent: 'QuickSort worst case is O(n^2) when partitions are degenerate.' },
    mockGenerator
  );

  recordTest(
    'Test 6: Repaired candidate cannot bypass Independent Answer Verification',
    res6.passed === false && res6.status !== 'PASS',
    `Status: ${res6.status}, Reason: ${res6.failureReason || res6.failureReasons?.join(', ')}`
  );

  console.log(`\n=== REGRESSION SUITE RESULTS: ${passedCount}/${totalCount} PASSED ===`);
  if (passedCount === totalCount) {
    console.log('🎉 ALL 6 INDEPENDENT ANSWER VERIFICATION ACCEPTANCE TESTS PASSED (100%)!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Regression suite execution error:', err);
  process.exit(1);
});
