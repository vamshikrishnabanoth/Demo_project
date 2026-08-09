const { performance } = require('perf_hooks');
const { dispatchLLMRequest } = require('../questionGenerator/llmClient/index');
const { repairJsonFence } = require('../questionGenerator/jsonRepair');
const { buildConsolidatedRepairPrompt } = require('./repairPromptBuilder');
const { REPAIR_CONFIG } = require('../../config/repairConfig');

function safeClone(obj) {
  return typeof structuredClone === 'function'
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function validateRepairedSchema(patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (typeof patch.stem !== 'string' || patch.stem.trim().length === 0) return false;
  if (!Array.isArray(patch.options) || patch.options.length !== 4) return false;
  if (!patch.options.every(o => typeof o === 'string' && o.trim().length > 0)) return false;
  
  const normChoices = patch.options.map(o => String(o).trim());
  const normAns = typeof patch.correctAnswer === 'string' ? patch.correctAnswer.trim() : "";
  if (!normChoices.includes(normAns)) return false;

  return true;
}

/**
 * 3. SURGICAL EXECUTOR WITH SCHEMA VALIDATION & SHUFFLE
 */
async function executeRepairCall(item, hints = [], findings = {}, pipelineContext = {}) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutMs = REPAIR_CONFIG.TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const repairedItem = safeClone(item);
  const promptPayload = buildConsolidatedRepairPrompt(repairedItem, hints, findings);

  let attempt = 0;
  let response = null;
  let patchData = null;
  let parseError = null;

  try {
    while (attempt <= REPAIR_CONFIG.MAX_LLM_RETRIES) {
      attempt++;
      try {
        response = await dispatchLLMRequest(promptPayload, controller.signal);
        const sanitizedText = repairJsonFence(response.rawText);
        patchData = JSON.parse(sanitizedText);

        if (validateRepairedSchema(patchData)) {
          parseError = null;
          break; // Schema valid
        } else {
          parseError = new Error("Schema validation failed: Options missing correct answer or malformed.");
        }
      } catch (err) {
        parseError = err;
      }
    }

    clearTimeout(timer);

    if (parseError || !patchData) {
      throw new Error(`Repair failed after ${attempt} attempt(s): ${parseError?.message || 'Invalid patch payload'}`);
    }

    // Apply surgical patches safely
    repairedItem.stem = patchData.stem.trim();
    repairedItem.question = patchData.stem.trim();
    repairedItem.questionText = patchData.stem.trim();
    repairedItem.correctAnswer = patchData.correctAnswer.trim();
    repairedItem.options = shuffleArray(patchData.options.map(o => String(o).trim()));
    if (patchData.explanation) repairedItem.explanation = patchData.explanation.trim();

    // Record rich repair telemetry
    const latencyMs = Math.round(performance.now() - startTime);
    repairedItem.repairHistory = [
      ...(repairedItem.repairHistory || []),
      {
        repairVersion: REPAIR_CONFIG.VERSION,
        validatorVersion: item.validatorVersion || "5.8.0",
        attempt,
        hintCount: hints.length,
        repairHints: hints,
        qualityBefore: item.qualityScore || 0.0,
        provider: response?.providerDiagnostics?.provider || "unknown",
        model: response?.providerDiagnostics?.model || "unknown",
        latencyMs,
        completionTokens: response?.responseTokens || 0,
        repairedAt: Date.now(),
        patchApplied: true
      }
    ];

    return repairedItem;
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Repair execution failed for slot ${item.slotId || 'unknown_slot'}: ${err.message}`);
  }
}

module.exports = {
  executeRepairCall,
  safeClone,
  shuffleArray,
  validateRepairedSchema
};
