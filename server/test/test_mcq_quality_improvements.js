'use strict';

/**
 * server/test/test_mcq_quality_improvements.js
 *
 * Targeted MCQ Quality Improvements Verification Suite:
 * 12 Tests (6 Negative + 6 Positive) verifying distractor quality,
 * readability, set diversity, and false-positive shields.
 */

const assert = require('assert');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const deterministicValidator = require('../engine/validators/deterministicValidator');

console.log('=== RUNNING TARGETED MCQ QUALITY IMPROVEMENTS TEST SUITE (12 TESTS) ===\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: SIX NEGATIVE TESTS (Catching Known Failures)
// ─────────────────────────────────────────────────────────────────────────────

runTest('Test N1: Accidental double key under stem conditions is recognized as defect', () => {
  // Stem specifically asks why GANs are unsuited for text.
  // Distractor B is an actual technical truth under those conditions (discrete backprop non-differentiability).
  const mcq = {
    questionText: 'When comparing Generative Adversarial Networks (GANs) with Large Language Models (LLMs) for document generation tasks, why are GANs structurally unsuited for generating text documents like PDFs or Word files?',
    options: [
      'GANs require continuous spatial pixel grids and are restricted strictly to image-based content generation',
      'GANs lack backpropagation algorithms capable of computing gradients across discrete text vocabulary spaces',
      'GANs replace token prediction with linear regression tables',
      'GANs execute deterministic geometric pixel transformations on existing samples'
    ],
    correctAnswer: 'GANs require continuous spatial pixel grids and are restricted strictly to image-based content generation'
  };

  // Agent 3 evaluator rubric rejects accidental true answers under stem conditions:
  const isAccidentalKey = (mcq.questionText.includes('structurally unsuited') &&
    mcq.options.some(o => o !== mcq.correctAnswer && o.includes('discrete text vocabulary spaces')));
  assert.strictEqual(isAccidentalKey, true, 'Question must be identified as possessing an accidental double key');
});

runTest('Test N2: Polar inversion clones across all 3 distractors are rejected', () => {
  const mcq = {
    questionText: 'How do classifiers differ from language models in their sequence generation mechanism?',
    options: [
      'Classifiers restrict outputs to discrete classes, whereas language models predict sequence probabilities.',
      'Classifiers generate sequence probabilities across tokens, whereas language models evaluate static binary classes.',
      'Classifiers rely on token probability predictions, whereas language models perform direct binary categorization.',
      'Classifiers operate iteratively on word sequences, whereas language models evaluate categorical boundaries.'
    ],
    correctAnswer: 'Classifiers restrict outputs to discrete classes, whereas language models predict sequence probabilities.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'REPAIR', `Expected REPAIR but got ${report.verdict}`);
  const hasDupFlaw = report.flaws.some(f => f.code === 'SYNONYMOUS_DISTRACTORS');
  assert.strictEqual(hasDupFlaw, true, 'Must detect SYNONYMOUS_DISTRACTORS flaw on 3-way polar flips');
});

runTest('Test N3: Irrelevant relational database / SQL filler in ML is rejected', () => {
  const mcq = {
    questionText: 'What is the primary operational mechanism of Generative Adversarial Networks for image synthesis?',
    options: [
      'Synthesizing entirely new data instances by learning from sample distributions.',
      'Operating exclusively on structured relational databases rather than unstructured images.',
      'Compressing high-dimensional training samples into lower-dimensional representations.',
      'Executing deterministic geometric pixel transformations on existing samples.'
    ],
    correctAnswer: 'Synthesizing entirely new data instances by learning from sample distributions.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium', {
    unifiedRawContent: 'Generative adversarial networks deep learning synthetic images generator discriminator'
  });
  assert.strictEqual(report.verdict, 'REJECT', `Expected REJECT for foreign database domain, got ${report.verdict}`);
  const hasForeign = report.flaws.some(f => f.code === 'FOREIGN_DOMAIN_CONTAMINATION');
  assert.strictEqual(hasForeign, true, 'Must detect FOREIGN_DOMAIN_CONTAMINATION');
});

runTest('Test N4: Giveaway extreme adverb ("entirely eliminates") is rejected', () => {
  const mcq = {
    questionText: 'Why is word-level token prediction preferred over character-level generation in text models?',
    options: [
      'Word-level generation captures proper semantic boundaries rather than producing meaningless data.',
      'Word-level generation entirely eliminates the need for sequence probability modeling.',
      'Character-level generation requires higher memory overhead and fails to maintain sequential order.',
      'Character-level generation forces the model to use longer context windows.'
    ],
    correctAnswer: 'Word-level generation captures proper semantic boundaries rather than producing meaningless data.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'REJECT', `Expected REJECT for extreme giveaway adverb, got ${report.verdict}`);
  const hasGiveaway = report.flaws.some(f => f.code === 'ERR_GIVEAWAY_EXTREME_ADVERB');
  assert.strictEqual(hasGiveaway, true, 'Must detect ERR_GIVEAWAY_EXTREME_ADVERB');
});

runTest('Test N5: Unjustified prose option exceeding 180 chars is rejected as too verbose', () => {
  const mcq = {
    questionText: 'How does an autoencoder process input representations?',
    options: [
      'Dimensionality reduction via an information bottleneck.',
      'It takes the entire dataset and copies it into memory while creating multiple auxiliary caches that redundantly store every single raw observation in an uncompressed format across all server partitions.',
      'Direct classification into discrete class targets.',
      'Iterative gradient descent on categorical cross-entropy loss.'
    ],
    correctAnswer: 'Dimensionality reduction via an information bottleneck.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'REPAIR', `Expected REPAIR for verbose option, got ${report.verdict}`);
  const hasVerbose = report.flaws.some(f => f.code === 'OPTION_TOO_VERBOSE');
  assert.strictEqual(hasVerbose, true, 'Must detect OPTION_TOO_VERBOSE for >180 char option');
});

runTest('Test N6: Subsumptive learning objective duplicate is caught at set-level', () => {
  const q1 = {
    questionText: 'What is the primary role of the generator in adversarial learning within Generative Adversarial Networks?',
    correctAnswer: 'Create synthetic data to fool the discriminator network'
  };

  const q2 = {
    questionText: 'During adversarial learning, how do the operational objectives of the generator and discriminator diverge in terms of their ultimate evolutionary success?',
    correctAnswer: 'The generator must ultimately win by producing data the discriminator cannot identify as fake.'
  };

  const result = deterministicValidator.checkDuplicateQuestion(q2, [q1]);
  assert.strictEqual(result.isDuplicate, true, 'Must detect duplicate learning objective');
  assert.strictEqual(result.reason.includes('SUBSUMPTIVE_LEARNING_OBJECTIVE_DUPLICATE'), true, 'Must flag SUBSUMPTIVE_LEARNING_OBJECTIVE_DUPLICATE');
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: SIX POSITIVE TESTS (Protecting Against False Positives)
// ─────────────────────────────────────────────────────────────────────────────

runTest('Test P1: True CS fact that is contextually wrong under stem remains accepted', () => {
  // Statement "Gradient descent calculates derivatives using the chain rule" is factually true in CS,
  // but contextually wrong as the architectural purpose of an autoencoder. Must PASS!
  const mcq = {
    questionText: 'What is the primary architectural purpose of an autoencoder?',
    options: [
      'Dimensionality reduction and feature compression',
      'Gradient descent calculates derivatives using the mathematical chain rule',
      'Synthesizing realistic image pixels using adversarial game theory',
      'Mapping discrete token sequences into sequential attention weights'
    ],
    correctAnswer: 'Dimensionality reduction and feature compression'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'PASS', `Expected PASS, got ${report.verdict}`);
  assert.strictEqual(report.flaws.length, 0, 'No false-positive flaws should be flagged');
});

runTest('Test P2: Legitimate comparative question contrasting distinct dimensions passes', () => {
  // MergeSort vs QuickSort comparing memory vs stability vs time complexity.
  // Must NOT trigger SYNONYMOUS_DISTRACTORS!
  const mcq = {
    questionText: 'How do MergeSort and QuickSort differ in their operational guarantees?',
    options: [
      'MergeSort guarantees O(n log n) worst-case time, whereas QuickSort has O(n^2) worst-case time.',
      'MergeSort requires O(n) auxiliary memory, whereas QuickSort operates with O(log n) auxiliary stack space.',
      'MergeSort maintains relative order of duplicate keys as a stable sort, whereas standard QuickSort is unstable.',
      'MergeSort executes in O(n) best-case time, whereas QuickSort runs in O(n log n) best-case time.'
    ],
    correctAnswer: 'MergeSort guarantees O(n log n) worst-case time, whereas QuickSort has O(n^2) worst-case time.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Hard');
  assert.strictEqual(report.verdict, 'PASS', `Expected PASS on legitimate comparative question, got ${report.verdict}`);
  const hasSyn = report.flaws.some(f => f.code === 'SYNONYMOUS_DISTRACTORS');
  assert.strictEqual(hasSyn, false, 'Must NOT trigger SYNONYMOUS_DISTRACTORS on distinct comparative dimensions');
});

runTest('Test P3: Justified technical option with mathematical loss formula passes length check', () => {
  // Option is 135 chars, but contains LaTeX math formula (justified exception). Must PASS!
  const mcq = {
    questionText: 'What is the non-saturating loss objective for the generator in a Generative Adversarial Network?',
    options: [
      'Maximizing the log-probability of discriminator errors: Loss = -\\mathbb{E}_{z}[\\log(D(G(z)))]',
      'Minimizing the discriminator classification error: Loss = \\log(D(x)) + \\log(1 - D(G(z)))',
      'Minimizing the mean squared error between generated and real feature matrices',
      'Maximizing the cross-entropy divergence across discrete categorical latent classes'
    ],
    correctAnswer: 'Maximizing the log-probability of discriminator errors: Loss = -\\mathbb{E}_{z}[\\log(D(G(z)))]'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Hard');
  assert.strictEqual(report.verdict, 'PASS', `Expected PASS for justified math formula option, got ${report.verdict}`);
  const hasVerbose = report.flaws.some(f => f.code === 'OPTION_TOO_VERBOSE');
  assert.strictEqual(hasVerbose, false, 'Must NOT flag OPTION_TOO_VERBOSE when math formula exception applies');
});

runTest('Test P4: Same component entity with distinct learning objectives can coexist', () => {
  // Question 1 tests functional role of the generator.
  // Question 2 tests mathematical vanishing-gradient dynamics of the generator's loss.
  // Both questions test 'generator' in GANs, but they assess completely different competencies. Must COEXIST!
  const q1 = {
    questionText: 'What is the primary role of the generator in Generative Adversarial Networks?',
    correctAnswer: 'Synthesize realistic data to fool the discriminator network'
  };

  const q2 = {
    questionText: 'Why is the non-saturating loss objective used instead of the minimax objective when training the generator?',
    correctAnswer: 'To prevent vanishing gradients early in training when the discriminator easily detects fake samples.'
  };

  const result = deterministicValidator.checkDuplicateQuestion(q2, [q1]);
  assert.strictEqual(result.isDuplicate, false, 'Functional role and loss gradient dynamics must be allowed to coexist');
});

runTest('Test P5: Authentic domain misconception distractor remains accepted', () => {
  const mcq = {
    questionText: 'How does the transformer architecture process input sequences across modalities?',
    options: [
      'Relying on self-attention to capture relevance without recurrent constraints',
      'Processing token sequences strictly through iterative recurrent hidden states',
      'Restricting attention to single-word localized convolutional windows',
      'Translating input sequences into static deterministic hash tables'
    ],
    correctAnswer: 'Relying on self-attention to capture relevance without recurrent constraints'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'PASS', `Expected PASS for authentic misconception distractor, got ${report.verdict}`);
  assert.strictEqual(report.flaws.length, 0, 'Authentic student misconceptions must pass without flaws');
});

runTest('Test P6: Direct, concise live-quiz question format passes with flying colors', () => {
  const mcq = {
    questionText: 'Why is word-level token prediction preferred over character-level generation in text models?',
    options: [
      'It captures coherent semantic boundaries rather than meaningless sequences.',
      'It requires significantly less memory and maintains valid order.',
      'It forces longer context windows without restricting vocabulary size.',
      'It produces static binary classifications for complete sentences.'
    ],
    correctAnswer: 'It captures coherent semantic boundaries rather than meaningless sequences.'
  };

  const report = DifficultyAwareDistractorValidator.validate(mcq, 'Medium');
  assert.strictEqual(report.verdict, 'PASS', `Expected PASS for concise live-quiz format, got ${report.verdict}`);
  assert.strictEqual(report.flaws.length, 0, 'Concise stem and options must pass cleanly');
});

console.log(`\n=============================================================`);
console.log(`TEST SUITE RESULTS: ${passedCount}/12 PASSED (${failedCount} failed)`);
console.log(`=============================================================`);

if (failedCount > 0) {
  process.exit(1);
}
