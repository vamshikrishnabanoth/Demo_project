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

  const diff = String(slot.targetDifficulty || 'EASY').toUpperCase();
  const bloom = String(slot.targetBloom || 'RECALL').toUpperCase();
  const framing = slot.framingStyle || slot.expectedFraming || 'Conceptual';

  lines.push(`- Stem Blueprint Pattern: "${slot.stemPattern || 'Analyze the concept'}"`);

  if (diff === 'HARD' || bloom === 'ANALYZE' || bloom === 'EVALUATE') {
    lines.push(`- HARD COGNITIVE DEPTH: Construct a question requiring multi-step deduction or cause-and-effect reasoning using ONLY the provided evidence snippet. Depth is measured by scenario constraints and analytical options, NOT word count.`);
  } else if (diff === 'MEDIUM' || bloom === 'APPLY') {
    lines.push(`- MEDIUM COGNITIVE DEPTH: Construct an application-based question testing procedural execution or scenario application.`);
  } else {
    lines.push(`- EASY COGNITIVE DEPTH: Construct a direct factual recall question testing core definitions or key properties.`);
  }

  lines.push(`- STRICT TRANSCRIPT GROUNDING: Every option and explanation MUST be strictly derived from the provided Source Context. Do NOT introduce outside frameworks (e.g. Object-Oriented Programming, external CS paradigms) unless explicitly present in the source snippet.`);

  if (hints.prerequisiteIds && hints.prerequisiteIds.length > 0) {
    lines.push(`- Prerequisite Concepts: ${hints.prerequisiteIds.join(', ')}`);
  }

  return lines.join('\n');
}

module.exports = {
  buildConstraintText
};
