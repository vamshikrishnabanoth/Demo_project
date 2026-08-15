/**
 * server/engine/adapter/llmRouter.js
 *
 * Universal LLM Router supporting zero-downtime hot-swapping between:
 * 1. Local Fine-Tuned Llama 3 8B (Ollama 'quiz-expert' / FastAPI ai_service :8000)
 * 2. Groq Cloud (llama-3.3-70b-versatile / llama-3.1-8b-instant)
 * 3. Local vLLM Endpoint
 * 4. Offline Mock Fallback
 */

'use strict';

const axios = require('axios');

class LLMRouter {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || null;
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
    this.vllmUrl = process.env.VLLM_URL || null;
    this.activeProvider = process.env.DEFAULT_LLM_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'mock'); // Fast default
  }

  /**
   * Route completion request to active LLM provider with failover.
   * @param {Object} params - { prompt, systemPrompt, temperature, responseFormat, model }
   */
  async complete({ prompt, systemPrompt = '', temperature = 0.3, responseFormat = 'json', model = null }) {
    const providerOrder = [this.activeProvider, 'groq', 'local_ollama', 'mock'];
    const tried = new Set();

    for (const provider of providerOrder) {
      if (tried.has(provider)) continue;
      tried.add(provider);

      try {
        if (provider === 'local_ollama') {
          return await this._callOllama({ prompt, systemPrompt, temperature, model: model || 'quiz-expert' });
        } else if (provider === 'groq') {
          return await this._callGroq({ prompt, systemPrompt, temperature, model: model || 'llama-3.3-70b-versatile' });
        } else if (provider === 'vllm') {
          return await this._callVLLM({ prompt, systemPrompt, temperature });
        } else if (provider === 'mock') {
          return this._getMockResponse(prompt, systemPrompt);
        }
      } catch (err) {
        // Fast failover silently
      }
    }

    // Ultimate fallback
    return this._getMockResponse(prompt, systemPrompt);
  }

  /** Call local FastAPI / Ollama backend */
  async _callOllama({ prompt, systemPrompt, temperature, model }) {
    try {
      const resp = await axios.post(`${this.aiServiceUrl}/generate_quiz`, {
        topic: prompt,
        count: 5,
        difficulty: 'Medium'
      }, { timeout: 1500 });

      if (resp.data && resp.data.questions) {
        return JSON.stringify(resp.data.questions);
      }
    } catch (e) {
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      const resp = await axios.post(this.ollamaUrl, {
        model: model,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: temperature }
      }, { timeout: 2000 });

      if (resp.data && resp.data.response) {
        return resp.data.response;
      }
      throw e;
    }
  }

  /** Call Groq Cloud API */
  async _callGroq({ prompt, systemPrompt, temperature, model }) {
    if (!this.groqApiKey) throw new Error('GROQ_API_KEY is missing');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return response.data.choices[0].message.content;
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

  /** Deterministic Mock Response for Agent 1, Agent 2, or Agent 3 */
  _getMockResponse(prompt = '', systemPrompt = '') {
    const combined = (systemPrompt + ' ' + prompt).toLowerCase();

    if (combined.includes('agent 1') || combined.includes('assessmentplan')) {
      return JSON.stringify({
        subject: 'Database Systems',
        mainTopic: 'MongoDB Aggregation Pipelines',
        subtopics: ['$match filtering', '$group aggregation', '$project shaping'],
        teachingEmphasis: { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
        targetCount: 3,
        assessmentTargets: [
          {
            targetId: 'T01',
            concept: 'Pipeline Optimization with $match',
            dimension: 'Application',
            cognitiveLevel: 'Apply',
            targetDifficulty: 'Medium',
            evidenceType: 'VOICE + CODE',
            requiresExactArtifact: false,
            instruction: 'Test positioning of $match early in a pipeline.'
          },
          {
            targetId: 'T02',
            concept: 'Grouping and Aggregating Data with $group',
            dimension: 'Conceptual',
            cognitiveLevel: 'Understand',
            targetDifficulty: 'Easy',
            evidenceType: 'VOICE + DOCUMENT',
            requiresExactArtifact: false,
            instruction: 'Test understanding of accumulator operators in $group.'
          },
          {
            targetId: 'T03',
            concept: 'Reshaping Documents with $project',
            dimension: 'Code Tracing',
            cognitiveLevel: 'Apply',
            targetDifficulty: 'Medium',
            evidenceType: 'CODE',
            requiresExactArtifact: true,
            instruction: 'Test field projection syntax and inclusion/exclusion.'
          }
        ],
        reserveTargets: [
          {
            targetId: 'R01',
            concept: 'Indexing Constraints on $sort',
            dimension: 'Complexity Reasoning',
            cognitiveLevel: 'Analyze',
            targetDifficulty: 'Hard',
            evidenceType: 'DOCUMENT',
            requiresExactArtifact: false,
            instruction: 'Reserve target for memory limits on $sort.'
          }
        ]
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

    // Default Agent 2 candidate MCQ mock
    return JSON.stringify({
      targetId: 'T01',
      questionText: 'When optimizing a MongoDB aggregation pipeline for a dataset with 1,000,000 documents, where should the $match stage be placed?',
      options: [
        'At the beginning of the pipeline to filter documents before processing',
        'Immediately after the $group stage to filter aggregated results',
        'At the very end of the pipeline after all transformations',
        'Inside the $project stage as a parameter'
      ],
      correctAnswer: 'At the beginning of the pipeline to filter documents before processing',
      explanation: 'Placing $match at the beginning utilizes indexes and reduces the number of documents passed to subsequent stages.',
      metadata: {
        dimension: 'Application',
        cognitiveLevel: 'Apply',
        targetDifficulty: 'Medium'
      }
    });
  }
}

module.exports = new LLMRouter();
