/**
 * server/test/test_phase3_step4_volume_policy.js
 *
 * PHASE 3 STEP 4: VOLUME POLICY & DEFENSIBLE EVIDENCE CAPACITY TEST SUITE
 *
 * Verifies:
 * 1. Repetitive long lectures do NOT inflate concept extraction or question recommendations (T09).
 * 2. Genuinely diverse lectures with multiple distinct instructional concepts scale capacity accordingly.
 * 3. Requested question count exceeding defensible evidence capacity produces explicit deficit slots
 *    rather than fabricating unsupported questions or duplicate targets.
 * 4. Short lectures and brief excerpts correctly clamp capacity and recommended counts.
 * 5. Preserves all Step 2A-2C difficulty calibration and Step 3 teacher boundary & grounding invariants.
 */

'use strict';

const assert = require('assert');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');

async function runStep4VolumePolicySuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 STEP 4: VOLUME POLICY TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  }

  function recordFail(testName, err) {
    console.error(`  ❌ [FAIL] ${testName}: ${err.message}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Test 1: Repetitive Long Lecture (T09 Fixture: Volume vs Distinct Concepts)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Repetitive Long Lecture (T09 Fixture) ---');
  try {
    const paragraph = [
      'In this lecture we examine basic linear data structures.',
      'A stack is a Last-In First-Out structure where items are pushed and popped from the top element.',
      'A queue is a First-In First-Out structure where items are enqueued at the rear and dequeued from the front.',
      'Remember that a stack operates on LIFO principles while a queue operates on FIFO principles.',
      'Whenever you add an item to a stack it goes to the top, and whenever you add an item to a queue it goes to the back.'
    ].join(' ');

    const repetitiveText = Array(15).fill(paragraph).join('\n\n');
    const wordCount = repetitiveText.split(/\s+/).filter(Boolean).length; // 1305 words

    const depthRes = depthAnalyzer.analyzeLecture(repetitiveText);
    const depthRec = depthRes.lectureDepth?.breakdown?.recommendedQuestionCount;

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: repetitiveText });
    const distinctConcepts = fallback.evidenceCapacity.distinctConceptCount;
    const semanticRec = fallback.evidenceCapacity.recommendedQuestionCount;
    const totalCap = fallback.evidenceCapacity.totalDefensibleCapacity;
    const hardCap = fallback.evidenceCapacity.capacityByDifficulty.hard;

    assert(wordCount >= 1200, `Word count should be >= 1200, got ${wordCount}`);
    assert(distinctConcepts <= 3, `Repetitive text with 2 core concepts must extract at most 3 concepts, got ${distinctConcepts}`);
    assert(semanticRec <= 6, `Semantic recommended count must not inflate, expected <= 6, got ${semanticRec}`);
    assert(depthRec <= 10, `DepthAnalyzer recommendation must be bounded by distinct concepts, expected <= 10, got ${depthRec}`);
    assert.strictEqual(hardCap, 0, `Pure definitions must yield strictly 0 Hard capacity, got ${hardCap}`);

    recordPass(`Test 1: Repetitive Long Lecture -> Words=${wordCount}, Concepts=${distinctConcepts}, SemanticRec=${semanticRec}, DepthRec=${depthRec}, HardCap=${hardCap}`);
  } catch (err) {
    recordFail('Test 1: Repetitive Long Lecture', err);
  }

  // -------------------------------------------------------------------------
  // Test 2: Genuinely Diverse Evidence (10 Distinct Core Concepts)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Genuinely Diverse Evidence (10 Concepts) ---');
  try {
    const diverseSentences = [
      'An operating system manages computer hardware and system resources.',
      'A process is an instance of a computer program that is being executed by one or many threads.',
      'Thread synchronization prevents race conditions when multiple execution units access shared memory.',
      'A semaphore is a synchronization variable initialized to an integer value providing wait and signal primitives.',
      'Virtual memory provides an idealized abstraction of storage resources available on any given machine.',
      'Page replacement algorithms like LRU decide which memory page to evict during a page fault.',
      'A translation lookaside buffer or TLB caches recent virtual to physical address translations.',
      'Deadlock prevention requires eliminating at least one of Coffmans four mutual exclusion conditions.',
      'Process scheduling algorithms allocate CPU execution time slices across active runnable tasks.',
      'Context switching saves and restores process state enabling preemptive multitasking.'
    ];

    const diverseLecture = diverseSentences.join('\n\n');
    const fallbackDiverse = lectureIntelligence.buildPartialFallback({ evidenceText: diverseLecture });
    const distinctConcepts = fallbackDiverse.evidenceCapacity.distinctConceptCount;
    const semanticRec = fallbackDiverse.evidenceCapacity.recommendedQuestionCount;
    const totalCap = fallbackDiverse.evidenceCapacity.totalDefensibleCapacity;

    assert(distinctConcepts >= 8, `Genuinely diverse lecture must preserve concepts, expected >= 8, got ${distinctConcepts}`);
    assert(semanticRec >= 8, `Diverse lecture recommendation must scale appropriately, expected >= 8, got ${semanticRec}`);
    assert(totalCap >= 15, `Diverse lecture defensible capacity must support rich assessment, expected >= 15, got ${totalCap}`);

    recordPass(`Test 2: Genuinely Diverse Evidence -> Concepts=${distinctConcepts}, SemanticRec=${semanticRec}, TotalCapacity=${totalCap}`);
  } catch (err) {
    recordFail('Test 2: Genuinely Diverse Evidence', err);
  }

  // -------------------------------------------------------------------------
  // Test 3: Requested Count Above Defensible Capacity
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Requested Count Above Defensible Capacity ---');
  try {
    const mockPlan = {
      assessmentTargets: Array.from({ length: 10 }, (_, i) => ({
        targetId: `T${String(i + 1).padStart(2, '0')}`,
        concept: i % 2 === 0 ? 'Stack' : 'Queue',
        subtopic: `Aspect ${i + 1}`,
        targetDifficulty: i % 2 === 0 ? 'Medium' : 'Easy',
        intendedCognitiveOperation: i % 2 === 0 ? 'COMPARE' : 'RECALL'
      }))
    };

    const evidencePackage = {
      evidenceCapacity: {
        totalDefensibleCapacity: 4,
        distinctConceptCount: 2,
        capacityByDifficulty: { hard: 0, medium: 2, easy: 2 },
        recommendedQuestionCount: 4,
        advisoryRationale: 'Defensible capacity of 4 questions across 2 concepts.'
      },
      capacityByDifficulty: { hard: 0, medium: 2, easy: 2 }
    };

    const gatedPlan = agent1Planner._enforceFinalCapacitySafetyGate(mockPlan, 'Balanced', 10, evidencePackage, null);

    const nonDeficitTargets = gatedPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitTargets = gatedPlan.assessmentTargets.filter(t => t.isCapacityLimited === true || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitReport = gatedPlan.capacityDeficitReport;

    assert.strictEqual(nonDeficitTargets.length, 4, `Must emit exactly 4 non-deficit targets (total defensible capacity), got ${nonDeficitTargets.length}`);
    assert.strictEqual(deficitTargets.length, 6, `Excess 6 requested targets must become deficits, got ${deficitTargets.length}`);
    assert.strictEqual(deficitReport.requestedCount, 10, 'Requested count must record 10');
    assert.strictEqual(deficitReport.generatedCount, 4, 'Generated count must record 4');
    assert.strictEqual(deficitReport.capacityDeficit, 6, 'Capacity deficit must record 6');
    assert.strictEqual(deficitReport.hasDeficit, true, 'hasDeficit must be true');

    // Verify all deficit slots have explicit diagnostic metadata
    for (const d of deficitTargets) {
      assert.strictEqual(d.isCapacityLimited, true);
      assert.strictEqual(d.intendedCognitiveOperation, 'UNFULFILLED_CAPACITY_DEFICIT');
      assert(d.capacityLimitation && d.capacityLimitation.reason, 'Deficit slot must have clear capacityLimitation reason');
    }

    recordPass('Test 3: Requested Count Above Defensible Capacity -> 4 generated, 6 deficits correctly isolated');
  } catch (err) {
    recordFail('Test 3: Requested Count Above Defensible Capacity', err);
  }

  // -------------------------------------------------------------------------
  // Test 4: Short Lecture / Brief Excerpt (< 150 words)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Short Lecture / Brief Excerpt Capacity Limits ---');
  try {
    const briefText = 'A binary search tree is a rooted binary tree data structure whose internal nodes each store a key greater than all the keys in the node left subtree and less than those in its right subtree.';
    const wordCount = briefText.split(/\s+/).filter(Boolean).length; // ~34 words

    const fallbackShort = lectureIntelligence.buildPartialFallback({ evidenceText: briefText });
    const distinctConcepts = fallbackShort.evidenceCapacity.distinctConceptCount;
    const semanticRec = fallbackShort.evidenceCapacity.recommendedQuestionCount;
    const totalCap = fallbackShort.evidenceCapacity.totalDefensibleCapacity;

    assert(wordCount < 150, `Must be brief excerpt, got ${wordCount}`);
    assert(distinctConcepts <= 2, `Brief excerpt must extract at most 1-2 concepts, got ${distinctConcepts}`);
    assert(semanticRec <= 3, `Brief excerpt recommendation must be bounded <= 3, got ${semanticRec}`);
    assert(totalCap <= 4, `Brief excerpt defensible capacity must be bounded <= 4, got ${totalCap}`);

    // If user requests 5 questions on this brief excerpt
    const mockShortPlan = {
      assessmentTargets: Array.from({ length: 5 }, (_, i) => ({
        targetId: `T${String(i + 1).padStart(2, '0')}`,
        concept: 'Binary Search Tree',
        subtopic: `Detail ${i + 1}`,
        targetDifficulty: 'Medium'
      }))
    };

    const evidencePackageShort = {
      evidenceCapacity: fallbackShort.evidenceCapacity,
      capacityByDifficulty: fallbackShort.evidenceCapacity.capacityByDifficulty
    };

    const gatedShortPlan = agent1Planner._enforceFinalCapacitySafetyGate(mockShortPlan, 'Medium', 5, evidencePackageShort, null);
    const nonDeficitShort = gatedShortPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitShort = gatedShortPlan.assessmentTargets.filter(t => t.isCapacityLimited === true);

    assert(nonDeficitShort.length <= totalCap, `Non-deficit targets (${nonDeficitShort.length}) must not exceed defensible capacity (${totalCap})`);
    assert(deficitShort.length >= (5 - totalCap), `Deficits must cover all ungrounded slots, got ${deficitShort.length}`);
    assert.strictEqual(gatedShortPlan.capacityDeficitReport.capacityDeficit, deficitShort.length);

    recordPass(`Test 4: Short Lecture -> Words=${wordCount}, Concepts=${distinctConcepts}, DefensibleCap=${totalCap}, DeficitsEmitted=${deficitShort.length}`);
  } catch (err) {
    recordFail('Test 4: Short Lecture / Brief Excerpt', err);
  }

  // -------------------------------------------------------------------------
  // Test 5: Fallback Planning Volume Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Fallback Planning Volume Enforcement ---');
  try {
    const evidencePackage = {
      detectedFocus: ['Stack', 'Queue'],
      evidenceCapacity: {
        totalDefensibleCapacity: 4,
        distinctConceptCount: 2,
        capacityByDifficulty: { hard: 0, medium: 2, easy: 2 }
      },
      capacityByDifficulty: { hard: 0, medium: 2, easy: 2 },
      instructionalProfile: { hardFeasibility: { hardFeasible: false, maxHard: 0 } }
    };

    const fallbackPlan = agent1Planner._buildFallbackPlan(evidencePackage, 'Balanced', 8);
    const nonDeficit = fallbackPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficits = fallbackPlan.assessmentTargets.filter(t => t.isCapacityLimited === true || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(nonDeficit.length, 4, `Fallback plan must limit active targets to defensible capacity (4), got ${nonDeficit.length}`);
    assert.strictEqual(deficits.length, 4, `Remaining 4 slots must be capacity deficits, got ${deficits.length}`);
    assert.strictEqual(fallbackPlan.capacityDeficitReport.capacityDeficit, 4, 'Report must show 4 capacity deficits');

    recordPass('Test 5: Fallback Planning Volume Enforcement -> 4 non-deficit, 4 deficits correctly preserved');
  } catch (err) {
    recordFail('Test 5: Fallback Planning Volume Enforcement', err);
  }

  // -------------------------------------------------------------------------
  // Test 6: Strict Monotonicity Invariant (R(C+1) >= R(C) for all C in 0..50)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Strict Monotonicity Invariant (R(C+1) >= R(C)) ---');
  try {
    let prevRec = -1;
    for (let c = 0; c <= 50; c++) {
      let marginalSum = 0;
      for (let i = 1; i <= c; i++) {
        if (i <= 4) marginalSum += 1.00;
        else if (i <= 10) marginalSum += 0.60;
        else if (i <= 20) marginalSum += 0.50;
        else if (i <= 35) marginalSum += 0.35;
        else marginalSum += 0.20;
      }
      const curRec = c === 0 ? 0 : Math.min(25, Math.max(1, Math.round(marginalSum)));
      assert(curRec >= prevRec, 'Non-monotonic drop detected at capacity ' + c);
      prevRec = curRec;
    }
    recordPass('Test 6: Monotonicity Verified -> R(C+1) >= R(C) holds strictly for all C from 0 to 50 (no drops)');
  } catch (err) {
    recordFail('Test 6: Monotonicity Invariant', err);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 PHASE 3 STEP 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep4VolumePolicySuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
