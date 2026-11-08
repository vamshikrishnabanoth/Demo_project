/**
 * server/engine/assessment/distractorDiscriminationAnalyzer.js
 *
 * RESPONSIBILITY 3.3: DISTRACTOR DISCRIMINATION ANALYZER (CTT Psychometrics)
 *
 * Implements Classical Test Theory (CTT) item difficulty, upper/lower cohort
 * discrimination, and distractor efficiency analysis from student response matrices.
 *
 * Key Metrics Computed:
 * 1. Item Difficulty (p-value): Proportion of cohort answering correctly.
 * 2. Item Discrimination Index (D): Upper 27% vs Lower 27% performance difference (Kelly's rule).
 * 3. Distractor Selection Frequency: Proportion of students selecting each incorrect option.
 * 4. Distractor Discrimination: Difference in distractor selection between upper and lower cohorts.
 * 5. Non-Functioning Distractor (NFD) Detection: Distractors chosen by < 5% or chosen more by top students.
 * 6. Distractor Efficiency (DE): Proportion of distractors actively functioning as intended.
 *
 * Invariant: Synthetic testing datasets are explicitly labelled as
 * "SYNTHETIC_DATA_SOFTWARE_TEST_ONLY". Empirical claims are strictly deferred.
 */

'use strict';

class DistractorDiscriminationAnalyzer {
  /**
   * Analyze psychometric properties for an individual quiz question.
   *
   * @param {Object} question - The MCQ object
   * @param {number} questionIndex - 0-based question index
   * @param {Array} studentAssessments - Array of individual student assessment records from R3.2
   * @returns {Object} Psychometric item report
   */
  static analyzeItem(question, questionIndex, studentAssessments = []) {
    const N = studentAssessments.length;
    if (N === 0) {
      return {
        questionIndex: questionIndex + 1,
        questionText: question?.questionText || '',
        pValue: 0.0,
        discriminationD: 0.0,
        discriminationRating: 'INSUFFICIENT_DATA',
        distractorEfficiency: 0.0,
        optionsAnalysis: []
      };
    }

    const options = Array.isArray(question.options) ? question.options : [];
    const correctAnswer = String(question.correctAnswer || '').trim();

    // Collect responses for this specific question
    const responses = studentAssessments.map(s => {
      const ans = s.answers.find(a => a.questionIndex === questionIndex + 1);
      return {
        studentId: s.studentId,
        totalScore: s.totalScore,
        selectedOption: ans?.selectedOption || null,
        isCorrect: Boolean(ans?.isCorrect),
        status: ans?.status || 'SKIPPED'
      };
    });

    // 1. Item Difficulty Index (p-value)
    const correctCount = responses.filter(r => r.isCorrect).length;
    const pValue = parseFloat((correctCount / N).toFixed(3));

    // 2. Upper and Lower Cohorts (Kelly's 27% rule)
    const sorted = [...responses].sort((a, b) => b.totalScore - a.totalScore);
    const cohortCutoff = Math.max(1, Math.floor(N * 0.27));
    const upperCohort = sorted.slice(0, cohortCutoff);
    const lowerCohort = sorted.slice(-cohortCutoff);

    const pUpper = upperCohort.filter(r => r.isCorrect).length / upperCohort.length;
    const pLower = lowerCohort.filter(r => r.isCorrect).length / lowerCohort.length;
    const discriminationD = parseFloat((pUpper - pLower).toFixed(3));

    // Discrimination classification
    let discriminationRating = 'POOR';
    if (discriminationD >= 0.40) discriminationRating = 'EXCELLENT';
    else if (discriminationD >= 0.30) discriminationRating = 'GOOD';
    else if (discriminationD >= 0.20) discriminationRating = 'MARGINAL';
    else if (discriminationD < 0.0) discriminationRating = 'DEFECTIVE_NEGATIVE';

    // 3. Distractor Frequency and Discrimination Analysis
    let nonFunctioningCount = 0;
    const optionsAnalysis = options.map((optStr, optIdx) => {
      const optClean = String(optStr).trim();
      const isKey = optClean.toLowerCase() === correctAnswer.toLowerCase();

      const totalSelections = responses.filter(r => r.selectedOption && r.selectedOption.toLowerCase() === optClean.toLowerCase()).length;
      const frequency = parseFloat((totalSelections / N).toFixed(3));

      const upperSelections = upperCohort.filter(r => r.selectedOption && r.selectedOption.toLowerCase() === optClean.toLowerCase()).length;
      const lowerSelections = lowerCohort.filter(r => r.selectedOption && r.selectedOption.toLowerCase() === optClean.toLowerCase()).length;

      const upperFreq = parseFloat((upperSelections / upperCohort.length).toFixed(3));
      const lowerFreq = parseFloat((lowerSelections / lowerCohort.length).toFixed(3));

      if (isKey) {
        return {
          optionIndex: optIdx,
          optionText: optClean,
          isCorrectKey: true,
          selectionCount: totalSelections,
          selectionFrequency: frequency,
          upperCohortFreq: upperFreq,
          lowerCohortFreq: lowerFreq,
          status: 'CORRECT_ANSWER_KEY'
        };
      }

      // Distractor Discrimination: For a distractor, lower cohort should select it more than upper cohort (D_d <= 0)
      const distractorD = parseFloat((upperFreq - lowerFreq).toFixed(3));

      // Non-functioning criteria:
      // Criterion A: Attracts < 5% of all students (f < 0.05)
      // Criterion B: Selected more by high-scoring students than low-scoring students (D_d > 0)
      const isLowFrequency = frequency < 0.05;
      const isPositiveDiscrimination = distractorD > 0.05;
      const isNonFunctioning = isLowFrequency || isPositiveDiscrimination;

      if (isNonFunctioning) {
        nonFunctioningCount++;
      }

      let distractorStatus = 'FUNCTIONING';
      if (isLowFrequency && isPositiveDiscrimination) distractorStatus = 'NON_FUNCTIONING_RARE_AND_MISLEADING';
      else if (isLowFrequency) distractorStatus = 'NON_FUNCTIONING_RARE';
      else if (isPositiveDiscrimination) distractorStatus = 'NON_FUNCTIONING_MISLEADING_UPPER';

      return {
        optionIndex: optIdx,
        optionText: optClean,
        isCorrectKey: false,
        selectionCount: totalSelections,
        selectionFrequency: frequency,
        upperCohortFreq: upperFreq,
        lowerCohortFreq: lowerFreq,
        distractorDiscriminationD: distractorD,
        isNonFunctioning,
        status: distractorStatus
      };
    });

    // 4. Distractor Efficiency (DE) = (Total Distractors - Non-Functioning) / Total Distractors
    const totalDistractors = options.length - 1;
    const functioningCount = Math.max(0, totalDistractors - nonFunctioningCount);
    const distractorEfficiency = totalDistractors > 0
      ? parseFloat((functioningCount / totalDistractors).toFixed(2))
      : 0.0;

    return {
      questionIndex: questionIndex + 1,
      questionText: question.questionText,
      difficultyTier: question.metadata?.targetDifficulty || question.difficulty || 'Medium',
      isDeficitFill: Boolean(question.metadata?.isDeficitFill),
      pValue,
      discriminationD,
      discriminationRating,
      distractorEfficiency,
      functioningDistractors: functioningCount,
      nonFunctioningDistractors: nonFunctioningCount,
      totalDistractors,
      optionsAnalysis
    };
  }

  /**
   * Run psychometric discrimination analysis across all questions in a quiz.
   *
   * @param {Array} quizQuestions - Array of MCQ objects
   * @param {Array} studentAssessments - Array of student assessment records from R3.2
   * @param {boolean} [isSyntheticData=true] - Explicit flag indicating test vs live data
   * @returns {Object} Comprehensive quiz psychometric report
   */
  static analyzeQuiz(quizQuestions = [], studentAssessments = [], isSyntheticData = true) {
    const N = studentAssessments.length;
    const itemAnalyses = quizQuestions.map((q, idx) => this.analyzeItem(q, idx, studentAssessments));

    const meanP = itemAnalyses.length > 0
      ? parseFloat((itemAnalyses.reduce((sum, item) => sum + item.pValue, 0) / itemAnalyses.length).toFixed(3))
      : 0.0;

    const meanD = itemAnalyses.length > 0
      ? parseFloat((itemAnalyses.reduce((sum, item) => sum + item.discriminationD, 0) / itemAnalyses.length).toFixed(3))
      : 0.0;

    const meanDE = itemAnalyses.length > 0
      ? parseFloat((itemAnalyses.reduce((sum, item) => sum + item.distractorEfficiency, 0) / itemAnalyses.length).toFixed(2))
      : 0.0;

    const totalNFD = itemAnalyses.reduce((sum, item) => sum + item.nonFunctioningDistractors, 0);

    return {
      sampleSize: N,
      dataProvenance: isSyntheticData ? 'SYNTHETIC_DATA_SOFTWARE_VERIFICATION_ONLY' : 'EMPIRICAL_STUDENT_VALIDATED',
      disclaimer: isSyntheticData
        ? 'NOTE: Evaluated against a synthetic response matrix for deterministic software verification only. These metrics confirm mathematical formula execution and discrimination logic under simulated conditions; they do NOT constitute empirical student discrimination, real-world learning effectiveness, or human psychometric validity.'
        : 'Empirical psychometric analysis based on actual classroom cohort responses.',
      summaryMetrics: {
        meanDifficultyP: meanP,
        meanDiscriminationD: meanD,
        overallDistractorEfficiency: meanDE,
        totalNonFunctioningDistractors: totalNFD,
        excellentDiscriminatingItems: itemAnalyses.filter(i => i.discriminationRating === 'EXCELLENT').length,
        goodDiscriminatingItems: itemAnalyses.filter(i => i.discriminationRating === 'GOOD').length,
        marginalDiscriminatingItems: itemAnalyses.filter(i => i.discriminationRating === 'MARGINAL').length,
        poorOrNegativeItems: itemAnalyses.filter(i => i.discriminationRating === 'POOR' || i.discriminationRating === 'DEFECTIVE_NEGATIVE').length
      },
      itemAnalyses
    };
  }
}

module.exports = DistractorDiscriminationAnalyzer;
