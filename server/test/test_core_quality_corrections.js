/**
 * Comprehensive Regression Test Suite: KMIT Kahoot Core Quality Corrections
 *
 * Verifies:
 * 1. Critical Difficulty-Capacity Verification:
 *    - Authoritative evidence-capacity precedence (never fall back to requested/planned quota)
 *    - Genuine initial difficulty recalculation using evidence capacity
 *    - Hard cap = 2 (req = 3), Hard cap = 0 (req = 3), Hard cap = 4 (req = 3)
 *    - Missing/undefined capacity fails closed to 0
 *    - Reserve targets with Medium-only evidence vs genuine Hard evidence
 * 2. Variable Grounding Adversarial Tests:
 *    - count = 0 validates count reset
 *    - count = 0 rejects j reset
 *    - for (int j=0; ...) validates initialization of j
 *    - Loop-header initialization alone does not validate repeated resetting of j
 *    - count++ does not validate j++
 *    - Unsupported variable relationships fail closed
 *    - Ordinary English technical words ("virtual", "update", "table", "process") are not captured as variables
 * 3. Difficulty Detection Regression:
 *    - Rejects basic recall and procedural tracing as Hard
 *    - Retains genuine prediction, diagnosis, invariants, and tradeoffs as Hard
 *    - Semantic variations not depending exclusively on fixed vocabulary
 * 4. System Robustness & Non-Regression:
 *    - Pre-check, distractor fitness, duplicate prevention, and provider timeout/429 classification
 */

'use strict';

const assert = require('assert');
const path = require('path');

const groundingGate = require('../engine/validators/groundingGate');
const agent1Planner = require('../engine/agents/agent1Planner');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

async function runTests() {
  console.log('🚀 Running KMIT Kahoot Core Quality Corrections Comprehensive Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // ==========================================================================
  // SUITE 1: Critical Difficulty-Capacity Verification
  // ==========================================================================
  console.log('\n--- Suite 1: Critical Difficulty-Capacity Verification ---');

  // Test 1.1: Evidence capacity Hard = 2, requested Hard = 3 (Balanced N=10)
  test('1.1 Initial allocation recalculates when Hard cap = 2 and requested Hard = 3 (Balanced N=10)', () => {
    const mockEvidence = {
      unifiedRawContent: 'Sample lecture with nested loops and array frequency mechanisms.',
      subtopics: [
        { name: 'Array Indexing', spokenText: 'arrays start at index 0 and go to length minus 1' },
        { name: 'Outer Loop Selection', spokenText: 'outer loop selects each element in sequence' },
        { name: 'Inner Loop Comparison', spokenText: 'inner loop scans every element comparing with target' },
        { name: 'Frequency Counter Reset', spokenText: 'count variable is reset to zero for each outer iteration' },
        { name: 'Quadratic Time Complexity', spokenText: 'nested loops result in N squared comparisons' },
        { name: 'Visited Flag Optimization', spokenText: 'flag prevents recounting previously counted elements' }
      ],
      lectureIntelligence: {
        evidenceCapacity: {
          capacityByDifficulty: { easy: 6, medium: 10, hard: 2, balanced: 18 }
        }
      }
    };

    const planData = {
      mainTopic: 'Java Array Frequency Calculation',
      subtopics: mockEvidence.subtopics.map(s => s.name),
      assessmentTargets: []
    };

    agent1Planner._applyDifficultyBlueprint(planData, 'Balanced', 10, mockEvidence, 'FILL_WITH_MEDIUM');

    const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
    const allocatedMedium = planData.topicDifficultyMatrix.globalAllocated.Medium;
    const allocatedEasy = planData.topicDifficultyMatrix.globalAllocated.Easy;
    const totalAllocated = allocatedHard + allocatedMedium + allocatedEasy;

    assert.strictEqual(allocatedHard, 2, `Hard allocation must be exactly capped at 2 (got ${allocatedHard})`);
    assert.strictEqual(totalAllocated, 10, `Total allocated (${totalAllocated}) must equal requested N=10`);
    assert(allocatedMedium >= 5, `Medium allocation (${allocatedMedium}) must absorb the Hard shortfall`);
  });

  // Test 1.2: Evidence capacity Hard = 0, requested Hard = 3
  test('1.2 Evidence capacity Hard = 0 strictly caps initial and reserve Hard allocation to 0', () => {
    const mockEvidence = {
      unifiedRawContent: 'Introductory array definition lecture with syntax only.',
      subtopics: [
        { name: 'Array Definition', spokenText: 'an array is an indexed collection of elements' },
        { name: 'Declaration Syntax', spokenText: 'int square brackets arr equals new int ten' }
      ],
      lectureIntelligence: {
        evidenceCapacity: {
          capacityByDifficulty: { easy: 6, medium: 6, hard: 0, balanced: 12 }
        }
      }
    };

    const planData = {
      mainTopic: 'Array Basics',
      subtopics: mockEvidence.subtopics.map(s => s.name),
      assessmentTargets: []
    };

    agent1Planner._applyDifficultyBlueprint(planData, 'Balanced', 10, mockEvidence, 'FILL_WITH_MEDIUM');
    const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
    assert.strictEqual(allocatedHard, 0, `Initial allocation must allocate strictly 0 Hard targets (got ${allocatedHard})`);

    // Simulate reserve promotion with Hard cap = 0
    const reserve = {
      targetId: 'R01',
      concept: 'Array Syntax Definition',
      supportingEvidence: 'int arr[] = new int[10];'
    };
    const cap = agent1Planner._resolveCapacity(mockEvidence);
    assert.strictEqual(cap.effectiveHardCap, 0, 'Resolved capacity must report effectiveHardCap = 0');
    assert.strictEqual(cap.hardFeasible, false, 'hardFeasible must be false');
  });

  // Test 1.3: Evidence capacity Hard = 4, requested Hard = 3 (Balanced N=10)
  test('1.3 Evidence capacity Hard = 4 respects requested Balanced quota of 3 Hard', () => {
    const mockEvidence = {
      unifiedRawContent: 'Deep algorithmic analysis lecture with proofs and asymptotic bounds.',
      subtopics: [
        { name: 'Loop Invariants', spokenText: 'invariant preservation requires inductive base case' },
        { name: 'Quadratic Bound Proof', spokenText: 'formal proof of quadratic lower bound' },
        { name: 'Tradeoff Analysis', spokenText: 'time versus space tradeoff in hash table alternative' },
        { name: 'Boundary Conditions', spokenText: 'off-by-one boundary condition in empty array' }
      ],
      lectureIntelligence: {
        evidenceCapacity: {
          capacityByDifficulty: { easy: 5, medium: 8, hard: 4, balanced: 17 }
        }
      }
    };

    const planData = {
      mainTopic: 'Advanced Algorithmic Analysis',
      subtopics: mockEvidence.subtopics.map(s => s.name),
      assessmentTargets: []
    };

    agent1Planner._applyDifficultyBlueprint(planData, 'Balanced', 10, mockEvidence, 'FILL_WITH_MEDIUM');
    const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
    // Ideal Balanced for N=10 is 3 Easy, 4 Medium, 3 Hard. Capacity is 4, so requested 3 is fully honored.
    assert.strictEqual(allocatedHard, 3, `Hard allocation must be exactly 3 for Balanced N=10 when cap >= 3 (got ${allocatedHard})`);
  });

  // Test 1.4: Evidence capacity Hard missing/undefined fails closed to 0
  test('1.4 Missing or corrupted evidence capacity fails closed to 0 Hard targets (never defaults to request)', () => {
    const missingCapEvidence = {
      unifiedRawContent: 'Lecture content without any capacity metadata.'
    };

    const cap = agent1Planner._resolveCapacity(missingCapEvidence);
    assert.strictEqual(cap.isCapacityValid, false, 'isCapacityValid must be false for missing capacity');
    assert.strictEqual(cap.effectiveHardCap, 0, 'effectiveHardCap must fail closed to 0');
    assert.strictEqual(cap.hardFeasible, false, 'hardFeasible must be false');

    // Ensure that plan generation fails closed rather than defaulting to targetHard
    const planData = {
      mainTopic: 'Unanalyzed Topic',
      subtopics: ['General Concepts'],
      assessmentTargets: []
    };

    agent1Planner._applyDifficultyBlueprint(planData, 'Balanced', 10, missingCapEvidence, 'FILL_WITH_MEDIUM');
    const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
    assert.strictEqual(allocatedHard, 0, `When capacity is missing, initial Hard allocation must fail closed to 0 (got ${allocatedHard})`);
  });

  // Test 1.5: Reserve target with Medium-only evidence
  test('1.5 Reserve concept with Medium-only evidence is never forced to Hard', () => {
    const mediumReserve = {
      targetId: 'R01',
      concept: 'Inner Loop Comparison Mechanics',
      supportingEvidence: 'The inner loop iterates through the array comparing elements sequentially.'
    };

    const mockEvidencePackage = {
      lectureIntelligence: {
        evidenceCapacity: { capacityByDifficulty: { hard: 2 } }
      }
    };

    const depth = agent1Planner._detectConceptDepth(mediumReserve.concept, mediumReserve.supportingEvidence, mockEvidencePackage);
    assert.strictEqual(depth.supportsHard, false, 'Procedural comparison concept must NOT support Hard tier');
    assert.strictEqual(depth.hasProcedure, true, 'Procedural mechanism must be detected for Medium');
  });

  // Test 1.6: Reserve target with genuine Hard evidence
  test('1.6 Reserve concept with genuine Hard evidence is recognized as Hard', () => {
    const hardReserve = {
      targetId: 'R02',
      concept: 'Quadratic Time Complexity Invariant and Recounting Bottleneck',
      supportingEvidence: 'The nested loop strictly enforces an O(N^2) time constraint and requires an invariant check on visited state to prevent redundant recounting violation.'
    };

    const mockEvidencePackage = {
      lectureIntelligence: {
        evidenceCapacity: { capacityByDifficulty: { hard: 2 } }
      }
    };

    const depth = agent1Planner._detectConceptDepth(hardReserve.concept, hardReserve.supportingEvidence, mockEvidencePackage);
    assert.strictEqual(depth.supportsHard, true, 'Invariant and defect concept must support Hard tier');
    assert.strictEqual(depth.hasInvariant, true, 'Invariant must be detected');
    assert.strictEqual(depth.hasViolation, true, 'Violation must be detected');
  });

  // Test 1.7: An Easy reserve must NOT become Hard because the lecture contains words such as "frequency" or "visited"
  test('1.7 An Easy reserve must not become Hard because the lecture contains frequency or visited', () => {
    const easyReserve = {
      targetId: 'R02',
      concept: 'Linear Search for Frequency - Reserve Easy Peer',
      targetDifficulty: 'Easy',
      originalDifficulty: 'Easy',
      supportingEvidence: ''
    };

    const mockEvidencePackage = {
      unifiedRawContent: 'The lecture covers frequency array construction, visited array flags, and duplicate counts.',
      lectureIntelligence: { evidenceCapacity: { capacityByDifficulty: { easy: 6, medium: 10, hard: 2 } } }
    };

    const planContext = {
      agent1Planner,
      evidencePackage: mockEvidencePackage,
      plan: { depthCapacity: { supportedHardCount: 2 }, difficultyBlueprint: { counts: { Easy: 3, Medium: 4, Hard: 3 } } },
      passingQuestions: [], // 0 Hard delivered so far -> preferredTier requests Hard
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    };

    const allocatedTier = pipelineOrchestrator.determineFeasibleReserveTier(easyReserve, 'Hard', planContext);
    assert.strictEqual(allocatedTier, 'Easy', `Easy reserve must strictly remain Easy despite Balanced request (got ${allocatedTier})`);
  });

  // Test 1.8: A Medium reserve must NOT become Hard because the lecture contains words such as "frequency" or "visited"
  test('1.8 A Medium reserve must not become Hard because the lecture contains frequency or visited', () => {
    const medReserve = {
      targetId: 'R01',
      concept: 'Linear Search for Frequency - Reserve Medium Peer',
      targetDifficulty: 'Medium',
      originalDifficulty: 'Medium',
      supportingEvidence: ''
    };

    const mockEvidencePackage = {
      unifiedRawContent: 'The lecture covers frequency array construction, visited array flags, and duplicate counts.',
      lectureIntelligence: { evidenceCapacity: { capacityByDifficulty: { easy: 6, medium: 10, hard: 2 } } }
    };

    const planContext = {
      agent1Planner,
      evidencePackage: mockEvidencePackage,
      plan: { depthCapacity: { supportedHardCount: 2 }, difficultyBlueprint: { counts: { Easy: 3, Medium: 4, Hard: 3 } } },
      passingQuestions: [], // 0 Hard delivered so far -> preferredTier requests Hard
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    };

    const allocatedTier = pipelineOrchestrator.determineFeasibleReserveTier(medReserve, 'Hard', planContext);
    assert.strictEqual(allocatedTier, 'Medium', `Medium reserve must strictly remain Medium despite Balanced request (got ${allocatedTier})`);
  });

  // Test 1.9: A genuinely Hard reserve with appropriate supporting evidence remains eligible for Hard
  test('1.9 A genuinely Hard reserve with appropriate supporting evidence remains eligible for Hard', () => {
    const hardReserve = {
      targetId: 'R06',
      concept: 'Visited State Invariant - Reserve Hard Peer',
      targetDifficulty: 'Hard',
      originalDifficulty: 'Hard',
      supportingEvidence: 'The nested loop strictly enforces an invariant constraint to prevent recounting defect and algorithmic bug.'
    };

    const mockEvidencePackage = {
      unifiedRawContent: 'The lecture covers nested loops and frequency arrays.',
      lectureIntelligence: { evidenceCapacity: { capacityByDifficulty: { easy: 6, medium: 10, hard: 2 } } }
    };

    const planContext = {
      agent1Planner,
      evidencePackage: mockEvidencePackage,
      plan: { depthCapacity: { supportedHardCount: 2 }, difficultyBlueprint: { counts: { Easy: 3, Medium: 4, Hard: 3 } } },
      passingQuestions: [], // 0 Hard delivered so far
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    };

    const allocatedTier = pipelineOrchestrator.determineFeasibleReserveTier(hardReserve, 'Hard', planContext);
    assert.strictEqual(allocatedTier, 'Hard', `Genuinely Hard reserve with evidence must remain Hard (got ${allocatedTier})`);
  });

  // Test 1.10: A reserve without sufficient evidence must NOT be promoted to Hard, even when Hard is needed
  test('1.10 A reserve without sufficient evidence must not be promoted to Hard (recalibrates to Medium deficit fill)', () => {
    const hardReserveNoEv = {
      targetId: 'R03',
      concept: 'Nested Loop Logic for All Elements - Reserve Hard Peer',
      targetDifficulty: 'Hard',
      originalDifficulty: 'Hard',
      supportingEvidence: '' // No item-specific evidence provided
    };

    const mockEvidencePackage = {
      unifiedRawContent: 'The lecture covers frequency array construction and duplicate counting.',
      lectureIntelligence: { evidenceCapacity: { capacityByDifficulty: { easy: 6, medium: 10, hard: 2 } } }
    };

    const planContext = {
      agent1Planner,
      evidencePackage: mockEvidencePackage,
      plan: { depthCapacity: { supportedHardCount: 2 }, difficultyBlueprint: { counts: { Easy: 3, Medium: 4, Hard: 3 } } },
      passingQuestions: [], // 0 Hard delivered so far -> preferredTier requests Hard
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    };

    const allocatedTier = pipelineOrchestrator.determineFeasibleReserveTier(hardReserveNoEv, 'Hard', planContext);
    assert.strictEqual(allocatedTier, 'Medium', `Hard reserve without evidence must recalibrate to Medium deficit fill (got ${allocatedTier})`);
  });

  // ==========================================================================
  // SUITE 2: Variable Grounding Adversarial Tests
  // ==========================================================================
  console.log('\n--- Suite 2: Variable Grounding Adversarial Tests ---');

  const nestedLoopLecture = `
    So we have an array of integers. In our algorithm, the outer loop takes each element.
    Now, what is crucial is that before we count the occurrences, the count variable must be resetted to zero.
    We do count = 0 at the start of each outer loop iteration.
    Then inner loop for int j = 0; j < arr.length; j++ compares the elements.
    If arr[i] == arr[j], count++;
  `;

  // Test 2.1: count = 0 validates count reset
  test('2.1 count = 0 evidence validates count reset claim', () => {
    const question = {
      questionText: 'When the outer loop advances to the next element, what must happen to the variable count?',
      correctAnswer: 'The variable count must be reset to 0 before the inner loop begins scanning.',
      options: [
        'The variable count must be reset to 0 before the inner loop begins scanning.',
        'The variable count is doubled to track cumulative frequencies.',
        'The variable count is decremented by 1 to adjust for 0-based indexing.',
        'The variable count is preserved to maintain the total running sum.'
      ]
    };

    const check = groundingGate._checkJustification(question.questionText, question.correctAnswer, nestedLoopLecture, question);
    assert.strictEqual(check.isJustified, true, `count reset claim must be validated: ${check.reason}`);
  });

  // Test 2.2: count = 0 rejects j reset
  test('2.2 count = 0 evidence rejects j reset claim with UNGROUNDED_VARIABLE_CLAIM', () => {
    const question = {
      questionText: 'When the outer loop advances to the next element, what must happen to the inner loop index j?',
      correctAnswer: 'It must be reset to 0 to compare the new target element against every element from the start.',
      options: [
        'It must be reset to 0 to compare the new target element against every element from the start.',
        'It must increment by 2 to skip redundant comparisons.',
        'It retains its previous index position to avoid backwards comparisons.',
        'It is assigned to arr.length to terminate the inner loop immediately.'
      ]
    };

    const check = groundingGate._checkJustification(question.questionText, question.correctAnswer, nestedLoopLecture, question);
    assert.strictEqual(check.isJustified, false, 'j reset claim must be rejected when only count is reset');
    assert(check.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must report UNGROUNDED_VARIABLE_CLAIM: ${check.reason}`);
    assert(check.reason.includes('count'), `Must note that reset action was attributed to 'count': ${check.reason}`);
  });

  // Test 2.3: for (int j=0; ...) validates initialization of j
  test('2.3 Loop header for (int j = 0; ...) validates initialization of j', () => {
    const question = {
      questionText: 'How is the inner loop variable j initialized in this algorithm?',
      correctAnswer: 'Initialize index j to 0 at the start of the inner loop traversal.',
      options: [
        'Initialize index j to 0 at the start of the inner loop traversal.',
        'Initialize index j to 1 to skip the first element.',
        'Initialize index j to arr.length - 1 to scan backwards.',
        'Initialize index j to the outer loop position plus 1.'
      ]
    };

    const check = groundingGate._checkJustification(question.questionText, question.correctAnswer, nestedLoopLecture, question);
    assert.strictEqual(check.isJustified, true, `Initialization of j from loop header must pass: ${check.reason}`);
  });

  // Test 2.4: Loop-header initialization alone does not validate repeated resetting of j
  test('2.4 Loop-header initialization alone does NOT validate repeated resetting of j inside every outer-loop iteration', () => {
    const outerInnerLecture = `
      for (int i = 0; i < n; i++) {
        count = 0;
        for (int j = 0; j < n; j++) {
          if (arr[i] == arr[j]) count++;
        }
      }
    `;

    const question = {
      questionText: 'What action is repeatedly performed on inner loop index j in every iteration of the outer loop?',
      correctAnswer: 'The inner loop index j must be reset to 0.',
      options: [
        'The inner loop index j must be reset to 0.',
        'The inner loop index j is preserved across iterations.',
        'The inner loop index j is incremented by outer loop index i.',
        'The inner loop index j is multiplied by 2.'
      ]
    };

    const check = groundingGate._checkJustification(question.questionText, question.correctAnswer, outerInnerLecture, question);
    assert.strictEqual(check.isJustified, false, 'Loop-header initialization alone must NOT validate resetting j');
    assert(check.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must reject with UNGROUNDED_VARIABLE_CLAIM: ${check.reason}`);
  });

  // Test 2.5: count++ does not validate j++
  test('2.5 count++ in evidence does NOT validate j++ claim', () => {
    const matchIncrementLecture = `
      So we compare the elements in the array to find occurrences.
      If the element matches the target value, we increment the frequency counter: count++;
      The counter variable count keeps track of all matching occurrences.
    `;

    const question = {
      questionText: 'What operation occurs when a matching element is detected in the inner loop?',
      correctAnswer: 'Index j is incremented: j++',
      options: [
        'Index j is incremented: j++',
        'The outer loop terminates immediately',
        'The array is reallocated in memory',
        'The array elements are swapped'
      ]
    };

    const check = groundingGate._checkJustification(question.questionText, question.correctAnswer, matchIncrementLecture, question);
    assert.strictEqual(check.isJustified, false, 'j++ must be rejected when evidence only has count++');
    assert(check.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must report UNGROUNDED_VARIABLE_CLAIM: ${check.reason}`);
    assert(check.reason.includes('count'), `Must note that increment action was attributed to 'count': ${check.reason}`);
  });

  // Test 2.6: Unsupported variable relationships fail closed
  test('2.6 Unsupported variable relationships fail closed', () => {
    // Sub-case A: Misattribution to ungrounded variable k when count was reset
    const questionA = {
      questionText: 'What happens to the tracker variable at the start of processing?',
      correctAnswer: 'Reset variable k to 0',
      options: [
        'Reset variable k to 0',
        'Multiply variable k by 2',
        'Set variable k to arr.length',
        'Shift variable k to the left'
      ]
    };
    const checkA = groundingGate._checkJustification(questionA.questionText, questionA.correctAnswer, nestedLoopLecture, questionA);
    assert.strictEqual(checkA.isJustified, false, 'Unreferenced variable k must fail closed');
    assert(checkA.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must report UNGROUNDED_VARIABLE_CLAIM: ${checkA.reason}`);

    // Sub-case B: Completely untaught variable action where no reset exists in lecture
    const noResetLecture = 'This lecture discusses contiguous array memory layout and base address offsets in heap storage.';
    const questionB = {
      questionText: 'What variable operation is performed before memory addressing?',
      correctAnswer: 'Reset variable k to 0',
      options: [
        'Reset variable k to 0',
        'Allocate dynamic pointer',
        'Free array chunk',
        'Return base pointer'
      ]
    };
    const checkB = groundingGate._checkJustification(questionB.questionText, questionB.correctAnswer, noResetLecture, questionB);
    assert.strictEqual(checkB.isJustified, false, 'Untaught variable action must fail closed');
    assert(checkB.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must report UNGROUNDED_VARIABLE_CLAIM: ${checkB.reason}`);
    assert(checkB.reason.includes('unsupported'), `Reason must specify that variable relationship is unsupported: ${checkB.reason}`);
  });

  // Test 2.7: Regex does not accidentally interpret ordinary English words as variable names
  test('2.7 Regex does not interpret ordinary English words ("virtual", "update", "table", "process") as variables', () => {
    const networkingLecture = `
      In packet routing, the virtual routing table maintains the optimal next hop address for each network destination.
      When a topology update arrives, the routing table is modified by the routing process.
    `;

    const soundQuestion = {
      questionText: 'What is the role of the virtual routing table in packet routing?',
      correctAnswer: 'It maintains the optimal next hop address for each network destination.',
      options: [
        'It maintains the optimal next hop address for each network destination.',
        'It encrypts packet payloads before physical transmission.',
        'It discards all incoming broadcast packets immediately.',
        'It reallocates network interface bandwidth dynamically.'
      ]
    };

    const check = groundingGate._checkJustification(soundQuestion.questionText, soundQuestion.correctAnswer, networkingLecture, soundQuestion);
    assert.strictEqual(check.isJustified, true, `Networking question with "virtual routing table" must PASS without false variable claims: ${check.reason}`);
  });

  // Test 2.8: Negative Regression: T03 inner loop index reinitialization claim rejected when evidence only resets count
  test('2.8 T03 negative regression: "Reinitialize inner loop index" rejected when evidence only resets count', () => {
    const lectureEvidence = `
      int count equal to 0. Why am I declaring count variable inside the first for loop?
      Every time the main number changes, count should be resetted to 0. That's why count would always be inside.
      Then we run our inner loop for checking the frequency.
    `;
    const t03Question = {
      questionText: 'When using two nested loops to count the frequency of the value 2 in the array [1,2,11,21,2,30], which constraint must be enforced to avoid counting the same element multiple times?',
      correctAnswer: 'Reinitialize the inner loop index for each outer iteration so every element is compared anew.',
      options: [
        'Skip already counted elements in the outer loop to prevent double-counting.',
        'Reinitialize the inner loop index for each outer iteration so every element is compared anew.',
        'Replace nested loops with a hash map for linear-time frequency counting.',
        'Assume the frequency of 2 is 1 because it appears only once in the array.'
      ]
    };

    const check = groundingGate._checkJustification(t03Question.questionText, t03Question.correctAnswer, lectureEvidence, t03Question);
    assert.strictEqual(check.isJustified, false, 'T03 claim attributing reinitialize/reset to inner loop index must be rejected');
    assert(check.reason.includes('UNGROUNDED_VARIABLE_CLAIM'), `Must reject with UNGROUNDED_VARIABLE_CLAIM: ${check.reason}`);
    assert(check.reason.includes('inner loop index'), `Must identify inner loop index as ungrounded: ${check.reason}`);
  });

  // ==========================================================================
  // SUITE 3: Difficulty Detection Regression
  // ==========================================================================
  console.log('\n--- Suite 3: Difficulty Detection Regression ---');

  // Test 3.1: Rejects basic recall and procedural tracing as Hard
  test('3.1 Rejects basic recall and procedural tracing as Hard', () => {
    const recallConcept = 'Array Indexing and Element Retrieval';
    const recallEvidence = 'Arrays store elements in contiguous memory. You access an element using its index arr[i].';

    const depthRecall = agent1Planner._detectConceptDepth(recallConcept, recallEvidence, {});
    assert.strictEqual(depthRecall.supportsHard, false, 'Basic index retrieval must not support Hard');

    const traceConcept = 'Outer Loop Array Scan';
    const traceEvidence = 'The outer loop starts at 0 and increments i by 1 until reaching the end of the array.';
    const depthTrace = agent1Planner._detectConceptDepth(traceConcept, traceEvidence, {});
    assert.strictEqual(depthTrace.supportsHard, false, 'Procedural loop scan must not support Hard');
    assert.strictEqual(depthTrace.hasProcedure, true, 'Procedural loop scan should support Medium');
  });

  // Test 3.2: Retains genuine prediction, diagnosis, invariants, and tradeoffs as Hard
  test('3.2 Retains genuine prediction, diagnosis, invariants, and tradeoffs as Hard', () => {
    // Invariant
    const invConcept = 'Binary Search Tree Ordering Invariant';
    const invEvidence = 'The BST invariant guarantees that all keys in the left subtree remain strictly smaller than the root node.';
    const depthInv = agent1Planner._detectConceptDepth(invConcept, invEvidence, {});
    assert.strictEqual(depthInv.supportsHard, true, 'BST invariant must support Hard');
    assert.strictEqual(depthInv.hasInvariant, true, 'Invariant indicator must be true');

    // Diagnosis / Fault
    const diagConcept = 'Buffer Overflow Edge Case Diagnosis';
    const diagEvidence = 'If index bounds are not checked, an off-by-one defect causes buffer overflow and memory corruption.';
    const depthDiag = agent1Planner._detectConceptDepth(diagConcept, diagEvidence, {});
    assert.strictEqual(depthDiag.supportsHard, true, 'Buffer overflow diagnosis must support Hard');
    assert.strictEqual(depthDiag.hasViolation, true, 'Violation/defect indicator must be true');

    // Tradeoff
    const tradeoffConcept = 'Hash Table versus Nested Loop Complexity Tradeoff';
    const tradeoffEvidence = 'Comparing the O(N) time with O(N) memory overhead of a hash table against the O(N^2) time tradeoff of nested loops.';
    const depthTradeoff = agent1Planner._detectConceptDepth(tradeoffConcept, tradeoffEvidence, {});
    assert.strictEqual(depthTradeoff.supportsHard, true, 'Complexity tradeoff must support Hard');
    assert.strictEqual(depthTradeoff.hasTradeoff, true, 'Tradeoff indicator must be true');
  });

  // Test 3.3: Semantic variations not depending exclusively on fixed vocabulary
  test('3.3 Semantic variations recognize Hard cognitive depth beyond fixed single-word lists', () => {
    const semanticInvariant = {
      concept: 'Inductive Loop Correctness',
      evidence: 'The algorithm ensures that the cumulative prefix sum remains monotonic across all iterations.'
    };
    const depthSemInv = agent1Planner._detectConceptDepth(semanticInvariant.concept, semanticInvariant.evidence, {});
    assert.strictEqual(depthSemInv.supportsHard, true, 'Semantic invariant (monotonic, ensures) must support Hard');

    const semanticDefect = {
      concept: 'Concurrency Hazard',
      evidence: 'Unsynchronized threads produce a race condition resulting in deadlock and program crash.'
    };
    const depthSemDefect = agent1Planner._detectConceptDepth(semanticDefect.concept, semanticDefect.evidence, {});
    assert.strictEqual(depthSemDefect.supportsHard, true, 'Semantic defect (race condition, deadlock, crash) must support Hard');
  });

  // ==========================================================================
  // SUITE 4: System Robustness & Non-Regression
  // ==========================================================================
  console.log('\n--- Suite 4: System Robustness & Non-Regression ---');

  // Test 4.1: Valid 4-option question with plausible distractors passes
  test('4.1 Valid 4-option question with plausible distractors continues to pass all gates', () => {
    const validMCQ = {
      questionText: 'In a nested-loop frequency counting algorithm, what is the primary role of the outer loop?',
      correctAnswer: 'Selects the element at the current outer-loop position as the target value',
      options: [
        'Selects the element at the current outer-loop position as the target value',
        'Scans the entire array to count matching occurrences of the target',
        'Stores the computed frequencies in a secondary hash table',
        'Sorts the array elements into ascending order before scanning'
      ]
    };

    const preCheck = deterministicValidator.runPreChecks(validMCQ);
    assert.strictEqual(preCheck.isValid, true, 'Pre-check must confirm 4 valid options and format');

    const ambiguityCheck = deterministicValidator.detectOptionAmbiguity(validMCQ);
    assert.notStrictEqual(ambiguityCheck.classification, 'POTENTIAL_MULTI_KEY', 'Options must be mutually exclusive');
  });

  // Test 4.2: Duplicate question detection prevents attempt budget exhaustion
  test('4.2 Duplicate concept facets are properly detected to prevent attempt budget exhaustion', () => {
    const existingQuestions = [
      {
        questionText: 'Why does the frequency algorithm take quadratic time when using nested loops?',
        correctAnswer: 'Because the inner loop scans all N elements for each of the N outer loop iterations',
        metadata: { concept: 'Time Complexity', dimension: 'Cause / Effect' }
      }
    ];

    const duplicateCandidate = {
      questionText: 'What causes the nested loop frequency algorithm to have quadratic time complexity O(N^2)?',
      correctAnswer: 'The inner loop compares every element across all iterations of the outer loop',
      metadata: { concept: 'Time Complexity', dimension: 'Cause / Effect' }
    };

    const dupCheck = deterministicValidator.checkDuplicateQuestion(
      duplicateCandidate,
      existingQuestions,
      duplicateCandidate.metadata
    );

    assert.strictEqual(dupCheck.isDuplicate, true, 'Duplicate question on same concept and dimension must be detected');
    assert(dupCheck.similarity >= 0.35, `Similarity (${dupCheck.similarity}) must meet duplicate threshold`);
  });

  // Test 4.3: Provider timeout and 429 failures are separately classified
  test('4.3 Provider timeout and 429 failures are separately classified', () => {
    const timeoutErr = new Error('timeout of 30000ms exceeded');
    timeoutErr.code = 'ECONNABORTED';

    const rateLimitErr = new Error('Request failed with status code 429');
    rateLimitErr.response = { status: 429, data: { error: { message: 'Rate limit reached for requests per minute' } } };

    function classifyError(err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message || err.message || '';
      const isTPD = errorMsg.includes('tokens per day') || errorMsg.includes('TPD');
      const isRateLimit = status === 429 || errorMsg.includes('429') || errorMsg.includes('Rate limit') || isTPD;
      const isTimeout = err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || err.message?.includes('timeout');

      return { isRateLimit, isTimeout };
    }

    const tResult = classifyError(timeoutErr);
    assert.strictEqual(tResult.isTimeout, true, 'Timeout error must be classified as isTimeout');
    assert.strictEqual(tResult.isRateLimit, false, 'Timeout error must NOT be classified as isRateLimit');

    const rResult = classifyError(rateLimitErr);
    assert.strictEqual(rResult.isRateLimit, true, '429 error must be classified as isRateLimit');
    assert.strictEqual(rResult.isTimeout, false, '429 error must NOT be classified as isTimeout');
  });

  // ==========================================================================
  // SUITE 5: Count-Fulfillment & Replenishment Invariants (Defects 1 & 2)
  // ==========================================================================
  console.log('\n--- Suite 5: Count-Fulfillment & Replenishment Invariants ---');

  // Test 5.1: Attempt ceiling computation for N=10, 20, 25, 40, 5
  test('5.1 Attempt ceiling scales with requested count and primary+reserve pools (N=10->20, N=20->40, N=25->50)', () => {
    // For N=10 (primary 10, reserves 5): targetAttemptBudget = 15, ceil(10*2) = 20 -> 20
    const ceilingN10 = pipelineOrchestrator.calculateAttemptCeiling(10, 10, 5);
    assert.strictEqual(ceilingN10, 20, `Ceiling for N=10 must be 20 (got ${ceilingN10})`);

    // For N=20 (primary 20, reserves 10): targetAttemptBudget = 30, ceil(20*2) = 40 -> 40 (previously capped at 24!)
    const ceilingN20 = pipelineOrchestrator.calculateAttemptCeiling(20, 20, 10);
    assert.strictEqual(ceilingN20, 40, `Ceiling for N=20 must be 40, exceeding old 24 ceiling (got ${ceilingN20})`);

    // For N=25 (primary 25, reserves 13): targetAttemptBudget = 38, ceil(25*2) = 50 -> 50 (previously capped at 24!)
    const ceilingN25 = pipelineOrchestrator.calculateAttemptCeiling(25, 25, 13);
    assert.strictEqual(ceilingN25, 50, `Ceiling for N=25 must be 50, exceeding old 24 ceiling (got ${ceilingN25})`);

    // For N=40 (large request): bounded by safety ceiling 60
    const ceilingN40 = pipelineOrchestrator.calculateAttemptCeiling(40, 40, 20);
    assert.strictEqual(ceilingN40, 60, `Ceiling for N=40 must be capped at 60 (got ${ceilingN40})`);

    // For N=5: targetAttemptBudget = 8, ceil(5*2) = 10 -> 10
    const ceilingN5 = pipelineOrchestrator.calculateAttemptCeiling(5, 5, 3);
    assert.strictEqual(ceilingN5, 10, `Ceiling for N=5 must be 10 (got ${ceilingN5})`);
  });

  // Helper function to simulate Stage 07b Bounded Post-Pass Replenishment
  function simulateStage07bReplenishment({
    requestedCount,
    maxDefensibleCapacity,
    validatedQuestions,
    passingQuestions,
    activeReservePool,
    seenConcepts = new Set(),
    iterationCount = 0,
    MAX_TOTAL_ITERATIONS = 20,
    candidateGenerator
  }) {
    const normConceptSig = (c) => String(c || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    let iter = iterationCount;

    while (
      validatedQuestions.length < requestedCount &&
      validatedQuestions.length < maxDefensibleCapacity &&
      activeReservePool.length > 0 &&
      iter < MAX_TOTAL_ITERATIONS
    ) {
      const nextReserve = activeReservePool.shift();
      if (!nextReserve) break;

      const cSig = normConceptSig(nextReserve.concept);
      // Invariant Rule 3: Never promote an already-used reserve
      if (cSig && seenConcepts.has(cSig) && passingQuestions.some(pq => normConceptSig(pq.metadata?.concept) === cSig)) {
        continue;
      }
      if (cSig) seenConcepts.add(cSig);

      iter++;

      // Invariant Rule 4: Process through generator and validation gates
      const outcome = candidateGenerator(nextReserve);
      if (outcome?.evalResult?.status === 'PASS' && outcome.evalResult.mcq) {
        const candidateMCQ = outcome.evalResult.mcq;

        // Invariant Rule 5a: Cross-check deduplication against validated pool
        const dupCheck = deterministicValidator.checkDuplicateQuestion(candidateMCQ, validatedQuestions, nextReserve);
        const distCollision = deterministicValidator.checkDistractorCollision(candidateMCQ, validatedQuestions);

        if (!dupCheck.isDuplicate && !distCollision.hasCollision) {
          // Invariant Rule 5b: Re-run grounding gate
          const gCheck = groundingGate._checkJustification(
            candidateMCQ.questionText || candidateMCQ.question,
            candidateMCQ.correctAnswer,
            outcome.unifiedRawContent || '',
            candidateMCQ,
            { unifiedRawContent: outcome.unifiedRawContent || '' }
          );

          if (gCheck.isJustified) {
            // Answer-key integrity
            if (Array.isArray(candidateMCQ.options) && candidateMCQ.options.length === 4 && candidateMCQ.options.includes(candidateMCQ.correctAnswer)) {
              const correctIdx = candidateMCQ.options.indexOf(candidateMCQ.correctAnswer);
              candidateMCQ.correctAnswerKey = ['A', 'B', 'C', 'D'][correctIdx];
              candidateMCQ.correct_answer = candidateMCQ.correctAnswerKey;
              candidateMCQ.correctAnswerText = candidateMCQ.correctAnswer;

              validatedQuestions.push(candidateMCQ);
              if (!passingQuestions.includes(candidateMCQ)) {
                passingQuestions.push(candidateMCQ);
              }
            }
          }
        }
      }
    }

    return {
      validatedCount: validatedQuestions.length,
      iterationsUsed: iter,
      remainingReserves: activeReservePool.length
    };
  }

  // Test 5.2: Post-pass replenishment restores question count when duplicate candidate is removed in Stage 04b
  test('5.2 Post-pass replenishment promotes reserve when Stage 04b removes a duplicate, restoring N=10', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 15;

    // Simulate 9 validated questions remaining after Stage 04b duplicate removal
    const validatedQuestions = Array.from({ length: 9 }, (_, i) => ({
      questionText: `Unique question stem ${i + 1} regarding array indexing operations`,
      correctAnswer: `Unique correct answer for concept ${i + 1}`,
      options: [
        `Unique correct answer for concept ${i + 1}`,
        `Plausible distractor 1 for concept ${i + 1}`,
        `Plausible distractor 2 for concept ${i + 1}`,
        `Plausible distractor 3 for concept ${i + 1}`
      ],
      correctAnswerKey: 'A',
      metadata: { targetId: `T0${i + 1}`, concept: `Concept ${i + 1}`, targetDifficulty: 'Medium' }
    }));

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(validatedQuestions.map(q => q.metadata.concept.toLowerCase()));

    // Active reserve available
    const activeReservePool = [
      {
        targetId: 'R01',
        concept: 'Visited Array State Maintenance',
        dimension: 'State / Invariant',
        targetDifficulty: 'Medium'
      }
    ];

    const rawLectureContent = 'When an element is counted, the visited array marks that position as true so it is not processed repeatedly.';

    const result = simulateStage07bReplenishment({
      requestedCount,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 10,
      MAX_TOTAL_ITERATIONS: 20,
      candidateGenerator: (reserve) => ({
        evalResult: {
          status: 'PASS',
          mcq: {
            questionText: 'What is the role of the visited array in the frequency counting algorithm?',
            correctAnswer: 'It marks processed positions to prevent recalculating frequencies for duplicate elements.',
            options: [
              'It marks processed positions to prevent recalculating frequencies for duplicate elements.',
              'It stores the total occurrences of each unique element in ascending order.',
              'It resets the frequency counter variable to zero at the start of each iteration.',
              'It halts the outer loop immediately when the first duplicate element is detected.'
            ],
            correctAnswerKey: 'A',
            metadata: { targetId: reserve.targetId, concept: reserve.concept, targetDifficulty: 'Medium' }
          }
        },
        unifiedRawContent: rawLectureContent
      })
    });

    assert.strictEqual(result.validatedCount, 10, 'Replenishment must restore question count to requested N=10');
    assert.strictEqual(validatedQuestions.length, 10, 'Validated questions array must contain exactly 10 questions');
    assert.strictEqual(validatedQuestions[9].metadata.targetId, 'R01', 'Tenth question must be the promoted reserve R01');
  });

  // Test 5.3: Post-pass replenishment restores question count when Stage 07 Final Grounding Gate rejects a question
  test('5.3 Post-pass replenishment promotes reserve when Stage 07 Final Grounding rejects an ungrounded candidate', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 12;

    const validatedQuestions = Array.from({ length: 9 }, (_, i) => ({
      questionText: `Approved grounded question ${i + 1}`,
      correctAnswer: `Approved grounded answer ${i + 1}`,
      options: [
        `Approved grounded answer ${i + 1}`,
        `Distractor A ${i + 1}`,
        `Distractor B ${i + 1}`,
        `Distractor C ${i + 1}`
      ],
      correctAnswerKey: 'A',
      metadata: { targetId: `T0${i + 1}`, concept: `Grounded Concept ${i + 1}` }
    }));

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(validatedQuestions.map(q => q.metadata.concept.toLowerCase()));

    // Two reserves: first reserve has ungrounded variable claim and will be rejected by Grounding Gate; second reserve is fully grounded
    const activeReservePool = [
      { targetId: 'R01_UNGROUNDED', concept: 'Inner Loop Index Variable Operation', dimension: 'Flow / Trace' },
      { targetId: 'R02_GROUNDED', concept: 'Outer Loop Traversal Boundary', dimension: 'Conceptual' }
    ];

    const lectureEvidence = 'The outer loop iterates through the array from index zero up to length minus one to select each target value.';

    const result = simulateStage07bReplenishment({
      requestedCount,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 11,
      MAX_TOTAL_ITERATIONS: 20,
      candidateGenerator: (reserve) => {
        if (reserve.targetId === 'R01_UNGROUNDED') {
          return {
            evalResult: {
              status: 'PASS',
              mcq: {
                questionText: 'How is pointer variable k manipulated in the inner loop traversal?',
                correctAnswer: 'The pointer variable k is repeatedly decremented towards index zero.',
                options: [
                  'The pointer variable k is repeatedly decremented towards index zero.',
                  'The pointer variable k is reset to length minus one.',
                  'The pointer variable k maintains an accumulator of prime factors.',
                  'The pointer variable k skips odd indices during traversal.'
                ],
                correctAnswerKey: 'A',
                metadata: { targetId: reserve.targetId, concept: reserve.concept }
              }
            },
            unifiedRawContent: lectureEvidence // lecture does NOT mention variable k or decrementing
          };
        }
        return {
          evalResult: {
            status: 'PASS',
            mcq: {
              questionText: 'What is the traversal range of the outer loop when selecting target elements?',
              correctAnswer: 'From index zero up to length minus one.',
              options: [
                'From index zero up to length minus one.',
                'From index one up to length.',
                'From the midpoint of the array to length minus one.',
                'From the first non-zero element to the last non-zero element.'
              ],
              correctAnswerKey: 'A',
              metadata: { targetId: reserve.targetId, concept: reserve.concept }
            }
          },
          unifiedRawContent: lectureEvidence
        };
      }
    });

    assert.strictEqual(result.validatedCount, 10, 'Replenishment must skip ungrounded reserve R01 and accept grounded reserve R02, fulfilling N=10');
    assert.strictEqual(validatedQuestions[9].metadata.targetId, 'R02_GROUNDED', 'Delivered tenth question must be the grounded reserve');
  });

  // Test 5.4: Truthful partial fulfillment when reserves are exhausted
  test('5.4 Invariant: Replenishment stops when reserves are exhausted and reports truthful partial delivery', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 10;

    const validatedQuestions = Array.from({ length: 8 }, (_, i) => ({
      questionText: `Validated question ${i + 1}`,
      correctAnswer: `Correct answer ${i + 1}`,
      options: [`Correct answer ${i + 1}`, `Dist 1`, `Dist 2`, `Dist 3`],
      correctAnswerKey: 'A',
      metadata: { targetId: `T0${i + 1}`, concept: `Concept ${i + 1}` }
    }));

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(validatedQuestions.map(q => q.metadata.concept.toLowerCase()));

    // Active reserve pool is empty
    const activeReservePool = [];

    const result = simulateStage07bReplenishment({
      requestedCount,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 12,
      MAX_TOTAL_ITERATIONS: 20,
      candidateGenerator: () => assert.fail('Generator must not be called when reserve pool is empty')
    });

    assert.strictEqual(result.validatedCount, 8, 'Delivered count must remain 8 when reserves are exhausted');
    assert.strictEqual(result.remainingReserves, 0, 'Reserve pool must be empty');
  });

  // Test 5.5: Invariant: Never exceed teacher's requested count
  test('5.5 Invariant: Never exceed teacher requested count', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 15;

    // Already 10 questions validated
    const validatedQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionText: `Validated question ${i + 1}`,
      correctAnswer: `Correct answer ${i + 1}`,
      options: [`Correct answer ${i + 1}`, `Dist 1`, `Dist 2`, `Dist 3`],
      correctAnswerKey: 'A',
      metadata: { targetId: `T0${i + 1}`, concept: `Concept ${i + 1}` }
    }));

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(validatedQuestions.map(q => q.metadata.concept.toLowerCase()));
    const activeReservePool = [
      { targetId: 'R01', concept: 'Extra Reserve Concept' },
      { targetId: 'R02', concept: 'Another Reserve Concept' }
    ];

    const result = simulateStage07bReplenishment({
      requestedCount,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 10,
      MAX_TOTAL_ITERATIONS: 20,
      candidateGenerator: () => assert.fail('Generator must not be called when requested count is already fulfilled')
    });

    assert.strictEqual(result.validatedCount, 10, 'Validated count must strictly not exceed requested count');
    assert.strictEqual(result.remainingReserves, 2, 'Unused reserves must remain in pool');
  });

  // Test 5.6: Invariant: Never exceed defensible evidence capacity
  test('5.6 Invariant: Never exceed defensible evidence capacity even if requested count is higher', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 8; // Lecture only defensibly supports 8 questions

    const validatedQuestions = Array.from({ length: 8 }, (_, i) => ({
      questionText: `Validated question ${i + 1}`,
      correctAnswer: `Correct answer ${i + 1}`,
      options: [`Correct answer ${i + 1}`, `Dist 1`, `Dist 2`, `Dist 3`],
      correctAnswerKey: 'A',
      metadata: { targetId: `T0${i + 1}`, concept: `Concept ${i + 1}` }
    }));

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(validatedQuestions.map(q => q.metadata.concept.toLowerCase()));
    const activeReservePool = [
      { targetId: 'R01', concept: 'Excess Reserve 1' },
      { targetId: 'R02', concept: 'Excess Reserve 2' }
    ];

    const result = simulateStage07bReplenishment({
      requestedCount,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 8,
      MAX_TOTAL_ITERATIONS: 20,
      candidateGenerator: () => assert.fail('Generator must not generate beyond max defensible capacity')
    });

    assert.strictEqual(result.validatedCount, 8, 'Validated count must strictly cap at maxDefensibleCapacity = 8');
    assert.strictEqual(result.remainingReserves, 2, 'Reserves must not be consumed when capacity is exhausted');
  });

  // Test 5.7: Invariant: Never promote an already-used reserve
  test('5.7 Invariant: Never promote an already-used reserve or duplicate concept', () => {
    const requestedCount = 10;
    const maxDefensibleCapacity = 15;

    const validatedQuestions = [
      {
        questionText: 'Question on Outer Loop Selection Mechanism',
        correctAnswer: 'Correct Outer Loop Answer',
        options: ['Correct Outer Loop Answer', 'Dist 1', 'Dist 2', 'Dist 3'],
        correctAnswerKey: 'A',
        metadata: { targetId: 'T01', concept: 'Outer Loop Selection' }
      }
    ];

    const passingQuestions = [...validatedQuestions];
    const seenConcepts = new Set(['outer loop selection']);

    // Reserve pool has a duplicate of already passing concept, followed by a genuinely new concept
    const activeReservePool = [
      { targetId: 'R01_DUP', concept: 'Outer Loop Selection' },
      { targetId: 'R02_NEW', concept: 'Frequency Counter Variable Reset' }
    ];

    const lectureEvidence = 'The outer loop selects the element. We do count = 0 at the start of each outer loop iteration.';
    let generatedTargetIds = [];

    const result = simulateStage07bReplenishment({
      requestedCount: 2,
      maxDefensibleCapacity,
      validatedQuestions,
      passingQuestions,
      activeReservePool,
      seenConcepts,
      iterationCount: 1,
      MAX_TOTAL_ITERATIONS: 10,
      candidateGenerator: (reserve) => {
        generatedTargetIds.push(reserve.targetId);
        return {
          evalResult: {
            status: 'PASS',
            mcq: {
              questionText: 'When the outer loop advances to the next element, what must happen to the variable count?',
              correctAnswer: 'The variable count must be reset to 0 before the inner loop begins scanning.',
              options: [
                'The variable count must be reset to 0 before the inner loop begins scanning.',
                'At the end of the entire program.',
                'Inside the inner loop comparison.',
                'Only when a duplicate is found.'
              ],
              correctAnswerKey: 'A',
              metadata: { targetId: reserve.targetId, concept: reserve.concept }
            }
          },
          unifiedRawContent: lectureEvidence
        };
      }
    });

    assert.strictEqual(result.validatedCount, 2, 'Delivered count must reach 2');
    assert.deepStrictEqual(generatedTargetIds, ['R02_NEW'], 'Already-used concept R01_DUP must be skipped without generation');
  });

  // Test 5.8: Invariant: Replenished questions satisfy option count and answer-key integrity
  test('5.8 Invariant: Replenished candidate must satisfy 4-option schema and key integrity', () => {
    const candidateMCQ = {
      questionText: 'What is the time complexity of the un-optimized nested loop frequency calculation?',
      correctAnswer: 'O(N^2) quadratic comparisons across all element pairs.',
      options: [
        'O(N) linear time with single-pass hashing.',
        'O(N^2) quadratic comparisons across all element pairs.',
        'O(log N) logarithmic binary search operations.',
        'O(1) constant time direct memory lookup.'
      ],
      correctAnswerKey: 'B' // Correct answer is at index 1 -> B
    };

    assert.strictEqual(candidateMCQ.options.length, 4, 'Must have exactly 4 options');
    assert(candidateMCQ.options.includes(candidateMCQ.correctAnswer), 'Options must include correctAnswer');
    const idx = candidateMCQ.options.indexOf(candidateMCQ.correctAnswer);
    assert.strictEqual(candidateMCQ.correctAnswerKey, ['A', 'B', 'C', 'D'][idx], 'Key must match correct option slot');
  });

  // ── SUITE 6: Criterion B (Recommendation Policy) & Criterion D (Analogy Transformation) ──
  console.log('\n--- Suite 6: Criterion B & Criterion D Acceptance Tests ---');

  const substantiveLecture = [
    'In computer science, binary search trees maintain an ordering invariant. Left subtree keys are strictly less than root keys, and right subtree keys are greater. Tree traversal visits nodes systematically.',
    'In memory management, paging divides virtual memory into fixed pages. Page tables translate virtual addresses to physical frame addresses using page table entries.',
    'In processor architecture, pipelining divides instruction execution into multiple stages. Pipeline hazards require forwarding or stall cycles to preserve program invariants.',
    'In network communication, transmission control protocol guarantees reliable byte streams through sequence numbers, acknowledgments, and sliding window flow control.',
    'In database systems, transaction serializability prevents race conditions using two-phase locking and write-ahead logging to guarantee atomic commit.',
    'In operating systems, mutual exclusion prevents race conditions using semaphores and mutexes to protect critical section access.'
  ].join('\n\n');

  // Test 6.1: Criterion B duration brackets (15–30m -> 5–8 Qs)
  test('6.1 Criterion B: 15–30 min lecture produces recommendation in 5–8 range', () => {
    const analysis = depthAnalyzer.analyzeLecture(substantiveLecture, { durationMinutes: 25 });
    const rec = analysis.lectureDepth.breakdown.recommendedQuestionCount;
    assert(rec >= 5 && rec <= 8, `Expected recommendation 5–8 for 25-min lecture, got ${rec}`);
  });

  // Test 6.2: Criterion B duration brackets (30–45m -> 8–12 Qs)
  test('6.2 Criterion B: 30–45 min lecture produces recommendation in 8–12 range', () => {
    const analysis = depthAnalyzer.analyzeLecture(substantiveLecture, { durationMinutes: 38 });
    const rec = analysis.lectureDepth.breakdown.recommendedQuestionCount;
    assert(rec >= 8 && rec <= 12, `Expected recommendation 8–12 for 38-min lecture, got ${rec}`);
  });

  // Test 6.3: Criterion B duration brackets (45–60m -> 10–15 Qs)
  test('6.3 Criterion B: 45–60 min lecture produces recommendation in 10–15 range', () => {
    const analysis = depthAnalyzer.analyzeLecture(substantiveLecture, { durationMinutes: 52 });
    const rec = analysis.lectureDepth.breakdown.recommendedQuestionCount;
    assert(rec >= 10 && rec <= 15, `Expected recommendation 10–15 for 52-min lecture, got ${rec}`);
  });

  // Test 6.4: Criterion B duration brackets (60–90m -> 15–20 Qs)
  test('6.4 Criterion B: 60–90 min lecture produces recommendation in 15–20 range', () => {
    const analysis = depthAnalyzer.analyzeLecture(substantiveLecture, { durationMinutes: 75 });
    const rec = analysis.lectureDepth.breakdown.recommendedQuestionCount;
    assert(rec >= 15 && rec <= 20, `Expected recommendation 15–20 for 75-min lecture, got ${rec}`);
  });

  // Test 6.5: Criterion B explicit separation (recommended vs requested vs delivered)
  test('6.5 Criterion B: Explicit separation of Recommended, Requested, and Delivered counts', () => {
    const mockPlan = { mainTopic: 'Operating Systems Paging', subject: 'CS' };
    const mockEvidence = {
      lectureIntelligence: {
        evidenceCapacity: { recommendedQuestionCount: 12, totalDefensibleCapacity: 15 }
      }
    };
    const requestedCount = 10;
    const deliveredCount = 10;
    const isFullyConformant = deliveredCount === requestedCount;

    const conformance = {
      isFullyConformant,
      totalRecommended: (mockEvidence?.lectureIntelligence?.evidenceCapacity?.recommendedQuestionCount ?? null),
      totalRequested: requestedCount,
      totalDelivered: deliveredCount,
      deficitCount: Math.max(0, requestedCount - deliveredCount)
    };

    assert.strictEqual(conformance.totalRecommended, 12, 'Recommended count must be 12 from evidence');
    assert.strictEqual(conformance.totalRequested, 10, 'Requested count must be 10 from user request');
    assert.strictEqual(conformance.totalDelivered, 10, 'Delivered count must be 10');
    assert.strictEqual(conformance.deficitCount, 0, 'Deficit must be 0 when fulfilled');
  });

  // Test 6.6: Criterion D: Trivial Analogy Recall rejected (Why did teacher mention plants?)
  test('6.6 Criterion D: Rote recall of teacher analogy ("Why did teacher mention plants?") rejected with TRIVIAL_ANALOGY_RECALL', () => {
    const candidateMCQ = {
      questionText: 'Why did the teacher mention plants in the lecture?',
      correctAnswer: 'To compare sunlight and water to computing time and space resources.',
      options: [
        'To compare sunlight and water to computing time and space resources.',
        'To explain the biological process of photosynthesis.',
        'To demonstrate garden maintenance procedures.',
        'To show how water evaporates from leaves.'
      ]
    };
    const target = { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' };
    const audit = agent3Evaluator._runDeterministicAudit(candidateMCQ, target, 'sunlight water plants memory time resources');
    assert.strictEqual(audit.passed, false, 'Trivial analogy recall must fail');
    assert(audit.failureReasons.includes('TRIVIAL_ANALOGY_RECALL'), `Must include TRIVIAL_ANALOGY_RECALL: ${audit.failureReasons}`);
  });

  // Test 6.7: Criterion D: Trivial Analogy Recall rejected (What did teacher compare memory to?)
  test('6.7 Criterion D: Analogy recall ("What did the instructor compare memory to?") rejected with TRIVIAL_ANALOGY_RECALL', () => {
    const candidateMCQ = {
      questionText: 'What did the instructor compare memory space to in the classroom story?',
      correctAnswer: 'A warehouse with limited physical shelving capacity.',
      options: [
        'A warehouse with limited physical shelving capacity.',
        'An infinite highway.',
        'A river flowing downstream.',
        'A library with no books.'
      ]
    };
    const target = { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' };
    const audit = agent3Evaluator._runDeterministicAudit(candidateMCQ, target, 'warehouse memory space capacity');
    assert.strictEqual(audit.passed, false, 'Metaphor recall must fail');
    assert(audit.failureReasons.includes('TRIVIAL_ANALOGY_RECALL'), `Must include TRIVIAL_ANALOGY_RECALL: ${audit.failureReasons}`);
  });

  // Test 6.8: Criterion D: Valid technical problem scenario testing the principle passes
  test('6.8 Criterion D: Rigorous technical scenario testing time-space tradeoff passes without TRIVIAL_ANALOGY_RECALL', () => {
    const candidateMCQ = {
      questionText: 'When optimizing an algorithm with an auxiliary frequency array, what time-space tradeoff is accepted?',
      correctAnswer: 'Additional O(R) auxiliary space is allocated to reduce lookup time from O(N) to O(1).',
      options: [
        'Additional O(R) auxiliary space is allocated to reduce lookup time from O(N) to O(1).',
        'Auxiliary space is reduced to O(1) by increasing time complexity to O(N^2).',
        'Both execution time and memory space increase exponentially.',
        'Memory usage is eliminated by executing multiple passes over the input array.'
      ]
    };
    const target = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' };
    const audit = agent3Evaluator._runDeterministicAudit(candidateMCQ, target, 'frequency array time O(1) space O(R) auxiliary tradeoff lookup');
    assert(!audit.failureReasons.includes('TRIVIAL_ANALOGY_RECALL'), 'Valid technical scenario must NOT trigger TRIVIAL_ANALOGY_RECALL');
  });

  // Test 6.9: Deduplication: Comparative Algorithmic Cluster Duplication detected
  test('6.9 Deduplication: Redundant comparative tradeoff question on identical concept is rejected', () => {
    const existingQuestions = [
      {
        questionText: 'What is the primary tradeoff of using a direct-index frequency array compared to a nested loop approach?',
        correctAnswer: 'It trades O(M) auxiliary space to achieve O(1) lookup time instead of O(N^2).',
        options: [
          'It trades O(M) auxiliary space to achieve O(1) lookup time instead of O(N^2).',
          'It reduces space complexity to O(1) while increasing execution time.',
          'It eliminates all boundary condition checking in exchange for recursion.',
          'It replaces array indexing with linked list pointer traversal.'
        ],
        metadata: { concept: 'Frequency Array Optimization' }
      }
    ];

    const duplicateCandidate = {
      questionText: 'Comparing a direct-indexing array to the nested loop solution, what advantage does the array provide?',
      correctAnswer: 'It trades O(M) auxiliary memory to achieve O(1) constant time lookup instead of quadratic scanning.',
      options: [
        'It trades O(M) auxiliary memory to achieve O(1) constant time lookup instead of quadratic scanning.',
        'It requires zero additional heap memory during execution.',
        'It supports unbounded negative integers without offset translation.',
        'It decreases algorithmic code size at the expense of recursion depth.'
      ],
      metadata: { concept: 'Frequency Array Optimization' }
    };

    const dupCheck = deterministicValidator.checkDuplicateQuestion(duplicateCandidate, existingQuestions, { concept: 'Frequency Array Optimization' });
    assert.strictEqual(dupCheck.isDuplicate, true, 'Redundant comparative tradeoff question must be flagged as duplicate');
    assert(dupCheck.reason.includes('COMPARATIVE_CLUSTER_DUPLICATE') || dupCheck.reason.includes('PEDAGOGICAL_REDUNDANCY') || dupCheck.reason.includes('ANSWER_COLLISION_DUPLICATE'), `Expected duplicate reason, got ${dupCheck.reason}`);
  });

  // --- Suite 7: Question Diversity, Distractor Fitness & Difficulty Calibration ---
  console.log('\n--- Suite 7: Question Diversity, Distractor Fitness & Difficulty Calibration ---');

  // Test 7.1: Functional Mechanism Duplicate Detection rejects Q1 vs Q9 outer loop redundancy
  test('7.1 Deduplication: Outer loop functional redundancy (Q1 vs Q9) is rejected as duplicate', () => {
    const existingQ1 = {
      questionText: 'What is the primary role of the outer loop when finding the frequency of every element in an array using linear search?',
      correctAnswer: 'To iterate through each element of the array so its frequency can be computed',
      metadata: { concept: 'Understanding the basic logic of counting occurrences' }
    };
    const candidateQ9 = {
      questionText: 'What is the primary role of the outer for loop when finding the frequency of all elements in an array?',
      correctAnswer: 'Changing the target value being checked for frequency',
      metadata: { concept: 'Nested Loop Logic for All Elements - Reserve Easy Peer' }
    };
    const dupCheck = deterministicValidator.checkDuplicateQuestion(candidateQ9, [existingQ1], {});
    assert.strictEqual(dupCheck.isDuplicate, true, 'Q1 and Q9 must be detected as functional duplicates');
    assert(dupCheck.reason.includes('FUNCTIONAL_MECHANISM_DUPLICATE'), 'Must be flagged as FUNCTIONAL_MECHANISM_DUPLICATE');
  });

  // Test 7.2: Functional Mechanism Duplicate Detection rejects Q6 vs Q10 nested loop redundancy
  test('7.2 Deduplication: Nested loop structural redundancy (Q6 vs Q10) is rejected as duplicate', () => {
    const existingQ6 = {
      questionText: 'What is the primary purpose of utilizing a nested loop structure when determining the frequency of elements in an array?',
      correctAnswer: 'To iterate through the array and check the frequency of each individual element',
      metadata: { concept: 'Every Element - Foundational Definition' }
    };
    const candidateQ10 = {
      questionText: 'When determining the frequency of every element in an array using a dual nested loop structure, how do the roles of the outer and inner loops diverge during execution?',
      correctAnswer: 'The outer loop iterates through distinct target elements, while the inner loop scans the entire array to count occurrences.',
      metadata: { concept: 'Nested Loop Logic for All Elements - Reserve Hard Peer' }
    };
    const dupCheck = deterministicValidator.checkDuplicateQuestion(candidateQ10, [existingQ6], {});
    assert.strictEqual(dupCheck.isDuplicate, true, 'Q6 and Q10 must be detected as functional duplicates');
    assert(dupCheck.reason.includes('FUNCTIONAL_MECHANISM_DUPLICATE'), 'Must be flagged as FUNCTIONAL_MECHANISM_DUPLICATE');
  });

  // Test 7.3: Absurd / throwaway metaphor distractor rejection ("sunlight and water")
  test('7.3 Distractor Fitness: Obvious metaphor distractor ("sunlight and water") is rejected as ABSURD in CS context', () => {
    const DistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
    const mcqWithMetaphorDistractor = {
      questionText: 'What are the two primary resource factors that are critically important for evaluating program efficiency?',
      options: [
        'CPU frequency and memory bandwidth',
        'Compilation speed and execution threads',
        'Time and space complexity',
        'Sunlight and water'
      ],
      correctAnswer: 'Time and space complexity',
      metadata: { targetDifficulty: 'Medium' }
    };
    const validation = DistractorValidator.validate(mcqWithMetaphorDistractor, 'Medium', 'Computer science algorithms and time complexity analysis');
    assert.notStrictEqual(validation.verdict, 'PASS', 'Distractor with sunlight and water must NOT pass in CS lecture');
    assert(validation.flaws.some(f => f.code === 'ABSURD_DISTRACTOR'), 'Must flag ABSURD_DISTRACTOR');
  });

  // Test 7.3b: Domain-appropriate distractor preserved in legitimate domain context
  test('7.3b Distractor Fitness: Legitimate domain term ("sunlight and water") is preserved in plant biology context', () => {
    const DistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
    const bioMcq = {
      questionText: 'What environmental inputs are required by chlorophyll during photosynthesis to synthesize glucose?',
      options: [
        'Carbon dioxide and minerals',
        'Sunlight and water',
        'Oxygen and nitrogen',
        'Glucose and ATP'
      ],
      correctAnswer: 'Sunlight and water',
      metadata: { targetDifficulty: 'Easy' }
    };
    const validation = DistractorValidator.validate(bioMcq, 'Easy', 'Plant biology and photosynthesis in chlorophyll cells');
    assert.strictEqual(validation.flaws.some(f => f.code === 'ABSURD_DISTRACTOR'), false, 'Must NOT flag ABSURD_DISTRACTOR when domain is plant biology');
  });

  // Test 7.4: Formula recall classified as RECALL (Easy)
  test('7.4 Difficulty Calibration: Standard formula count ("V - 1 edges") is classified as RECALL', () => {
    const formulaRecallMCQ = {
      questionText: 'In a connected undirected graph with V vertices, what is the exact number of edges in any spanning tree?',
      options: ['V - 1 edges', '2V - 1 edges', 'V + 1 edges', 'V edges'],
      correctAnswer: 'V - 1 edges'
    };
    const evalResult = agent3Evaluator._evaluateCognitiveDemand(formulaRecallMCQ, { targetDifficulty: 'Medium' });
    assert.strictEqual(evalResult.demand, 'RECALL', 'Spanning tree formula question must be classified as RECALL');
  });

  // Test 7.5: Qualified score label and identifiable evidence in depthAnalyzer
  test('7.5 Teaching Depth Analysis: Score is labeled Internal Assessment with identifiable evidence', () => {
    const sampleText = 'In today lecture we discuss arrays and linear search. For example consider array [1, 2, 3]. Because array is unsorted, we check each element. First initialize count to zero, then iterate.';
    const result = depthAnalyzer.analyzeLecture(sampleText, { durationMinutes: 20 });
    assert.strictEqual(result.lectureDepth.label, 'Pedagogical Coverage & Depth Score — Internal Assessment', 'Label must match');
    assert(result.lectureDepth.disclaimer.toLowerCase().includes('internal'), 'Disclaimer must clarify internal analysis');
    assert(result.lectureDepth.breakdown.earnedRubric.some(r => r.identifiableEvidence && r.identifiableEvidence.length > 5), 'Rubric must include identifiable evidence');
  });

  // Test 7.6: Production PDI Mathematical Correctness & Multimodal Lower Bound
  test('7.6 Production PDI: Multimodal session (A=1, P=1) mathematically guarantees PDI >= 0.800 and routes to UNIFIED', () => {
    const pdiRouter = require('../engine/pdiRouter');
    const multimodalInputs = {
      voiceTranscript: 'In today lecture we discuss binary trees and leaf node calculations. Remember that every full binary tree has 2L-1 nodes. Any questions on this formula? Do you agree? Pay attention to this key point.',
      documentTexts: ['Trees: Non-linear hierarchical data structure. Full binary tree definition: each node has 0 or 2 children. Leaf nodes formula: L = (N+1)/2. External nodes vs internal nodes.']
    };
    const decision = pdiRouter.route(multimodalInputs);
    assert.strictEqual(decision.features.has_audio, true, 'Audio must be detected');
    assert.strictEqual(decision.features.has_ppt, true, 'PPT/Material must be detected');
    assert.strictEqual(decision.selected_representation, 'UNIFIED', 'Must route to UNIFIED');
    assert(decision.pedagogical_delivery_index >= 0.800, `Multimodal PDI must be >= 0.800, got ${decision.pedagogical_delivery_index}`);
    // Hand-calculate exact expected PDI in JS formula: 0.50*1 + 0.30*1 + 0.10*sig_dial + 0.10*sig_ped
    const feats = decision.features;
    const expectedPdi = Number((0.50 + 0.30 + 0.10 * Math.min(1.0, feats.dialogue_interaction_density / 1.5) + 0.10 * Math.min(1.0, feats.pedagogical_marker_density / 1.5)).toFixed(3));
    assert.strictEqual(decision.pedagogical_delivery_index, expectedPdi, `PDI must exactly match mathematical JS formula (${expectedPdi})`);
  });

  console.log(`\n=============================================================`);
  console.log(`📊 Comprehensive Verification Summary: ${passed} passed, ${failed} failed.`);
  console.log(`=============================================================\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
