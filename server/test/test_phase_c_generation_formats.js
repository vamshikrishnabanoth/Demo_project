'use strict';

const assert = require('assert');
const agent2Generator = require('../engine/agents/agent2Generator');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE C: GENERATION & FORMAT SELECTION TEST SUITE');
console.log('🧪 ====================================================================');

// Test 1: Format Decoupling in Scaffolding
console.log('\n▶ Test 1: Format decoupling prevents unwanted code snippets on conceptual & calculation questions');
{
  // Conceptual target on an algorithmic topic (Euclidean algorithm)
  const conceptualTarget = {
    targetId: 'T01',
    concept: 'Euclidean Algorithm Foundations',
    dimension: 'Conceptual',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'COMPARE',
    assessmentAngle: 'CONCEPTUAL',
    formatRecommendation: 'PROSE_MULTIPLE_CHOICE'
  };

  const { systemScaffold: concScaffold } = agent2Generator._buildOperationalScaffolding(
    'Medium',
    'COMPARE',
    conceptualTarget.concept,
    'The Euclidean algorithm is an ancient algorithm for computing gcd.',
    null,
    'CONCEPTUAL_CONTRAST',
    conceptualTarget
  );

  assert(concScaffold.includes('CONCEPTUAL PROSE SPECIFICATION'), 'Expected CONCEPTUAL PROSE SPECIFICATION');
  assert(concScaffold.includes('Do NOT include any code blocks'), 'Expected prohibition on code blocks');
  assert(!concScaffold.includes('Include a clean, concise 3–7 line code snippet'), 'Did not expect 3-7 line code snippet instruction');

  console.log('✅ PASS: Conceptual target on algorithmic topic strictly prohibits code snippet');

  // Calculation target on an algorithmic topic
  const calcTarget = {
    targetId: 'T02',
    concept: 'Euclidean Remainder Calculation',
    dimension: 'Quick Calculation',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'CALCULATE',
    assessmentAngle: 'CALCULATION',
    formatRecommendation: 'NUMERICAL_TRACE'
  };

  const { systemScaffold: calcScaffold } = agent2Generator._buildOperationalScaffolding(
    'Medium',
    'CALCULATE',
    calcTarget.concept,
    'The Euclidean algorithm calculates remainder gcd(a, b).',
    null,
    'QUICK_CALCULATION',
    calcTarget
  );

  assert(calcScaffold.includes('CALCULATION & NUMERICAL TRACE SPECIFICATION'), 'Expected CALCULATION & NUMERICAL TRACE SPECIFICATION');
  assert(calcScaffold.includes('Do NOT wrap this in a programming language code block'), 'Expected prohibition on code wrapping');
  assert(!calcScaffold.includes('Include a clean, concise 3–7 line code snippet'), 'Did not expect 3-7 line code snippet instruction');

  console.log('✅ PASS: Calculation target directs numerical evaluation without code snippet');

  // Code analysis target
  const codeTarget = {
    targetId: 'T03',
    concept: 'Euclidean Recursive Call Trace',
    dimension: 'Flow / Trace',
    targetDifficulty: 'Hard',
    intendedCognitiveOperation: 'TRACE',
    assessmentAngle: 'CODE_TRACE',
    formatRecommendation: 'CODE_ANALYSIS'
  };

  const { systemScaffold: codeScaffold } = agent2Generator._buildOperationalScaffolding(
    'Hard',
    'TRACE',
    codeTarget.concept,
    'function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }',
    null,
    'MICRO_TRACE',
    codeTarget
  );

  assert(codeScaffold.includes('CODE ANALYSIS & TRACE QUESTION SPECIFICATION'), 'Expected CODE ANALYSIS & TRACE QUESTION SPECIFICATION');
  assert(codeScaffold.includes('Include a clean, concise 3–7 line code snippet'), 'Expected code snippet instruction for CODE_ANALYSIS');

  console.log('✅ PASS: Code analysis target correctly receives code snippet instruction');
}

// Test 2: Brevity Harmonization (11-15 words per option preserved)
console.log('\n▶ Test 2: Option brevity harmonized to 15 words');
{
  const mcq = {
    questionText: 'What is the mathematical justification for replacing the pair (a, b) with (b, a mod b) in the Euclidean algorithm?',
    options: [
      'Any common divisor of a and b also divides their linear combination including the remainder', // 14 words
      'The smaller number is subtracted repeatedly until reaching zero', // 9 words
      'Modulo arithmetic guarantees that both numbers become prime', // 8 words
      'The quotient is preserved while both factors are halved' // 9 words
    ],
    correctAnswerIndex: 0,
    correctAnswer: 'Any common divisor of a and b also divides their linear combination including the remainder'
  };

  const processed = agent2Generator._enforceBrevity(mcq);
  assert.strictEqual(processed._cannotSafelyTrimBrevity, undefined, 'A 14-word option must NOT trigger brevity failure');
  assert.strictEqual(processed.options[0], mcq.options[0], 'Valid 14-word option must be preserved intact');

  console.log('✅ PASS: High-quality 14-word technical option is preserved intact without false failure');
}

// Test 3: Stem word limit (up to 45 words preserved)
console.log('\n▶ Test 3: Stem word limit preserves up to 45 words');
{
  const longStem = 'In a computer system implementing the Euclidean algorithm for cryptographic key generation, given two 64-bit integers where the remainder is calculated repeatedly, what mathematical property ensures that the greatest common divisor remains invariant throughout all successive iterative reductions?';
  const wordCount = longStem.split(/\s+/).filter(Boolean).length;
  assert(wordCount > 35 && wordCount <= 45, `Word count should be between 36 and 45 (actual: ${wordCount})`);

  const mcq = {
    questionText: longStem,
    options: ['Invariance of common divisors', 'Linear convergence bound', 'Asymptotic logarithm bound', 'Prime residue theorem'],
    correctAnswerIndex: 0,
    correctAnswer: 'Invariance of common divisors'
  };

  const processed = agent2Generator._enforceBrevity(mcq);
  assert.strictEqual(processed._cannotSafelyTrimBrevity, undefined, 'A 38-word stem must NOT trigger brevity failure');
  assert.strictEqual(processed.questionText, longStem, 'Stem <= 45 words preserved without truncation');

  console.log('✅ PASS: Technical stem with 38 words preserved without truncation');
}

console.log('\n======================================================================');
console.log('🎉 ALL PHASE C GENERATION FORMAT TESTS PASSED CLEANLY');
console.log('======================================================================');
