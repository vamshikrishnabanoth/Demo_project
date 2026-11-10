'use strict';

const fs = require('fs');
const path = require('path');

// 1. Load project root .env
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
        process.env[k] = v;
      }
    }
  });
}

// 2. Enforce Groq provider and sequential generation
process.env.DEFAULT_LLM_PROVIDER = 'groq';
process.env.GENERATION_CONCURRENCY = '1';

// 3. Load pipeline orchestrator
const pipelineOrchestrator = require(path.join(projectDir, 'server/engine/pipelineOrchestrator'));

// 4. Construct comprehensive BST & AVL Tree Balancing Material
// Sourced from MAT_004 (Data Structures Lab Programs Manual) and algorithmic balance invariants
const bstAvlMaterial = `
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

3. EXECUTABLE C++ IMPLEMENTATION & CODE TRACE (from MAT_004):
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
            // Case 1: No child
            if (root->left == NULL && root->right == NULL) {
                delete root;
                return NULL;
            }
            // Case 2: One child
            else if (root->left == NULL) {
                Node* temp = root->right;
                delete root;
                return temp;
            } else if (root->right == NULL) {
                Node* temp = root->left;
                delete root;
                return temp;
            }
            // Case 3: Two children
            Node* temp = findMin(root->right);
            root->data = temp->data;
            root->right = deleteNode(root->right, temp->data);
        }
        return root;
    }
};
\`\`\`
Sample Execution Trace:
Given insertions: 50, 30, 70, 20, 40, 60, 80.
- Tree Root: 50. Left child: 30 (with children 20, 40). Right child: 70 (with children 60, 80).
- Delete 20 (Case 1: Leaf deletion) -> 30's left becomes NULL.
- Delete 30 (Case 3: Two children) -> In-order successor is 40. 30's data replaced by 40, 40 deleted from right subtree.
- Delete 50 (Root with two children) -> In-order successor is 60 (findMin(70)). Root becomes 60, 60 deleted from right subtree.

4. SKEW DEGENERATION & COMPLEXITY INVARIANTS:
- Degenerate Pathological Skew: When keys are inserted in strictly sorted ascending order (e.g., 10, 20, 30, 40, 50) or descending order, every new node attaches to the right (or left), collapsing tree height to h = N.
- Search, insertion, and deletion complexity degenerates to worst-case O(N) linear time, losing all binary search advantages.
- In an ideally balanced tree, height h = floor(log2(N)), guaranteeing O(log N) operations.

5. SELF-BALANCING AVL TREES & ROTATION ALGORITHMS:
To prevent O(N) linear skew, an AVL tree enforces the Balance Factor Invariant:
Balance Factor BF(X) = height(left_subtree) - height(right_subtree).
AVL Invariant: For EVERY node in the tree, BF(X) must belong to {-1, 0, +1}.
If an insertion or deletion causes |BF(X)| > 1 (i.e. BF = +2 or BF = -2), tree balance is violated and must be immediately restored via tree rotations.

The Four AVL Rotation Cases:
1. Left-Left (LL) Heavy Imbalance (BF = +2, left child BF >= 0):
   Caused by insertion into the left subtree of the left child.
   Resolution: Perform a single Right Rotation (RR) on node X. Node X becomes right child of left child.
2. Right-Right (RR) Heavy Imbalance (BF = -2, right child BF <= 0):
   Caused by insertion into the right subtree of the right child.
   Resolution: Perform a single Left Rotation (LL) on node X. Node X becomes left child of right child.
3. Left-Right (LR) Zigzag Imbalance (BF = +2, left child BF = -1):
   Caused by insertion into the right subtree of the left child.
   Resolution: Double Rotation:
   First perform a Left Rotation on the left child of X, transforming the tree into an LL case.
   Then perform a Right Rotation on node X.
4. Right-Left (RL) Zigzag Imbalance (BF = -2, right child BF = +1):
   Caused by insertion into the left subtree of the right child.
   Resolution: Double Rotation:
   First perform a Right Rotation on the right child of X, transforming the tree into an RR case.
   Then perform a Left Rotation on node X.

By applying these O(1) rotation operations after insertion or deletion, the AVL tree strictly bounds its maximum height to h < 1.44 * log2(N + 2) - 0.328, strictly guaranteeing O(log N) worst-case time complexity for search, insertion, and deletion.
`;

async function execute() {
  console.log('========================================================================');
  console.log('🚀 POSITIVE-PATH HARD BENCHMARK — MAT_004 (BST & AVL Tree Balancing)');
  console.log('   Target Configuration: count = 5, difficulty = Hard');
  console.log('   Modality: MATERIAL_ONLY (Algorithmic Invariants, Code Traces, Rotations)');
  console.log('   Provider: Groq Multi-Key Cascade (Key-0, Key-1, Key-2, Reserves)');
  console.log('========================================================================\n');

  console.log(`▶ Ingested Material: ${bstAvlMaterial.length} characters of algorithmic specifications, C++ traces, and AVL invariants.`);

  const timestamp = Date.now();
  const sessionId = `eval_cohort_mat004_bst_avl_n5_hard_${timestamp}`;
  const startTime = Date.now();

  let result;
  try {
    result = await pipelineOrchestrator.runPipeline({
      sessionId,
      documentTexts: [bstAvlMaterial],
      count: 5,
      difficulty: 'Hard'
    }, (progress) => {
      if (progress && progress.message) {
        console.log(`  [Progress ${progress.percent || 0}%] ${progress.stage || ''}: ${progress.message}`);
      }
    });
  } catch (err) {
    console.error('❌ Pipeline Threw Error:', err.message);
    result = err.pipelineResult || {
      sessionId,
      pipelineStatus: 'FAILED',
      questions: [],
      error: err.message,
      errorCode: err.code || 'PIPELINE_ERROR',
      rejectedTargets: [],
      unfulfilledTargets: []
    };
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const questions = result.questions || [];

  console.log('\n========================================================================');
  console.log(`🏁 EXECUTION COMPLETE in ${durationSec}s`);
  console.log(`   Pipeline Status: ${result.pipelineStatus}`);
  console.log(`   Delivered Questions: ${questions.length} / 5`);
  console.log('========================================================================\n');

  // Save benchmark record
  const outputDir = path.join(projectDir, 'evaluation_dataset/benchmark_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const recordFilename = `eval_cohort_mat004_bst_avl_n5_hard_${timestamp}.json`;
  const recordFilePath = path.join(outputDir, recordFilename);

  const evaluationRecord = {
    metadata: {
      cohortId: 'MAT_004_bst_avl',
      lectureName: 'MAT_004: Data Structures Lab Manual - BST & AVL Tree Balancing',
      evaluationTimestamp: new Date(timestamp).toISOString(),
      executionDurationSec: durationSec,
      gitCommit: 'a348716',
      requestedCount: 5,
      requestedDifficulty: 'Hard',
      deliveredCount: questions.length,
      pipelineStatus: result.pipelineStatus,
      evidenceSafety: result.evidenceSafety || result.evidencePackage?.evidenceSafety || 'GROUNDED'
    },
    capacityMetrics: {
      totalDefensibleCapacity: result.capacityDeficitReport?.totalDefensibleCapacity ?? result.teacherAnalysis?.evidenceCapacity?.totalDefensibleCapacity ?? null,
      recommendedQuestionCount: result.recommendedQuestionCount ?? result.teacherAnalysis?.evidenceCapacity?.recommendedQuestionCount ?? null,
      deficitCount: result.capacityDeficitReport?.capacityDeficit ?? (5 - questions.length),
      capacityWarning: result.capacityDeficitReport?.capacityWarning ?? null,
      offeredActionOptions: result.capacityDeficitReport?.options ?? []
    },
    teachingProfile: {
      score: result.teacherAnalysis?.score ?? result.tcScore ?? null,
      description: result.teacherAnalysis?.pedagogicalCritique ?? null,
      deductions: result.teacherAnalysis?.deductions ?? [],
      pdi: result.pdi ?? result.evidencePackage?.PDI ?? null
    },
    deliveredQuestions: questions.map((q, idx) => ({
      index: idx + 1,
      targetId: q.targetId || q.id,
      concept: q.metadata?.concept || q.concept || 'Unknown Concept',
      difficulty: q.metadata?.targetDifficulty || q.metadata?.tier || q.difficulty || 'Medium',
      questionType: q.questionArchetype || q.metadata?.questionArchetype || 'PROSE_MULTIPLE_CHOICE',
      questionText: q.questionText || q.stem,
      options: q.options || [],
      correctAnswer: q.correctAnswer || q.correct_answer_text,
      correctAnswerIndex: q.correctAnswerIndex ?? q.correctOption,
      explanation: q.explanation || null,
      distractorRationales: q.verificationRecord?.distractorRationales || q.distractorRationales || null,
      independentVerification: q.metadata?.independentVerification || q.independentVerification || null,
      agent3: q.agent3 || null
    })),
    auditDetails: {
      rejectedTargets: result.rejectedTargets || [],
      unfulfilledTargets: result.unfulfilledTargets || [],
      questionDecisionLedger: result.questionDecisionLedger || [],
      errors: result.error ? [result.error] : [],
      warnings: result.alignmentWarning ? [result.alignmentWarning] : []
    },
    rawPipelineResult: result
  };

  fs.writeFileSync(recordFilePath, JSON.stringify(evaluationRecord, null, 2), 'utf8');
  console.log(`📁 Timestamped Evaluation Record Saved: ${recordFilePath}`);

  return { evaluationRecord, recordFilePath };
}

execute().then(() => {
  console.log('\n✅ Positive-Path Benchmark Run Finished.');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Unhandled Fatal Error:', err);
  process.exit(1);
});
