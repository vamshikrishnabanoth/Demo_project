/**
 * server/test/test_evaluator_fastpath_hardening.js
 *
 * Dedicated verification for:
 * 1. Trivial lecture-grounded Hard question CANNOT pass solely on lexical overlap via fast-path.
 * 2. Medium and Hard questions require semantic evaluation and do not bypass to fast-path.
 * 3. Easy factual recall questions can pass via verified deterministic recall fast-path.
 * 4. Provider failure fallback: Medium/Hard questions FAIL honestly with SEMANTIC_EVALUATION_UNAVAILABLE
 *    instead of being silently approved.
 */

'use strict';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('======================================================================');
console.log('🧪 VERIFYING EVALUATOR FAST-PATH HARDENING & PROVIDER FAILOVER');
console.log('======================================================================\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  const lectureEvidence = `
    Binary Search Trees:
    A binary search tree is a rooted binary tree data structure with the key of each internal node
    being greater than all the keys in the respective node's left subtree and less than the ones in its right subtree.
    The time complexity for search in a balanced BST is O(log n).
  `;

  // ---------------------------------------------------------------------------
  // Check 1: Trivial lecture-grounded Hard question cannot pass via fast-path
  // ---------------------------------------------------------------------------
  await runAsyncTest('1. Trivial, lecture-grounded Hard question cannot pass solely on lexical overlap', async () => {
    const trivialCandidate = {
      targetId: 'T_TRIVIAL_HARD',
      questionText: 'What is the time complexity of searching in a balanced binary search tree?',
      options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
      correctAnswer: 'O(log n)',
      explanation: 'Search in a balanced BST takes logarithmic time.',
      metadata: { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' }
    };

    const target = {
      targetId: 'T_TRIVIAL_HARD',
      concept: 'BST Search Complexity',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    // Evaluate candidate
    const result = await agent3Evaluator.evaluateQuestion(trivialCandidate, target, {
      unifiedRawContent: lectureEvidence,
      curricularContent: lectureEvidence
    }, { skipLLM: true });

    assert.strictEqual(result.passed, false, 'Trivial recall question must NOT pass as Hard');
    assert.strictEqual(result.status, 'FAIL', 'Status must be FAIL');
    assert.ok(
      result.failureReasons.includes('TIER_COGNITIVE_MISMATCH'),
      'Must flag TIER_COGNITIVE_MISMATCH for Hard tier requested'
    );
    assert.notStrictEqual(result.verificationMethod, 'DETERMINISTIC_FAST_PATH', 'Must not pass via fast path');
  });

  // ---------------------------------------------------------------------------
  // Check 2: Easy factual recall question CAN pass deterministic recall fast path
  // ---------------------------------------------------------------------------
  await runAsyncTest('2. Valid Easy question with clean options passes DETERMINISTIC_RECALL_FAST_PATH', async () => {
    const easyCandidate = {
      targetId: 'T_EASY_RECALL',
      questionText: 'What is the search time complexity of a balanced binary search tree?',
      options: ['O(log n)', 'O(n^2)', 'O(n!)', 'O(2^n)'],
      correctAnswer: 'O(log n)',
      explanation: 'Logarithmic search time in balanced BST.',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };

    const target = {
      targetId: 'T_EASY_RECALL',
      concept: 'BST Search Complexity',
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL'
    };

    const result = await agent3Evaluator.evaluateQuestion(easyCandidate, target, {
      unifiedRawContent: lectureEvidence,
      curricularContent: lectureEvidence
    });

    assert.strictEqual(result.passed, true, 'Easy question with clean distinct options should pass');
    assert.strictEqual(result.verificationMethod, 'DETERMINISTIC_RECALL_FAST_PATH', 'Must use DETERMINISTIC_RECALL_FAST_PATH');
  });

  // ---------------------------------------------------------------------------
  // Check 3: Medium/Hard questions do NOT bypass via fast-path even if preAudit passes
  // ---------------------------------------------------------------------------
  await runAsyncTest('3. Medium/Hard questions do not take fast path and require semantic evaluation', async () => {
    const mediumCandidate = {
      targetId: 'T_MED_TRACE',
      questionText: 'Explain why searching an unbalanced degenerate BST degrades from O(log n) to O(n) search time.',
      options: [
        'The tree degenerates into a linear linked list where each node has only one child',
        'The keys in the left subtree become greater than the keys in the right subtree',
        'Binary search trees prohibit in-order traversal when unbalanced',
        'The root node memory is freed during unbalanced search traversals'
      ],
      correctAnswer: 'The tree degenerates into a linear linked list where each node has only one child',
      explanation: 'Degeneracy causes height to become n.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' }
    };

    const target = {
      targetId: 'T_MED_TRACE',
      concept: 'BST Degeneracy',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'EXPLAIN_MECHANISM'
    };

    const result = await agent3Evaluator.evaluateQuestion(mediumCandidate, target, {
      unifiedRawContent: lectureEvidence,
      curricularContent: lectureEvidence
    });

    // Verification method must NOT be DETERMINISTIC_FAST_PATH or DETERMINISTIC_RECALL_FAST_PATH
    assert.notStrictEqual(result.verificationMethod, 'DETERMINISTIC_FAST_PATH', 'Medium cannot take old fast path');
    assert.notStrictEqual(result.verificationMethod, 'DETERMINISTIC_RECALL_FAST_PATH', 'Medium cannot take recall fast path');
  });

  // ---------------------------------------------------------------------------
  // Check 4: When semantic evaluator is unavailable, Medium/Hard fails honestly
  // ---------------------------------------------------------------------------
  await runAsyncTest('4. When semantic evaluator fails, unverified Medium/Hard fails with SEMANTIC_EVALUATION_UNAVAILABLE', async () => {
    // Simulate provider failure by passing broken options or mocking evaluator failure
    const hardCandidate = {
      targetId: 'T_HARD_UNVERIFIED',
      questionText: 'When balancing an AVL tree after an insertion in the right subtree of the right child, what operation restores the invariant?',
      options: ['A single left rotation at the unbalanced ancestor', 'A double left-right rotation at the unbalanced ancestor', 'A single right rotation at the unbalanced ancestor', 'A full tree re-allocation from the root'],
      correctAnswer: 'A single left rotation at the unbalanced ancestor',
      explanation: 'RR imbalance requires single left rotation.',
      metadata: { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' }
    };

    const target = {
      targetId: 'T_HARD_UNVERIFIED',
      concept: 'AVL Tree Balancing',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    // Temporarily mock complete to simulate 429
    const llmRouter = require('../engine/adapter/llmRouter');
    const origComplete = llmRouter.complete;
    try {
      llmRouter.complete = async () => {
        const err = new Error('Rate limit exceeded (429)');
        err.status = 429;
        throw err;
      };

      const result = await agent3Evaluator.evaluateQuestion(hardCandidate, target, {
        unifiedRawContent: lectureEvidence + ' AVL tree balancing rotation left right.',
        curricularContent: lectureEvidence + ' AVL tree balancing rotation left right.'
      });

      assert.strictEqual(result.passed, false, 'Unverified Hard question must NOT pass when critic is unavailable');
      assert.strictEqual(result.status, 'FAIL', 'Status must be FAIL');
      assert.ok(
        result.failureReasons.includes('SEMANTIC_EVALUATION_UNAVAILABLE'),
        'Must record SEMANTIC_EVALUATION_UNAVAILABLE failure code'
      );
      assert.strictEqual(result.criticUnavailable, true, 'criticUnavailable flag must be true');
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  console.log('\n======================================================================');
  console.log(`🏁 ALL ${passCount} FAST-PATH & FAILOVER HARDENING CHECKS PASSED CLEANLY!`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
