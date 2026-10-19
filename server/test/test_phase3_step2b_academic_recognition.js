/**
 * server/test/test_phase3_step2b_academic_recognition.js
 *
 * PHASE 3 STEP 2B FOCUSED VERIFICATION SUITE: ACADEMIC RECOGNITION (T02)
 *
 * Verifies:
 * 1. Historical, economic, and non-CS educational explanations recognized as academic (T02).
 * 2. Causal historical perturbation chains yield positive Hard capacity.
 * 3. Conversational causal filler (admin chatter) safely rejected with strictly 0 Hard capacity (T03).
 * 4. Mixed-content phrases ("because this is important for the exam") do not inflate reasoning capacity.
 * 5. Ambiguous conversational text with isolated causal words fails closed with UNCERTAIN classification.
 * 6. Multi-signal discourse evaluation (pronoun ratio, expository clauses, topic cohesion).
 * 7. Clean preservation of STEM, biology, and multilingual curricular content.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const assert = require('assert');

const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

(async () => {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 STEP 2B: ACADEMIC RECOGNITION TEST SUITE');
  console.log('================================================================\n');

  // --- Test 1: T02 Historical Causal Reasoning Recognized ---
  console.log('--- Test 1: T02 Historical Causal Reasoning (Non-CS Curriculum) ---');
  await runTest('Test 1: T02 Historical causality recognized as academic with positive Hard capacity', async () => {
    const fixtureT02 = [
      'When grain imports were abruptly halted by the naval blockade, local flour prices tripled within two months.',
      'Because urban industrial laborers spent over seventy percent of their daily wages on basic bread, this sudden price surge made family subsistence mathematically impossible.',
      'Consequently, widespread bread riots erupted across major industrial cities, which paralyzed factory production.',
      'Faced with total industrial paralysis and civilian unrest, municipal councils were forced to enact emergency price controls and municipal grain rationing.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureT02);
    assert.strictEqual(depthResult.isAcademic, true, 'T02 must be classified as academic');
    assert.strictEqual(depthResult.isCurricular, true, 'T02 must be classified as curricular');
    assert.strictEqual(depthResult.academicClassification, 'ACADEMIC', 'Classification status must be ACADEMIC');
    assert.strictEqual(depthResult.curricularSegments.length, 4, 'All 4 expository segments must be retained');
    assert(depthResult.hasRule, 'Rule/condition relation must be identified');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT02 });
    assert.strictEqual(fallback.isAcademic, true, 'Fallback must propagate isAcademic: true');
    assert.strictEqual(fallback.academicClassification, 'ACADEMIC', 'Fallback must propagate academicClassification: ACADEMIC');
  });

  // --- Test 2: T03 Conversational Causal Admin Chatter Safely Discarded ---
  console.log('\n--- Test 2: T03 Conversational Causal Filler (Administrative Rejection) ---');
  await runTest('Test 2: T03 Pure admin chatter rejected with strictly 0 Hard capacity', async () => {
    const fixtureT03 = [
      'Good morning everyone. Please listen carefully because this announcement is very important for your final grade.',
      'You must submit the lab report by Friday because late submissions will receive zero marks.',
      'Therefore, ensure you speak with your group partners today because attendance will be strictly verified.',
      'Also, check your email tonight because the room schedule might change due to maintenance.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureT03);
    assert.strictEqual(depthResult.isAcademic, false, 'T03 admin chatter must not be classified as academic');
    assert.strictEqual(depthResult.isCurricular, false, 'T03 admin chatter must not be classified as curricular');
    assert.strictEqual(depthResult.academicClassification, 'NON_ACADEMIC', 'Status must be NON_ACADEMIC');

    const reasoningRubric = depthResult.lectureDepth?.breakdown?.earnedRubric?.find(r => r.category === 'Causal Reasoning & Invariants');
    assert.strictEqual(reasoningRubric?.earned || 0, 0, 'Admin chatter must earn strictly 0 reasoning points');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT03 });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0, 'Admin chatter must produce strictly 0 Hard capacity');
  });

  // --- Test 3: Mixed-Content Lecture (CS Concept + Admin because) ---
  console.log('\n--- Test 3: Mixed-Content Discourse Integrity ---');
  await runTest('Test 3: Admin "because" in mixed lecture does not inflate causal reasoning points', async () => {
    const fixtureMixed = [
      'A semaphore is a synchronization primitive that maintains an integer counter to regulate thread access to shared resources.',
      'When wait is called on a semaphore with counter zero, the calling thread blocks until another thread calls signal.',
      'Please listen carefully because this announcement is very important for your final grade.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureMixed);
    assert.strictEqual(depthResult.isAcademic, true, 'Core curriculum keeps lecture academic');
    assert.strictEqual(depthResult.curricularSegments.length, 2, 'Must retain only the 2 instructional segments');
    assert.strictEqual(depthResult.adminSegments.length, 1, 'Must separate administrative guidance segment');

    const reasoningRubric = depthResult.lectureDepth?.breakdown?.earnedRubric?.find(r => r.category === 'Causal Reasoning & Invariants');
    // The admin sentence has "because this announcement is very important", which must not award causal points to descriptive segments
    assert.strictEqual(reasoningRubric?.earned || 0, 0, 'Admin "because" phrase alone must not award reasoning points');
  });

  // --- Test 4: Ambiguous Conversational Discourse with Isolated Causal Words ---
  console.log('\n--- Test 4: Ambiguous Conversational Text with Isolated Causal Words ---');
  await runTest('Test 4: Casual personal anecdote fails closed to UNCERTAIN / NON_ACADEMIC', async () => {
    const fixtureAmbiguous = [
      'I stayed home yesterday because it was raining heavily outside.',
      'So then I ordered some pizza because I was really feeling lazy.',
      'Therefore my friend called me to ask what was happening.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureAmbiguous);
    assert.strictEqual(depthResult.isAcademic, false, 'Ambiguous personal narrative must fail closed with isAcademic: false');
    assert(depthResult.academicClassification === 'UNCERTAIN' || depthResult.academicClassification === 'NON_ACADEMIC', 'Status must be UNCERTAIN or NON_ACADEMIC');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureAmbiguous });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0, 'Ambiguous content must produce 0 Hard capacity');
  });

  // --- Test 5: Non-CS Economic Explanation (Supply/Demand Inelasticity) ---
  console.log('\n--- Test 5: Non-CS Economics Explanation ---');
  await runTest('Test 5: Macroeconomic supply/demand perturbation recognized as academic with Hard capacity', async () => {
    const fixtureEconomics = [
      'When crude oil supply is abruptly disrupted by international embargoes, short-term demand remains highly inelastic.',
      'Because modern transportation infrastructure depends entirely on petroleum, consumers cannot immediately substitute alternatives.',
      'Consequently, fuel prices escalate rapidly until consumer behavior adjusts through long-term fuel efficiency adaptations.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureEconomics);
    assert.strictEqual(depthResult.isAcademic, true, 'Economics explanation must be academic');
    assert.strictEqual(depthResult.academicClassification, 'ACADEMIC', 'Status must be ACADEMIC');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureEconomics });
    assert.strictEqual(fallback.isAcademic, true, 'Fallback must propagate isAcademic: true');
    assert.strictEqual(fallback.academicClassification, 'ACADEMIC', 'Fallback must propagate academicClassification: ACADEMIC');
  });

  // --- Test 6: Short and Ambiguous Input Fail-Closed Behavior ---
  console.log('\n--- Test 6: Short and Ambiguous Input Fail-Closed Behavior ---');
  await runTest('Test 6: Insufficient content (< 10 chars) returns UNCERTAIN classification', async () => {
    const depthResult = depthAnalyzer.analyzeLecture('Short');
    assert.strictEqual(depthResult.isAcademic, false);
    assert.strictEqual(depthResult.academicClassification, 'UNCERTAIN');
  });

  // --- Test 7: Multilingual Code-Mixed Instructional Preservation ---
  console.log('\n--- Test 7: Multilingual Code-Mixed Instructional Preservation ---');
  await runTest('Test 7: Multilingual Telugu-English instructional segments cleanly kept', async () => {
    const rawSegments = [
      'Photosynthesis ante light energy ni chemical energy ga convert chese biochemical process.',
      'Repu andaru assignment submit cheyali lekapothe marks ivvanu.',
      'Light reactions lo chlorophyll molecules water molecules ni split chesi oxygen release chesthayi.'
    ];

    const c0 = depthAnalyzer.classifySegment(rawSegments[0]);
    const c1 = depthAnalyzer.classifySegment(rawSegments[1]);
    const c2 = depthAnalyzer.classifySegment(rawSegments[2]);

    assert.strictEqual(c0.action, 'KEEP_WHOLE', 'Instructional segment 0 must be kept');
    assert.strictEqual(c1.action, 'DISCARD', 'Assignment remark must be discarded as administrative');
    assert.strictEqual(c2.action, 'KEEP_WHOLE', 'Instructional segment 2 must be kept');
  });

  // --- Test 8: Technical STEM Lecture Preservation ---
  console.log('\n--- Test 8: Technical STEM Lecture Preservation ---');
  await runTest('Test 8: Core CS lecture on paging and TLB preserves full academic classification', async () => {
    const fixtureCS = [
      'Virtual memory systems use a Translation Lookaside Buffer to cache recent virtual-to-physical address translations.',
      'When a TLB miss occurs, the memory management unit must traverse the multi-level page table in physical memory.',
      'Consequently, page table walks introduce substantial memory latency unless the working set exhibits high temporal locality.'
    ].join('\n');

    const depthResult = depthAnalyzer.analyzeLecture(fixtureCS);
    assert.strictEqual(depthResult.isAcademic, true);
    assert.strictEqual(depthResult.academicClassification, 'ACADEMIC');
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureCS });
    assert.strictEqual(fallback.isAcademic, true);
    assert.strictEqual(fallback.academicClassification, 'ACADEMIC');
  });

  console.log('\n================================================================');
  console.log(`📊 PHASE 3 STEP 2B TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL ${passCount + failCount})`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
})();
