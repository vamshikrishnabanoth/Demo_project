/**
 * Centralized Cache Configuration & Schema Versioning
 */

module.exports = {
  SCHEMA_VERSION: parseInt(process.env.CACHE_SCHEMA_VERSION || '1', 10),
  PIPELINE_VERSION: process.env.CACHE_PIPELINE_VERSION || '5.1.0',
  OCR_VERSION: process.env.CACHE_OCR_VERSION || '2.1.0',
  WHISPER_VERSION: process.env.CACHE_WHISPER_VERSION || 'whisper-large-v3',
  ANALYSIS_VERSION: process.env.CACHE_ANALYSIS_VERSION || '4.1.0',
  PROMPT_VERSION: process.env.CACHE_PROMPT_VERSION || '2.6.0',
  PLANNER_VERSION: process.env.CACHE_PLANNER_VERSION || '1.3.0',
  VALIDATOR_VERSION: process.env.CACHE_VALIDATOR_VERSION || '2.1.0',
  MODEL_NAME: process.env.CACHE_MODEL_NAME || 'llama-3.1-8b-instant',
  TEMPERATURE: process.env.CACHE_TEMPERATURE || '0.2',

  MIN_CACHEABLE_QUALITY_SCORE: parseFloat(process.env.MIN_CACHEABLE_QUALITY_SCORE || '0.80'),
  L1_CACHE_MAX_ENTRIES: parseInt(process.env.L1_CACHE_MAX_ENTRIES || '1000', 10),

  MAX_CACHE_TRANSCRIPT_BYTES: parseInt(process.env.MAX_CACHE_TRANSCRIPT_BYTES || '10485760', 10), // 10 MB
  MAX_CACHE_CONCEPT_BYTES: parseInt(process.env.MAX_CACHE_CONCEPT_BYTES || '2097152', 10),       // 2 MB
  MAX_CACHE_QUIZ_BYTES: parseInt(process.env.MAX_CACHE_QUIZ_BYTES || '1048576', 10)             // 1 MB
};
