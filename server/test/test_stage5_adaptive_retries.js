/**
 * Stage 5 Verification: Failure-Specific Retries & Reserve Allocation
 */

'use strict';

const assert = require('assert');
const evaluator = require('../engine/agents/agent3Evaluator');

async function runStage5Tests() {
  console.log('--- Testing Stage 5: Failure-Specific Retries ---');

  // Test 1: TIER_COGNITIVE_MISMATCH on Hard target produces concrete trace directive
  {
    console.log('[Test 1] TIER_COGNITIVE_MISMATCH repair instruction formulation');
    const instruction = evaluator._synthesizeRepairInstruction(
      ['TIER_COGNITIVE_MISMATCH'],
      { questionText: 'What does reaching NULL indicate in a BST?' },
      { targetDifficulty: 'Hard', concept: 'BST Search' }
    );
    console.log('  Repair instruction:', instruction);
    assert.ok(instruction.includes('CRITICAL COGNITIVE DEPTH REPAIR'));
    assert.ok(instruction.includes('tracing a concrete numeric sequence, subtree heights, or balance factor violation'));
    console.log('  ✓ Concrete state-trace directive synthesized for Hard cognitive mismatch');
  }

  // Test 2: CORRECT_ANSWER_INDEX_CONFLICT repair instruction
  {
    console.log('[Test 2] CORRECT_ANSWER_INDEX_CONFLICT repair instruction formulation');
    const instruction = evaluator._synthesizeRepairInstruction(
      ['CORRECT_ANSWER_INDEX_CONFLICT'],
      { questionText: 'Which node is the root?' },
      { targetDifficulty: 'Hard', concept: 'AVL Tree' }
    );
    console.log('  Repair instruction:', instruction);
    assert.ok(instruction.includes('correctAnswer matches one of the 4 options verbatim'));
    assert.ok(instruction.includes('correctAnswerIndex corresponds exactly'));
    console.log('  ✓ Key synchronization directive synthesized');
  }

  // Test 3: OPTION_VALIDATION_ERROR distractor instruction
  {
    console.log('[Test 3] OPTION_VALIDATION_ERROR repair instruction');
    const instruction = evaluator._synthesizeRepairInstruction(
      ['OPTION_VALIDATION_ERROR'],
      {},
      { targetDifficulty: 'Hard' }
    );
    assert.ok(instruction.includes('mutually exclusive operational alternatives'));
    console.log('  ✓ Distinct operational alternative requirement synthesized');
  }

  console.log('\n✅ All Stage 5 tests passed successfully!\n');
}

runStage5Tests().catch(err => {
  console.error('❌ Stage 5 test failed:', err);
  process.exit(1);
});
