/**
 * server/engine/utils/capacityMode.js
 *
 * Lean mode for small key pools. Full verification makes 4-6 extra model calls per batch (strong-solver tie-break,
 * second independent computation, long retry waits). On a server with few free keys those calls hit rate limits,
 * questions are refused as "could not be validated" and a quiz takes minutes (live, 27 Nov: 2 of 9 in 7 min on
 * 3 Groq + 1 Gemini keys). Lean mode keeps the gate, the blind solver, the code checks and the quote/computation proof,
 * and drops the extra tie-break and second computation, with short retry waits.
 *
 * QUIZ_MODE=full|lean forces a mode; otherwise lean when fewer than LEAN_BELOW_GROQ_KEYS (default 6) Groq keys.
 */
'use strict';

function groqKeyCount() {
  return new Set(Object.entries(process.env)
    .filter(([n, v]) => /^GROQ_(?:API_)?KEY/.test(n) && typeof v === 'string' && v.trim().length > 10)
    .flatMap(([, v]) => v.split(',').map(s => s.trim()).filter(Boolean))).size;
}

function isLean() {
  const forced = String(process.env.QUIZ_MODE || '').toLowerCase();
  if (forced === 'full') return false;
  if (forced === 'lean') return true;
  return groqKeyCount() < (parseInt(process.env.LEAN_BELOW_GROQ_KEYS, 10) || 6);
}

/** Retry wait: short in lean mode (a long wait on a small pool only adds latency). */
function retryWaitMs(fullMs) { return isLean() ? Math.min(fullMs, 4000) : fullMs; }

module.exports = { isLean, groqKeyCount, retryWaitMs };
