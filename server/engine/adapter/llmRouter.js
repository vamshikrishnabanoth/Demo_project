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
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');

class LLMRouter {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || null;
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
    this.vllmUrl = process.env.VLLM_URL || null;
    this.activeProvider = process.env.DEFAULT_LLM_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'local_ollama');
    this.keyCooldowns = new Map();
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

    const errors = [];

    // Resolve model cleanly: production Architecture E GPT-OSS models
    let primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    let fallbackModel = process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b';
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
        console.warn(`⚠️ [LLMRouter] Groq provider failed: ${err.message}. Trying local AI...`);
      }
    }

    // 2. Try Local Ollama / FastAPI AI service
    try {
      return await this._callOllama({ prompt, systemPrompt, temperature, model: model || 'quiz-expert', sessionId });
    } catch (err) {
      errors.push(`Local Ollama (${err.message})`);
    }

    // 3. Try Local vLLM if configured
    if (this.vllmUrl) {
      try {
        return await this._callVLLM({ prompt, systemPrompt, temperature, sessionId });
      } catch (err) {
        errors.push(`vLLM (${err.message})`);
      }
    }

    // 4. Check for mock test mode ONLY if explicitly enabled for unit tests
    if (process.env.ALLOW_MOCK_FALLBACK === 'true' || process.env.NODE_ENV === 'test') {
      console.warn('⚠️ [LLMRouter] Using test mock fallback because ALLOW_MOCK_FALLBACK is enabled.');
      return this._getMockResponse(prompt, systemPrompt);
    }

    // 5. PRODUCTION SAFETY RULE: No provider -> Fail honestly! NEVER return fabricated mock MCQs!
    const errMsg = `NO_LLM_PROVIDER_AVAILABLE: All AI providers failed [${errors.join('; ')}]. Please verify your API key or try again in a few moments.`;
    console.error(`❌ [LLMRouter] ${errMsg}`);
    const fatalError = new Error(errMsg);
    fatalError.code = 'NO_LLM_PROVIDER_AVAILABLE';
    throw fatalError;
  }

  _getGroqKeys() {
    const raw = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_BACKUP,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      this.groqApiKey
    ];
    if (process.env.GROQ_API_KEYS) {
      raw.push(...process.env.GROQ_API_KEYS.split(',').map(k => k.trim()));
    }
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.includes(',')) {
      raw.push(...process.env.GROQ_API_KEY.split(',').map(k => k.trim()));
    }
    return Array.from(new Set(raw.filter(Boolean)));
  }

  /** Call Groq Cloud API with configured model, multi-key pool, and bounded rate-limit backoff */
  async _callGroqWithRetry({ prompt, systemPrompt, temperature, primaryModel, fallbackModel, sessionId = null }) {
    const keys = this._getGroqKeys();
    if (keys.length === 0) throw new Error('GROQ_API_KEY is missing');

    const modelsToTry = [primaryModel, fallbackModel].filter(Boolean);
    const totalKeys = keys.length;
    let lastErr = null;

    // Up to 2 passes across the pool with bounded cooldown sleep if all keys are temporarily throttled
    for (let poolAttempt = 0; poolAttempt < 2; poolAttempt++) {
      for (let offset = 0; offset < totalKeys; offset++) {
        const keyIdx = (this.currentKeyIndex + offset) % totalKeys;
        const key = keys[keyIdx];

        // Check if key is currently in cooldown
        const cooldownUntil = this.keyCooldowns.get(keyIdx) || 0;
        const now = Date.now();
        if (now < cooldownUntil) {
          continue; // Key is in cooldown, check next key
        }

        let keySucceeded = false;
        for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
          const currentModel = modelsToTry[mIdx];
          const isLastModel = mIdx === modelsToTry.length - 1;
          let attempts = 0;
          const maxAttempts = 1; // 1 attempt per model, then fail over to fallback model or next key immediately

          while (attempts < maxAttempts) {
            attempts++;
            try {
              const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                  model: currentModel,
                  messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                  ],
                  temperature: temperature,
                  response_format: { type: 'json_object' }
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

              // Success! Clear cooldown for this key and advance currentKeyIndex
              this.keyCooldowns.delete(keyIdx);
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

              if (isRateLimit) {
                if (isTPD || isLastModel) {
                  const cooldownMs = isTPD ? 120000 : 10000;
                  this.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
                  console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' exhausted (${isTPD ? 'daily TPD' : 'rate limit'}). Rotating key...`);
                } else {
                  console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' hit TPM limit. Immediately failing over to fallback '${modelsToTry[mIdx + 1]}'...`);
                }
                break; // Break inner loop to try fallback model or next key
              } else {
                console.warn(`⚠️ [LLMRouter] Groq Key-${keyIdx + 1} model '${currentModel}' error (${status || errorMsg}).`);
                break;
              }
            }
          }
          if (keySucceeded) break;
        }
      }

      // If pass 0 completed without returning, sleep until earliest cooldown expires and retry
      if (poolAttempt === 0 && this.keyCooldowns.size > 0) {
        const earliestCooldown = Math.min(...Array.from(this.keyCooldowns.values()));
        const waitMs = Math.min(Math.max(earliestCooldown - Date.now(), 1000), 10000);
        console.warn(`⏳ [LLMRouter] All available keys throttled. Bounded wait ${waitMs}ms before second pool pass...`);
        await this._sleep(waitMs);
      }
    }

    throw lastErr || new Error('Configured Groq models failed across all available keys in pool');
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

module.exports = new LLMRouter();
