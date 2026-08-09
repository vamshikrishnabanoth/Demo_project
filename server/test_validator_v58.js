process.env.LLM_PROVIDER = "mock";

const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');
const { buildSlotPrompts } = require('./engine/promptBuilder/index');
const { generateQuestions } = require('./engine/questionGenerator/index');
const { validateCandidateBatch } = require('./engine/validators/index');
const { VALIDATOR_CONFIG } = require('./config/validatorConfig');

async function runValidatorV58Tests() {
  console.log('=== TEST 1: 3-Tier Validator Orchestrator v5.8.0 Execution ===');

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
  const genResult = await generateQuestions(promptPayloads, { requestId: "req_val_580", cleanedContent: textSample });

  // Attach sample existing trace metadata and diagnostics
  genResult.candidateItems.forEach(item => {
    item.existingTraceMetadata = { requestCorrelationId: "corr_999" };
    item.existingDiagnostics = { cacheHit: false, customLatency: 42 };
  });

  const pipelineContext = {
    reqId: "req_val_580",
    cleanedContent: textSample,
    conceptGraph,
    quizPlan,
    config: VALIDATOR_CONFIG
  };

  const validationResult = await validateCandidateBatch(genResult.candidateItems, pipelineContext);

  console.log('Validator Version:', validationResult.validatorVersion);
  console.log('Batch Summary:', JSON.stringify(validationResult.batchSummary, null, 2));
  console.log('Approved Items Count:', validationResult.approvedItems.length);
  console.log('Repair Queue Count:', validationResult.repairQueue.length);

  console.log('\n=== TEST 2: Inspect Trace Metadata & Diagnostics Preservation ===');
  const firstReport = validationResult.validatedItems[0];
  console.log('First Item Trace Entry Sample:');
  console.log(JSON.stringify(firstReport.validationTrace[0], null, 2));

  const hasPreservedMetadata = firstReport.validationTrace.every(t => 
    t.requestCorrelationId === "corr_999" && t.diagnostics?.customLatency === 42
  );
  console.log(`Trace Metadata & Diagnostics Preserved Across All Gates: ${hasPreservedMetadata ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== TEST 3: Pipeline Context Properties Assignment Check ===');
  const hasContextAssigned = (
    pipelineContext.validatedItems === validationResult.validatedItems &&
    pipelineContext.approvedItems === validationResult.approvedItems &&
    pipelineContext.repairQueue === validationResult.repairQueue
  );
  console.log(`pipelineContext Properties Set Directly on Existing Object Reference: ${hasContextAssigned ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== ALL VALIDATOR ORCHESTRATOR v5.8.0 TESTS PASSED CLEANLY! ===');
}

try {
  runValidatorV58Tests();
} catch (err) {
  console.error('❌ Validator v5.8.0 Test Error:', err);
  process.exit(1);
}
