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
  lines.push(`- STRICT ANTI-META-REFERENCE: Never use document structural labels like 'Scenario 1', 'Scenario 2', 'Paragraph X', 'Assignment 1', or 'In this document'. Frame questions as independent, self-contained technical/domain scenarios.`);

  if (slot.executable || slot.canGenerateSyntaxQuestion) {
    lines.push(`- EXECUTABLE SYNTAX DIRECTIVE: Construct a practical query, command execution, or syntax correctness question (e.g. 'Which query correctly...', 'Which statement updates...', 'What will this operator produce?').`);
    lines.push(`- SYNTACTICALLY PLAUSIBLE DISTRACTORS: All 4 options MUST be syntactically plausible, domain-relevant executable syntax or query choices. Avoid abstract non-executable definitions.`);
  }

  if (slot.learningObjective) {
    lines.push(`- TARGET LEARNING OBJECTIVE: "${slot.learningObjective}"`);
  }

  return lines.join('\n');
}

module.exports = {
  buildConstraintText
};
