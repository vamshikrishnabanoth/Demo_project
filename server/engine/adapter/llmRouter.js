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
  }

  /** Sleep helper for exponential backoff on rate limits */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Route completion request to active LLM provider with intelligent failover.
   * @param {Object} params - { prompt, systemPrompt, temperature, responseFormat, model }
   */
  async complete({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null }) {
    if (!this.groqApiKey && process.env.GROQ_API_KEY) {
      this.groqApiKey = process.env.GROQ_API_KEY;
    }

    const errors = [];

    // 1. Try Primary Groq Cloud (70B model with fallback to 8B on 429)
    if (this.groqApiKey) {
      try {
        return await this._callGroqWithRetry({
          prompt,
          systemPrompt,
          temperature,
          primaryModel: (model && model !== 'quiz-expert') ? model : 'llama-3.3-70b-versatile',
          fallbackModel: 'llama-3.1-8b-instant'
        });
      } catch (err) {
        errors.push(`Groq (${err.message})`);
        console.warn(`⚠️ [LLMRouter] Groq provider failed: ${err.message}. Trying local AI...`);
      }
    }

    // 2. Try Local Ollama / FastAPI AI service
    try {
      return await this._callOllama({ prompt, systemPrompt, temperature, model: model || 'quiz-expert' });
    } catch (err) {
      errors.push(`Local Ollama (${err.message})`);
    }

    // 3. Try Local vLLM if configured
    if (this.vllmUrl) {
      try {
        return await this._callVLLM({ prompt, systemPrompt, temperature });
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

  /** Call Groq Cloud API with multi-model failover and rate-limit backoff */
  async _callGroqWithRetry({ prompt, systemPrompt, temperature, primaryModel, fallbackModel }) {
    const key = this.groqApiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is missing');

    let modelsToTry = [primaryModel, fallbackModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'].filter(Boolean);
    
    // Map legacy or unavailable model names to active working Groq models
    modelsToTry = modelsToTry.map(m => {
      if (m.includes('llama') || m === 'quiz-expert') return 'openai/gpt-oss-120b';
      return m;
    });

    // Deduplicate
    modelsToTry = Array.from(new Set(modelsToTry));

    let lastErr = null;
    for (const currentModel of modelsToTry) {
      let attempts = 0;
      while (attempts < 3) {
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
              timeout: 30000
            }
          );

          return response.data.choices[0].message.content;
        } catch (err) {
          lastErr = err;
          const status = err.response?.status;
          const isRateLimit = status === 429 || (err.message || '').includes('429');

          if (isRateLimit) {
            console.warn(`⚠️ [LLMRouter] Groq model '${currentModel}' rate limited (429, attempt ${attempts}/3). Sleeping 3.5s...`);
            await this._sleep(3500);
          } else {
            console.warn(`⚠️ [LLMRouter] Groq model '${currentModel}' failed (${status || err.message}). Switching model...`);
            await this._sleep(500);
            break; // Try next model
          }
        }
      }
    }
    throw lastErr || new Error('All Groq models failed');
  }

  /** Call local FastAPI / Ollama backend */
  async _callOllama({ prompt, systemPrompt, temperature, model }) {
    try {
      const resp = await axios.post(`${this.aiServiceUrl}/generate_quiz`, {
        topic: prompt,
        count: 5,
        difficulty: 'Medium'
      }, { timeout: 3000 });

      if (resp.data && resp.data.questions) {
        return JSON.stringify(resp.data.questions);
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
        return resp.data.response;
      }
      throw e;
    }
  }

  /** Call local vLLM API */
  async _callVLLM({ prompt, systemPrompt, temperature }) {
    if (!this.vllmUrl) throw new Error('VLLM_URL is missing');
    const resp = await axios.post(`${this.vllmUrl}/v1/completions`, {
      prompt: `${systemPrompt}\n\n${prompt}`,
      temperature: temperature,
      max_tokens: 1024
    }, { timeout: 10000 });
    return resp.data.choices[0].text;
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
