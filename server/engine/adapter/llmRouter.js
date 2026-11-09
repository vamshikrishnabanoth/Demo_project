/**
 * server/engine/adapter/llmRouter.js
 *
 * Universal LLM Router supporting multi-tier Groq failover and strict production safety:
 * 1. Tier-1 Groq Cloud: llama-3.3-70b-versatile (High Quality)
 * 2. Tier-2 Groq Cloud: llama-3.1-8b-instant (High Throughput / 30x higher RPM limit on 429)
 * 3. Local Fine-Tuned Llama 3 8B: Ollama 'quiz-expert' / FastAPI ai_service :8000
 * 4. Local vLLM Endpoint
 * 5. Production Rule: No Provider -> Throw NO_LLM_PROVIDER_AVAILABLE (Zero fabricated MCQs in production).
 */

'use strict';

const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) {}

const axios = require('axios');
const providerConfig = require('../../config/providerConfig');
const productionMetrics = require('../../utils/productionMetrics');

class LLMRouter {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || null;
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    this.geminiCooldownUntil = 0;
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
    this.vllmUrl = process.env.VLLM_URL || null;
    this.activeProvider = process.env.DEFAULT_LLM_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : (process.env.GEMINI_API_KEY ? 'gemini' : 'local_ollama'));
    this.keyCooldowns = new Map();
    this.modelCooldowns = new Map();
    // Process-local in-memory cache for daily token limits (12h TTL).
    // Intentionally process-local: prevents repeated quota burn during instance lifecycle,
    // while process restarts safely clear the cache to probe for refreshed daily quotas.
    this.tpdExhaustedRoutes = new Map();
    this.invalidKeys = new Set();
    this.currentKeyIndex = 0;
  }

  /** Sleep helper for exponential backoff on rate limits */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Route completion request to active LLM provider with intelligent failover.
   * @param {Object} params - { prompt, systemPrompt, temperature, responseFormat, model, sessionId }
   */
  async complete({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null, sessionId = null, maxTokens = null, operation = null, signal = null, abortSignal = null }) {
    const effectiveSignal = signal || abortSignal;
    if (!this.groqApiKey && process.env.GROQ_API_KEY) {
      this.groqApiKey = process.env.GROQ_API_KEY;
    }
    if (!this.geminiApiKey && process.env.GEMINI_API_KEY) {
      this.geminiApiKey = process.env.GEMINI_API_KEY;
    }

    const errors = [];

    // Resolve model cleanly: use active models on user key
    let primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    let fallbackModel = process.env.GROQ_FALLBACK_MODEL || (primaryModel === 'openai/gpt-oss-120b' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b');
    if (model) {
      primaryModel = model;
    }

    const preferredProvider = process.env.DEFAULT_LLM_PROVIDER || (this.groqApiKey ? 'groq' : (this.geminiApiKey ? 'gemini' : 'local_ollama'));

    // 0. If preferred provider is Gemini, try Gemini first
    if (preferredProvider === 'gemini' && (this.geminiApiKey || process.env.GEMINI_API_KEY)) {
      try {
        return await this._callGemini({
          prompt,
          systemPrompt,
          temperature,
          responseFormat,
          model: (model && String(model).startsWith('gemini')) ? model : (process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
          sessionId,
          maxTokens,
          operation,
          signal: effectiveSignal
        });
      } catch (err) {
        errors.push(`Gemini (${err.message})`);
        console.warn(`⚠️ [LLMRouter] Primary Gemini provider failed: ${err.message}. Trying Groq fallback...`);
      }
    }

    // 1. Try Primary Groq Cloud (bounded retry on 429, with high-quality fallback)
    if (this.groqApiKey) {
      try {
        return await this._callGroqWithRetry({
          prompt,
          systemPrompt,
          temperature,
          primaryModel,
          fallbackModel,
          sessionId,
          maxTokens,
          operation,
          signal: effectiveSignal
        });
      } catch (err) {
        errors.push(`Groq (${err.message})`);
        console.warn(`⚠️ [LLMRouter] Groq provider failed: ${err.message}. Trying Gemini fallback...`);
      }
    }

    // 2. Try Gemini Provider (Cloud Fallback for Groq 429 / failure)
    if (preferredProvider !== 'gemini' && (this.geminiApiKey || process.env.GEMINI_API_KEY)) {
      try {
        return await this._callGemini({
          prompt,
          systemPrompt,
          temperature,
          responseFormat,
          model,
          sessionId,
          maxTokens,
          operation
        });
      } catch (err) {
        errors.push(`Gemini (${err.message})`);
        console.warn(`⚠️ [LLMRouter] Gemini provider failed: ${err.message}. Trying local AI...`);
      }
    }

    // 3. Try Local Ollama / FastAPI AI service (Dev-only / Explicitly enabled)
    const isLocalLlmEnabled = process.env.ENABLE_LOCAL_LLM === 'true' || process.env.LOCAL_AI_ENABLED === 'true';
    if (isLocalLlmEnabled) {
      try {
        return await this._callOllama({ prompt, systemPrompt, temperature, model: model || 'quiz-expert', sessionId });
      } catch (err) {
        errors.push(`Local Ollama (${err.message})`);
      }

      // 4. Try Local vLLM if configured
      if (this.vllmUrl) {
        try {
          return await this._callVLLM({ prompt, systemPrompt, temperature, sessionId });
        } catch (err) {
          errors.push(`vLLM (${err.message})`);
        }
      }
    }

    // 5. Check for mock test mode ONLY if explicitly enabled for unit tests and NOT in production or staging
    const isMockPermitted = (process.env.ALLOW_MOCK_FALLBACK === 'true' || process.env.NODE_ENV === 'test') &&
                            process.env.NODE_ENV !== 'production' &&
                            process.env.APP_ENV !== 'staging';
    if (isMockPermitted) {
      console.warn('⚠️ [LLMRouter] Using test mock fallback because ALLOW_MOCK_FALLBACK is enabled in non-production.');
      return this._getMockResponse(prompt, systemPrompt);
    }

    // 6. PRODUCTION SAFETY RULE: No provider -> Fail honestly! NEVER return fabricated mock MCQs!
    const errMsg = `NO_LLM_PROVIDER_AVAILABLE: All AI providers failed [${errors.join('; ')}]. Please verify your API key or try again in a few moments.`;
    console.error(`❌ [LLMRouter] ${errMsg}`);
    const fatalError = new Error(errMsg);
    fatalError.code = 'NO_LLM_PROVIDER_AVAILABLE';
    throw fatalError;
  }

  _getGroqKeys() {
    const foundKeys = [];
    // Dynamically collect all available keys configured across environments
    for (const [name, val] of Object.entries(process.env)) {
      if ((name.startsWith('GROQ_API_KEY') || name.startsWith('GROQ_KEY')) && typeof val === 'string' && val.trim().length > 10) {
        if (val.includes(',')) {
          foundKeys.push(...val.split(',').map(k => k.trim()));
        } else {
          foundKeys.push(val.trim());
        }
      }
    }
    if (this.groqApiKey) foundKeys.push(this.groqApiKey);
    if (process.env.GROQ_API_KEYS) {
      foundKeys.push(...process.env.GROQ_API_KEYS.split(',').map(k => k.trim()));
    }
    return Array.from(new Set(foundKeys.filter(Boolean)));
  }

  /** Call Groq Cloud API with configured model, multi-key pool, and bounded rate-limit backoff */
  async _callGroqWithRetry({ prompt, systemPrompt, temperature, primaryModel, fallbackModel, sessionId = null, maxTokens = null, operation = null, signal = null, abortSignal = null }) {
    const effectiveSignal = signal || abortSignal;
    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (operation === 'LECTURE_INTELLIGENCE') {
        resolvedMaxTokens = 4096;
      } else if (operation === 'ASSESSMENT_PLANNING') {
        resolvedMaxTokens = 2500;
      } else if (operation === 'QUESTION_GENERATION') {
        resolvedMaxTokens = 1600;
      } else if (operation === 'EVALUATION' || prompt.includes('[PEDAGOGICAL & FACTUAL TRUTHFULNESS EVALUATION]')) {
        resolvedMaxTokens = 4096;
      } else
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 1100; // Calibrated for single MCQ to reduce Groq TPM reservation
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 2500;
      } else {
        resolvedMaxTokens = 2048;
      }
    }
    const keys = this._getGroqKeys();
    if (keys.length === 0) throw new Error('GROQ_API_KEY is missing');

    // High-performance model cascade across available Groq keys:
    // 1. Primary (e.g. openai/gpt-oss-120b)
    // 2. High-speed reasoning model (qwen/qwen3.8-27b - ~1.0s latency, distinct daily quota)
    // 3. Fallback (openai/gpt-oss-20b)
    const configuredModels = process.env.GROQ_MODELS ? process.env.GROQ_MODELS.split(',').map(m => m.trim()).filter(Boolean) : [];
    const baseModels = configuredModels.length > 0
      ? configuredModels
      : (operation === 'EVALUATION' ? ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
    const modelsToTry = Array.from(new Set([primaryModel, ...baseModels, fallbackModel].filter(Boolean)));
    const totalKeys = keys.length;
    const groqTimeoutMs = parseInt(process.env.GROQ_TIMEOUT_MS, 10) || 15000;
    let lastErr = null;

    // Distribute concurrent calls evenly across available keys by advancing starting key index per invocation
    const startKeyOffset = (this.currentKeyIndex++) % totalKeys;

    // Up to 3 passes across the pool with bounded cooldown sleep if keys are temporarily throttled
    for (let poolAttempt = 0; poolAttempt < 5; poolAttempt++) {
      for (let offset = 0; offset < totalKeys; offset++) {
        const keyIdx = (startKeyOffset + offset) % totalKeys;
        const key = keys[keyIdx];
        // Check if key was permanently invalidated (e.g. 401/403)
        if (this.invalidKeys.has(keyIdx)) {
          continue;
        }

        // Check if key is currently in cooldown (with 50ms tolerance for clock jitter)
        const cooldownUntil = this.keyCooldowns.get(keyIdx) || 0;
        const now = Date.now();
        if (now < cooldownUntil - 50) {
          continue; // Key is in cooldown, check next key
        }

        let keySucceeded = false;
        for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
          const currentModel = modelsToTry[mIdx];
          const isLastModel = mIdx === modelsToTry.length - 1;

          // Check if this specific model is currently in short-term cooldown on this key
          // Check if route is in 12-hour TPD exhaustion
          const tpdUntil = this.tpdExhaustedRoutes.get(`${keyIdx}_${currentModel}`) || 0;
          if (Date.now() < tpdUntil) {
            continue; // Skip directly: TPD route unavailable for 12 hours
          }

          const modelCooldownUntil = this.modelCooldowns.get(`${keyIdx}_${currentModel}`) || 0;
          if (Date.now() < modelCooldownUntil - 50) {
            continue; // Skip directly to fallback model without network delay
          }

          let attempts = 0;
          const maxAttempts = 1; // 1 attempt per model, then fail over to fallback model or next key immediately

          while (attempts < maxAttempts) {
            attempts++;
            const combinedPromptText = `${systemPrompt || ''} ${prompt || ''}`.toLowerCase();
            const hasJsonWord = combinedPromptText.includes('json');
            const sanitizedSystemPrompt = systemPrompt
              ? (hasJsonWord ? systemPrompt : `${systemPrompt}\nOutput valid JSON format.`)
              : 'Output valid JSON format.';
            const finalUserPrompt = prompt.toLowerCase().includes('json')
              ? prompt
              : `${prompt}\n\nReturn strictly valid JSON format.`;

            const requestPayload = {
              model: currentModel,
              messages: [
                ...(sanitizedSystemPrompt ? [{ role: 'system', content: sanitizedSystemPrompt }] : []),
                { role: 'user', content: finalUserPrompt }
              ],
              temperature: temperature,
              max_tokens: resolvedMaxTokens || 2500
            };
            // Groq json_object is only supported on select models; openai/gpt-oss models fail validation if response_format is passed
            if (!currentModel.includes('openai') && !currentModel.includes('gpt-oss')) {
              requestPayload.response_format = { type: 'json_object' };
            }

            try {
              const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                requestPayload,
                {
                  headers: {
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: groqTimeoutMs,
                  signal: effectiveSignal || undefined
                }
              );

              const choice = response.data.choices[0];
              const content = choice.message.content;
              if (!content || typeof content !== 'string' || !content.trim()) {
                throw new Error(`Groq model '${currentModel}' returned empty content.`);
              }
              if (choice.finish_reason === 'length') {
                console.warn(`⚠️ [LLMRouter] Completion truncated by max_tokens limit (${resolvedMaxTokens}). Returning received content for resilient parser extraction.`);
              }

              // Record production metrics
              productionMetrics.inc('llm_requests_total');
              if (response.data.usage) {
                productionMetrics.recordTokens(
                  response.data.usage.prompt_tokens || 0,
                  response.data.usage.completion_tokens || 0
                );
              }

              // Success! Clear cooldowns for this key and model
              this.keyCooldowns.delete(keyIdx);
              this.modelCooldowns.delete(`${keyIdx}_${currentModel}`);
              this.currentKeyIndex = (keyIdx + 1) % totalKeys;
              keySucceeded = true;

              if (sessionId) {
                try {
                  const telemetryLedger = require('../observability/telemetryLedger');
                  telemetryLedger.recordCallUsage(sessionId, {
                    prompt,
                    completion: content,
                    usage: response.data.usage,
                    requestId: response.data.id,
                    model: currentModel,
                    provider: 'groq'
                  });
                } catch (_) {}
              }

              return content;
            } catch (err) {
              lastErr = err;
              const status = err.response?.status;
              const errorMsg = err.response?.data?.error?.message || err.message || '';
              const isTPD = errorMsg.includes('tokens per day') || errorMsg.includes('TPD');
              const isRateLimit = status === 429 || errorMsg.includes('429') || errorMsg.includes('Rate limit') || isTPD;
              const isTimeout = err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || err.message?.includes('timeout');
              if (isTimeout) {
                console.warn(`⏳ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' client request timed out after ${groqTimeoutMs}ms. Failing over to alternative model or key...`);
                productionMetrics.inc('provider_timeout_count');
              }

              if (errorMsg.includes('Failed to validate JSON') && attempts === 1) {
                console.warn(`⚠️ [LLMRouter] Groq strict JSON validator rejected '${currentModel}'. Retrying with relaxed JSON prompt...`);
                try {
                  const retryResp = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                      model: currentModel,
                      messages: [
                        ...(sanitizedSystemPrompt ? [{ role: 'system', content: `${sanitizedSystemPrompt}\nReturn pure JSON only.` }] : []),
                        { role: 'user', content: prompt }
                      ],
                      temperature: temperature,
                      max_tokens: 4096
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${key}`,
                        'Content-Type': 'application/json'
                      },
                      timeout: groqTimeoutMs
                    }
                  );
                  const content = retryResp.data.choices[0].message.content;
                  if (!content || typeof content !== 'string' || !content.trim()) {
                    throw new Error(`Groq relaxed JSON retry on '${currentModel}' returned empty content.`);
                  }
                  this.keyCooldowns.delete(keyIdx);
                  this.modelCooldowns.delete(`${keyIdx}_${currentModel}`);
                  this.currentKeyIndex = (keyIdx + 1) % totalKeys;
                  keySucceeded = true;
                  return content;
                } catch (retryErr) {
                  console.warn(`⚠️ [LLMRouter] Relaxed JSON retry failed: ${retryErr.message}`);
                }
              }

              if (isRateLimit) {
                // Parse standard RFC Retry-After header supporting both integer seconds and HTTP-date formats
                let retryAfterSec = null;
                const rawRetryAfter = err.response?.headers?.['retry-after'];
                if (rawRetryAfter) {
                  const asNum = parseFloat(rawRetryAfter);
                  if (!isNaN(asNum)) {
                    retryAfterSec = asNum;
                  } else {
                    const parsedDate = Date.parse(rawRetryAfter);
                    if (!isNaN(parsedDate)) {
                      retryAfterSec = Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
                    }
                  }
                }

                // Check provider-specific reset headers (e.g., x-ratelimit-reset-tokens, x-ratelimit-reset-requests)
                const parseResetVal = (val) => {
                  if (!val) return null;
                  const str = String(val).trim();
                  const num = parseFloat(str);
                  if (!isNaN(num) && /^\d+(\.\d+)?s?$/.test(str)) return num;
                  let sec = 0;
                  const m = str.match(/(\d+)\s*m/);
                  if (m) sec += parseInt(m[1], 10) * 60;
                  const s = str.match(/(\d+(?:\.\d+)?)\s*s/);
                  if (s) sec += parseFloat(s[1]);
                  return sec > 0 ? sec : null;
                };

                const resetHeaderSec = parseResetVal(err.response?.headers?.['x-ratelimit-reset-tokens']) ||
                  parseResetVal(err.response?.headers?.['x-ratelimit-reset-requests']);

                const retryMatch = errorMsg.match(/try again in ([\d\.]+)s/i);
                const extractedWaitSec = retryAfterSec !== null ? retryAfterSec : (resetHeaderSec !== null ? resetHeaderSec : (retryMatch ? parseFloat(retryMatch[1]) : null));
                const parsedWaitMs = extractedWaitSec ? Math.ceil(extractedWaitSec * 1000) + 400 : null;

                if (isTPD) {
                  // Prefer actual quota-reset information over assumed fixed 12-hour duration
                  const tpdDurationMs = parsedWaitMs ? Math.max(parsedWaitMs, 60000) : (12 * 60 * 60 * 1000);
                  this.tpdExhaustedRoutes.set(`${keyIdx}_${currentModel}`, Date.now() + tpdDurationMs);
                  this.keyCooldowns.set(keyIdx, Date.now() + Math.min(tpdDurationMs, 3600000));
                  console.warn(`⚡ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' daily token quota exhausted (TPD). Route marked unavailable for ${Math.round(tpdDurationMs / 1000)}s.`);
                } else {
                  // Short-term RPM/TPM limit: apply bounded dynamic backoff to key and route
                  const cooldownMs = parsedWaitMs ? Math.min(Math.max(parsedWaitMs, 2500), 60000) : 3000;
                  this.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
                  this.modelCooldowns.set(`${keyIdx}_${currentModel}`, Date.now() + cooldownMs);
                  console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} hit temporary rate limit (${extractedWaitSec !== null ? extractedWaitSec : 'N/A'}s). Immediate failover to next key in pool...`);
                }
                break; // Break model loop to advance to next key in pool immediately
              } else if (status === 413) {
                console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} request payload exceeded limits (413). Failing over to cloud fallback provider immediately.`);
                throw new Error('Groq request payload too large (413)');
              } else if (status === 401 || status === 403) {
                // Auth/Permission failures invalidate only this specific key; do not treat as daily quota or invalidate whole organization
                console.warn(`🚨 [LLMRouter] Groq Key-${keyIdx + 1} authentication/permission failed (${status}). Marking only Key-${keyIdx + 1} invalid.`);
                this.invalidKeys.add(keyIdx);
                productionMetrics.inc('provider_failure_count');
                break;
              } else if (status === 404) {
                console.warn(`⚠️ [LLMRouter] Model '${currentModel}' not found (404). Marking model unavailable on Key-${keyIdx + 1}.`);
                this.modelCooldowns.set(`${keyIdx}_${currentModel}`, Date.now() + 3600000);
                productionMetrics.inc('provider_failure_count');
                break;
              } else if (status >= 500 && status < 600) {
                // Transient server error: brief cooldown on route, immediate failover to alternative key
                console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} upstream server error (${status}). Immediate failover to next key...`);
                this.modelCooldowns.set(`${keyIdx}_${currentModel}`, Date.now() + 5000);
                productionMetrics.inc('provider_failure_count');
                break;
              } else {
                console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' error (${status}): ${errorMsg}`);
                productionMetrics.inc('provider_failure_count');
                break;
              }
            }
          }
          if (keySucceeded) break;
        }
      }

      // Route accounting across all eligible routes for this operation:
      let unattemptedCount = 0;
      let tpmBackoffCount = 0;
      let tpdExhaustedCount = 0;
      const nowCheck = Date.now();

      for (let kIdx = 0; kIdx < totalKeys; kIdx++) {
        if (this.invalidKeys.has(kIdx)) continue;
        for (const m of modelsToTry) {
          const routeKey = `${kIdx}_${m}`;
          const isTpd = this.tpdExhaustedRoutes.has(routeKey) && nowCheck < this.tpdExhaustedRoutes.get(routeKey);
          const isTpm = this.modelCooldowns.has(routeKey) && nowCheck < this.modelCooldowns.get(routeKey);

          if (isTpd) tpdExhaustedCount++;
          else if (isTpm) tpmBackoffCount++;
          else unattemptedCount++;
        }
      }

      // 1. ALL ELIGIBLE ROUTES TPD-EXHAUSTED -> BREAK IMMEDIATELY! 0ms wait!
      if (unattemptedCount === 0 && tpmBackoffCount === 0 && tpdExhaustedCount > 0) {
        console.warn('⚡ [LLMRouter] All eligible Groq routes for this operation are TPD-exhausted. Fast-failing over to Gemini immediately (0ms delay).');
        break; // Exits Loop 1 -> _callGroq throws -> fallback catches -> calls _callGemini()
      }

      // 2. UNATTEMPTED ROUTES EXIST -> CONTINUE IMMEDIATELY WITHOUT SLEEP
      if (unattemptedCount > 0) {
        continue;
      }

      // 3. TRANSIENT TPM COOLDOWNS -> SLEEP SHORTEST TPM AND RETRY
      if (poolAttempt < 4 && tpmBackoffCount > 0) {
        if (process.env.ALLOW_MOCK_FALLBACK === 'true' && process.env.NODE_ENV !== 'production') {
          break;
        }
        const now = Date.now();
        const shortCooldowns = Array.from(this.modelCooldowns.values()).filter(t => t - now <= 20000 && t - now > 0);
        const waitMs = shortCooldowns.length > 0 ? Math.min(Math.max(...shortCooldowns) - now + 300, 15000) : 3000;
        console.warn(`⏳ [LLMRouter] Transient TPM rate limit. Provider-aware wait ${waitMs}ms before pool pass ${poolAttempt + 2}...`);
        await this._sleep(waitMs);
      }
    }

    throw lastErr || new Error('Configured Groq models failed across all available keys in pool');
  }

  /**
   * Call Google Gemini API as cloud fallback when Groq hits 429/failures.
   */
  async _callGemini({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null, sessionId = null, maxTokens = null, signal = null, abortSignal = null }) {
    const effectiveSignal = signal || abortSignal;
    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 2048; // Gemini has generous token windows; allow full MCQ without truncation
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 3500;
      } else {
        resolvedMaxTokens = 4096;
      }
    }
    const apiKey = (this.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing or empty');
    }

    if (this.geminiCooldownUntil && Date.now() < this.geminiCooldownUntil) {
      const wait = Math.min(3000, Math.max(500, this.geminiCooldownUntil - Date.now()));
      await this._sleep(wait);
    }

    let GoogleGenerativeAI;
    try {
      GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    } catch (e) {
      throw new Error(`@google/generative-ai SDK not available: ${e.message}`);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Configurable model cascade: verified supported models from Google ModelService API
    const candidateModels = Array.from(new Set([
      process.env.GEMINI_MODEL,
      model && typeof model === 'string' && model.startsWith('gemini') ? model : null,
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemma-4-26b-a4b-it'
    ].filter(Boolean)));

    let lastErr = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      for (const geminiModelName of candidateModels) {
        try {
          const modelConfig = {
          model: geminiModelName,
          generationConfig: {
            temperature: typeof temperature === 'number' ? temperature : 0.3,
            maxOutputTokens: resolvedMaxTokens || 2048
          }
        };

        if (responseFormat === 'json') {
          modelConfig.generationConfig.responseMimeType = 'application/json';
        }

        // For Gemini 2.5 thinking models, disable hidden thinking tokens so full output budget is preserved for structured JSON
        if (geminiModelName.includes('2.5') || geminiModelName.includes('thinking')) {
          modelConfig.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
          modelConfig.systemInstruction = systemPrompt.trim();
        }

        const generativeModel = genAI.getGenerativeModel(modelConfig);

        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text || !text.trim()) {
          throw new Error('Gemini returned an empty response');
        }

        productionMetrics.inc('llm_requests_total');

        if (sessionId) {
          try {
            const telemetryLedger = require('../observability/telemetryLedger');
            telemetryLedger.recordCallUsage(sessionId, {
              prompt,
              completion: text,
              model: geminiModelName,
              provider: 'gemini'
            });
          } catch (_) {}
        }

        return text.trim();
      } catch (err) {
        lastErr = err;
        const msg = err.message || '';
        const status = err.status || (msg.includes('429') ? 429 : (msg.includes('403') ? 403 : (msg.includes('404') ? 404 : 500)));

        if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
          const cooldownMs = 4000;
          this.geminiCooldownUntil = Date.now() + cooldownMs;
          console.warn(`⚠️ [LLMRouter] Gemini hit transient rate limit (429). Bounded cooldown ${cooldownMs}ms...`);
          await this._sleep(cooldownMs);
          continue;
        } else if (status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('leaked') || msg.includes('API key')) {
          this.geminiCooldownUntil = Date.now() + 3600000;
          console.warn(`🚨 [LLMRouter] Gemini authentication error (${msg}). Marking key unavailable.`);
          break;
        } else if (status === 404 || msg.includes('not found') || msg.includes('is not supported')) {
          console.warn(`⚠️ [LLMRouter] Gemini model '${geminiModelName}' not found or unsupported. Trying next candidate model...`);
          continue;
        } else {
          console.warn(`⚠️ [LLMRouter] Gemini call failed for '${geminiModelName}': ${msg}`);
          await this._sleep(1500);
          continue;
        }
      }
    }
  }

    throw lastErr || new Error('All Gemini candidate models failed');
  }

  /** Call local FastAPI / Ollama backend */
  async _callOllama({ prompt, systemPrompt, temperature, model, sessionId = null }) {
    try {
      const resp = await axios.post(`${this.aiServiceUrl}/generate_quiz`, {
        topic: prompt,
        count: 5,
        difficulty: 'Medium'
      }, { timeout: 3000 });

      if (resp.data && resp.data.questions) {
        const text = JSON.stringify(resp.data.questions);
        if (sessionId) {
          try {
            const telemetryLedger = require('../observability/telemetryLedger');
            telemetryLedger.recordCallUsage(sessionId, { prompt, completion: text, model: model || 'quiz-expert', provider: 'fastapi' });
          } catch (_) {}
        }
        return text;
      }
    } catch (e) {
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      const resp = await axios.post(this.ollamaUrl, {
        model: model || 'quiz-expert',
        prompt: fullPrompt,
        stream: false,
        options: { temperature: temperature }
      }, { timeout: 4000 });

      if (resp.data && resp.data.response) {
        const text = resp.data.response;
        if (sessionId) {
          try {
            const telemetryLedger = require('../observability/telemetryLedger');
            telemetryLedger.recordCallUsage(sessionId, { prompt: fullPrompt, completion: text, model: model || 'quiz-expert', provider: 'ollama' });
          } catch (_) {}
        }
        return text;
      }
      throw e;
    }
  }

  /** Call local vLLM API */
  async _callVLLM({ prompt, systemPrompt, temperature, sessionId = null }) {
    if (!this.vllmUrl) throw new Error('VLLM_URL is missing');
    const resp = await axios.post(`${this.vllmUrl}/v1/completions`, {
      prompt: `${systemPrompt}\n\n${prompt}`,
      temperature: temperature,
      max_tokens: 1024
    }, { timeout: 10000 });
    const text = resp.data.choices[0].text;
    if (sessionId) {
      try {
        const telemetryLedger = require('../observability/telemetryLedger');
        telemetryLedger.recordCallUsage(sessionId, { prompt, completion: text, model: 'vllm-local', provider: 'vllm' });
      } catch (_) {}
    }
    return text;
  }

  /** Deterministic Mock Response ONLY for unit testing */
  _getMockResponse(prompt = '', systemPrompt = '') {
    const combined = (systemPrompt + ' ' + prompt).toLowerCase();

    if (combined.includes('agent 1') || combined.includes('assessmentplan')) {
      return JSON.stringify({
        subject: 'Computer Science',
        mainTopic: 'Core Lecture Topic',
        subtopics: ['Concept A', 'Concept B'],
        teachingEmphasis: { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
        targetCount: 3,
        assessmentTargets: [
          {
            targetId: 'T01',
            concept: 'Primary Concept Analysis',
            dimension: 'Conceptual',
            cognitiveLevel: 'Understand',
            targetDifficulty: 'Medium',
            evidenceType: 'VOICE + DOCUMENT',
            requiresExactArtifact: false,
            instruction: 'Test primary understanding.'
          }
        ],
        reserveTargets: []
      });
    }

    if (combined.includes('agent 3') || combined.includes('evaluat')) {
      return JSON.stringify({
        status: 'PASS',
        failureReason: null,
        repairInstruction: null,
        groundingScore: 0.95
      });
    }

    return JSON.stringify({
      targetId: 'T01',
      questionText: 'Which statement accurately reflects the lecture concept?',
      options: [
        'The primary definition presented in the session evidence',
        'An unsupported contradictory claim',
        'An unrelated alternative',
        'A superficial misconception'
      ],
      correctAnswer: 'The primary definition presented in the session evidence',
      explanation: 'Supported directly by session evidence.',
      metadata: {
        dimension: 'Conceptual',
        cognitiveLevel: 'Understand',
        targetDifficulty: 'Medium'
      }
    });
  }
}

const routerInstance = new LLMRouter();
routerInstance.LLMRouter = LLMRouter;
module.exports = routerInstance;
