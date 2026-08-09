/**
 * Constraint Builder: Translates promptProfile & plannerHints into explicit text rules
 */
function buildConstraintText(slot) {
  const profile = slot.promptProfile || {};
  const hints = slot.plannerHints || {};

  const lines = [
    `- Target Concept: "${slot.conceptLabel || slot.conceptId}" (${slot.conceptType || 'GENERAL_CONCEPT'})`,
    `- Target Cognitive Level: ${slot.targetBloom || 'RECALL'} (${slot.targetDifficulty || 'EASY'})`,
    `- Framing Style: ${slot.expectedFraming || 'DEFINITION'}`,
    `- Max Stem Length: ${profile.maxStemLength || 200} characters`,
    `- Distractor Strategy: ${profile.distractorStyle || 'peer_concept'}`,
    `- Allow Numerical Data: ${profile.allowNumerical ? 'YES' : 'NO'}`,
    `- Allow Code Snippets: ${profile.allowCode ? 'YES' : 'NO'}`,
    `- Requires Calculation: ${profile.requiresCalculation ? 'YES' : 'NO'}`,
    `- Allow Negation ("Which is NOT..."): ${profile.allowNegation ? 'YES' : 'NO'}`
  ];

  if (hints.prerequisiteIds && hints.prerequisiteIds.length > 0) {
    lines.push(`- Prerequisite Concepts: ${hints.prerequisiteIds.join(', ')}`);
  }

  return lines.join('\n');
}

module.exports = {
  buildConstraintText
};
