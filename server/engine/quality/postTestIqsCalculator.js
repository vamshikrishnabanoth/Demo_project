/**
 * Phase 3 — Post-Test Unified IQS Calculator
 * Calculates the final Post-Test Item Quality Score (IQS_post) combining Pre-Test IQS,
 * student completion rate (C_i), and instructor feedback signal (T_i).
 */

'use strict';

const instructorFeedbackEngine = require('../feedback/instructorFeedbackEngine');

function calculatePostTestIqs(questionId, preTestIqs = 0.80, studentTelemetry = {}) {
  const { totalAttempts = 0, totalCompletions = 0 } = studentTelemetry;
  
  // Student Completion Rate C_i
  const completionRate = totalAttempts > 0 ? totalCompletions / totalAttempts : 0.90;
  
  // Instructor Feedback Signal T_i
  const instructorSignal = instructorFeedbackEngine.calculateInstructorSignal(questionId);

  // Composite Post-Test IQS Calculation
  const postTestIqs = parseFloat(((0.50 * preTestIqs) + (0.30 * completionRate) + (0.20 * instructorSignal)).toFixed(2));

  return {
    postTestIqs,
    isPromotableToGold: postTestIqs >= 0.85,
    isNeedsRepair: postTestIqs < 0.50,
    breakdown: {
      preTestIqs,
      completionRate: parseFloat(completionRate.toFixed(2)),
      instructorSignal
    }
  };
}

module.exports = {
  calculatePostTestIqs
};
