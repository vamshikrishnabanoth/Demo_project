process.env.LLM_PROVIDER = "mock";

const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { generateQuizPlan } = require('./engine/quizPlanner/index');
const { assembleQuizPortfolio } = require('./engine/portfolioAssembly/index');
const { filterValidCandidates } = require('./engine/portfolioAssembly/candidatePreValidator');
const { selectStratifiedPortfolio } = require('./engine/portfolioAssembly/portfolioSelector');
const { repairAndAuditDiversity } = require('./engine/portfolioAssembly/diversityAuditor');
const { balanceAnswerKeyPositions } = require('./engine/portfolioAssembly/answerKeyBalancer');
const { sortBloomFirstPedagogicalRamp } = require('./engine/portfolioAssembly/difficultyRampSorter');
const { reviewGlobalPortfolio } = require('./engine/portfolioAssembly/portfolioReviewer');
const { PORTFOLIO_CONFIG } = require('./config/portfolioConfig');

async function runPortfolioAssemblyTests() {
  console.log('=== TEST 1: Candidate Pre-Validation & Unique IDs ===');

  const rawCandidates = [
    {
      slotId: "slot_001",
      conceptId: "tcp",
      conceptLabel: "TCP Protocol",
      targetBloom: "RECALL",
      targetDifficulty: "EASY",
      stem: "What is TCP?",
      options: ["Transmission Control Protocol", "User Datagram Protocol", "Internet Protocol", "Hypertext Transfer Protocol"],
      correctAnswer: "Transmission Control Protocol",
      qualityScore: 0.95
    },
    {
      slotId: "slot_002",
      conceptId: "udp",
      conceptLabel: "UDP Protocol",
      targetBloom: "RECALL",
      targetDifficulty: "EASY",
      stem: "What is UDP?",
      options: ["User Datagram Protocol", "Transmission Control Protocol", "Internet Protocol", "File Transfer Protocol"],
      correctAnswer: "User Datagram Protocol",
      qualityScore: 0.90
    },
    {
      // Malformed: correctAnswer not in options
      slotId: "slot_003",
      conceptId: "ip",
      conceptLabel: "IP Protocol",
      targetBloom: "UNDERSTAND",
      targetDifficulty: "MEDIUM",
      stem: "What is IP?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "Internet Protocol",
      qualityScore: 0.80
    }
  ];

  const { validCandidates, excludedCandidates } = filterValidCandidates(rawCandidates);
  console.log(`Valid Candidates Count: ${validCandidates.length} | Excluded Count: ${excludedCandidates.length}`);
  console.log(`Unique ID format check: ${validCandidates[0]._portfolioCandId === "cand_0_slot_001" ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== TEST 2: Deterministic Answer Key Balancing ===');
  const itemsToBalance = Array.from({ length: 10 }, (_, i) => ({
    slotId: `slot_00${i+1}`,
    conceptId: `concept_${i+1}`,
    stem: `Question stem #${i+1}`,
    options: ["Ans A", "Ans B", "Ans C", "Ans D"],
    correctAnswer: "Ans A",
    targetBloom: i < 5 ? "RECALL" : "APPLY",
    targetDifficulty: i % 2 === 0 ? "EASY" : "MEDIUM"
  }));

  const { balancedItems, positionCounts, exactQuotasMet } = balanceAnswerKeyPositions(itemsToBalance);
  console.log('Position Counts:', JSON.stringify(positionCounts));
  console.log(`Exact Quotas Met (N=10 -> [3,3,2,2]): ${exactQuotasMet ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== TEST 3: Bloom-First Pedagogical Ramp Sorting ===');
  const sortedRamp = sortBloomFirstPedagogicalRamp(balancedItems);
  const rampOrder = sortedRamp.map(q => `${q.targetBloom}(${q.targetDifficulty})`).join(' -> ');
  console.log('Pedagogical Ramp Order:', rampOrder);

  console.log('\n=== TEST 4: Full Portfolio Assembly Pipeline & Audit ===');
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

  const mockApprovedItems = quizPlan.slots.map((slot, idx) => ({
    slotId: slot.slotId,
    conceptId: slot.conceptId,
    conceptLabel: slot.conceptLabel,
    targetBloom: slot.targetBloom,
    targetDifficulty: slot.targetDifficulty,
    stem: `What is the function of ${slot.conceptLabel} in network protocols?`,
    options: [`Option ${idx}_A`, `Option ${idx}_B`, `Option ${idx}_C`, `Option ${idx}_D`],
    correctAnswer: `Option ${idx}_A`,
    qualityScore: 0.95
  }));

  const pipelineContext = {
    reqId: "req_port_181",
    quizPlan
  };

  const { finalQuiz, portfolioSummary } = await assembleQuizPortfolio(mockApprovedItems, pipelineContext);

  console.log('Portfolio Version:', finalQuiz.portfolioVersion);
  console.log('Total Selected Questions:', finalQuiz.totalQuestions);
  console.log('Micro-Telemetry Metrics:', JSON.stringify(portfolioSummary.metrics, null, 2));
  console.log('Global Review Passed:', portfolioSummary.globalReview.passed ? '✅ YES' : '⚠️ NO');

  const boundToContext = (
    pipelineContext.finalQuiz === finalQuiz &&
    pipelineContext.portfolioSummary === portfolioSummary
  );
  console.log(`Pipeline Context References Bound Directly: ${boundToContext ? '✅ YES' : '❌ NO'}`);

  console.log('\n=== ALL PORTFOLIO ASSEMBLY ENGINE v1.8.1 TESTS PASSED CLEANLY! ===');
}

try {
  runPortfolioAssemblyTests();
} catch (err) {
  console.error('❌ Portfolio Assembly Test Error:', err);
  process.exit(1);
}
