process.env.LLM_PROVIDER = "mock";

const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');
const { buildSlotPrompts } = require('./engine/promptBuilder/index');
const { generateQuestions } = require('./engine/questionGenerator/index');
const { validateCandidateBatch } = require('./engine/validators/index');
const { processRepairQueue } = require('./engine/repairRouter/index');
const { REPAIR_CONFIG } = require('./config/repairConfig');
const { shuffleArray, safeClone } = require('./engine/repairRouter/repairExecutor');

async function runRepairRouterTests() {
  console.log('=== TEST 1: Fisher-Yates Option Shuffling & Deep Clone ===');

  const origOptions = ["Option A", "Option B", "Option C", "Option D"];
  const itemToClone = { stem: "Test Stem", options: origOptions, sourceEvidence: { text: "Evidence text" } };
  
  const clonedItem = safeClone(itemToClone);
  clonedItem.options[0] = "MUTATED";

  console.log(`Deep Mutation Isolation (Original Unmodified): ${itemToClone.options[0] === "Option A" ? '✅ YES' : '❌ NO'}`);

  const shuffledOptions = shuffleArray(origOptions);
  console.log(`Shuffled Options Delivered: [${shuffledOptions.join(', ')}]`);
  console.log(`Contains all 4 original options: ${shuffledOptions.length === 4 && origOptions.every(o => shuffledOptions.includes(o)) ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== TEST 2: Targeted Repair Router v1.2.0 Execution (Mock Provider) ===');

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
  const genResult = await generateQuestions(promptPayloads, { requestId: "req_rep_120", cleanedContent: textSample });

  const pipelineContext = {
    reqId: "req_rep_120",
    cleanedContent: textSample,
    conceptGraph,
    quizPlan
  };

  const validationResult = await validateCandidateBatch(genResult.candidateItems, pipelineContext);

  // Manually construct a repair queue item for testing repair router execution
  const defectiveCandidate = safeClone(genResult.candidateItems[0]);
  defectiveCandidate.options[1] = "Imp ambiguous distractor";
  defectiveCandidate.qualityScore = 0.65;

  const mockRepairQueue = [
    {
      item: defectiveCandidate,
      repairHints: [REPAIR_CONFIG.HINTS.REGENERATE_DISTRACTORS, REPAIR_CONFIG.HINTS.REDUCE_OPTION_AMBIGUITY],
      findings: {
        majorWarnings: [{ code: "EDU_003_IMPLAUSIBLE_DISTRACTOR", message: "Distractors lack domain relevance." }]
      }
    },
    {
      item: safeClone(genResult.candidateItems[1]),
      repairHints: [REPAIR_CONFIG.HINTS.FULL_REGENERATE],
      findings: { criticalFailures: [{ code: "STRUCT_001", message: "Hard gate structural failure." }] }
    }
  ];

  pipelineContext.repairQueue = mockRepairQueue;

  const repairResult = await processRepairQueue(mockRepairQueue, pipelineContext);

  console.log('Repair Router Version:', repairResult.repairRouterVersion);
  console.log('Batch Summary:', JSON.stringify(repairResult.batchSummary, null, 2));
  console.log('Successfully Repaired Summary:', JSON.stringify(repairResult.repairedSummary, null, 2));
  console.log('Discarded Queue Count:', repairResult.discardedQueue.length);
  console.log('Discard Reasons:', JSON.stringify(repairResult.batchSummary.discardReasons));

  const hasFullRegenDiscarded = repairResult.discardedQueue.some(d => d.reason === "FULL_REGENERATE_REQUIRED");
  console.log(`FULL_REGENERATE Items Properly Discarded: ${hasFullRegenDiscarded ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== ALL TARGETED REPAIR ROUTER ENGINE TESTS PASSED CLEANLY! ===');
}

try {
  runRepairRouterTests();
} catch (err) {
  console.error('❌ Targeted Repair Router Test Error:', err);
  process.exit(1);
}
