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
    let failureReasons = [];

    // Extract table and visual contents from multimodalStore or commonDocumentModel if present
    let tableText = '';
    let visualText = '';
    if (evidencePackage.commonDocumentModel) {
      const blocks = evidencePackage.commonDocumentModel.getAllBlocks?.() || [];
      for (const b of blocks) {
        if (b.type === 'table') tableText += ' ' + b.content.toLowerCase();
        if (b.type === 'chart' || b.type === 'diagram' || b.type === 'image') visualText += ' ' + b.content.toLowerCase();
      }
    }

    const fullVerifiableContent = `${rawContent} ${tableText} ${visualText}`.trim();

    for (const q of quizQuestions) {
      const qText = (q.questionText || '').toLowerCase();
      const ansText = (q.correctAnswer || '').toLowerCase();

      // Semantic keywords overlap verification against verifiable session content
      const { isJustified, reason } = this._checkJustification(qText, ansText, fullVerifiableContent);

      if (isJustified) {
        validated.push(q);
      } else {
        console.warn(`⚠️ [Grounding Gate] REJECTED question due to: ${reason} | Question: "${q.questionText}"`);
        rejectedCount++;
        failureReasons.push(reason);
      }
    }

    const passed = validated.length > 0;
    return {
      status: passed ? 'PASSED' : 'FAILED',
      failureCode: passed ? null : 'INSUFFICIENT_READABLE_EVIDENCE',
      validatedQuestions: validated,
      rejectedCount: rejectedCount,
      totalVerified: validated.length,
      reasons: failureReasons
    };
  }

  _checkJustification(qText, ansText, rawContent) {
    if (!rawContent || rawContent.length < 50) {
      return { isJustified: false, reason: 'INSUFFICIENT_READABLE_EVIDENCE: Session content too sparse to verify grounding' };
    }

    // Stopwords list: common grammatical/conversational question words
    const stopwords = new Set([
      'which', 'what', 'where', 'when', 'after', 'before', 'during', 'should',
      'between', 'their', 'there', 'about', 'using', 'would', 'could', 'because',
      'primary', 'following', 'statement', 'correct', 'accurately', 'context',
      'inside', 'outside', 'placed', 'allows', 'allowed', 'given', 'gives',
      'the', 'and', 'for', 'are', 'all', 'not', 'but', 'into', 'than', 'then',
      'also', 'each', 'can', 'will', 'just', 'such', 'only', 'more', 'some',
      'any', 'been', 'has', 'had', 'does', 'did', 'doing', 'our', 'you',
      'your', 'they', 'them', 'who', 'how', 'why', 'with', 'from', 'that',
      'this', 'these', 'those', 'have', 'were', 'being', 'other', 'most',
      'both', 'through', 'under', 'over', 'while', 'well', 'here', 'first',
      'affect', 'currently'
    ]);

    // Extract substantive content terms (>2 chars, not in stopwords)
    const keywords = `${qText} ${ansText}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    if (keywords.length === 0) {
      return { isJustified: true, reason: 'No significant keywords to constrain' };
    }

    // Check presence against verifiable session evidence
    const rawLower = rawContent.toLowerCase();
    const matched = keywords.filter(kw => rawLower.includes(kw));
    const unsupported = keywords.filter(kw => !rawLower.includes(kw));
    const matchRatio = matched.length / keywords.length;

    // 1. Total absence of evidence support
    if (matched.length === 0) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio 0.0% (found 0/${keywords.length} terms in evidence)`
      };
    }

    // 2. Evidence-based foreign domain contamination:
    // Multiple substantive unsupported anchors (>=3) with weak evidence support (<3 matches or <30% overlap)
    if (unsupported.length >= 3 && (matched.length < 3 || matchRatio < 0.30)) {
      const sampleUnsupported = Array.from(new Set(unsupported)).slice(0, 4).join(', ');
      return {
        isJustified: false,
        reason: `FOREIGN_TOPIC_CONTAMINATION: Multiple unsupported domain anchors (${sampleUnsupported}) absent from lecture evidence`
      };
    }

    // 3. Severe under-grounding (< 20% overlap)
    if (matchRatio < 0.20) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matched.length}/${keywords.length} terms in evidence)`
      };
    }

    // 4. Sparse match floor: only 1 keyword matched out of 4+ substantive terms
    if (matched.length < 2 && matchRatio < 0.30) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matched.length}/${keywords.length} terms in evidence)`
      };
    }

    return { isJustified: true, reason: `Grounded: ${(matchRatio * 100).toFixed(1)}% overlap` };
  }
}

const instance = new GroundingGate();
instance.GroundingGate = GroundingGate;
module.exports = instance;
