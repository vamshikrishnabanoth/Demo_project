/**
 * Phase 2 — Independent Critique Agent
 * Evaluates generated candidate questions for factual alignment, Bloom fidelity, and distractor health.
 */

'use strict';

async function evaluateQuestionCritique(candidateItem = {}, brief = {}) {
  const { stem = '', options = [], correctAnswer = '', explanation = '' } = candidateItem;
  const { concept = '', targetBloom = 'APPLY', evidenceBounds = '' } = brief;

  let factualScore = 1.0;
  let bloomScore = 1.0;
  let distractorScore = 1.0;
  const feedbackNotes = [];

  // Factual Audit
  if (evidenceBounds && typeof evidenceBounds === 'string' && evidenceBounds.length > 50) {
    const textLower = evidenceBounds.toLowerCase();
    const stemWords = stem.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = stemWords.filter(w => textLower.includes(w)).length;
    if (matchCount < 1) {
      factualScore = 0.70;
      feedbackNotes.push('Low verbatim evidence keyword overlap with source context.');
    }
  }

  // Bloom Audit
  const lowerStem = stem.toLowerCase();
  if (targetBloom === 'ANALYZE' && !(lowerStem.includes('why') || lowerStem.includes('how') || lowerStem.includes('compare') || lowerStem.includes('evaluate') || lowerStem.includes('if'))) {
    bloomScore = 0.75;
    feedbackNotes.push('Stem framing is recall-oriented for an ANALYZE target brief.');
  }

  // Distractor Audit (Check options diversity & meta-references)
  if (Array.isArray(options)) {
    const hasMeta = options.some(opt => /all of the above|none of the above|both a and b/i.test(opt));
    if (hasMeta) {
      distractorScore = 0.50;
      feedbackNotes.push("Contains forbidden meta-option phrase ('All/None of the above').");
    }

    const uniqueOpts = new Set(options.map(o => String(o).trim().toLowerCase()));
    if (uniqueOpts.size < options.length) {
      distractorScore = 0.40;
      feedbackNotes.push('Duplicate option strings detected.');
    }
  }

  const overallConfidence = parseFloat(((factualScore * 0.4) + (bloomScore * 0.3) + (distractorScore * 0.3)).toFixed(2));
  const isApproved = overallConfidence >= 0.75;

  return {
    isApproved,
    overallConfidence,
    scores: {
      factualScore,
      bloomScore,
      distractorScore
    },
    feedbackNotes
  };
}

module.exports = {
  evaluateQuestionCritique
};
