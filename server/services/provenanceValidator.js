/**
 * KMIT Kahoot — Question Provenance Validator
 * Baseline: 9b0b8872fdb8483377288e45574e2b836ed136d4
 * Specification: PLAN-PROD-2026-11-08-REL-12-DEFINITIVE
 *
 * Enforces production-grade semantic provenance and 1-to-1 canonical matching.
 * Protects against stem meaning-reversals, answer drift, and forged task IDs.
 */

'use strict';

function extractContentTokens(text) {
  if (!text || typeof text !== 'string') return [];
  const stopWords = new Set(['what', 'is', 'the', 'of', 'to', 'in', 'a', 'an', 'regarding', 'based', 'on', 'which', 'following', 'by', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'will', 'be']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !stopWords.has(t));
}

function computePreservedContentRatio(submittedStem, canonicalStem) {
  const sTokens = new Set(extractContentTokens(submittedStem));
  const cTokens = extractContentTokens(canonicalStem);
  if (cTokens.length === 0) return 0;
  const matchCount = cTokens.filter(t => sTokens.has(t)).length;
  return matchCount / cTokens.length;
}

function computeLevenshteinSimilarity(s1, s2) {
  const str1 = String(s1 || '').toLowerCase().trim();
  const str2 = String(s2 || '').toLowerCase().trim();
  if (str1 === str2) return 1.0;
  const len1 = str1.length;
  const len2 = str2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const d = [];
  for (let i = 0; i <= len1; i++) d[i] = [i];
  for (let j = 0; j <= len2; j++) d[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const maxLen = Math.max(len1, len2);
  return 1.0 - (d[len1][len2] / maxLen);
}

function isExceptionInterrogativeTarget(stem) {
  const lower = String(stem || '').toLowerCase().trim();
  return /which of the following (is|does|are|would) not/i.test(lower) ||
         /\b(not|except|least likely|false|incorrect)\b.*(describe|represent|apply|pertain|mean|characterize|feature)/i.test(lower);
}

/**
 * Evaluate semantic provenance of a single submitted question against its canonical source.
 */
function evaluateQuestionProvenance(sq, cq) {
  const submittedStem = sq.questionText || sq.stem || sq.question || '';
  const canonicalStem = cq.stem || cq.questionText || cq.question || '';
  const submittedAnswer = sq.correctAnswer || sq.correct_answer || sq.answer || '';
  const canonicalAnswer = cq.correctAnswer || cq.correct_answer || cq.answer || '';

  const contentRatio = computePreservedContentRatio(submittedStem, canonicalStem);
  const answerSim = computeLevenshteinSimilarity(submittedAnswer, canonicalAnswer);
  const cIsException = isExceptionInterrogativeTarget(canonicalStem);
  const sIsException = isExceptionInterrogativeTarget(submittedStem);

  // Guardrail 1: Polarity Scope Invariant (Negation / exception scope match)
  if (cIsException !== sIsException) {
    return { status: 'REJECTED', code: 'PROVENANCE_VIOLATION_SCOPE_MISMATCH', contentRatio, answerSim };
  }

  // Guardrail 2: Content Stem Containment (Minimum 60% substantive token overlap)
  if (contentRatio < 0.60) {
    return { status: 'REJECTED', code: 'PROVENANCE_VIOLATION_STEM_MISMATCH', contentRatio, answerSim };
  }

  // Guardrail 3: Answer Similarity Decision Matrix
  if (answerSim >= 0.65) {
    return { status: 'ACCEPTED', code: 'PROVENANCE_VERIFIED', contentRatio, answerSim };
  } else if (answerSim >= 0.35) {
    return { status: 'REJECTED', code: 'PROVENANCE_AMBIGUOUS_BORDERLINE', contentRatio, answerSim };
  } else {
    return { status: 'REJECTED', code: 'PROVENANCE_VIOLATION_MEANING_CHANGED', contentRatio, answerSim };
  }
}

/**
 * Validate full submission payload against task canonical manifest.
 * Enforces 1-to-1 matching, duplicate prevention, and semantic provenance.
 */
function validateSubmissionProvenance(submittedQuestions, manifest) {
  if (!Array.isArray(submittedQuestions) || submittedQuestions.length === 0) {
    return { valid: false, error: 'EMPTY_SUBMISSION' };
  }
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return { valid: false, error: 'EMPTY_CANONICAL_MANIFEST' };
  }

  // 1. Guard against duplicate submitted questions (identical stems)
  const seenStems = new Set();
  for (const q of submittedQuestions) {
    const s = String(q.questionText || q.stem || q.question || '').trim().toLowerCase();
    if (s.length > 0) {
      if (seenStems.has(s)) {
        return { valid: false, error: 'PROVENANCE_VIOLATION_DUPLICATE_SUBMITTED_QUESTION', stem: s };
      }
      seenStems.add(s);
    }
  }

  // 2. Map canonical manifest by qOriginId and targetId
  const manifestByOrigin = new Map();
  const manifestByTarget = new Map();
  manifest.forEach((cq, idx) => {
    if (cq.qOriginId) manifestByOrigin.set(cq.qOriginId, cq);
    const tId = cq.targetId || idx + 1;
    manifestByTarget.set(String(tId), cq);
  });

  const claimedCanonicalIds = new Set();

  // 3. Verify each submitted question against its canonical source 1-to-1
  for (let i = 0; i < submittedQuestions.length; i++) {
    const sq = submittedQuestions[i];
    let cq = null;

    if (sq.qOriginId && manifestByOrigin.has(sq.qOriginId)) {
      cq = manifestByOrigin.get(sq.qOriginId);
    } else if (sq.targetId && manifestByTarget.has(String(sq.targetId))) {
      cq = manifestByTarget.get(String(sq.targetId));
    } else if (i < manifest.length) {
      cq = manifest[i];
    }

    if (!cq) {
      return { valid: false, error: 'PROVENANCE_VIOLATION_UNMATCHED_QUESTION', index: i };
    }

    const canonicalKey = cq.qOriginId || `target_${cq.targetId || i}`;
    if (claimedCanonicalIds.has(canonicalKey)) {
      return { valid: false, error: 'PROVENANCE_VIOLATION_DUPLICATE_CANONICAL_CLAIM', canonicalKey };
    }
    claimedCanonicalIds.add(canonicalKey);

    const evalResult = evaluateQuestionProvenance(sq, cq);
    if (evalResult.status !== 'ACCEPTED') {
      return {
        valid: false,
        error: evalResult.code,
        detail: {
          submittedIndex: i,
          submittedStem: sq.questionText || sq.stem || sq.question,
          canonicalStem: cq.stem || cq.questionText || cq.question,
          contentRatio: evalResult.contentRatio,
          answerSim: evalResult.answerSim
        }
      };
    }
  }

  return { valid: true };
}

module.exports = {
  extractContentTokens,
  computePreservedContentRatio,
  computeLevenshteinSimilarity,
  isExceptionInterrogativeTarget,
  evaluateQuestionProvenance,
  validateSubmissionProvenance
};
