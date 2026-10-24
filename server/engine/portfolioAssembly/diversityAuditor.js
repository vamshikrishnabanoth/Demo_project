'use strict';

const { PORTFOLIO_CONFIG } = require('../../config/portfolioConfig');
const { getCandidateId } = require('./portfolioSelector');

function getStemSignature(stem) {
  return (stem || "").trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
}

function normalizeDistractor(text) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * STRICT SAME-SLOT DIVERSITY REPAIR & DISTRACTOR DIVERSITY AUDIT
 * Enforces stem opening diversity strictly within the same concept/slot boundaries,
 * and audits portfolio-wide distractor diversity to eliminate repetitive wrong options.
 */
function repairAndAuditDiversity(selectedPool, validCandidates, targetSize = 10) {
  const items = [...selectedPool];
  const maxAllowedRepetition = Math.max(1, Math.floor(targetSize * PORTFOLIO_CONFIG.MAX_STEM_FRAMING_REPETITION_RATIO));
  const maxAllowedDistractorRepetition = Math.max(2, Math.floor(targetSize * 0.25));
  
  const selectedIds = new Set(items.map(getCandidateId));
  const availableCandidates = validCandidates.filter(item => !selectedIds.has(getCandidateId(item)));

  let repairsApplied = 0;
  const stemCounts = {};
  items.forEach(i => {
    const sig = getStemSignature(i.stem);
    stemCounts[sig] = (stemCounts[sig] || 0) + 1;
  });

  // Attempt STRICT Same-Slot / Same-Concept Swaps for Repetitive Stems
  for (let idx = items.length - 1; idx >= 0; idx--) {
    const item = items[idx];
    const sig = getStemSignature(item.stem);

    if (stemCounts[sig] > maxAllowedRepetition && availableCandidates.length > 0) {
      const swapIndex = availableCandidates.findIndex(cand => {
        const candSig = getStemSignature(cand.stem);
        return (
          cand.conceptId === item.conceptId &&
          cand.slotId === item.slotId &&
          (stemCounts[candSig] || 0) < maxAllowedRepetition
        );
      });

      if (swapIndex !== -1) {
        const [replacement] = availableCandidates.splice(swapIndex, 1);
        items[idx] = replacement;
        stemCounts[sig]--;
        const newSig = getStemSignature(replacement.stem);
        stemCounts[newSig] = (stemCounts[newSig] || 0) + 1;
        repairsApplied++;
      }
    }
  }

  // Global Distractor Frequency Matrix & Diversity Repair
  const distractorCounts = {};
  items.forEach(i => {
    const distractors = Array.isArray(i.distractors) && i.distractors.length > 0
      ? i.distractors
      : (Array.isArray(i.options) ? i.options.filter(o => o !== i.correctAnswer && o !== i.answer) : []);
    distractors.forEach(d => {
      const normD = normalizeDistractor(d);
      if (normD.length > 3) {
        distractorCounts[normD] = (distractorCounts[normD] || 0) + 1;
      }
    });
  });

  // If a distractor appears too frequently across the quiz, swap with alternative candidate
  for (let idx = items.length - 1; idx >= 0; idx--) {
    const item = items[idx];
    const itemDistractors = (Array.isArray(item.distractors) && item.distractors.length > 0
      ? item.distractors
      : (Array.isArray(item.options) ? item.options.filter(o => o !== item.correctAnswer && o !== item.answer) : []))
      .map(normalizeDistractor)
      .filter(d => d.length > 3);

    const hasOverusedDistractor = itemDistractors.some(d => distractorCounts[d] > maxAllowedDistractorRepetition);
    if (hasOverusedDistractor && availableCandidates.length > 0) {
      const swapIndex = availableCandidates.findIndex(cand => {
        if (cand.conceptId !== item.conceptId || cand.slotId !== item.slotId) return false;
        const candDistractors = (Array.isArray(cand.distractors) && cand.distractors.length > 0
          ? cand.distractors
          : (Array.isArray(cand.options) ? cand.options.filter(o => o !== cand.correctAnswer && o !== cand.answer) : []))
          .map(normalizeDistractor)
          .filter(d => d.length > 3);
        return !candDistractors.some(d => (distractorCounts[d] || 0) >= maxAllowedDistractorRepetition);
      });

      if (swapIndex !== -1) {
        const [replacement] = availableCandidates.splice(swapIndex, 1);
        itemDistractors.forEach(d => { if (distractorCounts[d]) distractorCounts[d]--; });
        const newDistractors = (Array.isArray(replacement.distractors) && replacement.distractors.length > 0
          ? replacement.distractors
          : (Array.isArray(replacement.options) ? replacement.options.filter(o => o !== replacement.correctAnswer && o !== replacement.answer) : []))
          .map(normalizeDistractor)
          .filter(d => d.length > 3);
        newDistractors.forEach(d => { distractorCounts[d] = (distractorCounts[d] || 0) + 1; });
        items[idx] = replacement;
        repairsApplied++;
      }
    }
  }

  const finalCounts = {};
  const conceptCoverage = new Set();
  items.forEach(i => {
    const sig = getStemSignature(i.stem);
    finalCounts[sig] = (finalCounts[sig] || 0) + 1;
    if (i.conceptId) conceptCoverage.add(i.conceptId);
  });

  const finalDistractorCounts = {};
  items.forEach(i => {
    const distractors = Array.isArray(i.distractors) && i.distractors.length > 0
      ? i.distractors
      : (Array.isArray(i.options) ? i.options.filter(o => o !== i.correctAnswer && o !== i.answer) : []);
    distractors.forEach(d => {
      const normD = normalizeDistractor(d);
      if (normD.length > 3) {
        finalDistractorCounts[normD] = (finalDistractorCounts[normD] || 0) + 1;
      }
    });
  });

  const repetitiveOpenings = Object.entries(finalCounts)
    .filter(([_, count]) => count > maxAllowedRepetition)
    .map(([opening, count]) => ({ opening, count }));

  const repetitiveDistractors = Object.entries(finalDistractorCounts)
    .filter(([_, count]) => count > maxAllowedDistractorRepetition)
    .map(([distractor, count]) => ({ distractor, count }));

  return {
    repairedItems: items,
    diversityAudit: {
      isDiverse: repetitiveOpenings.length === 0 && repetitiveDistractors.length === 0,
      repairsApplied,
      repetitiveOpenings,
      repetitiveDistractors,
      uniqueConceptsCovered: conceptCoverage.size,
      totalItems: items.length
    }
  };
}

module.exports = {
  repairAndAuditDiversity
};
