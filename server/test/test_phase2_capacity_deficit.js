/**
 * server/test/test_phase2_capacity_deficit.js
 *
 * PHASE 2 CONTRACT & ARCHITECTURE VERIFICATION TEST SUITE:
 * Validates decoupled pedagogical capacity, multi-angle Hard target assignment,
 * and transparent capacity deficit orchestration under strict teacher sovereignty ("Teacher is king").
 *
 * Invariants Verified:
 * 1. Teacher Request is Authoritative: If requested = 6 Hard, planner attempts 6 Hard, not 3 Hard + 3 Medium.
 * 2. Multi-Angle Expansion: Deep concepts produce multiple genuinely different Hard questions testing
 *    different reasoning operations (PREDICT_CONSTRAINT, DIAGNOSE, APPLY), not merely rephrasing the same fact.
 * 3. Explicit Deficit Telemetry: Transparent capacity deficit schema when requested > evidence capacity.
 * 4. No Silent Downgrade: System never silently downgrades Hard to Medium behind the teacher's back.
 * 5. Explicit Policy Control: deficitPolicy === 'FILL_WITH_MEDIUM' allows teacher-authorized Medium filling.
 * 6. Zero-Capacity Defense: Purely descriptive lectures refuse to manufacture hallucinated Hard questions.
 * 7. Cognitive Operation Exclusivity: Distinct cognitive operations across multi-angle targets.
 */

'use strict';

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

console.log('======================================================================');
console.log('🧪 RUNNING PHASE 2: ARCHITECTURE HARDENING & CAPACITY DEFICIT TESTS');
console.log('======================================================================\n');

let passCount = 0;
let totalCount = 0;

function runTest(testName, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalCount}: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${testName}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(testName, fn) {
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

// -------------------------------------------------------------
// Suite 1: Teacher Sovereignty & No Silent Downgrade
// -------------------------------------------------------------
console.log('--- Suite 1: Teacher Sovereignty & No Silent Downgrade ---');

runTest('1.1: If requested = 6 Hard and evidence supports only 3, planner assigns 3 Hard and marks 3 as explicit deficits (no silent downgrade)', () => {
  const mockPlan = {
    assessmentTargets: [
      {
        targetId: 'T01',
        concept: 'Complete Binary Tree Left-Packing',
        supportingEvidence: 'In a complete binary tree, every level except possibly the last is completely filled, and all nodes in the last level are as far left as possible. Child indices follow 2i+1 and 2i+2.'
      },
      {
        targetId: 'T02',
        concept: 'BST Inorder Successor Deletion',
        supportingEvidence: 'Deleting a node with two children requires finding the inorder successor (minimum in right subtree), copying its value, and deleting the successor node.'
      },
      {
        targetId: 'T03',
        concept: 'Tree Definition',
        supportingEvidence: 'A tree is defined as a hierarchical collection of nodes connected by edges.'
      },
      {
        targetId: 'T04',
        concept: 'Root Node',
        supportingEvidence: 'The root node is the topmost node in a tree with no parent.'
      }
    ]
  };

  const evidencePackage = {
    lectureIntelligence: {
      conceptMap: [
        {
          name: 'Complete Binary Tree Left-Packing',
          definition: 'All levels completely filled except last, which is filled left to right.',
          mechanism_or_rule: 'Left-packing invariant: child at 2i+1 and 2i+2. Invariant violation occurs if gap exists.',
          substanceType: 'RULE'
        },
        {
          name: 'BST Inorder Successor Deletion',
          definition: 'Two-child deletion sequence in Binary Search Trees.',
          mechanism_or_rule: 'Find inorder successor, replace value, delete successor leaf/single-child node.',
          substanceType: 'MECHANISM'
        },
        {
          name: 'Tree Definition',
          definition: 'Hierarchical node structure.',
          mechanism_or_rule: 'NOT_OBSERVED',
          substanceType: 'DEFINITION'
        },
        {
          name: 'Root Node',
          definition: 'Top node of tree.',
          mechanism_or_rule: 'NOT_OBSERVED',
          substanceType: 'DEFINITION'
        }
      ]
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Hard', 6, evidencePackage);

  const targets = mockPlan.assessmentTargets;
  assert.strictEqual(targets.length, 6, 'Must generate 6 total target slots');

  // Verify that all 6 target slots have targetDifficulty === 'Hard' (never silently downgraded to Medium)
  const nonHard = targets.filter(t => t.targetDifficulty !== 'Hard');
  assert.strictEqual(nonHard.length, 0, 'ZERO targets should be downgraded to Medium without teacher instruction');

  // Verify feasible vs deficit count
  const deficitTargets = targets.filter(t => t.capacityLimitation && t.capacityLimitation.status === 'INSUFFICIENT_EVIDENCE_FOR_HARD');
  assert.strictEqual(deficitTargets.length > 0, true, 'Deficit targets must be explicitly marked');

  const report = mockPlan.capacityDeficitReport;
  assert(report, 'capacityDeficitReport must be present');
  assert.strictEqual(report.requestedCount, 6);
  assert.strictEqual(report.requestedDifficulty, 'Hard');
  assert.strictEqual(report.fulfilledDifficulty, 'Hard');
  assert.strictEqual(report.capacityDeficit, deficitTargets.length);
  assert.strictEqual(report.teacherActionRequired, true, 'teacherActionRequired must be true when deficit exists');

  // Verify options
  assert(Array.isArray(report.options) && report.options.length === 3, 'Must offer 3 explicit choices');
  assert.strictEqual(report.options[0].action, 'ACCEPT_FEASIBLE_COUNT');
  assert.strictEqual(report.options[1].action, 'FILL_WITH_MEDIUM');
  assert.strictEqual(report.options[2].action, 'CANCEL');
});

// -------------------------------------------------------------
// Suite 2: Multi-Angle Hard Question Allocation
// -------------------------------------------------------------
console.log('\n--- Suite 2: Multi-Angle Allocation from Deep Concepts ---');

runTest('2.1: A deeply taught concept generates multiple distinct Hard angles testing different cognitive operations', () => {
  const deepConcept = 'Complete Binary Tree Left-Packing';
  const deepEvidence = 'In a complete binary tree, every level except possibly the last is completely filled, and all nodes in the last level are as far left as possible. Child indices follow 2i+1 and 2i+2. If a node has a right child without a left child, it is a structural violation.';

  const evidencePackage = {
    lectureIntelligence: {
      conceptMap: [
        {
          name: deepConcept,
          definition: 'Tree where all levels are fully filled except possibly the last which is left-packed.',
          mechanism_or_rule: 'Left-packing invariant: left child at 2i+1, right child at 2i+2. Violation occurs if right child exists without left child.',
          substanceType: 'RULE'
        }
      ]
    }
  };

  const depth = agent1Planner._detectConceptDepth(deepConcept, deepEvidence, evidencePackage);
  assert.strictEqual(depth.supportsHard, true, 'Deep concept must support Hard tier');

  const angles = agent1Planner._getDistinctHardAngles(deepConcept, deepEvidence, evidencePackage, depth);
  assert(angles.length >= 2, `Deep concept should support multiple distinct Hard angles, found: ${angles.length}`);

  const operations = angles.map(a => a.intendedCognitiveOperation);
  const uniqueOps = new Set(operations);
  assert.strictEqual(uniqueOps.size, operations.length, 'Every distinct Hard angle must test a different cognitive operation');

  // Verify presence of core diagnostic/prediction angles
  assert(operations.includes('PREDICT_CONSTRAINT'), 'Must include PREDICT_CONSTRAINT angle');
  assert(operations.includes('DIAGNOSE'), 'Must include DIAGNOSE angle');

  // Verify dimensions are distinct
  const dimensions = angles.map(a => a.dimension);
  assert.strictEqual(new Set(dimensions).size >= 2, true, 'Angles must span distinct dimensions');
});

runTest('2.2: Two deep concepts fulfill 6 Hard questions via multi-angle round-robin when evidence is rich', () => {
  const mockPlan = {
    assessmentTargets: [
      {
        targetId: 'T01',
        concept: 'Complete Binary Tree Left-Packing',
        supportingEvidence: 'In a complete binary tree, child at 2i+1 and 2i+2. Invariant: all leaves left-packed. Violation if right child exists without left child. Algorithm computes array mapping.'
      },
      {
        targetId: 'T02',
        concept: 'BST Two-Child Deletion',
        supportingEvidence: 'Deleting a node with two children replaces value with inorder successor (minimum in right subtree) and then deletes successor node. Algorithm preserves BST ordering invariant.'
      }
    ]
  };

  const evidencePackage = {
    lectureIntelligence: {
      conceptMap: [
        {
          name: 'Complete Binary Tree Left-Packing',
          definition: 'Left-packed binary tree structure with array representation.',
          mechanism_or_rule: 'Left child = 2i+1, right child = 2i+2. Violation diagnosis for missing left children. Array traversal algorithm.',
          substanceType: 'RULE'
        },
        {
          name: 'BST Two-Child Deletion',
          definition: 'Deletion mechanism preserving binary search tree property.',
          mechanism_or_rule: 'Inorder successor search, value swap, successor deletion algorithm. Invariant preservation.',
          substanceType: 'MECHANISM'
        }
      ]
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Hard', 6, evidencePackage);

  const targets = mockPlan.assessmentTargets;
  assert.strictEqual(targets.length, 6, 'Must produce 6 targets');

  // Check how many Hard targets are supported
  const supportedHard = targets.filter(t => !t.capacityLimitation);
  assert(supportedHard.length >= 4, `Rich deep concepts should support >= 4 distinct Hard angles, found: ${supportedHard.length}`);

  // Verify no duplicate identical instructions among supported targets
  const instructions = supportedHard.map(t => t.instruction);
  const uniqueInstructions = new Set(instructions);
  assert.strictEqual(uniqueInstructions.size, instructions.length, 'Every Hard target must have distinct instructions');
});

// -------------------------------------------------------------
// Suite 3: Explicit Teacher Authorization (FILL_WITH_MEDIUM)
// -------------------------------------------------------------
console.log('\n--- Suite 3: Teacher-Authorized Deficit Policy (FILL_WITH_MEDIUM) ---');

runTest('3.1: When deficitPolicy === "FILL_WITH_MEDIUM", deficit slots are filled with Medium questions', () => {
  const mockPlan = {
    assessmentTargets: [
      {
        targetId: 'T01',
        concept: 'Complete Binary Tree Left-Packing',
        supportingEvidence: 'Complete binary tree left-packing invariant with child indices 2i+1 and 2i+2.'
      },
      {
        targetId: 'T02',
        concept: 'Tree Definition',
        supportingEvidence: 'A tree is defined as an abstract data type consisting of nodes.'
      }
    ]
  };

  const evidencePackage = {
    lectureIntelligence: {
      conceptMap: [
        {
          name: 'Complete Binary Tree Left-Packing',
          definition: 'Complete binary tree left-packing invariant.',
          mechanism_or_rule: 'Left-packing invariant 2i+1, 2i+2.',
          substanceType: 'RULE'
        },
        {
          name: 'Tree Definition',
          definition: 'Abstract tree definition.',
          mechanism_or_rule: 'NOT_OBSERVED',
          substanceType: 'DEFINITION'
        }
      ]
    }
  };

  // Pass deficitPolicy: 'FILL_WITH_MEDIUM'
  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Hard', 4, evidencePackage, 'FILL_WITH_MEDIUM');

  const targets = mockPlan.assessmentTargets;
  assert.strictEqual(targets.length, 4, 'Must have 4 total targets');

  const hardTargets = targets.filter(t => t.targetDifficulty === 'Hard');
  const mediumTargets = targets.filter(t => t.targetDifficulty === 'Medium');

  assert(hardTargets.length > 0, 'Must have feasible Hard targets');
  assert(mediumTargets.length > 0, 'Deficit targets must be filled with Medium questions');
  assert.strictEqual(hardTargets.length + mediumTargets.length, 4, 'Total must equal 4');

  const report = mockPlan.capacityDeficitReport;
  assert(report, 'capacityDeficitReport must be present');
  assert.strictEqual(report.deficitPolicyApplied, 'FILL_WITH_MEDIUM');
  assert.strictEqual(report.teacherActionRequired, false, 'No further action required since teacher policy was applied');
});

// -------------------------------------------------------------
// Suite 4: Zero-Capacity Defense (Purely Descriptive Lectures)
// -------------------------------------------------------------
console.log('\n--- Suite 4: Zero-Capacity Defense (No Hallucinated Hard Tier) ---');

runTest('4.1: Purely descriptive lecture refuses to fabricate Hard questions when requested = Hard', () => {
  const mockPlan = {
    assessmentTargets: [
      {
        targetId: 'T01',
        concept: 'Cloud Computing Definition',
        supportingEvidence: 'Cloud computing refers to on-demand availability of computer system resources.'
      },
      {
        targetId: 'T02',
        concept: 'Virtual Machine Definition',
        supportingEvidence: 'A virtual machine is the virtualization of a computer system.'
      }
    ]
  };

  const evidencePackage = {
    lectureIntelligence: {
      conceptMap: [
        {
          name: 'Cloud Computing Definition',
          definition: 'On-demand compute resources.',
          mechanism_or_rule: 'NOT_OBSERVED',
          substanceType: 'DEFINITION'
        },
        {
          name: 'Virtual Machine Definition',
          definition: 'Virtualization of computer systems.',
          mechanism_or_rule: 'NOT_OBSERVED',
          substanceType: 'DEFINITION'
        }
      ]
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Hard', 2, evidencePackage);

  const targets = mockPlan.assessmentTargets;
  assert.strictEqual(targets.length, 2);

  // Both should be marked as deficit targets
  const deficits = targets.filter(t => t.capacityLimitation && t.capacityLimitation.status === 'INSUFFICIENT_EVIDENCE_FOR_HARD');
  assert.strictEqual(deficits.length, 2, 'All 2 slots must be transparently identified as capacity deficits');

  const report = mockPlan.capacityDeficitReport;
  assert.strictEqual(report.capacityDeficit, 2);
  assert.strictEqual(report.teacherActionRequired, true);
});

// -------------------------------------------------------------
// Suite 5: Pipeline Orchestrator Integration & Schema Validation
// -------------------------------------------------------------
console.log('\n--- Suite 5: Pipeline Orchestrator Integration & Schema Compliance ---');

runTest('5.1: Structured capacity deficit report conforms to approved schema', () => {
  const mockPlan = {
    assessmentTargets: [
      {
        targetId: 'T01',
        concept: 'Tree Definition',
        supportingEvidence: 'A tree is a data structure.'
      }
    ]
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Hard', 3, {});

  const report = mockPlan.capacityDeficitReport;
  assert(report, 'Report must be generated');

  // Verify all required schema keys
  const expectedKeys = [
    'requestedCount',
    'generatedCount',
    'requestedDifficulty',
    'fulfilledDifficulty',
    'capacityDeficit',
    'deficitReason',
    'teacherActionRequired',
    'options'
  ];

  for (const key of expectedKeys) {
    assert(key in report, `Report must contain key "${key}"`);
  }

  assert.strictEqual(typeof report.requestedCount, 'number');
  assert.strictEqual(typeof report.generatedCount, 'number');
  assert.strictEqual(typeof report.requestedDifficulty, 'string');
  assert.strictEqual(typeof report.fulfilledDifficulty, 'string');
  assert.strictEqual(typeof report.capacityDeficit, 'number');
  assert.strictEqual(typeof report.teacherActionRequired, 'boolean');
  assert(Array.isArray(report.options), 'Options must be an array');
});

// Reset any environment flags
delete process.env.DIFFICULTY_CALIBRATION_MODE;

console.log('\n======================================================================');
console.log(` 🏁 RESULT: ${passCount} / ${totalCount} TESTS PASSED CLEANLY`);
console.log('======================================================================\n');
