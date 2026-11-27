/**
 * Phase 3 Step 2C Focused Verification Test Suite:
 * The Six Reasoning Operations & Hard Capacity Calibration
 *
 * Verifies:
 * 1. Op 4: Deductive Proof (Math T06) yields HardCap >= 1
 * 2. Op 6: Literary Interpretation (Lit T06) yields HardCap >= 1
 * 3. Op 5: Multi-Concept Causal Chain (History T02) yields calibrated HardCap = 1
 * 4. Teacher Boundary: NO_CODE + NO_MATH allows qualitative Hard (Op 5 & 6) while blocking code/math
 * 5. Upper Bound Ceiling: Short excerpt (< 150 words or <= 4 sentences) capped at HardCap <= 2
 * 6. Zero Hard Safety Gates: Preserved on T01, T03, T05, T08 (HardCap = 0)
 * 7. Keyword Purity Invariant: Words like "theorem", "allosteric", "shortage" alone yield HardCap = 0
 * 8. Op 2 (Mechanism) & Op 3 (Comparison): Yield Medium capacity without inflating Hard
 */

const assert = require('assert');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');

async function runStep2CTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 STEP 2C: REASONING OPERATIONS TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  // ---------------------------------------------------------------------------
  // Test 1: Deductive Proof & Derivation (Op 4 - Math T06)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 1: Deductive Proof & Derivation (Op 4 - Math T06) ---');
  try {
    const fixtureMath = [
      'Let f be a function that is continuous on the closed interval [a, b] and differentiable on the open interval (a, b).',
      'Suppose further that f(a) = f(b).',
      'By the Extreme Value Theorem, f must attain an absolute maximum and minimum on [a, b].',
      'If the maximum and minimum both equal f(a), then f is constant on [a, b], which implies f\'(c) = 0 for every point c in (a, b).',
      'If either the maximum or minimum occurs at an interior point c in (a, b), then by Fermat\'s Theorem on local extrema, the derivative f\'(c) must equal zero.',
      'Hence, there exists at least one point c in (a, b) such that f\'(c) = 0.'
    ].join(' ');

    const depthMath = depthAnalyzer.analyzeLecture(fixtureMath);
    const fallbackMath = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureMath });
    const hardCap = fallbackMath.evidenceCapacity.capacityByDifficulty.hard;

    assert.strictEqual(depthMath.isAcademic, true, 'Mathematical proof must be recognized as academic');
    assert.strictEqual(depthMath.hasFormalDerivation, true, 'Formal derivation must be detected');
    assert.strictEqual(depthMath.lectureDepth.characteristics.reasoning, 'Strong', 'Proof must earn Strong reasoning');
    assert(hardCap >= 1 && hardCap <= 2, `Mathematical deductive proof must yield 1-2 Hard capacity (got ${hardCap})`);

    console.log(`  ✅ [PASS] Test 1: Mathematical proof correctly classified (Reasoning=Strong, HardCap=${hardCap})`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 1: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 2: Literary Interpretation & Critique (Op 6 - Lit T06)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Literary Interpretation & Critique (Op 6 - Lit T06) ---');
  try {
    const fixtureLit = [
      'In Keats\'s Ode on a Grecian Urn, the speaker examines the paradoxical nature of artistic immortality.',
      'The carved lovers depicted on the marble urn remain frozen in perpetual anticipation: the fair youth cannot leave his song, nor can his beloved ever fade.',
      'Yet this aesthetic eternity is double-edged: while the figures escape mortal decay, aging, and sorrow, they are simultaneously denied living fulfillment, touch, and physical consummation.',
      'Through this stark juxtaposition, Keats constructs a critique of pure aestheticism, arguing that timeless art achieves perfection only at the cost of vital human warmth and transient experience.'
    ].join(' ');

    const depthLit = depthAnalyzer.analyzeLecture(fixtureLit);
    const fallbackLit = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureLit });
    const hardCap = fallbackLit.evidenceCapacity.capacityByDifficulty.hard;

    assert.strictEqual(depthLit.isAcademic, true, 'Literary analysis must be recognized as academic');
    assert.strictEqual(depthLit.hasCritique, true, 'Interpretive critique must be detected');
    assert.strictEqual(depthLit.lectureDepth.characteristics.reasoning, 'Strong', 'Critique must earn Strong reasoning');
    assert(hardCap >= 1 && hardCap <= 2, `Literary aesthetic critique must yield 1-2 Hard capacity (got ${hardCap})`);

    console.log(`  ✅ [PASS] Test 2: Literary critique correctly classified (Reasoning=Strong, HardCap=${hardCap})`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 2: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 3: Multi-Concept Causal Chain (Op 5 - History T02)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Multi-Concept Causal Chain (Op 5 - History T02) ---');
  try {
    const fixtureT02 = [
      'When grain imports were abruptly halted by the naval blockade, local flour prices tripled within two months.',
      'Because urban industrial laborers spent over seventy percent of their daily wages on basic bread, this sudden price surge made family subsistence mathematically impossible.',
      'Consequently, widespread bread riots erupted across major industrial cities, which paralyzed factory production.',
      'Faced with total industrial paralysis and civilian unrest, municipal councils were forced to enact emergency price controls and municipal grain rationing.'
    ].join('\n');

    const fallbackT02 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT02 });
    const hardCap = fallbackT02.evidenceCapacity.capacityByDifficulty.hard;

    assert.strictEqual(hardCap, 1, `4-sentence single historical causal chain must yield exactly HardCap = 1 (got ${hardCap})`);

    console.log(`  ✅ [PASS] Test 3: Multi-concept causal chain calibrated to HardCap = ${hardCap}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 3: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 4: Teacher Boundary: NO_CODE + NO_MATH Boundary Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Teacher Boundary (NO_CODE + NO_MATH Boundary Enforcement) ---');
  try {
    const fixtureLit = [
      'In Keats\'s Ode on a Grecian Urn, the speaker examines the paradoxical nature of artistic immortality.',
      'The carved lovers depicted on the marble urn remain frozen in perpetual anticipation: the fair youth cannot leave his song, nor can his beloved ever fade.',
      'Yet this aesthetic eternity is double-edged: while the figures escape mortal decay, aging, and sorrow, they are simultaneously denied living fulfillment, touch, and physical consummation.',
      'Through this stark juxtaposition, Keats constructs a critique of pure aestheticism, arguing that timeless art achieves perfection only at the cost of vital human warmth and transient experience.'
    ].join(' ');

    const fallbackLitBound = lectureIntelligence.buildPartialFallback({
      evidenceText: fixtureLit,
      negativeBoundaries: ['NO_CODE', 'NO_MATH']
    });
    const litHardCap = fallbackLitBound.evidenceCapacity.capacityByDifficulty.hard;
    assert.strictEqual(litHardCap, 1, `Qualitative literary critique must retain HardCap = 1 under NO_CODE + NO_MATH (got ${litHardCap})`);

    const fixtureMath = [
      'Let f be a function that is continuous on the closed interval [a, b] and differentiable on the open interval (a, b).',
      'Suppose further that f(a) = f(b).',
      'By the Extreme Value Theorem, f must attain an absolute maximum and minimum on [a, b].',
      'If the maximum and minimum both equal f(a), then f is constant on [a, b], which implies f\'(c) = 0 for every point c in (a, b).',
      'If either the maximum or minimum occurs at an interior point c in (a, b), then by Fermat\'s Theorem on local extrema, the derivative f\'(c) must equal zero.',
      'Hence, there exists at least one point c in (a, b) such that f\'(c) = 0.'
    ].join(' ');

    const fallbackMathBound = lectureIntelligence.buildPartialFallback({
      evidenceText: fixtureMath,
      negativeBoundaries: ['NO_CODE', 'NO_MATH']
    });
    const mathHardCap = fallbackMathBound.evidenceCapacity.capacityByDifficulty.hard;
    assert.strictEqual(mathHardCap, 0, `Mathematical derivation must be suppressed to HardCap = 0 when NO_MATH is in effect (got ${mathHardCap})`);

    console.log(`  ✅ [PASS] Test 4: NO_CODE + NO_MATH preserved qualitative Hard (Lit=${litHardCap}) and suppressed math (Math=${mathHardCap})`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 4: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 5: Upper Bound Ceiling on Brief Excerpts
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Upper Bound Ceiling on Brief Excerpts (< 150 words) ---');
  try {
    const shortMultiConcept = [
      'When the processor reaches the critical threshold, an interrupt is triggered which implies state must be saved.',
      'Because memory is exhausted, the allocator fails and consequently throws an out-of-memory exception.',
      'The dramatic irony underscores the paradox of power at the cost of moral integrity.',
      'Hence, there exists at least one contradiction between the stated invariant and the observed behavior.'
    ].join(' ');

    const wordCount = shortMultiConcept.split(/\s+/).filter(Boolean).length;
    assert(wordCount < 150, 'Fixture must be a brief excerpt < 150 words');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: shortMultiConcept });
    const hardCap = fallback.evidenceCapacity.capacityByDifficulty.hard;

    assert(hardCap <= 2, `Brief excerpt (< 150 words) must never exceed HardCap = 2 (got ${hardCap})`);
    assert(hardCap >= 1, `Multi-operation excerpt must have at least 1 Hard target (got ${hardCap})`);

    console.log(`  ✅ [PASS] Test 5: Brief excerpt ceiling strictly enforced (Words=${wordCount}, HardCap=${hardCap} <= 2)`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 5: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 6: Zero Hard Safety Gates Preserved (T01, T03, T05, T08)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Zero Hard Safety Gates Preserved (T01, T03, T05, T08) ---');
  try {
    // T03 Admin chatter
    const f03 = [
      'Good morning everyone. Please listen carefully because this announcement is very important for your final grade.',
      'You must submit the lab report by Friday because late submissions will receive zero marks.',
      'Therefore, ensure you speak with your group partners today because attendance will be strictly verified.'
    ].join('\n');
    const res03 = lectureIntelligence.buildPartialFallback({ evidenceText: f03 });
    assert.strictEqual(res03.evidenceCapacity.capacityByDifficulty.hard, 0, 'T03 admin chatter must yield HardCap = 0');

    // T05 Definition-only
    const f05 = [
      'A queue is defined as a First-In First-Out linear data structure.',
      'A stack is defined as a Last-In First-Out linear data structure.',
      'An array is defined as an indexed collection of elements stored at contiguous memory locations.'
    ].join('\n');
    const res05 = lectureIntelligence.buildPartialFallback({ evidenceText: f05 });
    assert.strictEqual(res05.evidenceCapacity.capacityByDifficulty.hard, 0, 'T05 definition-only lecture must yield HardCap = 0');

    // T08 Fallback planning on zero hard capacity
    const plan08 = await agent1Planner.planAssessment({
      unifiedRawContent: f05,
      lectureIntelligence: res05,
      isAcademic: true
    }, 'Hard', 3);
    const nonDeficitHard = plan08.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited).length;
    assert.strictEqual(nonDeficitHard, 0, 'Planner must produce 0 Hard targets when HardCap = 0');

    console.log('  ✅ [PASS] Test 6: Zero Hard capacity preserved across T03, T05, and T08');
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 6: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 7: Keyword Purity Invariant (Advanced Keywords Without Reasoning)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 7: Keyword Purity Invariant (Advanced Vocabulary Without Reasoning) ---');
  try {
    const fixturePurity = [
      'An allosteric site is an enzyme binding site distinct from the active site.',
      'An economic shortage is an academic condition where consumer demand exceeds market supply.',
      'A mathematical theorem is a formal proposition deduced from established foundational axioms.'
    ].join('\n');

    const depthPurity = depthAnalyzer.analyzeLecture(fixturePurity);
    const fallbackPurity = lectureIntelligence.buildPartialFallback({ evidenceText: fixturePurity });
    const hardCap = fallbackPurity.evidenceCapacity.capacityByDifficulty.hard;

    assert.strictEqual(hardCap, 0, `Descriptive definitions mentioning "allosteric", "shortage", "theorem" must yield HardCap = 0 (got ${hardCap})`);

    console.log(`  ✅ [PASS] Test 7: Keyword purity upheld (Vocabulary words without reasoning -> HardCap = ${hardCap})`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 7: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 8: Operational Mechanism (Op 2) and Comparative Tradeoff (Op 3)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 8: Op 2 (Mechanism) & Op 3 (Comparative Distinction) Medium Calibration ---');
  try {
    const fixtureMedium = [
      'Unlike a single-threaded process, a multithreaded process shares code and data sections while maintaining private registers and stacks.',
      'When an address translation occurs, the hardware first queries the TLB cache; on a cache miss, the memory management unit traverses the hierarchical page table to retrieve the physical page frame.',
      'In contrast to static allocation, dynamic allocation allows variable heap memory consumption at the cost of runtime fragmentation.'
    ].join('\n');

    const depthMedium = depthAnalyzer.analyzeLecture(fixtureMedium);
    const fallbackMedium = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureMedium });
    const cap = fallbackMedium.evidenceCapacity.capacityByDifficulty;

    assert(cap.medium >= 2, `Operational mechanisms and comparative distinctions must earn Medium capacity (got Medium=${cap.medium})`);
    assert(cap.hard <= 1, `Excerpt without formal proof or boundary failure should not inflate Hard capacity (got Hard=${cap.hard})`);

    console.log(`  ✅ [PASS] Test 8: Op 2 & Op 3 correctly calibrated (Easy=${cap.easy}, Medium=${cap.medium}, Hard=${cap.hard})`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Test 8: ${err.message}`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 PHASE 3 STEP 2C TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep2CTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
