/**
 * Centralized Question Generator Configuration & Provider Rate Limits
 * Version: 1.2.0
 */

const GENERATOR_CONFIG = {
  VERSION: "1.2.0",
  ACTIVE_PROVIDER: process.env.LLM_PROVIDER || "groq", // "groq" | "openai" | "ollama" | "mock"
  CONCURRENCY_LIMIT: parseInt(process.env.GENERATOR_CONCURRENCY || "10", 10),
  REQUESTS_PER_MINUTE: parseInt(process.env.GENERATOR_RPM || "60", 10),
  REQUEST_TIMEOUT_MS: parseInt(process.env.GENERATOR_TIMEOUT_MS || "30000", 10),
  MAX_RETRIES_PER_SLOT: 2,
  BACKOFF: {
    BASE_MS: 1000,
    MAX_MS: 5000,
    JITTER_FACTOR: 0.25
  },
  CIRCUIT_BREAKER: {
    MAX_CONSECUTIVE_PROVIDER_FAILURES: 3, // Tripped ONLY by 429, 5xx, or network timeouts
    SHORT_CIRCUIT_STATUS: "CIRCUIT_BROKEN"
  },
  UNICODE_NORMALIZE: {
    SMART_QUOTES_REGEX: /[“”]/g,
    SMART_APOSTROPHE_REGEX: /[’`]/g,
    EM_DASH_REGEX: /[–—]/g
  },
  TRANSIENT_PROVIDER_ERRORS: [429, 500, 502, 503, 504, "TIMEOUT", "NETWORK_ERROR", "RATE_LIMIT_EXCEEDED"],
  NON_RETRYABLE_CONTENT_ERRORS: [
    "INSUFFICIENT_EVIDENCE",
    "SCHEMA_MISMATCH",
    "PARSE_ERROR",
    "MALFORMED_PROMPT",
    "INVALID_PAYLOAD"
  ]
};

module.exports = {
  GENERATOR_CONFIG
};
