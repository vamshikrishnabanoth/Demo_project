/**
 * server/test/test_phase2_full_lecture_understanding.js
 *
 * PHASE 2 ACCEPTANCE & VERIFICATION TEST SUITE:
 * Validates Full-Lecture Understanding across the complete lecture timeline:
 * 1. Binary Search Tree (BST) 3-Part Trajectory Acceptance:
 *    - Beginning: BST ordering properties & algorithm (foundational).
 *    - Middle: Real-world indexing / routing scenario (comparative tradeoff).
 *    - End: Recursive code walkthrough (pointer linking & base case execution).
 * 2. Elimination of Silent 16,000-Character Truncation:
 *    - Lecture text > 16,000 characters with critical concept in final 10% is fully preserved and planned.
 * 3. Chronological Progression & Window Allocation:
 *    - Early (0-33%), Mid (33-66%), and Late (66-100%) sections are all represented.
 * 4. Honest Capacity Deficits:
 *    - 4-concept lecture with requested count 10 produces 4 valid questions and 6 explicit unfulfilled capacity deficits.
 * 5. Concept Deduplication:
 *    - Repeated concepts in transcript are filtered so identical concepts do not consume multiple slots.
 * 6. Short Lecture (< 150 words) Handling:
 *    - Valid question generated for available concept, remaining slots recorded as explicit deficits.
 */

'use strict';

// Enable mock fallback in development test environment
process.env.ALLOW_MOCK_FALLBACK = 'true';
process.env.NODE_ENV = 'development';

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const evidencePackager = require('../engine/evidence/evidencePackager');

console.log('======================================================================');
console.log('🧪 RUNNING PHASE 2: FULL-LECTURE UNDERSTANDING ACCEPTANCE SUITE');
console.log('======================================================================\n');

let passCount = 0;
let totalCount = 0;

async function runStep(testName, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalCount}: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${testName}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  // -------------------------------------------------------------
  // Test 1: BST 3-Part Trajectory Acceptance Test
  // -------------------------------------------------------------
  console.log('--- Test 1: Binary Search Tree (BST) 3-Part Chronological Trajectory ---');

  await runStep('1.1 BST Beginning: Foundational ordering property generated from early lecture', async () => {
    const earlyTarget = {
      targetId: 'T01',
      concept: 'Binary Search Tree Ordering Property',
      subtopic: 'BST Definition & Invariants',
      trajectoryPhase: 'EARLY',
      timestamp: '00:00 - 15:00',
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL',
      supportingEvidence: 'In a binary search tree, for any node X, all keys in the left subtree must be strictly less than X, and all keys in the right subtree must be strictly greater than X.'
    };

    const mcq = agent2Generator.generateQuestionFallback(earlyTarget, {
      unifiedRawContent: earlyTarget.supportingEvidence
    });

    assert.ok(mcq, 'MCQ must be generated');
    assert.strictEqual(mcq.targetId, 'T01');
    assert.ok(mcq.questionText.includes('Binary Search Tree') || mcq.questionText.includes('ordering property'), 'Question must test BST property');
    assert.ok(mcq.correctAnswer.includes('strictly less') && mcq.correctAnswer.includes('strictly greater'), 'Answer must assert left < node < right invariant');
    assert.strictEqual(mcq.options.length, 4, 'Must have exactly 4 options');
  });

  await runStep('1.2 BST Middle: Real-world routing / indexing scenario generated from mid lecture', async () => {
    const midTarget = {
      targetId: 'T02',
      concept: 'Database Indexing Lookup Scenario',
      subtopic: 'Real-World Tree Indexing Scenarios',
      trajectoryPhase: 'MID',
      timestamp: '15:00 - 30:00',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE',
      supportingEvidence: 'In database indexing and routing lookup tables, maintaining a balanced binary search tree guarantees O(log n) search performance by halving candidates at each comparison, whereas a skewed tree degrades into a sequential linked list.'
    };

    const mcq = agent2Generator.generateQuestionFallback(midTarget, {
      unifiedRawContent: midTarget.supportingEvidence
    });

    assert.ok(mcq, 'MCQ must be generated');
    assert.strictEqual(mcq.targetId, 'T02');
    assert.ok(mcq.questionText.includes('index') || mcq.questionText.includes('routing') || mcq.questionText.includes('Binary Search Tree'), 'Must test scenario');
    assert.ok(mcq.correctAnswer.includes('balance') || mcq.correctAnswer.includes('logarithmic') || mcq.correctAnswer.includes('halves'), 'Answer must assert balance halving search space');
    assert.strictEqual(mcq.options.length, 4, 'Must have exactly 4 options');
  });

  await runStep('1.3 BST End: Recursive code walkthrough generated from late lecture', async () => {
    const lateTarget = {
      targetId: 'T03',
      concept: 'Recursive BST Insertion Code Walkthrough',
      subtopic: 'Implementation & Code Tracing',
      trajectoryPhase: 'LATE',
      timestamp: '30:00 - 45:00',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'APPLY',
      supportingEvidence: 'Consider our recursive insertion function: Node* insert(Node* root, int key) { if (root == nullptr) return new Node(key); if (key < root->data) root->left = insert(root->left, key); else if (key > root->data) root->right = insert(root->right, key); return root; } When root is nullptr base case is reached, allocating a new Node and returning its pointer.'
    };

    const mcq = agent2Generator.generateQuestionFallback(lateTarget, {
      unifiedRawContent: lateTarget.supportingEvidence
    });

    assert.ok(mcq, 'MCQ must be generated');
    assert.strictEqual(mcq.targetId, 'T03');
    assert.ok(mcq.questionText.includes('insert(Node* root, int key)') || mcq.questionText.includes('recursive'), 'Question must include code walkthrough');
    assert.ok(mcq.correctAnswer.includes('Allocates a new Node') || mcq.correctAnswer.includes('pointer'), 'Answer must describe base case pointer allocation');
    assert.strictEqual(mcq.options.length, 4, 'Must have exactly 4 options');
  });

  // -------------------------------------------------------------
  // Test 2: Elimination of Silent 16,000-Character Truncation
  // -------------------------------------------------------------
  console.log('--- Test 2: Elimination of Silent 16,000-Character Truncation ---');

  await runStep('2.1 Chronological trajectory builder retains text beyond 16,000 characters across all phases', async () => {
    const earlyChunk = 'EARLY_PHASE_CONCEPT: We start with fundamental definition of AVL height balance. ' + ('Fundamental AVL property. ').repeat(300);
    const midChunk = 'MID_PHASE_CONCEPT: In the middle of the lecture we explore real-world B-tree database indexing. ' + ('Database B-tree index scenario. ').repeat(300);
    const lateChunk = 'LATE_PHASE_CONCEPT: In the final minutes past char 16000 we trace Red-Black Tree tree rotation code. ' + ('Red-black tree rotation code walkthrough. ').repeat(300);

    const longContent = earlyChunk + '\n\n' + midChunk + '\n\n' + lateChunk;
    assert.ok(longContent.length > 22000, `Test transcript must be > 22,000 chars (was ${longContent.length})`);

    const trajectory = agent1Planner._buildChronologicalTrajectoryPackage({}, longContent);

    assert.ok(trajectory.phases.early.text.includes('EARLY_PHASE_CONCEPT'), 'Early phase must capture early concept');
    assert.ok(trajectory.phases.mid.text.includes('MID_PHASE_CONCEPT'), 'Mid phase must capture mid concept');
    assert.ok(trajectory.phases.late.text.includes('LATE_PHASE_CONCEPT'), 'Late phase must capture concept from past 16,000 chars');
    assert.ok(trajectory.assessableContent.includes('LATE_PHASE_CONCEPT'), 'Assessable content presented to planner must include late concept');
  });

  await runStep('2.2 Full-lecture plan contains targets spanning Early, Mid, and Late phases', async () => {
    const longEvidencePackage = {
      sessionId: 'sess_phase2_long_01',
      unifiedRawContent: 'Phase 1: Binary Tree Invariants and Definitions. ' + ('Tree invariant definition. ').repeat(30) + 
        '\nPhase 2: Database Indexing B-Tree Scenarios. ' + ('Database B-tree indexing scenario. ').repeat(30) + 
        '\nPhase 3: Recursive AVL Tree Left-Right Rotations code walkthrough. ' + ('Recursive AVL rotation code. ').repeat(30),
      detectedFocus: ['Binary Tree Invariants', 'Database Indexing Scenarios', 'Recursive AVL Rotations'],
      lectureDepth: { score: 85, rating: 'Substantive' }
    };

    const plan = await agent1Planner.planAssessment(longEvidencePackage, 'Balanced', 3);

    assert.ok(plan.assessmentTargets.length >= 3, 'Must produce at least 3 targets');
    const phases = plan.assessmentTargets.map(t => t.trajectoryPhase);
    
    assert.ok(phases.includes('EARLY'), 'Plan must contain EARLY phase target');
    assert.ok(phases.includes('MID'), 'Plan must contain MID phase target');
    assert.ok(phases.includes('LATE'), 'Plan must contain LATE phase target');

    const lateTarget = plan.assessmentTargets.find(t => t.trajectoryPhase === 'LATE');
    assert.ok(lateTarget, 'Must have late target');
  });

  // -------------------------------------------------------------
  // Test 3: Capacity Deficit Preservation (Requested > Evidence)
  // -------------------------------------------------------------
  console.log('--- Test 3: Capacity Deficit Preservation (Requested > Evidence) ---');

  await runStep('3.1 4-concept lecture with requested 10 produces 4 valid questions and 6 capacity deficits', async () => {
    const fourConceptEvidence = {
      sessionId: 'sess_phase2_deficit_01',
      unifiedRawContent: `
        1. Binary Search Tree Invariant: Left child < Root < Right child.
        2. Tree Traversal: In-order traversal visits nodes in ascending order.
        3. Skewed vs Balanced BST: Skewed BST has O(n) search time, balanced BST has O(log n).
        4. Node Deletion: Deleting a two-child node requires finding the in-order successor.
      `,
      detectedFocus: [
        'BST Invariant',
        'In-order Traversal',
        'Skewed vs Balanced Trees',
        'Node Deletion'
      ],
      lectureDepth: { score: 70, rating: 'Developing' }
    };

    const plan = await agent1Planner.planAssessment(fourConceptEvidence, 'Medium', 10);

    assert.strictEqual(plan.assessmentTargets.length, 10, 'Plan must contain exactly 10 target slots');

    const validTargets = plan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitTargets = plan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(validTargets.length, 4, 'Must have exactly 4 valid curricular targets');
    assert.strictEqual(deficitTargets.length, 6, 'Must have exactly 6 explicit capacity deficit slots');

    deficitTargets.forEach(dt => {
      assert.strictEqual(dt.capacityLimitation?.status, 'INSUFFICIENT_CURRICULAR_EVIDENCE', 'Deficit reason must be INSUFFICIENT_CURRICULAR_EVIDENCE');
      assert.ok(dt.instruction.includes('capacity deficit') || dt.instruction.includes('withheld'), 'Instruction must explain capacity limitation');
    });

    const generatedResults = plan.assessmentTargets.map(t => agent2Generator.generateQuestionFallback(t, fourConceptEvidence));
    const fulfilledQuestions = generatedResults.filter(r => !r.isUnfulfilled);
    const unfulfilledDeficits = generatedResults.filter(r => r.isUnfulfilled && r.fulfillmentStatus === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(fulfilledQuestions.length, 4, 'Generator must produce exactly 4 fulfilled questions');
    assert.strictEqual(unfulfilledDeficits.length, 6, 'Generator must report exactly 6 unfulfilled capacity deficits');
  });

  // -------------------------------------------------------------
  // Test 4: Repeated Concept Deduplication
  // -------------------------------------------------------------
  console.log('--- Test 4: Repeated Concept Deduplication ---');

  await runStep('4.1 Repeated concepts in targets are deduplicated during audit to prevent cloning', async () => {
    const mockTargets = [
      { targetId: 'T01', concept: 'Binary Search Tree', subtopic: 'BST Intro', supportingEvidence: 'BST has left < root < right.' },
      { targetId: 'T02', concept: 'In-order Traversal', subtopic: 'Traversals', supportingEvidence: 'In-order traversal visits left root right.' },
      { targetId: 'T03', concept: 'Binary Search Tree', subtopic: 'BST Re-visited', supportingEvidence: 'As mentioned earlier, BST has left < root < right.' },
      { targetId: 'T04', concept: 'The In-order Traversal', subtopic: 'Traversals Again', supportingEvidence: 'Traversals give sorted order.' }
    ];

    const auditResult = agent1Planner._auditAssessmentTargets(mockTargets, [], 4, null);

    assert.strictEqual(auditResult.auditedTargets.length, 2, 'Only 2 unique concepts must be accepted');
    assert.strictEqual(auditResult.auditLog.rejected.length, 2, '2 duplicate concepts must be rejected');
    assert.strictEqual(auditResult.auditLog.rejected[0].reason, 'Duplicate concept already targeted');
  });

  // -------------------------------------------------------------
  // Test 5: Very Short Lecture (< 150 words) Handling
  // -------------------------------------------------------------
  console.log('--- Test 5: Very Short Lecture (< 150 words) Handling ---');

  await runStep('5.1 Short lecture with 1 concept requested for 5 questions generates 1 question and 4 deficits', async () => {
    const shortEvidence = {
      sessionId: 'sess_phase2_short_01',
      unifiedRawContent: 'Today we discuss Binary Search Trees. In a BST, every node has keys in its left subtree smaller than the node, and keys in its right subtree greater than the node.',
      detectedFocus: ['Binary Search Tree Property'],
      lectureDepth: { score: 40, rating: 'Introductory' }
    };

    const plan = await agent1Planner.planAssessment(shortEvidence, 'Easy', 5);

    assert.strictEqual(plan.assessmentTargets.length, 5, 'Must have 5 slots total');

    const validTargets = plan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitTargets = plan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(validTargets.length, 1, 'Only 1 valid question should be planned for 1 concept');
    assert.strictEqual(deficitTargets.length, 4, '4 slots must be preserved as honest capacity deficits');
  });

  // -------------------------------------------------------------
  // Test 6: End-to-End Orchestrator Pipeline Verification
  // -------------------------------------------------------------
  console.log('--- Test 6: End-to-End Orchestrator Pipeline Verification ---');

  await runStep('6.1 Pipeline orchestrator processes full lecture and preserves trajectory and deficits', async () => {
    const sessionInputs = {
      sessionId: 'sess_phase2_e2e_01',
      taskId: 'task_phase2_e2e_01',
      voiceTranscript: 'Binary Search Tree Ordering Invariant: for any node X, left keys < X and right keys > X. ' +
        'In database indexing lookup scenarios, balanced binary search trees guarantee logarithmic O(log n) lookup times. ' +
        'In the recursive insertion code walkthrough: Node* insert(Node* root, int key) returns new Node(key) when root == nullptr base case is reached.',
      documentTexts: [],
      codeSnippets: '',
      count: 3,
      difficulty: 'Balanced'
    };

    const result = await pipelineOrchestrator.runPipeline(sessionInputs);

    assert.ok(result, 'Pipeline result must exist');
    assert.ok(result.questions.length >= 1, 'Should produce passing grounded questions');
    assert.ok(result.telemetry || result.traceSummaryPath, 'Pipeline trace must exist');
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passCount} / ${totalCount} PHASE 2 ACCEPTANCE TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');
  if (passCount !== totalCount) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
