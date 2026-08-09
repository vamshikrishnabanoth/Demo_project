const { PLANNER_CONFIG } = require('../../config/plannerConfig');

/**
 * Pass 4: Immutable Slot IDs, Evidence Binding & Prompt Profiles (planBuilder.js)
 */
function buildPlanSlots(opts) {
  const {
    conceptNodes = [],
    slotDistributions = [],
    slotFramings = [],
    conceptGraph = {}
  } = opts;

  const conceptIndex = conceptGraph.conceptIndex || {};

  const slots = conceptNodes.map((node, idx) => {
    const slotIndex = idx + 1;
    const conceptId = node.id || "core_concept";
    const slotId = `slot_${String(slotIndex).padStart(3, '0')}_${conceptId}`;

    const distInfo = slotDistributions[idx] || { targetDifficulty: "EASY", targetBloom: "RECALL" };
    const expectedFraming = slotFramings[idx] || "DEFINITION";
    const promptProfile = PLANNER_CONFIG.FRAMING_PROFILES[expectedFraming] || PLANNER_CONFIG.FRAMING_PROFILES.DEFINITION;

    const evidenceBounds = conceptIndex[conceptId] || node.evidenceOffsets || [[0, 50]];
    const summaryContext = node.summaryContext || `Source context for concept ${node.label || conceptId}.`;

    return {
      slotId,
      slotIndex,
      conceptId,
      conceptLabel: node.label || conceptId,
      conceptType: node.conceptType || "GENERAL_CONCEPT",
      targetDifficulty: distInfo.targetDifficulty,
      targetBloom: distInfo.targetBloom,
      expectedFraming,
      promptProfile,
      evidenceBounds,
      summaryContext,
      plannerHints: {
        bloomLevel: distInfo.targetBloom,
        prerequisiteIds: node.prerequisites || [],
        reasoningPattern: expectedFraming,
        requiresCode: !!node.hasCodeOrMath,
        expectedEvidenceCount: Array.isArray(evidenceBounds) ? evidenceBounds.length : 1
      }
    };
  });

  return slots;
}

module.exports = {
  buildPlanSlots
};
