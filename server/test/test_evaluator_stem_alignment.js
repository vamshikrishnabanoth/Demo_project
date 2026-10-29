/**
 * server/test/test_evaluator_stem_alignment.js
 *
 * Dedicated Benchmark & Contract Verification Suite for Workstream 1:
 * Agent 3 Interrogative Mood & Stem–Answer Responsiveness Alignment.
 *
 * 11 Test Fixtures:
 * - Category 1 (Negative Controls): 3 Defective Questions (NEG-01 Math U3, NEG-02 Topical Drift, NEG-03 Uninstantiated Formula)
 * - Category 2 (Positive Controls): 5 Clean Questions (POS-01 Repaired Math U3, POS-02 Polar Thread Stack, POS-03 Why Context Switch, POS-04 Which PCB, POS-05 Calculation Master Theorem Case 2)
 * - Category 3 (Contract Robustness): 3 Parser Enforcement Tests (CONTR-01 Hard Veto Override, CONTR-02 Missing Field Contract Violation, CONTR-03 Malformed Field Contract Violation)
 */

'use strict';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const llmRouter = require('../engine/adapter/llmRouter');

async function runStemAlignmentSuite() {
  console.log('======================================================================');
  console.log('🧪 RUNNING WORKSTREAM 1: AGENT 3 STEM-ANSWER ALIGNMENT SUITE');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      passedTests++;
      console.log(` ✅ PASS [${totalTests}]: ${testName}`);
    } catch (err) {
      console.error(` ❌ FAIL [${totalTests}]: ${testName}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  async function runAsyncTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      passedTests++;
      console.log(` ✅ PASS [${totalTests}]: ${testName}`);
    } catch (err) {
      console.error(` ❌ FAIL [${totalTests}]: ${testName}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  const dummyEvidence = {
    subject: 'Computer Science & Mathematics',
    topic: 'Recurrences & Systems Fundamentals',
    unifiedRawContent: 'The Master Theorem solves recurrences T(n) = aT(n/b) + f(n). In Case 2, if f(n) = Theta(n^(log_b a)), then T(n) = Theta(n^(log_b a) * log n). For recurrence T(n) = 2T(n/2) + Theta(n), we have a=2, b=2, so n^(log_2 2) = n. Since f(n) = Theta(n) matches n^(log_2 2), Case 2 applies and yields T(n) = Theta(n log n). In Case 3, if f(n) = Omega(n^(log_b a + epsilon)) and a*f(n/b) <= c*f(n) for c < 1 (regularity condition), T(n) = Theta(f(n)). For T(n) = 4T(n/2) + n^3, a=4, b=2, log_2 4 = 2, f(n) = n^3. Regularity check: 4(n/2)^3 = 4(n^3/8) = 0.5n^3 <= 0.5n^3, so c=0.5 < 1 satisfies regularity. Multithreading provides private thread stacks for function frames, while sharing the heap and code segment. The OS switches from user mode to kernel mode during system calls to safely execute privileged instructions and protect hardware resources. The Process Control Block (PCB) stores process state, program counter, and CPU registers during context switches.'
  };

  // ==========================================================================
  // CATEGORY 1: NEGATIVE CONTROLS (3 Fixtures)
  // ==========================================================================
  console.log('--- CATEGORY 1: NEGATIVE CONTROLS (Semantic Misalignment) ---');

  // NEG-01: Math U3 Defect (Polar Yes/No answered with conditional prerequisite)
  await runAsyncTest('NEG-01: Math U3 Defect - Polar question answered with general prerequisite is rejected with STEM_ANSWER_MISALIGNMENT', async () => {
    const candidateMCQ = {
      targetId: 'MATH-U3',
      questionText: 'Does the recurrence relation T(n) = 4T(n/2) + n^3 satisfy the regularity condition for Case 3 of the Master Theorem?',
      options: [
        'The regularity condition requires a*f(n/b) <= c*f(n) for some constant c < 1 and all sufficiently large n.',
        'No, because the polynomial growth rate violates the Master Theorem boundary.',
        'Yes, because the recurrence falls strictly under Case 1 where f(n) is bounded by n^(log_b a).',
        'No, because the subproblem factor b=2 cannot divide cubic work evenly.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'The regularity condition requires a*f(n/b) <= c*f(n) for some constant c < 1 and all sufficiently large n.',
      metadata: { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' }
    };

    const target = {
      targetId: 'MATH-U3',
      concept: 'Master Theorem Regularity Condition',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'FAIL',
      score: 0.35,
      verdict: 'FAIL',
      failureReasons: ['STEM_ANSWER_MISALIGNMENT'],
      failureReason: 'Stem poses polar Yes/No question, but keyed answer states general algebraic prerequisite without answering Yes/No or parameter evaluation',
      repairInstruction: 'Ensure the keyed answer directly answers the specific interrogative focus, question mood (e.g. Yes/No, Why, Which, or exact calculation), and conditions posed in the stem.',
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: false,
        interrogativeMatch: false,
        mismatchDetails: 'Keyed answer provides generic formula without identifying case',
        interrogativeMatch: false,
        mismatchDetails: 'Keyed answer describes TLB caching instead of explaining causal mode switch',
        interrogativeMatch: false,
        mismatchDetails: 'Keyed answer states prerequisite rather than answering yes/no',
        responsivenessAnalysis: 'Keyed answer states a general conditional prerequisite rather than affirmatively or negatively resolving the recurrence'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'AMBIGUOUS', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE', evaluatedCognitiveDemand: 'DIAGNOSE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'FAIL', 'Status must be FAIL');
      assert.strictEqual(evalResult.passed, false, 'Passed must be false');
      assert.ok(evalResult.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must contain STEM_ANSWER_MISALIGNMENT');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, false, 'isDirectlyResponsive must be false');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // NEG-02: Topical Drift (Explanatory Why answered by unrelated true fact)
  await runAsyncTest('NEG-02: Topical Drift - Explanatory Why question answered by unrelated true fact is rejected with STEM_ANSWER_MISALIGNMENT', async () => {
    const candidateMCQ = {
      targetId: 'OS-U1',
      questionText: 'Why does an operating system switch from user mode to kernel mode during a system call execution?',
      options: [
        'The Translation Lookaside Buffer caches recent virtual-to-physical address mappings to accelerate memory lookup operations.',
        'To execute privileged CPU instructions required to safely access hardware resources on behalf of user applications.',
        'To allow user programs direct unrestricted read and write access to peripheral device registers.',
        'To bypass page table lookups by disabling hardware interrupt handling during system execution.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'The Translation Lookaside Buffer caches recent virtual-to-physical address mappings to accelerate memory lookup operations.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };

    const target = {
      targetId: 'OS-U1',
      concept: 'User Mode vs Kernel Mode',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'FAIL',
      score: 0.30,
      verdict: 'FAIL',
      failureReasons: ['STEM_ANSWER_MISALIGNMENT'],
      failureReason: 'Keyed answer describes TLB caching instead of explaining the causal reason for privilege mode transition',
      repairInstruction: 'Ensure the keyed answer directly answers the specific interrogative focus, question mood (e.g. Yes/No, Why, Which, or exact calculation), and conditions posed in the stem.',
      stemAnswerAlignment: {
        interrogativeMood: 'EXPLANATORY_WHY',
        isDirectlyResponsive: false,
        responsivenessAnalysis: 'Keyed answer is an unrelated true statement about TLB caching rather than answering why kernel mode transition occurs'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'AMBIGUOUS', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', evaluatedCognitiveDemand: 'COMPARE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'FAIL', 'Status must be FAIL');
      assert.strictEqual(evalResult.passed, false, 'Passed must be false');
      assert.ok(evalResult.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must contain STEM_ANSWER_MISALIGNMENT');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, false, 'isDirectlyResponsive must be false');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // NEG-03: Uninstantiated Formula (Specific identification Which answered with abstract definition)
  await runAsyncTest('NEG-03: Uninstantiated Formula - Specific Which question answered with generic formula definition is rejected with STEM_ANSWER_MISALIGNMENT', async () => {
    const candidateMCQ = {
      targetId: 'MATH-U4',
      questionText: 'Which case of the Master Theorem applies to the recurrence T(n) = 8T(n/2) + Theta(n^2)?',
      options: [
        'The Master Theorem evaluates divide-and-conquer recurrences of the form T(n) = aT(n/b) + f(n) by comparing f(n) against n^(log_b a).',
        'Case 1, because n^(log_2 8) = n^3, so f(n) = Theta(n^2) = O(n^(3-1)).',
        'Case 2, because f(n) matches n^(log_b a) within logarithmic factors.',
        'Case 3, because f(n) dominates recursive work asymptotically.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'The Master Theorem evaluates divide-and-conquer recurrences of the form T(n) = aT(n/b) + f(n) by comparing f(n) against n^(log_b a).',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };

    const target = {
      targetId: 'MATH-U4',
      concept: 'Master Theorem Case Identification',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'FAIL',
      score: 0.30,
      verdict: 'FAIL',
      failureReasons: ['STEM_ANSWER_MISALIGNMENT'],
      failureReason: 'Keyed answer provides the general theorem definition without identifying which case applies to the given recurrence',
      repairInstruction: 'Ensure the keyed answer directly answers the specific interrogative focus, question mood (e.g. Yes/No, Why, Which, or exact calculation), and conditions posed in the stem.',
      stemAnswerAlignment: {
        interrogativeMood: 'IDENTIFICATION_WHICH',
        isDirectlyResponsive: false,
        responsivenessAnalysis: 'Keyed answer fails to identify which case applies to T(n) = 8T(n/2) + Theta(n^2)'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'AMBIGUOUS', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', evaluatedCognitiveDemand: 'COMPARE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'FAIL', 'Status must be FAIL');
      assert.strictEqual(evalResult.passed, false, 'Passed must be false');
      assert.ok(evalResult.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must contain STEM_ANSWER_MISALIGNMENT');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, false, 'isDirectlyResponsive must be false');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // ==========================================================================
  // CATEGORY 2: POSITIVE CONTROLS (5 Fixtures)
  // ==========================================================================
  console.log('\n--- CATEGORY 2: POSITIVE CONTROLS (Responsive Questions Accepted Cleanly) ---');

  // POS-01: Repaired Math U3 Fixture (Direct parameter calculation)
  await runAsyncTest('POS-01: Repaired Math U3 - Polar question with direct parameter calculation is ACCEPTED cleanly', async () => {
    const candidateMCQ = {
      targetId: 'MATH-U3-REPAIRED',
      questionText: 'Does the recurrence relation T(n) = 4T(n/2) + n^3 satisfy the regularity condition for Case 3 of the Master Theorem?',
      options: [
        'Yes, because 4(n/2)^3 = 0.5n^3 <= c*n^3 holds for constant c = 0.5 < 1.',
        'No, because n^(log_2 4) = n^2 strictly dominates f(n) = n^3.',
        'No, because the regularity condition requires constant c > 1.',
        'Yes, because every polynomial function automatically satisfies regularity without parameter evaluation.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'Yes, because 4(n/2)^3 = 0.5n^3 <= c*n^3 holds for constant c = 0.5 < 1.',
      metadata: { targetDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE' }
    };

    const target = {
      targetId: 'MATH-U3-REPAIRED',
      concept: 'Master Theorem Regularity Condition',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'PASS',
      score: 0.95,
      verdict: 'PASS',
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: true,
        interrogativeMatch: true,
        mismatchDetails: null,
        interrogativeMatch: true,
        mismatchDetails: null,
        interrogativeMatch: true,
        mismatchDetails: null,
        interrogativeMatch: true,
        mismatchDetails: null,
        interrogativeMatch: true,
        mismatchDetails: null,
        responsivenessAnalysis: 'Keyed answer directly provides affirmative Yes and evaluates 4(n/2)^3 = 0.5n^3 <= c*n^3 with c=0.5 < 1'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'VALID_KEY', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Hard', intendedCognitiveOperation: 'DIAGNOSE', evaluatedCognitiveDemand: 'DIAGNOSE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'PASS', 'Status must be PASS');
      assert.strictEqual(evalResult.passed, true, 'Passed must be true');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, true, 'isDirectlyResponsive must be true');
      assert.strictEqual(evalResult.stemAnswerAlignment.interrogativeMood, 'POLAR_YES_NO');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // POS-02: Polar Question (User Thread Private Stack)
  await runAsyncTest('POS-02: Polar Question - User thread private stack accepted cleanly', async () => {
    const candidateMCQ = {
      targetId: 'OS-POS-02',
      questionText: 'Does each user thread maintain its own private execution stack in a multithreaded process?',
      options: [
        'Yes, each thread requires its own private stack to track independent function calls, local variables, and return addresses.',
        'No, all threads within a process share a single contiguous execution stack managed by the kernel.',
        'No, thread execution state is stored exclusively in hardware registers without memory allocation.',
        'Yes, because threads cannot share the process address space or heap memory.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'Yes, each thread requires its own private stack to track independent function calls, local variables, and return addresses.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };

    const target = {
      targetId: 'OS-POS-02',
      concept: 'Thread Execution Stack',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'PASS',
      score: 0.95,
      verdict: 'PASS',
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: true,
        interrogativeMatch: true,
        mismatchDetails: null,
        responsivenessAnalysis: 'Direct affirmative response with accurate architectural rationale'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'VALID_KEY', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', evaluatedCognitiveDemand: 'COMPARE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'PASS', 'Status must be PASS');
      assert.strictEqual(evalResult.passed, true, 'Passed must be true');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, true);
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // POS-03: Explanatory Why Question (Kernel Mode Transition)
  await runAsyncTest('POS-03: Explanatory Why - Kernel mode transition rationale accepted cleanly', async () => {
    const candidateMCQ = {
      targetId: 'OS-POS-03',
      questionText: 'Why must a CPU switch to kernel mode before executing privileged I/O instructions?',
      options: [
        'To prevent unauthorized user programs from directly corrupting shared hardware resources and memory spaces.',
        'Because the hardware arithmetic logic unit operates exclusively in kernel mode.',
        'To accelerate memory access speeds by bypassing CPU cache invalidation cycles.',
        'Because user-mode registers cannot store 64-bit integer values.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'To prevent unauthorized user programs from directly corrupting shared hardware resources and memory spaces.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };

    const target = {
      targetId: 'OS-POS-03',
      concept: 'Privileged Mode Protection',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'PASS',
      score: 0.95,
      verdict: 'PASS',
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      stemAnswerAlignment: {
        interrogativeMood: 'EXPLANATORY_WHY',
        isDirectlyResponsive: true,
        interrogativeMatch: true,
        mismatchDetails: null,
        responsivenessAnalysis: 'Directly explains the hardware protection reason for kernel mode privilege'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'VALID_KEY', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', evaluatedCognitiveDemand: 'COMPARE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'PASS', 'Status must be PASS');
      assert.strictEqual(evalResult.passed, true, 'Passed must be true');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, true);
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // POS-04: Specific Identification Which Question (Process Control Block)
  await runAsyncTest('POS-04: Specific Identification Which - Process Control Block accepted cleanly', async () => {
    const candidateMCQ = {
      targetId: 'OS-POS-04',
      questionText: 'Which operating system kernel structure stores the program counter, register values, and scheduling state during a process context switch?',
      options: [
        'Process Control Block (PCB)',
        'Translation Lookaside Buffer (TLB)',
        'Interrupt Descriptor Table (IDT)',
        'Page Table Entry (PTE)'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'Process Control Block (PCB)',
      metadata: { targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL' }
    };

    const target = {
      targetId: 'OS-POS-04',
      concept: 'Process Control Block',
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'PASS',
      score: 0.95,
      verdict: 'PASS',
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      stemAnswerAlignment: {
        interrogativeMood: 'IDENTIFICATION_WHICH',
        isDirectlyResponsive: true,
        interrogativeMatch: true,
        mismatchDetails: null,
        responsivenessAnalysis: 'Directly names the exact kernel structure queried'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'VALID_KEY', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL', evaluatedCognitiveDemand: 'RECALL', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'PASS', 'Status must be PASS');
      assert.strictEqual(evalResult.passed, true, 'Passed must be true');
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // POS-05: Calculation / Parameter-Bound Question (Master Theorem Case 2)
  await runAsyncTest('POS-05: Calculation / Parameter-Bound - Master Theorem Case 2 complexity accepted cleanly', async () => {
    const candidateMCQ = {
      targetId: 'MATH-POS-05',
      questionText: 'How does the asymptotic complexity of T(n) = 2T(n/2) + Theta(n) compare under the Master Theorem?',
      options: [
        'Theta(n log n), because f(n) = Theta(n^(log_2 2)) = Theta(n) matches Case 2.',
        'Theta(n), because the root combination cost dominates the recursion tree.',
        'Theta(n^2), because Case 1 applies with polynomial acceleration.',
        'Theta(log n), because divide-and-conquer halves work at each level.'
      ],
      correctAnswerIndex: 0,
      correctAnswer: 'Theta(n log n), because f(n) = Theta(n^(log_2 2)) = Theta(n) matches Case 2.',
      metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
    };

    const target = {
      targetId: 'MATH-POS-05',
      concept: 'Master Theorem Case 2 Asymptotics',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    };

    const originalComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      status: 'PASS',
      score: 0.95,
      verdict: 'PASS',
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      stemAnswerAlignment: {
        interrogativeMood: 'CALCULATION',
        isDirectlyResponsive: true,
        interrogativeMatch: true,
        mismatchDetails: null,
        responsivenessAnalysis: 'Directly computes the complexity and proves Case 2 match'
      },
      optionAnalysis: [
        { slot: 'A', text: candidateMCQ.options[0], isKey: true, verdict: 'VALID_KEY', distractorPlausibility: 'N/A' },
        { slot: 'B', text: candidateMCQ.options[1], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'C', text: candidateMCQ.options[2], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
        { slot: 'D', text: candidateMCQ.options[3], isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
      ],
      cognitiveAudit: { requestedDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE', evaluatedCognitiveDemand: 'COMPARE', isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95, foreignDomainDetected: false }
    });

    try {
      const evalResult = await agent3Evaluator.evaluateQuestion(candidateMCQ, target, dummyEvidence);
      assert.strictEqual(evalResult.status, 'PASS', 'Status must be PASS');
      assert.strictEqual(evalResult.passed, true, 'Passed must be true');
      assert.strictEqual(evalResult.stemAnswerAlignment.isDirectlyResponsive, true);
    } finally {
      llmRouter.complete = originalComplete;
    }
  });

  // ==========================================================================
  // CATEGORY 3: CONTRACT ROBUSTNESS TESTS (3 Fixtures)
  // Direct Production Execution: _parseAndEnforceEvaluationResponse(...)
  // ==========================================================================
  console.log('\n--- CATEGORY 3: CONTRACT ROBUSTNESS & PARSER ENFORCEMENT ---');

  const baselineCandidate = {
    questionText: 'Is the page table stored in main memory?',
    options: ['Yes, in kernel memory', 'No, in CPU registers', 'No, on magnetic disk', 'Yes, in L1 cache'],
    correctAnswer: 'Yes, in kernel memory',
    metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
  };
  const baselineTarget = { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' };
  const cleanPreAudit = { passed: true, failureReasons: [], score: 0.95 };

  // CONTR-01: Contradictory Status Hard Veto
  runTest('CONTR-01: Hard Veto Override - Model returned status PASS but isDirectlyResponsive false -> Overridden to FAIL with STEM_ANSWER_MISALIGNMENT', () => {
    const contradictoryResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: false,
        interrogativeMatch: false,
        responsivenessAnalysis: 'Model contradicts itself: marked pass but key is unresponsive',
        mismatchDetails: 'Keyed answer does not resolve polar question'
      },
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(contradictoryResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'Hard veto must override status to FAIL');
    assert.strictEqual(enforced.passed, false, 'Hard veto must override passed to false');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Hard veto must override verdict to FAIL');
    assert.ok(enforced.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must contain STEM_ANSWER_MISALIGNMENT');
    assert.ok(!enforced.failureReasons.includes('EVALUATION_CONTRACT_VIOLATION'), 'Must NOT contain contract violation for valid semantic diagnosis');
  });

  // CONTR-01b: Approved Specification Format (interrogativeMatch false, mismatchDetails)
  runTest('CONTR-01b: Approved Spec Schema - interrogativeMatch false & mismatchDetails triggers STEM_ANSWER_MISALIGNMENT', () => {
    const specResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      stemAnswerAlignment: {
        isDirectlyResponsive: true,
        interrogativeMatch: false,
        mismatchDetails: 'Keyed option describes prerequisite rather than matching polar interrogative mood'
      },
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(specResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'interrogativeMatch false must override status to FAIL');
    assert.strictEqual(enforced.passed, false, 'interrogativeMatch false must override passed to false');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Verdict must be FAIL');
    assert.ok(enforced.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must contain STEM_ANSWER_MISALIGNMENT');
    assert.ok(enforced.failureReason.includes('Keyed option describes prerequisite'), 'Failure reason must reflect mismatchDetails');
  });

  // CONTR-02: Missing stemAnswerAlignment Record -> Fail-Closed Contract Violation
  runTest('CONTR-02: Missing Field Contract Violation - Model omitted stemAnswerAlignment record -> Fails closed with EVALUATION_CONTRACT_VIOLATION', () => {
    const missingFieldResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      // stemAnswerAlignment deliberately omitted
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(missingFieldResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'Missing contract field must fail closed to FAIL');
    assert.strictEqual(enforced.passed, false, 'Missing contract field must fail closed');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Verdict must be FAIL');
    assert.ok(enforced.failureReasons.includes('EVALUATION_CONTRACT_VIOLATION'), 'Must contain EVALUATION_CONTRACT_VIOLATION');
    assert.ok(!enforced.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must NOT conflate missing field with semantic misalignment');
  });

  // CONTR-03: Malformed stemAnswerAlignment Record -> Fail-Closed Contract Violation
  runTest('CONTR-03: Malformed Field Contract Violation - isDirectlyResponsive non-boolean -> Fails closed with EVALUATION_CONTRACT_VIOLATION', () => {
    const malformedFieldResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: 'not_a_boolean', // Malformed!
        responsivenessAnalysis: 'String instead of boolean'
      },
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(malformedFieldResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'Malformed contract field must fail closed to FAIL');
    assert.strictEqual(enforced.passed, false, 'Malformed contract field must fail closed');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Verdict must be FAIL');
    assert.ok(enforced.failureReasons.includes('EVALUATION_CONTRACT_VIOLATION'), 'Must contain EVALUATION_CONTRACT_VIOLATION');
    assert.ok(!enforced.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must NOT conflate malformed field with semantic misalignment');
  });

  // CONTR-04: Missing interrogativeMatch Field -> Fail-Closed Contract Violation
  runTest('CONTR-04: Missing interrogativeMatch Field - Model omitted interrogativeMatch -> Fails closed with EVALUATION_CONTRACT_VIOLATION', () => {
    const missingMatchResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: true,
        // interrogativeMatch deliberately omitted!
        responsivenessAnalysis: 'Direct affirmative'
      },
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(missingMatchResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'Missing interrogativeMatch must fail closed to FAIL');
    assert.strictEqual(enforced.passed, false, 'Missing interrogativeMatch must fail closed');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Verdict must be FAIL');
    assert.ok(enforced.failureReasons.includes('EVALUATION_CONTRACT_VIOLATION'), 'Must contain EVALUATION_CONTRACT_VIOLATION');
    assert.ok(enforced.failureReason.includes('interrogativeMatch must be boolean'), 'Failure reason must cite interrogativeMatch');
  });

  // CONTR-05: Malformed interrogativeMatch Field -> Fail-Closed Contract Violation
  runTest('CONTR-05: Malformed interrogativeMatch Field - interrogativeMatch is non-boolean -> Fails closed with EVALUATION_CONTRACT_VIOLATION', () => {
    const malformedMatchResponse = JSON.stringify({
      status: 'PASS',
      verdict: 'PASS',
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      stemAnswerAlignment: {
        interrogativeMood: 'POLAR_YES_NO',
        isDirectlyResponsive: true,
        interrogativeMatch: 'false', // Malformed string instead of boolean!
        responsivenessAnalysis: 'Non-boolean value'
      },
      optionAnalysis: [],
      cognitiveAudit: { isCalibrated: true },
      evidenceGrounding: { tier: 'DIRECT_EVIDENCE', groundingScore: 0.95 }
    });

    const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(malformedMatchResponse, cleanPreAudit, baselineCandidate, baselineTarget);
    assert.strictEqual(enforced.status, 'FAIL', 'Malformed interrogativeMatch must fail closed to FAIL');
    assert.strictEqual(enforced.passed, false, 'Malformed interrogativeMatch must fail closed');
    assert.strictEqual(enforced.verdict, 'FAIL', 'Verdict must be FAIL');
    assert.ok(enforced.failureReasons.includes('EVALUATION_CONTRACT_VIOLATION'), 'Must contain EVALUATION_CONTRACT_VIOLATION');
    assert.ok(!enforced.failureReasons.includes('STEM_ANSWER_MISALIGNMENT'), 'Must NOT conflate string with boolean false');
    assert.ok(enforced.failureReason.includes('interrogativeMatch must be boolean'), 'Failure reason must cite interrogativeMatch');
  });

  // REPAIR SYNTHESIS CHECK: Ensure _synthesizeRepairInstruction incorporates stem responsiveness
  runTest('REPAIR-01: Repair Instruction Synthesis incorporates stem responsiveness for STEM_ANSWER_MISALIGNMENT', () => {
    const repairInst = agent3Evaluator._synthesizeRepairInstruction(['STEM_ANSWER_MISALIGNMENT'], baselineCandidate, baselineTarget);
    assert.ok(repairInst.includes('interrogative focus'), 'Repair instruction must guide interrogative focus');
    assert.ok(repairInst.includes('question mood'), 'Repair instruction must guide question mood');
  });

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');
}

runStemAlignmentSuite().catch(err => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
