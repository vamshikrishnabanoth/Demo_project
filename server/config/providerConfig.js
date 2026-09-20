/**
 * server/config/providerConfig.js
 *
 * Centralized Provider Management.
 * Eliminates scattered model names and hardcoded endpoints across the codebase.
 * Strictly avoids logging or exposing raw API keys.
 */

'use strict';

require('dotenv').config();

const providerConfig = {
  // Text & Reasoning Models
  text: {
    primaryProvider: process.env.TEXT_PROVIDER || 'groq',
    primaryModel: process.env.TEXT_MODEL || 'openai/gpt-oss-120b',
    fallbackProvider: process.env.TEXT_FALLBACK_PROVIDER || 'groq',
    fallbackModel: process.env.TEXT_FALLBACK_MODEL || 'openai/gpt-oss-20b',
    plannerModel: process.env.PLANNER_MODEL || 'openai/gpt-oss-120b',
    fastModel: process.env.FAST_MODEL || 'openai/gpt-oss-20b',
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 60000,
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES, 10) || 3
  },

  // Vision Models & Visual Understanding
  vision: {
    primaryProvider: process.env.VISION_PROVIDER || 'groq',
    primaryModel: process.env.VISION_MODEL || 'llama-3.2-11b-vision-preview',
    fallbackProvider: process.env.VISION_FALLBACK_PROVIDER || 'ocr',
    fallbackModel: process.env.VISION_FALLBACK_MODEL || 'tesseract',
    timeoutMs: parseInt(process.env.VISION_TIMEOUT_MS, 10) || 45000,
    maxImageBytes: 10 * 1024 * 1024 // 10 MB per image
  },

  // Embeddings
  embedding: {
    primaryProvider: process.env.EMBEDDING_PROVIDER || 'local_dense',
    primaryModel: process.env.EMBEDDING_MODEL || 'term-vector-384',
    cacheTtlMs: 24 * 60 * 60 * 1000 // 24 hours
  },

  // OCR Processing
  ocr: {
    workerCount: Math.min(8, Math.max(1, parseInt(process.env.OCR_WORKERS, 10) || 2)),
    timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS, 10) || 60000,
    minConfidence: 35
  },

  // Job Queue & Backpressure
  queue: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 10,
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE, 10) || 25,
    jobTimeoutMs: parseInt(process.env.TOTAL_JOB_TIMEOUT_MS, 10) || 180000 // 3 minutes total
  }
};

module.exports = providerConfig;
