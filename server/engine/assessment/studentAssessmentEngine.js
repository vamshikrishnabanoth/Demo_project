/**
 * server/engine/assessment/studentAssessmentEngine.js
 *
 * RESPONSIBILITY 3.2: STUDENT ANSWER ASSESSMENT ENGINE
 *
 * Evaluates student answer responses deterministically using the universal
 * grading engine (server/utils/grading.js).
 *
 * Key Responsibilities:
 * 1. Deterministic Multi-Layer Scoring: Evaluates student choices without manual tampering.
 * 2. Topic-Wise Mastery: Calculates fine-grained performance across macro-topics and subtopics.
 * 3. Difficulty-Stratified Performance: Reports Easy, Medium, and Authentic Hard accuracy separately.
 * 4. Honest Deficit Separation: Strictly separates Authentic Hard from Calibrated Medium deficit-fills.
 * 5. Robust Handling of Incomplete Data: Accurately scores skipped, empty, or missing responses.
 */

'use strict';

const { gradeAnswer, resolveCorrectOptionText } = require('../../utils/grading');

class StudentAssessmentEngine {
  /**
   * Assess a single student's response set against the quiz questions.
   *
   * @param {Object} studentRecord - { studentId, studentName, answers: [...] }
   * @param {Array} quizQuestions - Array of MCQ objects
   * @returns {Object} Comprehensive individual student assessment
   */
  static assessStudent(studentRecord, quizQuestions = []) {
    const studentId = studentRecord?.studentId || 'UNKNOWN_STUDENT';
    const studentName = studentRecord?.studentName || studentId;
    const rawAnswers = Array.isArray(studentRecord?.answers) ? studentRecord.answers : [];

    let totalScore = 0;
    let maxPossibleScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let totalTimeTaken = 0;

    const topicScores = {};
    const difficultyScores = {
      Easy: { correct: 0, total: 0 },
      Medium: { correct: 0, total: 0 },
      CalibratedMedium: { correct: 0, total: 0 },
      AuthenticHard: { correct: 0, total: 0 }
    };

    const gradedAnswers = quizQuestions.map((q, idx) => {
      const qPoints = q.points || 10;
      maxPossibleScore += qPoints;
      const qText = String(q.questionText || q.questionStem || q.stem || '').trim();

      // Extract question metadata
      const meta = q.metadata || {};
      const macroTopic = q.targetTeachingUnit?.topic || meta.macroTopic || q.topic || 'Algorithms';
      const subtopic = q.targetTeachingUnit?.concept || meta.subtopic || meta.concept || q.subtopic || 'Core';
      const targetDiff = meta.targetDifficulty || q.difficulty || 'Medium';
      const isDeficit = Boolean(q.isDeficitFill || meta.isDeficitFill || (q.runName === 'Hard' && targetDiff === 'Medium'));

      // Initialize topic tracking
      if (!topicScores[macroTopic]) {
        topicScores[macroTopic] = { correct: 0, total: 0, maxPoints: 0, earnedPoints: 0, subtopics: {} };
      }
      if (!topicScores[macroTopic].subtopics[subtopic]) {
        topicScores[macroTopic].subtopics[subtopic] = { correct: 0, total: 0 };
      }
      topicScores[macroTopic].total++;
      topicScores[macroTopic].maxPoints += qPoints;
      topicScores[macroTopic].subtopics[subtopic].total++;

      // Find student's submitted response
      const studentAns = rawAnswers.find(a => (
        (a.questionIndex !== undefined && Number(a.questionIndex) === idx) ||
        (a.questionText && qText && String(a.questionText).trim().toLowerCase() === qText.toLowerCase())
      ));

      const selectedOption = String(studentAns?.selectedOption || '').trim();
      const timeTaken = Number(studentAns?.timeTaken) || 0;
      totalTimeTaken += timeTaken;

      // Handle skipped / unanswered questions
      if (!selectedOption) {
        skippedCount++;
        return {
          questionIndex: idx + 1,
          questionText: q.questionText,
          macroTopic,
          subtopic,
          difficulty: targetDiff,
          isDeficitFill: isDeficit,
          selectedOption: null,
          correctAnswer: resolveCorrectOptionText(q),
          isCorrect: false,
          pointsEarned: 0,
          timeTaken,
          status: 'SKIPPED'
        };
      }

      // Grade answer using the authoritative universal utility
      const { isCorrect, points, resolvedCorrect } = gradeAnswer(selectedOption, q);

      if (isCorrect) {
        correctCount++;
        totalScore += points;
        topicScores[macroTopic].correct++;
        topicScores[macroTopic].earnedPoints += points;
        topicScores[macroTopic].subtopics[subtopic].correct++;

        if (targetDiff === 'Easy') difficultyScores.Easy.correct++;
        else if (isDeficit) difficultyScores.CalibratedMedium.correct++;
        else if (targetDiff === 'Hard') difficultyScores.AuthenticHard.correct++;
        else difficultyScores.Medium.correct++;
      } else {
        wrongCount++;
      }

      // Track difficulty totals
      if (targetDiff === 'Easy') difficultyScores.Easy.total++;
      else if (isDeficit) difficultyScores.CalibratedMedium.total++;
      else if (targetDiff === 'Hard') difficultyScores.AuthenticHard.total++;
      else difficultyScores.Medium.total++;

      return {
        questionIndex: idx + 1,
        questionText: q.questionText,
        macroTopic,
        subtopic,
        difficulty: targetDiff,
        isDeficitFill: isDeficit,
        selectedOption,
        correctAnswer: resolvedCorrect,
        isCorrect,
        pointsEarned: isCorrect ? points : 0,
        timeTaken,
        status: isCorrect ? 'CORRECT' : 'INCORRECT'
      };
    });

    const percentage = maxPossibleScore > 0 ? parseFloat(((totalScore / maxPossibleScore) * 100).toFixed(1)) : 0.0;

    // Build topic mastery percentages
    const topicMastery = {};
    for (const [top, data] of Object.entries(topicScores)) {
      topicMastery[top] = {
        earnedPoints: data.earnedPoints,
        maxPoints: data.maxPoints,
        accuracyPercentage: data.total > 0 ? parseFloat(((data.correct / data.total) * 100).toFixed(1)) : 0.0,
        subtopics: {}
      };
      for (const [sub, subData] of Object.entries(data.subtopics)) {
        topicMastery[top].subtopics[sub] = subData.total > 0
          ? parseFloat(((subData.correct / subData.total) * 100).toFixed(1))
          : 0.0;
      }
    }

    return {
      studentId,
      studentName,
      totalScore,
      maxPossibleScore,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions: quizQuestions.length,
      totalTimeTaken,
      averageTimePerQuestion: quizQuestions.length > 0 ? Math.round(totalTimeTaken / quizQuestions.length) : 0,
      topicMastery,
      difficultyPerformance: {
        easyAccuracy: difficultyScores.Easy.total > 0 ? parseFloat(((difficultyScores.Easy.correct / difficultyScores.Easy.total) * 100).toFixed(1)) : null,
        mediumAccuracy: difficultyScores.Medium.total > 0 ? parseFloat(((difficultyScores.Medium.correct / difficultyScores.Medium.total) * 100).toFixed(1)) : null,
        calibratedMediumAccuracy: difficultyScores.CalibratedMedium.total > 0 ? parseFloat(((difficultyScores.CalibratedMedium.correct / difficultyScores.CalibratedMedium.total) * 100).toFixed(1)) : null,
        authenticHardAccuracy: difficultyScores.AuthenticHard.total > 0 ? parseFloat(((difficultyScores.AuthenticHard.correct / difficultyScores.AuthenticHard.total) * 100).toFixed(1)) : null
      },
      answers: gradedAnswers
    };
  }

  /**
   * Assess an entire cohort of students on a quiz.
   *
   * @param {Array} cohortResponses - Array of student response records
   * @param {Array} quizQuestions - Array of MCQ objects
   * @returns {Object} Comprehensive cohort assessment report
   */
  static assessCohort(cohortResponses = [], quizQuestions = []) {
    if (!Array.isArray(cohortResponses) || cohortResponses.length === 0) {
      return {
        cohortSize: 0,
        message: 'No student responses provided',
        studentAssessments: [],
        aggregateMetrics: {}
      };
    }

    const studentAssessments = cohortResponses.map(r => this.assessStudent(r, quizQuestions));

    // Aggregate statistics
    const N = studentAssessments.length;
    const scores = studentAssessments.map(s => s.totalScore);
    const percentages = studentAssessments.map(s => s.percentage);

    const meanScore = parseFloat((scores.reduce((a, b) => a + b, 0) / N).toFixed(2));
    const meanPercentage = parseFloat((percentages.reduce((a, b) => a + b, 0) / N).toFixed(1));

    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(N / 2)];
    const highestScore = sortedScores[N - 1];
    const lowestScore = sortedScores[0];

    const variance = scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / N;
    const standardDeviation = parseFloat(Math.sqrt(variance).toFixed(2));

    // Aggregate topic-wise performance across the entire cohort
    const cohortTopicMastery = {};
    studentAssessments.forEach(s => {
      for (const [topic, data] of Object.entries(s.topicMastery)) {
        if (!cohortTopicMastery[topic]) {
          cohortTopicMastery[topic] = { totalPoints: 0, maxPoints: 0, subtopics: {} };
        }
        cohortTopicMastery[topic].totalPoints += data.earnedPoints;
        cohortTopicMastery[topic].maxPoints += data.maxPoints;

        for (const [sub, pct] of Object.entries(data.subtopics)) {
          if (!cohortTopicMastery[topic].subtopics[sub]) {
            cohortTopicMastery[topic].subtopics[sub] = { sumPct: 0, count: 0 };
          }
          cohortTopicMastery[topic].subtopics[sub].sumPct += pct;
          cohortTopicMastery[topic].subtopics[sub].count++;
        }
      }
    });

    const formattedTopicMastery = {};
    for (const [topic, data] of Object.entries(cohortTopicMastery)) {
      formattedTopicMastery[topic] = {
        cohortMasteryPercentage: data.maxPoints > 0 ? parseFloat(((data.totalPoints / data.maxPoints) * 100).toFixed(1)) : 0.0,
        subtopics: {}
      };
      for (const [sub, subData] of Object.entries(data.subtopics)) {
        formattedTopicMastery[topic].subtopics[sub] = parseFloat((subData.sumPct / subData.count).toFixed(1));
      }
    }

    // Difficulty breakdown (separating Authentic Hard from Calibrated Medium)
    const easyPcts = studentAssessments.map(s => s.difficultyPerformance.easyAccuracy).filter(v => v !== null);
    const medPcts = studentAssessments.map(s => s.difficultyPerformance.mediumAccuracy).filter(v => v !== null);
    const calPcts = studentAssessments.map(s => s.difficultyPerformance.calibratedMediumAccuracy).filter(v => v !== null);
    const hardPcts = studentAssessments.map(s => s.difficultyPerformance.authenticHardAccuracy).filter(v => v !== null);

    const difficultyBreakdown = {
      easyAccuracy: easyPcts.length > 0 ? parseFloat((easyPcts.reduce((a, b) => a + b, 0) / easyPcts.length).toFixed(1)) : null,
      mediumAccuracy: medPcts.length > 0 ? parseFloat((medPcts.reduce((a, b) => a + b, 0) / medPcts.length).toFixed(1)) : null,
      calibratedMediumAccuracy: calPcts.length > 0 ? parseFloat((calPcts.reduce((a, b) => a + b, 0) / calPcts.length).toFixed(1)) : null,
      authenticHardAccuracy: hardPcts.length > 0 ? parseFloat((hardPcts.reduce((a, b) => a + b, 0) / hardPcts.length).toFixed(1)) : null
    };

    return {
      cohortSize: N,
      totalQuestions: quizQuestions.length,
      aggregateMetrics: {
        meanScore,
        meanPercentage,
        medianScore,
        highestScore,
        lowestScore,
        standardDeviation
      },
      topicMastery: formattedTopicMastery,
      difficultyBreakdown,
      studentAssessments
    };
  }
}

module.exports = StudentAssessmentEngine;
