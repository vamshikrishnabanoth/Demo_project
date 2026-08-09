const crypto = require('crypto');
const { PROMPT_CONFIG } = require('../../config/promptConfig');
const { extractSnappedContext } = require('./contextExtractor');
const { getExemplarForFraming } = require('./exemplarSelector');
const { buildConstraintText } = require('./constraintBuilder');

/**
 * 5. PAYLOAD ASSEMBLY & DETERMINISTIC PROMPT HASHING
 * Assembles slot prompt payload with version propagation, SHA-256 prompt hash,
 * sentence/newline-snapped snippet, system prompt, and user prompt contract.
 */
function assembleSlotPayload(slot, pipelineContext = {}) {
  const profile = slot.promptProfile || {};
  const conceptNode = (pipelineContext.conceptGraph?.nodes || []).find(n => n.id === slot.conceptId) || {};

  const extractedSnippet = extractSnappedContext(
    pipelineContext.cleanedContent || '',
    slot.evidenceBounds
  );

  const compactExemplar = getExemplarForFraming(slot.expectedFraming);
  const constraintText = buildConstraintText(slot);

  const contextObject = {
    conceptLabel: slot.conceptLabel || slot.conceptId,
    conceptConfidence: conceptNode.confidence || 0.85,
    summaryContext: slot.summaryContext || "",
    evidenceSnippet: extractedSnippet
  };

  const userPrompt = `
STRICT PROMPT CONSTRAINTS:
${constraintText}

SOURCE CONTEXT:
Primary Evidence Snippet:
"""
${contextObject.evidenceSnippet}
"""
Summary Context:
"""
${contextObject.summaryContext}
"""

FORMATTING GUIDANCE:
${compactExemplar}

GENERATION RULES:
${PROMPT_CONFIG.GENERATION_RULES.join('\n')}

OUTPUT FORMAT CONTRACT:
Return ONLY a raw, valid JSON object with the following structure:
{
  "status": "SUCCESS",
  "stem": "Question string...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Exact verbatim matching option string...",
  "explanation": "Explanation quoting source snippet..."
}
`;

  const promptHash = crypto.createHash('sha256').update(userPrompt).digest('hex').substring(0, 12);

  return {
    promptVersion: PROMPT_CONFIG.VERSION,
    versions: {
      graphVersion: pipelineContext.conceptGraph?.graphVersion || "2.6.0",
      plannerVersion: pipelineContext.quizPlan?.plannerVersion || "1.3.0",
      promptVersion: PROMPT_CONFIG.VERSION
    },
    slotId: slot.slotId,
    conceptId: slot.conceptId,
    llmParams: PROMPT_CONFIG.LLM_PARAMS,
    metadata: {
      promptHash,
      slotId: slot.slotId,
      sourceId: pipelineContext.sourceMetadata?.sourceId || "document_upload"
    },
    pipelineAttached: {
      evidenceBounds: slot.evidenceBounds,
      summaryContext: slot.summaryContext
    },
    systemPrompt: PROMPT_CONFIG.SYSTEM_PROMPT,
    userPrompt,
    diagnostics: {
      snippetLengthChars: extractedSnippet.length,
      contextPaddingApplied: Math.abs(extractedSnippet.length - ((slot.evidenceBounds?.[0]?.[1] || 50) - (slot.evidenceBounds?.[0]?.[0] || 0))),
      exemplarUsed: slot.expectedFraming,
      evidenceBoundsCount: slot.evidenceBounds?.length || 1
    }
  };
}

module.exports = {
  assembleSlotPayload
};
