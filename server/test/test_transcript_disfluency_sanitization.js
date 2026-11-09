/**
 * server/test/test_transcript_disfluency_sanitization.js
 *
 * Test suite for Change 2: Targeted Transcript Disfluency Sanitization
 * Validates Objective 1 (Grounding & Correctness) with strict technical preservation safeguards.
 *
 * Tests:
 * 1. Spoken function-word stutter removal (the the -> the, is is -> is)
 * 2. Technical repetition preservation (log log n, that that condition, node node)
 * 3. Technical words with filler substrings (format, summary, algorithmic, actual)
 * 4. Variable identifiers and code syntax (prices[i] - minprice, model.forward(), nn.Linear(8, 1))
 * 5. Negations and preconditions (without intermediate storage, cannot be negative)
 * 6. Concept phrase filtering (rejects 'Whatever Loss', 'Automatically Eventually Shape', etc.)
 * 7. Zero synthetic guessing (rejects invalid concepts without fabricating replacements)
 * 8. Validator fail-closed pre-check (fails closed on disfluency contamination)
 * 9. Clean technical input invariant (clean MCQs remain 100% untouched)
 * 10. Agent 2 disfluent target rejection (returns UNFULFILLED_DISFLUENT_TARGET)
 */

'use strict';

const assert = require('assert');
const disfluencySanitizer = require('../engine/intelligence/disfluencySanitizer');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const agent2Generator = require('../engine/agents/agent2Generator');

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

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

console.log('========================================================================');
console.log('🧪 CHANGE 2 TEST SUITE: TARGETED TRANSCRIPT DISFLUENCY SANITIZATION');
console.log('========================================================================\n');

// ── Test 1: Spoken function-word stutter removal ──────────────────────────────
runTest('Spoken function-word stutter removal', () => {
  const input = 'This is the the primary mechanism in in the system.';
  const cleaned = disfluencySanitizer.cleanSpokenFiller(input);
  assert.strictEqual(cleaned, 'This is the primary mechanism in the system.');

  const input2 = 'We know that it is is necessary to to verify.';
  const cleaned2 = disfluencySanitizer.cleanSpokenFiller(input2);
  assert.strictEqual(cleaned2, 'We know that it is necessary to verify.');
});

// ── Test 2: Technical repetition preservation ─────────────────────────────────
runTest('Technical repetition preservation (log log n, that that, node node)', () => {
  const complexity = 'The algorithm achieves O(log log n) time complexity.';
  const cleaned1 = disfluencySanitizer.cleanSpokenFiller(complexity);
  assert.strictEqual(cleaned1, complexity, 'O(log log n) must be strictly preserved');

  const linguistic = 'We verify that that condition holds invariant across iterations.';
  const cleaned2 = disfluencySanitizer.cleanSpokenFiller(linguistic);
  assert.strictEqual(cleaned2, linguistic, '"that that" must be preserved');

  const dataStructure = 'Pointer comparison between node node references.';
  const cleaned3 = disfluencySanitizer.cleanSpokenFiller(dataStructure);
  assert.strictEqual(cleaned3, dataStructure, '"node node" must be preserved');
});

// ── Test 3: Technical words with filler substrings ────────────────────────────
runTest('Technical words with filler substrings preserved intact', () => {
  const technical = 'Format the summary using algorithmic and numeric column data under this assumption.';
  const cleaned = disfluencySanitizer.cleanSpokenFiller(technical);
  assert.strictEqual(cleaned, technical, 'Embedded substrings like "um" in summary/numeric must not be corrupted');
});

// ── Test 4: Variable identifiers and code syntax ──────────────────────────────
runTest('Variable identifiers and code syntax preserved', () => {
  const codeExpr = 'Compute max_profit = max(max_profit, prices[i] - minprice);';
  const cleaned1 = disfluencySanitizer.cleanSpokenFiller(codeExpr);
  assert.strictEqual(cleaned1, codeExpr);

  const pyCode = 'self.fc = nn.Linear(8, 1); output = model.forward(x);';
  const cleaned2 = disfluencySanitizer.cleanSpokenFiller(pyCode);
  assert.strictEqual(cleaned2, pyCode);
});

// ── Test 5: Negations and preconditions ───────────────────────────────────────
runTest('Negations and preconditions preserved', () => {
  const condition = 'Executes without intermediate storage and values cannot be negative.';
  const cleaned = disfluencySanitizer.cleanSpokenFiller(condition);
  assert.strictEqual(cleaned, condition, 'Negations and constraints must be strictly preserved');
});

// ── Test 6: Spoken preamble and hesitation marker removal ─────────────────────
runTest('Spoken preambles and hesitation markers removed', () => {
  const spoken = 'Like I said earlier, um, the gradients are propagated backwards.';
  const cleaned = disfluencySanitizer.cleanSpokenFiller(spoken);
  assert.strictEqual(cleaned, 'The gradients are propagated backwards.');

  const hesitation = 'Basically, uh, the activation function compresses values into [0, 1].';
  const cleaned2 = disfluencySanitizer.cleanSpokenFiller(hesitation);
  assert.strictEqual(cleaned2, 'The activation function compresses values into [0, 1].');
});

// ── Test 7: Concept phrase filtering (Rejection over Invention) ───────────────
runTest('Concept phrase filtering: rejects disfluencies and ASR speech fragments', () => {
  const invalidPhrases = [
    'Whatever Loss',
    'Automatically Eventually Shape',
    'Something Else',
    'Create Making Input',
    'Play Redo Activation Function',
    'Play As Input',
    'Getting The Output',
    'Specifically Mention',
    'Convert Model Equal',
    'Leave The',
    'Automatically The Class',
    'Ll Play Redo',
    'Once This Model'
  ];

  invalidPhrases.forEach(phrase => {
    const isValid = disfluencySanitizer.isValidConceptPhrase(phrase);
    assert.strictEqual(isValid, false, `Expected "${phrase}" to be REJECTED as invalid concept`);
  });

  const validPhrases = [
    'Input Features',
    'Output Unit',
    'Activation Function',
    'Binary Search Tree',
    'Loss Function',
    'Singly Linked List',
    'Early Stopping',
    'Dynamic Programming',
    'Gradient Descent',
    'Instantiating the Model'
  ];

  validPhrases.forEach(phrase => {
    const isValid = disfluencySanitizer.isValidConceptPhrase(phrase);
    assert.strictEqual(isValid, true, `Expected "${phrase}" to be ACCEPTED as valid instructional concept`);
  });
});

// ── Test 8: Validator pre-check fails closed on disfluency contamination ──────
runTest('Deterministic validator fails closed on contaminated questions', () => {
  const contaminatedStems = [
    'What happens um when the model processes input?',
    'What happens when the the system updates loss?',
    'What happens when model is executed after writing to put the dot in it?',
    'What happens if we choose option A or whatever?'
  ];

  contaminatedStems.forEach(stem => {
    const mcq = {
      targetId: 't_disfluency_test',
      questionText: stem,
      options: ['Option Alpha', 'Option Beta', 'Option Gamma', 'Option Delta'],
      correctAnswerIndex: 0,
      correctAnswer: 'Option Alpha'
    };
    const preCheck = deterministicValidator.runPreChecks(mcq);
    assert.strictEqual(preCheck.isValid, false, `Stem "${stem}" should fail preCheck`);
    const hasDisfluencyError = preCheck.errors.some(e => e.startsWith('CONVERSATIONAL_DISFLUENCY_CONTAMINATION:'));
    assert.strictEqual(hasDisfluencyError, true, `PreCheck errors should contain CONVERSATIONAL_DISFLUENCY_CONTAMINATION for "${stem}"`);
  });
});

// ── Test 9: Clean technical MCQ passes pre-check with zero errors ─────────────
runTest('Clean technical MCQ passes pre-check without disfluency warnings', () => {
  const cleanMcq = {
    targetId: 't_clean_test',
    questionText: 'What is the tightest upper bound of binary search tree lookups in the worst case?',
    options: ['O(log log n)', 'O(log n)', 'O(n)', 'O(1)'],
    correctAnswerIndex: 2,
    correctAnswer: 'O(n)'
  };
  const preCheck = deterministicValidator.runPreChecks(cleanMcq);
  assert.strictEqual(preCheck.isValid, true, `Clean MCQ should pass preCheck. Errors: ${JSON.stringify(preCheck.errors)}`);
});

// ── Test 10: Agent 2 rejects disfluent target before LLM generation ───────────
(async () => {
  await runAsyncTest('Agent 2 rejects conversational disfluency target without LLM invocation', async () => {
    const disfluentTarget = {
      targetId: 'target_whatever_loss',
      concept: 'Whatever Loss',
      difficulty: 'Medium',
      instruction: 'Test whatever loss calculation'
    };
    const result = await agent2Generator.generateQuestion(disfluentTarget, { unifiedRawContent: 'Some lecture text' });
    assert.strictEqual(result.isUnfulfilled, true, 'Result should be unfulfilled');
    assert.strictEqual(result.fulfillmentStatus, 'UNFULFILLED_DISFLUENT_TARGET', 'Status should indicate disfluent target');
    assert.strictEqual(result.unfulfilledReason, 'CONVERSATIONAL_DISFLUENCY_TARGET', 'Reason should be CONVERSATIONAL_DISFLUENCY_TARGET');
  });

  console.log(`\n========================================================================`);
  console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log(`========================================================================\n`);
  process.exit(0);
})().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
