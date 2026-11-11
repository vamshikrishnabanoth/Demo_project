'use strict';

const fs = require('fs');
const path = require('path');

// 1. Load project .env
const projectDir = fs.existsSync(path.join(__dirname, 'server')) ? __dirname : path.resolve(__dirname, 'Demo_project');
const envPath = path.join(projectDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  });
}

const pipelineOrchestrator = require(path.join(projectDir, 'server/engine/pipelineOrchestrator'));
const productionMetrics = require(path.join(projectDir, 'server/utils/productionMetrics'));

// 2. Verified Instructional Input: BST & AVL Tree Balancing (MAT_004 Academic Syllabus)
const stagingInstructionalMaterial = `
Data Structures and Algorithms: Binary Search Trees (BST) and Self-Balancing AVL Trees.

1. BINARY SEARCH TREE SPECIFICATION & INVARIANTS:
A Binary Search Tree (BST) is a hierarchical node-based binary tree data structure.
BST Ordering Invariant: For every node X in the tree:
- All keys in the left subtree of X must be strictly less than X.key (left.key < X.key).
- All keys in the right subtree of X must be strictly greater than X.key (right.key > X.key).
- No duplicate keys are permitted.
- In-Order Traversal Invariant: An in-order traversal (Left, Root, Right) of any valid BST yields keys in strictly ascending sorted order.

2. BST INSERTION, SEARCH, AND DELETION OPERATIONS:
- Search Operation:
  Compare search key with current node. If equal, search succeeds. If key < current.key, recursively search left subtree; if key > current.key, recursively search right subtree. If NULL is reached, key is not present. Time complexity is O(h) where h is tree height.
- Insertion Operation:
  Traverse from root comparing key: move left if key < current.key, right if key > current.key, until reaching a NULL pointer, where the new Node(val) is attached.
- Deletion Operation (3 Distinct Cases):
  * Case 1 (Leaf Node): Node has 0 children (left == NULL && right == NULL). Delete node pointer and return NULL.
  * Case 2 (One Child): Node has exactly one non-null child. Free the target node and return its single child to be linked to the parent.
  * Case 3 (Two Children): Node has both left and right non-null subtrees.
    Find the in-order successor (the minimum node in the right subtree: findMin(root->right)).
    Copy the in-order successor's key into the current node's data field.
    Recursively call deleteNode on the right subtree to delete the in-order successor key.
    (Alternatively, replace with the in-order predecessor: findMax(root->left)).

3. EXECUTABLE C++ IMPLEMENTATION & CODE TRACE:
\`\`\`cpp
#include <iostream>
using namespace std;

class Node {
public:
    int data;
    Node* left;
    Node* right;
    Node(int val) {
        data = val;
        left = right = NULL;
    }
};

class BST {
public:
    Node* root;
    BST() { root = NULL; }

    Node* insert(Node* root, int val) {
        if (root == NULL) return new Node(val);
        if (val < root->data) root->left = insert(root->left, val);
        else if (val > root->data) root->right = insert(root->right, val);
        return root;
    }

    bool search(Node* root, int key) {
        if (root == NULL) return false;
        if (root->data == key) return true;
        if (key < root->data) return search(root->left, key);
        return search(root->right, key);
    }

    Node* findMin(Node* root) {
        while (root->left != NULL) root = root->left;
        return root;
    }

    Node* deleteNode(Node* root, int key) {
        if (root == NULL) return root;
        if (key < root->data) {
            root->left = deleteNode(root->left, key);
        } else if (key > root->data) {
            root->right = deleteNode(root->right, key);
        } else {
            if (root->left == NULL) {
                Node* temp = root->right;
                delete root;
                return temp;
            } else if (root->right == NULL) {
                Node* temp = root->left;
                delete root;
                return temp;
            }
            Node* temp = findMin(root->right);
            root->data = temp->data;
            root->right = deleteNode(root->right, temp->data);
        }
        return root;
    }
};
\`\`\`

4. AVL TREE SELF-BALANCING SPECIFICATION & ROTATION INVARIANTS:
An AVL tree is a strictly height-balanced Binary Search Tree named after Adelson-Velsky and Landis.
- Balance Factor Invariant:
  For every node N in the tree, BalanceFactor(N) = Height(N.left) - Height(N.right).
  In a valid AVL tree, BalanceFactor(N) must be strictly in {-1, 0, +1}.
- Rebalancing Rotations (4 Canonical Cases):
  1. Left-Left (LL) Heavy: Balance factor of N is +2 and inserted key is in left child's left subtree. Solved by a single Right Rotation at N.
  2. Right-Right (RR) Heavy: Balance factor of N is -2 and inserted key is in right child's right subtree. Solved by a single Left Rotation at N.
  3. Left-Right (LR) Heavy: Balance factor of N is +2 and inserted key is in left child's right subtree. Solved by a Double Rotation: Left Rotation at N.left followed by Right Rotation at N.
  4. Right-Left (RL) Heavy: Balance factor of N is -2 and inserted key is in right child's left subtree. Solved by a Double Rotation: Right Rotation at N.right followed by Left Rotation at N.
- Complexity: Search, Insertion, and Deletion are all guaranteed O(log n) time in the worst case because tree height is strictly bounded by 1.44 * log2(n).
`;

async function runStagingCanary() {
  console.log('========================================================================');
  console.log('🚀 LIVE STAGING CANARY — TEACHER ROLE N=5 BALANCED EVALUATION');
  console.log('   Input: MAT_004 Invariant & Procedural BST/AVL Specification');
  console.log('   Target Count: N = 5');
  console.log('   Difficulty: Balanced (Adaptive cognitive distribution)');
  console.log('========================================================================\n');

  // Baseline metrics snapshot
  const initialLLMCalls = productionMetrics.counters.llm_requests_total || 0;
  const initialInputTokens = productionMetrics.counters.estimated_input_tokens || 0;
  const initialOutputTokens = productionMetrics.counters.estimated_output_tokens || 0;

  const sessionId = `canary_staging_live_${Date.now()}`;
  const startTime = Date.now();

  let result;
  try {
    result = await pipelineOrchestrator.runPipeline({
      sessionId,
      documentTexts: [stagingInstructionalMaterial],
      count: 5,
      difficulty: 'Balanced'
    }, (progress) => {
      if (progress && progress.message) {
        console.log(`  [Progress ${progress.percent || 0}%] ${progress.stage || ''}: ${progress.message}`);
      }
    });
  } catch (err) {
    console.error('❌ Pipeline Canary Exception:', err.message);
    result = err.pipelineResult || {
      sessionId,
      pipelineStatus: 'FAILED',
      questions: [],
      error: err.message
    };
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const questions = result.questions || [];

  // Metrics delta
  const finalLLMCalls = productionMetrics.counters.llm_requests_total || 0;
  const outboundCalls = finalLLMCalls - initialLLMCalls;
  const finalInputTokens = productionMetrics.counters.estimated_input_tokens || 0;
  const finalOutputTokens = productionMetrics.counters.estimated_output_tokens || 0;
  const totalTokens = (finalInputTokens - initialInputTokens) + (finalOutputTokens - initialOutputTokens);
  const tokensPerQuestion = questions.length > 0 ? Math.round(totalTokens / questions.length) : 0;

  console.log('\n========================================================================');
  console.log('🏁 CANARY EXECUTION SUMMARY');
  console.log('========================================================================');
  console.log(`Pipeline Status:           ${result.pipelineStatus}`);
  console.log(`Duration:                  ${durationSec}s`);
  console.log(`Delivered Questions:       ${questions.length} / 5`);
  console.log(`Outbound Provider Calls:   ${outboundCalls}`);
  console.log(`Total Tokens Consumed:     ${totalTokens}`);
  console.log(`Tokens Per Question:       ${tokensPerQuestion}`);
  console.log(`Teacher Teaching Score:    ${result.teacherAnalysis?.score ?? result.tcScore ?? 'N/A'}`);
  console.log(`Evidence Safety:           ${result.evidenceSafety || result.evidencePackage?.evidenceSafety || 'GROUNDED'}`);
  console.log('========================================================================\n');

  // Verify questions schema & distribution
  const difficultyCounts = {};
  questions.forEach((q, idx) => {
    const diff = q.difficulty || q.targetDifficulty || 'Unknown';
    difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
    console.log(`Question #${idx + 1} [${diff}]`);
    console.log(`  Prompt: ${q.question}`);
    console.log(`  Options (${(q.options || []).length}):`);
    (q.options || []).forEach((opt, oIdx) => {
      const isCorrect = (oIdx === q.correctAnswer || opt === q.answer);
      console.log(`    ${String.fromCharCode(65 + oIdx)}. ${opt} ${isCorrect ? '✅ (Correct)' : ''}`);
    });
    if (q.explanation) console.log(`  Explanation: ${q.explanation.slice(0, 100)}...`);
    if (q.preTestDdi) console.log(`  Pre-Test DDI: ${q.preTestDdi.ddiScore} (${q.preTestDdi.distractorSpread})`);
    console.log('');
  });

  console.log('Difficulty Distribution:', difficultyCounts);
  if (result.teacherAnalysis?.actionableGuidance) {
    console.log('\nTeacher Actionable Guidance:');
    console.log(`  Strengths:       ${result.teacherAnalysis.actionableGuidance.demonstratedStrengths?.join(', ')}`);
    console.log(`  Recommendations: ${result.teacherAnalysis.actionableGuidance.concreteRecommendations?.join(' | ')}`);
  }

  // Save canary record
  const outputDir = path.join(projectDir, 'evaluation_dataset/benchmark_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const recordFilePath = path.join(outputDir, 'staging_canary_result.json');
  const canaryRecord = {
    metadata: {
      sessionId,
      timestamp: new Date().toISOString(),
      durationSec: parseFloat(durationSec),
      requestedCount: 5,
      requestedDifficulty: 'Balanced',
      deliveredCount: questions.length,
      pipelineStatus: result.pipelineStatus,
      outboundCalls,
      totalTokens,
      tokensPerQuestion,
      difficultyDistribution: difficultyCounts
    },
    teacherAnalysis: {
      score: result.teacherAnalysis?.score ?? result.tcScore ?? null,
      pedagogicalCritique: result.teacherAnalysis?.pedagogicalCritique ?? null,
      actionableGuidance: result.teacherAnalysis?.actionableGuidance ?? null
    },
    questions: questions.map(q => ({
      id: q.id,
      difficulty: q.difficulty || q.targetDifficulty,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      preTestDdi: q.preTestDdi || null
    }))
  };

  fs.writeFileSync(recordFilePath, JSON.stringify(canaryRecord, null, 2), 'utf8');
  console.log(`\n💾 Saved canary report to: ${recordFilePath}`);

  // Assertions for preflight
  const isCountFulfilled = questions.length === 5;
  const isCallsBounded = outboundCalls <= 4; // Batch generation plus planning/eval
  const isHealthy = result.pipelineStatus === 'COMPLETE' || result.pipelineStatus === 'COMPLETED';

  console.log('\n--- PRE-FLIGHT CANARY VERDICTS ---');
  console.log(`1. Full Count Delivered (5/5):   ${isCountFulfilled ? 'PASS' : 'FAIL'}`);
  console.log(`2. Outbound Calls Bounded:       ${isCallsBounded ? 'PASS' : 'WARN'} (${outboundCalls} calls)`);
  console.log(`3. Pipeline Completed Cleanly:   ${isHealthy ? 'PASS' : 'FAIL'}`);
  console.log('----------------------------------\n');

  return canaryRecord;
}

runStagingCanary().catch(err => {
  console.error('Fatal Canary Error:', err);
  process.exit(1);
});
