/**
 * server/test/test_distractor_fitness_gate.js
 *
 * CONTRACT & ADVERSARIAL TEST SUITE: STEP 6 DIFFICULTY-AWARE DISTRACTOR FITNESS VALIDATOR
 *
 * Verifies the 7 Validation Dimensions:
 * 1. Correctness (Exactly one correct answer in 4 options)
 * 2. Plausibility (Detects absurd or comical options)
 * 3. Conceptual Relationship (Detects foreign domain contamination)
 * 4. Difficulty Alignment (Cognitive demand match; preserves valid short Hard options)
 * 5. No Giveaway (Detects length giveaways)
 * 6. No Duplicate Reasoning (Detects synonymous/paraphrased distractors)
 * 7. No Accidental Second Key (Detects subsumption ambiguity)
 */

'use strict';

const assert = require('assert');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');

console.log('======================================================================');
console.log('  TEST SUITE: STEP 6 DIFFICULTY-AWARE DISTRACTOR FITNESS GATE (10 CASES)');
console.log('======================================================================\n');

let passCount = 0;
let totalCount = 0;

function runCase(id, name, mcq, targetDifficulty, evidence, expectedVerdict, expectedFlawCode = null) {
  totalCount++;
  const report = DifficultyAwareDistractorValidator.validate(mcq, targetDifficulty, evidence);
  const verdictMatches = report.verdict === expectedVerdict;
  const flawMatches = !expectedFlawCode || report.flaws.some(f => f.code === expectedFlawCode);

  if (verdictMatches && flawMatches) {
    passCount++;
    console.log(`  [PASS] Case ${id}: ${name}`);
    console.log(`         Verdict: ${report.verdict} (Score: ${report.score})`);
    if (expectedFlawCode) {
      console.log(`         Correctly flagged flaw: ${expectedFlawCode}`);
    }
  } else {
    console.error(`  [FAIL] Case ${id}: ${name}`);
    console.error(`         Expected Verdict: ${expectedVerdict} | Actual: ${report.verdict}`);
    console.error(`         Expected Flaw:    ${expectedFlawCode}`);
    console.error(`         Actual Flaws:     ${JSON.stringify(report.flaws)}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Valid Hard Question (Full Conceptual Pass)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  1,
  'Valid Hard Conceptual Question (GAN Lecturer B)',
  {
    questionText: 'If the discriminator becomes overly powerful and correctly classifies every generator output, what is the most likely effect on the generator learning process?',
    options: [
      'The generator receives near-zero gradient information because the discriminator saturates, causing learning to stall.',
      'The generator receives a strong, informative error gradient that accelerates its convergence toward the true distribution.',
      'Both networks enter a stable Nash equilibrium because the discriminator feedback regularizes the adversarial game.',
      'The discriminator perfect accuracy introduces high-variance noise into the generator loss, allowing gradual improvement.'
    ],
    correctAnswer: 'The generator receives near-zero gradient information because the discriminator saturates, causing learning to stall.'
  },
  'Hard',
  { unifiedRawContent: 'Adversarial training dynamics. Minimax game, vanishing gradients when discriminator saturates, dynamic tradeoff.' },
  'PASS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Valid Hard Question with Short Distractors (Mandate: Reasoning > Length)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  2,
  'Valid Hard Question with Short Algorithmic Distractors (Reasoning > Word Count)',
  {
    questionText: 'What is the worst-case time complexity of searching for a key in an unbalanced degenerate binary search tree?',
    options: [
      'O(n)',
      'O(log n)',
      'O(n log n)',
      'O(1)'
    ],
    correctAnswer: 'O(n)'
  },
  'Hard',
  { unifiedRawContent: 'Binary search tree degenerate into linked list in worst case with O(n) traversal.' },
  'PASS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Adversarial Hard Case: Absurd Distractor (Must REJECT)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  3,
  'Adversarial Hard Case: Absurd / Comical Distractor',
  {
    questionText: 'Why does an over-powered discriminator cause vanishing gradients in a GAN?',
    options: [
      'Because its loss saturates to zero error, providing no informative feedback to the generator.',
      'Because the generator learning rate drops to zero automatically when error is high.',
      'Because aliens intercept the gradient packets in the GPU.',
      'Because the discriminator predictions oscillate between two distinct modes.'
    ],
    correctAnswer: 'Because its loss saturates to zero error, providing no informative feedback to the generator.'
  },
  'Hard',
  { unifiedRawContent: 'GAN adversarial dynamics and vanishing gradients.' },
  'REJECT',
  'ABSURD_DISTRACTOR'
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Adversarial Case: Foreign Domain Contamination (Must REJECT)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  4,
  'Adversarial Case: Foreign Domain Contamination (React in Git Question)',
  {
    questionText: 'What is the primary role of the Git staging area (index)?',
    options: [
      'It formats and holds snapshot changes prepared for the next commit in the local repository.',
      'It modifies the remote origin directly without requiring a push operation.',
      'It invokes the React useEffect hook to synchronize component lifecycle state.',
      'It discards all uncommitted modifications from the local working directory.'
    ],
    correctAnswer: 'It formats and holds snapshot changes prepared for the next commit in the local repository.'
  },
  'Medium',
  { unifiedRawContent: 'Git version control staging area index commit repository working tree.' },
  'REJECT',
  'FOREIGN_DOMAIN_CONTAMINATION'
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Adversarial Case: Giveaway Length Bias (Must REPAIR)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  5,
  'Adversarial Case: Visual Giveaway (Correct Answer substantially longer)',
  {
    questionText: 'Which Git command discards all uncommitted local modifications in the working tree?',
    options: [
      'git add',
      'git push',
      'git reset --hard HEAD which completely purges all uncommitted working tree modifications and moves HEAD backward to the clean state',
      'git commit'
    ],
    correctAnswer: 'git reset --hard HEAD which completely purges all uncommitted working tree modifications and moves HEAD backward to the clean state'
  },
  'Medium',
  { unifiedRawContent: 'Git working tree reset.' },
  'REPAIR',
  'GIVEAWAY_LENGTH_BIAS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Adversarial Case: Duplicate Reasoning / Synonymous Distractors (Must REPAIR)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  6,
  'Adversarial Case: Duplicate Reasoning between two distractors',
  {
    questionText: 'What consequence occurs when a thread encounters an unhandled deadlock?',
    options: [
      'The thread blocks permanently waiting on a resource that will never be released.',
      'The thread execution halts and blocks indefinitely waiting for the mutex.',
      'The operating system immediately reboots the entire physical hardware host.',
      'The process increases its CPU utilization to 100% busy-spin execution.'
    ],
    correctAnswer: 'The process increases its CPU utilization to 100% busy-spin execution.'
  },
  'Hard',
  { unifiedRawContent: 'Operating system concurrency deadlock mutex thread synchronization.' },
  'REPAIR',
  'SYNONYMOUS_DISTRACTORS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Adversarial Case: Accidental Second Key (Subsumption Ambiguity) (Must REJECT)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  7,
  'Adversarial Case: Parameter Subsumption Ambiguity (git init vs git init --bare)',
  {
    questionText: 'Which command initializes a new Git repository?',
    options: [
      'git init',
      'git init --bare',
      'git start',
      'git create'
    ],
    correctAnswer: 'git init'
  },
  'Easy',
  { unifiedRawContent: 'Git init bare repository initialization.' },
  'REJECT',
  'POTENTIAL_MULTI_KEY'
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. Correctness Failure: Key Not in Options (Must REJECT)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  8,
  'Correctness Failure: Key Not Found in Options Array',
  {
    questionText: 'What does a virtual memory page table translate?',
    options: [
      'Virtual page numbers into physical page frame numbers',
      'Logical addresses into cache line indexes',
      'Register addresses into ALU control signals',
      'Disk sector numbers into inode table pointers'
    ],
    correctAnswer: 'Something completely absent from the array'
  },
  'Medium',
  { unifiedRawContent: 'Virtual memory paging frame.' },
  'REJECT',
  'ERR_KEY_NOT_IN_OPTIONS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. Correctness Failure: Identical Duplicate Options (Must REJECT)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  9,
  'Correctness Failure: Duplicate Verbatim Options in Array',
  {
    questionText: 'What protocol does ping rely on to test network reachability?',
    options: [
      'ICMP Echo Request and Echo Reply',
      'ICMP Echo Request and Echo Reply',
      'TCP Three-Way Handshake',
      'UDP Datagram Transmission'
    ],
    correctAnswer: 'ICMP Echo Request and Echo Reply'
  },
  'Easy',
  { unifiedRawContent: 'Network ICMP ping protocol echo request reply.' },
  'REJECT',
  'ERR_IDENTICAL_OPTIONS'
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Valid Easy Question (Recall / Definition Inversion)
// ─────────────────────────────────────────────────────────────────────────────
runCase(
  10,
  'Valid Easy Question: Definition Inversion / Role Confusion',
  {
    questionText: 'What is the primary function of the Generator in a Generative Adversarial Network?',
    options: [
      'To produce synthetic data samples that resemble the training distribution',
      'To classify incoming samples as either authentic training data or fabricated fakes',
      'To compute the loss gradient for the discriminator optimization step',
      'To store the ground-truth labeled training images in an offline buffer'
    ],
    correctAnswer: 'To produce synthetic data samples that resemble the training distribution'
  },
  'Easy',
  { unifiedRawContent: 'Generator produces fake samples, discriminator evaluates real vs fake.' },
  'PASS'
);

console.log('\n======================================================================');
console.log(`  STEP 6 TEST SUITE COMPLETE: ${passCount}/${totalCount} CASES PASSED`);
console.log('======================================================================\n');

if (passCount !== totalCount) {
  process.exit(1);
}
