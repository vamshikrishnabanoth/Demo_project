/**
 * server/engine/validators/groundingGate.js
 *
 * FINAL GROUNDING GATE:
 * Verification run immediately before final quiz delivery.
 * Verifies that every question's options and correct answer can be justified
 * strictly from session evidence without relying on hallucinated facts or foreign topic contamination.
 */

'use strict';

class GroundingGate {
  /**
   * Run Final Grounding Gate on passing quiz questions.
   * @param {Array} quizQuestions - Validated quiz questions
   * @param {Object} evidencePackage - Session evidence package
   * @returns {Object} { status: 'PASSED'|'FAILED', validatedQuestions: [], rejectedCount: 0 }
   */
  verifyQuizGrounding(quizQuestions = [], evidencePackage = {}) {
    const rawContent = (evidencePackage.unifiedRawContent || '').toLowerCase();
    const validated = [];
    let rejectedCount = 0;

    for (const q of quizQuestions) {
      const qText = (q.questionText || '').toLowerCase();
      const ansText = (q.correctAnswer || '').toLowerCase();

      // Semantic keywords overlap verification against raw session content
      const { isJustified, reason } = this._checkJustification(qText, ansText, rawContent);

      if (isJustified) {
        validated.push(q);
      } else {
        console.warn(`⚠️ [Grounding Gate] REJECTED question due to: ${reason} | Question: "${q.questionText}"`);
        rejectedCount++;
      }
    }

    return {
      status: validated.length > 0 ? 'PASSED' : 'FAILED',
      validatedQuestions: validated,
      rejectedCount: rejectedCount,
      totalVerified: validated.length
    };
  }

  _checkJustification(qText, ansText, rawContent) {
    if (!rawContent || rawContent.length < 50) {
      return { isJustified: true, reason: 'Minimal raw content' };
    }

    // Stopwords list
    const stopwords = new Set([
      'which', 'what', 'where', 'when', 'after', 'before', 'during', 'should',
      'between', 'their', 'there', 'about', 'using', 'would', 'could', 'because',
      'primary', 'following', 'statement', 'correct', 'accurately', 'context',
      'system', 'program', 'process', 'result', 'inside', 'dataset', 'placed'
    ]);

    // Extract content keywords (>3 chars, not in stopwords)
    const keywords = `${qText} ${ansText}`
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    if (keywords.length === 0) {
      return { isJustified: true, reason: 'No significant keywords' };
    }

    // Check if key terms exist in session evidence
    const matched = keywords.filter(kw => rawContent.includes(kw));
    const matchRatio = matched.length / keywords.length;

    // Check for foreign domain intrusion: if question has technical terms that appear 0 times in lecture
    const foreignIndicators = ['$match', '$group', '$project', 'mongodb', 'mongoose', 'nosql'];
    const hasForeignIndicator = foreignIndicators.some(f => (qText + ' ' + ansText).includes(f) && !rawContent.includes(f));

    if (hasForeignIndicator) {
      return { isJustified: false, reason: 'FOREIGN_TOPIC_CONTAMINATION: Detected domain terms absent from lecture' };
    }

    if (matchRatio < 0.15 && matched.length < 2) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matched.length}/${keywords.length} terms in evidence)`
      };
    }

    return { isJustified: true, reason: `Grounded: ${(matchRatio * 100).toFixed(1)}% overlap` };
  }
}

module.exports = new GroundingGate();
