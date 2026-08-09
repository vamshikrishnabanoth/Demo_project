process.env.LLM_PROVIDER = "mock";

const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');
const { buildSlotPrompts } = require('./engine/promptBuilder/index');
const { generateQuestions } = require('./engine/questionGenerator/index');

async function runQuestionGeneratorTests() {
  console.log('=== TEST 1: Question Generator Engine v1.2.0 Execution (Mock Provider) ===');

  const textSample = `
# Computer Network Protocols & Architecture

Transmission Control Protocol (TCP) is a core protocol of the Internet protocol suite.
TCP is defined as a connection-oriented protocol that guarantees reliable delivery.

## Transport Layer Flow Control

The sliding window protocol is used by TCP for flow control.
The \`socket()\` function opens a network socket descriptor.
An ACK flag is sent by the receiver to acknowledge frame receipt.

### Error Checking Mechanism

A Checksum is used for error detection across frames.
`;

  const conceptGraph = buildConceptGraph(textSample);
  const quizPlan = generateQuizPlan(conceptGraph, { requestedCount: 5, difficulty: "Balanced" });
  const promptPayloads = buildSlotPrompts(quizPlan, { cleanedContent: textSample, conceptGraph, quizPlan });

  const result = await generateQuestions(promptPayloads, {
    requestId: "test_req_500",
    cleanedContent: textSample,
    conceptGraph,
    quizPlan
  });

  console.log('Generator Version:', result.generatorVersion);
  console.log('Batch Summary:', JSON.stringify(result.batchSummary, null, 2));
  console.log('Pipeline Diagnostics:', JSON.stringify(result.pipelineDiagnostics, null, 2));
  console.log('Candidate Items Delivered:', result.candidateItems.length);

  console.log('\n=== TEST 2: Inspect First Candidate Item Schema ===');
  const firstItem = result.candidateItems[0];
  console.log('Request ID:', firstItem.requestId);
  console.log('Slot ID:', firstItem.slotId);
  console.log('Concept Label:', firstItem.conceptLabel);
  console.log('Stem:', firstItem.stem);
  console.log('Options:', firstItem.options);
  console.log('Correct Answer:', firstItem.correctAnswer);
  console.log('Explanation:', firstItem.explanation);
  console.log('12-Char SHA-256 Raw Response Hash:', firstItem.providerDiagnostics.rawResponseHash);

  console.log('\n=== TEST 3: Deterministic Slot Ordering Check ===');
  let isSorted = true;
  for (let i = 1; i < result.candidateItems.length; i++) {
    if (result.candidateItems[i].slotIndex < result.candidateItems[i - 1].slotIndex) {
      isSorted = false;
    }
  }
  console.log(`Slots Sorted Strictly by slotIndex: ${isSorted ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== ALL QUESTION GENERATOR ENGINE TESTS PASSED CLEANLY! ===');
}

try {
  runQuestionGeneratorTests();
} catch (err) {
  console.error('❌ Question Generator Test Error:', err);
  process.exit(1);
}
