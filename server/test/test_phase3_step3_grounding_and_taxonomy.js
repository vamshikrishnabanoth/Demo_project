/**
 * server/test/test_phase3_step3_grounding_and_taxonomy.js
 *
 * PHASE 3, STEP 3 FOCUSED VERIFICATION SUITE:
 * 1. T04 Adversarial Relational Grounding Rejection (Gate & Evaluator emit UNGROUNDED_RELATIONAL_CLAIM)
 * 2. Legitimate Biology Questions Pass Relational Grounding
 * 3. T07 Boundary Enforcement Alignment (Gate & Evaluator emit TEACHER_BOUNDARY_VIOLATION)
 * 4. Legitimate Conceptual Question under NO_CODE Passes Both Evaluator and Gate
 * 5. Factual Contradiction Detection (FACTUAL_CONTRADICTION)
 * 6. Cross-Clause Fabricated Causality Rejection
 * 7. Evidence Telemetry Traceability (operationEvidenceTrail)
 * 8. Error Taxonomy Consistency
 */

'use strict';

const assert = require('assert');
const groundingGate = require('../engine/validators/groundingGate');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');

console.log('======================================================================');
console.log('🧪 PHASE 3, STEP 3: RELATIONAL GROUNDING & UNIFIED TAXONOMY SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    throw err;
  }
}

async function runSuite() {
  // -------------------------------------------------------------------------
  // Test 1: T04 Adversarial Relational Grounding Rejection in Final Gate
  // -------------------------------------------------------------------------
  await test('T04: Adversarial false relation rejected with UNGROUNDED_RELATIONAL_CLAIM by Grounding Gate', () => {
    const rawTranscript = [
      'During cell division in eukaryotic cells, mitosis ensures equal distribution of duplicated genetic material.',
      'In the early stages of mitosis, chromosomes condense in the nucleus to allow orderly separation.',
      'Meanwhile, in separate cellular organelles, mitochondria generate ATP through oxidative phosphorylation to supply metabolic energy.'
    ].join(' ');

    const adversarialMCQ = {
      questionText: 'During mitosis, why do condensed chromosomes directly synthesize ATP in the nucleus?',
      options: [
        'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation',
        'Because chromosomes lack DNA during mitosis',
        'Because ATP is only consumed in the cytoplasm',
        'Because mitochondria dissolve during prophase'
      ],
      correctAnswer: 'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation'
    };

    const gateResult = groundingGate.verifyQuizGrounding([adversarialMCQ], {
      unifiedRawContent: rawTranscript
    });

    assert.strictEqual(gateResult.status, 'FAILED', 'Grounding Gate must reject adversarial question');
    assert.strictEqual(gateResult.rejectedCount, 1);
    assert(gateResult.reasons.some(r => r.includes('UNGROUNDED_RELATIONAL_CLAIM')),
      `Expected reason to include UNGROUNDED_RELATIONAL_CLAIM, got: ${gateResult.reasons.join(', ')}`);
  });

  // -------------------------------------------------------------------------
  // Test 2: T04 Adversarial Rejection in Agent 3 Evaluator
  // -------------------------------------------------------------------------
  await test('T04: Adversarial false relation rejected with UNGROUNDED_RELATIONAL_CLAIM by Agent 3 Evaluator', async () => {
    const rawTranscript = [
      'During cell division in eukaryotic cells, mitosis ensures equal distribution of duplicated genetic material.',
      'In the early stages of mitosis, chromosomes condense in the nucleus to allow orderly separation.',
      'Meanwhile, in separate cellular organelles, mitochondria generate ATP through oxidative phosphorylation to supply metabolic energy.'
    ].join(' ');

    const adversarialMCQ = {
      questionText: 'During mitosis, why do condensed chromosomes directly synthesize ATP in the nucleus?',
      options: [
        'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation',
        'Because chromosomes lack DNA during mitosis',
        'Because ATP is only consumed in the cytoplasm',
        'Because mitochondria dissolve during prophase'
      ],
      correctAnswer: 'Because chromosome condensation in the nucleus accelerates mitochondrial oxidative phosphorylation'
    };

    const target = {
      concept: 'Cell Division',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const evalResult = await agent3Evaluator.evaluateQuestion(adversarialMCQ, target, {
      unifiedRawContent: rawTranscript
    });

    assert.strictEqual(evalResult.status, 'FAIL', 'Agent 3 Evaluator must fail adversarial question');
    assert(evalResult.failureReasons.includes('UNGROUNDED_RELATIONAL_CLAIM'),
      `Expected failureReasons to include UNGROUNDED_RELATIONAL_CLAIM, got: ${evalResult.failureReasons.join(', ')}`);
  });

  // -------------------------------------------------------------------------
  // Test 3: Legitimate Biology Questions Pass Relational Grounding
  // -------------------------------------------------------------------------
  await test('Legitimate Biology Questions Pass Relational Grounding Gate', () => {
    const rawTranscript = [
      'During cell division in eukaryotic cells, mitosis ensures equal distribution of duplicated genetic material.',
      'In the early stages of mitosis, chromosomes condense in the nucleus to allow orderly separation.',
      'Meanwhile, in separate cellular organelles, mitochondria generate ATP through oxidative phosphorylation to supply metabolic energy.'
    ].join(' ');

    const legitMitoQ = {
      questionText: 'Where does oxidative phosphorylation generate ATP according to the lecture?',
      options: [
        'In mitochondria located in separate cellular organelles',
        'Inside the condensed chromosomes',
        'Within the nucleus during mitosis',
        'In ribosomal subunits'
      ],
      correctAnswer: 'In mitochondria located in separate cellular organelles'
    };

    const legitChromQ = {
      questionText: 'Why do chromosomes condense in the nucleus during early mitosis?',
      options: [
        'To allow orderly separation of duplicated genetic material',
        'To accelerate mitochondrial oxidative phosphorylation',
        'To directly synthesize ATP for cell division',
        'To dissolve the nuclear envelope'
      ],
      correctAnswer: 'To allow orderly separation of duplicated genetic material'
    };

    const resMito = groundingGate.verifyQuizGrounding([legitMitoQ], { unifiedRawContent: rawTranscript });
    assert.strictEqual(resMito.status, 'PASSED', 'Legitimate mitochondrial question must pass');
    assert.strictEqual(resMito.validatedQuestions.length, 1);

    const resChrom = groundingGate.verifyQuizGrounding([legitChromQ], { unifiedRawContent: rawTranscript });
    assert.strictEqual(resChrom.status, 'PASSED', 'Legitimate chromosome question must pass');
    assert.strictEqual(resChrom.validatedQuestions.length, 1);
  });

  // -------------------------------------------------------------------------
  // Test 4: T07 Boundary Enforcement Alignment (C Code under NO_CODE)
  // -------------------------------------------------------------------------
  await test('T07: C Code under NO_CODE rejected with TEACHER_BOUNDARY_VIOLATION in Gate and Agent 3', async () => {
    const fixtureT07 = [
      'Today we are discussing Process Scheduling algorithms in operating systems.',
      'Do not worry about coding, implementation syntax is strictly outside our syllabus, and there will be zero coding questions on the exam.',
      'A preemptive scheduler pauses the running process when a higher-priority process arrives, saving its state in the PCB.'
    ].join('\n');

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

    const target = {
      concept: 'Process Scheduling',
      targetDifficulty: 'Medium',
      negativeBoundaries: ['NO_CODE']
    };

    const gateRes = groundingGate.verifyQuizGrounding([candidateCodeMCQ], {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    assert.strictEqual(gateRes.status, 'FAILED', 'Grounding Gate must fail code under NO_CODE');
    assert(gateRes.reasons.some(r => r.includes('TEACHER_BOUNDARY_VIOLATION')),
      `Grounding gate must record TEACHER_BOUNDARY_VIOLATION, got: ${gateRes.reasons.join(', ')}`);

    const agent3Res = await agent3Evaluator.evaluateQuestion(candidateCodeMCQ, target, {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    assert.strictEqual(agent3Res.status, 'FAIL', 'Agent 3 Evaluator must fail code under NO_CODE');
    assert(agent3Res.failureReasons.includes('TEACHER_BOUNDARY_VIOLATION'),
      `Agent 3 must record TEACHER_BOUNDARY_VIOLATION, got: ${agent3Res.failureReasons.join(', ')}`);
  });

  // -------------------------------------------------------------------------
  // Test 5: Legitimate Conceptual Question under NO_CODE Passes Both
  // -------------------------------------------------------------------------
  await test('Legitimate Conceptual OS Question under NO_CODE passes Gate and Agent 3', async () => {
    const fixtureT07 = [
      'Today we are discussing Process Scheduling algorithms in operating systems.',
      'Do not worry about coding, implementation syntax is strictly outside our syllabus, and there will be zero coding questions on the exam.',
      'A preemptive scheduler pauses the running process when a higher-priority process arrives, saving its state in the PCB.'
    ].join('\n');

    const conceptualMCQ = {
      questionText: 'How does a preemptive scheduler handle the arrival of a higher-priority process?',
      options: [
        'It pauses the running process and saves its state in the PCB',
        'It terminates the running process immediately',
        'It ignores the higher-priority process until the current process completes',
        'It allocates virtual memory pages to secondary storage'
      ],
      correctAnswer: 'It pauses the running process and saves its state in the PCB'
    };

    const target = {
      concept: 'Process Scheduling',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE',
      negativeBoundaries: ['NO_CODE']
    };

    const gateRes = groundingGate.verifyQuizGrounding([conceptualMCQ], {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    assert.strictEqual(gateRes.status, 'PASSED', 'Conceptual question must pass grounding gate under NO_CODE');

    const agent3Res = await agent3Evaluator.evaluateQuestion(conceptualMCQ, target, {
      unifiedRawContent: fixtureT07,
      negativeBoundaries: ['NO_CODE']
    });

    assert.strictEqual(agent3Res.status, 'PASS', 'Conceptual question must pass Agent 3 under NO_CODE');
  });

  // -------------------------------------------------------------------------
  // Test 6: Factual Contradiction Detection
  // -------------------------------------------------------------------------
  await test('Factual Contradiction on mutually exclusive properties detected with FACTUAL_CONTRADICTION', () => {
    const dsaEvidence = [
      'A stack is defined as a Last-In First-Out linear data structure where elements are pushed and popped from the top.',
      'In contrast, a queue is defined as a First-In First-Out linear data structure where elements are enqueued at the rear.'
    ].join(' ');

    const contradictoryMCQ = {
      questionText: 'Why is a stack defined as a First-In First-Out data structure?',
      options: [
        'Because elements are removed in FIFO order',
        'Because elements are popped from the bottom',
        'Because stacks use heap memory',
        'Because stacks do not have tops'
      ],
      correctAnswer: 'Because elements are removed in FIFO order'
    };

    const gateRes = groundingGate.verifyQuizGrounding([contradictoryMCQ], {
      unifiedRawContent: dsaEvidence
    });

    assert.strictEqual(gateRes.status, 'FAILED', 'Contradictory question must fail gate');
    assert(gateRes.reasons.some(r => r.includes('FACTUAL_CONTRADICTION')),
      `Expected reason to include FACTUAL_CONTRADICTION, got: ${gateRes.reasons.join(', ')}`);
  });

  // -------------------------------------------------------------------------
  // Test 7: Evidence Telemetry Traceability (operationEvidenceTrail)
  // -------------------------------------------------------------------------
  await test('Evidence Telemetry Trail records credited reasoning operations without inflation', () => {
    // Math proof fixture (Op 4)
    const fixtureMath = [
      'Let f be a function continuous on [a, b] and differentiable on (a, b) with f(a) = f(b).',
      'By the Extreme Value Theorem, f attains an absolute maximum and minimum on [a, b].',
      'If the extrema occur at an interior point c, then by Fermat\'s Theorem, derivative f\'(c) equals zero.',
      'Hence there exists at least one point c such that f\'(c) = 0.'
    ].join(' ');

    const fallbackMath = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureMath });
    assert(fallbackMath.evidenceCapacity.capacityByDifficulty.hard >= 1, 'Math proof must yield Hard capacity');
    assert(Array.isArray(fallbackMath.operationEvidenceTrail), 'operationEvidenceTrail must be an array');
    assert(fallbackMath.operationEvidenceTrail.length > 0, 'operationEvidenceTrail must record credited operations');
    const mathOp = fallbackMath.operationEvidenceTrail.find(e => e.operationId === 'OP_4_FORMAL_DERIVATION');
    assert(mathOp, 'Math proof must record OP_4_FORMAL_DERIVATION in evidence trail');
    assert.strictEqual(mathOp.decision, 'CREDITED_HARD_CAPACITY');
    assert(Array.isArray(mathOp.transcriptAnchors) && mathOp.transcriptAnchors.length > 0,
      'Evidence trail must include genuine transcript anchors');

    // Keats Literary Critique fixture (Op 6)
    const fixtureLit = [
      'In Keats\'s Ode on a Grecian Urn, the speaker examines the paradoxical nature of artistic immortality.',
      'The carved lovers depicted on the marble urn remain frozen in perpetual anticipation.',
      'Through this stark juxtaposition, Keats constructs a critique of pure aestheticism.'
    ].join(' ');

    const fallbackLit = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureLit });
    assert(fallbackLit.evidenceCapacity.capacityByDifficulty.hard >= 1, 'Literary critique must yield Hard capacity');
    const litOp = fallbackLit.operationEvidenceTrail.find(e => e.operationId === 'OP_6_INTERPRETIVE_CRITIQUE');
    assert(litOp, 'Literary critique must record OP_6_INTERPRETIVE_CRITIQUE in evidence trail');
    assert.strictEqual(litOp.decision, 'CREDITED_HARD_CAPACITY');

    // Descriptive text fixture (Zero Hard capacity)
    const fixtureDescriptive = [
      'Hypertext Transfer Protocol is an application-layer protocol used for transmitting hypermedia documents.',
      'Uniform Resource Identifier is a unique sequence of characters that identifies a logical or physical resource.'
    ].join(' ');

    const fallbackDesc = lectureIntelligence.buildPartialFallback({ evidenceText: fixtureDescriptive });
    assert.strictEqual(fallbackDesc.evidenceCapacity.capacityByDifficulty.hard, 0, 'Descriptive text must have 0 Hard capacity');
    assert.strictEqual(fallbackDesc.operationEvidenceTrail.length, 0, 'Descriptive text must have empty operationEvidenceTrail');
  });

  // -------------------------------------------------------------------------
  // Test 8: Error Taxonomy Invariant
  // -------------------------------------------------------------------------
  await test('Evaluator failure codes contain all canonical error taxonomy members', () => {
    const expectedTaxonomy = [
      'TEACHER_BOUNDARY_VIOLATION',
      'UNGROUNDED_RELATIONAL_CLAIM',
      'FACTUAL_CONTRADICTION',
      'UNGROUNDED_EVIDENCE_CLAIM',
      'FOREIGN_DOMAIN_CONTAMINATION',
      'TIER_COGNITIVE_MISMATCH',
      'AMBIGUOUS_DISTRACTOR',
      'INSUFFICIENT_EVIDENCE_FOR_HARD'
    ];

    for (const code of expectedTaxonomy) {
      assert(agent3Evaluator.FAILURE_CODES[code] === code,
        `agent3Evaluator.FAILURE_CODES must include ${code}`);
    }
  });

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');
}

runSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
