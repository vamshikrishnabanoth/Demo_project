const { GENERATOR_CONFIG } = require('../../config/generatorConfig');

/**
 * 4. EXPONENTIAL BACKOFF WITH RANDOMIZED JITTER
 */
function calculateJitteredBackoffMs(attempt) {
  const { BASE_MS, MAX_MS, JITTER_FACTOR } = GENERATOR_CONFIG.BACKOFF;

  const rawBackoff = Math.min(MAX_MS, BASE_MS * Math.pow(2, attempt));
  const jitterRange = rawBackoff * JITTER_FACTOR;
  const randomJitter = (Math.random() * 2 - 1) * jitterRange; // Range [-jitterRange, +jitterRange]

  const finalDelayMs = Math.max(100, Math.round(rawBackoff + randomJitter));
  return finalDelayMs;
}

async function waitWithJitter(attempt) {
  const delayMs = calculateJitteredBackoffMs(attempt);
  await new Promise(r => setTimeout(r, delayMs));
  return delayMs;
}

module.exports = {
  calculateJitteredBackoffMs,
  waitWithJitter
};
