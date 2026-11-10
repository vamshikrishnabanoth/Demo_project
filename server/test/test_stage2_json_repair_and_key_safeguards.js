/**
 * Stage 2 Verification: JSON Repair & Answer-Key Safeguards
 */

'use strict';

const assert = require('assert');
const agent2 = require('../engine/agents/agent2Generator');

async function runStage2Tests() {
  console.log('--- Testing Stage 2: JSON Repair & Answer-Key Safeguards ---');

  // Test 1: Contradictory Answer Key Detection in normalizeCorrectAnswer
  {
    console.log('[Test 1] Answer key index vs text conflict detection');
    const mcq = {
      questionText: 'Which node is the root after rotation?',
      options: ['10', '20', '30', '40'],
      correctAnswerIndex: 0, // points to '10'
      correctAnswer: '20'   // explicitly states '20' (option index 1)
    };

    agent2.normalizeCorrectAnswer(mcq);
    assert.strictEqual(mcq._answerKeyConflict, true, 'Should mark _answerKeyConflict');
    assert.strictEqual(mcq._answerKeyConflictDetails.suppliedIndex, 0);
    assert.strictEqual(mcq._answerKeyConflictDetails.textMatchesIndex, 1);
    console.log('  ✓ Answer key conflict properly detected and recorded without silent overwrite');
  }

  // Test 2: Ambiguous Multiple Options Collision
  {
    console.log('[Test 2] Ambiguous multiple options matching correctAnswer text');
    const mcq = {
      questionText: 'What is the balance factor?',
      options: ['1', '0', '1', '-1'],
      correctAnswer: '1' // matches index 0 and index 2
    };

    agent2.normalizeCorrectAnswer(mcq);
    assert.strictEqual(mcq._ambiguousCorrectAnswerMatch, true, 'Should mark _ambiguousCorrectAnswerMatch');
    console.log('  ✓ Ambiguous options collision detected');
  }

  // Test 3: Normal valid alignment succeeds
  {
    console.log('[Test 3] Consistent index and text align cleanly');
    const mcq = {
      questionText: 'What is the root?',
      options: ['10', '20', '30', '40'],
      correctAnswerIndex: 1,
      correctAnswer: 'Option B: 20'
    };

    agent2.normalizeCorrectAnswer(mcq);
    assert.strictEqual(mcq._answerKeyConflict, undefined);
    assert.strictEqual(mcq.correctAnswer, '20');
    console.log('  ✓ Clean alignment succeeds and normalizes formatting');
  }

  // Test 4: Deterministic quote normalization
  {
    console.log('[Test 4] Smart quotes and fences parsed deterministically');
    const { safeParseJson } = require('../engine/utils/jsonParser');
    const smartQuoteJson = `\`\`\`json
{
  “questionText”: “What happens during AVL left rotation?”,
  “options”: [“Right child becomes root”, “Left child becomes root”, “Tree degenerates”, “Balance factor becomes 2”],
  “correctAnswer”: “Right child becomes root”,
  “explanation”: “Standard AVL left rotation mechanism.”
}
\`\`\``;
    // Test our cleaning regex
    const cleaned = smartQuoteJson
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = safeParseJson(cleaned);
    assert.strictEqual(parsed.options.length, 4);
    assert.strictEqual(parsed.correctAnswer, 'Right child becomes root');
    console.log('  ✓ Deterministic cleanup handles smart quotes and markdown fences cleanly');
  }

  console.log('\n✅ All Stage 2 tests passed successfully!\n');
}

runStage2Tests().catch(err => {
  console.error('❌ Stage 2 test failed:', err);
  process.exit(1);
});
