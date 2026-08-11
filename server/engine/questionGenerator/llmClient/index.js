const { performance } = require('perf_hooks');
const { GENERATOR_CONFIG } = require('../../../config/generatorConfig');
const groqAdapter = require('./groqAdapter');
const mockAdapter = require('./mockAdapter');

function loadProvider(providerName) {
  const name = String(providerName).toLowerCase();
  if (name === 'mock') return mockAdapter;
  return groqAdapter;
}

/**
 * Dispatcher function for active provider
 * Exposes provider.defaultModel, providerDiagnostics, and latency tracking.
 */
async function dispatchLLMRequest(promptPayload, signal) {
  const providerName = GENERATOR_CONFIG.ACTIVE_PROVIDER;

  // NO Silent Fallback Rule: Enforce valid GROQ_API_KEY unless mock is explicitly set via env
  if (providerName !== 'mock' && (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'dummy_key') && process.env.ALLOW_MOCK_FALLBACK !== 'true') {
    const err = new Error('503 Service Unavailable: "LIVE_GENERATOR_UNAVAILABLE: GROQ_API_KEY is missing or unconfigured."');
    err.statusCode = 503;
    err.code = 'LIVE_GENERATOR_UNAVAILABLE';
    throw err;
  }

  const provider = loadProvider(providerName);

  const startedAt = Date.now();
  const startTime = performance.now();

  const response = await provider.generate(promptPayload, signal, GENERATOR_CONFIG);

  const finishedAt = Date.now();
  const latencyMs = Math.round(performance.now() - startTime);

  return {
    rawText: response.rawText,
    responseTokens: response.usage?.completion_tokens || 0,
    startedAt,
    finishedAt,
    latencyMs,
    providerDiagnostics: {
      provider: providerName,
      model: response.model || provider.defaultModel || "unknown-model",
      capabilities: {
        supportsJSONMode: provider.capabilities?.supportsJSONMode ?? true,
        maxContextTokens: provider.capabilities?.maxContextTokens ?? 8192
      }
    }
  };
}

module.exports = {
  dispatchLLMRequest,
  loadProvider
};
