/**
 * server/test/test_difficulty_calibration_gate.js
 *
 * STEP 1 VALIDATION & CONTRACT GATE:
 * Verifies that DIFFICULTY_CALIBRATION_MODE works correctly under both:
 * 1. 'v1_bloom_quota' (default legacy mode, 0 regressions)
 * 2. 'v2_intent_relative' (new intent/evidence-calibrated planning)
 */

'use strict';

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');
const providerConfig = require('../config/providerConfig');
const IntentRelativeReasoner = require('../engine/agents/intentRelativeReasoner');

console.log('============================================================');
console.log('🧪 RUNNING STEP 1 DIFFICULTY CALIBRATION GATE TESTS');
console.log('============================================================\n');

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

// -------------------------------------------------------------
// Suite 1: Configuration Invariants
// -------------------------------------------------------------
console.log('--- Suite 1: Configuration & Default Invariants ---');

runTest('providerConfig difficulty.calibrationMode defaults to v2_intent_relative', () => {
  delete process.env.DIFFICULTY_CALIBRATION_MODE;
  assert.strictEqual(
    providerConfig.difficulty.calibrationMode,
    'v2_intent_relative',
    'Default mode in providerConfig MUST be v2_intent_relative'
  );
});

// -------------------------------------------------------------
// Suite 2: v1_bloom_quota Legacy Invariants (0-Regression)
// -------------------------------------------------------------
console.log('\n--- Suite 2: v1_bloom_quota Exact Quota Invariants ---');

runTest('v1_bloom_quota computeDifficultyDistribution produces exact N/3 splits', () => {
  // N = 1 -> 1 Medium
  const dist1 = agent1Planner.computeDifficultyDistribution('Balanced', 1);
  assert.deepStrictEqual(dist1.counts, { Easy: 0, Medium: 1, Hard: 0 });

  // N = 2 -> 1 Easy, 1 Medium
  const dist2 = agent1Planner.computeDifficultyDistribution('Balanced', 2);
  assert.deepStrictEqual(dist2.counts, { Easy: 1, Medium: 1, Hard: 0 });

  // N = 3 -> 1 Easy, 1 Medium, 1 Hard
  const dist3 = agent1Planner.computeDifficultyDistribution('Balanced', 3);
  assert.deepStrictEqual(dist3.counts, { Easy: 1, Medium: 1, Hard: 1 });

  // N = 5 -> 1 Easy, 3 Medium, 1 Hard
  const dist5 = agent1Planner.computeDifficultyDistribution('Balanced', 5);
  assert.deepStrictEqual(dist5.counts, { Easy: 1, Medium: 3, Hard: 1 });

  // N = 10 -> 3 Easy, 4 Medium, 3 Hard
  const dist10 = agent1Planner.computeDifficultyDistribution('Balanced', 10);
  assert.deepStrictEqual(dist10.counts, { Easy: 3, Medium: 4, Hard: 3 });
});

runTest('v1_bloom_quota _applyDifficultyBlueprint assigns Hard regardless of evidence deficit', () => {
  process.env.DIFFICULTY_CALIBRATION_MODE = 'v1_bloom_quota';

  const mockPlan = {
    assessmentTargets: [
      { targetId: 'T01', concept: 'Server Hosting', supportingEvidence: 'A server is defined as a machine for hosting web requests.' },
      { targetId: 'T02', concept: 'Object Storage', supportingEvidence: 'Object storage refers to holding unstructured data.' },
      { targetId: 'T03', concept: 'Database Registry', supportingEvidence: 'A registry is a service listing available records.' }
    ]
  };

  const mockEvidence = {
    instructionalProfile: {
      instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
      negativeBoundaries: [],
      hardFeasibility: { hardFeasible: false, deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD' }
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 3, mockEvidence);

  // In v1, it MUST allocate 1 Hard because of the rigid N/3 quota
  const hardTarget = mockPlan.assessmentTargets.find(t => t.targetDifficulty === 'Hard');
  assert(hardTarget, 'v1 must allocate a Hard slot even if evidence lacks mechanisms');
  assert.strictEqual(mockPlan.depthCapacity.requestedHardCount, 1);
  assert.strictEqual(mockPlan.depthCapacity.hasDeficit, true);
  assert.strictEqual(mockPlan.capacityAudit, undefined, 'v1 must not produce a capacityAudit object');
});

// -------------------------------------------------------------
// Suite 3: v2_intent_relative Calibration & Quota Rebalancing
// -------------------------------------------------------------
console.log('\n--- Suite 3: v2_intent_relative Dynamic Calibration ---');

runTest('v2_intent_relative supports conceptual Hard when mechanisms exist', () => {
  process.env.DIFFICULTY_CALIBRATION_MODE = 'v2_intent_relative';

  const mockPlan = {
    assessmentTargets: [
      { targetId: 'T01', concept: 'Generator Dynamics', supportingEvidence: 'Generator learns distribution via discriminator loss feedback.' },
      { targetId: 'T02', concept: 'Discriminator Loss', supportingEvidence: 'Discriminator loss drives gradients.' },
      { targetId: 'T03', concept: 'Gradient Starvation', supportingEvidence: 'If discriminator becomes too strong, generator gradients vanish.' }
    ]
  };

  const mockEvidence = {
    instructionalProfile: {
      instructionalIntent: 'EXPLORATION',
      negativeBoundaries: ['NO_CODE_IMPLEMENTATION'],
      supportedReasoningModes: ['BEHAVIORAL_PREDICTION'],
      hardFeasibility: { hardFeasible: true, deficitReason: null },
      operationalGuidance: 'BEHAVIORAL_PREDICTION: Predict system behavior under parameter change. [CRITICAL CONSTRAINT: ZERO CODE/SYNTAX.]'
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 3, mockEvidence);

  const hardTargets = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard');
  assert.strictEqual(hardTargets.length, 1, 'v2 must allocate 1 Hard when feasible');
  assert.strictEqual(hardTargets[0].intendedCognitiveOperation, 'BEHAVIORAL_PREDICTION');
  assert(hardTargets[0].instruction.includes('ZERO CODE/SYNTAX'), 'Instruction must preserve negative boundaries');
  assert.strictEqual(mockPlan.capacityAudit.reallocatedCount, 0, 'Reallocated count must be 0 when feasible');
  assert.strictEqual(mockPlan.capacityAudit.allocatedHardCount, 1);
});

runTest('v2_intent_relative refuses to manufacture Hard questions for purely descriptive lectures', () => {
  process.env.DIFFICULTY_CALIBRATION_MODE = 'v2_intent_relative';

  const mockPlan = {
    assessmentTargets: [
      { targetId: 'T01', concept: 'EC2', supportingEvidence: 'EC2 is elastic compute.' },
      { targetId: 'T02', concept: 'S3', supportingEvidence: 'S3 is simple storage.' },
      { targetId: 'T03', concept: 'RDS', supportingEvidence: 'RDS is relational database service.' }
    ]
  };

  const mockEvidence = {
    instructionalProfile: {
      instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
      negativeBoundaries: [],
      supportedReasoningModes: ['DEEP_CONCEPTUAL_ANALYSIS'],
      hardFeasibility: {
        hardFeasible: false,
        deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD',
        message: 'Purely descriptive taxonomy with zero taught trade-offs or perturbation dynamics.'
      },
      operationalGuidance: ''
    }
  };

  agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 3, mockEvidence);

  const hardTargets = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard');
  assert.strictEqual(hardTargets.length, 0, 'v2 must NEVER manufacture Hard questions on deficit lectures');
  assert.strictEqual(mockPlan.capacityAudit.requestedHardCount, 1);
  assert.strictEqual(mockPlan.capacityAudit.allocatedHardCount, 0);
  assert.strictEqual(mockPlan.capacityAudit.reallocatedCount, 1);
  assert.strictEqual(mockPlan.capacityAudit.deficitStatus, 'INSUFFICIENT_EVIDENCE_FOR_HARD');
  assert.strictEqual(mockPlan.assessmentTargets.length, 3, 'Total targets must remain 3');
});

// -------------------------------------------------------------
// Suite 4: Quota Stress Testing across N=1 to N=50
// -------------------------------------------------------------
console.log('\n--- Suite 4: Quota Stress Testing across counts (N=1 to 50) ---');

const testCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 50];

for (const N of testCounts) {
  runTest(`Quota conservation invariant holds for N=${N}`, () => {
    process.env.DIFFICULTY_CALIBRATION_MODE = 'v2_intent_relative';

    const targets = Array.from({ length: N }, (_, i) => ({
      targetId: `T${String(i + 1).padStart(2, '0')}`,
      concept: `Concept ${i + 1}`,
      supportingEvidence: `Evidence for concept ${i + 1}`
    }));

    const mockPlan = { assessmentTargets: targets };
    const mockEvidenceDeficit = {
      instructionalProfile: {
        instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
        negativeBoundaries: [],
        hardFeasibility: { hardFeasible: false, deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD' }
      }
    };

    agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', N, mockEvidenceDeficit);

    const counts = mockPlan.difficultyBlueprint.counts;
    assert.strictEqual(
      counts.Easy + counts.Medium + counts.Hard,
      N,
      `Sum of Easy (${counts.Easy}) + Medium (${counts.Medium}) + Hard (${counts.Hard}) must equal ${N}`
    );
    assert.strictEqual(counts.Hard, 0, 'Hard count must be 0 for deficit evidence');
  });
}

// -------------------------------------------------------------
// Suite 5: Reasoner Leakage & Domain Agnosticism Check
// -------------------------------------------------------------
console.log('\n--- Suite 5: Reasoner Leakage & Purity Invariant ---');

runTest('IntentRelativeReasoner contains ZERO benchmark IDs or domain keywords', () => {
  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.join(__dirname, '../engine/agents/intentRelativeReasoner.js'), 'utf8');

  const forbiddenTokens = [
    'INTENT_', 'HOLD_', 'GAN', 'PyTorch', 'Transformer', 'Cisco',
    'Kubernetes', 'Docker', 'vruntime', 'Linux', 'AWS', 'SQL'
  ];

  for (const token of forbiddenTokens) {
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    assert(!regex.test(code), `Forbidden benchmark/topic token "${token}" found in intentRelativeReasoner.js!`);
  }
});

// Reset env
delete process.env.DIFFICULTY_CALIBRATION_MODE;

console.log('\n============================================================');
console.log(`🏁 TEST RESULTS: ${passCount} / ${totalCount} TESTS PASSED`);
console.log('============================================================\n');
