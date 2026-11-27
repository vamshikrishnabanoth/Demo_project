/**
 * Semantic embeddings (meaning, not shared words) for linking speech to slides and for duplicate checks.
 *
 * Word overlap misses a teacher who explains a slide in their own words, and a code-mixed class whose speech was
 * translated to English (the translation rarely reuses the slide's wording). Multilingual embeddings compare meaning.
 *
 * - Model: Gemini gemini-embedding-001 (free tier, multilingual), 768 dimensions. EMBEDDING_MODEL overrides.
 * - Free tier allows ~100 texts and ~30,000 tokens a minute, so callers send at most MAX_TEXTS_PER_CALL texts in ONE request and
 *   group small pieces first. Nothing waits for the next minute: on any failure (quota, network, timeout) the
 *   result is null and the caller keeps its word-overlap method, so the pipeline never stalls or breaks.
 * - Vectors are cached in memory by text hash (repeat lectures and repeat questions cost nothing).
 * - SEMANTIC_LINKAGE=off disables all of it.
 */
const crypto = require('crypto');

const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const DIM = parseInt(process.env.EMBEDDING_DIM, 10) || 768;
const MAX_TEXTS_PER_CALL = 90;
const MAX_CHARS = 6000;
// Free tier also caps tokens (30,000 a minute). One request stays under ~20,000 tokens (~80,000 characters):
// each text is cut to an equal share of that budget (its opening part).
const CHAR_BUDGET = parseInt(process.env.EMBEDDING_CHAR_BUDGET, 10) || 80000;
const TIMEOUT_MS = parseInt(process.env.EMBEDDING_TIMEOUT_MS, 10) || 20000;
const cache = new Map(); // hash -> Float32Array
let blockedUntil = 0; // after a quota error, skip calls for a minute

const hash = (t) => crypto.createHash('sha1').update(`${MODEL}|${DIM}|${t}`).digest('hex');

function enabled() {
  return process.env.SEMANTIC_LINKAGE !== 'off' && require('./geminiKeys').hasKey() && Date.now() >= blockedUntil;
}

function cosine(a, b) {
  if (!a || !b) return null;
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? d / Math.sqrt(x * y) : null;
}

function getCached(text) {
  return cache.get(hash(String(text || '').slice(0, MAX_CHARS))) || null;
}

/**
 * Embeds up to MAX_TEXTS_PER_CALL texts in one request. Returns an array of vectors (same order) or null.
 * @param {string[]} texts
 * @param {{taskType?: string, label?: string}} opts
 */
async function embedMany(texts, opts = {}) {
  const n = (texts || []).length;
  const perText = Math.max(200, Math.min(MAX_CHARS, Math.floor(CHAR_BUDGET / Math.max(1, n))));
  const list = (texts || []).map(t => String(t || '').slice(0, perText));
  if (!list.length) return [];
  if (!enabled() && !(opts.noRetry === false)) return null;
  const missing = [...new Set(list.filter(t => t.trim() && !cache.has(hash(t))))];
  if (missing.length > MAX_TEXTS_PER_CALL) {
    console.warn(`[Semantic] ${opts.label || 'embed'}: ${missing.length} texts exceed one request (${MAX_TEXTS_PER_CALL}); using word overlap.`);
    return null;
  }
  if (missing.length) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      // Gemini key pool: an embedding quota hit on one key moves to the next.
      const res = await require('./geminiKeys').withKey((apiKey) => {
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL });
        const call = model.batchEmbedContents({
          requests: missing.map(t => ({ content: { role: 'user', parts: [{ text: t }] }, taskType: opts.taskType || 'SEMANTIC_SIMILARITY', outputDimensionality: DIM }))
        });
        return Promise.race([call, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
      });
      const embs = (res && res.embeddings) || [];
      if (embs.length !== missing.length) throw new Error(`got ${embs.length} of ${missing.length} vectors`);
      missing.forEach((t, i) => cache.set(hash(t), Float32Array.from(embs[i].values)));
      if (cache.size > 20000) cache.delete(cache.keys().next().value);
    } catch (e) {
      // A per-minute limit clears within a minute: wait for it once (up to 35 s) rather than skipping the check.
      if (/429|quota/i.test(e.message) && !opts.noRetry) {
        const sec = Number((String(e.message).match(/retry in ([\d.]+)s/i) || [])[1]) || 20;
        if (sec <= 35) {
          await new Promise(r => setTimeout(r, Math.ceil(sec * 1000) + 500));
          return embedMany(texts, { ...opts, noRetry: true });
        }
      }
      if (/429|quota/i.test(e.message)) blockedUntil = Date.now() + 60000;
      console.warn(`[Semantic] ${opts.label || 'embed'} unavailable (${String(e.message).slice(0, 120)}); using word overlap.`);
      return null;
    }
  }
  return list.map(t => (t.trim() ? cache.get(hash(t)) : null) || null);
}

/** Splits `items` into at most `maxGroups` runs of consecutive items (to fit one embedding request). */
function groupConsecutive(items, maxGroups) {
  if (items.length <= maxGroups) return items.map(x => [x]);
  const size = Math.ceil(items.length / Math.max(1, maxGroups));
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function zScores(arr) {
  const n = arr.length || 1;
  const mu = arr.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1;
  return arr.map(x => (x - mu) / sd);
}

function quantile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

module.exports = { embedMany, getCached, cosine, groupConsecutive, zScores, quantile, enabled, MAX_TEXTS_PER_CALL, MODEL };
