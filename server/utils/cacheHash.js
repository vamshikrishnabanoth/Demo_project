const crypto = require('crypto');
const config = require('../config/cacheConfig');

/**
 * Code-Preserving Text Normalization
 * Preserves code blocks unmodified while normalizing non-code text.
 */
function normalizeTextCodeSafe(text) {
  if (!text || typeof text !== 'string') return '';

  const codeBlocks = [];
  // Temporarily extract fenced code blocks
  const placeholderText = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Apply prose normalization ONLY to non-code text
  let normalized = placeholderText
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim();

  // Re-inject original fenced code blocks back into the normalized string
  codeBlocks.forEach((codeBlock, idx) => {
    normalized = normalized.replace(`__CODE_BLOCK_${idx}__`, codeBlock);
  });

  return normalized;
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * 1. Asset Extraction Hash: asset:${fileHash}
 */
function generateAssetCacheKey(fileBuffer, fileSize, mimeType) {
  const bufStr = Buffer.isBuffer(fileBuffer) ? fileBuffer.toString('base64').slice(0, 1000) : String(fileBuffer).slice(0, 1000);
  const rawSig = `${bufStr}_${fileSize}_${mimeType}_${config.OCR_VERSION}_${config.WHISPER_VERSION}`;
  const hash = sha256(rawSig).slice(0, 32);
  return `asset:${hash}`;
}

/**
 * 2. Concept Graph Analysis Hash: analysis:${textHash}
 */
function generateAnalysisCacheKey(text) {
  const normText = normalizeTextCodeSafe(text);
  const rawSig = `${normText}_${config.ANALYSIS_VERSION}_${config.PIPELINE_VERSION}`;
  const hash = sha256(rawSig).slice(0, 32);
  return `analysis:${hash}`;
}

/**
 * 3. Validated Quiz Hash: quiz:${quizQueryHash}
 */
function generateQuizCacheKey({ text, difficulty = 'Balanced', count = 10, batchIndex = 0 }) {
  const normText = normalizeTextCodeSafe(text);
  const cleanDiff = String(difficulty || 'Balanced').replace(/[^a-zA-Z]/g, '').toLowerCase() || 'balanced';
  const cleanCount = parseInt(count, 10) || 10;
  
  const rawSig = `diff_${cleanDiff}_count_${cleanCount}_batch_${batchIndex}_text_${normText}_${config.PROMPT_VERSION}_${config.PLANNER_VERSION}_${config.VALIDATOR_VERSION}_${config.MODEL_NAME}_${config.PIPELINE_VERSION}_${config.TEMPERATURE}`;
  const hash = sha256(rawSig).slice(0, 32);
  return `quiz:${cleanDiff}:${cleanCount}:${hash}`;
}

module.exports = {
  normalizeTextCodeSafe,
  generateAssetCacheKey,
  generateAnalysisCacheKey,
  generateQuizCacheKey,
  sha256
};
