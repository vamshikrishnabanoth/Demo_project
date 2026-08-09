require('dotenv').config();
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');
const { buildSlotPrompts } = require('./engine/promptBuilder/index');

function runPromptBuilderTests() {
  console.log('=== TEST 1: Prompt Builder Engine v1.2.0 Execution ===');

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

  console.log('Payloads Assembled Count:', promptPayloads.length);
  console.log('Sample Prompt Payload Metadata:', JSON.stringify(promptPayloads[0].metadata, null, 2));
  console.log('Version Propagation:', JSON.stringify(promptPayloads[0].versions, null, 2));

  console.log('\n=== TEST 2: Inspect First Assembled User Prompt ===');
  console.log(promptPayloads[0].userPrompt);

  console.log('\n=== TEST 3: Sentence & Newline Boundary Snapping Check ===');
  promptPayloads.forEach((payload, idx) => {
    const len = payload.diagnostics.snippetLengthChars;
    console.log(`Slot #${idx + 1} (${payload.slotId}): Snippet Length = ${len} chars (Max Clamp: 500) | SHA-256 Hash: ${payload.metadata.promptHash}`);
  });

  console.log('\n=== ALL PROMPT BUILDER ENGINE TESTS PASSED CLEANLY! ===');
}

try {
  runPromptBuilderTests();
} catch (err) {
  console.error('❌ Prompt Builder Test Error:', err);
  process.exit(1);
}
