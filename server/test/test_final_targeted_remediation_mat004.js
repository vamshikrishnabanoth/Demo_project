'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const agent1Planner = require('../engine/agents/agent1Planner');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('🧪 RUNNING: test_final_targeted_remediation_mat004.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
  }
}

(async () => {
  // Test 1: Agent 1 Archetype Registration & Selection
  runTest('1.1 Hard tree balancing and rotation concepts select INVARIANT_DIAGNOSIS', () => {
    const eligible = agent1Planner._determineEligibleArchetypes({
      unifiedRawContent: 'AVL tree balancing requires balance factor evaluation and rotations: Left-Right (LR) rotation and Right-Left (RL) rotation.'
    });
    assert(eligible.includes('INVARIANT_DIAGNOSIS'), 'INVARIANT_DIAGNOSIS must be eligible for tree balancing evidence');

    const target = {
      concept: 'AVL Balance Factor Invariant',
      subtopic: 'AVL Balance Factor Invariant',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };
    const resolved = agent1Planner._resolveTargetArchetype(target, eligible, [], {});
    assert.strictEqual(resolved, 'INVARIANT_DIAGNOSIS', `Expected INVARIANT_DIAGNOSIS, got ${resolved}`);
  });

  runTest('1.2 Height bounds and recurrence relations select COUNTEREXAMPLE_EVALUATION', () => {
    const eligible = agent1Planner._determineEligibleArchetypes({
      unifiedRawContent: 'AVL tree height bound is determined by recurrence N(h) = N(h-1) + N(h-2) + 1 with N(0)=1, N(1)=2. Worst-case height is bounded.'
    });
    assert(eligible.includes('COUNTEREXAMPLE_EVALUATION'), 'COUNTEREXAMPLE_EVALUATION must be eligible for recurrence evidence');

    const target = {
      concept: 'AVL Height Bound',
      subtopic: 'AVL Height Bound',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'APPLY'
    };
    const resolved = agent1Planner._resolveTargetArchetype(target, eligible, [], {});
    assert.strictEqual(resolved, 'COUNTEREXAMPLE_EVALUATION', `Expected COUNTEREXAMPLE_EVALUATION, got ${resolved}`);
  });

  runTest('1.3 Executable C++ pointer and deletion routines select CODE_EXECUTION', () => {
    const eligible = agent1Planner._determineEligibleArchetypes({
      unifiedRawContent: 'Node* deleteNode(Node* root, int key) { if (root == NULL) return root; root->left = deleteNode(root->left, key); return root; }',
      codeSnippets: ['Node* deleteNode(Node* root, int key)']
    });
    assert(eligible.includes('CODE_EXECUTION'), 'CODE_EXECUTION must be eligible for C++ implementation evidence');

    const target = {
      concept: 'BST C++ Implementation',
      subtopic: 'BST C++ Implementation',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'APPLY'
    };
    const resolved = agent1Planner._resolveTargetArchetype(target, eligible, [], {});
    assert.strictEqual(resolved, 'CODE_EXECUTION', `Expected CODE_EXECUTION, got ${resolved}`);
  });

  // Test 2: Capacity Resolution when formal proof capacity is 0 but procedural evidence exists
  runTest('2.1 Procedural opportunities restore Hard capacity when formal proof capacity is zero', () => {
    const bmFile = fs.readFileSync(path.resolve(__dirname, '../../run_mat004_positive_path_benchmark.js'), 'utf8');
    const match = bmFile.match(/const bstAvlMaterial = `([\s\S]+?)`;/);
    assert(match, 'Must extract bstAvlMaterial from benchmark file');
    const bstText = match[1];

    const evidencePackage = {
      unifiedRawContent: bstText,
      lectureIntelligence: {
        evidenceCapacity: {
          capacityByDifficulty: { easy: 9, medium: 16, hard: 0 },
          totalDefensibleCapacity: 25
        }
      }
    };

    const cap = agent1Planner._resolveCapacity(evidencePackage);
    assert.strictEqual(cap.isCapacityValid, true, 'Capacity must be valid');
    assert.strictEqual(cap.effectiveHardCap, 5, `Expected effectiveHardCap = 5 for MAT_004, got ${cap.effectiveHardCap}`);
    assert.strictEqual(cap.hardFeasible, true, 'hardFeasible must be true for MAT_004');
    assert.strictEqual(cap.totalDefensibleCapacity, 30, `Expected totalDefensibleCapacity = 30, got ${cap.totalDefensibleCapacity}`);
  });

  // Test 3: Descriptive-only material receives zero Hard capacity (honest deficit preserved)
  runTest('3.1 Purely descriptive/glossary material receives 0 Hard capacity and hardFeasible = false', () => {
    const descriptiveEvidence = {
      unifiedRawContent: 'This chapter introduces binary trees and terminology. A binary tree has nodes. A leaf node is a node with no children. The root is the top node.',
      lectureIntelligence: {
        evidenceCapacity: {
          capacityByDifficulty: { easy: 5, medium: 3, hard: 0 },
          totalDefensibleCapacity: 8
        }
      }
    };

    const cap = agent1Planner._resolveCapacity(descriptiveEvidence);
    assert.strictEqual(cap.effectiveHardCap, 0, `Expected effectiveHardCap = 0 for descriptive material, got ${cap.effectiveHardCap}`);
    assert.strictEqual(cap.hardFeasible, false, 'hardFeasible must be false for descriptive material');
  });

  // Test 4: Repaired question and evaluation alignment in Agent 3
  await runAsyncTest('4.1 Agent 3 evaluateAndRepairQuestion returns the exact MCQ evaluated on failed repair', async () => {
    const originalMCQ = {
      targetId: 'R08',
      question: 'Original Attempt 1 Question: How many node comparisons are required to search for key 40?',
      questionText: 'Original Attempt 1 Question: How many node comparisons are required to search for key 40?',
      options: ['Two comparisons', 'Three comparisons', 'Four comparisons', 'Five comparisons'],
      correctAnswerIndex: 2,
      correctAnswer: 'Four comparisons',
      explanation: 'Search visits root 10 -> 20 -> 30 -> 40 requiring 4 comparisons.'
    };

    const repairedMCQ = {
      targetId: 'R08',
      question: 'Repaired Attempt 2 Question: Inserting keys 10,20,30,40,50 sequentially into a BST results in what search complexity for key 10?',
      questionText: 'Repaired Attempt 2 Question: Inserting keys 10,20,30,40,50 sequentially into a BST results in what search complexity for key 10?',
      options: ['O(1) due to direct root access', 'O(N) due to linear chain traversal', 'O(log N)', 'O(N/2)'],
      correctAnswerIndex: 1, // Deliberate mismatch: Key 10 is at the root, so it is O(1), not O(N)
      correctAnswer: 'O(N) due to linear chain traversal',
      explanation: 'Generator incorrectly believes all searches in a skewed BST take linear time.'
    };

    const target = {
      targetId: 'R08',
      concept: 'BST Degenerate Skew',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'APPLY'
    };

    const mockEvidencePackage = {
      unifiedRawContent: 'When keys are inserted in strictly ascending order, BST becomes a degenerate skewed linear chain with height N.'
    };

    // Mock generator that returns repairedMCQ
    const mockGenerator = {
      generateQuestion: async () => repairedMCQ
    };

    const evalResult = await agent3Evaluator.evaluateAndRepairQuestion(originalMCQ, target, mockEvidencePackage, mockGenerator);

    assert.strictEqual(evalResult.passed, false, 'Failed repair must have passed: false');
    assert.strictEqual(evalResult.repair.attempted, true, 'Repair must be recorded as attempted');
    assert.strictEqual(evalResult.repair.successful, false, 'Repair must be recorded as unsuccessful');
    assert.strictEqual(evalResult.repair.originalMCQ.questionText, originalMCQ.questionText, 'repair.originalMCQ must hold Attempt 1');
    assert.strictEqual(evalResult.repair.repairedMCQ.questionText, repairedMCQ.questionText, 'repair.repairedMCQ must hold Attempt 2');
    
    // CRITICAL FIX ASSERTION: evalResult.mcq must be repairedMCQ, NOT originalMCQ!
    assert.strictEqual(evalResult.mcq.questionText, repairedMCQ.questionText, 'evalResult.mcq must be the repaired MCQ evaluated by secondEval');
  });

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} passed`);
  console.log(`==================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
