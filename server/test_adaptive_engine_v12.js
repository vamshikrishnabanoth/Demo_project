/**
 * server/test_adaptive_engine_v12.js
 *
 * Golden Regression Test Suite for Adaptive Lecture Depth & Multi-Dimensional Assessment Engine (v1.2).
 */

'use strict';

const depthAnalyzer = require('./engine/evidence/depthAnalyzer');
const evidencePackager = require('./engine/evidence/evidencePackager');
const agent1Planner = require('./engine/agents/agent1Planner');
const deterministicValidator = require('./engine/validators/deterministicValidator');
const agent3Evaluator = require('./engine/agents/agent3Evaluator');
const pipelineOrchestrator = require('./engine/pipelineOrchestrator');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING ADAPTIVE ENGINE v1.2 TEST SUITE');
  console.log('============================================================\n');

  // ──────────────────────────────────────────────────────────
  // TEST 1: Academic Content Detection (Academic vs Casual)
  // ──────────────────────────────────────────────────────────
  console.log('--- Test Group 1: Academic Content Detection ---');
  const casualText = "Yesterday I went to college with my friends and we had lunch at the cafeteria and discussed the movie.";
  const casualAnalysis = depthAnalyzer.analyzeLecture(casualText);
  assert(casualAnalysis.isAcademic === false, 'Casual chatter correctly flagged as non-academic', casualAnalysis.reason);

  const academicText = "A tokenizer converts text into tokens. Each token is then represented in a numerical vector that the neural network can process.";
  const academicAnalysis = depthAnalyzer.analyzeLecture(academicText);
  assert(academicAnalysis.isAcademic === true, 'Academic definition correctly recognized as academic', academicAnalysis.lectureDepth.rating);

  // ──────────────────────────────────────────────────────────
  // TEST 2: Lecture Depth Descriptive Rating (Not Judgmental)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 2: Pedagogical Lecture Depth ---');
  assert(academicAnalysis.lectureDepth.rating === 'Introductory', 'Concise definition categorized as Introductory depth', academicAnalysis.lectureDepth.rating);
  assert(academicAnalysis.lectureDepth.characteristics.conceptExplanation !== 'None', 'Concept explanation dimension captured');

  const proceduralText = `
    An interrupt temporarily changes the normal processor execution sequence.
    First, the processor pauses the current instruction cycle and saves the Program Counter and registers onto the stack.
    Second, it transfers control to the Interrupt Service Routine (ISR) by fetching the vector address from the Vector Table.
    Third, the ISR executes the device handling logic.
    Finally, the processor restores the saved state from the stack and resumes the interrupted program.
    This is preferred over polling because it eliminates CPU busy-wait cycles.
  `;
  const procAnalysis = depthAnalyzer.analyzeLecture(proceduralText);
  assert(procAnalysis.lectureDepth.rating === 'Comprehensive' || procAnalysis.lectureDepth.rating === 'Developing', 'Procedural lecture categorized as Developing/Comprehensive', procAnalysis.lectureDepth.rating);
  assert(procAnalysis.lectureDepth.characteristics.procedures === 'Strong', 'Procedural detail identified as Strong', procAnalysis.lectureDepth.characteristics.procedures);
  assert(procAnalysis.lectureDepth.characteristics.reasoning === 'Strong' || procAnalysis.lectureDepth.characteristics.reasoning === 'Moderate', 'Reasoning identified as Strong/Moderate', procAnalysis.lectureDepth.characteristics.reasoning);

  // ──────────────────────────────────────────────────────────
  // TEST 3: Evidence Packager Integration
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 3: Evidence Packager Integration ---');
  const pkg = evidencePackager.packageSessionEvidence({
    voiceTranscript: proceduralText,
    documentTexts: ['Vector Table maps IRQ numbers to ISR entry addresses.'],
    codeSnippets: ''
  });
  assert(pkg.isAcademic === true, 'Evidence Package is academic');
  assert(pkg.categoryWeights.FORMULAS_AND_CALCULATIONS === 0.0, 'Hard zero enforced for formulas when none exist');
  assert(pkg.detectedFocus.length > 0, 'Detected focus concepts populated', pkg.detectedFocus.join(', '));

  // ──────────────────────────────────────────────────────────
  // TEST 4: Agent 1 Multi-Dimensional Planning
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 4: Adaptive Multi-Dimensional Planning ---');
  const plan = await agent1Planner.planAssessment(pkg, 'Medium', 8);
  assert(plan.assessmentTargets.length >= 8, 'Planned full requested target count', `Targets: ${plan.assessmentTargets.length}`);
  const dimensionsUsed = new Set(plan.assessmentTargets.map(t => t.dimension));
  assert(dimensionsUsed.size >= 3, 'Targets distributed across multiple cognitive dimensions', Array.from(dimensionsUsed).join(', '));

  // ──────────────────────────────────────────────────────────
  // TEST 5: Contextual Redundancy (Cognitive Differentiation)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 5: Contextual Redundancy ---');
  const q1 = {
    questionText: 'What is the primary purpose of an interrupt in a processor?',
    options: ['To handle asynchronous I/O events without polling', 'To shut down the CPU', 'To recompile code', 'To clear cache'],
    correctAnswer: 'To handle asynchronous I/O events without polling',
    metadata: { dimension: 'Conceptual', concept: 'Interrupt Handling' }
  };
  const q2 = {
    questionText: 'A processor is executing a loop when an I/O device signals data is ready. Why is an interrupt mechanism appropriate here?',
    options: ['It allows immediate handling without CPU busy-waiting', 'It increases clock speed', 'It resets the memory', 'It stops all peripherals'],
    correctAnswer: 'It allows immediate handling without CPU busy-waiting',
    metadata: { dimension: 'Scenario Analysis', concept: 'Interrupt Handling' }
  };
  const q3 = {
    questionText: 'What is the main purpose of interrupts in a processor system?',
    options: ['To handle asynchronous I/O events without polling', 'To shut down the CPU', 'To recompile code', 'To clear cache'],
    correctAnswer: 'To handle asynchronous I/O events without polling',
    metadata: { dimension: 'Conceptual', concept: 'Interrupt Handling' }
  };

  const pair1 = deterministicValidator.checkPedagogicalPairRedundancy(q1, q2);
  assert(pair1.verdict.startsWith('KEEP'), 'Similar questions with different cognitive dimensions are KEPT', pair1.verdict);

  const pair2 = deterministicValidator.checkPedagogicalPairRedundancy(q1, q3);
  assert(pair2.verdict === 'REJECT_REDUNDANT', 'Identical questions with same cognitive dimension are REJECTED', pair2.reason);

  // ──────────────────────────────────────────────────────────
  // TEST 6: 5-Tier Derivability Model & Student Answerability
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 6: 5-Tier Derivability Model ---');
  const directQ = {
    questionText: 'Which structure holds the entry addresses for interrupt handlers?',
    options: ['Vector Table', 'Stack Pointer', 'Data Bus', 'Accumulator'],
    correctAnswer: 'Vector Table',
    explanation: 'The Vector Table maps IRQ numbers to ISR entry addresses.',
    metadata: { targetDifficulty: 'Medium' }
  };
  const foreignQ = {
    questionText: 'Which MongoDB aggregation stage is used to filter documents in a pipeline?',
    options: ['$match', '$group', '$project', '$sort'],
    correctAnswer: '$match',
    explanation: '$match filters documents.',
    metadata: { targetDifficulty: 'Hard' }
  };

  const target1 = { concept: 'Vector Table', subtopic: 'Vector Table', dimension: 'Conceptual', targetDifficulty: 'Medium' };
  const evalDirect = await agent3Evaluator.evaluateQuestion(directQ, target1, pkg);
  assert(evalDirect.tier === 'DIRECT_EVIDENCE' || evalDirect.status === 'PASS', 'Direct question correctly classified as DIRECT_EVIDENCE / PASS', evalDirect.tier);
  assert(evalDirect.studentAnswerability === 'HIGH' || evalDirect.status === 'PASS', 'Student answerability passes for direct question');

  const target2 = { concept: 'MongoDB Aggregation', subtopic: 'Aggregation Pipeline', dimension: 'Application', targetDifficulty: 'Hard' };
  const evalForeign = await agent3Evaluator.evaluateQuestion(foreignQ, target2, pkg);
  assert(evalForeign.tier === 'UNSUPPORTED_FOREIGN' || evalForeign.status === 'FAIL', 'Foreign topic question flagged as UNSUPPORTED_FOREIGN / FAIL', evalForeign.tier);

  // ──────────────────────────────────────────────────────────
  // TEST 7: End-to-End Orchestrator & Observability
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Test Group 7: Full Pipeline Orchestrator & Session Trace ---');
  const pipelineResult = await pipelineOrchestrator.runPipeline({
    topic: 'Microprocessor Interrupt Handling & ISR Flow',
    voiceTranscript: proceduralText,
    documentTexts: ['Vector Table maps IRQ numbers to ISR entry addresses.'],
    requestedCount: 4,
    requestedDifficulty: 'Medium'
  });

  assert(pipelineResult.pipelineStatus === 'COMPLETED' || pipelineResult.pipelineStatus === 'COMPLETED_WITH_PARTIAL_FULFILLMENT', 'Pipeline status is COMPLETED / PARTIAL', pipelineResult.pipelineStatus);
  assert(pipelineResult.questions.length > 0, `Generated ${pipelineResult.questions.length} validated questions`);
  assert(pipelineResult.evidenceSafety === 'GROUNDED', 'Evidence safety is GROUNDED');

  console.log('\n============================================================');
  console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
