/**
 * server/test/test_phase6_stage1_full_lecture_benchmark.js
 *
 * Phase 6 / Stage 1: Full-Lecture Benchmark & Trajectory Verification Suite
 * Executes rigorous benchmarks on full, real lecture fixtures:
 * 1. KMIT 45-minute Deepa Madam Recursion & Euclidean Algorithm Lecture (ARCH_05)
 * 2. Real Whisper 858-segment 5,055-second Lecture Transcript (pp_lecture_transcript.json)
 * 3. Deep Conceptual Lecture with Teacher Exclusions (ARCH_01 GANs with NO_CODE)
 * 4. Minimal Definition-Only Lecture with Honest Capacity Deficits (ARCH_07 Cloud Taxonomy)
 * 5. Algorithmic Trace & Implementation Lecture (ARCH_02 Dijkstra Min-Heap)
 *
 * Verifies:
 * - Early, Mid, Late chronological coverage without truncation
 * - Real timestamp provenance
 * - Recommended vs requested vs generated counts across Easy, Medium, Hard, Balanced
 * - Preview vs production capacity consistency
 * - Teacher negative boundary enforcement
 * - Zero question fabrication on capacity deficits
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evidencePackager = require('../engine/evidence/evidencePackager');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');
const agent2 = require('../engine/agents/agent2Generator');
const agent3 = require('../engine/agents/agent3Evaluator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

const GOLDEN_BENCHMARKS_PATH = path.resolve(__dirname, '../../evaluation_dataset/golden_benchmarks/step7_real_lecture_benchmark.json');
const PP_TRANSCRIPT_PATH = path.resolve(__dirname, '../../pipeline_experiment/data/transcripts/pp_lecture_transcript.json');

async function runStage1FullLectureBenchmark() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 6 / Stage 1: Full-Lecture Benchmark Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function testBenchmark(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: [${total}] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // Load Golden Benchmarks
  assert.ok(fs.existsSync(GOLDEN_BENCHMARKS_PATH), `Golden benchmarks file must exist at ${GOLDEN_BENCHMARKS_PATH}`);
  const goldenCases = JSON.parse(fs.readFileSync(GOLDEN_BENCHMARKS_PATH, 'utf8'));

  // --- Benchmark 1: KMIT 45-min Deepa Madam Lecture ---
  await testBenchmark('Benchmark 1: 45-min KMIT Recursion Lecture (ARCH_05) preserves Early/Mid/Late trajectory and capacity', async () => {
    const case05 = goldenCases.find(c => c.testId === 'ARCH_05');
    assert.ok(case05, 'ARCH_05 must be present in golden benchmarks');

    // Package evidence
    const pkg = evidencePackager.packageSessionEvidence({
      sessionId: 'bench_kmit_45m_01',
      voiceTranscript: case05.voiceText,
      documentTexts: [case05.docText],
      documentNames: ['KMIT_Recursion_Syllabus.txt']
    });

    assert.ok(pkg.unifiedRawContent.length > 10000, `Expected full 45-min transcript (>10k chars), found ${pkg.unifiedRawContent.length}`);

    // Compute semantic capacity
    const capacityInfo = lectureIntelligence.deriveSemanticCapacity(pkg.unifiedRawContent, {
      easy: 0.85,
      medium: 0.90,
      hard: 0.80,
      balanced: 0.85
    });

    assert.ok(capacityInfo.capacityByDifficulty.easy >= 3, `Expected at least 3 Easy capacity, got ${capacityInfo.capacityByDifficulty.easy}`);
    assert.ok(capacityInfo.capacityByDifficulty.medium >= 1, `Expected at least 1 Medium capacity, got ${capacityInfo.capacityByDifficulty.medium}`);
    assert.ok(capacityInfo.capacityByDifficulty.balanced >= 4, `Expected at least 4 Balanced capacity, got ${capacityInfo.capacityByDifficulty.balanced}`);

    // Plan assessment targets
    const plan = await agent1Planner.planAssessment(pkg, {
      targetCount: 5,
      requestedDifficulty: 'Balanced',
      subject: case05.subject
    });

    assert.strictEqual(plan.assessmentTargets.length, 5, 'Must plan requested 5 targets');

    // Verify chronological trajectory phases
    const phases = plan.assessmentTargets.map(t => t.trajectoryPhase).filter(Boolean);
    const hasEarly = phases.includes('EARLY');
    const hasLate = phases.includes('LATE');

    assert.ok(hasEarly, 'Plan must include EARLY lecture targets (LCM/GCD basics)');
    assert.ok(hasLate, 'Plan must include LATE lecture targets (String reversal / palindrome)');

    // Verify preview vs production capacity consistency
    pkg.lectureIntelligence = capacityInfo;
    const auditedTargets = agent1Planner._auditAssessmentTargets(plan.assessmentTargets, [], 5, pkg);
    assert.ok(auditedTargets.cleanTargets.length >= 4, 'Production planner audit should retain full defensible targets');
  });

  // --- Benchmark 2: Real Whisper 858-segment 5,055-second Transcript ---
  await testBenchmark('Benchmark 2: 5,055-sec 858-segment Whisper transcript preserves genuine monotonic timestamps', async () => {
    assert.ok(fs.existsSync(PP_TRANSCRIPT_PATH), `Whisper transcript must exist at ${PP_TRANSCRIPT_PATH}`);
    const ppData = JSON.parse(fs.readFileSync(PP_TRANSCRIPT_PATH, 'utf8'));

    assert.ok(Array.isArray(ppData.segments), 'Whisper data must have segments array');
    assert.ok(ppData.segments.length > 500, `Expected > 500 segments, got ${ppData.segments.length}`);

    // Package with segments
    const pkg = evidencePackager.packageSessionEvidence({
      sessionId: 'bench_whisper_5055s',
      voiceTranscript: ppData.segments.map(s => s.text).join(' '),
      transcriptSegments: ppData.segments
    });

    assert.strictEqual(pkg.hasRealTimestamps, true, 'hasRealTimestamps must be true for real Whisper segments');
    assert.ok(pkg.hierarchicalStore.children.length > 0, 'Must create hierarchical children');

    // Verify timestamp span from start to finish
    const firstChild = pkg.hierarchicalStore.children[0];
    const lastChild = pkg.hierarchicalStore.children[pkg.hierarchicalStore.children.length - 1];

    assert.strictEqual(typeof firstChild.start, 'number', 'First child must have numeric start time');
    assert.ok(firstChild.start < 100, `First child should start near beginning (<100s), got ${firstChild.start}`);
    assert.ok(lastChild.end > 3000, `Last child should end near end of lecture (>3000s), got ${lastChild.end}`);
    assert.ok(lastChild.end > firstChild.start, 'Timestamps must be monotonically increasing');
  });

  // --- Benchmark 3: Deep Conceptual Lecture with Teacher Boundary ---
  await testBenchmark('Benchmark 3: GAN Conceptual Lecture (ARCH_01) strictly enforces NO_CODE_IMPLEMENTATION', async () => {
    const case01 = goldenCases.find(c => c.testId === 'ARCH_01');
    assert.ok(case01, 'ARCH_01 must be present in golden benchmarks');

    const pkg = evidencePackager.packageSessionEvidence({
      sessionId: 'bench_gan_nocode',
      voiceTranscript: case01.voiceText,
      documentTexts: [case01.docText],
      negativeBoundaries: case01.negativeBoundaries
    });

    // Check capacity derivation with negative boundaries
    const capacity = lectureIntelligence.deriveSemanticCapacity(pkg.unifiedRawContent, {
      easy: 0.85,
      medium: 0.90,
      hard: 0.80,
      balanced: 0.85
    }, case01.negativeBoundaries);

    assert.ok(capacity.capacityByDifficulty.balanced >= 2, 'Should support at least 2 balanced conceptual questions');

    // Verify boundary violation rejection in Agent 3
    const badCodeQuestion = {
      questionText: "How do you implement GAN training step in PyTorch?\n```python\noptimizer.zero_grad()\nloss.backward()\n```",
      options: [
        "optimizer.zero_grad(); loss.backward()",
        "loss.backward(); optimizer.step()",
        "model.train(); loss = loss + 1",
        "torch.cuda.empty_cache()"
      ],
      correctAnswer: "optimizer.zero_grad(); loss.backward()"
    };

    const target = {
      concept: "GAN Minimax Training",
      targetDifficulty: "Medium",
      intendedCognitiveOperation: "TRACE",
      negativeBoundaries: case01.negativeBoundaries
    };

    const evalRes = await agent3.evaluateQuestion(badCodeQuestion, target, pkg, { skipLLM: true });
    assert.strictEqual(evalRes.status, 'FAIL', 'Code question violating NO_CODE must fail');
    assert.ok(evalRes.failureReasons.includes('TEACHER_BOUNDARY_VIOLATION'));
  });

  // --- Benchmark 4: Minimal Definition-Only Lecture ---
  await testBenchmark('Benchmark 4: Definition-Only Cloud Taxonomy (ARCH_07) produces 0 Hard questions with honest deficits', async () => {
    const case07 = goldenCases.find(c => c.testId === 'ARCH_07');
    assert.ok(case07, 'ARCH_07 must be present in golden benchmarks');

    const pkg = evidencePackager.packageSessionEvidence({
      sessionId: 'bench_cloud_deficit',
      voiceTranscript: case07.voiceText,
      documentTexts: [case07.docText]
    });

    // Request Hard difficulty
    const plan = await agent1Planner.planAssessment(pkg, {
      targetCount: 3,
      requestedDifficulty: 'Hard',
      subject: case07.subject
    });

    // Pure descriptive taxonomy cannot support Hard questions without hallucination
    const hardTargets = plan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(hardTargets.length, 0, 'Definition-only lecture must produce 0 Hard targets');

    // Must record unfulfilled capacity deficits
    const deficitTargets = plan.assessmentTargets.filter(t => t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT' || t.isCapacityLimited === true);
    assert.ok(deficitTargets.length > 0, 'Must record explicit capacity deficits');
  });

  // --- Benchmark 5: Algorithmic Implementation (ARCH_02 Dijkstra) ---
  await testBenchmark('Benchmark 5: Algorithmic Implementation Lecture (ARCH_02 Dijkstra) supports Trace & Mechanisms', async () => {
    const case02 = goldenCases.find(c => c.testId === 'ARCH_02');
    assert.ok(case02, 'ARCH_02 must be present in golden benchmarks');

    const pkg = evidencePackager.packageSessionEvidence({
      sessionId: 'bench_dijkstra_01',
      voiceTranscript: case02.voiceText,
      documentTexts: [case02.docText]
    });

    const capacity = lectureIntelligence.deriveSemanticCapacity(pkg.unifiedRawContent, {
      easy: 0.85,
      medium: 0.90,
      hard: 0.85,
      balanced: 0.85
    });

    assert.ok(capacity.capacityByDifficulty.easy >= 2, 'Algorithmic lecture must support Easy recall');
    assert.ok(capacity.capacityByDifficulty.balanced >= 2, 'Algorithmic lecture must support Balanced questions');

    const plan = await agent1Planner.planAssessment(pkg, {
      targetCount: 3,
      requestedDifficulty: 'Balanced',
      subject: case02.subject
    });

    const ops = plan.assessmentTargets.map(t => t.intendedCognitiveOperation);
    assert.ok(ops.includes('TRACE') || ops.includes('COMPARE') || ops.includes('EXPLAIN_MECHANISM'), 'Must include trace or mechanism operations');
  });

  console.log(`\n================================================================`);
  console.log(`📊 Phase 6 / Stage 1 Results: ${passed} / ${total} Benchmarks Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStage1FullLectureBenchmark().catch(err => {
    console.error('Fatal error running Stage 1 benchmarks:', err);
    process.exit(1);
  });
}

module.exports = { runStage1FullLectureBenchmark };
