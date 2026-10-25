'use strict';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE D: VALIDATION & REPAIR TEST SUITE');
console.log('🧪 ====================================================================');

// Test 1: Unwanted Code Detection
console.log('\n▶ Test 1: Unwanted code in conceptual prose question triggers FORMAT_MISMATCH_UNWANTED_CODE');
{
  const target = {
    targetId: 'T01',
    concept: 'Euclidean Algorithm Invariance',
    formatRecommendation: 'PROSE_MULTIPLE_CHOICE'
  };

  const candidateWithCode = {
    questionText: 'What does this function compute?\n```python\ndef gcd(a, b):\n    return b\n```',
    options: ['Divisor', 'Remainder', 'Quotient', 'Factor'],
    correctAnswer: 'Divisor',
    correctAnswerIndex: 0
  };

  const evalResult = agent3Evaluator._synthesizeRepairInstruction(
    ['FORMAT_MISMATCH_UNWANTED_CODE'],
    candidateWithCode,
    target
  );

  assert(evalResult.includes('Remove code block/snippet'), 'Expected repair instruction to remove code snippet');
  console.log('✅ PASS: FORMAT_MISMATCH_UNWANTED_CODE produces correct actionable repair instruction');
}

// Test 2: Missing Code Detection
console.log('\n▶ Test 2: Missing code in code analysis question triggers FORMAT_MISMATCH_MISSING_CODE');
{
  const target = {
    targetId: 'T02',
    concept: 'GCD Recursive Call Trace',
    formatRecommendation: 'CODE_ANALYSIS'
  };

  const candidateWithoutCode = {
    questionText: 'What is the base case of recursion?',
    options: ['When b is 0', 'When a is 0', 'When both are 0', 'When remainder is 1'],
    correctAnswer: 'When b is 0',
    correctAnswerIndex: 0
  };

  const evalResult = agent3Evaluator._synthesizeRepairInstruction(
    ['FORMAT_MISMATCH_MISSING_CODE'],
    candidateWithoutCode,
    target
  );

  assert(evalResult.includes('Include a clean 3-7 line code snippet'), 'Expected repair instruction to include code snippet');
  console.log('✅ PASS: FORMAT_MISMATCH_MISSING_CODE produces correct actionable repair instruction');
}

console.log('\n======================================================================');
console.log('🎉 ALL PHASE D VALIDATION & REPAIR TESTS PASSED CLEANLY');
console.log('======================================================================');
