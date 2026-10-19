/**
 * server/test/test_phase3_step2a_capacity_safety.js
 *
 * PHASE 3 STEP 2A: FOCUSED CAPACITY SAFETY GATE TEST SUITE
 *
 * Validates strictly the Phase 3 Step 2A Capacity Safety Gates:
 * 1. Test 1: T01 (descriptive text, Hard requested, HardCap=0 -> 0 Hard, 2 deficits)
 * 2. Test 2: T05 (definitions, Balanced requested, HardCap=0 -> 0 Hard, 3 generated)
 * 3. Test 3: T08 (fallback under LLM failure, Hard requested, HardCap=0 -> 0 Hard, 5 deficits)
 * 4. Test 4: Unknown / missing / invalid capacity (fails closed to 0 Hard with explicit diagnostic reason)
 * 5. Test 5: Positive but insufficient capacity (requested 3 Hard, HardCap=1 -> 1 Hard, 2 deficits)
 * 6. Test 6: Exhausted Easy/Medium capacity in Balanced mode (N=3, HardCap=0, EasyCap=1, MedCap=1 -> 1 Easy, 1 Med, 1 Deficit)
 * 7. Test 7: Excessive LLM Hard proposals & duplicate concept bypass clamped (LLM returns 4 Hard, HardCap=1 -> clamped to 1 Hard)
 * 8. Test 8: Parity between normal LLM planning and fallback planning under HardCap=0
 *
 * INVARIANTS:
 * - Tests execute real production functions in agent1Planner.js.
 * - Zero live DB mutation.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

async function runStep2ACapacitySafetySuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 STEP 2A: CAPACITY SAFETY GATES TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  }

  function recordFail(testName, err) {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: T01 (Descriptive text, Hard requested, HardCap=0 -> 0 Hard, 2 deficits)
  // -------------------------------------------------------------------------
  console.log('--- Test 1: T01 Pure Descriptive Text (Hard Requested, HardCap=0) ---');
  try {
    const fixtureT01 = [
      'The mitochondria is the powerhouse of the cell.',
      'The cell membrane consists of a phospholipid bilayer with embedded transport proteins.',
      'Ribosomes synthesize proteins by translating messenger RNA transcripts into polypeptide chains.'
    ].join('\n');

    const fallbackT01 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT01 });
    assert.strictEqual(fallbackT01.evidenceCapacity.capacityByDifficulty.hard, 0, 'T01 Hard capacity must be 0');

    const planT01 = await agent1Planner.planAssessment({
      unifiedRawContent: fixtureT01,
      lectureIntelligence: fallbackT01,
      isAcademic: true
    }, 'Hard', 2);

    const nonDeficitHard = planT01.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const deficitReport = planT01.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 0, 'Zero non-deficit Hard targets allowed when HardCap is 0');
    assert.strictEqual(deficitReport.generatedCount, 0, 'Generated count must be strictly 0');
    assert.strictEqual(deficitReport.capacityDeficit, 2, 'Deficit count must be exactly 2');
    assert.strictEqual(planT01.assessmentTargets.length, 2, 'Must contain 2 total target slots');
    assert(planT01.assessmentTargets.every(t => t.isCapacityLimited === true), 'All targets must have isCapacityLimited === true');
    assert(planT01.assessmentTargets.every(t => t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT'), 'All targets must have intendedCognitiveOperation UNFULFILLED_CAPACITY_DEFICIT');

    recordPass('Test 1: T01 Descriptive Text -> 0 Hard targets, 2 deficits correctly reported');
  } catch (err) {
    recordFail('Test 1: T01 Descriptive Text', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: T05 (Definitions, Balanced requested, HardCap=0 -> 0 Hard, 3 generated)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: T05 Pure Definition Text (Balanced Requested, HardCap=0) ---');
  try {
    const fixtureT05 = [
      'Polymorphism is the ability of an object to take on many forms.',
      'Inheritance is a mechanism where a new class adopts properties of an existing class.',
      'Encapsulation is the bundling of data and methods into a single unit.'
    ].join('\n');

    const fallbackT05 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT05 });
    assert.strictEqual(fallbackT05.evidenceCapacity.capacityByDifficulty.hard, 0, 'T05 Hard capacity must be 0');

    const planT05 = await agent1Planner.planAssessment({
      unifiedRawContent: fixtureT05,
      lectureIntelligence: fallbackT05,
      isAcademic: true
    }, 'Balanced', 3);

    const nonDeficitHard = planT05.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const deficitReport = planT05.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 0, 'Zero non-deficit Hard targets allowed in Balanced mode when HardCap is 0');
    assert.strictEqual(deficitReport.generatedCount, 3, 'Generated count must be 3 because unsupported Hard was redistributed');
    assert.strictEqual(deficitReport.capacityDeficit, 0, 'Capacity deficit must be 0 for smoothly redistributed Balanced request');
    assert.strictEqual(planT05.assessmentTargets.length, 3, 'Plan must contain 3 targets');
    assert(planT05.assessmentTargets.every(t => ['Easy', 'Medium'].includes(t.targetDifficulty)), 'All targets must be Easy or Medium');

    recordPass('Test 2: T05 Balanced Definitions -> 0 Hard targets, 3 generated in Easy/Medium tiers');
  } catch (err) {
    recordFail('Test 2: T05 Balanced Definitions', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: T08 (Fallback under LLM failure, Hard requested, HardCap=0 -> 0 Hard, 5 deficits)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: T08 Fallback Under LLM Failure (Hard Requested, HardCap=0) ---');
  try {
    const fixtureT08 = [
      'Hypertext Transfer Protocol is an application-layer protocol used for transmitting hypermedia documents.',
      'Uniform Resource Identifier is a unique sequence of characters that identifies a logical or physical resource.'
    ].join('\n');

    const fallbackT08 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT08 });
    assert.strictEqual(fallbackT08.evidenceCapacity.capacityByDifficulty.hard, 0, 'T08 Hard capacity must be 0');

    const planDataT08 = agent1Planner._buildFallbackPlan(
      fixtureT08,
      'Hard',
      5,
      {},
      { score: 50, rating: 'Developing' },
      ['Hypertext Transfer Protocol', 'Uniform Resource Identifier'],
      { lectureIntelligence: fallbackT08 }
    );

    agent1Planner._applyDifficultyBlueprint(planDataT08, 'Hard', 5, { lectureIntelligence: fallbackT08 });

    const nonDeficitHard = planDataT08.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const deficitReport = planDataT08.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 0, 'Fallback plan must contain zero non-deficit Hard targets when HardCap is 0');
    assert.strictEqual(deficitReport.generatedCount, 0, 'Generated count must be strictly 0 under fallback HardCap=0');
    assert.strictEqual(deficitReport.capacityDeficit, 5, 'All 5 requested slots must be recorded as capacity deficits');
    assert.strictEqual(planDataT08.assessmentTargets.length, 5, 'Must contain 5 total target slots');
    assert(planDataT08.assessmentTargets.every(t => t.isCapacityLimited === true), 'All fallback targets must be marked isCapacityLimited');

    recordPass('Test 3: T08 Fallback Under LLM Failure -> 0 Hard targets, 5 deficits recorded');
  } catch (err) {
    recordFail('Test 3: T08 Fallback Under LLM Failure', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Unknown / missing / invalid capacity (fails closed to 0 Hard with explicit diagnostic reason)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Unknown / Missing / Invalid Capacity (Fail-Closed Policy) ---');
  try {
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Concept A', targetDifficulty: 'Hard' },
        { targetId: 'T02', concept: 'Concept B', targetDifficulty: 'Hard' }
      ]
    };

    // Missing evidence capacity completely
    const gatedPlan = agent1Planner._enforceFinalCapacitySafetyGate(mockPlan, 'Hard', 2, {}, null);

    const nonDeficitHard = gatedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const deficitReport = gatedPlan.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 0, 'Must fail closed to 0 non-deficit Hard targets when capacity is unknown');
    assert.strictEqual(deficitReport.generatedCount, 0, 'Generated count must be 0 when capacity is unknown');
    assert.strictEqual(deficitReport.capacityDeficit, 2, 'All 2 slots must be deficits');
    assert(
      deficitReport.deficitReason && deficitReport.deficitReason.includes('MISSING_OR_INVALID_CAPACITY'),
      `Deficit reason must explicitly cite MISSING_OR_INVALID_CAPACITY, got: "${deficitReport.deficitReason}"`
    );

    recordPass('Test 4: Missing Capacity -> Fails closed to 0 Hard targets with explicit diagnostic reason');
  } catch (err) {
    recordFail('Test 4: Unknown / Missing / Invalid Capacity', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Positive but insufficient capacity (requested 3 Hard, HardCap=1 -> 1 Hard, 2 deficits)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Positive but Insufficient Capacity (Requested 3 Hard, HardCap=1) ---');
  try {
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Concept A', subtopic: 'Angle 1', targetDifficulty: 'Hard' },
        { targetId: 'T02', concept: 'Concept B', subtopic: 'Angle 2', targetDifficulty: 'Hard' },
        { targetId: 'T03', concept: 'Concept C', subtopic: 'Angle 3', targetDifficulty: 'Hard' }
      ]
    };

    const evidencePackage = {
      capacityByDifficulty: { hard: 1, medium: 2, easy: 2 },
      instructionalProfile: { hardFeasibility: { hardFeasible: true, maxHard: 1 } }
    };

    const gatedPlan = agent1Planner._enforceFinalCapacitySafetyGate(mockPlan, 'Hard', 3, evidencePackage, null);

    const nonDeficitHard = gatedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const deficitTargets = gatedPlan.assessmentTargets.filter(t => t.isCapacityLimited === true);
    const deficitReport = gatedPlan.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 1, 'Exactly 1 non-deficit Hard target permitted by capacity upper bound');
    assert.strictEqual(deficitTargets.length, 2, 'Exactly 2 targets must be marked as capacity deficits');
    assert.strictEqual(deficitReport.generatedCount, 1, 'Generated count must be 1');
    assert.strictEqual(deficitReport.capacityDeficit, 2, 'Capacity deficit must be 2');
    assert.strictEqual(gatedPlan.depthCapacity.supportedHardCount, 1, 'supportedHardCount must be 1');
    assert.strictEqual(gatedPlan.depthCapacity.deficit, 2, 'depthCapacity.deficit must be 2');

    recordPass('Test 5: HardCap=1 Clamping -> 1 Hard permitted, 2 deficits reported');
  } catch (err) {
    recordFail('Test 5: Positive but Insufficient Capacity', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Exhausted Easy/Medium capacity in Balanced mode (N=3, HardCap=0, EasyCap=1, MedCap=1)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Exhausted Easy/Medium Capacity in Balanced Mode ---');
  try {
    const mockPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Concept A', targetDifficulty: 'Easy' },
        { targetId: 'T02', concept: 'Concept B', targetDifficulty: 'Medium' },
        { targetId: 'T03', concept: 'Concept C', targetDifficulty: 'Hard' }
      ]
    };

    const evidencePackage = {
      capacityByDifficulty: { hard: 0, medium: 1, easy: 1 },
      instructionalProfile: { hardFeasibility: { hardFeasible: false, maxHard: 0 } }
    };

    const gatedPlan = agent1Planner._enforceFinalCapacitySafetyGate(mockPlan, 'Balanced', 3, evidencePackage, null);

    const nonDeficitHard = gatedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const easyCount = gatedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Easy' && !t.isCapacityLimited).length;
    const medCount = gatedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Medium' && !t.isCapacityLimited).length;
    const deficitTargets = gatedPlan.assessmentTargets.filter(t => t.isCapacityLimited === true);
    const deficitReport = gatedPlan.capacityDeficitReport || {};

    assert.strictEqual(nonDeficitHard, 0, 'Zero Hard targets allowed when HardCap is 0');
    assert.strictEqual(easyCount, 1, 'Easy count must remain 1 (at EasyCap)');
    assert.strictEqual(medCount, 1, 'Medium count must remain 1 (at MediumCap)');
    assert.strictEqual(deficitTargets.length, 1, 'Remaining slot must become a capacity deficit because Easy/Medium are exhausted');
    assert.strictEqual(deficitReport.generatedCount, 2, 'Generated count must be 2');
    assert.strictEqual(deficitReport.capacityDeficit, 1, 'Capacity deficit must be 1');

    recordPass('Test 6: Exhausted Easy/Medium bounds -> 1 Easy, 1 Medium, 1 Deficit emitted');
  } catch (err) {
    recordFail('Test 6: Exhausted Easy/Medium Capacity in Balanced Mode', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Excessive LLM Hard proposals & duplicate concept bypass clamped
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Excessive LLM Proposals & Duplicate Concept Clamping ---');
  try {
    // 1. LLM proposes 4 Hard targets when HardCap = 1
    const excessivePlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Concept A', subtopic: 'Aspect 1', targetDifficulty: 'Hard' },
        { targetId: 'T02', concept: 'Concept B', subtopic: 'Aspect 2', targetDifficulty: 'Hard' },
        { targetId: 'T03', concept: 'Concept C', subtopic: 'Aspect 3', targetDifficulty: 'Hard' },
        { targetId: 'T04', concept: 'Concept D', subtopic: 'Aspect 4', targetDifficulty: 'Hard' }
      ]
    };

    const evidencePackage = {
      capacityByDifficulty: { hard: 1, medium: 3, easy: 3 },
      instructionalProfile: { hardFeasibility: { hardFeasible: true, maxHard: 1 } }
    };

    const gatedExcessive = agent1Planner._enforceFinalCapacitySafetyGate(excessivePlan, 'Hard', 4, evidencePackage, null);

    const nonDeficitHard = gatedExcessive.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    assert.strictEqual(nonDeficitHard, 1, 'LLM 4 Hard proposals must be strictly clamped to HardCap=1');
    assert.strictEqual(gatedExcessive.capacityDeficitReport.capacityDeficit, 3, 'Excess 3 proposals must become deficits');

    // 2. Duplicate concept on same Hard facet
    const duplicatePlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Binary Trees', subtopic: 'General', targetDifficulty: 'Hard' },
        { targetId: 'T02', concept: 'Binary Trees', subtopic: 'General', targetDifficulty: 'Hard' }
      ]
    };

    // Even if capacity allowed 2 Hard questions, duplicate facet must be rejected
    const evidencePackage2 = {
      capacityByDifficulty: { hard: 2, medium: 2, easy: 2 },
      instructionalProfile: { hardFeasibility: { hardFeasible: true, maxHard: 2 } }
    };

    const gatedDuplicate = agent1Planner._enforceFinalCapacitySafetyGate(duplicatePlan, 'Hard', 2, evidencePackage2, null);
    const nonDeficitDuplicate = gatedDuplicate.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    assert.strictEqual(nonDeficitDuplicate, 1, 'Duplicate Hard target on identical concept facet must be clamped to 1');
    assert.strictEqual(gatedDuplicate.capacityDeficitReport.capacityDeficit, 1, 'Duplicate must be flagged as capacity deficit');

    recordPass('Test 7: Excessive LLM Proposals & Duplicate Concepts clamped correctly');
  } catch (err) {
    recordFail('Test 7: Excessive LLM Proposals & Duplicate Concepts', err);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Parity between normal LLM planning and fallback planning under HardCap=0
  // -------------------------------------------------------------------------
  console.log('\n--- Test 8: Parity Between Normal and Fallback Planning Under HardCap=0 ---');
  try {
    const fixtureText = [
      'An operating system manages computer hardware and system resources.',
      'The kernel is the core component that communicates directly with device drivers.'
    ].join('\n');

    const fallbackEv = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureText });
    assert.strictEqual(fallbackEv.evidenceCapacity.capacityByDifficulty.hard, 0, 'HardCap must be 0 for fixture');

    const ev = { lectureIntelligence: fallbackEv };

    // 1. Fallback plan route
    const planFallback = agent1Planner._buildFallbackPlan(
      fixtureText,
      'Hard',
      3,
      {},
      {},
      ['Operating System', 'Kernel'],
      ev
    );
    agent1Planner._applyDifficultyBlueprint(planFallback, 'Hard', 3, ev);

    // 2. Blueprint route on mock LLM plan
    const planMock = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Operating System', targetDifficulty: 'Hard' },
        { targetId: 'T02', concept: 'Kernel', targetDifficulty: 'Hard' },
        { targetId: 'T03', concept: 'Hardware Management', targetDifficulty: 'Hard' }
      ]
    };
    agent1Planner._applyDifficultyBlueprint(planMock, 'Hard', 3, ev);

    // Verify exact parity
    assert.strictEqual(planFallback.capacityDeficitReport.generatedCount, 0, 'Fallback generatedCount must be 0');
    assert.strictEqual(planMock.capacityDeficitReport.generatedCount, 0, 'Mock LLM generatedCount must be 0');

    assert.strictEqual(planFallback.capacityDeficitReport.capacityDeficit, 3, 'Fallback capacityDeficit must be 3');
    assert.strictEqual(planMock.capacityDeficitReport.capacityDeficit, 3, 'Mock LLM capacityDeficit must be 3');

    const fallbackNonDeficit = planFallback.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;
    const mockNonDeficit = planMock.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;

    assert.strictEqual(fallbackNonDeficit, 0, 'Fallback non-deficit Hard count must be 0');
    assert.strictEqual(mockNonDeficit, 0, 'Mock LLM non-deficit Hard count must be 0');

    recordPass('Test 8: Absolute parity verified between fallback and normal planning under HardCap=0');
  } catch (err) {
    recordFail('Test 8: Parity Between Normal and Fallback Planning', err);
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 PHASE 3 STEP 2A TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL 8)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStep2ACapacitySafetySuite();
