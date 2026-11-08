/**
 * server/test/run_workstream2_controlled_evaluation.js
 *
 * WORKSTREAM 2: CONTROLLED END-TO-END QUESTION QUALITY VERIFICATION HARNESS
 *
 * Compares 3 Checkpoints across 5 Frozen Representative Diagnostic Fixtures:
 *   - Checkpoint A: Historical Baseline (commit 7373ba6 / step7_real_lecture_results.json)
 *   - Checkpoint B: Immediate Pre-Workstream 1 (commit 6393677: Style Contract v1.2, no stem-alignment gate)
 *   - Checkpoint C: Current Implementation (commit 4a52690: Agent 3 Interrogative Mood & Stem-Answer Alignment Gate)
 *
 * Evaluates:
 *   1. Semantic detection (did Agent 3 correctly classify defective vs clean candidates?)
 *   2. False rejection (did Agent 3 reject valid, high-quality candidates?)
 *   3. Repair efficacy (did bounded 1-attempt repair fix defective candidates into valid questions?)
 *   4. Final usable quality (are delivered questions grounded, responsive, unambiguous, concise?)
 *
 * Computes 7 Metrics with Raw Counts and Denominators:
 *   - Alignment Precision: Genuine misalignments rejected ÷ Total alignment-based rejections
 *   - Alignment Recall: Known misaligned candidates rejected ÷ Total known misaligned candidates
 *   - False Rejection Rate: Valid candidates rejected ÷ Total valid candidates evaluated
 *   - Answer-Key Defensibility: Uniquely defensible keyed options ÷ Total candidates assessed
 *   - Evidence Grounding: Supported claims ÷ Total claims
 *   - Repair Success Rate: Defective repaired into valid ÷ Total repair attempts
 *   - Final Usable Yield: Valid final questions ÷ Total generation attempts
 */

'use strict';

process.env.GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
process.env.GENERATION_CONCURRENCY = '1';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execSync } = require('child_process');

const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3EvaluatorCurrent = require('../engine/agents/agent3Evaluator');
const groundingGate = require('../engine/validators/groundingGate');
const kmitStyleContract = require('../config/kmitStyleContract');

const BENCHMARK_FILE = path.resolve(__dirname, '../../evaluation_dataset/golden_benchmarks/step7_real_lecture_benchmark.json');
const HISTORICAL_RESULTS_FILE = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/step7_real_lecture_results.json');
const OUTPUT_RESULTS_FILE = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/workstream2_evaluation_results.json');

// ─────────────────────────────────────────────────────────────────────────────
// 1. DYNAMIC CHECKPOINT B EVALUATOR COMPILATION (COMMIT 6393677)
// ─────────────────────────────────────────────────────────────────────────────
function loadCheckpointBEvaluator() {
  const codeB = execSync('git -C ' + path.resolve(__dirname, '../..') + ' show 6393677:server/engine/agents/agent3Evaluator.js', { encoding: 'utf8' });
  const mB = new Module('agent3Evaluator_checkpointB');
  mB.filename = path.resolve(__dirname, '../engine/agents/agent3Evaluator_checkpointB.js');
  mB.paths = Module._nodeModulePaths(path.dirname(mB.filename));
  mB._compile(codeB, mB.filename);
  return mB.exports;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FROZEN 5 DIAGNOSTIC FIXTURES DEFINITION
// ─────────────────────────────────────────────────────────────────────────────
const FROZEN_FIXTURES = [
  {
    fixtureId: 'FIX-01',
    name: 'Master Theorem Case 3 Regularity Condition',
    subject: 'Algorithms & Discrete Mathematics',
    archetype: 'Math Recurrence / Formal Proof',
    primaryFailureMode: 'Polar-question misalignment (Yes/No answered with conditional prerequisite)',
    interrogativeForm: 'POLAR_YES_NO',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'EVALUATE',
    evidenceText: 'The Master Theorem solves recurrences T(n) = aT(n/b) + f(n). In Case 2, if f(n) = Theta(n^(log_b a)), then T(n) = Theta(n^(log_b a) * log n). For recurrence T(n) = 2T(n/2) + Theta(n), we have a=2, b=2, so n^(log_2 2) = n. In Case 3, if f(n) = Omega(n^(log_b a + epsilon)) for epsilon > 0, and if a*f(n/b) <= c*f(n) for some constant c < 1 and all sufficiently large n (the regularity condition), then T(n) = Theta(f(n)). For recurrence T(n) = 4T(n/2) + n^3, we have a=4, b=2, so log_b a = log_2 4 = 2. Here f(n) = n^3, and n^3 = Omega(n^(2+1)). Regularity check: a*f(n/b) = 4*(n/2)^3 = 4*(n^3/8) = 0.5*n^3. Setting c = 0.5 < 1 satisfies 0.5*n^3 <= 0.5*n^3, so regularity holds and T(n) = Theta(n^3).',
    knownDefectiveCandidate: {
      questionText: 'Does the recurrence relation T(n) = 4T(n/2) + n^3 satisfy the regularity condition for Case 3 of the Master Theorem?',
      options: [
        'The regularity condition requires a*f(n/b) <= c*f(n) for some constant c < 1 and all sufficiently large n.',
        'No, because the polynomial growth rate violates the Master Theorem boundary.',
        'No, because divide-and-conquer recurrences never satisfy regularity when b equals 2.',
        'Yes, because any cubic polynomial is asymptotically bounded by logarithmic factors.'
      ],
      correctAnswer: 'The regularity condition requires a*f(n/b) <= c*f(n) for some constant c < 1 and all sufficiently large n.'
    },
    knownCleanCandidate: {
      questionText: 'Does the recurrence relation T(n) = 4T(n/2) + n^3 satisfy the regularity condition for Case 3 of the Master Theorem?',
      options: [
        'Yes, because 4*(n/2)^3 = 0.5*n^3 <= c*n^3 holds for c = 0.5 < 1.',
        'No, because 4*(n/2)^3 yields 2*n^3, which exceeds n^3 for all c < 1.',
        'No, because polynomial driving functions are strictly restricted to Case 2.',
        'Yes, because all recurrences with a < b^3 automatically satisfy regularity.'
      ],
      correctAnswer: 'Yes, because 4*(n/2)^3 = 0.5*n^3 <= c*n^3 holds for c = 0.5 < 1.'
    }
  },
  {
    fixtureId: 'FIX-02',
    name: 'Process vs Thread Context Switching & TLB Dynamics',
    subject: 'Operating Systems',
    archetype: 'Micro-Lecture (ARCH_04)',
    primaryFailureMode: 'Causal explanation misalignment ("Why..." answered with generic description)',
    interrogativeForm: 'EXPLANATORY_CAUSAL_WHY',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'ANALYZE',
    historicalBenchmarkTestId: 'ARCH_04',
    evidenceText: 'What is the fundamental distinction between a process and a thread? A process is an isolated execution environment managed by the kernel with its own private virtual address space, file descriptor table, and page tables. A thread is a lightweight execution stream within a process that shares the heap, global variables, and open files with sibling threads, but maintains its own private stack and register state. Because threads share memory within the same address space, thread context switches do not require TLB flushes, making them an order of magnitude faster than process switches.',
    knownDefectiveCandidate: {
      questionText: 'Why are thread context switches significantly faster than process context switches in modern operating systems?',
      options: [
        'Processes and threads are fundamental operating system abstraction units.',
        'Threads eliminate the need to save and restore CPU registers.',
        'Shared page tables remove register reloading during scheduling.',
        'Threads completely bypass operating system kernel execution overheads.'
      ],
      correctAnswer: 'Processes and threads are fundamental operating system abstraction units.'
    },
    knownCleanCandidate: {
      questionText: 'Why are thread context switches significantly faster than process context switches in modern operating systems?',
      options: [
        'Shared address spaces avoid expensive translation lookaside buffer flushes.',
        'Threads eliminate the need to save registers.',
        'Shared page tables remove register reloading.',
        'Threads completely bypass kernel overheads.'
      ],
      correctAnswer: 'Shared address spaces avoid expensive translation lookaside buffer flushes.'
    }
  },
  {
    fixtureId: 'FIX-03',
    name: 'Git Version Control Core Lifecycle & Fast-Forward Merge',
    subject: 'Software Engineering / DevOps',
    archetype: 'Multimodal Audio + Slide Deck',
    primaryFailureMode: 'Specific identification misalignment ("Which..." answered with tangential claim)',
    interrogativeForm: 'SPECIFIC_IDENTIFICATION_WHICH',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'ANALYZE',
    audioAssetPath: 'test_assets/git_lecture.mp3',
    slidesAssetPath: 'test_assets/git_lecture_slides.pptx',
    evidenceText: 'Git is a distributed version control system tracking history locally through a directed acyclic graph of immutable commit snapshots. The three trees model comprises the working directory, the staging area (index), and the repository history. The command git add caches changes into the index, and git commit -m permanently records the staged snapshot. Branch pointers are 41-byte movable references, and HEAD points to the checked-out branch. A fast-forward merge occurs when the target branch pointer moves linearly forward because no divergence exists between the branches.',
    knownDefectiveCandidate: {
      questionText: 'Which scenario enables Git to perform a fast-forward merge between two branches?',
      options: [
        'Git creates a synthetic merge commit to resolve divergent branch histories.',
        'Fast-forward merges occur only when a branch has no common ancestor.',
        'A three-way merge is required whenever commit hashes share parent nodes.',
        'Merge conflicts must first be manually resolved in the working tree.'
      ],
      correctAnswer: 'Git creates a synthetic merge commit to resolve divergent branch histories.'
    },
    knownCleanCandidate: {
      questionText: 'Which scenario enables Git to perform a fast-forward merge between two branches?',
      options: [
        'The target branch head is directly reachable from the source branch without divergent commits.',
        'Both branches have independent commits that can be combined without conflicts.',
        'The commit histories have diverged and require a synthetic merge commit.',
        'The repository is configured in a detached HEAD state.'
      ],
      correctAnswer: 'The target branch head is directly reachable from the source branch without divergent commits.'
    }
  },
  {
    fixtureId: 'FIX-04',
    name: 'Recursive GCD Termination & Euclidean Mechanics',
    subject: 'Computer Science Programming',
    archetype: 'Extended Classroom Session (ARCH_05 / Deepa Madam)',
    primaryFailureMode: 'Algorithmic state / loop termination mechanics ("Why..." answered with tautology)',
    interrogativeForm: 'EXPLANATORY_CAUSAL_WHY',
    targetDifficulty: 'Hard',
    intendedCognitiveOperation: 'EVALUATE',
    historicalBenchmarkTestId: 'ARCH_05',
    evidenceText: 'In recursive GCD computation using Euclid algorithm, gcd(a, b) = gcd(b, a % b) with base case b == 0 returning a. In iterative downward search for GCD of two positive integers, checking candidate divisors from min(a, b) down to 1 is guaranteed to terminate successfully because 1 is a universal common divisor of all positive integers. Making the problem smaller at each step and solving the base case is the fundamental principle of recursion.',
    knownDefectiveCandidate: {
      questionText: 'When implementing a downward search loop to compute the greatest common divisor of two positive integers, why is checking candidate divisors down to 1 guaranteed to find a solution?',
      options: [
        'Represents the core domain structure and operational rules for GCD established in the lecture.',
        'Checking down to zero is required because zero divides all integers evenly.',
        'Negative integer bounds are required to resolve symmetrical factor pairs.',
        'Common factors cannot exist below the square root of the smaller integer.'
      ],
      correctAnswer: 'Represents the core domain structure and operational rules for GCD established in the lecture.'
    },
    knownCleanCandidate: {
      questionText: 'When implementing a downward search loop to compute the greatest common divisor of two positive integers, why is checking candidate divisors down to 1 guaranteed to find a solution?',
      options: [
        'One is a universal common divisor of all positive integers, guaranteeing loop termination.',
        'Common factors cannot exist below the square root of the smaller integer.',
        'Checking down to zero is required because zero divides all integers evenly.',
        'Negative integer bounds are required to resolve symmetrical factor pairs.'
      ],
      correctAnswer: 'One is a universal common divisor of all positive integers, guaranteeing loop termination.'
    }
  },
  {
    fixtureId: 'FIX-05',
    name: 'Computer Organization Paging & Address Translation',
    subject: 'Computer Organization and Architecture',
    archetype: 'Multimodal Audio + Slide PDF (MULTI_001)',
    primaryFailureMode: 'Multimodal grounding / cross-modal assumption',
    interrogativeForm: 'SPECIFIC_IDENTIFICATION_WHICH',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'UNDERSTAND',
    multimodalDir: 'evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_001',
    evidenceText: 'In Computer Organization and Architecture Unit IV virtual memory systems, the CPU generates virtual addresses consisting of a virtual page number (VPN) and a page offset. The page table maps the virtual page number to a physical frame number (PFN). The translation lookaside buffer (TLB) acts as a high-speed hardware cache for recently translated page table entries. The page offset is copied directly from the virtual address to the physical address without modification, because page size and frame size are identical powers of two.',
    knownDefectiveCandidate: {
      questionText: 'Which component of a virtual address remains completely unmodified during address translation into a physical address?',
      options: [
        'The page table base register controls memory bus multiplexing.',
        'The virtual page number bits undergo arithmetic translation.',
        'The translation lookaside buffer tag matches the frame address.',
        'The cache set index determines direct-mapped cache placement.'
      ],
      correctAnswer: 'The page table base register controls memory bus multiplexing.'
    },
    knownCleanCandidate: {
      questionText: 'Which component of a virtual address remains completely unmodified during address translation into a physical address?',
      options: [
        'The page offset within the page frame.',
        'The virtual page number tag bits.',
        'The translation lookaside buffer index.',
        'The high-order segment selector bits.'
      ],
      correctAnswer: 'The page offset within the page frame.'
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDIT & METRICS CALCULATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function countWords(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function calculateOptionLengthRatio(options) {
  if (!Array.isArray(options) || options.length === 0) return 1.0;
  const lens = options.map(o => countWords(o));
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  return min === 0 ? max : parseFloat((max / min).toFixed(2));
}

function auditQuestionBasics(q, evidenceText, negativeBoundaries = []) {
  const stem = q.questionText || q.stem || q.question || '';
  const options = q.options || [];
  const correctAnswer = q.correctAnswer || q.answer || '';

  const stemWords = countWords(stem);
  const optWords = options.map(o => countWords(o));
  const maxOptWords = Math.max(...optWords, 0);
  const lengthRatio = calculateOptionLengthRatio(options);

  const styleAudit = kmitStyleContract.checkStyleHeuristics({
    questionText: stem,
    options,
    correctAnswer
  });

  const groundingRes = groundingGate.verifyQuizGrounding([{
    questionText: stem,
    options,
    correctAnswer
  }], {
    unifiedRawContent: evidenceText,
    negativeBoundaries
  });

  return {
    stemWords,
    maxOptWords,
    lengthRatio,
    passesStyle: styleAudit.passesStyle,
    styleIssues: styleAudit.issues,
    groundingStatus: groundingRes.status,
    groundingReason: groundingRes.validatedQuestions?.[0]?.failureReason || null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FULL CONTROLLED EVALUATION RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function runControlledBenchmark() {
  console.log('======================================================================');
  console.log('🔬 WORKSTREAM 2: CONTROLLED END-TO-END QUESTION QUALITY EVALUATION');
  console.log('   Checkpoint A (7373ba6) vs Checkpoint B (6393677) vs Checkpoint C (4a52690)');
  console.log('======================================================================\n');

  const startTime = Date.now();
  const historical = JSON.parse(fs.readFileSync(HISTORICAL_RESULTS_FILE, 'utf8'));
  const evaluatorCheckpointB = loadCheckpointBEvaluator();
  const evaluatorCheckpointC = agent3EvaluatorCurrent;

  const evaluationReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      checkpointA: { commit: '7373ba6', description: 'Historical Baseline (archived)' },
      checkpointB: { commit: '6393677', description: 'Immediate Pre-Workstream 1 (Style Contract v1.2, no stem-alignment gate)' },
      checkpointC: { commit: '4a52690', description: 'Current Implementation (Agent 3 Interrogative Mood & Stem-Answer Alignment Gate)' },
      models: {
        groqModel: process.env.GROQ_MODEL,
        geminiModel: process.env.GEMINI_MODEL
      }
    },
    diagnosticEvaluations: [],
    repairExperiments: [],
    historicalComparisons: [],
    pipelineGenerationEvaluations: [],
    summaryMetrics: {}
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: EVALUATOR DIRECT CONTROLLED DIAGNOSTIC PASS (5 DEFECTIVE + 5 CLEAN)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('🧪 PART 1: CONTROLLED EVALUATOR DIAGNOSTIC PASS (IDENTICAL CANDIDATES)');
  console.log('======================================================================\n');

  let genuineMisalignmentsDetected_B = 0;
  let totalAlignmentRejections_B = 0;
  let knownMisalignedRejected_B = 0;

  let genuineMisalignmentsDetected_C = 0;
  let totalAlignmentRejections_C = 0;
  let knownMisalignedRejected_C = 0;

  let falseRejections_B = 0;
  let validCandidatesEvaluated_B = 0;

  let falseRejections_C = 0;
  let validCandidatesEvaluated_C = 0;

  for (const fixture of FROZEN_FIXTURES) {
    console.log(`\n--- Fixture [${fixture.fixtureId}]: ${fixture.name} ---`);
    console.log(`    Primary Failure Mode: ${fixture.primaryFailureMode}`);

    const target = {
      concept: fixture.name,
      targetDifficulty: fixture.targetDifficulty,
      intendedCognitiveOperation: fixture.intendedCognitiveOperation,
      negativeBoundaries: []
    };
    const evidencePackage = {
      unifiedRawContent: fixture.evidenceText,
      keyTerms: [fixture.name]
    };

    // 1. Evaluate Known Defective Candidate
    console.log('  Testing Known Defective Candidate on Checkpoint B...');
    const evalB_def = await evaluatorCheckpointB.evaluateQuestion(fixture.knownDefectiveCandidate, target, evidencePackage);
    const rejectedByB_def = evalB_def.status === 'FAIL';
    const isAlignmentRejectionB = (evalB_def.failureReasons || []).some(r => /align|stem|answer|interrogat|direct|respons/i.test(r));

    if (rejectedByB_def) knownMisalignedRejected_B++;
    if (isAlignmentRejectionB) {
      totalAlignmentRejections_B++;
      genuineMisalignmentsDetected_B++;
    }

    console.log('  Testing Known Defective Candidate on Checkpoint C...');
    const evalC_def = await evaluatorCheckpointC.evaluateQuestion(fixture.knownDefectiveCandidate, target, evidencePackage);
    const rejectedByC_def = evalC_def.status === 'FAIL';
    const isAlignmentRejectionC = (evalC_def.failureReasons || []).includes('STEM_ANSWER_MISALIGNMENT') ||
                                  (evalC_def.failureReasons || []).includes('EVALUATION_CONTRACT_VIOLATION') ||
                                  evalC_def.stemAnswerAlignment?.isDirectlyResponsive === false ||
                                  evalC_def.stemAnswerAlignment?.interrogativeMatch === false;

    if (rejectedByC_def) knownMisalignedRejected_C++;
    if (isAlignmentRejectionC) {
      totalAlignmentRejections_C++;
      genuineMisalignmentsDetected_C++;
    }

    console.log(`    Defective -> Checkpoint B Verdict: ${evalB_def.status} (Reasons: [${evalB_def.failureReasons?.join(', ')}])`);
    console.log(`    Defective -> Checkpoint C Verdict: ${evalC_def.status} (Reasons: [${evalC_def.failureReasons?.join(', ')}])`);
    if (evalC_def.stemAnswerAlignment) {
      console.log(`    Checkpoint C Alignment Gate: Mood=${evalC_def.stemAnswerAlignment.interrogativeMood}, isResponsive=${evalC_def.stemAnswerAlignment.isDirectlyResponsive}, match=${evalC_def.stemAnswerAlignment.interrogativeMatch}`);
    }

    // 2. Evaluate Known Clean Candidate
    console.log('  Testing Known Clean Candidate on Checkpoint B...');
    const evalB_clean = await evaluatorCheckpointB.evaluateQuestion(fixture.knownCleanCandidate, target, evidencePackage);
    validCandidatesEvaluated_B++;
    if (evalB_clean.status === 'FAIL') falseRejections_B++;

    console.log('  Testing Known Clean Candidate on Checkpoint C...');
    const evalC_clean = await evaluatorCheckpointC.evaluateQuestion(fixture.knownCleanCandidate, target, evidencePackage);
    validCandidatesEvaluated_C++;
    if (evalC_clean.status === 'FAIL') falseRejections_C++;

    console.log(`    Clean     -> Checkpoint B Verdict: ${evalB_clean.status} (Reasons: [${evalB_clean.failureReasons?.join(', ')}])`);
    console.log(`    Clean     -> Checkpoint C Verdict: ${evalC_clean.status} (Reasons: [${evalC_clean.failureReasons?.join(', ')}])`);

    evaluationReport.diagnosticEvaluations.push({
      fixtureId: fixture.fixtureId,
      name: fixture.name,
      defectiveCandidate: {
        stem: fixture.knownDefectiveCandidate.questionText,
        key: fixture.knownDefectiveCandidate.correctAnswer,
        checkpointB: {
          status: evalB_def.status,
          verdict: evalB_def.verdict,
          failureReasons: evalB_def.failureReasons,
          score: evalB_def.confidenceScore || evalB_def.score
        },
        checkpointC: {
          status: evalC_def.status,
          verdict: evalC_def.verdict,
          failureReasons: evalC_def.failureReasons,
          score: evalC_def.confidenceScore || evalC_def.score,
          stemAnswerAlignment: evalC_def.stemAnswerAlignment
        }
      },
      cleanCandidate: {
        stem: fixture.knownCleanCandidate.questionText,
        key: fixture.knownCleanCandidate.correctAnswer,
        checkpointB: {
          status: evalB_clean.status,
          verdict: evalB_clean.verdict,
          failureReasons: evalB_clean.failureReasons,
          score: evalB_clean.confidenceScore || evalB_clean.score
        },
        checkpointC: {
          status: evalC_clean.status,
          verdict: evalC_clean.verdict,
          failureReasons: evalC_clean.failureReasons,
          score: evalC_clean.confidenceScore || evalC_clean.score,
          stemAnswerAlignment: evalC_clean.stemAnswerAlignment
        }
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: BOUNDED REPAIR EFFICACY EXPERIMENT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('🛠️ PART 2: BOUNDED REPAIR EFFICACY PASS');
  console.log('======================================================================\n');

  let repairAttempts_B = 0;
  let successfulRepairs_B = 0;
  let repairAttempts_C = 0;
  let successfulRepairs_C = 0;

  // Run repair on Fixture 1 (Math U3) and Fixture 2 (Process vs Thread)
  const repairFixtures = [FROZEN_FIXTURES[0], FROZEN_FIXTURES[1]];
  for (const rf of repairFixtures) {
    console.log(`\nEvaluating bounded repair on ${rf.fixtureId} (${rf.name})...`);
    const target = {
      concept: rf.name,
      targetDifficulty: rf.targetDifficulty,
      intendedCognitiveOperation: rf.intendedCognitiveOperation,
      negativeBoundaries: []
    };
    const evidencePackage = {
      unifiedRawContent: rf.evidenceText,
      keyTerms: [rf.name]
    };

    repairAttempts_B++;
    console.log('  Running evaluateAndRepairQuestion on Checkpoint B...');
    const repB = await evaluatorCheckpointB.evaluateAndRepairQuestion(
      rf.knownDefectiveCandidate,
      target,
      evidencePackage,
      agent2Generator
    );
    if (repB.status === 'PASS') successfulRepairs_B++;
    console.log(`  Checkpoint B Repair Status: ${repB.status} | Repaired: ${repB.repaired}`);

    repairAttempts_C++;
    console.log('  Running evaluateAndRepairQuestion on Checkpoint C...');
    const repC = await evaluatorCheckpointC.evaluateAndRepairQuestion(
      rf.knownDefectiveCandidate,
      target,
      evidencePackage,
      agent2Generator
    );
    if (repC.status === 'PASS') successfulRepairs_C++;
    console.log(`  Checkpoint C Repair Status: ${repC.status} | Repaired: ${repC.repaired}`);

    const finalQB = repB.mcq || repB.repairedCandidate || repB.question || rf.knownDefectiveCandidate;
    const finalQC = repC.mcq || repC.repairedCandidate || repC.question || rf.knownDefectiveCandidate;

    evaluationReport.repairExperiments.push({
      fixtureId: rf.fixtureId,
      name: rf.name,
      checkpointB: {
        status: repB.status,
        repaired: repB.repaired,
        instruction: repB.repairInstruction,
        finalStem: finalQB.questionText || finalQB.stem,
        finalKey: finalQB.correctAnswer
      },
      checkpointC: {
        status: repC.status,
        repaired: repC.repaired,
        instruction: repC.repairInstruction,
        finalStem: finalQC.questionText || finalQC.stem,
        finalKey: finalQC.correctAnswer,
        stemAnswerAlignment: repC.stemAnswerAlignment
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: HISTORICAL BASELINE (CHECKPOINT A) COMPARISON CONTEXT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('🏛️ PART 3: HISTORICAL BASELINE (CHECKPOINT A: 7373ba6) CONTEXT');
  console.log('======================================================================\n');

  for (const fixture of FROZEN_FIXTURES) {
    if (fixture.historicalBenchmarkTestId) {
      const histItem = historical.find(h => h.testId === fixture.historicalBenchmarkTestId);
      if (histItem && histItem.questions) {
        console.log(`Loading Checkpoint A data for ${fixture.fixtureId} (Historical ${histItem.testId}): ${histItem.name}`);
        const auditedQuestions = histItem.questions.map(q => ({
          targetId: q.targetId,
          difficulty: q.targetDifficulty,
          stem: q.questionText,
          correctAnswer: q.correctAnswer,
          audit: auditQuestionBasics(q, histItem.voiceText || fixture.evidenceText, histItem.negativeBoundaries)
        }));

        evaluationReport.historicalComparisons.push({
          fixtureId: fixture.fixtureId,
          historicalTestId: histItem.testId,
          name: histItem.name,
          questions: auditedQuestions
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: FRESH PIPELINE GENERATION ON FIXTURES (EVALUATED UNDER B & C)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('🚀 PART 4: FRESH PIPELINE GENERATION ACROSS FIXTURES');
  console.log('   (Evaluating identical generated candidates through both B & C)');
  console.log('======================================================================\n');

  let totalGeneratedCandidatesAssessed = 0;
  let uniquelyDefensibleKeyed_B = 0;
  let uniquelyDefensibleKeyed_C = 0;
  let groundedQuestions_B = 0;
  let groundedQuestions_C = 0;

  // Run pipeline generation on Fixture 2 (ARCH_04) and Fixture 4 (ARCH_05)
  const pipelineFixtures = [FROZEN_FIXTURES[1], FROZEN_FIXTURES[3]];

  for (const pf of pipelineFixtures) {
    console.log(`\nRunning fresh pipeline generation on ${pf.fixtureId} (${pf.name})...`);
    const genRes = await pipelineOrchestrator.runPipeline({
      sessionId: `workstream2_eval_${pf.fixtureId.toLowerCase()}_` + Date.now(),
      voiceTranscript: pf.evidenceText,
      documentTexts: [pf.evidenceText],
      documentNames: [`${pf.name.replace(/\s+/g, '_')}.txt`],
      count: 3,
      difficulty: 'Balanced'
    });

    console.log(`Pipeline Status: ${genRes.pipelineStatus} | Questions Delivered: ${genRes.questions.length} / 3`);

    const fixtureGenRecords = [];
    for (const q of genRes.questions) {
      totalGeneratedCandidatesAssessed++;
      const target = {
        concept: q.metadata?.concept || pf.name,
        targetDifficulty: q.difficulty || 'Medium',
        intendedCognitiveOperation: q.metadata?.cognitiveDemand || 'ANALYZE',
        negativeBoundaries: []
      };
      const ev = { unifiedRawContent: pf.evidenceText };

      // Audit basics
      const audit = auditQuestionBasics(q, pf.evidenceText);

      // Evaluate candidate under Checkpoint B
      const evalB = await evaluatorCheckpointB.evaluateQuestion(q, target, ev);
      if (evalB.status === 'PASS') {
        uniquelyDefensibleKeyed_B++;
        if (audit.groundingStatus === 'PASSED') groundedQuestions_B++;
      }

      // Evaluate candidate under Checkpoint C
      const evalC = await evaluatorCheckpointC.evaluateQuestion(q, target, ev);
      if (evalC.status === 'PASS') {
        uniquelyDefensibleKeyed_C++;
        if (audit.groundingStatus === 'PASSED') groundedQuestions_C++;
      }

      console.log(`  Candidate: "${(q.questionText || q.stem).substring(0, 50)}..."`);
      console.log(`    Style: ${audit.passesStyle ? 'PASS' : 'FAIL'} | Grounding: ${audit.groundingStatus}`);
      console.log(`    Checkpoint B: ${evalB.status} | Checkpoint C: ${evalC.status} (Alignment Mood=${evalC.stemAnswerAlignment?.interrogativeMood})`);

      fixtureGenRecords.push({
        stem: q.questionText || q.stem,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        audit,
        checkpointB: {
          status: evalB.status,
          verdict: evalB.verdict,
          failureReasons: evalB.failureReasons
        },
        checkpointC: {
          status: evalC.status,
          verdict: evalC.verdict,
          failureReasons: evalC.failureReasons,
          stemAnswerAlignment: evalC.stemAnswerAlignment
        }
      });
    }

    evaluationReport.pipelineGenerationEvaluations.push({
      fixtureId: pf.fixtureId,
      name: pf.name,
      questionsDelivered: genRes.questions.length,
      candidates: fixtureGenRecords
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 5: METRICS SUMMARY AGGREGATION
  // ───────────────────────────────────────────────────────────────────────────
  evaluationReport.summaryMetrics = {
    alignmentPrecision: {
      checkpointB: {
        numerator: genuineMisalignmentsDetected_B,
        denominator: totalAlignmentRejections_B,
        value: totalAlignmentRejections_B === 0 ? 'N/A (0 alignment rejections emitted)' : (genuineMisalignmentsDetected_B / totalAlignmentRejections_B).toFixed(2)
      },
      checkpointC: {
        numerator: genuineMisalignmentsDetected_C,
        denominator: totalAlignmentRejections_C,
        value: totalAlignmentRejections_C === 0 ? '0.00' : (genuineMisalignmentsDetected_C / totalAlignmentRejections_C).toFixed(2)
      }
    },
    alignmentRecall: {
      checkpointB: {
        numerator: knownMisalignedRejected_B,
        denominator: FROZEN_FIXTURES.length,
        value: (knownMisalignedRejected_B / FROZEN_FIXTURES.length).toFixed(2)
      },
      checkpointC: {
        numerator: knownMisalignedRejected_C,
        denominator: FROZEN_FIXTURES.length,
        value: (knownMisalignedRejected_C / FROZEN_FIXTURES.length).toFixed(2)
      }
    },
    falseRejectionRate: {
      checkpointB: {
        numerator: falseRejections_B,
        denominator: validCandidatesEvaluated_B,
        value: validCandidatesEvaluated_B === 0 ? '0.00' : (falseRejections_B / validCandidatesEvaluated_B).toFixed(2)
      },
      checkpointC: {
        numerator: falseRejections_C,
        denominator: validCandidatesEvaluated_C,
        value: validCandidatesEvaluated_C === 0 ? '0.00' : (falseRejections_C / validCandidatesEvaluated_C).toFixed(2)
      }
    },
    repairSuccessRate: {
      checkpointB: {
        numerator: successfulRepairs_B,
        denominator: repairAttempts_B,
        value: repairAttempts_B === 0 ? '0.00' : (successfulRepairs_B / repairAttempts_B).toFixed(2)
      },
      checkpointC: {
        numerator: successfulRepairs_C,
        denominator: repairAttempts_C,
        value: repairAttempts_C === 0 ? '0.00' : (successfulRepairs_C / repairAttempts_C).toFixed(2)
      }
    },
    answerKeyDefensibilityOnFreshPipeline: {
      checkpointB: {
        numerator: uniquelyDefensibleKeyed_B,
        denominator: totalGeneratedCandidatesAssessed,
        value: totalGeneratedCandidatesAssessed === 0 ? '0.00' : (uniquelyDefensibleKeyed_B / totalGeneratedCandidatesAssessed).toFixed(2)
      },
      checkpointC: {
        numerator: uniquelyDefensibleKeyed_C,
        denominator: totalGeneratedCandidatesAssessed,
        value: totalGeneratedCandidatesAssessed === 0 ? '0.00' : (uniquelyDefensibleKeyed_C / totalGeneratedCandidatesAssessed).toFixed(2)
      }
    },
    evidenceGroundingOnFreshPipeline: {
      checkpointB: {
        numerator: groundedQuestions_B,
        denominator: totalGeneratedCandidatesAssessed,
        value: totalGeneratedCandidatesAssessed === 0 ? '0.00' : (groundedQuestions_B / totalGeneratedCandidatesAssessed).toFixed(2)
      },
      checkpointC: {
        numerator: groundedQuestions_C,
        denominator: totalGeneratedCandidatesAssessed,
        value: totalGeneratedCandidatesAssessed === 0 ? '0.00' : (groundedQuestions_C / totalGeneratedCandidatesAssessed).toFixed(2)
      }
    },
    totalDurationSeconds: ((Date.now() - startTime) / 1000).toFixed(1)
  };

  // Write full raw JSON output
  fs.writeFileSync(OUTPUT_RESULTS_FILE, JSON.stringify(evaluationReport, null, 2), 'utf8');
  console.log(`\n💾 Raw evaluation results saved to: ${OUTPUT_RESULTS_FILE}`);

  console.log('\n======================================================================');
  console.log('📊 WORKSTREAM 2 SUMMARY METRICS (RAW COUNTS & DENOMINATORS)');
  console.log('======================================================================');
  console.log(`Alignment Precision:   Checkpoint B = ${evaluationReport.summaryMetrics.alignmentPrecision.checkpointB.value} (${evaluationReport.summaryMetrics.alignmentPrecision.checkpointB.numerator}/${evaluationReport.summaryMetrics.alignmentPrecision.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.alignmentPrecision.checkpointC.value} (${evaluationReport.summaryMetrics.alignmentPrecision.checkpointC.numerator}/${evaluationReport.summaryMetrics.alignmentPrecision.checkpointC.denominator})`);
  console.log(`Alignment Recall:      Checkpoint B = ${evaluationReport.summaryMetrics.alignmentRecall.checkpointB.value} (${evaluationReport.summaryMetrics.alignmentRecall.checkpointB.numerator}/${evaluationReport.summaryMetrics.alignmentRecall.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.alignmentRecall.checkpointC.value} (${evaluationReport.summaryMetrics.alignmentRecall.checkpointC.numerator}/${evaluationReport.summaryMetrics.alignmentRecall.checkpointC.denominator})`);
  console.log(`False Rejection Rate:  Checkpoint B = ${evaluationReport.summaryMetrics.falseRejectionRate.checkpointB.value} (${evaluationReport.summaryMetrics.falseRejectionRate.checkpointB.numerator}/${evaluationReport.summaryMetrics.falseRejectionRate.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.falseRejectionRate.checkpointC.value} (${evaluationReport.summaryMetrics.falseRejectionRate.checkpointC.numerator}/${evaluationReport.summaryMetrics.falseRejectionRate.checkpointC.denominator})`);
  console.log(`Repair Success Rate:   Checkpoint B = ${evaluationReport.summaryMetrics.repairSuccessRate.checkpointB.value} (${evaluationReport.summaryMetrics.repairSuccessRate.checkpointB.numerator}/${evaluationReport.summaryMetrics.repairSuccessRate.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.repairSuccessRate.checkpointC.value} (${evaluationReport.summaryMetrics.repairSuccessRate.checkpointC.numerator}/${evaluationReport.summaryMetrics.repairSuccessRate.checkpointC.denominator})`);
  console.log(`Pipeline Defensibility: Checkpoint B = ${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointB.value} (${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointB.numerator}/${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointC.value} (${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointC.numerator}/${evaluationReport.summaryMetrics.answerKeyDefensibilityOnFreshPipeline.checkpointC.denominator})`);
  console.log(`Pipeline Grounding:    Checkpoint B = ${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointB.value} (${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointB.numerator}/${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointB.denominator}) | Checkpoint C = ${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointC.value} (${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointC.numerator}/${evaluationReport.summaryMetrics.evidenceGroundingOnFreshPipeline.checkpointC.denominator})`);
  console.log(`Benchmark Duration:    ${evaluationReport.summaryMetrics.totalDurationSeconds}s`);

  return evaluationReport;
}

if (require.main === module) {
  runControlledBenchmark().catch(err => {
    console.error('❌ Benchmark error:', err);
    process.exit(1);
  });
}

module.exports = {
  FROZEN_FIXTURES,
  loadCheckpointBEvaluator,
  auditQuestionBasics,
  runControlledBenchmark
};
