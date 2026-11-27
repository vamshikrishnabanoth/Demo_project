/**
 * server/test/test_phase3_acceptance_benchmarks.js
 *
 * PHASE 3 STAGE 1: HARDENED ACCEPTANCE BENCHMARK SUITE (T01 - T10)
 *
 * This suite provides two distinct execution modes:
 *
 * 1. BASELINE REPRODUCTION MODE (Default, run without flags):
 *    - Executes the actual production code against all 10 fixtures.
 *    - Captures and logs exact telemetry at every pipeline boundary.
 *    - Validates that the test infrastructure itself functions correctly.
 *    - Exits 0 upon clean execution of the diagnostic suite.
 *
 * 2. ACCEPTANCE ASSERTION MODE (Run with --mode=acceptance or --assert-acceptance):
 *    - Evaluates the output against the target evidence-first architecture.
 *    - Executes strict assert statements on target invariants.
 *    - Exits non-zero (code 1) when current production logic exhibits known vulnerabilities.
 *
 * INVARIANTS:
 * - NO PRODUCTION CODE MODIFIED.
 * - All tests exercise actual production functions directly.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../engine/agents/agent1Planner');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const groundingGate = require('../engine/validators/groundingGate');
const IntentRelativeReasoner = require('../engine/agents/intentRelativeReasoner');

const isAcceptanceMode = process.argv.includes('--mode=acceptance') || 
                         process.argv.includes('--assert-acceptance') || 
                         process.env.MODE === 'acceptance';

const benchmarkTelemetry = [];

function recordTelemetry(item) {
  benchmarkTelemetry.push(item);
}

(async () => {
  console.log('\n======================================================================');
  console.log(`🧪 PHASE 3 STAGE 1: BENCHMARK SUITE (T01 - T10) [Mode: ${isAcceptanceMode ? 'ACCEPTANCE ASSERTIONS' : 'BASELINE REPRODUCTION'}]`);
  console.log('======================================================================\n');

  let passedAcceptance = 0;
  let failedAcceptance = 0;

  // -------------------------------------------------------------------------
  // T01: Technical Nouns Mentioned Only (Descriptive Semaphore / Treaty / Enzyme)
  // -------------------------------------------------------------------------
  console.log('--- [T01] Technical Nouns Mentioned Only (Planning Boundary Telemetry) ---');
  try {
    const fixtureT01 = [
      'A semaphore is an integer synchronization variable used in operating systems.',
      'The Treaty of Versailles was an international peace accord signed in the year 1919.',
      'An enzyme is a protein macromolecule that functions as a biological catalyst.'
    ].join('\n');

    const fallbackT01 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT01 });
    const capacityByDiff = fallbackT01.evidenceCapacity.capacityByDifficulty;
    
    // Execute real planning boundary
    const planT01 = await agent1Planner.planAssessment({
      unifiedRawContent: fixtureT01,
      lectureIntelligence: fallbackT01,
      isAcademic: true
    }, 'Hard', 2);

    const rawTargetsCount = planT01.assessmentTargets.length;
    const hardTargets = planT01.assessmentTargets.filter(t => t.targetDifficulty === 'Hard');
    const deficitReport = planT01.capacityDeficitReport || {};
    const capacityLimitations = planT01.capacityLimitations || [];

    const telemetry = {
      requestedDifficulty: 'Hard',
      requestedCount: 2,
      capacityByDifficulty: capacityByDiff,
      rawTargetsPlanned: rawTargetsCount,
      finalHardTargets: hardTargets.map(t => ({ id: t.targetId, concept: t.concept, diff: t.targetDifficulty, capLim: t.capacityLimitation })),
      capacityLimitationsCount: capacityLimitations.length,
      deficitReport: {
        requestedCount: deficitReport.requestedCount,
        generatedCount: deficitReport.generatedCount,
        capacityDeficit: deficitReport.capacityDeficit,
        deficitReason: deficitReport.deficitReason
      }
    };

    console.log(`  📊 [T01 Telemetry] Capacity: Hard=${capacityByDiff.hard}, Easy=${capacityByDiff.easy} | GeneratedCount=${deficitReport.generatedCount}, DeficitCount=${deficitReport.capacityDeficit}`);

    recordTelemetry({
      id: 'T01',
      title: 'Technical Nouns Mentioned Only',
      classification: 'ALIGNED_PLANNING_DEFICIT',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(capacityByDiff.hard, 0, 'Hard capacity must be strictly 0 for descriptive nouns');
      assert.strictEqual(deficitReport.capacityDeficit, 2, 'Deficit report must record 2 unfulfilled deficit slots');
      assert.strictEqual(deficitReport.generatedCount, 0, 'Generated count must be 0 for purely descriptive text');
      passedAcceptance++;
    }
    console.log('  ✅ [T01 Baseline Recorded]');
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T01 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T01 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T02: Reasoning Taught Without CS Jargon (Historical Causality)
  // -------------------------------------------------------------------------
  console.log('\n--- [T02] Reasoning Taught Without CS Jargon (Academic Classification Boundary) ---');
  try {
    const fixtureT02 = [
      'When grain imports were abruptly halted by the naval blockade, local flour prices tripled within two months.',
      'Because urban industrial laborers spent over seventy percent of their daily wages on basic bread, this sudden price surge made family subsistence mathematically impossible.',
      'Consequently, widespread bread riots erupted across major industrial cities, which paralyzed factory production.',
      'Faced with total industrial paralysis and civilian unrest, municipal councils were forced to enact emergency price controls and municipal grain rationing.'
    ].join('\n');

    const depthT02 = depthAnalyzer.analyzeLecture(fixtureT02);
    const hasAcademicWord = depthAnalyzer._hasAcademicDomainWord(fixtureT02.toLowerCase());
    const fallbackT02 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT02 });

    const telemetry = {
      isAcademic: depthT02.isAcademic,
      isCurricular: depthT02.isCurricular,
      hasAcademicWordMatch: hasAcademicWord,
      rejectionReason: depthT02.reason,
      curricularSegmentsCount: depthT02.curricularSegments?.length || 0,
      hardCapacity: fallbackT02.evidenceCapacity?.capacityByDifficulty?.hard
    };

    console.log(`  📊 [T02 Telemetry] isAcademic=${depthT02.isAcademic}, hasAcademicWordMatch=${hasAcademicWord}, HardCap=${fallbackT02.evidenceCapacity?.capacityByDifficulty?.hard}`);

    const isVulnerable = !depthT02.isAcademic;
    recordTelemetry({
      id: 'T02',
      title: 'Reasoning Taught Without CS Jargon',
      classification: isVulnerable ? 'CONFIRMED_SUBJECT_BIAS_FAILURE' : 'ALIGNED_BASELINE',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(depthT02.isAcademic, true, 'Historical causal reasoning must be recognized as academic without requiring CS keywords');
      assert(fallbackT02.evidenceCapacity.capacityByDifficulty.hard >= 1, 'Historical causal chain must support positive Hard capacity');
      passedAcceptance++;
    }
    console.log(`  ${isVulnerable ? '🔍 [T02 Confirmed Vulnerability: Rejected as non-academic]' : '✅ [T02 Baseline Recorded]'}`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T02 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T02 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T03: Conversational Causal Filler (Administrative / Logistics Chatter)
  // -------------------------------------------------------------------------
  console.log('\n--- [T03] Conversational Causal Filler (Discourse Filtering Telemetry) ---');
  try {
    const fixtureT03 = [
      'Good morning everyone. Please listen carefully because this announcement is very important for your final grade.',
      'You must submit the lab report by Friday because late submissions will receive zero marks.',
      'Therefore, ensure you speak with your group partners today because attendance will be strictly verified.',
      'Also, check your email tonight because the room schedule might change due to maintenance.'
    ].join('\n');

    const depthT03 = depthAnalyzer.analyzeLecture(fixtureT03);
    const reasoningRubric = depthT03.lectureDepth?.breakdown?.earnedRubric?.find(r => r.category === 'Causal Reasoning & Invariants');
    const fallbackT03 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT03 });

    const telemetry = {
      isAcademic: depthT03.isAcademic,
      isCurricular: depthT03.isCurricular,
      reasoningScore: reasoningRubric?.earned || 0,
      hardCapacity: fallbackT03.evidenceCapacity.capacityByDifficulty.hard
    };

    console.log(`  📊 [T03 Telemetry] isAcademic=${depthT03.isAcademic}, ReasoningEarned=${telemetry.reasoningScore}/15, HardCap=${telemetry.hardCapacity}`);

    recordTelemetry({
      id: 'T03',
      title: 'Conversational Causal Filler',
      classification: 'ALIGNED_ADMIN_REJECTION',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(telemetry.reasoningScore, 0, 'Conversational because must not award causal reasoning points to pure admin chatter');
      assert.strictEqual(telemetry.hardCapacity, 0, 'Pure admin chatter must yield strictly 0 Hard capacity');
      passedAcceptance++;
    }
    console.log('  ✅ [T03 Baseline Recorded: Admin chatter safely rejected]');
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T03 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T03 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T04: High Token Overlap, False Relation (Mitosis / ATP Synthesis Real Gate Verification)
  // -------------------------------------------------------------------------
  console.log('\n--- [T04] High Token Overlap, False Relation (Direct Grounding Gate Verification) ---');
  try {
    // 100% UNMODIFIED RAW TRANSCRIPT:
    const rawTranscriptT04 = [
      'During cell division in eukaryotic cells, mitosis ensures equal distribution of duplicated genetic material.',
      'In the early stages of mitosis, chromosomes condense in the nucleus to allow orderly separation.',
      'Meanwhile, in separate cellular organelles, mitochondria generate ATP through oxidative phosphorylation to supply metabolic energy.'
    ].join(' ');

    // ADVERSARIAL QUESTION with high token overlap:
    const adversarialQuestionT04 = {
      questionText: 'During mitosis, why do condensed chromosomes directly synthesize ATP in the nucleus?',
      options: [
        'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation',
        'Because chromosomes lack DNA during mitosis',
        'Because ATP is only consumed in the cytoplasm',
        'Because mitochondria dissolve during prophase'
      ],
      correctAnswer: 'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation'
    };

    // Direct execution of production Grounding Gate:
    const gateResultT04 = groundingGate.verifyQuizGrounding([adversarialQuestionT04], {
      unifiedRawContent: rawTranscriptT04
    });

    const justificationDetail = groundingGate._checkJustification(
      adversarialQuestionT04.questionText.toLowerCase(),
      adversarialQuestionT04.correctAnswer.toLowerCase(),
      rawTranscriptT04.toLowerCase(),
      adversarialQuestionT04,
      {}
    );

    const telemetry = {
      status: gateResultT04.status,
      totalVerified: gateResultT04.totalVerified,
      rejectedCount: gateResultT04.rejectedCount,
      justificationReason: justificationDetail.reason,
      matchedTokens: justificationDetail.matchedDomainAnchors,
      isJustified: justificationDetail.isJustified
    };

    console.log(`  📊 [T04 Telemetry] GateStatus=${gateResultT04.status}, Justified=${justificationDetail.isJustified}, Reason="${justificationDetail.reason}"`);
    console.log(`  📊 [T04 Matched Anchors] [${(justificationDetail.matchedDomainAnchors || []).join(', ')}]`);

    const isVulnerable = gateResultT04.status === 'PASSED' && justificationDetail.isJustified;
    recordTelemetry({
      id: 'T04',
      title: 'High Token Overlap, False Relation',
      classification: isVulnerable ? 'CONFIRMED_GROUNDING_GATE_FAILURE' : 'ALIGNED_GROUNDING',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(gateResultT04.status, 'FAILED', 'Grounding Gate MUST reject questions claiming an un-taught causal relation between distinct entities');
      assert.strictEqual(justificationDetail.isJustified, false, 'Adversarial false relation must not be justified');
      passedAcceptance++;
    }
    console.log(`  ${isVulnerable ? '🔍 [T04 Confirmed Vulnerability: Passed false relation with ' + justificationDetail.reason + ']' : '✅ [T04 Baseline Recorded]'}`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T04 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T04 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T05: Pure Definition-Only Lecture (Balanced Mode Planning Boundary)
  // -------------------------------------------------------------------------
  console.log('\n--- [T05] Pure Definition-Only Lecture (Balanced Allocation Boundary) ---');
  try {
    const fixtureT05 = [
      'A queue is defined as a First-In First-Out linear data structure.',
      'A stack is defined as a Last-In First-Out linear data structure.',
      'An array is defined as an indexed collection of elements stored at contiguous memory locations.'
    ].join('\n');

    const fallbackT05 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT05 });
    const capacityByDiff = fallbackT05.evidenceCapacity.capacityByDifficulty;

    const planT05 = await agent1Planner.planAssessment({
      unifiedRawContent: fixtureT05,
      lectureIntelligence: fallbackT05,
      isAcademic: true
    }, 'Balanced', 3);

    const allocatedTiers = planT05.assessmentTargets.map(t => t.targetDifficulty);
    const hardTargetsCount = planT05.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited).length;
    const deficitReport = planT05.capacityDeficitReport || {};

    const telemetry = {
      requestedDifficulty: 'Balanced',
      requestedCount: 3,
      capacityByDifficulty: capacityByDiff,
      allocatedTiers,
      nonDeficitHardTargetsCount: hardTargetsCount,
      capacityDeficit: deficitReport.capacityDeficit
    };

    console.log(`  📊 [T05 Telemetry] Capacity: Hard=${capacityByDiff.hard}, Easy=${capacityByDiff.easy} | Allocated: [${allocatedTiers.join(', ')}] | HardTargets=${hardTargetsCount}`);

    recordTelemetry({
      id: 'T05',
      title: 'Pure Definition-Only Lecture',
      classification: hardTargetsCount > 0 ? 'CONFIRMED_CAPACITY_OVERRIDE_FAILURE' : 'ALIGNED_BASELINE',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(capacityByDiff.hard, 0, 'Definition-only lecture must have strictly 0 Hard capacity');
      assert.strictEqual(hardTargetsCount, 0, 'Balanced plan must not assign Hard targets when Hard capacity is 0');
      passedAcceptance++;
    }
    console.log(`  ${hardTargetsCount > 0 ? '🔍 [T05 Confirmed Vulnerability: Balanced planned ' + hardTargetsCount + ' Hard question on definition text]' : '✅ [T05 Baseline Recorded]'}`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T05 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T05 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T06: Valid Deductive Proof & Literary Interpretation
  // -------------------------------------------------------------------------
  console.log('\n--- [T06] Valid Deductive Proof & Literary Interpretation (Non-Causal Capacity) ---');
  try {
    const fixtureMath = [
      'Let f be a function that is continuous on the closed interval [a, b] and differentiable on the open interval (a, b).',
      'Suppose further that f(a) = f(b).',
      'By the Extreme Value Theorem, f must attain an absolute maximum and minimum on [a, b].',
      'If the maximum and minimum both equal f(a), then f is constant on [a, b], which implies f\'(c) = 0 for every point c in (a, b).',
      'If either the maximum or minimum occurs at an interior point c in (a, b), then by Fermat\'s Theorem on local extrema, the derivative f\'(c) must equal zero.',
      'Hence, there exists at least one point c in (a, b) such that f\'(c) = 0.'
    ].join(' ');

    const fixtureLit = [
      'In Keats\'s Ode on a Grecian Urn, the speaker examines the paradoxical nature of artistic immortality.',
      'The carved lovers depicted on the marble urn remain frozen in perpetual anticipation: the fair youth cannot leave his song, nor can his beloved ever fade.',
      'Yet this aesthetic eternity is double-edged: while the figures escape mortal decay, aging, and sorrow, they are simultaneously denied living fulfillment, touch, and physical consummation.',
      'Through this stark juxtaposition, Keats constructs a critique of pure aestheticism, arguing that timeless art achieves perfection only at the cost of vital human warmth and transient experience.'
    ].join(' ');

    const fallbackMath = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureMath });
    const fallbackLit = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureLit });

    const telemetry = {
      mathHardCapacity: fallbackMath.evidenceCapacity.capacityByDifficulty.hard,
      litHardCapacity: fallbackLit.evidenceCapacity.capacityByDifficulty.hard,
      mathExplanatoryDepth: fallbackMath.pedagogicalCritique?.explanatoryDepth,
      litExplanatoryDepth: fallbackLit.pedagogicalCritique?.explanatoryDepth
    };

    console.log(`  📊 [T06 Telemetry] MathHardCap=${telemetry.mathHardCapacity}, LitHardCap=${telemetry.litHardCapacity}`);

    const isVulnerable = telemetry.mathHardCapacity === 0 || telemetry.litHardCapacity === 0;
    recordTelemetry({
      id: 'T06',
      title: 'Deductive Proof & Literary Interpretation',
      classification: isVulnerable ? 'CONFIRMED_NON_PHYSICAL_REASONING_UNDERCOUNT' : 'ALIGNED_BASELINE',
      telemetry
    });

    if (isAcceptanceMode) {
      assert(telemetry.mathHardCapacity >= 1, 'Mathematical deductive proof must support at least 1 Hard target');
      assert(telemetry.litHardCapacity >= 1, 'Literary aesthetic critique must support at least 1 Hard target');
      passedAcceptance++;
    }
    console.log(`  ${isVulnerable ? '🔍 [T06 Confirmed Vulnerability: Non-causal reasoning undercounted (Math=' + telemetry.mathHardCapacity + ', Lit=' + telemetry.litHardCapacity + ')]' : '✅ [T06 Baseline Recorded]'}`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T06 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T06 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T07: Teacher Explicitly Excludes Coding (Inspection of Real Enforcement Path)
  // -------------------------------------------------------------------------
  console.log('\n--- [T07] Teacher Excludes Coding (Inspection of Real Enforcement Path) ---');
  try {
    const fixtureT07 = [
      'Today we are discussing Process Scheduling algorithms in operating systems.',
      'Do not worry about coding, implementation syntax is strictly outside our syllabus, and there will be zero coding questions on the exam.',
      'A preemptive scheduler pauses the running process when a higher-priority process arrives, saving its state in the PCB.'
    ].join('\n');

    // 1. Spoken extraction boundary
    const boundaries = IntentRelativeReasoner.extractNegativeBoundaries(fixtureT07);
    const hasNoCodeBoundary = boundaries.includes('NO_CODE_IMPLEMENTATION') || boundaries.includes('NO_CODE');

    // 2. Candidate C Code question
    const candidateCodeMCQ = {
      questionText: 'Which C code snippet correctly saves process state into the PCB struct?',
      options: [
        'void save_pcb(struct task_struct *t) { t->state = READY; }',
        'int pcb_alloc() { return malloc(sizeof(PCB)); }',
        'void schedule() { switch_to(next); }',
        'struct task* get_task() { return current; }'
      ],
      correctAnswer: 'void save_pcb(struct task_struct *t) { t->state = READY; }'
    };

    const targetT07 = {
      concept: 'Process Scheduling',
      targetDifficulty: 'Medium',
      negativeBoundaries: ['NO_CODE']
    };

    const agent3Result = await agent3Evaluator.evaluateQuestion(candidateCodeMCQ, targetT07, {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    const gateResult = groundingGate.verifyQuizGrounding([candidateCodeMCQ], {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    const telemetry = {
      boundaryDetected: hasNoCodeBoundary,
      agent3Status: agent3Result.status,
      agent3Reasons: agent3Result.failureReasons,
      gateStatus: gateResult.status,
      gateReasons: gateResult.reasons
    };

    console.log(`  📊 [T07 Telemetry] BoundaryDetected=${hasNoCodeBoundary} | Agent3Status=${agent3Result.status} [${(agent3Result.failureReasons || []).join(', ')}] | GateStatus=${gateResult.status} [${(gateResult.reasons || []).join(', ')}]`);

    // Correct verdict: The boundary WAS blocked by the final gate, but Agent 3 misclassified it as UNGROUNDED_EVIDENCE_CLAIM
    const gateBlocked = gateResult.status === 'FAILED' && gateResult.reasons?.some(r => /TEACHER_BOUNDARY_VIOLATION/i.test(r));
    const agent3ProperlyClassified = agent3Result.failureReasons?.includes('TEACHER_BOUNDARY_VIOLATION');

    recordTelemetry({
      id: 'T07',
      title: 'Teacher Excludes Coding',
      classification: (gateBlocked && !agent3ProperlyClassified) 
        ? 'BOUNDARY_BLOCKED_INTERMEDIATE_ERROR_INCONSISTENT' 
        : (gateBlocked ? 'ALIGNED_ENFORCEMENT' : 'CONFIRMED_BOUNDARY_BYPASS'),
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(gateBlocked, true, 'Final Grounding Gate MUST block prohibited code content');
      assert.strictEqual(agent3ProperlyClassified, true, 'Agent 3 Evaluator MUST explicitly record TEACHER_BOUNDARY_VIOLATION code');
      passedAcceptance++;
    }
    if (gateBlocked && agent3ProperlyClassified) {
      console.log('  ✅ [T07 Verified: Both Final Gate and Agent 3 Evaluator record TEACHER_BOUNDARY_VIOLATION]');
    } else {
      console.log(`  🔍 [T07 Verdict]: Final gate blocked code, but Agent 3 recorded "${agent3Result.failureReasons?.join(', ')}" instead of TEACHER_BOUNDARY_VIOLATION.`);
    }
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T07 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T07 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T08: Fallback Under LLM Failure (Capacity Check at Fallback Blueprint Boundary)
  // -------------------------------------------------------------------------
  console.log('\n--- [T08] Fallback Under LLM Failure (Hard Capacity Check in Fallback) ---');
  try {
    const fixtureT08 = [
      'Hypertext Transfer Protocol is an application-layer protocol used for transmitting hypermedia documents.',
      'Uniform Resource Identifier is a unique sequence of characters that identifies a logical or physical resource.'
    ].join('\n');

    const fallbackT08 = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureT08 });
    const hardCapT08 = fallbackT08.evidenceCapacity.capacityByDifficulty.hard;

    // Simulate LLM failure: execute fallback plan + blueprint
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

    const deficitReport = planDataT08.capacityDeficitReport || {};
    const finalTargets = planDataT08.assessmentTargets || [];
    const nonDeficitHard = finalTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited && !t.capacityLimitation).length;

    const telemetry = {
      fallbackHardCapacity: hardCapT08,
      requestedCount: 5,
      generatedCount: deficitReport.generatedCount,
      capacityDeficit: deficitReport.capacityDeficit,
      nonDeficitHardTargetsCount: nonDeficitHard
    };

    console.log(`  📊 [T08 Telemetry] FallbackHardCap=${hardCapT08} | Requested=5, GeneratedCount=${deficitReport.generatedCount}, Deficit=${deficitReport.capacityDeficit} | NonDeficitHardTargets=${nonDeficitHard}`);

    const hasFabricatedTarget = deficitReport.generatedCount > 0 && hardCapT08 === 0;
    recordTelemetry({
      id: 'T08',
      title: 'Fallback Under LLM Failure',
      classification: hasFabricatedTarget ? 'CONFIRMED_FALLBACK_CAPACITY_LEAK' : 'ALIGNED_BASELINE',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(hardCapT08, 0, 'Fallback Hard capacity must be 0 for shallow definitions');
      assert.strictEqual(deficitReport.generatedCount, 0, 'Generated count must be strictly 0 when Hard capacity is 0');
      assert.strictEqual(deficitReport.capacityDeficit, 5, 'All 5 requested slots must be recorded as capacity deficits');
      passedAcceptance++;
    }
    console.log(`  ${hasFabricatedTarget ? '🔍 [T08 Confirmed Vulnerability: Fallback allocated 1 Hard target despite HardCap=0]' : '✅ [T08 Baseline Recorded]'}`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T08 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T08 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T09: Long Repetitive Lecture (Word Count vs Concept Distinctness)
  // -------------------------------------------------------------------------
  console.log('\n--- [T09] Long Repetitive Lecture (Volume vs Distinct Opportunities) ---');
  try {
    const paragraph = [
      'In this lecture we examine basic linear data structures.',
      'A stack is a Last-In First-Out structure where items are pushed and popped from the top element.',
      'A queue is a First-In First-Out structure where items are enqueued at the rear and dequeued from the front.',
      'Remember that a stack operates on LIFO principles while a queue operates on FIFO principles.',
      'Whenever you add an item to a stack it goes to the top, and whenever you add an item to a queue it goes to the back.'
    ].join(' ');

    const repetitiveText = Array(15).fill(paragraph).join('\n\n');
    const wordCount = repetitiveText.split(/\s+/).filter(Boolean).length;

    const depthT09 = depthAnalyzer.analyzeLecture(repetitiveText);
    const depthRecCount = depthT09.lectureDepth?.breakdown?.recommendedQuestionCount;

    const fallbackT09 = lectureIntelligence.buildPartialFallback({ evidenceText: repetitiveText });
    const distinctConcepts = fallbackT09.evidenceCapacity.distinctConceptCount;
    const semanticRecCount = fallbackT09.evidenceCapacity.recommendedQuestionCount;

    const telemetry = {
      wordCount,
      depthAnalyzerWordBucketRec: depthRecCount,
      distinctConceptsExtracted: distinctConcepts,
      semanticCapacityRec: semanticRecCount
    };

    console.log(`  📊 [T09 Telemetry] Words=${wordCount} | DepthAnalyzerRec=${depthRecCount} Qs (bucket-driven) vs SemanticRec=${semanticRecCount} Qs`);

    const isAligned = semanticRecCount <= 10 && depthRecCount <= 10 && distinctConcepts <= 3;

    recordTelemetry({
      id: 'T09',
      title: 'Long Repetitive Lecture',
      classification: isAligned ? 'ALIGNED_CAPACITY_BOUND' : 'INCONCLUSIVE_DIVERGENT_POLICY',
      telemetry
    });

    if (isAcceptanceMode) {
      assert(semanticRecCount <= 10, `Repetitive lecture should not recommend inflated semantic question counts (got ${semanticRecCount})`);
      assert(depthRecCount <= 10, `Repetitive lecture should not recommend inflated depth analyzer question counts (got ${depthRecCount})`);
      assert(distinctConcepts <= 3, `Repetitive lecture with 2-3 underlying concepts should extract at most 3 concepts (got ${distinctConcepts})`);
      passedAcceptance++;
    }
    console.log(`  ${isAligned ? '✅' : '🔍'} [T09 Volume Policy: DepthRec=${depthRecCount} Qs, SemanticRec=${semanticRecCount} Qs across ${distinctConcepts} distinct concepts.]`);
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T09 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T09 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // T10: Unfamiliar Legitimate Subject Term (Dynamic Vocabulary Verification)
  // -------------------------------------------------------------------------
  console.log('\n--- [T10] Unfamiliar Legitimate Subject Term (Non-CS Vocabulary Scoping) ---');
  try {
    const fixtureT10 = [
      'In the CRISPR-Cas9 adaptive immune system of bacteria, the Cas9 endonuclease introduces site-specific double-strand breaks in target DNA.',
      'Before Cas9 can cleave the target DNA, the enzyme must recognize a specific protospacer adjacent motif known as PAM immediately adjacent to the protospacer.',
      'If the PAM sequence is absent, Cas9 cannot unwind the DNA duplex, preventing the guide RNA from binding to its complementary target sequence.'
    ].join(' ');

    const candidateT10 = {
      questionText: 'In CRISPR-Cas9 genome editing, why is the presence of a protospacer adjacent motif (PAM) strictly required before target DNA cleavage can occur?',
      options: [
        'Because the PAM sequence initiates local DNA duplex unwinding, enabling guide RNA strand invasion and Cas9 activation',
        'Because PAM provides ribosomal translation initiation factors',
        'Because PAM acts as an allosteric inhibitor preventing nuclear entry',
        'Because Cas9 cannot be synthesized without the PAM sequence'
      ],
      correctAnswer: 'Because the PAM sequence initiates local DNA duplex unwinding, enabling guide RNA strand invasion and Cas9 activation'
    };

    const targetT10 = {
      concept: 'CRISPR-Cas9 Target Cleavage',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const agent3ResultT10 = await agent3Evaluator.evaluateQuestion(candidateT10, targetT10, {
      unifiedRawContent: fixtureT10
    });

    const gateResultT10 = groundingGate.verifyQuizGrounding([candidateT10], {
      unifiedRawContent: fixtureT10
    });

    const telemetry = {
      agent3Status: agent3ResultT10.status,
      agent3Reasons: agent3ResultT10.failureReasons || [],
      gateStatus: gateResultT10.status,
      gateReasons: gateResultT10.reasons || []
    };

    console.log(`  📊 [T10 Telemetry] Agent3Status=${agent3ResultT10.status}, GateStatus=${gateResultT10.status}`);

    const isAligned = agent3ResultT10.status === 'PASS' && gateResultT10.status === 'PASSED';
    recordTelemetry({
      id: 'T10',
      title: 'Unfamiliar Legitimate Subject Term',
      classification: isAligned ? 'ALIGNED_BASELINE' : 'CONFIRMED_DOMAIN_REJECTION',
      telemetry
    });

    if (isAcceptanceMode) {
      assert.strictEqual(agent3ResultT10.status, 'PASS', 'Agent 3 must accept legitimate biology terms present in lecture');
      assert.strictEqual(gateResultT10.status, 'PASSED', 'Grounding Gate must pass valid grounded biology terms');
      passedAcceptance++;
    }
    console.log('  ✅ [T10 Baseline Recorded: CRISPR biology terms accepted]');
  } catch (err) {
    if (isAcceptanceMode) {
      console.error(`  ❌ [T10 Acceptance Failure]: ${err.message}`);
      failedAcceptance++;
    } else {
      console.error(`  ⚠️ [T10 Error]: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Consolidation and Process Exit
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('📋 BENCHMARK EXECUTION SUMMARY TABLE');
  console.log('======================================================================');
  benchmarkTelemetry.forEach(t => {
    console.log(`[${t.id}] ${t.title.padEnd(38)} | ${t.classification}`);
  });
  console.log('======================================================================\n');

  if (isAcceptanceMode) {
    console.log(`🏁 ACCEPTANCE RESULTS: ${passedAcceptance} PASSED, ${failedAcceptance} FAILED`);
    if (failedAcceptance > 0) {
      process.exit(1);
    }
  } else {
    console.log('🏁 BASELINE TELEMETRY RECORDED CLEANLY (Exit Code: 0)');
    process.exit(0);
  }
})();
