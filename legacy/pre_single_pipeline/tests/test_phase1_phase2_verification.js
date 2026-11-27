/**
 * server/test/test_phase1_phase2_verification.js
 *
 * Dedicated targeted test suite verifying Phase 1 & Phase 2 implementations:
 *
 * Phase 1: Difficulty-Specific Recommendations
 * 1. analyzeDepth API returns independent { easy, medium, hard, balanced } recommendations
 * 2. analyzeDepth API returns independent { easy, medium, hard, balanced } capacities
 * 3. Definition-only lectures report 0 Hard recommendation without inflating overall count
 * 4. Deep lectures with mechanisms report supported Hard recommendations
 * 5. Non-academic content returns 0 recommendations across all tiers
 *
 * Phase 2: Capacity-Aware Planning
 * 6. computeDifficultyDistribution with capacityContext distributes across eligible tiers (0 Hard when unsupported)
 * 7. computeDifficultyDistribution preserves backwards compatibility when capacityContext is omitted
 * 8. Balanced planning on 0-Hard lecture allocates across Easy and Medium with zero forced Hard deficits
 * 9. Balanced planning on partial-Hard lecture allocates feasible Hard and reallocates remainder
 * 10. Honest capacity deficit preserved when requested count exceeds total defensible capacity
 * 11. Explicit teacher exclusions (NO_CODE_IMPLEMENTATION) are preserved across all planned targets
 * 12. Balanced remains a mixed set of eligible tiers (distribution contains 'Easy' and 'Medium')
 */

'use strict';

const assert = require('assert');
const quizController = require('../controllers/quizController');
const agent1Planner = require('../engine/agents/agent1Planner');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

// Mock express req/res helper
function createMockReqRes(body) {
  const req = { body };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  return { req, res, getResponse: () => responseData, getStatusCode: () => statusCode };
}

(async () => {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PHASE 1 & PHASE 2 VERIFICATION TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Phase 1 — analyzeDepth API & Difficulty-Specific Recommendations
  // -------------------------------------------------------------
  console.log('--- Suite 1: Phase 1 analyzeDepth API Recommendations ---');

  await runTest('1.1 analyzeDepth returns recommendedByDifficulty with all 4 difficulty keys', async () => {
    const lectureText = `
      A Binary Search Tree (BST) is a hierarchical node-based binary tree data structure.
      The binary search tree ordering property requires that for any node X, all keys in its left subtree
      must be strictly less than X.key, and all keys in its right subtree must be strictly greater than X.key.
      To insert an element with value V, compare V with the current node key. If V is less, traverse to the left child;
      if greater, traverse to the right child until reaching a null pointer.
      When the tree is degenerate (skewed list), operations degrade to O(n) linear search time.
      When balanced, tree height is log2(n) and search operations execute in O(log n) logarithmic time.
    `;

    const { req, res, getResponse } = createMockReqRes({
      text: lectureText,
      title: 'Binary Search Tree Operations',
      modality: 'DOCUMENT_ONLY',
      hasTimingData: false
    });

    await quizController.analyzeDepth(req, res);
    const data = getResponse();

    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isAcademic, true);
    assert(data.recommendedByDifficulty, 'Response must expose recommendedByDifficulty');
    assert(typeof data.recommendedByDifficulty.easy === 'number', 'Must have easy recommendation');
    assert(typeof data.recommendedByDifficulty.medium === 'number', 'Must have medium recommendation');
    assert(typeof data.recommendedByDifficulty.hard === 'number', 'Must have hard recommendation');
    assert(typeof data.recommendedByDifficulty.balanced === 'number', 'Must have balanced recommendation');

    assert(data.capacityByDifficulty, 'Response must expose capacityByDifficulty');
    assert(typeof data.totalDefensibleCapacity === 'number', 'Must expose totalDefensibleCapacity');
    assert(data.totalDefensibleCapacity > 0, 'Total defensible capacity must be greater than 0');
    assert(typeof data.advisoryRationale === 'string', 'Must expose advisoryRationale');
  });

  await runTest('1.2 Definition-only lecture recommends 0 Hard questions without splitting overall count into arbitrary 1/3', async () => {
    const descriptiveText = `
      Cloud computing service models include Infrastructure as a Service, Platform as a Service, and Software as a Service.
      IaaS provides virtualized computing resources over the internet.
      PaaS provides hardware and software tools over the internet, typically for application development.
      SaaS delivers software applications over the internet on a subscription basis.
      Amazon Web Services, Microsoft Azure, and Google Cloud Platform are major public cloud providers.
    `;

    const { req, res, getResponse } = createMockReqRes({
      text: descriptiveText,
      title: 'Cloud Service Taxonomy',
      modality: 'DOCUMENT_ONLY',
      hasTimingData: false
    });

    await quizController.analyzeDepth(req, res);
    const data = getResponse();

    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isAcademic, true);
    // On pure descriptive taxonomy, Hard recommendation should be 0 because no mechanisms or trade-offs were taught
    assert.strictEqual(data.recommendedByDifficulty.hard, 0, 'Descriptive lecture must have 0 Hard recommendation');
    assert(data.recommendedByDifficulty.easy > 0, 'Must recommend > 0 Easy questions');
    assert(data.recommendedByDifficulty.medium > 0, 'Must recommend > 0 Medium questions');
    // Balanced must be bounded by available tiers (Easy + Medium), NOT forcing Hard
    assert(data.recommendedByDifficulty.balanced <= (data.recommendedByDifficulty.easy + data.recommendedByDifficulty.medium),
      'Balanced recommendation must be bounded by eligible tiers');
  });

  await runTest('1.3 Non-academic content returns zero recommendations across all tiers', async () => {
    const nonAcademicText = `
      Hey everyone, welcome back to the vlog! Today we are unboxing some new merchandise and talking about my weekend trip.
      Don't forget to like and subscribe to the channel, click the bell notification icon, and leave a comment below.
    `;

    const { req, res, getResponse } = createMockReqRes({
      text: nonAcademicText,
      title: 'Weekend Vlog',
      modality: 'VOICE_ONLY',
      hasTimingData: false
    });

    await quizController.analyzeDepth(req, res);
    const data = getResponse();

    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isAcademic, false);
    assert.deepStrictEqual(data.recommendedByDifficulty, { easy: 0, medium: 0, hard: 0, balanced: 0 });
    assert.deepStrictEqual(data.capacityByDifficulty, { easy: 0, medium: 0, hard: 0, balanced: 0 });
    assert.strictEqual(data.totalDefensibleCapacity, 0);
  });

  // -------------------------------------------------------------
  // SUITE 2: Phase 2 — Capacity-Aware Planning & Balanced Distribution
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Phase 2 Capacity-Aware Planning ---');

  await runTest('2.1 computeDifficultyDistribution redistributes Balanced across eligible tiers when Hard is not feasible', async () => {
    const dist = agent1Planner.computeDifficultyDistribution('Balanced', 6, {
      hardFeasible: false,
      maxHard: 0,
      instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING'
    });

    assert.strictEqual(dist.requestedDifficulty, 'Balanced');
    assert.strictEqual(dist.isBalanced, true);
    assert.strictEqual(dist.counts.Hard, 0, 'Hard count must be 0 when hardFeasible is false');
    assert.strictEqual(dist.counts.Easy + dist.counts.Medium, 6, 'Easy and Medium must sum to 6');
    assert.strictEqual(dist.counts.Easy, 3);
    assert.strictEqual(dist.counts.Medium, 3);
    assert.strictEqual(dist.distribution.length, 6);
    assert(!dist.distribution.includes('Hard'), 'Distribution array must not contain Hard');
  });

  await runTest('2.2 computeDifficultyDistribution preserves exact N/3 splits when capacityContext is omitted (backwards compatibility)', async () => {
    const dist3 = agent1Planner.computeDifficultyDistribution('Balanced', 3);
    assert.deepStrictEqual(dist3.counts, { Easy: 1, Medium: 1, Hard: 1 });

    const dist6 = agent1Planner.computeDifficultyDistribution('Balanced', 6);
    assert.deepStrictEqual(dist6.counts, { Easy: 2, Medium: 2, Hard: 2 });
  });

  await runTest('2.3 _applyDifficultyBlueprint on 0-Hard lecture fulfills all Balanced questions without forced Hard deficits', async () => {
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'IaaS Model', supportingEvidence: 'IaaS provides raw infrastructure.' },
        { targetId: 'T02', concept: 'PaaS Model', supportingEvidence: 'PaaS provides execution platform.' },
        { targetId: 'T03', concept: 'SaaS Model', supportingEvidence: 'SaaS provides software applications.' },
        { targetId: 'T04', concept: 'Public Cloud', supportingEvidence: 'Public clouds share multi-tenant infrastructure.' },
        { targetId: 'T05', concept: 'Private Cloud', supportingEvidence: 'Private clouds dedicate single-tenant infrastructure.' },
        { targetId: 'T06', concept: 'Hybrid Cloud', supportingEvidence: 'Hybrid clouds bridge on-prem and public cloud.' }
      ]
    };

    const mockEvidence = {
      instructionalProfile: {
        instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
        negativeBoundaries: ['NO_CODE_IMPLEMENTATION'],
        hardFeasibility: {
          hardFeasible: false,
          deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD',
          message: 'Descriptive taxonomy lacks taught trade-offs for Hard questions.'
        }
      }
    };

    agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 6, mockEvidence);

    const hardTargets = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard');
    const easyTargets = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Easy');
    const medTargets = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Medium');

    assert.strictEqual(hardTargets.length, 0, 'Must have 0 Hard targets on 0-Hard lecture');
    assert.strictEqual(easyTargets.length + medTargets.length, 6, 'All 6 slots must be fulfilled across Easy and Medium');
    assert.strictEqual(mockPlan.capacityAudit.allocatedHardCount, 0);
    assert.strictEqual(mockPlan.capacityAudit.reallocatedCount, 2, 'The 2 unfulfillable Hard slots must be reallocated');
    assert.strictEqual(mockPlan.difficultyBlueprint.counts.Hard, 0);
  });

  await runTest('2.4 Partial Hard feasibility allocates supported Hard and reallocates only the deficit slots', async () => {
    // 3 concepts, but only 1 has deep mechanism evidence
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Order Property', supportingEvidence: 'Left child < node < right child invariant.' },
        { targetId: 'T02', concept: 'Degenerate Skew', supportingEvidence: 'Insertion of sorted array collapses BST height to N, causing O(N) worst-case traversal.' },
        { targetId: 'T03', concept: 'Node Pointer', supportingEvidence: 'Nodes store memory pointers to left and right.' }
      ]
    };

    const mockEvidence = {
      instructionalProfile: {
        instructionalIntent: 'COMPARATIVE_TRADEOFF',
        negativeBoundaries: [],
        hardFeasibility: { hardFeasible: true, deficitReason: null }
      }
    };

    agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 3, mockEvidence);

    assert.strictEqual(mockPlan.assessmentTargets.length, 3);
    const hardCount = mockPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard').length;
    // Exactly 1 Hard supported by Degenerate Skew
    assert.strictEqual(hardCount, 1, 'Should allocate exactly 1 supported Hard question');
    assert.strictEqual(mockPlan.difficultyBlueprint.counts.Hard, 1);
  });

  await runTest('2.5 Preserves honest capacity deficit when requested count exceeds available concepts', async () => {
    // Only 2 concepts available, but teacher requests 5
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Photosynthesis Light Phase', supportingEvidence: 'Chlorophyll absorbs photon energy.' },
        { targetId: 'T02', concept: 'Photosynthesis Dark Phase', supportingEvidence: 'Calvin cycle fixes CO2 into sugar.' }
      ]
    };

    const mockEvidence = {
      instructionalProfile: {
        instructionalIntent: 'FOUNDATIONAL_UNDERSTANDING',
        negativeBoundaries: [],
        hardFeasibility: { hardFeasible: false, deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD' }
      }
    };

    agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 5, mockEvidence);

    const deficitTargets = mockPlan.assessmentTargets.filter(t =>
      t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT' ||
      t.capacityLimitation?.status === 'INSUFFICIENT_CURRICULAR_EVIDENCE'
    );

    assert.strictEqual(mockPlan.assessmentTargets.length, 5);
    assert.strictEqual(deficitTargets.length, 3, 'Must create 3 honest deficit slots for the 3 missing concepts');
    assert(deficitTargets[0].capacityLimitation.reason.includes('requested 5'), 'Deficit reason must explain request vs available');
  });

  await runTest('2.6 Explicit teacher negative boundaries (NO_CODE_IMPLEMENTATION) are preserved across all targets', async () => {
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Process Schedulers', supportingEvidence: 'CFS allocates CPU time based on vruntime.' },
        { targetId: 'T02', concept: 'Context Switching', supportingEvidence: 'CPU registers saved to PCB during switch.' }
      ]
    };

    const mockEvidence = {
      instructionalProfile: {
        instructionalIntent: 'PROCEDURAL_TRACE',
        negativeBoundaries: ['NO_CODE_IMPLEMENTATION', 'NO_VENDOR_SPECIFIC_CLI'],
        hardFeasibility: { hardFeasible: false, deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD' }
      }
    };

    agent1Planner._applyDifficultyBlueprint(mockPlan, 'Balanced', 2, mockEvidence);

    for (const target of mockPlan.assessmentTargets) {
      assert(target.negativeBoundaries.includes('NO_CODE_IMPLEMENTATION'), 'Target must preserve NO_CODE_IMPLEMENTATION');
      assert(target.negativeBoundaries.includes('NO_VENDOR_SPECIFIC_CLI'), 'Target must preserve NO_VENDOR_SPECIFIC_CLI');
    }
  });

  await runTest('2.7 Balanced remains a mixed set across eligible tiers, not an independent tier', async () => {
    const dist = agent1Planner.computeDifficultyDistribution('Balanced', 4, {
      hardFeasible: true,
      maxHard: 1,
      instructionalIntent: 'COMPARATIVE_TRADEOFF'
    });

    assert.strictEqual(dist.requestedDifficulty, 'Balanced');
    assert.strictEqual(dist.isBalanced, true);
    // Balanced is comprised of Easy, Medium, Hard (not a new difficulty name like 'Balanced')
    for (const d of dist.distribution) {
      assert(['Easy', 'Medium', 'Hard'].includes(d), `Distribution element "${d}" must be one of Easy, Medium, Hard`);
    }
    // Must contain more than one distinct difficulty tier
    const uniqueTiers = new Set(dist.distribution);
    assert(uniqueTiers.size >= 2, 'Balanced set must be a mixed set with at least 2 distinct tiers');
  });

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passCount} / ${passCount + failCount} TESTS PASSED`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
})();
