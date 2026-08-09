const { REPAIR_CONFIG } = require('../../config/repairConfig');

/**
 * 2. DIAGNOSTICS-AWARE PROMPT BUILDER
 * Caps evidence text and incorporates Stage 6 validation failure reasons directly into prompt.
 */
function buildConsolidatedRepairPrompt(item, hints = [], findings = {}) {
  const instructions = [];

  if (hints.includes(REPAIR_CONFIG.HINTS.REGENERATE_DISTRACTORS)) {
    instructions.push("- Regenerate 3 NEW, plausible distractor choices that are domain-relevant but clearly incorrect.");
  }
  if (hints.includes(REPAIR_CONFIG.HINTS.IMPROVE_BLOOM_ALIGNMENT)) {
    instructions.push(`- Rephrase the stem and reasoning depth to align strictly with target Bloom level: ${item.targetBloom || 'APPLICATION'}.`);
  }
  if (hints.includes(REPAIR_CONFIG.HINTS.REDUCE_OPTION_AMBIGUITY)) {
    instructions.push("- Ensure option choices do not exhibit typographical similarity or overlapping conceptual ambiguity.");
  }
  if (hints.includes(REPAIR_CONFIG.HINTS.REWRITE_DUPLICATE_STEM)) {
    instructions.push("- Rephrase the question stem using distinct vocabulary to prevent semantic duplication with existing items.");
  }

  if (instructions.length === 0) {
    instructions.push("- Improve distractor plausibility and align wording strictly with source evidence.");
  }

  // Cap Evidence Snippet to 1200 chars
  const rawSnippet = item.sourceEvidence?.text || item.sourceEvidence?.summaryContext || item.evidence || "";
  const cappedSnippet = rawSnippet.length > REPAIR_CONFIG.MAX_EVIDENCE_SNIPPET_CHARS
    ? rawSnippet.substring(0, REPAIR_CONFIG.MAX_EVIDENCE_SNIPPET_CHARS) + "..."
    : rawSnippet;

  // Compile Failure Diagnostics Block
  const warnings = findings.majorWarnings || findings.criticalFailures || [];
  const diagnosticsBlock = warnings.length > 0
    ? `PREVIOUS VALIDATION FAILURE DIAGNOSTICS (Quality Score: ${item.qualityScore || 0.0}):\n` +
      warnings.map(w => `- [${w.code || 'WARN'}] ${w.message || w}`).join('\n')
    : `Quality Score Before Repair: ${item.qualityScore || 0.0}`;

  const userPrompt = `
You are an academic assessment specialist performing a surgical repair on an MCQ candidate item.

SOURCE EVIDENCE SNIPPET:
"""
${cappedSnippet}
"""

CURRENT QUESTION ITEM:
Stem: "${item.stem || item.question || item.questionText}"
Options: ${JSON.stringify(item.options)}
Correct Answer: "${item.correctAnswer}"
Target Concept: "${item.conceptLabel || item.conceptId}"

${diagnosticsBlock}

REQUIRED SURGICAL REPAIRS:
${instructions.join('\n')}

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. Do NOT introduce facts, acronyms, or claims outside the source snippet.
2. Do NOT shift the core concept or target answer logic.
3. Ensure the correct answer string matches one of the 4 option choices verbatim.
4. Avoid generic meta-choices ("All of the above", "None of the above").

OUTPUT FORMAT CONTRACT:
Return ONLY a raw, valid JSON object with the following structure:
{
  "stem": "Repaired or original question stem...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Exact verbatim matching option string from the options array...",
  "explanation": "Updated or original explanation..."
}
`;

  return {
    systemPrompt: "You are an expert academic assessment specialist performing targeted MCQ repairs.",
    userPrompt
  };
}

module.exports = {
  buildConsolidatedRepairPrompt
};
