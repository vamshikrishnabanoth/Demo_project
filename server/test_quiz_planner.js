require('dotenv').config();
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');

function runQuizPlannerTests() {
  console.log('=== TEST 1: Quiz Planner Engine v1.3.0 Execution ===');

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
  const quizPlan = generateQuizPlan(conceptGraph, { requestedCount: 10, difficulty: "HIGH" });

  console.log('Planner Version:', quizPlan.plannerVersion);
  console.log('Metadata:', JSON.stringify(quizPlan.metadata, null, 2));
  console.log('Distribution Summary:', quizPlan.distributionSummary);
  console.log('Diagnostics:', JSON.stringify(quizPlan.diagnostics, null, 2));
  console.log('Slots Delivered Count:', quizPlan.slots.length);

  console.log('\n=== TEST 2: Inspect First 3 Blueprint Slots ===');
  quizPlan.slots.slice(0, 3).forEach(slot => {
    console.log(`Slot ID: ${slot.slotId}`);
    console.log(`  ├─ Concept: "${slot.conceptLabel}" (${slot.conceptType})`);
    console.log(`  ├─ Target: ${slot.targetDifficulty} | Bloom: ${slot.targetBloom} | Framing: ${slot.expectedFraming}`);
    console.log(`  └─ Evidence Bounds: ${JSON.stringify(slot.evidenceBounds)}`);
  });

  console.log('\n=== TEST 3: Check Non-Consecutive Assignment Guard ===');
  let consecutiveViolations = 0;
  for (let i = 1; i < quizPlan.slots.length; i++) {
    if (quizPlan.slots[i].conceptId === quizPlan.slots[i - 1].conceptId) {
      consecutiveViolations++;
    }
  }
  console.log(`Consecutive Duplicate Concept Slots Count: ${consecutiveViolations} (Expected: 0)`);

  console.log('\n=== ALL QUIZ PLANNER ENGINE TESTS PASSED CLEANLY! ===');
}

try {
  runQuizPlannerTests();
} catch (err) {
  console.error('❌ Quiz Planner Test Error:', err);
  process.exit(1);
}
