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
    const expectedFraming = slotFramings[idx] || "Conceptual";
    const promptProfile = PLANNER_CONFIG.FRAMING_PROFILES[expectedFraming] || PLANNER_CONFIG.FRAMING_PROFILES.DEFINITION;

    const evidenceBounds = conceptIndex[conceptId] || node.evidenceOffsets || [[0, 50]];
    const summaryContext = node.summaryContext || node.evidenceText || `Source context for concept ${node.label || conceptId}.`;

    const stemPatterns = {
      Conceptual: "What is the primary role / core property of {{concept}}?",
      Scenario: "An engineer encounters a system scenario involving {{concept}}. Which design choice best applies?",
      Diagnostic: "A defect or anomaly is detected in {{concept}}. What is the root cause?",
      "Trade-Off": "When evaluating {{concept}} under operational constraints, what is the primary trade-off?"
    };

    const framingStyle = expectedFraming;
    const stemPattern = (stemPatterns[framingStyle] || stemPatterns.Conceptual).replace('{{concept}}', node.label || conceptId);

    return {
      slotId,
      slotIndex,
      conceptId,
      conceptLabel: node.label || conceptId,
      conceptType: node.conceptType || "GENERAL_CONCEPT",
      targetDifficulty: distInfo.targetDifficulty,
      targetBloom: distInfo.targetBloom,
      bloomLevel: distInfo.targetBloom,
      framingStyle,
      stemPattern,
      expectedFraming,
      promptProfile,
      evidenceBounds,
      summaryContext,
      evidenceText: summaryContext,
      plannerHints: {
        bloomLevel: distInfo.targetBloom,
        prerequisiteIds: node.prerequisites || [],
        reasoningPattern: framingStyle,
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
