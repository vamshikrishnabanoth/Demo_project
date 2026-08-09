const crypto = require('crypto');

/**
 * 6. MEMORY-EFFICIENT ITEM ASSEMBLY
 * Stores only rawResponseLength and 12-character rawResponseHash in item metadata.
 * Does NOT retain full raw text bodies long-term in memory.
 */
function assembleCandidateItem(opts) {
  const {
    slotPayload = {},
    validatedSchema = {},
    llmResponse = {},
    attempts = 1,
    retryHistory = [],
    parseRepairApplied = false,
    unicodeNormalized = false,
    reqId = 'req_001'
  } = opts;

  const rawText = llmResponse.rawText || '';
  const rawResponseLength = rawText.length;
  const rawResponseHash = crypto.createHash('sha256').update(rawText).digest('hex').substring(0, 12);

  const slotId = slotPayload.slotId || 'slot_001_concept';
  const requestId = `${reqId}_${slotId}`;

  return {
    requestId,
    slotId,
    slotIndex: slotPayload.metadata?.slotIndex || 1,
    conceptId: slotPayload.conceptId || 'concept_001',
    conceptLabel: slotPayload.userPrompt?.match(/Target Concept:\s*"([^"]+)"/)?.[1] || slotPayload.conceptId || 'Concept',
    conceptType: slotPayload.userPrompt?.match(/Target Concept:\s*"[^"]+"\s*\(([^)]+)\)/)?.[1] || 'GENERAL_CONCEPT',
    targetDifficulty: slotPayload.userPrompt?.match(/Target Cognitive Level:\s*\w+\s*\(([^)]+)\)/)?.[1] || 'EASY',
    targetBloom: slotPayload.userPrompt?.match(/Target Cognitive Level:\s*(\w+)/)?.[1] || 'RECALL',
    expectedFraming: slotPayload.userPrompt?.match(/Framing Style:\s*(\w+)/)?.[1] || 'DEFINITION',
    stem: validatedSchema.stem,
    options: validatedSchema.options,
    correctAnswer: validatedSchema.correctAnswer,
    explanation: validatedSchema.explanation,
    sourceEvidence: {
      text: slotPayload.userPrompt?.match(/Primary Evidence Snippet:\s*"""\s*([\s\S]*?)\s*"""/)?.[1] || '',
      evidenceBounds: slotPayload.pipelineAttached?.evidenceBounds || [[0, 50]],
      summaryContext: slotPayload.pipelineAttached?.summaryContext || ''
    },
    metadata: {
      promptHash: slotPayload.metadata?.promptHash || '000000000000',
      versions: slotPayload.versions || {}
    },
    providerDiagnostics: {
      provider: llmResponse.providerDiagnostics?.provider || 'groq',
      model: llmResponse.providerDiagnostics?.model || 'llama-3.1-8b-instant',
      capabilities: llmResponse.providerDiagnostics?.capabilities || { supportsJSONMode: true, maxContextTokens: 8192 },
      startedAt: llmResponse.startedAt || Date.now(),
      finishedAt: llmResponse.finishedAt || Date.now(),
      latencyMs: llmResponse.latencyMs || 0,
      completionTokens: llmResponse.responseTokens || 0,
      rawResponseLength,
      rawResponseHash
    },
    pipelineDiagnostics: {
      attempts,
      parseRepairApplied,
      unicodeNormalized,
      circuitBroken: false
    },
    retryHistory
  };
}

module.exports = {
  assembleCandidateItem
};
