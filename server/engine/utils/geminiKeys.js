/**
 * server/engine/utils/geminiKeys.js
 *
 * Several Gemini keys (one per Google Cloud project, each with its own free quota) used as one pool, like the Groq
 * key pool: a call uses the current key; a quota error sets that key aside (a minute for a per-minute limit, hours for
 * a daily one) and the call is retried on the next key. With one key, behaviour is unchanged.
 *
 * Keys: GEMINI_API_KEY, GEMINI_API_KEY_2..N, GEMINI_API_KEY_EXP_1..N (experiment keys from .env.experiments).
 */
'use strict';

const restingUntil = new Map(); // key -> timestamp
let cursor = 0;

function allKeys() {
  const env = process.env;
  const names = Object.keys(env)
    .filter(n => /^GEMINI_API_KEY(?:_\d+|_EXP_\d+)?$/.test(n))
    .sort((a, b) => {
      const rank = (n) => (n === 'GEMINI_API_KEY' ? 0 : n.includes('_EXP_') ? 2 : 1);
      const num = (n) => Number((n.match(/(\d+)$/) || [0, 0])[1]);
      return rank(a) - rank(b) || num(a) - num(b);
    });
  return [...new Set(names.map(n => String(env[n] || '').trim()).filter(Boolean))];
}

/** The key to use now ('' when none is configured). Prefers a key that is not resting. */
function key() {
  const keys = allKeys();
  if (!keys.length) return '';
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(cursor + i) % keys.length];
    if ((restingUntil.get(k) || 0) <= now) { cursor = (cursor + i) % keys.length; return k; }
  }
  // All resting: the one that comes back first.
  return keys.slice().sort((a, b) => (restingUntil.get(a) || 0) - (restingUntil.get(b) || 0))[0];
}

function count() { return allKeys().length; }
function hasKey() { return count() > 0; }

/** A quota / rate-limit error from Gemini. */
function isQuotaError(err) {
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit|Too Many Requests/i.test(String((err && err.message) || err || ''));
}

/**
 * Report a failed call made with `usedKey`. A quota error rests that key and moves to the next one.
 * @returns {boolean} true when another key is available right now (the caller should retry with key()).
 */
function report(err, usedKey) {
  if (!isQuotaError(err)) return false;
  const msg = String((err && err.message) || err || '');
  const daily = /per.?day|PerDay|daily|exceeded your current quota/i.test(msg);
  const retry = Number((msg.match(/retry in ([\d.]+)s/i) || [])[1]);
  const ms = daily ? (parseInt(process.env.GEMINI_KEY_DAILY_REST_MS, 10) || 3 * 3600 * 1000)
    : Math.max(15000, Number.isFinite(retry) ? retry * 1000 : 60000);
  const k = usedKey || key();
  restingUntil.set(k, Date.now() + ms);
  const keys = allKeys();
  cursor = (keys.indexOf(k) + 1) % Math.max(1, keys.length);
  const now = Date.now();
  return keys.some(x => (restingUntil.get(x) || 0) <= now);
}

/**
 * Run fn(apiKey) on the pool: a quota error moves to the next key, up to one try per key.
 * Other errors are thrown as they are.
 */
async function withKey(fn) {
  const tries = Math.max(1, count());
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    const k = key();
    if (!k) throw new Error('GEMINI_API_KEY is missing or empty');
    try { return await fn(k); } catch (e) {
      lastErr = e;
      if (!report(e, k)) throw e;
    }
  }
  throw lastErr;
}

/** Test hook. */
function _reset() { restingUntil.clear(); cursor = 0; }

module.exports = { key, count, hasKey, report, withKey, isQuotaError, _reset };
