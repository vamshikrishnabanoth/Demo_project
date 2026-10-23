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
  async complete({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null, sessionId = null }) {
    if (!this.groqApiKey && process.env.GROQ_API_KEY) {
      this.groqApiKey = process.env.GROQ_API_KEY;
    }
    if (!this.geminiApiKey && process.env.GEMINI_API_KEY) {
      this.geminiApiKey = process.env.GEMINI_API_KEY;
    }

    const errors = [];

    // Resolve model cleanly: use active models on user key
    let primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    let fallbackModel = process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile';
    if (model) {
      primaryModel = model;
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
          sessionId
        });
      } catch (err) {
        errors.push(`Groq (${err.message})`);
        console.warn(`⚠️ [LLMRouter] Groq provider failed: ${err.message}. Trying Gemini fallback...`);
      }
    }

    // 2. Try Gemini Provider (Cloud Fallback for Groq 429 / failure)
    if (this.geminiApiKey || process.env.GEMINI_API_KEY) {
      try {
        return await this._callGemini({
          prompt,
          systemPrompt,
          temperature,
          responseFormat,
          model,
          sessionId
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
      if (name.startsWith('GROQ_API_KEY') && typeof val === 'string' && val.trim().length > 10) {
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
  async _callGroqWithRetry({ prompt, systemPrompt, temperature, primaryModel, fallbackModel, sessionId = null }) {
    const keys = this._getGroqKeys();
    if (keys.length === 0) throw new Error('GROQ_API_KEY is missing');

    // 1-Primary + 1-Fallback Standard: Exclude degraded 20B (50% hallucination) & Qwen (147s latency)
    const modelsToTry = Array.from(new Set([primaryModel, fallbackModel].filter(Boolean)));
    const totalKeys = keys.length;
    let lastErr = null;

    // Up to 3 passes across the pool with bounded cooldown sleep if keys are temporarily throttled
    for (let poolAttempt = 0; poolAttempt < 3; poolAttempt++) {
      for (let offset = 0; offset < totalKeys; offset++) {
        const keyIdx = (this.currentKeyIndex + offset) % totalKeys;
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
              : (hasJsonWord ? '' : 'Output valid JSON format.');

            try {
              const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                  model: currentModel,
                  messages: [
                    ...(sanitizedSystemPrompt ? [{ role: 'system', content: sanitizedSystemPrompt }] : []),
                    { role: 'user', content: prompt }
                  ],
                  temperature: temperature,
                  response_format: { type: 'json_object' },
                  max_tokens: 4096
                },
                {
                  headers: {
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 45000
                }
              );

              const content = response.data.choices[0].message.content;

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
                      timeout: 45000
                    }
                  );
                  const content = retryResp.data.choices[0].message.content;
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
                const retryAfterSec = err.response?.headers?.['retry-after']
                  ? parseFloat(err.response.headers['retry-after'])
                  : null;
                const retryMatch = errorMsg.match(/try again in ([\d\.]+)s/i);
                const extractedWaitSec = retryAfterSec || (retryMatch ? parseFloat(retryMatch[1]) : null);
                const parsedWaitMs = extractedWaitSec ? Math.ceil(extractedWaitSec * 1000) + 600 : null;

                if (isTPD || isLastModel) {
                  const cooldownMs = isTPD ? 120000 : (parsedWaitMs || 5000);
                  this.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
                  console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' throttled (${isTPD ? 'daily TPD' : 'rate limit'}). Backing off ${cooldownMs}ms...`);
                } else {
                  // Mark this specific model as temporarily throttled on this key so next requests skip immediately to fallback
                  const modelCooldownMs = parsedWaitMs || 5000;
                  this.modelCooldowns.set(`${keyIdx}_${currentModel}`, Date.now() + modelCooldownMs);
                  console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' hit TPM limit. Failing over to next key or fallback '${modelsToTry[mIdx + 1]}'...`);
                }
                break; // Break inner loop to try fallback model or next key
              } else if (status === 401 || status === 403) {
                console.warn(`🚨 [LLMRouter] Groq Key-${keyIdx + 1} authentication/permission failed (${status}). Marking key invalid.`);
                this.invalidKeys.add(keyIdx);
                productionMetrics.inc('provider_failure_count');
                break;
              } else if (status === 404) {
                console.warn(`⚠️ [LLMRouter] Model '${currentModel}' not found (404). Marking model unavailable on Key-${keyIdx + 1}.`);
                this.modelCooldowns.set(`${keyIdx}_${currentModel}`, Date.now() + 3600000);
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

      // If pass completed without returning, sleep until earliest cooldown expires and retry
      if (poolAttempt < 2 && this.keyCooldowns.size > 0) {
        const earliestCooldown = Math.min(...Array.from(this.keyCooldowns.values()));
        const remaining = earliestCooldown - Date.now();
        if (remaining > 0) {
          const waitMs = Math.min(remaining + 400, 15000);
          console.warn(`⏳ [LLMRouter] All available keys throttled. Bounded wait ${waitMs}ms before pool pass ${poolAttempt + 2}...`);
          await this._sleep(waitMs);
        }
      }
    }

    throw lastErr || new Error('Configured Groq models failed across all available keys in pool');
  }

  /**
   * Call Google Gemini API as cloud fallback when Groq hits 429/failures.
   */
  async _callGemini({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null, sessionId = null }) {
    const apiKey = (this.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing or empty');
    }

    if (this.geminiCooldownUntil && Date.now() < this.geminiCooldownUntil) {
      throw new Error(`Gemini provider temporarily in cooldown until ${new Date(this.geminiCooldownUntil).toISOString()}`);
    }

    let GoogleGenerativeAI;
    try {
      GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    } catch (e) {
      throw new Error(`@google/generative-ai SDK not available: ${e.message}`);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Configurable model cascade: allows env override, defaults to gemini-2.5-flash, gemini-1.5-flash then alternatives
    const candidateModels = Array.from(new Set([
      process.env.GEMINI_MODEL,
      model && typeof model === 'string' && model.startsWith('gemini') ? model : null,
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash'
    ].filter(Boolean)));

    let lastErr = null;

    for (const geminiModelName of candidateModels) {
      try {
        const modelConfig = {
          model: geminiModelName,
          generationConfig: {
            temperature: typeof temperature === 'number' ? temperature : 0.3
          }
        };

        if (responseFormat === 'json') {
          modelConfig.generationConfig.responseMimeType = 'application/json';
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
          this.geminiCooldownUntil = Date.now() + 60000;
          console.warn(`⚠️ [LLMRouter] Gemini hit rate limit (429). Setting 60s cooldown.`);
          break; // Don't burn requests across models if key is throttled
        } else if (status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('leaked')) {
          this.geminiCooldownUntil = Date.now() + 3600000; // 1-hour cooldown for invalid/leaked key
          console.warn(`🚨 [LLMRouter] Gemini authentication error (${msg}). Marking key unavailable.`);
          break;
        } else if (status === 404 || msg.includes('not found') || msg.includes('is not supported')) {
          console.warn(`⚠️ [LLMRouter] Gemini model '${geminiModelName}' not found or unsupported. Trying next candidate model...`);
          continue;
        } else {
          console.warn(`⚠️ [LLMRouter] Gemini call failed for '${geminiModelName}': ${msg}`);
          continue;
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
