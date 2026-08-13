const { performance } = require('perf_hooks');
const { GENERATOR_CONFIG } = require('../../config/generatorConfig');
const { dispatchLLMRequest } = require('./llmClient/index');
const mockAdapter = require('./llmClient/mockAdapter');
const circuitBreaker = require('./circuitBreaker');
const { waitWithJitter } = require('./retryHandler');
const { normalizeUnicodeText } = require('./unicodeNormalizer');
const { validateParsedMCQSchema } = require('./schemaValidator');
const { assembleCandidateItem } = require('./itemAssembler');

/**
 * MODULE 5 — PROVIDER FALLBACK & GENERATOR DISPATCH
 * Executes slot prompt dispatches with circuit breaker protection,
 * schema-guarded fallback to mockAdapter, unicode sanitization, and slot ordering.
 */
async function generateQuestions(promptPayloads = [], pipelineContext = {}) {
  const startTime = performance.now();
  const reqId = pipelineContext.requestId || pipelineContext.reqId || "req_001";

  const totalSlotsProcessed = promptPayloads.length;
  const candidateItems = [];
  const failedSlots = [];

  let retriesPerformed = 0;
  let timeoutCount = 0;
  let parseRepairCount = 0;
  let unicodeNormalizations = 0;
  let totalLatencySum = 0;
  let insufficientEvidenceSkipped = 0;

  const concurrencyLimit = GENERATOR_CONFIG.CONCURRENCY_LIMIT || 3;

  for (let i = 0; i < promptPayloads.length; i += concurrencyLimit) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, 400));
    }
    const chunk = promptPayloads.slice(i, i + concurrencyLimit);

    const chunkPromises = chunk.map(async (slotPayload, chunkIdx) => {
      const slotIndex = i + chunkIdx + 1;
      slotPayload.metadata = { ...slotPayload.metadata, slotIndex };

      const slotId = slotPayload.slotId || `slot_${String(slotIndex).padStart(3, '0')}`;
      let attempts = 0;
      const retryHistory = [];
      let parseRepairApplied = false;
      let unicodeNormalized = false;

      // Circuit Breaker / Fallback Guard: If broken or offline, route directly to MockAdapter
      if (circuitBreaker.isBroken()) {
        console.warn(`[GENERATOR_FALLBACK] Circuit breaker is OPEN for ${slotId}. Using MockAdapter fallback.`);
        try {
          const mockRes = await mockAdapter.generate(slotPayload);
          const parsedMock = JSON.parse(mockRes.rawText);
          const mockVal = validateParsedMCQSchema(parsedMock);

          if (mockVal.isValid) {
            const item = assembleCandidateItem({
              slotPayload,
              validatedSchema: mockVal,
              llmResponse: { rawText: mockRes.rawText, latencyMs: 50, model: "mock-fallback" },
              attempts: 1,
              retryHistory: [],
              parseRepairApplied: false,
              unicodeNormalized: false,
              reqId
            });
            candidateItems.push(item);
            return;
          }
        } catch (mockErr) {
          console.error(`[GENERATOR_FALLBACK] Mock adapter error for ${slotId}:`, mockErr.message);
        }
      }

      while (attempts <= GENERATOR_CONFIG.MAX_RETRIES_PER_SLOT) {
        attempts++;
        try {
          // Dispatch Primary LLM Request
          const llmResponse = await dispatchLLMRequest(slotPayload);
          totalLatencySum += llmResponse.latencyMs;

          let rawText = llmResponse.rawText || '';

          // Unicode Normalization Pass
          const normalizedText = normalizeUnicodeText(rawText);
          if (normalizedText !== rawText) {
            unicodeNormalized = true;
            unicodeNormalizations++;
            rawText = normalizedText;
          }

          // JSON Parsing & Recovery
          let parsedObj;
          try {
            parsedObj = JSON.parse(rawText);
          } catch (e1) {
            parseRepairApplied = true;
            parseRepairCount++;
            let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }
            parsedObj = JSON.parse(cleaned);
          }

          // Immediate Post-Parsing Schema Validation
          const validation = validateParsedMCQSchema(parsedObj);

          if (validation.isValid) {
            circuitBreaker.recordSuccess();

            const item = assembleCandidateItem({
              slotPayload,
              validatedSchema: validation,
              llmResponse,
              attempts,
              retryHistory,
              parseRepairApplied,
              unicodeNormalized,
              reqId
            });

            candidateItems.push(item);
            return;
          } else {
            if (validation.status === "INSUFFICIENT_EVIDENCE") {
              insufficientEvidenceSkipped++;
            }
            
            failedSlots.push({
              slotId,
              reason: validation.status || "SCHEMA_MISMATCH",
              attempts
            });
            return;
          }
        } catch (err) {
          const errMessage = err.message || String(err);
          if (errMessage === 'TIMEOUT') timeoutCount++;

          circuitBreaker.recordFailure(errMessage);
          retryHistory.push({ attempt: attempts, error: errMessage, timestamp: Date.now() });

          if (attempts <= GENERATOR_CONFIG.MAX_RETRIES_PER_SLOT && !circuitBreaker.isBroken()) {
            retriesPerformed++;
            await waitWithJitter(attempts);
          } else {
            // Primary provider failed; route slot to MockAdapter fallback so pipeline delivers valid questions
            console.warn(`[GENERATOR_FALLBACK] Slot ${slotId} primary dispatch failed. Triggering MockAdapter fallback.`);
            try {
              const mockRes = await mockAdapter.generate(slotPayload);
              const parsedMock = JSON.parse(mockRes.rawText);
              const mockVal = validateParsedMCQSchema(parsedMock);

              if (mockVal.isValid) {
                const item = assembleCandidateItem({
                  slotPayload,
                  validatedSchema: mockVal,
                  llmResponse: { rawText: mockRes.rawText, latencyMs: 50, model: "mock-fallback" },
                  attempts,
                  retryHistory,
                  parseRepairApplied: false,
                  unicodeNormalized: false,
                  reqId
                });
                candidateItems.push(item);
                return;
              }
            } catch (fallbackErr) {
              console.error(`[GENERATOR_FALLBACK] Mock fallback failed for ${slotId}:`, fallbackErr.message);
            }

            failedSlots.push({
              slotId,
              reason: errMessage,
              attempts
            });
            return;
          }
        }
      }
    });

    await Promise.all(chunkPromises);
  }

  // Deterministic Slot Ordering: Sort candidateItems strictly by slotIndex
  candidateItems.sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));

  const totalGenerationTimeMs = Math.round(performance.now() - startTime);
  const avgLatencyMs = candidateItems.length > 0 ? Math.round(totalLatencySum / candidateItems.length) : 0;

  return {
    generatorVersion: GENERATOR_CONFIG.VERSION,
    batchSummary: {
      totalSlotsProcessed,
      successfulGenerations: candidateItems.length,
      insufficientEvidenceSkipped,
      failedSlots: failedSlots.length,
      circuitBroken: circuitBreaker.isBroken(),
      totalGenerationTimeMs
    },
    pipelineDiagnostics: {
      averageLatencyMs: avgLatencyMs,
      retriesPerformed,
      timeoutCount,
      parseRepairCount,
      unicodeNormalizations,
      circuitBreakerTriggered: circuitBreaker.isBroken()
    },
    candidateItems,
    failedSlots
  };
}

module.exports = {
  generateQuestions
};
