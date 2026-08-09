const { PORTFOLIO_CONFIG } = require('../../config/portfolioConfig');
const { getCandidateId } = require('./portfolioSelector');

function getStemSignature(stem) {
  return (stem || "").trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
}

/**
 * 4. STRICT SAME-SLOT DIVERSITY REPAIR
 * Enforces stem opening diversity strictly within the same concept/slot boundaries.
 */
function repairAndAuditDiversity(selectedPool, validCandidates, targetSize = 10) {
  const items = [...selectedPool];
  const maxAllowedRepetition = Math.max(1, Math.floor(targetSize * PORTFOLIO_CONFIG.MAX_STEM_FRAMING_REPETITION_RATIO));
  
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

  const finalCounts = {};
  const conceptCoverage = new Set();
  items.forEach(i => {
    const sig = getStemSignature(i.stem);
    finalCounts[sig] = (finalCounts[sig] || 0) + 1;
    if (i.conceptId) conceptCoverage.add(i.conceptId);
  });

  const repetitiveOpenings = Object.entries(finalCounts)
    .filter(([_, count]) => count > maxAllowedRepetition)
    .map(([opening, count]) => ({ opening, count }));

  return {
    repairedItems: items,
    diversityAudit: {
      isDiverse: repetitiveOpenings.length === 0,
      repairsApplied,
      repetitiveOpenings,
      uniqueConceptsCovered: conceptCoverage.size,
      totalItems: items.length
    }
  };
}

module.exports = {
  repairAndAuditDiversity
};
