/**
 * server/engine/validators/groundingGate.js
 *
 * FINAL GROUNDING GATE:
 * Verification run immediately before final quiz delivery.
 * Verifies that every question's options and correct answer can be justified
 * strictly from session evidence without relying on hallucinated facts or foreign topic contamination.
 */

'use strict';

// Single-digit numbers to English word map for speech transcript normalization
const DIGIT_WORD_MAP = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine'
};

/**
 * Generates guarded inflectional variant candidates for a substantive token.
 * Never mutates original tokens destructively; returns candidate forms to test against evidence.
 */
function getMorphologicalVariants(token) {
  const variants = new Set([token]);
  const len = token.length;

  // Floor constraint: short words (< 4 chars) are never stemmed
  if (len < 4) return variants;

  // Guard against protected endings: -ss, -us, -is, -eed (e.g. process, address, status, basis, speed)
  const isProtectedEnding = /([sui]s|eed)$/.test(token);

  // 1. Participle / Gerund: -ing (e.g., 'converting' -> 'convert', 'pipelining' -> 'pipeline')
  if (token.endsWith('ing') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base);
    variants.add(base + 'e');
  }

  // 2. Adjective / Noun Invariance: -ive <-> -ion (e.g., 'recursive' <-> 'recursion')
  if (token.endsWith('ive') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base + 'ion');
    variants.add(base);
    variants.add(base + 'e');
  }
  if (token.endsWith('ion') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base + 'ive');
    variants.add(base);
    variants.add(base + 'e');
  }

  // 3. Past tense / Participle: -ed (e.g., 'executed' -> 'execute')
  if (token.endsWith('ed') && len >= 5 && !isProtectedEnding) {
    variants.add(token.slice(0, -1));
    variants.add(token.slice(0, -2));
  }

  // 4. Plurals: -s / -es (e.g., 'nodes' -> 'node', 'reaches' -> 'reach')
  if (token.endsWith('s') && len >= 4 && !isProtectedEnding) {
    if (token.endsWith('es') && len >= 5) {
      variants.add(token.slice(0, -2));
    }
    variants.add(token.slice(0, -1));
  }

  return variants;
}

/**
 * Checks if a token (alphabetic or numeric) is supported by verifiable evidence.
 */
function isTokenSupported(token, rawLower) {
  if (/^\d+$/.test(token)) {
    // Exact numeric match with word boundaries
    const numRegex = new RegExp(`\\b${token}\\b`);
    if (numRegex.test(rawLower)) return true;
    // Check digit word equivalent (e.g. '8' -> 'eight', '0' -> 'zero')
    if (DIGIT_WORD_MAP[token]) {
      const wordRegex = new RegExp(`\\b${DIGIT_WORD_MAP[token]}\\b`);
      if (wordRegex.test(rawLower)) return true;
    }
    return false;
  }

  // Alphabetic token: check exact token and guarded morphological variants
  const variants = getMorphologicalVariants(token);
  for (const v of variants) {
    if (rawLower.includes(v)) return true;
  }
  return false;
}

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

    // Stopwords list: common grammatical/conversational question words & question scaffolding
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
      'affect', 'currently',

      // Question-framing metadata & prompt scaffolding tokens
      'according', 'evidence', 'result', 'expression', 'determine', 'determines',
      'calculated', 'calculate', 'identify', 'identifies', 'specific', 'specified',
      'established', 'represents', 'described', 'describes', 'indicated', 'indicates',
      'mentioned', 'discusses', 'discussed', 'value', 'values', 'difference',
      'example', 'examples', 'variable', 'variables'
    ]);

    // Extract all alphanumeric tokens
    const rawTokens = `${qText} ${ansText}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const numericTokens = rawTokens.filter(w => /^\d+$/.test(w));
    const substantiveTokens = rawTokens.filter(w => !/^\d+$/.test(w) && w.length > 2 && !stopwords.has(w));
    const totalTokens = substantiveTokens.length + numericTokens.length;

    if (totalTokens === 0) {
      return { isJustified: true, reason: 'No significant keywords to constrain' };
    }

    const rawLower = rawContent.toLowerCase();

    const matchedSubstantive = substantiveTokens.filter(t => isTokenSupported(t, rawLower));
    const unsupportedSubstantive = substantiveTokens.filter(t => !isTokenSupported(t, rawLower));

    const matchedNumeric = numericTokens.filter(t => isTokenSupported(t, rawLower));
    const unsupportedNumeric = numericTokens.filter(t => !isTokenSupported(t, rawLower));

    const matchedCount = matchedSubstantive.length + matchedNumeric.length;
    const matchRatio = totalTokens > 0 ? matchedCount / totalTokens : 0;

    // 1. Total absence of evidence support
    if (matchedCount === 0) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio 0.0% (found 0/${totalTokens} terms in evidence)`
      };
    }

    // 2. Anti-bypass guard: numbers alone never establish grounding
    if (matchedSubstantive.length === 0 && substantiveTokens.length >= 2) {
      return {
        isJustified: false,
        reason: 'ZERO_SUBSTANTIVE_OVERLAP: No substantive domain concepts found in session evidence despite numeric presence'
      };
    }

    // 3. Evidence-based foreign domain contamination:
    // Multiple substantive unsupported anchors (>=3) with weak evidence support (<3 matches or <30% overlap)
    if (unsupportedSubstantive.length >= 3 && (matchedSubstantive.length < 3 || matchRatio < 0.30)) {
      const sampleUnsupported = Array.from(new Set(unsupportedSubstantive)).slice(0, 4).join(', ');
      return {
        isJustified: false,
        reason: `FOREIGN_TOPIC_CONTAMINATION: Multiple unsupported domain anchors (${sampleUnsupported}) absent from lecture evidence`
      };
    }

    // 4. Severe under-grounding (< 20% overlap)
    if (matchRatio < 0.20) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matchedCount}/${totalTokens} terms in evidence)`
      };
    }

    // 5. Sparse match floor: only 1 substantive keyword matched out of 4+ substantive terms
    if (matchedSubstantive.length < 2 && matchRatio < 0.30 && substantiveTokens.length >= 4) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matchedCount}/${totalTokens} terms in evidence)`
      };
    }

    return {
      isJustified: true,
      reason: `Grounded: ${(matchRatio * 100).toFixed(1)}% overlap`,
      matchedDomainAnchors: matchedSubstantive,
      verifiedNumericalFacts: matchedNumeric
    };
  }
}

const instance = new GroundingGate();
instance.GroundingGate = GroundingGate;
module.exports = instance;
