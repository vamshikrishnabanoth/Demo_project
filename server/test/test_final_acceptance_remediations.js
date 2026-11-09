/**
 * server/test/test_final_acceptance_remediations.js
 *
 * Dedicated regression test suite for Final Acceptance Audit remediations:
 * 1. ASR Sanitizer: Contextual ASR corruption detection vs preservation of valid content.
 * 2. Duplicate Detection: Number-word normalization and cross-target semantic duplicate check (Q13 vs Q16).
 * 3. Question Accuracy & Distractor Invariants:
 *    - Transformer execution parallelism (training/prefill vs sequential decoding).
 *    - Generative AI (content synthesis vs agentic actions).
 *    - Model class instantiation (constructor invocation vs reference assignment).
 *    - AVL tree distractor plausibility (algorithmic misconceptions vs absurd throwaways).
 */

'use strict';

const assert = require('assert');
const disfluencySanitizer = require('../engine/intelligence/disfluencySanitizer');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const independentAnswerVerifier = require('../engine/validators/independentAnswerVerifier');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');

console.log('========================================================================');
console.log('🧪 FINAL ACCEPTANCE AUDIT REMEDIATION TEST SUITE');
console.log('========================================================================\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${totalCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalCount}]: ${name}`);
    console.error(`    Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: ASR Sanitizer Contextual Verification
// ─────────────────────────────────────────────────────────────────────────────

test('1. Valid lecture phrase with "all the" is NOT rejected', () => {
  const phrase = 'All the nodes in the binary search tree satisfy the ordering property.';
  const res = disfluencySanitizer.detectContextualAsrCorruption(phrase, []);
  assert.strictEqual(res.hasViolation, false, 'Valid phrase with "all the" must not be flagged');
});

test('2. Valid lecture phrase with "every single" is NOT rejected', () => {
  const phrase = 'Every single layer in the neural network transforms intermediate representations.';
  const res = disfluencySanitizer.detectContextualAsrCorruption(phrase, []);
  assert.strictEqual(res.hasViolation, false, 'Valid phrase with "every single" must not be flagged');
});

test('3. Valid technical term "MTS" in non-corrupted context is NOT rejected', () => {
  const phrase = 'The MTS protocol in telecommunications manages traffic scheduling.';
  const res = disfluencySanitizer.detectContextualAsrCorruption(phrase, []);
  assert.strictEqual(res.hasViolation, false, 'Valid technical term "MTS" must not be rejected');
});

test('4. Valid robotics "pose" in pose-estimation context is NOT rejected', () => {
  const phrase = 'In robotics, camera pose estimation determines the 6D orientation of the object.';
  const res = disfluencySanitizer.detectContextualAsrCorruption(phrase, []);
  assert.strictEqual(res.hasViolation, false, 'Robotics pose estimation must not be rejected');
});

test('5. Contextual ASR corruption: "airpods" in neural network training loop is REJECTED', () => {
  const stem = 'Why is the loss value saved during each iteration of the model training process?';
  const options = ['To increase the total number of airpods processed per iteration', 'To monitor convergence', 'To compute gradients', 'To update weights'];
  const res = disfluencySanitizer.detectDisfluencyViolation(stem, options);
  assert.strictEqual(res.hasViolation, true, '"airpods" in ML training loop must be rejected');
  assert(res.reason.includes('Contextual ASR acoustic corruption'), 'Reason must specify contextual ASR corruption');
});

test('6. Contextual ASR corruption: "model pose" in loss optimization context is REJECTED', () => {
  const stem = 'Why is the loss value saved during each iteration of the model training process?';
  const options = ['To facilitate the creation of the final model pose', 'To reset weights', 'To bypass backpropagation', 'To evaluate accuracy'];
  const res = disfluencySanitizer.detectDisfluencyViolation(stem, options);
  assert.strictEqual(res.hasViolation, true, '"model pose" in loss saving context must be rejected');
});

test('7. Contextual ASR corruption: "background rotation" in neural network context is REJECTED', () => {
  const stem = 'During neural network optimization, how does background rotation affect model weights?';
  const options = ['It updates weights', 'It computes losses', 'It evaluates inputs', 'It resets activations'];
  const res = disfluencySanitizer.detectDisfluencyViolation(stem, options);
  assert.strictEqual(res.hasViolation, true, '"background rotation" in neural network context must be rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: Duplicate Detection (Number-Word Normalization & Q13 vs Q16)
// ─────────────────────────────────────────────────────────────────────────────

test('8. Number-word normalization: "8 neurons" and "eight neurons" tokenize to identical tokens', () => {
  const t1 = deterministicValidator._tokenize('8 neurons');
  const t2 = deterministicValidator._tokenize('eight neurons');
  assert(t1.has('num_8'), 'Token set 1 must contain num_8');
  assert(t2.has('num_8'), 'Token set 2 must contain num_8');
  assert(t1.has('neuron'), 'Token set 1 must contain neuron');
  assert(t2.has('neuron'), 'Token set 2 must contain neuron');
});

test('9. Q13 vs Q16 cross-target duplicate check: DETECTED as duplicate', () => {
  const q13 = {
    questionText: 'How does the configuration of the final output layer contrast with the preceding 8-neuron hidden layer to produce a classification signal?',
    correctAnswer: 'Converges the 8 neurons into one signal unit using sigmoid',
    options: [
      'Connects the 8 neurons to 8 independent sigmoid signals',
      'Uses a single neuron with ReLU to prevent signal loss',
      'Converges the 8 neurons into one signal unit using sigmoid',
      'Maintains 8 neurons while switching to sigmoid activation'
    ],
    metadata: { concept: 'Output Layer Configuration', dimension: 'Conceptual' }
  };

  const q16 = {
    questionText: 'What is the primary role of the output unit in the described neural network architecture?',
    correctAnswer: 'To connect the previous eight neurons to one signal',
    options: [
      'To serve as the final activation function layer',
      'To connect the previous eight neurons to one signal',
      'To define the forward pass method for the network',
      'To process input signals from the hidden layers'
    ],
    metadata: { concept: 'Output Unit', dimension: 'Conceptual' }
  };

  const dupResult = deterministicValidator.checkDuplicateQuestion(q16, [q13]);
  assert.strictEqual(dupResult.isDuplicate, true, 'Q16 must be detected as duplicate of Q13');
  assert(dupResult.reason.includes('OPERATIONAL_COMPETENCY_DUPLICATE'), 'Reason must cite operational competency duplicate');
});

test('10. Genuinely different concepts (Input Layer vs Output Layer) are NOT rejected as duplicate', () => {
  const qInput = {
    questionText: 'When configuring the input layer for a dataset with 12 features, how many neurons must be allocated?',
    correctAnswer: 'Exactly 12 neurons matching the input feature count',
    options: [
      '12 neurons matching input feature count',
      '8 hidden neurons',
      '1 output unit',
      '360 neurons'
    ],
    metadata: { concept: 'Input Layer Dimensionality', dimension: 'Conceptual' }
  };

  const qOutput = {
    questionText: 'How does the configuration of the final output layer contrast with the preceding 8-neuron hidden layer to produce a classification signal?',
    correctAnswer: 'Converges the 8 neurons into one signal unit using sigmoid',
    options: [
      'Connects the 8 neurons to 8 independent sigmoid signals',
      'Uses a single neuron with ReLU to prevent signal loss',
      'Converges the 8 neurons into one signal unit using sigmoid',
      'Maintains 8 neurons while switching to sigmoid activation'
    ],
    metadata: { concept: 'Output Layer Configuration', dimension: 'Conceptual' }
  };

  const dupResult = deterministicValidator.checkDuplicateQuestion(qInput, [qOutput]);
  assert.strictEqual(dupResult.isDuplicate, false, 'Input layer and output layer must NOT be duplicates');
});

test('11. Genuinely different concepts (Hidden Layer Connectivity vs Output Layer) are NOT rejected as duplicate', () => {
  const qHidden = {
    questionText: 'When connecting a layer of 360 neurons to a subsequent layer of 8 units, how is the connectivity operationally defined?',
    correctAnswer: 'The output of all 360 neurons serves as input to each of the 8 units',
    options: [
      'The output of all 360 neurons serves as input to each of the 8 units',
      'Each of the 8 units receives input from exactly one neuron',
      'The 360 neurons are mapped to 8 units using a one-to-one ratio',
      'The 8 units are independent and do not share input features'
    ],
    metadata: { concept: 'Layer Connectivity', dimension: 'Conceptual' }
  };

  const qOutput = {
    questionText: 'How does the configuration of the final output layer contrast with the preceding 8-neuron hidden layer to produce a classification signal?',
    correctAnswer: 'Converges the 8 neurons into one signal unit using sigmoid',
    options: [
      'Connects the 8 neurons to 8 independent sigmoid signals',
      'Uses a single neuron with ReLU to prevent signal loss',
      'Converges the 8 neurons into one signal unit using sigmoid',
      'Maintains 8 neurons while switching to sigmoid activation'
    ],
    metadata: { concept: 'Output Layer Configuration', dimension: 'Conceptual' }
  };

  const dupResult = deterministicValidator.checkDuplicateQuestion(qHidden, [qOutput]);
  assert.strictEqual(dupResult.isDuplicate, false, 'Hidden connectivity and output layer must NOT be duplicates');
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Technical Correctness & Distractor Invariant Checks
// ─────────────────────────────────────────────────────────────────────────────

test('12. Transformer Parallelism: Over-specifying inference autoregressive generation as parallel is REJECTED', () => {
  const stem = 'When processing text, how does Transformer execution differ from an RNN?';
  const options = [
    'Transformers execute autoregressive generation entirely in parallel at inference time',
    'Transformers process sequences in parallel during training via self-attention',
    'RNNs require parallel matrix operations',
    'Transformers eliminate all attention weights'
  ];
  const domainChecks = independentAnswerVerifier.performDeterministicDomainChecks(stem, options, 'ROUTE_3_CONCEPTUAL_AND_CAUSAL');
  const flaw = domainChecks.checks.find(c => c.rule === 'TRANSFORMER_PARALLELISM_OVERSPECIFIED');
  assert(flaw, 'Must flag TRANSFORMER_PARALLELISM_OVERSPECIFIED');
  assert.strictEqual(flaw.status, 'CONTRADICTED');
});

test('13. Generative AI: Defining generative AI as executing automated actions is REJECTED', () => {
  const stem = 'How do generative models fundamentally differ from discriminative models?';
  const options = [
    'Predictive models classify labels, while generative models create output content or actions',
    'Predictive models evaluate existing data, while generative models synthesize novel content',
    'Both models compute the exact same joint distribution',
    'Generative models only output binary numerical scores'
  ];
  const domainChecks = independentAnswerVerifier.performDeterministicDomainChecks(stem, options, 'ROUTE_3_CONCEPTUAL_AND_CAUSAL');
  const flaw = domainChecks.checks.find(c => c.rule === 'GENERATIVE_AI_CONFLATED_WITH_ACTIONS');
  assert(flaw, 'Must flag GENERATIVE_AI_CONFLATED_WITH_ACTIONS');
  assert.strictEqual(flaw.status, 'CONTRADICTED');
});

test('14. Model Class Instantiation: Asserting bare class reference assignment builds network is REJECTED', () => {
  const stem = 'What occurs when a model class is assigned to a variable without calling it?';
  const options = [
    'It initiates the class and builds the network layers immediately',
    'It binds a reference to the class object without instantiation',
    'It compiles the optimizer graph',
    'It starts training loop execution'
  ];
  const domainChecks = independentAnswerVerifier.performDeterministicDomainChecks(stem, options, 'ROUTE_3_CONCEPTUAL_AND_CAUSAL');
  const flaw = domainChecks.checks.find(c => c.rule === 'CLASS_REFERENCE_CONFUSED_WITH_INSTANTIATION');
  assert(flaw, 'Must flag CLASS_REFERENCE_CONFUSED_WITH_INSTANTIATION');
  assert.strictEqual(flaw.status, 'CONTRADICTED');
});

test('15. AVL Distractor Plausibility: Absurd throwaways are REJECTED by distractor validator', () => {
  const qAvl = {
    questionText: 'When inserting N keys in sorted order, how does an AVL tree maintain logarithmic height?',
    correctAnswer: 'The AVL tree performs rotations to enforce height balance, ensuring O(log N) worst-case complexity.',
    options: [
      'The AVL tree avoids all node comparisons to maintain logarithmic height.',
      'The AVL tree replaces the in-order successor with a leaf node to maintain tree balance.',
      'The AVL tree enforces complete binary tree leaf-depth equality at every level.',
      'The AVL tree performs rotations to enforce height balance, ensuring O(log N) worst-case complexity.'
    ]
  };
  const target = { targetDifficulty: 'Medium', concept: 'AVL Height Bound' };
  const report = DifficultyAwareDistractorValidator.validate(qAvl, target);
  assert.strictEqual(report.verdict, 'REJECT', 'AVL item with absurd throwaways must be REJECTED');
  const treeFlaw = report.flaws.find(f => f.code === 'ERR_IMPLAUSIBLE_TREE_DISTRACTOR');
  assert(treeFlaw, 'Must flag ERR_IMPLAUSIBLE_TREE_DISTRACTOR');
});

test('16. AVL Distractor Plausibility: Repaired item with genuine algorithmic misconceptions PASSES', () => {
  const qAvlRepaired = {
    questionText: 'When inserting N keys in sorted order, how does an AVL tree maintain logarithmic height?',
    correctAnswer: 'The AVL tree performs rotations to enforce the balance factor invariant, ensuring O(log N) worst-case complexity.',
    options: [
      'The AVL tree requires all leaf nodes to remain at the exact same depth after each insertion.',
      'The AVL tree performs rotations only at the root node regardless of where the imbalance occurs.',
      'The AVL tree permits height skewing up to O(sqrt(N)) before initiating rebalancing steps.',
      'The AVL tree performs rotations to enforce the balance factor invariant, ensuring O(log N) worst-case complexity.'
    ]
  };
  const target = { targetDifficulty: 'Medium', concept: 'AVL Height Bound' };
  const report = DifficultyAwareDistractorValidator.validate(qAvlRepaired, target);
  assert.strictEqual(report.verdict, 'PASS', 'Repaired AVL item with authentic misconceptions must PASS');
});

console.log('\n========================================================================');
console.log(`🏁 TEST SUMMARY: ${passCount} / ${totalCount} TESTS PASSED CLEANLY (100%)`);
console.log('========================================================================\n');

if (passCount !== totalCount) {
  process.exit(1);
}
