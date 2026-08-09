require('dotenv').config();
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');

function runSevenPointVerification() {
  console.log('======================= 🧪 STEP 2: VERIFICATION PROTOCOL (7-POINT CHECK) =======================\n');

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
  const quizPlanBalanced = generateQuizPlan(conceptGraph, { requestedCount: 10, difficulty: "Balanced" });
  const quizPlanHigh = generateQuizPlan(conceptGraph, { requestedCount: 10, difficulty: "HIGH" });

  let allPassed = true;

  // 1. Hamilton Allocation Check
  const totalSlots = quizPlanBalanced.slots.length;
  const distSum = quizPlanBalanced.distributionSummary.EASY + 
                  quizPlanBalanced.distributionSummary.MEDIUM + 
                  quizPlanBalanced.distributionSummary.HARD;
  const check1Passed = (totalSlots === 10) && (distSum === 10);
  console.log(`1. Hamilton Allocation Check: ${check1Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Requested: 10 | Slots Generated: ${totalSlots} | Difficulty Sum: ${distSum}`);
  if (!check1Passed) allPassed = false;

  // 2. Anti-Repetition Check
  let adjacentDuplicates = 0;
  for (let i = 1; i < quizPlanBalanced.slots.length; i++) {
    if (quizPlanBalanced.slots[i].conceptId === quizPlanBalanced.slots[i - 1].conceptId) {
      adjacentDuplicates++;
    }
  }
  const check2Passed = adjacentDuplicates === 0;
  console.log(`2. Anti-Repetition Check: ${check2Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Adjacent Duplicate Slots (Q_i == Q_i-1): ${adjacentDuplicates}`);
  if (!check2Passed) allPassed = false;

  // 3. Coverage Check
  const covRatio = quizPlanBalanced.diagnostics.conceptCoverageRatio;
  const check3Passed = covRatio > 0.50 && covRatio <= 1.00;
  console.log(`3. Coverage Check: ${check3Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Concept Coverage Ratio: ${(covRatio * 100).toFixed(1)}% (${quizPlanBalanced.diagnostics.uncoveredConceptIds.length} uncovered concepts)`);
  if (!check3Passed) allPassed = false;

  // 4. Stable IDs Check
  const regexSlotId = /^slot_\d{3}_.+$/;
  const validSlotIds = quizPlanBalanced.slots.every(s => regexSlotId.test(s.slotId));
  console.log(`4. Stable IDs Check: ${validSlotIds ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Sample Slot ID: "${quizPlanBalanced.slots[0]?.slotId}" (Matches format: ${validSlotIds})`);
  if (!validSlotIds) allPassed = false;

  // 5. Difficulty Mapping Check ("Balanced" mode)
  const dist = quizPlanBalanced.distributionSummary;
  const check5Passed = (dist.EASY === 3 && dist.MEDIUM === 4 && dist.HARD === 3);
  console.log(`5. Difficulty Mapping Check ("Balanced"): ${check5Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Distribution: EASY: ${dist.EASY} (${((dist.EASY / 10) * 100).toFixed(0)}%), MEDIUM: ${dist.MEDIUM} (${((dist.MEDIUM / 10) * 100).toFixed(0)}%), HARD: ${dist.HARD} (${((dist.HARD / 10) * 100).toFixed(0)}%)`);
  if (!check5Passed) allPassed = false;

  // 6. Framing Rotation Check
  const framings = quizPlanBalanced.slots.map(s => s.expectedFraming);
  const uniqueFramingsCount = new Set(framings).size;
  const check6Passed = uniqueFramingsCount >= 3;
  console.log(`6. Framing Rotation Check: ${check6Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Rotating Framings Used: [${framings.slice(0, 5).join(', ')}, ...] (Unique styles: ${uniqueFramingsCount})`);
  if (!check6Passed) allPassed = false;

  // 7. Evidence Binding Check
  const validEvidence = quizPlanBalanced.slots.every(s => 
    Array.isArray(s.evidenceBounds) && 
    s.evidenceBounds.length > 0 && 
    typeof s.summaryContext === 'string' && 
    s.summaryContext.length > 0 &&
    typeof s.promptProfile === 'object'
  );
  console.log(`7. Evidence Binding Check: ${validEvidence ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   └─ Populated bounds, summaryContext & promptProfile across all ${totalSlots} slots: ${validEvidence}`);
  if (!validEvidence) allPassed = false;

  console.log('\n=================================================================================');
  if (allPassed) {
    console.log('🎉 ALL 7 VERIFICATION CHECKS PASSED CLEANLY! Ready for Stage 4 (Prompt Builder Engine).');
  } else {
    console.error('❌ VERIFICATION PROTOCOL FAILED!');
    process.exit(1);
  }
}

try {
  runSevenPointVerification();
} catch (err) {
  console.error('❌ Verification Error:', err);
  process.exit(1);
}
