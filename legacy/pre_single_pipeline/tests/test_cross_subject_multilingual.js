/**
 * server/test/test_cross_subject_multilingual.js
 *
 * Dedicated regression test suite for Phase 3 Step 1:
 * - Cross-subject capacity estimation (CS, Math, Natural Sciences, Humanities)
 * - Multilingual and code-mixed speech recognition (Telugu-English, Hindi-English)
 * - Conversational filler rejection with explicit denominator measurement
 * - Keyword vs Reasoning distinction (prohibits keyword-only Hard inflation)
 * - Domain-agnostic reasoning recognition
 * - Failure-path partial fallback consistency
 * - Teacher negative boundaries (NO_CODE + NO_MATH)
 * - Capacity composition and quota management
 */

'use strict';

const assert = require('assert');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');

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

(async () => {
  console.log('\n============================================================');
  console.log('🧪 RUNNING CROSS-SUBJECT & MULTILINGUAL VERIFICATION SUITE');
  console.log('============================================================\n');

  // --- Suite 1: Multilingual Retention with Measured Conversational Filler ---
  console.log('--- Suite 1: Multilingual Retention & Conversational Filter ---');

  await runTest('1.1 Telugu-English code-mixed with conversational filler: 3/3 instructional kept, 2/2 filler discarded', async () => {
    const rawSegments = [
      'Photosynthesis ante light energy ni chemical energy ga convert chese biochemical process.',
      'Repu andaru assignment submit cheyali lekapothe marks ivvanu.',
      'Light reactions lo chlorophyll molecules water molecules ni split chesi oxygen release chesthayi.',
      'Mic testing one two three voice vinapaduthunda andarki.',
      'Dark reactions lo carbon dioxide glucose ga maruthundi whenever ATP and NADPH energy available untundo.'
    ];

    const classified = rawSegments.map(s => depthAnalyzer.classifySegment(s));
    const kept = classified.filter(c => c.action === 'KEEP_WHOLE');
    const discarded = classified.filter(c => c.action === 'DISCARD');

    // Denominator checks: exactly 3 instructional, exactly 2 filler
    assert.strictEqual(kept.length, 3, 'Must retain exactly the 3 instructional segments (100% precision/recall)');
    assert.strictEqual(discarded.length, 2, 'Must discard exactly the 2 conversational filler segments (100% rejection)');
    assert.strictEqual(classified[1].action, 'DISCARD', 'Assignment remark must be discarded');
    assert.strictEqual(classified[3].action, 'DISCARD', 'Mic test remark must be discarded');
  });

  await runTest('1.2 Hindi-English code-mixed with conversational filler: 3/3 instructional kept, 2/2 filler discarded', async () => {
    const rawSegments = [
      'Lexical analysis ka matlab source code ko individual tokens mein partition karna hai.',
      'Kal sabhi log class time pe aana aur attendance lagana.',
      'Parser abstract syntax tree construct karta hai so that grammar rules enforce ho sakein.',
      'Wait karo ek minute projector on ho raha hai screen dikh rahi hai kya.',
      'Semantic analysis type checking perform karta hai whenever variables declare hote hain.'
    ];

    const classified = rawSegments.map(s => depthAnalyzer.classifySegment(s));
    const kept = classified.filter(c => c.action === 'KEEP_WHOLE');
    const discarded = classified.filter(c => c.action === 'DISCARD');

    assert.strictEqual(kept.length, 3, 'Must retain exactly the 3 instructional compiler segments');
    assert.strictEqual(discarded.length, 2, 'Must discard exactly the 2 administrative/filler segments');
  });

  await runTest('1.3 English Literature / Poetry is recognized as academic and retains 100% curricular content', async () => {
    const poetryLecture = `
      Robert Frost's poem The Road Not Taken explores the dilemma of individual choice and regret.
      The yellow wood symbolizes the divergence of life paths, while the speaker examines two diverging roads in autumn.
      The meter consists of four stanzas with an ABAAB rhyme scheme, using personification to characterize the chosen path.
    `;
    const analysis = depthAnalyzer.analyzeLecture(poetryLecture);
    assert.strictEqual(analysis.isCurricular, true, 'Poetry lecture must be recognized as curricular');
    assert.strictEqual(analysis.curricularSegments.length, 3, 'Must retain all 3 curricular sentences');
    assert(analysis.detectedFocus.length > 0, 'Must extract literary focus concepts');
  });

  // --- Suite 2: Keyword vs Reasoning Distinction (Prohibit Keyword-Only Hard Inflation) ---
  console.log('\n--- Suite 2: Keyword vs Reasoning Distinction ---');

  await runTest('2.1 Descriptive lecture with "allosteric" keyword receives strictly ZERO Hard capacity', async () => {
    const descriptiveAllosteric = `
      An allosteric site is a specific region on an enzyme molecule.
      Enzymes are biological catalysts composed of amino acid sequences.
      Allosteric regulation is a topic in biochemistry textbooks.
      The teacher mentioned allosteric enzymes in today's class.
    `;
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: descriptiveAllosteric });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0, 'Descriptive enzyme mentions must yield 0 Hard capacity');
    assert(fallback.evidenceCapacity.capacityByDifficulty.medium > 0, 'Must support Medium conceptual comparison across concepts');
  });

  await runTest('2.2 Descriptive lecture with "treaty" keyword receives strictly ZERO Hard capacity', async () => {
    const descriptiveTreaty = `
      A treaty is a formal legally binding written agreement between nations.
      The Treaty of Versailles was signed in nineteen nineteen.
      Treaties are classified under international diplomatic relations.
      Students should review the list of historical treaties for the exam.
    `;
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: descriptiveTreaty });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0, 'Descriptive treaty mentions must yield 0 Hard capacity');
  });

  await runTest('2.3 Descriptive lecture with "Mean Value Theorem" keyword receives strictly ZERO Hard capacity', async () => {
    const descriptiveMVT = `
      The Mean Value Theorem is an important theorem in differential calculus.
      It is covered in chapter four of our syllabus.
      Students should memorize the name of the Mean Value Theorem for the exam.
    `;
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: descriptiveMVT });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0, 'Descriptive theorem name mentions must yield 0 Hard capacity');
  });

  await runTest('2.4 Deep deductive proof with Rolle theorem & auxiliary function receives positive Hard capacity', async () => {
    const mathProof = `
      Let f be a function continuous on [a, b] and differentiable on (a, b).
      The Mean Value Theorem states that there exists c in (a, b) such that f'(c) = [f(b) - f(a)] / (b - a).
      We construct the auxiliary function h(x) = f(x) - f(a) - [(f(b) - f(a)) / (b - a)] * (x - a).
      Because h(a) = 0 and h(b) = 0, Rolle's Theorem applies directly, which implies h'(c) = 0.
      If differentiability fails at an interior point, the theorem fails and no tangent line parallels the secant line.
    `;
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: mathProof });
    assert(fallback.evidenceCapacity.capacityByDifficulty.hard > 0, 'Deductive proof with invariants and failure constraints must support Hard capacity');
  });

  // --- Suite 3: Domain-Agnostic Reasoning Recognition ---
  console.log('\n--- Suite 3: Domain-Agnostic Reasoning Recognition ---');

  await runTest('3.1 Reasoning-rich lecture with few domain-specific terms is recognized as deep and yields Hard capacity', async () => {
    const reasoningRichAgnostic = `
      When system components operate in lockstep, any local delay propagates through the entire pipeline because upstream producers cannot release resources until downstream consumers acknowledge receipt.
      To prevent cascading pipeline stalls, we introduce decoupled buffers between consecutive stages.
      If the buffer capacity is exceeded, the producer must pause execution, maintaining the invariant that no items are dropped.
      In contrast, an unbounded buffer prevents stalls but risks unbounded memory growth.
      Therefore, optimal throughput requires balancing buffer depth against processing latency.
    `;
    const analysis = depthAnalyzer.analyzeLecture(reasoningRichAgnostic);
    assert.strictEqual(analysis.isCurricular, true);
    assert.strictEqual(analysis.lectureDepth.characteristics.reasoning, 'Strong', 'Must recognize causal/invariant reasoning without CS dictionary');

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: reasoningRichAgnostic });
    assert(fallback.evidenceCapacity.capacityByDifficulty.hard > 0, 'Must support Hard capacity based on demonstrated causal invariants');
  });

  // --- Suite 4: Partial Fallback Consistency & Failure-Path Handling ---
  console.log('\n--- Suite 4: Partial Fallback Consistency & Failure Paths ---');

  await runTest('4.1 Insufficient non-academic content safely yields zero capacity across all tiers', async () => {
    const nonAcademic = `Hello everyone, good morning. Did you see the soccer match yesterday? What great weather outside.`;
    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: nonAcademic });
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.hard, 0);
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.medium, 0);
    assert.strictEqual(fallback.evidenceCapacity.capacityByDifficulty.easy, 0);
  });

  await runTest('4.2 Missing or contradictory depth characteristics fall back gracefully to baseline without crashing', async () => {
    // Calling deriveSemanticCapacity with corrupted or empty structures
    const corruptedCritique = { explanatoryDepth: null, reasoningDepth: undefined };
    const corruptedConcepts = [{ id: 'C01', name: 'Fault Tolerant Concept', definition: 'A valid definition with adequate length.' }];
    const cap = lectureIntelligence.deriveSemanticCapacity(corruptedConcepts, corruptedCritique, { wordCount: 100 });
    assert(cap.totalDefensibleCapacity > 0, 'Must handle malformed critique gracefully');
    assert.strictEqual(cap.capacityByDifficulty.hard, 0, 'Malformed critique must not invent Hard capacity');
  });

  // --- Suite 5: Negative Boundary Enforcement (NO_CODE + NO_MATH) ---
  console.log('\n--- Suite 5: Negative Boundary Enforcement (NO_CODE + NO_MATH) ---');

  await runTest('5.1 NO_CODE and NO_MATH together preserves qualitative causal Hard capacity without forcing code/math', async () => {
    const historyDeep = `
      The outbreak of the First World War in 1914 was driven by structural diplomatic dilemmas and rigid military mobilization timetables.
      The Triple Entente and Triple Alliance mutual defense treaties transformed a regional Balkan crisis into a continental confrontation.
      Crucially, military railway mobilization plans dictated strategic escalation: under the German Schlieffen Plan, survival depended on defeating France within six weeks.
      Because railway logistics required immutable troop movement schedules, pausing military mobilization was viewed as equivalent to unilateral surrender.
    `;
    const fallback = lectureIntelligence.buildPartialFallback({
      evidenceText: historyDeep,
      negativeBoundaries: ['NO_CODE', 'NO_MATH']
    });
    assert(fallback.evidenceCapacity.capacityByDifficulty.hard > 0, 'Qualitative deep reasoning must support Hard capacity even when code and math are both excluded');

    // Test planner enforces exclusions on all generated Hard angles
    const angles = agent1Planner._getDistinctHardAngles('Mobilization Inflexibility', historyDeep, {
      negativeBoundaries: ['NO_CODE', 'NO_MATH']
    });
    assert(angles.length > 0, 'Must produce distinct Hard angles');
    angles.forEach(a => {
      assert(a.negativeBoundaries.includes('NO_CODE'), 'Angle must preserve NO_CODE boundary');
      assert(a.negativeBoundaries.includes('NO_MATH'), 'Angle must preserve NO_MATH boundary');
      assert(/(?:no code|do not ask for code)/i.test(a.operationalGuidance), 'Angle must enforce NO_CODE constraint in guidance');
      assert(/(?:no math|do not ask for math)/i.test(a.operationalGuidance), 'Angle must enforce NO_MATH constraint in guidance');
    });
  });

  // --- Suite 6: Capacity Composition & Partial Usage ---
  console.log('\n--- Suite 6: Capacity Composition & Quota Management ---');

  await runTest('6.1 Positive capacity correctly fulfills balanced request (N=3) without exhausting all supported slots', async () => {
    const scienceDeep = `
      In allosteric feedback inhibition, the end product binds to an allosteric regulatory site distinct from the active catalytic site.
      This binding alters the enzyme's tertiary conformational geometry, lowering its catalytic affinity for the primary substrate.
      According to the Michaelis-Menten model, non-competitive inhibitors decrease Vmax while leaving Km unchanged because conformational distortion prevents catalytic turnover regardless of substrate saturation.
      If a genetic mutation mutates the allosteric domain, the pathway loses negative feedback control, resulting in toxic overproduction.
    `;

    const fallback = lectureIntelligence.buildPartialFallback({ evidenceText: scienceDeep });
    assert(fallback.evidenceCapacity.capacityByDifficulty.hard >= 1, 'Must have positive Hard capacity available');

    // Request N=3 Balanced: should allocate exactly 1 Easy, 1 Medium, 1 Hard with 0 deficits
    const plan = await agent1Planner.planAssessment({
      unifiedRawContent: scienceDeep,
      lectureIntelligence: fallback,
      isAcademic: true
    }, 'Balanced', 3);

    const hardTargets = plan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard');
    const medTargets = plan.assessmentTargets.filter(t => t.targetDifficulty === 'Medium');
    const easyTargets = plan.assessmentTargets.filter(t => t.targetDifficulty === 'Easy');

    assert.strictEqual(hardTargets.length, 1, 'Balanced N=3 must allocate exactly 1 Hard');
    assert.strictEqual(medTargets.length, 1, 'Balanced N=3 must allocate exactly 1 Medium');
    assert.strictEqual(easyTargets.length, 1, 'Balanced N=3 must allocate exactly 1 Easy');
    assert.strictEqual(plan.capacityDeficitReport.capacityDeficit, 0, 'Must record 0 capacity deficits since demand is fully within supply');
  });

  // --- Final Summary ---
  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passCount} / ${passCount + failCount} TESTS PASSED`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
})();
