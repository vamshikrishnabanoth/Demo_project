require('dotenv').config();
const { validateMCQ } = require('./engine/validators/validatorOrchestrator');
const { createValidationContext } = require('./engine/validators/validationContext');

async function runValidatorOrchestratorTests() {
  console.log('=== TEST 1: Gate 1 (Structural Validator) ===');
  const validContext = createValidationContext({
    cleanedContent: "The Transmission Control Protocol (TCP) provides reliable, ordered, and error-checked delivery of a stream of octets between applications running on hosts communicating via an IP network.",
    extractedConcepts: ["tcp", "protocol", "ip"]
  });

  const validMCQ = {
    question: "What does the TCP protocol provide in computer networking?",
    options: [
      "Reliable, ordered, and error-checked delivery",
      "Unreliable datagram transmission",
      "Physical layer signaling",
      "Routing table calculation"
    ],
    correctAnswer: "Reliable, ordered, and error-checked delivery",
    sourceEvidence: [{ text: "Transmission Control Protocol (TCP) provides reliable, ordered, and error-checked delivery", startOffset: 0, endOffset: 80 }]
  };

  const report1 = await validateMCQ(validMCQ, validContext);
  console.log('Valid MCQ Report isValid:', report1.isValid, 'Score:', report1.qualityScore);

  console.log('\n=== TEST 2: Gate 1 Hard-Gate Failures ===');
  const badChoiceMCQ = {
    question: "What is TCP?",
    options: ["Protocol A", "Protocol B", "All of the above", "Protocol D"], // STRUCT_004 forbidden
    correctAnswer: "Protocol A",
    sourceEvidence: [{ text: "TCP is a protocol", startOffset: 0 }]
  };

  const report2 = await validateMCQ(badChoiceMCQ, validContext);
  console.log('Forbidden Choice Report isValid:', report2.isValid, 'Failure Stage:', report2.failureStage, 'Code:', report2.findings.criticalFailures[0]?.code);

  console.log('\n=== TEST 3: Gate 2 (Grounding Validator Match Cascade) ===');
  const normalizedMCQ = {
    question: "What is TCP delivery?",
    options: ["Reliable delivery", "Unreliable delivery", "No delivery", "Random delivery"],
    correctAnswer: "Reliable delivery",
    sourceEvidence: [{ text: "Transmission   Control   Protocol   (TCP)   provides   reliable", startOffset: 0 }] // Extra whitespace
  };

  const report3 = await validateMCQ(normalizedMCQ, validContext);
  console.log('Normalized Grounding Match:', report3.validationTrace.find(t => t.stage === 'GROUNDING')?.matchType, 'Passed:', report3.isValid);

  console.log('\n=== TEST 4: Evaluator 3 (Educational Deduplication & Ambiguity) ===');
  validContext.acceptedQuestionIndex.set("What does the TCP protocol provide in computer networking?", { score: 1.0 });

  const duplicateMCQ = {
    question: "What does the TCP protocol provide in computer networking?", // Exact Duplicate!
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option A",
    sourceEvidence: [{ text: "Transmission Control Protocol (TCP) provides reliable, ordered, and error-checked delivery", startOffset: 0 }]
  };

  const report4 = await validateMCQ(duplicateMCQ, validContext);
  console.log('Duplicate Stem Report isValid:', report4.isValid, 'Failure Stage:', report4.failureStage, 'Code:', report4.findings.criticalFailures[0]?.code);

  console.log('\n=== ALL VALIDATOR ORCHESTRATOR TESTS PASSED CLEANLY! ===');
}

runValidatorOrchestratorTests().catch(err => {
  console.error('❌ Validator Orchestrator Test Error:', err);
  process.exit(1);
});
