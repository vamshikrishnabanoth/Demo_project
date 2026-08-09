const { performance } = require('perf_hooks');
const { PORTFOLIO_CONFIG } = require('../../config/portfolioConfig');
const { filterValidCandidates } = require('./candidatePreValidator');
const { selectStratifiedPortfolio } = require('./portfolioSelector');
const { repairAndAuditDiversity } = require('./diversityAuditor');
const { balanceAnswerKeyPositions } = require('./answerKeyBalancer');
const { sortBloomFirstPedagogicalRamp } = require('./difficultyRampSorter');
const { reviewGlobalPortfolio } = require('./portfolioReviewer');

/**
 * 8. PORTFOLIO ASSEMBLY ORCHESTRATOR WITH MICRO-TELEMETRY
 * Coordinates assembly stages and benchmarks latency breakdown per sub-module.
 */
async function assembleQuizPortfolio(approvedItems = [], pipelineContext = {}) {
  const startTime = performance.now();
  const targetSize = pipelineContext.quizPlan?.requestedCount || pipelineContext.quizPlan?.totalTargetQuestions || PORTFOLIO_CONFIG.DEFAULT_QUIZ_SIZE;

  // Step 1: Pre-Validate Candidates FIRST & Attach Unique IDs
  const t0 = performance.now();
  const { validCandidates, excludedCandidates } = filterValidCandidates(approvedItems);
  const preFilterMs = Math.round((performance.now() - t0) * 100) / 100;

  // Step 2: 5-Tier Stratified Selection matching quizPlan
  const t1 = performance.now();
  const rawSelection = selectStratifiedPortfolio(validCandidates, pipelineContext.quizPlan, targetSize);
  const selectionMs = Math.round((performance.now() - t1) * 100) / 100;

  // Step 3: Strict Same-Slot Stem Diversity Repair & Audit
  const t2 = performance.now();
  const { repairedItems, diversityAudit } = repairAndAuditDiversity(rawSelection, validCandidates, targetSize);
  const diversityMs = Math.round((performance.now() - t2) * 100) / 100;

  // Step 4: Deterministic Answer Key Balancing
  const t3 = performance.now();
  const { balancedItems, positionCounts, exactQuotasMet } = balanceAnswerKeyPositions(repairedItems);
  const balancingMs = Math.round((performance.now() - t3) * 100) / 100;

  // Step 5: Bloom-First Pedagogical Ramp Sorting
  const t4 = performance.now();
  const finalQuestionList = sortBloomFirstPedagogicalRamp(balancedItems);
  const sortingMs = Math.round((performance.now() - t4) * 100) / 100;

  // Step 6: Global Portfolio 7-Point Audit Review
  const t5 = performance.now();
  const globalReview = reviewGlobalPortfolio(finalQuestionList, pipelineContext.quizPlan, exactQuotasMet);
  const auditMs = Math.round((performance.now() - t5) * 100) / 100;

  const totalAssemblyTimeMs = Math.round(performance.now() - startTime);

  const finalQuiz = {
    portfolioVersion: PORTFOLIO_CONFIG.VERSION,
    quizId: `quiz_${pipelineContext.reqId || Date.now()}`,
    sourceId: pipelineContext.sourceMetadata?.sourceId || "document_upload",
    totalQuestions: finalQuestionList.length,
    questions: finalQuestionList.map((q, idx) => {
      const normChoices = q.options.map(o => String(o).normalize("NFKC").trim());
      const normAns = String(q.correctAnswer).normalize("NFKC").trim();
      const ansIdx = normChoices.indexOf(normAns);
      const letter = ansIdx !== -1 ? String.fromCharCode(65 + ansIdx) : "A";

      return {
        questionNumber: idx + 1,
        slotId: q.slotId,
        conceptId: q.conceptId,
        conceptLabel: q.conceptLabel,
        targetDifficulty: q.targetDifficulty,
        targetBloom: q.targetBloom,
        stem: q.stem || q.question || q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctOptionLetter: letter,
        explanation: q.explanation,
        qualityScore: q.qualityScore,
        sourceEvidence: q.sourceEvidence
      };
    })
  };

  const portfolioSummary = {
    portfolioVersion: PORTFOLIO_CONFIG.VERSION,
    totalApprovedAvailable: Array.isArray(approvedItems) ? approvedItems.length : 0,
    totalValidCandidates: validCandidates.length,
    invalidCandidatesExcluded: excludedCandidates.length,
    totalSelected: finalQuiz.totalQuestions,
    averageQualityScore: Number((finalQuestionList.reduce((acc, q) => acc + (q.qualityScore || 0), 0) / (finalQuestionList.length || 1)).toFixed(2)),
    answerDistribution: positionCounts,
    exactQuotasMet,
    diversityAudit,
    globalReview,
    metrics: {
      preFilterMs,
      selectionMs,
      diversityMs,
      balancingMs,
      sortingMs,
      auditMs,
      totalAssemblyTimeMs
    }
  };

  // Bind properties directly to pipelineContext object reference
  pipelineContext.finalQuiz = finalQuiz;
  pipelineContext.portfolioSummary = portfolioSummary;

  return { finalQuiz, portfolioSummary };
}

module.exports = {
  assembleQuizPortfolio
};
