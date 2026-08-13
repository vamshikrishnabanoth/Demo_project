/**
 * Phase 3 — Instructor Feedback Engine
 * Captures teacher quality signals ("EXCELLENT_DISTRACTORS", "TOO_EASY", "UNREALISTIC", "BLOOM_INCORRECT")
 * and computes the normalized teacher rating signal T_i in [-1.0, +1.0].
 */

'use strict';

class InstructorFeedbackEngine {
  constructor() {
    this.feedbackStore = new Map(); // questionId -> Array of rating objects
  }

  recordFeedback(questionId, teacherId, ratingType, comments = '') {
    if (!questionId || !ratingType) return null;

    const positiveTypes = ['EXCELLENT_DISTRACTORS', 'ACCURATE_BLOOM', 'HIGH_QUALITY'];
    const value = positiveTypes.includes(String(ratingType).toUpperCase()) ? 1 : -1;

    const entry = {
      id: Math.random().toString(36).substring(2, 10),
      questionId,
      teacherId: teacherId || 'anonymous_teacher',
      ratingType: String(ratingType).toUpperCase(),
      ratingValue: value,
      comments,
      timestamp: new Date().toISOString()
    };

    const existing = this.feedbackStore.get(questionId) || [];
    existing.push(entry);
    this.feedbackStore.set(questionId, existing);
    return entry;
  }

  calculateInstructorSignal(questionId) {
    const feedbackList = this.feedbackStore.get(questionId) || [];
    if (feedbackList.length === 0) return 0.50; // Default neutral signal

    const posCount = feedbackList.filter(f => f.ratingValue > 0).length;
    const negCount = feedbackList.filter(f => f.ratingValue < 0).length;
    const total = feedbackList.length;

    // Normalized signal T_i in [0.0, 1.0]
    const rawSignal = (posCount - negCount) / total;
    const normalizedTi = parseFloat(Math.max(0.0, Math.min(1.0, (rawSignal + 1.0) / 2.0)).toFixed(2));

    return normalizedTi;
  }

  getQuestionFeedback(questionId) {
    return this.feedbackStore.get(questionId) || [];
  }
}

module.exports = new InstructorFeedbackEngine();
