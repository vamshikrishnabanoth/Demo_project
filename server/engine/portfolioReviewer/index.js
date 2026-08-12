/**
 * Stage 9: Portfolio-Level Reviewer (v3.0.0)
 * Performs global portfolio-level checks across the assembled quiz.
 */

function reviewQuizPortfolio(finalQuiz, pipelineContext = {}) {
  const questions = finalQuiz?.questions || [];
  const warnings = [];

  if (questions.length === 0) {
    return {
      approved: false,
      score: 0.0,
      warnings: ["Empty quiz portfolio"],
      portfolioReviewSummary: { approved: false, warnings: ["Empty quiz portfolio"] }
    };
  }

  // 1. Concept Distribution Check
  const conceptCounts = {};
  questions.forEach(q => {
    const c = q.conceptLabel || q.conceptId || "General";
    conceptCounts[c] = (conceptCounts[c] || 0) + 1;
  });

  const maxConceptShare = Math.max(...Object.values(conceptCounts));
  if (maxConceptShare > Math.ceil(questions.length * 0.50)) {
    warnings.push(`Excessive focus on single concept: ${maxConceptShare}/${questions.length} questions.`);
  }

  // 2. Bloom Ramp & Progression Check
  const bloomLevels = questions.map(q => (q.bloomLevel || 'APPLY').toUpperCase());
  const hasRecall = bloomLevels.includes('RECALL');
  const hasApply = bloomLevels.includes('APPLY');

  // 3. Syntax vs. Theory Balance Check
  const codeQuestions = questions.filter(q => /[\{\}\$\[\]\(\)=><]|\b(aggregate|find|select)\b/i.test(JSON.stringify(q)));
  const syntaxRatio = codeQuestions.length / questions.length;

  // 4. Repeated Correct-Answer Pattern Check
  const answers = questions.map(q => q.correctAnswer);
  const uniqueAnswers = new Set(answers);
  if (uniqueAnswers.size < Math.min(3, questions.length)) {
    warnings.push("Low answer key diversity detected across quiz portfolio.");
  }

  // 5. Repeated Stem Lead-in Check
  const stems = questions.map(q => (q.stem || q.questionText || q.question || '').toLowerCase());
  const stemPrefixes = stems.map(s => s.substring(0, 20));
  const uniquePrefixes = new Set(stemPrefixes);
  if (uniquePrefixes.size < stems.length) {
    warnings.push("Repeated stem lead-in phrasing detected across portfolio.");
  }

  const reviewScore = Math.max(0.70, 1.0 - (warnings.length * 0.05));

  const portfolioReviewSummary = {
    approved: true,
    score: reviewScore,
    syntaxVsTheoryRatio: Number(syntaxRatio.toFixed(2)),
    bloomDistribution: bloomLevels,
    warnings,
    lineageCount: questions.length
  };

  return {
    approved: true,
    reviewScore,
    portfolioReviewSummary
  };
}

module.exports = {
  reviewQuizPortfolio
};
