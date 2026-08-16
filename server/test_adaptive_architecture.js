/**
 * server/test_adaptive_architecture.js
 *
 * Golden Regression Test Suite for Adaptive Policy-Driven Assessment Architecture (v1.1):
 * Tests:
 * 1. Multi-Signal Evidence Depth & Capacity Estimation
 * 2. Natural Subtopic Extraction & Adaptive Allocation
 * 3. 3-Zone Pedagogical Redundancy (Similarity is Signal, Not Verdict)
 * 4. 5-Tier Derivability Model & Foreign Domain Protection
 * 5. Full End-to-End Pipeline Execution with Question Decision Ledger
 */

'use strict';

const evidencePackager = require('./engine/evidence/evidencePackager');
const deterministicValidator = require('./engine/validators/deterministicValidator');
const groundingGate = require('./engine/validators/groundingGate');
const pipelineOrchestrator = require('./engine/pipelineOrchestrator');

async function runGoldenTests() {
  console.log('🧪 Starting Golden Regression Test Suite (v1.1 Adaptive Architecture)...\n');
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Multi-Signal Evidence Depth & Hard Zero Capacity
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Test 1: Multi-Signal Evidence Depth & Hard Zero Capacity ---');
  const shallowInput = {
    voiceTranscript: 'A tokenizer converts raw text into distinct tokens.'
  };
  const shallowEvidence = evidencePackager.packageSessionEvidence(shallowInput);
  assert(shallowEvidence.evidenceDepth.rating === 'SHALLOW' || shallowEvidence.evidenceDepth.depthScore < 50, 'Brief 1-sentence transcript correctly assessed as Shallow depth');
  assert(shallowEvidence.categoryWeights.FORMULAS_AND_CALCULATIONS === 0.0, 'Strict Hard Zero applied: Formulas = 0.0% when 0 formulas exist');
  assert(shallowEvidence.evidenceCapacity.totalCapacity > 0, 'Legitimate evidence capacity computed upfront');

  const deepInput = {
    voiceTranscript: 'Interrupts allow the CPU to perform other operations while I/O completes. When an I/O device finishes, it asserts an interrupt request line. The processor finishes the current instruction execution cycle, saves its program counter and register state onto the stack, and loads the interrupt vector table address corresponding to the interrupt service routine (ISR). After servicing the device, the processor restores registers and resumes normal execution. Compared to polling, interrupt-based I/O minimizes CPU idle waiting time. Status flag bits indicate whether interrupts are currently masked or pending.',
    codeSnippets: 'void interrupt_handler() { disable_interrupts(); save_context(); service_io(); enable_interrupts(); iret(); }'
  };
  const deepEvidence = evidencePackager.packageSessionEvidence(deepInput);
  assert(deepEvidence.evidenceDepth.depthScore > 50, 'Rich transcript with code and relationships assessed as Moderate/Deep');
  assert(deepEvidence.artifacts.hasCode === true, 'Code presence detected');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: 3-Zone Pedagogical Redundancy (Similarity is a Signal, Not Verdict)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: 3-Zone Pedagogical Redundancy ---');
  const q1 = {
    questionText: 'What is the primary purpose of an interrupt in computer architecture?',
    correctAnswer: 'To allow the CPU to perform other tasks while I/O completes',
    metadata: { dimension: 'Conceptual', concept: 'Interrupt Purpose' }
  };

  const q2_scenario = {
    questionText: 'A processor starts an I/O transfer that requires 10ms to complete. What mechanism allows the CPU to execute instructions for another program instead of idling?',
    correctAnswer: 'Interrupt-driven I/O',
    metadata: { dimension: 'Scenario Analysis', concept: 'Interrupt Purpose' }
  };

  const q3_duplicate = {
    questionText: 'What is the primary function of interrupts in a computer system?',
    correctAnswer: 'To allow the CPU to perform other tasks while I/O completes',
    metadata: { dimension: 'Conceptual', concept: 'Interrupt Purpose' }
  };

  const simScenario = deterministicValidator.calculateSimilarity(q1.questionText, q2_scenario.questionText);
  const dupCheckScenario = deterministicValidator.checkDuplicateQuestion(q2_scenario, [q1], { dimension: 'Scenario Analysis', concept: 'Interrupt Purpose' });
  assert(dupCheckScenario.isDuplicate === false, `Different cognitive dimension (Scenario vs Conceptual) KEPT (similarity: ${simScenario})`);

  const dupCheckDuplicate = deterministicValidator.checkDuplicateQuestion(q3_duplicate, [q1], { dimension: 'Conceptual', concept: 'Interrupt Purpose' });
  assert(dupCheckDuplicate.isDuplicate === true, 'Identical cognitive dimension and concept REJECTED as pedagogical duplicate');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Deterministic Grounding Gate & Anti-Contamination Protection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Foreign Domain Contamination Protection ---');
  const foreignMCQ = {
    questionText: 'When optimizing a MongoDB aggregation pipeline for 1,000,000 documents, where should the $match stage be placed?',
    correctAnswer: 'At the beginning of the pipeline',
    options: ['At the beginning of the pipeline', 'Inside $group', 'At the end', 'Inside $project']
  };
  const groundingRes = groundingGate.verifyQuizGrounding([foreignMCQ], deepEvidence);
  assert(groundingRes.status === 'FAILED' && groundingRes.rejectedCount === 1, 'Foreign topic contamination (MongoDB in Interrupts) strictly REJECTED');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Full End-to-End Pipeline Execution & Decision Ledger
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: End-to-End Execution & Question Decision Ledger ---');
  const pipelineResult = await pipelineOrchestrator.runPipeline({
    sessionId: 'golden_test_sess',
    voiceTranscript: deepInput.voiceTranscript,
    codeSnippets: deepInput.codeSnippets,
    difficulty: 'Medium',
    count: 3
  });

  assert(pipelineResult.pipelineStatus === 'COMPLETED', 'Pipeline execution status = COMPLETED');
  assert(pipelineResult.evidenceSafety === 'GROUNDED', 'Evidence safety status = GROUNDED');
  assert(pipelineResult.questions.length === 3, 'Delivered requested question count (3 MCQs)');
  assert(pipelineResult.questions[0].metadata?.decisionLedger !== undefined, 'Question Decision Ledger attached to delivered questions');
  assert(pipelineResult.questions[0].metadata?.decisionLedger?.source?.tier !== undefined, '5-Tier Derivability source tier recorded in Decision Ledger');

  console.log(`\n============================================================`);
  console.log(`🎉 Golden Regression Suite Completed: ${passedTests}/${totalTests} Tests Passed!`);
  console.log(`============================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runGoldenTests().catch(err => {
  console.error('Fatal Golden Test Suite Error:', err);
  process.exit(1);
});
