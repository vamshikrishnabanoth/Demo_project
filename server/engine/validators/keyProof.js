/**
 * server/engine/validators/keyProof.js — step 6c PROVE.
 *
 * A question is delivered only when its key and its grounding are proven; otherwise it is rejected and the slot is
 * refilled (or the teacher is told it could not be filled). Three proofs, each checked in code, not by a model's say-so:
 *
 *  1. GROUNDED: the prover returns an exact quote from the lecture that supports the key. The quote must appear
 *     verbatim (after normalising case and punctuation) in the lecture text, and must share the key's content words
 *     (unless the key is a computed value proven by 3).
 *  2. INDEPENDENT AGREEMENT: the prover (a different model family from the blind solver) answers key-blind, and must
 *     choose the key; the blind solver must have agreed as well (blindAnswerCheck). One unverified solver is not enough.
 *  3. COMPUTED: a question whose answer is a value (a number, code output, a count, a final state) carries a small
 *     JavaScript solve() written from the question's own data; it runs in a sandbox (no require/process, 1 s) and its
 *     result must match the key's option and no other.
 *
 * Pass 1 of the 27 Nov input matrix shipped three wrong keys that gate and blind check both passed (resource ordering,
 * an invented MySQL error, a torque value that matched no option). Each fails proof 2 or 3.
 */
'use strict';

const vm = require('vm');

// Case, punctuation and spacing do not matter; decimal points and minus signs of numbers do.
const norm = (t) => String(t || '').toLowerCase().replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  .replace(/(\d)\.(\d)/g, '$1\u0000$2').replace(/(^|[^a-z0-9])-(\d)/g, '$1\u0001$2')
  .replace(/[^a-z0-9\u0000\u0001]+/g, ' ').replace(/\u0000/g, '.').replace(/\u0001/g, '-').replace(/\s+/g, ' ').trim();
// Values written by a JavaScript solver vs. options written in Python/SQL/prose.
const canon = (t) => norm(t).replace(/\bnone\b/g, 'null').replace(/\bnil\b/g, 'null');
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'it', 'its', 'by', 'with', 'as', 'that', 'this', 'be', 'from', 'at', 'which', 'while', 'when', 'than', 'into', 'their', 'they', 'only', 'not']);
// Crude stemming: dragging/drag, downloading/download, values/value compare equal.
const stemWord = (w) => w.replace(/(?:ing|ed|es|s)$/, '').replace(/([b-df-hj-np-tv-z])\1$/, '$1').slice(0, 5);
const contentWords = (t) => norm(t).split(' ').filter(w => w.length > 2 && !STOP.has(w)).map(stemWord);

function keyIndex(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  if (typeof q.correctAnswerIndex === 'number' && opts[q.correctAnswerIndex] !== undefined) return q.correctAnswerIndex;
  const key = q.correctAnswer ?? q.correct_answer ?? q.answer;
  return opts.findIndex(o => o === key);
}
const stemOf = (q) => String(q.question || q.questionText || q.stem || '');

/** Whole lecture text the quote must come from (lecture blocks, or the reference notes of a topic request). */
function lectureText(lm) {
  if (!lm) return '';
  const blocks = Array.isArray(lm.blocks) ? lm.blocks.map(b => b.text).join('\n') : '';
  return `${blocks}\n${lm.notesText || ''}`;
}

/** The passage shown to the prover for one question (its teaching point, gaps filled). */
function passageFor(q, lm, maxChars = 2600) {
  if (!lm || !Array.isArray(lm.units)) return '';
  const s = q.lectureSource || {};
  const unit = (s.unitId && lm.units.find(u => u.id === s.unitId))
    || lm.units.find(u => s.subtopic && String(u.subtopic).toLowerCase() === String(s.subtopic).toLowerCase());
  if (!unit) return '';
  try { return require('../intelligence/lectureModel').unitEvidenceText(lm, unit, maxChars); } catch (_) { return ''; }
}

/** A question whose answer is a value the student must work out. */
function isComputable(q) {
  const key = String((q.options || [])[keyIndex(q)] ?? '');
  const stem = stemOf(q);
  const words = key.trim().split(/\s+/).length;
  // The question sentence without its code lines: "return mid" inside a snippet is not "what does it return?".
  const ask = stem.split('\n').filter(l => !/^\s{2,}|[;{}=]|^\s*(?:def|for|while|if|else|elif|return|SELECT|INSERT|FROM|WHERE|GROUP)\b/i.test(l)).join(' ');
  // A value-like key: a number in a short answer ("54.44 A", "(-1, 3)"), not a sentence that happens to contain one.
  if (/\d/.test(key) && words <= 8) return true;
  // What code or a command outputs / returns / leaves behind (an error text included).
  if (/```|\n\s*\S.*[;{}()=[\]]|\b(?:SELECT|INSERT|UPDATE|docker|git|mysql>)\b/.test(stem) && /\b(?:print|output|return|display|show|state|contain)/i.test(ask) && words <= 10) return true;
  return words <= 8 && /\b(?:calculate|compute|how many|what is the (?:value|output|result|final)|what (?:does|will) .{0,40}(?:print|output|return))\b/i.test(ask);
}

/** Run a solve() program in a sandbox: no require, no process, no timers, 1 s. Returns the value or throws. */
function runSolver(code) {
  const src = String(code || '');
  if (!/function\s+solve\s*\(/.test(src)) throw new Error('no solve() function');
  if (/\b(?:require|process|import|globalThis|Function|eval|setTimeout|setInterval|fetch|XMLHttpRequest)\b/.test(src)) throw new Error('solver uses a forbidden name');
  const ctx = vm.createContext(Object.freeze({ Math, JSON, Number, String, Array, Object, Boolean, parseInt, parseFloat, isNaN, isFinite, BigInt }));
  return vm.runInContext(`(function(){ "use strict"; ${src}\n; return solve(); })()`, ctx, { timeout: 1000 });
}

/** Which options a computed value matches (numbers within 1%; sequences element by element; otherwise text). */
function optionsMatching(value, options) {
  const out = [];
  const nums = (t) => (norm(t).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  // Integers must match exactly (450..949 is not 451..950); decimals may differ by rounding (1%, or 0.006).
  const close = (a, b) => (Number.isInteger(a) && Number.isInteger(b)) ? a === b : Math.abs(a - b) <= Math.max(0.01 * Math.max(Math.abs(a), Math.abs(b)), 0.006);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const v = canon(text);
  options.forEach((o, i) => {
    const on = nums(o);
    if (typeof value === 'number' && Number.isFinite(value)) {
      // "25% of the original torque" for a computed 0.25 (and 25 for "0.25 times").
      const pct = /%|percent/i.test(o);
      const same = (x) => close(x, value) || (pct && (close(x, value * 100) || close(x / 100, value)));
      if (on.length && on.some(same) && on.filter(x => !same(x)).length <= 1) out.push(i);
      return;
    }
    if (typeof value === 'boolean') { if (canon(o).split(' ').includes(String(value))) out.push(i); return; }
    if (Array.isArray(value) && value.length && value.every(x => typeof x === 'number')) {
      if (on.length === value.length && on.every((x, k) => close(x, value[k]))) out.push(i);
      return;
    }
    if (!v) return;
    const c = canon(o);
    if (c === v || (` ${c} `).includes(` ${v} `)) out.push(i);
  });
  return out;
}

/** Proof 1: the quote appears verbatim in the lecture and supports the key. */
// LaTeX and math markup are formatting, not words: "\text{Rotor copper per phase} = \frac{a}{3}" ~ "Rotor copper per phase = a/3".
const delatex = (t) => String(t || '').replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\s*\{([^}]*)\}/g, ' $1 ')
  .replace(/\\(?:frac|dfrac|sqrt|left|right|cdot|times|propto|approx|quad|,|;)/g, ' ').replace(/[${}^_\\]/g, ' ');
const tokens = (t) => norm(delatex(t)).split(' ').filter(Boolean);
/** Share of the quote's 3-word sequences that occur in the lecture (1 = copied exactly, line breaks/markup aside). */
function quoteCoverage(quote, lectureGrams) {
  const w = tokens(quote);
  if (w.length < 3) return 0;
  let hit = 0; const n = w.length - 2;
  for (let i = 0; i < n; i++) if (lectureGrams.has(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)) hit++;
  return hit / n;
}
function lectureGrams(lecture) {
  const w = tokens(lecture); const g = new Set();
  for (let i = 0; i + 2 < w.length; i++) g.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return g;
}

function quoteProblem(q, quote, lecture, computedProof) {
  const nq = norm(quote);
  if (nq.split(' ').length < 3) return 'no supporting quote from the lecture';
  const grams = typeof lecture === 'object' && lecture.grams ? lecture.grams : lectureGrams(String(lecture));
  // A real copy (line breaks, markup, a joined line aside) covers nearly all 3-word sequences; a paraphrase or an
  // invented sentence covers few.
  if (quoteCoverage(quote, grams) < (parseFloat(process.env.KEY_PROOF_QUOTE_MIN) || 0.75)) return `the cited quote is not in the lecture ("${String(quote).slice(0, 80)}")`;
  if (computedProof) return null;
  const key = String((q.options || [])[keyIndex(q)] ?? '');
  const kw = [...new Set(contentWords(key))];
  if (kw.length === 0) return null;
  const qw = new Set(contentWords(quote));
  const shared = kw.filter(w => qw.has(w)).length;
  if (shared / kw.length >= 0.34 || shared >= 3) return null;
  // A quote about the point the stem asks about, sharing a word with the key ("Rotor copper per phase = …/3" for
  // "why divide by 3? → to get the value for one phase"), supports it; an unrelated sentence does not.
  const sw = new Set(contentWords(stemOf(q)));
  const aboutStem = [...qw].filter(w => sw.has(w)).length;
  // A verbatim quote about the point the question asks (>= 2 content words shared with the stem) grounds it; the key's
  // correctness is proven separately by the two agreeing solvers. Word overlap with a prose key failed on code quotes.
  return aboutStem >= 2 ? null : 'the cited quote does not support the key';
}

function buildPrompt(list, lm, notes = []) {
  const body = list.map((q, i) => {
    const passage = passageFor(q, lm);
    const opts = q.options.map((o, k) => `  ${'ABCD'[k]}) ${o}`).join('\n');
    const note = notes[i] ? `\nNOTE: your previous proof failed: ${notes[i]}. Fix exactly that.` : '';
    return `Q${i + 1}.${passage ? `\nLECTURE PASSAGE: """${passage}"""` : ''}\n${stemOf(q)}\n${opts}\nCOMPUTABLE: ${isComputable(q) ? 'yes' : 'no'}${note}`;
  }).join('\n\n');
  return `${body}

For EACH question, without being told the key:
1. "answer": solve it yourself and give the single best letter.
2. "quote": copy, word for word, the shortest sentence(s) from its LECTURE PASSAGE that establish the correct answer (exact characters; no paraphrase; empty if the passage does not support any option).
3. If COMPUTABLE is yes: "solver": a JavaScript function named solve() that computes the answer from the data written in the question only (no options, no guessing), returning the computed VALUE itself (a number, a string, or an array, as the correct option states it) - never an option letter. Re-implement any code in the question faithfully (Python lists -> arrays, integer division -> Math.floor). Use only plain JavaScript and Math. If it truly cannot be computed, return "solver": "".
Return JSON only: {"proofs":[{"q":1,"answer":"B","quote":"...","solver":"function solve(){ ... }"}]}`;
}

/** Second computation for value answers, by a different model family (Groq gpt-oss-120b), solve() only. */
async function secondComputation(qs, deps) {
  if (deps.secondSolver) return deps.secondSolver(qs);
  const router = require('../adapter/llmRouter');
  const { safeParseJson } = require('../utils/jsonParser');
  const body = qs.map((q, i) => `Q${i + 1}. ${stemOf(q)}\n${q.options.map((o, k) => `  ${'ABCD'[k]}) ${o}`).join('\n')}`).join('\n\n');
  const raw = await router.complete({
    prompt: `${body}\n\nFor EACH question write a JavaScript function solve() that computes the correct answer from the data in the question alone, using the standard definitions of the subject (state your convention in a comment). Return the computed VALUE (number, string or array as the correct option would state it), never an option letter. Plain JavaScript and Math only.\nReturn JSON only: {"solvers":[{"q":1,"solver":"function solve(){ ... }"}]}`,
    systemPrompt: 'You are a careful examiner who computes answers independently. Return JSON only.',
    temperature: 0, responseFormat: 'json', maxTokens: 3500, operation: 'KEY_PROOF_SECOND',
    model: 'openai/gpt-oss-120b', groqModels: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'], noGeminiFallback: true, reasoningEffort: 'medium'
  });
  const d = safeParseJson(raw, null) || {};
  const list = Array.isArray(d.solvers) ? d.solvers : [];
  return qs.map((_, i) => { const x = list.find(y => Number(y.q) === i + 1) || list[i]; return x && x.solver ? String(x.solver) : null; });
}

async function callProver(prompt, deps) {
  if (deps.callJson) return deps.callJson({ prompt });
  const lectureModel = require('../intelligence/lectureModel');
  return lectureModel._internal.callJson({
    systemPrompt: 'You are an exacting examiner who proves answers. Quotes must be copied character for character. Return JSON only.',
    prompt, maxTokens: 8000, operation: 'KEY_PROOF'
  });
}

/**
 * @param {Array} questions gate- and blind-check-accepted questions (mutated: each gets `keyProof`)
 * @param {object} lm lecture model (blocks / notesText)
 * @param {object} [deps] { callJson, retryWaitMs } for tests
 * @returns {Promise<{proven:Array, rejected:Array<{question, reasons, criteria}>, model?:string}>}
 */
async function proveQuestions(questions, lm, deps = {}) {
  const list = (questions || []).filter(Boolean);
  if (!list.length) return { proven: [], rejected: [] };
  const lecture = { grams: lectureGrams(lectureText(lm)) };
  const size = Math.max(1, parseInt(process.env.KEY_PROOF_BATCH, 10) || 3);
  const batches = [];
  for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
  const proven = []; const rejected = []; let model = null;
  const reject = (q, code, why) => {
    const reason = `${code}: ${why}`;
    q.keyProof = { status: 'UNPROVEN', reason: why };
    q.qualityGate = { ...(q.qualityGate || {}), status: 'REJECTED', criteria: [code], reasons: [reason] };
    rejected.push({ question: q, reasons: [reason], criteria: [code] });
  };
  const call = async (qs, notes) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const res = await callProver(buildPrompt(qs, lm, notes), deps); if (res && res.data) return res; } catch (_) {}
      if (attempt === 0) await new Promise(r => setTimeout(r, deps.retryWaitMs ?? require('../utils/capacityMode').retryWaitMs(parseInt(process.env.KEY_PROOF_RETRY_MS, 10) || 30000)));
    }
    return null;
  };
  const proofsOf = (res) => (Array.isArray(res.data.proofs) ? res.data.proofs : (Array.isArray(res.data) ? res.data : []));
  /** One question against its proof: null when proven, else [code, why]. */
  const judge = (q, p) => {
    const k = keyIndex(q);
    if (!p) return ['NOT_VALIDATED', 'no proof was returned'];
    // Proof 2: two independent solvers agree on the key.
    if (!q.blindCheck || q.blindCheck.status !== 'AGREES') return ['NOT_VALIDATED', 'the independent blind solve did not confirm the key'];
    const solved = 'ABCD'.indexOf(String(p.answer || '').trim().toUpperCase().charAt(0));
    if (solved !== k) return ['TECHNICAL_CORRECTNESS', `a second independent solve chose "${q.options[solved] ?? p.answer}", not the key`, 'final'];
    // Proof 3: a computed value matches the key and only the key.
    p.computed = false;
    if (isComputable(q)) {
      if (!p.solver || !String(p.solver).trim()) return ['TECHNICAL_CORRECTNESS', 'the answer is a value but no computation reproduces it'];
      // "function solve(){ return 'MySQL returns an error: …'; }" restates an answer; it does not compute one.
      const body = String(p.solver).replace(/function\s+solve\s*\([^)]*\)\s*\{/, '').replace(/\}\s*$/, '');
      const literal = !/[-+*/%<>]|=(?!>)|\b(?:for|while|if|Math|length|map|reduce|filter|push|pop|shift|splice|sort|slice|split|join)\b/.test(body.replace(/(["'`])(?:\.|(?!\1).)*\1/g, ''));
      if (literal) {
        // A fixed answer proves nothing, unless it is output the class actually saw ("Query OK, 0 rows affected"):
        // then the lecture itself is the proof, and the quote check below must hold.
        let shown = '';
        try { shown = String(runSolver(p.solver)); } catch (_) {}
        if (!(shown && tokens(shown).length >= 2 && quoteCoverage(shown, lecture.grams) >= 0.99 && optionsMatching(shown, q.options).join() === String(k))) {
          return ['TECHNICAL_CORRECTNESS', 'solve() only returns a fixed answer instead of computing it'];
        }
      }
      let value;
      try { value = runSolver(p.solver); } catch (e) { return ['TECHNICAL_CORRECTNESS', `the computation could not be run (${String(e.message).slice(0, 60)})`]; }
      if (typeof value === 'string' && /^[A-D]$/.test(value.trim())) return ['TECHNICAL_CORRECTNESS', 'solve() returned an option letter instead of the computed value'];
      const hits = optionsMatching(value, q.options);
      if (hits.length !== 1 || hits[0] !== k) {
        return ['TECHNICAL_CORRECTNESS', hits.length === 0
          ? `computing it gives ${JSON.stringify(value).slice(0, 60)}, which is none of the options`
          : `computing it gives ${JSON.stringify(value).slice(0, 60)}, matching "${q.options[hits[0]]}"${hits.length > 1 ? ' and others' : ''}, not only the key`];
      }
      p.computed = true;
    }
    // Proof 1: grounded in an exact lecture quote.
    // A computed key is proven by computation (and, below, by a second independent computation); its grounding comes from
    // the teaching point it was planned from. Requiring a quote as well refused correct calculation questions whose
    // formula sits in handwritten or LaTeX notes the prover could not copy verbatim (S09: 4 of 6 refusals).
    if (p.computed && (!p.quote || !String(p.quote).trim())) return null;
    const qp = quoteProblem(q, p.quote, lecture, p.computed);
    if (qp && p.computed) return null;
    return qp ? ['GROUNDING', qp] : null;
  };
  const accept = (q, p, res) => {
    q.keyProof = { status: 'PROVEN', model: res.model || null, quote: String(p.quote).slice(0, 400), computed: p.computed, ...(p.computed ? { solver: String(p.solver).slice(0, 800) } : {}) };
    proven.push(q);
  };
  await Promise.all(batches.map(async (b) => {
    const res = await call(b, []);
    if (!res) { b.forEach(q => reject(q, 'NOT_VALIDATED', 'the key could not be proven now (checking service unavailable); not delivered unproven')); return; }
    model = res.model || model;
    const proofs = proofsOf(res);
    const retry = [];
    b.forEach((q, i) => {
      const p = proofs.find(x => Number(x.q) === i + 1) || proofs[i];
      const v = judge(q, p);
      if (!v) return accept(q, p, res);
      // A failed computation or quote is asked once more with the reason; a second solver choosing another option
      // or a blind solve that did not agree is final.
      if (v[2] === 'final' || v[1].startsWith('the independent blind solve')) return reject(q, v[0], v[1]);
      retry.push({ q, v });
    });
    if (!retry.length) return;
    const res2 = await call(retry.map(r => r.q), retry.map(r => r.v[1]));
    const proofs2 = res2 ? proofsOf(res2) : [];
    retry.forEach(({ q, v }, i) => {
      const p = proofs2.find(x => Number(x.q) === i + 1) || proofs2[i];
      const v2 = res2 ? judge(q, p) : v;
      if (!v2) return accept(q, p, res2);
      reject(q, v2[0], v2[1]);
    });
  }));
  // A computed key needs a second, independently written computation from a different model family: one prover
  // once wrote solve() with the key's own wrong formula (binary tree height 3: "min 7, max 8"; C02, 27 Nov), so a
  // single computation can share the writer's misconception. Both computations must reproduce the key.
  const computed = proven.filter(q => q.keyProof && q.keyProof.computed);
  if (computed.length && process.env.KEY_PROOF_SECOND_SOLVER !== 'off' && !(require('../utils/capacityMode').isLean() && !deps.secondSolver)) {
    let second = null;
    try { second = await secondComputation(computed, deps); } catch (_) { second = null; }
    for (const q of computed) {
      const i = computed.indexOf(q);
      const code = second && second[i];
      let why = null;
      if (!code) why = 'the second independent computation could not be obtained now; not delivered unproven';
      else {
        try {
          const v = runSolver(code);
          const hits = optionsMatching(v, q.options);
          if (hits.length !== 1 || hits[0] !== keyIndex(q)) why = `a second independent computation gives ${JSON.stringify(v).slice(0, 60)}, ${hits.length ? `matching "${q.options[hits[0]]}"` : 'which is none of the options'}`;
        } catch (e) { why = `the second computation could not be run (${String(e.message).slice(0, 50)})`; }
      }
      if (why) {
        proven.splice(proven.indexOf(q), 1);
        reject(q, why.startsWith('the second independent computation could not') ? 'NOT_VALIDATED' : 'TECHNICAL_CORRECTNESS', why);
      } else q.keyProof.secondSolver = true;
    }
  }
  return { proven, rejected, model };
}

module.exports = { proveQuestions, isComputable, runSolver, optionsMatching, quoteProblem, _buildPrompt: buildPrompt };
