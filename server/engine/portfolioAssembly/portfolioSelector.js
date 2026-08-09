function getCandidateId(item) {
  return item?._portfolioCandId || "unknown_cand";
}

/**
 * 3. SLOT-IDENTIFIED 5-TIER STRATIFIED PORTFOLIO SELECTOR
 * Selects valid candidates matching Stage 3 quizPlan slots using a slot-preserving 5-tier fallback hierarchy.
 */
function selectStratifiedPortfolio(validCandidates, quizPlan, targetSize = 10) {
  const selected = [];
  const selectedIds = new Set();
  const planSlots = Array.isArray(quizPlan?.slots) ? quizPlan.slots : [];

  const isAvailable = (item) => !selectedIds.has(getCandidateId(item));

  // Tiers 1–4: Slot-Preserving Stratified Selection
  for (const slot of planSlots) {
    if (selected.length >= targetSize) break;

    const normSlot = slot.slotId;
    const normConcept = slot.conceptId;
    const normBloom = (slot.targetBloom || slot.expectedFraming || '').toUpperCase();
    const normDiff = (slot.targetDifficulty || '').toUpperCase();

    // Tier 1: SlotId + Concept + Bloom + Difficulty
    let match = validCandidates.find(item =>
      isAvailable(item) &&
      (!normSlot || item.slotId === normSlot) &&
      item.conceptId === normConcept &&
      (item.targetBloom || '').toUpperCase() === normBloom &&
      (item.targetDifficulty || '').toUpperCase() === normDiff
    );

    // Tier 2: SlotId + Concept + Bloom
    if (!match) {
      match = validCandidates.find(item =>
        isAvailable(item) &&
        (!normSlot || item.slotId === normSlot) &&
        item.conceptId === normConcept &&
        (item.targetBloom || '').toUpperCase() === normBloom
      );
    }

    // Tier 3: SlotId + Concept + Difficulty
    if (!match) {
      match = validCandidates.find(item =>
        isAvailable(item) &&
        (!normSlot || item.slotId === normSlot) &&
        item.conceptId === normConcept &&
        (item.targetDifficulty || '').toUpperCase() === normDiff
      );
    }

    // Tier 4: SlotId + Concept
    if (!match) {
      match = validCandidates.find(item =>
        isAvailable(item) &&
        (!normSlot || item.slotId === normSlot) &&
        item.conceptId === normConcept
      );
    }

    if (match) {
      selected.push(match);
      selectedIds.add(getCandidateId(match));
    }
  }

  // Tier 5: Fill remaining capacity with highest quality unselected valid candidates
  if (selected.length < targetSize) {
    const remainingCandidates = validCandidates
      .filter(isAvailable)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

    for (const candidate of remainingCandidates) {
      if (selected.length >= targetSize) break;
      selected.push(candidate);
      selectedIds.add(getCandidateId(candidate));
    }
  }

  return selected;
}

module.exports = {
  getCandidateId,
  selectStratifiedPortfolio
};
