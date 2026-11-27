/**
 * server/test/test_phase5_concept_capacity_alignment.js
 *
 * Deterministic Acceptance Test Suite for Phase 5:
 * Concept-Based Multi-Question Generation & Intelligent Capacity Alignment.
 *
 * Covers all 10 acceptance criteria:
 * 1. Deep BST Multi-Question: 1 deep concept supports multiple distinct questions across facets.
 * 2. Definition-Only No Hard: Pure definition concepts never fabricate Hard questions.
 * 3. Teacher Boundaries (NO_CODE): Negative boundaries respected across planning and grounding.
 * 4. Legitimate Transfer Scenario: Valid applied CS framing words pass GroundingGate.
 * 5. Foreign Topic Rejection: True foreign topic contamination strictly rejected by GroundingGate.
 * 6. Difficulty Recommendations: Distinct Easy/Medium/Hard/Balanced recommendations and capacity.
 * 7. Honest Capacity Deficits: Excess requested count withheld honestly without hallucinated questions.
 * 8. Duplicate Facet Rejection: Identical concept + facet combinations rejected as PEDAGOGICAL_DUPLICATE.
 * 9. Chronology & Timestamp Preservation: Early/Mid/Late phases and real Whisper timestamps preserved.
 * 10. Preview vs Production Consistency: lectureIntelligence preview capacity aligns with planner generation.
 */

'use strict';

const assert = require('assert');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');
const groundingGate = require('../engine/validators/groundingGate');
const { HierarchicalChunker } = require('../engine/evidence/hierarchicalChunker');
const evidencePackager = require('../engine/evidence/evidencePackager');

const testResults = [];

async function runStep(name, fn) {
  try {
    await fn();
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    testResults.push({ name, status: 'FAIL', error: err.message, stack: err.stack });
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runPhase5Suite() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 5: Concept-Based Multi-Question & Capacity Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // Test 1: Deep BST Multi-Question Generation (1 concept -> multiple distinct questions)
  // ----------------------------------------------------------------------------
  console.log('--- Test 1: Deep BST Multi-Question Generation ---');
  await runStep('1.1 Deep BST concept generates multiple distinct facet targets without being capped at 1', async () => {
    const bstLectureEvidence = {
      sessionId: 'sess_phase5_bst_01',
      unifiedRawContent: `Binary Search Tree (BST) is a hierarchical node-based data structure.
      The binary search tree invariant states that for any node X, all keys in the left subtree are strictly smaller than X.key, and all keys in the right subtree are strictly greater than X.key.
      To insert an element, we traverse from the root: compare key with current node, transition left if smaller, transition right if greater, until reaching a null pointer where the new node is allocated.
      If input keys are inserted in strictly ascending sorted order (e.g. 10, 20, 30, 40), the BST degrades into a linear skewed linked list with worst-case search complexity O(N).
      Balancing via AVL rotations or red-black invariants restores logarithmic height O(log N).`,
      detectedFocus: ['Binary Search Tree'],
      lectureDepth: { score: 85, rating: 'Advanced' },
      instructionalProfile: {
        instructionalIntent: 'PROCEDURAL_TRACE',
        supportedReasoningModes: ['STEP_TRACE', 'BEHAVIORAL_PREDICTION'],
        hardFeasibility: { hardFeasible: true, deficitReason: null }
      }
    };

    // Attach lecture intelligence
    bstLectureEvidence.lectureIntelligence = lectureIntelligence.buildPartialFallback({
      evidenceText: bstLectureEvidence.unifiedRawContent,
      modality: 'VOICE_ONLY',
      hasTimingData: false
    });

    const plan = await agent1Planner.planAssessment(bstLectureEvidence, 'Balanced', 3);

    assert(plan.assessmentTargets, 'Plan must contain assessment targets');
    assert.strictEqual(plan.assessmentTargets.length, 3, 'Must produce 3 targets for 3 requested count');

    const validTargets = plan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(validTargets.length, 3, 'All 3 targets must be valid curricular targets (not capped at 1 concept)');

    // Ensure distinct cognitive operations across targets
    const operations = validTargets.map(t => t.intendedCognitiveOperation);
    const uniqueOps = new Set(operations);
    assert.strictEqual(uniqueOps.size, 3, `Expected 3 distinct operations, got ${Array.from(uniqueOps).join(', ')}`);
  });

  // ----------------------------------------------------------------------------
  // Test 2: Definition-Only Concept Produces NO Hard Questions
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 2: Definition-Only Concept Produces NO Hard Questions ---');
  await runStep('2.1 Pure definition-only lecture withholds Hard questions with honest capacity deficit', async () => {
    const defEvidence = {
      sessionId: 'sess_phase5_def_01',
      unifiedRawContent: 'A compiler translates source code into machine code. It is an essential language processing tool.',
      detectedFocus: ['Compiler'],
      lectureDepth: { score: 35, rating: 'Introductory' },
      instructionalProfile: {
        instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
        negativeBoundaries: [],
        hardFeasibility: {
          hardFeasible: false,
          deficitReason: 'Definition-only concept lacks taught operational mechanisms for defensible Hard diagnosis.'
        }
      }
    };

    defEvidence.lectureIntelligence = {
      schema_version: '1.0.0',
      conceptMap: [
        {
          id: 'C01',
          name: 'Compiler',
          definition: 'A compiler translates source code into machine code.',
          mechanism_or_rule: null,
          substanceType: 'DEFINITION'
        }
      ],
      evidenceCapacity: {
        distinctConceptCount: 1,
        recommendedQuestionCount: 1,
        recommendedByDifficulty: { easy: 1, medium: 0, hard: 0, balanced: 1 },
        capacityByDifficulty: { easy: 1, medium: 0, hard: 0, balanced: 1 },
        totalDefensibleCapacity: 1,
        advisoryRationale: 'Definition-only concept supports only 1 recall question.'
      }
    };

    const plan = await agent1Planner.planAssessment(defEvidence, 'Hard', 2);

    assert(plan.capacityDeficitReport, 'Must include capacityDeficitReport');
    assert.strictEqual(plan.capacityDeficitReport.requestedDifficulty, 'Hard');
    assert.strictEqual(plan.capacityDeficitReport.capacityDeficit, 2, 'Must record 2 Hard capacity deficits');

    const hardDeficits = plan.assessmentTargets.filter(t => t.capacityLimitation?.status === 'INSUFFICIENT_EVIDENCE_FOR_HARD');
    assert.strictEqual(hardDeficits.length, 2, 'Both targets must be transparent capacity deficits');
  });

  // ----------------------------------------------------------------------------
  // Test 3: Teacher Negative Boundaries (NO_CODE)
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 3: Teacher Negative Boundaries (NO_CODE) ---');
  await runStep('3.1 Explicit NO_CODE boundary discounts code walkthroughs and triggers GroundingGate rejection on code syntax', async () => {
    const noCodeEvidence = {
      sessionId: 'sess_phase5_nocode_01',
      unifiedRawContent: 'Deep neural networks learn representations. In this lecture we study concepts conceptually without code.',
      detectedFocus: ['Deep Neural Networks'],
      negativeBoundaries: ['NO_CODE'],
      instructionalProfile: {
        instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
        negativeBoundaries: ['NO_CODE'],
        hardFeasibility: { hardFeasible: true, deficitReason: null }
      }
    };

    // 1. Verify GroundingGate rejects question with code syntax under NO_CODE
    const codeQuestion = {
      questionId: 'Q01',
      question: 'Which line defines the model: def build_model(): return Sequential()?',
      correctAnswer: 'def build_model()',
      options: ['def build_model()', 'int x = 0', 'malloc(10)', 'none'],
      metadata: { targetDifficulty: 'Medium' }
    };

    const check = groundingGate.validateJustification([codeQuestion], noCodeEvidence.unifiedRawContent, noCodeEvidence);
    assert.strictEqual(check.status, 'FAILED', 'GroundingGate must reject question violating NO_CODE');
    assert(check.rejectedQuestions[0].reason.includes('TEACHER_BOUNDARY_VIOLATION'), 'Must specify TEACHER_BOUNDARY_VIOLATION');
  });

  // ----------------------------------------------------------------------------
  // Test 4: Valid New Scenario Transfer Passes GroundingGate
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 4: Valid New Scenario Transfer Passes GroundingGate ---');
  await runStep('4.1 Legitimate application scenario with domain-neutral framing words passes GroundingGate', async () => {
    const pythonLecture = `Python lists are mutable ordered collections whose elements can be modified, appended, or removed in-place.
    In contrast, tuples are immutable sequences whose structure and items cannot be changed after creation.
    Attempting to append or modify a tuple raises an exception.`;

    const transferQuestion = {
      questionId: 'Q01',
      question: 'Suppose we have a list of 100 initialized elements. If we attempt to append an item to a tuple of the same size, what outcome occurs?',
      correctAnswer: 'An exception is raised because tuples cannot be modified after creation',
      options: [
        'An exception is raised because tuples cannot be modified after creation',
        'The tuple expands dynamic memory allocation',
        'The list elements are cleared',
        'Both collections become invalid'
      ],
      metadata: { targetDifficulty: 'Medium', concept: 'Tuple Immutability' }
    };

    const result = groundingGate.validateJustification([transferQuestion], pythonLecture);
    assert.strictEqual(result.status, 'PASSED', 'Valid transfer application question must PASS GroundingGate');
    assert.strictEqual(result.justifiedQuestions.length, 1, 'Question must be justified');
  });

  // ----------------------------------------------------------------------------
  // Test 5: Foreign Topic Contamination Rejection
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 5: Foreign Topic Contamination Rejection ---');
  await runStep('5.1 Question introducing disparate ungrounded technical domain is rejected by GroundingGate', async () => {
    const pythonLecture = `Python lists are mutable ordered collections. Tuples are immutable sequences.`;

    const foreignQuestion = {
      questionId: 'Q01',
      question: 'How do Kubernetes worker nodes deploy Docker containers to pods in an AWS cluster?',
      correctAnswer: 'Kubelet orchestrates container pods across worker nodes',
      options: [
        'Kubelet orchestrates container pods across worker nodes',
        'Python list mutability allocates containers',
        'Tuples serialize the cluster configuration',
        'Docker daemon runs inside immutable tuples'
      ],
      metadata: { targetDifficulty: 'Hard', concept: 'Kubernetes Orchestration' }
    };

    const result = groundingGate.validateJustification([foreignQuestion], pythonLecture);
    assert.strictEqual(result.status, 'FAILED', 'Foreign topic question must FAIL GroundingGate');
    assert.strictEqual(result.rejectedQuestions.length, 1, 'Question must be rejected');
    assert.ok(
      result.rejectedQuestions[0].reason.includes('FOREIGN_TOPIC_CONTAMINATION') ||
      result.rejectedQuestions[0].reason.includes('ZERO_SESSION_OVERLAP'),
      `Expected foreign topic or zero overlap error, got: ${result.rejectedQuestions[0].reason}`
    );
  });

  // ----------------------------------------------------------------------------
  // Test 6: Separate Easy, Medium, Hard, and Balanced Recommendations
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 6: Separate Recommendations by Difficulty ---');
  await runStep('6.1 deriveSemanticCapacity returns distinct, defensible numbers for all difficulties', async () => {
    const conceptMap = [
      {
        id: 'C01',
        name: 'Binary Search Tree Ordering',
        definition: 'Left keys smaller than root, right keys greater.',
        mechanism_or_rule: 'Recursive traversal branch selection',
        substanceType: 'RULE'
      },
      {
        id: 'C02',
        name: 'BST Invariant Violation',
        definition: 'Condition where node ordering is broken in tree.',
        mechanism_or_rule: 'Detection via in-order monotonic check',
        substanceType: 'MECHANISM'
      }
    ];

    const critique = {
      explanatoryDepth: ['MECHANISM_AND_CAUSALITY'],
      reasoningDepth: ['STEP_BY_STEP_DERIVATION'],
      practicalDemonstrations: ['WORKED_TRACES_OR_WALKTHROUGHS']
    };

    const capacity = lectureIntelligence.deriveSemanticCapacity(conceptMap, critique);

    assert(capacity.recommendedByDifficulty, 'Must provide recommendedByDifficulty');
    assert(capacity.capacityByDifficulty, 'Must provide capacityByDifficulty');

    assert(typeof capacity.recommendedByDifficulty.easy === 'number', 'Easy recommended must be a number');
    assert(typeof capacity.recommendedByDifficulty.medium === 'number', 'Medium recommended must be a number');
    assert(typeof capacity.recommendedByDifficulty.hard === 'number', 'Hard recommended must be a number');
    assert(typeof capacity.recommendedByDifficulty.balanced === 'number', 'Balanced recommended must be a number');

    assert(capacity.totalDefensibleCapacity >= capacity.distinctConceptCount, 'Total capacity must be >= concept count for rich concepts');
    assert(capacity.advisoryRationale.includes('Balanced='), 'Rationale must articulate distinct difficulty recommendations');
  });

  // ----------------------------------------------------------------------------
  // Test 7: Honest Capacity Deficits on Excess Requested Count
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 7: Honest Capacity Deficits on Excess Requested Count ---');
  await runStep('7.1 Requesting 10 questions on a lecture supporting 4 targets produces 4 targets and 6 honest deficits', async () => {
    const evidence = {
      sessionId: 'sess_phase5_deficit_01',
      unifiedRawContent: 'Today we discuss bubble sort and selection sort algorithms. Bubble sort repeatedly swaps adjacent elements.',
      detectedFocus: ['Bubble Sort', 'Selection Sort'],
      lectureDepth: { score: 50, rating: 'Introductory' },
      lectureIntelligence: {
        evidenceCapacity: {
          totalDefensibleCapacity: 4,
          recommendedQuestionCount: 4,
          capacityByDifficulty: { easy: 2, medium: 2, hard: 0, balanced: 4 }
        }
      }
    };

    const plan = await agent1Planner.planAssessment(evidence, 'Balanced', 10);

    assert.strictEqual(plan.assessmentTargets.length, 10, 'Plan must contain 10 total target slots');
    const validTargets = plan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitTargets = plan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(validTargets.length, 4, 'Must have exactly 4 valid curricular targets');
    assert.strictEqual(deficitTargets.length, 6, 'Must have exactly 6 transparent capacity deficit slots');
    assert.strictEqual(deficitTargets[0].capacityLimitation?.status, 'INSUFFICIENT_CURRICULAR_EVIDENCE');
  });

  // ----------------------------------------------------------------------------
  // Test 8: Duplicate Facet Rejection
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 8: Duplicate Facet Rejection ---');
  await runStep('8.1 Identical concept and cognitive operation combinations are rejected as PEDAGOGICAL_DUPLICATE', async () => {
    const mockTargets = [
      {
        targetId: 'T01',
        concept: 'Binary Search Tree',
        subtopic: 'Ordering Invariant',
        intendedCognitiveOperation: 'RECOGNIZE',
        supportingEvidence: 'BST has left < root < right.'
      },
      {
        targetId: 'T02',
        concept: 'Binary Search Tree',
        subtopic: 'Node Insertion',
        intendedCognitiveOperation: 'TRACE',
        supportingEvidence: 'Compare and insert at leaf node.'
      },
      {
        targetId: 'T03',
        concept: 'Binary Search Tree',
        subtopic: 'Ordering Invariant Duplicate',
        intendedCognitiveOperation: 'RECOGNIZE', // DUPLICATE facet of T01
        supportingEvidence: 'BST ordering states left < root < right.'
      }
    ];

    const auditResult = agent1Planner._auditAssessmentTargets(mockTargets, [], 3, null);

    assert.strictEqual(auditResult.auditedTargets.length, 2, 'Only distinct facets must be accepted');
    assert.strictEqual(auditResult.auditLog.rejected.length, 1, 'Exact duplicate facet must be rejected');
    assert.strictEqual(auditResult.auditLog.rejected[0].reason, 'Duplicate concept already targeted');
  });

  // ----------------------------------------------------------------------------
  // Test 9: Chronology & Real Whisper Timestamps Preservation
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 9: Chronology & Real Whisper Timestamps Preservation ---');
  await runStep('9.1 Real Whisper segment timestamps are preserved across EARLY, MID, and LATE phases', async () => {
    const earlyText = 'Binary search tree definition and ordering invariant established at the beginning of class. Every node in a binary search tree possesses a key strictly greater than all keys stored within its left subtree, and strictly less than all keys within its right subtree. We establish these structural invariants early so that search operations achieve logarithmic time complexity on average when trees remain reasonably balanced. This fundamental property forms the core foundation for all dynamic ordered set implementations and dictionary lookups discussed today.';
    const midText = 'In-order traversal mechanics and recursive algorithmic steps explained in the middle of class. When traversing a binary search tree using in-order traversal, we recursively process the left child, visit the root node, and then recursively traverse the right child. Because of the binary search tree property, visiting nodes in this specific sequence yields the keys in sorted ascending order without requiring an explicit external sorting algorithm. We walk through this recursion step by step on the chalkboard.';
    const lateText = 'AVL rotation rebalancing and performance guarantees analyzed at the end of class. When unbalanced insertions occur, a binary search tree can degenerate into a linked list with linear worst-case lookup performance. To guarantee logarithmic bounds in all scenarios, we perform single and double tree rotations upon detecting height imbalances, maintaining strict balance invariants across the entire structure before completing our lecture. This guarantees logarithmic worst-case search and deletion times for our data structures.';

    const segments = [
      { start: 15.0, end: 60.0, text: earlyText },
      { start: 300.0, end: 360.0, text: midText },
      { start: 700.0, end: 760.0, text: lateText }
    ];

    const store = HierarchicalChunker.buildStore({
      voiceTranscript: segments.map(s => s.text).join(' '),
      transcriptSegments: segments,
      sessionId: 'sess_phase5_chrono'
    });

    const packaged = evidencePackager.packageSessionEvidence({
      voiceTranscript: segments.map(s => s.text).join(' '),
      transcriptSegments: segments,
      sessionId: 'sess_phase5_chrono'
    });

    assert(packaged.hierarchicalStore, 'Hierarchical store must be built');
    const children = packaged.hierarchicalStore.children || [];
    assert(children.length >= 3, `Expected at least 3 children, got ${children.length}`);
    assert.strictEqual(children[0].hasRealTimestamps, true, 'First child must have real timestamps');
    assert.strictEqual(typeof children[0].timeSpan?.start, 'number', 'Numeric start timestamp must be preserved');
    assert.strictEqual(children[0].timeSpan.start, 15.0, 'Start timestamp must match early segment');
    assert.strictEqual(children[2].timeSpan.start, 700.0, 'Late child start timestamp must match late segment');
  });

  // ----------------------------------------------------------------------------
  // Test 10: Preview vs Production Capacity Consistency
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 10: Preview vs Production Capacity Consistency ---');
  await runStep('10.1 Capacity derived in lectureIntelligence preview matches production planner capacity limit', async () => {
    const rawLecture = `Bubble Sort repeatedly steps through the list, compares adjacent elements and swaps them if they are in the wrong order.
    The pass through the list is repeated until the list is sorted.
    Selection Sort divides the input list into two parts: a sorted sublist and an unsorted sublist.
    It repeatedly finds the minimum element from the unsorted sublist and moves it to the sorted sublist.`;

    const previewResult = lectureIntelligence.buildPartialFallback({
      evidenceText: rawLecture,
      modality: 'VOICE_ONLY',
      hasTimingData: false
    });

    const previewCapacity = previewResult.evidenceCapacity;
    assert(previewCapacity, 'Preview must include evidenceCapacity');
    assert(previewCapacity.totalDefensibleCapacity > 0, 'Preview capacity must be positive');

    const sessionEvidence = {
      sessionId: 'sess_phase5_preview_prod',
      unifiedRawContent: rawLecture,
      detectedFocus: previewResult.conceptMap.map(c => c.name),
      lectureDepth: { score: 65, rating: 'Developing' },
      lectureIntelligence: previewResult
    };

    // Requesting far more than preview capacity
    const requested = previewCapacity.totalDefensibleCapacity + 5;
    const plan = await agent1Planner.planAssessment(sessionEvidence, 'Balanced', requested);

    const validTargets = plan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(
      validTargets.length,
      previewCapacity.totalDefensibleCapacity,
      `Production planned targets (${validTargets.length}) must strictly equal preview capacity (${previewCapacity.totalDefensibleCapacity})`
    );

    const deficitCount = plan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT').length;
    assert.strictEqual(deficitCount, 5, 'Excess requests must be withheld as deficit slots in production');
  });

  // ----------------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  console.log(`📊 Phase 5 Suite Complete: ${passed}/${testResults.length} Tests Passed`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed in Phase 5 suite:`);
    testResults.filter(r => r.status === 'FAIL').forEach(f => {
      console.error(`  - ${f.name}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${passed} PHASE 5 ACCEPTANCE TESTS PASSED CLEANLY!`);
    process.exit(0);
  }
}

runPhase5Suite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
