process.env.NODE_ENV = 'test';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const independentAnswerVerifier = require('../engine/validators/independentAnswerVerifier');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const llmRouter = require('../engine/adapter/llmRouter');

console.log('========================================================================');
console.log('🧪 REMEDIATION 2 REGRESSION SUITE: TECHNICAL CORRECTNESS & DEFECT GATING');
console.log('========================================================================\n');

let passed = 0;
let total = 0;

async function runCheckAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(` ✅ PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(` ❌ FAIL [${total}]: ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAll() {
  // ──────────────────────────────────────────────────────────────────────────
  // NEGATIVE TESTS (Historical Defects 1-5 Must Be Rejected)
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Defect Class 1: L1 Q2 (Word vs Char Meaningless Data)
  await runCheckAsync('1. Defect Class 1: L1 Q2 (Word vs Char Meaningless Data) must be rejected', async () => {
    const mcq = {
      questionText: 'Why is word-level language generation preferred over character-level generation in large models?',
      options: [
        'Word generation avoids producing meaningless data.',
        'Character models require less memory.',
        'Word models cannot represent rare terms.',
        'Character models have smaller vocabularies.'
      ],
      correctAnswer: 'Word generation avoids producing meaningless data.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' }
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Lecture transcript', { skipLLM: true });
    assert.strictEqual(res.passed, false, 'Expected Defect Class 1 to fail evaluation');
  });

  // 2. Defect Class 2: L1 Q3 (Generative AI executes actions)
  await runCheckAsync('2. Defect Class 2: L1 Q3 (Inverted AI Paradigm Definition) must be rejected', async () => {
    const mcq = {
      questionText: 'What is the fundamental difference between Predictive AI and Generative AI?',
      options: [
        'Generative AI executes actions, whereas Predictive AI produces results then and there.',
        'Predictive AI models probabilities while Generative AI cannot.',
        'Predictive AI creates new content while Generative AI classifies.',
        'Both produce only deterministic outputs.'
      ],
      correctAnswer: 'Generative AI executes actions, whereas Predictive AI produces results then and there.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Lecture transcript', { skipLLM: true });
    assert.strictEqual(res.passed, false, 'Expected Defect Class 2 to fail evaluation');
  });

  // 3. Defect Class 3: L1 Q4 (N-gram N Preceding Words Off-by-One)
  await runCheckAsync('3. Defect Class 3: L1 Q4 (N-gram N Preceding Words Off-by-One) must be rejected deterministically', async () => {
    const mcq = {
      questionText: 'In an N-gram language model, how many preceding words are used to predict the next word?',
      options: ['N', 'N - 1', 'N + 1', '1'],
      correctAnswer: 'N',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'RECALL' }
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'RECALL' };
    // Test deterministic validator pre-check directly
    const preCheck = deterministicValidator.validateTechnicalInvariants(mcq);
    assert.strictEqual(preCheck.isValid, false, 'Expected deterministic invariant check to catch off-by-one error');
    assert(preCheck.errors.some(e => e.includes('N - 1')), 'Expected error details mentioning N - 1 requirement');

    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Lecture transcript', { skipLLM: true });
    assert.strictEqual(res.passed, false, 'Expected Defect Class 3 to fail evaluation');
  });

  // 4. Defect Class 4: L1 Q5 (Nash Equilibrium Winner Collision)
  await runCheckAsync('4. Defect Class 4: L1 Q5 (Nash Equilibrium Winner Collision) must be rejected', async () => {
    const mcq = {
      questionText: 'What occurs when a GAN reaches Nash equilibrium?',
      options: [
        'The generator completely defeats the discriminator.',
        'Both networks converge to equal performance where discriminator output is 0.5.',
        'The discriminator loss drops to zero.',
        'The generator stops generating new samples.'
      ],
      correctAnswer: 'The generator completely defeats the discriminator.',
      metadata: { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' }
    };
    const target = { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Lecture transcript', { skipLLM: true });
    assert.strictEqual(res.passed, false, 'Expected Defect Class 4 to fail evaluation');
  });

  // 5. Defect Class 5: L1 Q6 (Modern LLMs Are Paired Encoder-Decoder)
  await runCheckAsync('5. Defect Class 5: L1 Q6 (Modern LLMs Are Paired Encoder-Decoder) must be rejected', async () => {
    const mcq = {
      questionText: 'Which architecture serves as the standard for modern autoregressive large language models?',
      options: [
        'Paired encoder-decoder architecture as the standard for modern LLMs.',
        'Decoder-only Transformer architecture.',
        'Recurrent neural network with LSTM cells.',
        'Convolutional sequence model.'
      ],
      correctAnswer: 'Paired encoder-decoder architecture as the standard for modern LLMs.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' }
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Lecture transcript', { skipLLM: true });
    assert.strictEqual(res.passed, false, 'Expected Defect Class 5 to fail evaluation');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POSITIVE TESTS (Technically Sound Questions Must Pass)
  // ──────────────────────────────────────────────────────────────────────────

  // 6. Sound GAN Formulation (L1 Q1)
  await runCheckAsync('6. L1 Q1: Technically sound GAN Minimax formulation passes', async () => {
    const mcq = {
      questionText: 'In a Generative Adversarial Network, what mathematical formulation governs the interaction between the generator and discriminator?',
      options: [
        'Minimax two-player game optimization where discriminator maximizes log likelihood and generator minimizes log(1-D).',
        'Standard gradient descent on mean squared error between latent vector and output.',
        'Unsupervised clustering using k-means on feature representations.',
        'Reinforcement learning with fixed rewards based on cross-entropy loss.'
      ],
      correctAnswer: 'Minimax two-player game optimization where discriminator maximizes log likelihood and generator minimizes log(1-D).',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' }
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' };
    const evidence = 'In a GAN, the generator and discriminator engage in a minimax game formulation where the generator attempts to minimize the loss while discriminator maximizes classification accuracy.';
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, evidence, { skipLLM: true });
    assert.strictEqual(res.passed, true, `Expected sound GAN question to pass, got failure: ${res.failureReason}`);
  });

  // 7. Sound ReLU Question (L2 Q1)
  await runCheckAsync('7. L2 Q1: Technically sound ReLU omission linearity passes', async () => {
    const mcq = {
      questionText: 'What is the mathematical consequence of omitting non-linear activation functions like ReLU in a multi-layer neural network?',
      options: [
        'The entire network collapses mathematically into a single linear transformation.',
        'Gradients explode exponentially during backward propagation.',
        'Weights can no longer be updated via stochastic gradient descent.',
        'The loss function becomes strictly convex and impossible to optimize.'
      ],
      correctAnswer: 'The entire network collapses mathematically into a single linear transformation.',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };
    const target = { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' };
    const evidence = 'Without non-linear activation functions, stacking linear layers simply results in another linear transformation, preventing the network from learning non-linear functions.';
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, evidence, { skipLLM: true });
    assert.strictEqual(res.passed, true, `Expected sound ReLU question to pass, got failure: ${res.failureReason}`);
  });

  // 8. Safe Harbor: Attributed Classroom Analogy
  await runCheckAsync('8. Safe Harbor: Attributed classroom analogy passes as source comprehension', async () => {
    const mcq = {
      questionText: 'In the classroom analogy illustrating GAN dynamics, what roles do the two competing networks represent?',
      options: [
        'A counterfeiter producing realistic forgeries and an investigator evaluating authenticity.',
        'A compiler translating high-level code and an interpreter executing machine instructions.',
        'A master node distributing compute tasks and worker nodes aggregating metrics.',
        'A binary search algorithm dividing a sorted array into two halves.'
      ],
      correctAnswer: 'A counterfeiter producing realistic forgeries and an investigator evaluating authenticity.',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };
    const target = { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' };
    const evidence = 'To explain GAN dynamics, think of a counterfeiter who tries to produce realistic fake money or forgeries, and an investigator or police officer who tries to detect whether the money is real or fake.';
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, evidence, { skipLLM: true });
    assert.strictEqual(res.passed, true, `Expected attributed analogy to pass under safe harbor, got: ${res.failureReason}`);
  });

  // 9. Legitimate Simplification (BST search O(h))
  await runCheckAsync('9. Legitimate Simplification: BST search worst-case O(h) passes cleanly', async () => {
    const mcq = {
      questionText: 'In a binary search tree of height h, what is the worst-case time complexity of searching for a key?',
      options: ['O(h)', 'O(1)', 'O(n^2)', 'O(n!)'],
      correctAnswer: 'O(h)',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };
    const target = { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Searching a binary search tree takes O(h) time proportional to height h.', { skipLLM: true });
    assert.strictEqual(res.passed, true, `Expected BST search O(h) to pass, got: ${res.failureReason}`);
  });

  // 10. Easy Fast-Path Bypass Protection Check
  await runCheckAsync('10. Easy Fast-Path Protection: Raw unverified teaching units cannot bypass evaluation', async () => {
    const mcq = {
      questionText: 'Which architecture topology is the defining standard of modern autoregressive Large Language Models?',
      options: [
        'Paired encoder-decoder architecture.',
        'Decoder-only Transformer architecture.',
        'Convolutional neural network topology.',
        'Recurrent neural network with LSTM cells.'
      ],
      correctAnswer: 'Paired encoder-decoder architecture.',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };
    // Target with unverified transcript teaching unit
    const target = {
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL',
      teachingUnit: { isPreVerifiedFact: false, statement: 'Modern models are discussed in the lecture.' }
    };
    const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Unverified transcript excerpt', { skipLLM: true });
    assert.notStrictEqual(res.verificationMethod, 'DETERMINISTIC_RECALL_FAST_PATH', 'Must not use DETERMINISTIC_RECALL_FAST_PATH for unverified teaching unit');
    assert.strictEqual(res.passed, false, 'Must reject flawed question even when Easy');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DEDICATED TIMEOUT & FALLBACK TESTS (Easy-Tier Fail-Closed & Telemetry)
  // ──────────────────────────────────────────────────────────────────────────

  // 11. Easy Fallback: Unverified Easy question fails closed on evaluator timeout
  await runCheckAsync('11. Easy Fallback: Unverified Easy question fails closed on evaluator timeout', async () => {
    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => { throw new Error('Agent 3 LLM evaluation timed out after 35s'); };
    try {
      const mcq = {
        questionText: 'What is a core property of an activation function in neural networks?',
        options: [
          'It introduces non-linearity into the network model.',
          'It eliminates all negative values permanently.',
          'It restricts weights to integer values.',
          'It resets gradients to zero at every epoch.'
        ],
        correctAnswer: 'It introduces non-linearity into the network model.',
        metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
      };
      const target = {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        teachingUnit: { isPreVerifiedFact: false, statement: 'Activation functions are discussed.' }
      };
      const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'In neural networks, activation functions are discussed extensively during training.');
      assert.strictEqual(res.passed, false, 'Unverified Easy question must fail closed on timeout');
      assert(
        res.failureReasons.includes('SEMANTIC_EVALUATION_UNAVAILABLE') || res.failureReasons.includes('UNVERIFIED_TECHNICAL_CLAIM'),
        'Must flag semantic evaluation unavailable or unverified technical claim'
      );
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  // 12. Easy Fallback: Pre-verified Easy fact preserves ground-truth acceptance on timeout
  await runCheckAsync('12. Easy Fallback: Pre-verified Easy fact preserves ground-truth acceptance on timeout', async () => {
    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => { throw new Error('Agent 3 LLM evaluation timed out after 35s'); };
    try {
      const mcq = {
        questionText: 'What is a core property of an activation function in neural networks?',
        options: [
          'It introduces non-linearity into the network model.',
          'It eliminates all negative values permanently.',
          'It restricts weights to integer values.',
          'It resets gradients to zero at every epoch.'
        ],
        correctAnswer: 'It introduces non-linearity into the network model.',
        metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
      };
      const target = {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        teachingUnit: { isPreVerifiedFact: true, statement: 'Activation functions introduce non-linearity into network models.' }
      };
      const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'Activation functions introduce non-linearity into network models.');
      assert.strictEqual(res.passed, true, 'Pre-verified Easy fact must pass on timeout');
      assert(
        res.verificationMethod === 'DETERMINISTIC_RECALL_FAST_PATH' || res.verificationMethod === 'PRE_VERIFIED_GROUND_TRUTH_FALLBACK',
        `Expected pre-verified method, got: ${res.verificationMethod}`
      );
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  // 13. Easy Fallback: Source-supported but technically incorrect Easy question is rejected on timeout
  await runCheckAsync('13. Easy Fallback: Source-supported but technically incorrect Easy question is rejected on timeout', async () => {
    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => { throw new Error('Agent 3 LLM evaluation timed out after 35s'); };
    try {
      const mcq = {
        questionText: 'In an N-gram language model, how many preceding words are used to predict the next word?',
        options: ['N', 'N - 1', 'N + 1', '1'],
        correctAnswer: 'N',
        metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
      };
      const target = {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        teachingUnit: { isPreVerifiedFact: false, statement: 'In N-gram models, N preceding words are evaluated.' }
      };
      const res = await agent3Evaluator.evaluateQuestion(mcq, target, 'In N-gram models, N preceding words are evaluated.');
      assert.strictEqual(res.passed, false, 'Technically flawed Easy question must fail closed');
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  // 14. Easy Fallback: Valid attributed classroom analogy preserves safe harbor on timeout
  await runCheckAsync('14. Easy Fallback: Valid attributed classroom analogy preserves safe harbor on timeout', async () => {
    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => { throw new Error('Agent 3 LLM evaluation timed out after 35s'); };
    try {
      const mcq = {
        questionText: 'In the classroom analogy illustrating GAN dynamics, what roles do the two competing networks represent?',
        options: [
          'A counterfeiter producing realistic forgeries and an investigator evaluating authenticity.',
          'A database server storing records and a client application querying tables.',
          'A compiler parsing tokens and an interpreter executing bytecode.',
          'A network router forwarding packets and a firewall inspecting headers.'
        ],
        correctAnswer: 'A counterfeiter producing realistic forgeries and an investigator evaluating authenticity.',
        metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
      };
      const target = {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        teachingUnit: { isPreVerifiedFact: false, statement: 'Teacher compares GAN to counterfeiter and investigator.' }
      };
      const res = await agent3Evaluator.evaluateQuestion(
        mcq,
        target,
        'To explain GAN dynamics, in the classroom analogy the instructor compared the generator to a counterfeiter producing fake bills and the discriminator to an investigator.'
      );
      assert.strictEqual(res.passed, true, 'Attributed classroom analogy must pass under safe harbor fallback');
      assert.strictEqual(res.verificationMethod, 'SAFE_HARBOR_ANALOGY_FALLBACK');
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} / ${total} TESTS PASSED CLEANLY (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
