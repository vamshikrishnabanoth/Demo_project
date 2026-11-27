/**
 * server/engine/intelligence/lectureModel.js
 *
 * One shared understanding of a lecture.
 *
 * Built once when the teacher adds material (analyze-depth) and reused by:
 *   - the understanding panel (summary, timestamped segments, topics),
 *   - question capacity and the requested-count allocation,
 *   - the teaching score and its evidence,
 *   - question generation (teaching units with question angles and misconceptions).
 *
 * Design rules:
 *   - The whole input is read (windowed in parallel), never a sample.
 *   - Every unit and every teaching observation must quote the input; quotes are verified
 *     against the source blocks and unverified items are dropped.
 *   - Timestamps come from the Whisper segments that make up each block, never from even spacing.
 *   - Scores are computed deterministically from rubric ratings that cite verified evidence;
 *     a dimension without evidence is reported as "not enough evidence", never filled in.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const llmRouter = require('../adapter/llmRouter');
const { safeParseJson } = require('../utils/jsonParser');
const { classifyTextBlock } = require('../../utils/inputKind');

const teachingStyle = require('./teachingStyle');
const hardForms = require('./hardForms');
const semantic = require('../utils/semanticEmbedder');

const MODEL_VERSION = 'lecture-model-v2.12';
// Largest quiz a teacher can request (one setting for server, planner and UI). Default 30: a daily-quiz size.
const MAX_QUIZ_QUESTIONS = Math.max(1, parseInt(process.env.MAX_QUIZ_QUESTIONS, 10) || 30);
const CACHE_DIR = path.join(__dirname, '..', '..', 'storage', 'lecture_model_cache');
const WINDOW_CHARS = 12000; // smaller windows: faster per call, more in parallel, fits Groq's per-minute token limit
const MAX_PARALLEL_WINDOWS = 6;
const memoryCache = new Map();
const modelCooldownUntil = new Map();
const rateLimitedUntil = new Map();
// A model that keeps answering 429 has usually spent its daily free quota: stop asking it for a while
// instead of paying two failed round-trips on every call (that alone added minutes to a quiz).
const consecutive429 = new Map();
const lastSuccessAt = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Rubric (shared with the UI through the payload)
// ─────────────────────────────────────────────────────────────────────────────
const TEACHING_DIMENSIONS = [
  {
    key: 'clarity',
    label: 'Conceptual clarity',
    question: 'Were the key terms and ideas stated precisely and explained before being used?',
    levels: {
      1: 'Key terms used without explanation, or explanations confusing or circular.',
      2: 'Some terms explained; several important ones left vague.',
      3: 'Most key ideas explained clearly; a few gaps.',
      4: 'Every key idea is stated precisely and explained in plain terms before it is used.'
    }
  },
  {
    key: 'reasoning',
    label: 'Explaining the why',
    question: 'Did the teacher explain why things work (causes, justification, trade-offs), not only what they are?',
    levels: {
      1: 'Facts or steps are only asserted.',
      2: 'Occasional reasons, mostly assertion.',
      3: 'Reasons given for most mechanisms or steps.',
      4: 'Consistently explains why each mechanism/step works and what would go wrong otherwise.'
    }
  },
  {
    key: 'examples',
    label: 'Examples and demonstrations',
    question: 'Were ideas made concrete with examples, worked problems, code, commands or traces where they would help?',
    levels: {
      1: 'No concrete example where one was clearly needed.',
      2: 'Few examples, or examples not connected to the idea.',
      3: 'Relevant examples for most important ideas.',
      4: 'Well-chosen examples or demonstrations for the important ideas, explained step by step.'
    }
  },
  {
    key: 'structure',
    label: 'Logical flow',
    question: 'Did the lecture progress in a sensible order and connect ideas to each other?',
    levels: {
      1: 'Jumps between ideas with no visible order.',
      2: 'Some order, but connections between ideas are rarely made.',
      3: 'Sensible order with most connections made.',
      4: 'Clear progression; each idea builds on the previous one and the links are stated.'
    }
  },
  {
    key: 'accuracy',
    label: 'Technical accuracy',
    question: 'Were the statements technically correct?',
    levels: {
      1: 'Several clear technical errors.',
      2: 'One clear technical error on an important point.',
      3: 'Minor imprecision only.',
      4: 'No technical errors found in what was taught.'
    }
  },
  {
    key: 'depth',
    label: 'Depth for the lecture\'s aim',
    question: 'Given what this lecture set out to teach (and its level), were the important points covered in enough depth?',
    levels: {
      1: 'Most of the stated aim is only named, not taught.',
      2: 'Important parts of the aim are rushed or skipped.',
      3: 'The aim is mostly covered at a suitable depth.',
      4: 'The stated aim is fully covered at a depth suited to its level.'
    }
  }
];

const UNIT_KINDS = ['DEFINITION', 'MECHANISM', 'EXAMPLE', 'CODE', 'COMMAND', 'CALCULATION', 'ALGORITHM_TRACE', 'COMPARISON', 'EDGE_CASE', 'APPLICATION'];
const ANGLE_TYPES = ['recall', 'concept', 'mechanism', 'trace', 'output', 'calculation', 'debug', 'comparison', 'edge_case', 'application', 'scenario'];
const CODE_KINDS = new Set(['CODE', 'COMMAND', 'ALGORITHM_TRACE']);
// Code read aloud in a lecture: loop headers, declarations, increments and print calls said in words.
const SPOKEN_CODE_PATTERNS = [
  /\b(?:for|while)\s*\(?\s*\w+\s*(?:equal to|equals|=|less than|<)/i, /\bplus plus\b|\+\+|\bminus minus\b/i,
  /\b(?:int|float|double|char|string|bool|var|let|const)\s+\w+\s*(?:equal to|equals|=)/i, /\bprint\s?f\b|\bprintln\b|system\.out|\bcout\b|\bprint\(/i,
  /\bif\s*\(?\s*\w+(?:\s+of\s+\w+)?\s*(?:equal equal|==|double equal|is equal to)/i, /\breturn\s+\w+\s*;|\bdef\s+\w+\(|\bfunction\s+\w+\(/i,
  /\b\w+\s+of\s+(?:i|j|x|0|1)\b.*\b(?:equal to|==|=)/i
];
function spokenCodeHits(text) { return SPOKEN_CODE_PATTERNS.filter(re => re.test(text || '')).length; }

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (sec === null || sec === undefined || !isFinite(sec)) return null;
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function normWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9$#_+\-*/=<>%.]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/** A quote is verified if (almost) all of its words appear in order-insensitive form in the source. */
function quoteSupported(quote, sourceText) {
  const q = normWords(quote);
  if (q.length < 3) return false;
  const src = ' ' + normWords(sourceText).join(' ') + ' ';
  if (src.includes(' ' + q.join(' ') + ' ')) return true;
  const srcSet = new Set(src.trim().split(' '));
  const hit = q.filter(w => srcSet.has(w)).length;
  return hit / q.length >= 0.85;
}

function jaccard(a, b) {
  const A = new Set(normWords(a).filter(w => w.length > 3));
  const B = new Set(normWords(b).filter(w => w.length > 3));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

function hashInput(parts) {
  const h = crypto.createHash('sha256');
  h.update(MODEL_VERSION);
  for (const p of parts) h.update('\u0000' + String(p || ''));
  return h.digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Blocks: the addressable units of the source (with real times when available)
// ─────────────────────────────────────────────────────────────────────────────

/** Groups Whisper segments into ~60s / ~170-word blocks that keep their real start and end. */
function blocksFromSegments(segments, prefix = 'B') {
  const blocks = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.text.trim()) blocks.push(cur);
    cur = null;
  };
  for (const s of segments) {
    const text = String(s.text || '').trim();
    if (!text) continue;
    const start = Number(s.start);
    const end = Number(s.end);
    if (!cur) cur = { source: 'SPEECH', start: isFinite(start) ? start : null, end: isFinite(end) ? end : null, text: '' };
    cur.text += (cur.text ? ' ' : '') + text;
    if (isFinite(end)) cur.end = end;
    const dur = (cur.end ?? 0) - (cur.start ?? 0);
    if (dur >= 60 || wordCount(cur.text) >= 170) flush();
  }
  flush();
  return blocks.map((b, i) => ({ ...b, id: `${prefix}${String(i + 1).padStart(2, '0')}` }));
}

const TERMINAL_PROMPT = /^\s*(?:\$|#|>>>|>|PS [A-Za-z]:\\[^>]*>|[A-Za-z]:\\[^>]*>|[\w.-]+@[\w.-]+:[^$#]*[$#]|mysql>|MariaDB \[[^\]]*\]>|SQL>|[\w-]+=[#>]|sqlite>|In \[\d+\]:)\s*\S/;

/** Terminal sessions: one block per 1-2 commands (with their output), so each command can be its own teaching point. */
function blocksFromTerminal(raw, source, prefix, label) {
  const lines = raw.split('\n');
  const cmds = [];
  let cur = null;
  for (const line of lines) {
    if (TERMINAL_PROMPT.test(line)) { if (cur) cmds.push(cur); cur = [line]; }
    else if (cur) cur.push(line);
    else cmds.push([line]);
  }
  if (cur) cmds.push(cur);
  const blocks = [];
  let buf = [];
  for (const c of cmds) {
    buf.push(c.join('\n'));
    if (buf.length >= 2 || c.length > 6) { blocks.push(buf.join('\n')); buf = []; }
  }
  if (buf.length) blocks.push(buf.join('\n'));
  return blocks.filter(b => b.trim()).map((t, i) => ({ source, start: null, end: null, slide: null, text: t, label, kind: 'TERMINAL', id: `${prefix}${String(i + 1).padStart(2, '0')}` }));
}

/** Code: split on blank lines / top-level definitions into ~25-line blocks. */
function blocksFromCode(raw, source, prefix, label) {
  const lines = raw.split('\n');
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.join('').trim()) blocks.push(buf.join('\n')); buf = []; };
  for (const line of lines) {
    // Small blocks (one method / class header / statement group, ≤12 lines) so every construct can be its own teaching point.
    const startsDef = /^\s*(?:public |private |protected |static |def |class |function |int |void |double |String |@Override|#include|SELECT |CREATE |INSERT |UPDATE |DELETE |WITH |--)/i.test(line) && buf.length >= 3;
    if (startsDef || buf.length >= 12) flush();
    buf.push(line);
  }
  flush();
  return blocks.map((t, i) => ({ source, start: null, end: null, slide: null, text: t, label, kind: 'CODE', id: `${prefix}${String(i + 1).padStart(2, '0')}` }));
}

/** Splits untimed text into ~180-word blocks along slide / paragraph / code boundaries. */
function blocksFromText(text, source = 'MATERIAL', prefix = 'D', label = null) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  const kind = classifyTextBlock(raw);
  if (kind === 'terminal') return blocksFromTerminal(raw, source, prefix, label);
  if (kind === 'code') return blocksFromCode(raw, source, prefix, label);
  // Slide markers from pptxSlides.renderSlides keep their slide number.
  const slideParts = raw.split(/\n(?=--- Slide \d+ ---)/);
  const pieces = [];
  for (const part of slideParts) {
    const slideMatch = part.match(/^--- Slide (\d+) ---/);
    const slide = slideMatch ? Number(slideMatch[1]) : null;
    const paras = part.split(/\n\s*\n/).map(p => p.replace(/\s+$/g, '')).filter(p => p.trim());
    for (const p of paras) pieces.push({ text: p, slide });
  }
  const blocks = [];
  let cur = null;
  for (const p of pieces) {
    const sameSlide = cur && cur.slide === p.slide;
    // Never merge across slides (slide numbers must stay exact); within a slide/document merge to ~220 words.
    if (cur && (!sameSlide || (wordCount(cur.text) + wordCount(p.text) > 220 && wordCount(cur.text) >= 25))) {
      blocks.push(cur);
      cur = null;
    }
    if (!cur) cur = { source, start: null, end: null, slide: p.slide, text: '', label };
    cur.text += (cur.text ? '\n\n' : '') + p.text;
  }
  if (cur && cur.text.trim()) blocks.push(cur);
  // Very long single pieces (e.g. a long code file without blank lines) are split by lines.
  const out = [];
  for (const b of blocks) {
    if (wordCount(b.text) <= 400) { out.push(b); continue; }
    const lines = b.text.split('\n');
    let buf = [];
    for (const line of lines) {
      buf.push(line);
      if (wordCount(buf.join('\n')) >= 220) { out.push({ ...b, text: buf.join('\n') }); buf = []; }
    }
    if (buf.join('').trim()) out.push({ ...b, text: buf.join('\n') });
  }
  return out.map((b, i) => ({ ...b, id: `${prefix}${String(i + 1).padStart(2, '0')}` }));
}

function buildBlocks({ text = '', segments = [], documents = [] }) {
  const timed = Array.isArray(segments) && segments.some(s => s && isFinite(Number(s.start)) && String(s.text || '').trim());
  let speech = [];
  let material = [];
  if (timed) {
    speech = blocksFromSegments(segments, 'B');
  } else if (String(text || '').trim()) {
    // No timing: the main text is treated as material (document, notes, code, terminal output).
    material = blocksFromText(text, 'MATERIAL', 'D');
  }
  let docIdx = material.length;
  for (const doc of (documents || [])) {
    const docText = typeof doc === 'string' ? doc : (doc && doc.text) || '';
    const name = typeof doc === 'string' ? null : (doc && doc.name) || null;
    const blocks = blocksFromText(docText, 'MATERIAL', 'D', name);
    for (const b of blocks) {
      docIdx++;
      material.push({ ...b, id: `D${String(docIdx).padStart(2, '0')}` });
    }
  }
  return { speech, material, timed };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Windows: whole input, processed in parallel; slides travel with the speech they match
// ─────────────────────────────────────────────────────────────────────────────
// Semantic linkage: speech passages (runs of consecutive blocks) and material blocks are embedded in ONE request
// (free-tier limit), so a slide explained in the teacher's own words, or a translated code-mixed class, still finds
// its speech. Returns null when embeddings are unavailable; buildWindows then uses word overlap alone, as before.
async function prepareSemanticLinkage(speech, material) {
  if (!speech.length || !material.length || !semantic.enabled()) return null;
  const matGroups = semantic.groupConsecutive(material, 45);
  const passages = semantic.groupConsecutive(speech, Math.min(Math.ceil(speech.length / 3), semantic.MAX_TEXTS_PER_CALL - matGroups.length));
  const vecs = await semantic.embedMany([...passages.map(p => p.map(b => b.text).join(' ')), ...matGroups.map(g => g.map(b => b.text).join('\n'))], { label: 'speech–slide linkage' });
  if (!vecs) return null;
  const passageVec = vecs.slice(0, passages.length);
  const passageOf = new Map();
  passages.forEach((p, i) => p.forEach(b => passageOf.set(b.id, i)));
  const matVec = new Map();
  matGroups.forEach((g, i) => g.forEach(b => matVec.set(b.id, vecs[passages.length + i])));
  // Threshold relative to this lecture: one subject makes every pair fairly similar, so only the top 10% of
  // speech–material pairs (and at least 0.6) count as a semantic link on their own.
  const sims = [];
  for (const mv of new Set(matVec.values())) for (const pv of passageVec) { const c = semantic.cosine(mv, pv); if (c !== null) sims.push(c); }
  sims.sort((a, b) => a - b);
  return { passageVec, passageOf, matVec, threshold: Math.max(0.6, semantic.quantile(sims, 0.9) || 0.6), stats: { semanticOnly: 0, movedBySemantic: 0, considered: 0 } };
}

function buildWindows(speech, material, sem = null) {
  const windows = [];
  if (speech.length > 0) {
    let cur = [];
    let size = 0;
    for (const b of speech) {
      if (cur.length && size + b.text.length > WINDOW_CHARS) {
        windows.push({ speech: cur, material: [] });
        cur = []; size = 0;
      }
      cur.push(b); size += b.text.length;
    }
    if (cur.length) windows.push({ speech: cur, material: [] });

    // Attach each material block to the speech window it overlaps most (cross-referencing).
    const unattached = [];
    const windowText = windows.map(w => w.speech.map(s => s.text).join(' '));
    for (const m of material) {
      let best = -1; let bestScore = 0;
      const lex = windowText.map(t => jaccard(m.text, t));
      lex.forEach((score, i) => { if (score > bestScore) { bestScore = score; best = i; } });
      // Candidate windows, best first; a window that is already full passes the block to the next good match.
      let order = lex.map((s, i) => i).sort((a, b) => lex[b] - lex[a]);
      let ok = (i) => lex[i] >= 0.04;
      const mv = sem && sem.matVec.get(m.id);
      if (mv) {
        // Hybrid: shared words and shared meaning, each normalised across windows, weigh equally. A link holds if
        // either signal is strong, so semantic linking only adds links; it never removes a word-overlap link.
        const sv = windows.map(w => Math.max(-1, ...[...new Set(w.speech.map(b => sem.passageOf.get(b.id)))].map(p => semantic.cosine(mv, sem.passageVec[p]) ?? -1)));
        const zl = semantic.zScores(lex); const zs = semantic.zScores(sv);
        const h = zl.map((z, i) => 0.5 * z + 0.5 * zs[i]);
        order = h.map((x, i) => i).sort((a, b) => h[b] - h[a]);
        ok = (i) => lex[i] >= 0.04 || sv[i] >= sem.threshold;
        sem.stats.considered++;
        const hb = order[0];
        if (bestScore < 0.04 && ok(hb)) sem.stats.semanticOnly++;
        if (bestScore >= 0.04 && hb !== best && ok(hb)) sem.stats.movedBySemantic++;
      }
      let placed = false;
      for (const i of order) {
        if (!ok(i)) continue;
        const w = windows[i];
        const used = w.material.reduce((n, x) => n + x.text.length, 0);
        if (used + m.text.length <= 6000) { w.material.push(m); placed = true; break; }
      }
      if (placed) continue;
      unattached.push(m);
    }
    // Material not matched to any speech goes into its own windows (marked material-only by the model).
    let mcur = []; let msize = 0;
    for (const m of unattached) {
      if (mcur.length && msize + m.text.length > WINDOW_CHARS) { windows.push({ speech: [], material: mcur }); mcur = []; msize = 0; }
      mcur.push(m); msize += m.text.length;
    }
    if (mcur.length) windows.push({ speech: [], material: mcur });
  } else {
    let cur = []; let size = 0;
    for (const m of material) {
      if (cur.length && size + m.text.length > WINDOW_CHARS) { windows.push({ speech: [], material: cur }); cur = []; size = 0; }
      cur.push(m); size += m.text.length;
    }
    if (cur.length) windows.push({ speech: [], material: cur });
  }
  return windows;
}

function renderBlock(b) {
  const head = b.source === 'SPEECH'
    ? `[${b.id} ${fmtTime(b.start)}-${fmtTime(b.end)}]`
    : `[${b.id}${b.slide ? ` slide ${b.slide}` : ''}${b.label ? ` from "${b.label}"` : ''}]`;
  return `${head}\n${b.text}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LLM calls (Gemini Flash-Lite first: large context and high rate limits; Groq fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiDirect({ systemPrompt, prompt, maxTokens, model }) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  // Gemini key pool: a quota error on one key moves to the next (engine/utils/geminiKeys.js).
  return require('../utils/geminiKeys').withKey(async (apiKey) => {
    const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
    });
    const result = await m.generateContent(prompt);
    return result.response.text();
  });
}

async function callJson({ systemPrompt, prompt, maxTokens = 8192, operation, models = null, noGroqFallback = false, groqModel = null }) {
  // Free-tier quota is per model, so work is split: the steps where a weak model causes real errors
  // (Hard questions, the independent answer check, the teaching score) get the strongest model first;
  // lecture reading starts on other models, leaving the strongest model's daily quota for those steps.
  const CRITICAL_OPS = new Set(['HARD_BATCH_GENERATION', 'BLIND_ANSWER_CHECK', 'FINAL_QUALITY_GATE', 'TEACHING_SCORE']);
  const defaultList = CRITICAL_OPS.has(operation)
    // Free tier: gemini-3.5-flash / 3.6-flash allow ~20 requests a day; they are reserved for writing Hard questions
    // (agent2 HARD_GEMINI_MODELS), so every other step uses the lite models (~500/day). Override with GEMINI_CRITICAL_MODELS.
    ? (process.env.GEMINI_CRITICAL_MODELS || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
    : (process.env.LECTURE_MODEL_GEMINI || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite');
  const listed = Array.isArray(models) && models.length ? models : defaultList.split(",").map(s => s.trim()).filter(Boolean);
  // Models that answered in the last 10 minutes go first (stable sort keeps the configured order otherwise).
  const recent = (m) => ((lastSuccessAt.get(m) || 0) > Date.now() - 10 * 60000 ? 0 : 1);
  const geminiModels = (Array.isArray(models) && models.length) || CRITICAL_OPS.has(operation) ? listed : [...listed].sort((a, b) => recent(a) - recent(b));
  const timing = process.env.LECTURE_MODEL_TIMING !== 'false';
  // Reading steps are on the teacher's critical path: never sit waiting on a busy Gemini model.
  const readingStep = /^LECTURE_MODEL_/.test(operation);
  let lastErr = null;
  let settled = false;

  const geminiPath = async () => {
    if (!require('../utils/geminiKeys').hasKey() || process.env.DISABLE_GEMINI === 'true') throw new Error('Gemini disabled');
    // Two rounds over the model list: a model that is only briefly rate-limited (429) gets a second chance
    // after a short retry delay; a model that errors otherwise is benched for a minute.
    for (let round = 0; round < 2; round++) {
      for (const geminiModel of geminiModels) {
        if (settled) throw new Error('superseded');
        if ((modelCooldownUntil.get(geminiModel) || 0) > Date.now()) continue;
        const waitUntil = rateLimitedUntil.get(geminiModel) || 0;
        if (waitUntil > Date.now()) {
          if (round === 0) continue;
          const wait = waitUntil - Date.now();
          if (readingStep && wait > 5000) continue; // Groq answers faster than waiting out a long retry delay
          await new Promise(r => setTimeout(r, Math.min(25000, wait)));
        }
        try {
          const callStart = Date.now();
          const raw = await withTimeout(callGeminiDirect({ systemPrompt, prompt, maxTokens, model: geminiModel }), readingStep ? 60000 : 150000, 'Gemini lecture model timeout');
          consecutive429.delete(geminiModel); lastSuccessAt.set(geminiModel, Date.now());
          const parsed = safeParseJson(raw, null);
          if (timing) console.log(`[LectureModel] ${operation} via ${geminiModel}: ${((Date.now() - callStart) / 1000).toFixed(1)}s, ${prompt.length} chars in, ${String(raw || '').length} chars out`);
          if (parsed) return { data: parsed, provider: 'gemini', model: geminiModel };
          lastErr = new Error('Gemini returned unparseable JSON');
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || '');
          if (!settled) console.warn(`[LectureModel] ${operation} via ${geminiModel} failed (round ${round + 1}): ${msg.slice(0, 160)}`);
          if (/429|RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg)) {
            const m = msg.match(/retry(?:Delay)?["\s:]*(?:in\s*)?(\d+(?:\.\d+)?)s/i);
            rateLimitedUntil.set(geminiModel, Date.now() + Math.min(30000, (m ? parseFloat(m[1]) : 10) * 1000 + 500));
            const n = (consecutive429.get(geminiModel) || 0) + 1;
            consecutive429.set(geminiModel, n);
            const daily = /PerDay|per day|daily/i.test(msg);
            if (daily || n >= 2) {
              modelCooldownUntil.set(geminiModel, Date.now() + (daily ? 30 : 10) * 60000);
              consecutive429.delete(geminiModel);
              console.warn(`[LectureModel] ${geminiModel} looks out of quota; skipping it for ${daily ? 30 : 10} min.`);
            }
          } else if (!/unparseable/i.test(msg)) {
            // Overloaded (503), internal errors, timeouts, dropped connections: bench the model for a minute
            // so parallel calls stop paying 10-20 s for the same failure.
            modelCooldownUntil.set(geminiModel, Date.now() + 5 * 60000);
          }
        }
      }
    }
    throw lastErr || new Error('no Gemini model available');
  };

  const groqPath = async () => {
    const groqStart = Date.now();
    // Groq's free tier counts prompt + max_tokens against ~8,000 tokens a minute per model: a request that cannot
    // fit is refused at once (the caller splits it), and max_tokens is cut to what fits.
    const promptTokens = Math.ceil((String(systemPrompt || '').length + String(prompt || '').length) / 3.5);
    if (promptTokens > 6200) throw new Error(`PROMPT_TOO_LARGE_FOR_GROQ (${promptTokens} tokens)`);
    const groqMax = Math.max(1200, Math.min(maxTokens, 7800 - promptTokens));
    const raw = await llmRouter.complete({
      prompt, systemPrompt, temperature: 0, responseFormat: 'json', maxTokens: groqMax, operation,
      model: groqModel || process.env.LECTURE_MODEL_GROQ || 'openai/gpt-oss-120b'
    });
    const parsed = safeParseJson(raw, null);
    if (timing) console.log(`[LectureModel] ${operation} via groq: ${((Date.now() - groqStart) / 1000).toFixed(1)}s`);
    if (parsed) return { data: parsed, provider: 'groq', model: groqModel || process.env.LECTURE_MODEL_GROQ || 'openai/gpt-oss-120b' };
    throw new Error('Groq returned unparseable JSON');
  };

  const fail = (e) => new Error(`Lecture model call failed (${operation}): ${lastErr ? lastErr.message + ' | ' : ''}${e ? e.message : ''}`);
  if (noGroqFallback) {
    try { return await geminiPath(); } catch (e) { throw new Error(`Lecture model call failed (${operation}): ${(lastErr || e).message}`); }
  }
  if (!readingStep) {
    try { return await geminiPath(); } catch (_) { /* fall through to Groq */ }
    try { return await groqPath(); } catch (e) { throw fail(e); }
  }

  // Reading steps: if Gemini has not answered within LECTURE_HEDGE_MS, Groq starts on the same request
  // and whichever valid answer arrives first is used (a slow or failing model can no longer stall reading).
  const HEDGE_MS = Math.max(2000, parseInt(process.env.LECTURE_HEDGE_MS, 10) || 10000);
  return new Promise((resolve, reject) => {
    let pending = 2;
    let groqStarted = false;
        const win = (r) => { if (!settled) { settled = true; clearTimeout(hedgeTimer); resolve(r); } };
    const lose = (e) => { if (--pending === 0 && !settled) { settled = true; reject(fail(e)); } };
    const startGroq = () => { if (groqStarted || settled) return; groqStarted = true; groqPath().then(win, lose); };
    const hedgeTimer = setTimeout(() => { if (!settled) { if (timing) console.log(`[LectureModel] ${operation}: Gemini slow after ${HEDGE_MS / 1000}s, starting Groq in parallel`); startGroq(); } }, HEDGE_MS);
    geminiPath().then(win, (e) => { clearTimeout(hedgeTimer); lose(e); startGroq(); });
  });
}


function withTimeout(promise, ms, msg) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })
  ]);
}

const WINDOW_SYSTEM = `You analyse teaching material for a university quiz system. You read a lecture transcript and/or teaching material (slides, notes, code, terminal sessions) split into numbered blocks, and return a faithful JSON map of WHAT WAS ACTUALLY TAUGHT.

Rules:
- Use only the blocks given. Never add facts from outside knowledge.
- Speech blocks are "B.." (with times). Material blocks are "D.." (slides/documents/code). When a speech block explains a material block, cite both.
- Ignore greetings, attendance, admin talk, jokes and filler.
- Every quote must be copied word-for-word from one cited block (8-30 words; for code or commands, copy the exact line(s)).
- Do not judge accent, fluency, filler words, speaking speed or transcription errors.
- Speech blocks are automatic speech recognition: words are sometimes misheard ("R curve" for ROC curve, "mode prediction" for total predictions, a dropped word in a formula). Read for what the teacher clearly meant. A garbled word, a half-heard formula or a misnamed term is a transcription slip, never a teaching gap or technical error; record a technical error only when the teacher's meaning is clearly wrong (stated plainly, or repeated, or shown on a slide).
- Return JSON only.`;

function windowPrompt(win, ctx) {
  const blocks = [...win.speech, ...win.material].map(renderBlock).join('\n\n');
  return `Lecture context: ${ctx}

BLOCKS:
${blocks}

Return this JSON:
{
  "segments": [ { "from": "B01", "to": "B03", "title": "3-6 word title", "description": "one short plain sentence stating what was taught, starting with the content itself (e.g. 'Four benefits of IPC: ...', 'Traces git add moving a file to the staging area') — never start with 'The lecture' or 'The instructor'", "delivery": "how this part was taught: CONCEPTUAL (explaining ideas, definitions, differences, why) | CODE (walking through code, a notebook, commands or a tool live) | NUMERICAL (solving a problem or derivation step by step with numbers) | EXAMPLE (teaching mainly through a concrete example, analogy or real-life scenario) | REVISION (quick recap or exam-style revision of points)" } ],
  "units": [
    {
      "topic": "macro topic (reuse the same name for the same topic)",
      "subtopic": "specific idea, rule, command, algorithm or example",
      "kind": "one of ${UNIT_KINDS.join('|')}",
      "blocks": ["B02"],
      "statement": "1-2 sentences: the precise point that was taught, in your own words. Write technical terms correctly: when the transcript has an obvious speech-recognition error (e.g. 'FX score' for 'F1 score', 'redlock' for 'deadlock'), use the correct term here and in topic, subtopic and angles; only 'quote' stays verbatim",
      "quote": "verbatim words from one of the cited blocks",
      "depth": "MENTIONED (only named) | EXPLAINED (explained) | DEMONSTRATED (worked example, code, trace or calculation shown)",
      "importance": "CORE (part of the subject being taught) | ASIDE (a passing remark: platforms or tools mentioned in passing, career/exam/admin talk, motivation, anecdotes that explain nothing)",
      "teacherExample": "the concrete example, analogy, scenario or numbers the teacher used to teach THIS point, in one short sentence (null if none). An analogy or example that explains a point belongs to that point (CORE), not to an ASIDE",
      "angles": [ { "type": "one of ${ANGLE_TYPES.join('|')}", "difficulty": "easy|medium|hard", "focus": "the specific thing one question would test" } ],
      "misconceptions": ["a specific wrong belief a student could have about this point"]
    }
  ],
  "observations": [
    { "dimension": "one of ${TEACHING_DIMENSIONS.map(d => d.key).join('|')}", "polarity": "strength|gap", "blocks": ["B04"], "quote": "verbatim words", "note": "specific: what was done well, or what was missing and where" }
  ],
  "contradictions": [ { "blocks": ["B05", "D02"], "note": "what the speech and the material disagree on" } ]
}

How to fill it:
- segments: cover every speech block in order (if there are speech blocks). Make a new segment whenever the idea being taught changes — typically every 1-3 minutes, so a ${win.speech.length}-block window usually has about ${Math.max(1, Math.round(win.speech.length / 2))} segments. For material-only input, make one segment per section/slide group instead. Titles name the specific idea (e.g. "git add and the staging area"), never generic ("Introduction", "Practical demonstration"). Label each segment's delivery by how THAT part was taught (a class often mixes, e.g. theory first, then a notebook demo, then a worked problem); judge from what the teacher is doing, not from the subject.
- units: be thorough and fine-grained. Make one unit for EACH distinct teachable point: every definition, every command or flag explained, every step of a procedure, every rule, every example worked through, every comparison, every warning or edge case. Every block that is not chatter must be cited by at least one unit. For code or terminal sessions, each command (with its flags and its output or state change) and each code construct is its own unit. A substantive block usually contains 1-3 units; this window has ${win.speech.length + win.material.length} blocks, so expect roughly ${Math.max(2, Math.round((win.speech.length + win.material.length) * 1.3))} units or more if the content is dense (fewer only if much of it is chatter). Do not create units for things only listed in a slide title and never discussed. If the same point is explained and later demonstrated (or repeated), make ONE unit that cites all of those blocks.
- For code, SQL or terminal material, think like a teacher setting a lab quiz: the exact output of the whole program/session, the effect of each important call or command (and its flags), what each key line or keyword does and why it is there, what happens for a boundary or invalid input, and what goes wrong if one line is changed. Each of these is its own unit or angle.
- angles: give every EXPLAINED or DEMONSTRATED unit 2-4 angles; only angles this unit's content really supports, each testing something different (max 4):
  * trace / output / debug only for code, commands, algorithm steps or traces that were shown;
  * calculation only if a formula or numeric procedure was shown;
  * hard only for real multi-step reasoning on what was taught (edge case, what-if, combining ideas, diagnosing a wrong result) — not for long or wordy recall;
  * a MENTIONED unit gets at most one easy recall angle.
- misconceptions: 2-3 per unit, drawn from contrasts or warnings the teacher made, near-miss steps, off-by-one or boundary errors, or confusion with a related idea from the same lecture.
- observations: 2-6 specific ones about teaching quality, each tied to a block and quote. Gaps must say what was missing and where (e.g. "showed the steps of X but not why Y holds").
- A recorded class has several voices and the transcript has no speaker labels. Students answer, guess, propose their own approach and get corrected. Before writing a gap, read the next blocks: a question the teacher asks the class ("why is X? can anyone tell me?") that is then answered or explained is a teaching strength, not a gap; a wrong statement followed by "no, no" or a correction is a student's guess (or a deliberate slip) being corrected; running a failing case on purpose and working out why is a demonstration of debugging; judging a student's approach ("you are unnecessarily sorting again") is reasoning, not an admission of error.`;
}

const EVAL_SYSTEM = `You are a careful, fair reviewer of university teaching. You rate one lecture against a fixed rubric using ONLY the evidence listed. You judge what was taught, relative to what the lecture set out to teach and its level: an introductory lecture is not penalised for lacking advanced material. You never judge accent, fluency, filler words, voice, enthusiasm, speaking speed or transcription errors. Quotes from speech are automatic speech recognition: words are sometimes misheard ("R curve" for ROC curve, "mode prediction" for total predictions, a dropped word in a formula). Read for what the teacher clearly meant. A garbled word, a half-heard formula or a misnamed term is a transcription slip, never a teaching gap or technical error; record a technical error only when the teacher's meaning is clearly wrong (stated plainly, or repeated, or shown on a slide). A class has several voices with no speaker labels: student answers, guesses and proposed approaches, questions the teacher asks the class, a failing case run on purpose to debug it, and the teacher's critique of a student's approach are interaction, never the teacher's errors or gaps. If the evidence for a dimension is too thin to judge, you say so instead of guessing. Return JSON only.`;

function evalPrompt(lecture) {
  const rubric = TEACHING_DIMENSIONS.map(d =>
    `- ${d.key} (${d.label}): ${d.question}\n  1 = ${d.levels[1]}\n  2 = ${d.levels[2]}\n  3 = ${d.levels[3]}\n  4 = ${d.levels[4]}`
  ).join('\n');
  const units = lecture.units.map(u => `${u.id} [${u.kind}, ${u.depth}] ${u.topic} / ${u.subtopic}: ${u.statement}`).join('\n');
  const obs = lecture.observations.map(o => `${o.id} [${o.dimension}, ${o.polarity}] ${o.note} — "${o.quote}" (${o.where})`).join('\n');
  const segs = lecture.segments.map(s => `${s.time ? s.time + ' ' : ''}${s.title}: ${s.description}`).join('\n');
  return `LECTURE: ${lecture.title}
Input: ${lecture.inputDescription}

OUTLINE:
${segs}

TEACHING UNITS (what was taught):
${units}

OBSERVATIONS (verified quotes):
${obs || '(none)'}

RUBRIC:
${rubric}

First decide, from the outline and units, the lecture's level and what it set out to teach; judge depth against that aim.

Return:
{
  "level": "INTRODUCTORY|INTERMEDIATE|ADVANCED",
  "intent": "one sentence: what this lecture set out to teach",
  "dimensions": [
    {
      "key": "clarity",
      "rating": 1-4 or null if there is not enough evidence,
      "evidence": ["O3", "U5"]  (REQUIRED for every rated dimension: cite the observation or unit ids that support it; units (U..) count as evidence for clarity, examples, structure and depth),
      "finding": "one sentence (max 20 words) on what the evidence shows, naming the specific topic",
      "improvement": "one specific, actionable suggestion in max 18 words naming the topic and what to add (or null if rating is 4)"
    }
  ],
  "strengths": ["2-3 specific strengths, max 15 words each, each naming the topic"],
  "improvements": ["2-3 specific next steps, max 15 words each, each naming the topic (never a unit id) and exactly what to add"]
}
Every rating must cite at least one evidence id from the lists above. For accuracy, cite the units you checked and only lower the rating for an error you can name.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Build
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string} opts.text            Transcript (voice) or material text (documents/notes/code)
 * @param {Array}  opts.segments        Whisper segments [{start,end,text}] (voice only)
 * @param {Array}  opts.documents       Extra material [{name,text}] (e.g. slides for audio+slides)
 * @param {string} opts.title
 * @param {string} opts.modality        VOICE_ONLY | DOCUMENT_ONLY | HYBRID | TEXT
 */
async function buildLectureModel(opts = {}) {
  const t0 = Date.now();
  const { text = '', segments = [], documents = [], title = '', modality = null, forceRefresh = false } = opts;
  const { speech, material, timed } = buildBlocks({ text, segments, documents });
  const allBlocks = [...speech, ...material];
  if (allBlocks.length === 0) {
    return { ok: false, reason: 'EMPTY_INPUT', message: 'No readable content was found in the input.' };
  }
  const blockMap = Object.fromEntries(allBlocks.map(b => [b.id, b]));
  // Semantic linkage changes which slides travel with which speech, so it gets its own cache entries.
  const semanticIntended = speech.length > 0 && material.length > 0 && semantic.enabled();
  // reading:v2 (27 Nov 2026): block kinds stored, blind calibration, revisit counts, meaning vectors; older readings are rebuilt.
  const key = hashInput([allBlocks.map(b => `${b.id}|${b.start}|${b.text}`).join('\n'), title, 'reading:v2', ...(semanticIntended ? ['linkage:semantic-v1'] : [])]);

  if (!forceRefresh) {
    const hit = readCache(key);
    if (hit) return { ...hit, cached: true };
  }

  const totalWords = allBlocks.reduce((n, b) => n + wordCount(b.text), 0);
  const durationSec = timed ? (speech[speech.length - 1].end || 0) - (speech[0].start || 0) : null;
  const inputDescription = [
    speech.length ? `spoken lecture${durationSec ? ` (${fmtTime(durationSec)})` : ''}` : null,
    material.length ? `teaching material (${material.length} blocks${material.some(b => b.slide) ? ', slides' : ''})` : null
  ].filter(Boolean).join(' + ');
  const ctx = `${title ? `"${title}". ` : ''}Input: ${inputDescription}, ${totalWords} words.`;

  // 4a. Windows in parallel
  const sem = semanticIntended ? await prepareSemanticLinkage(speech, material).catch(() => null) : null;
  const windows = buildWindows(speech, material, sem);
  const linkage = sem
    ? { method: 'hybrid (word overlap + gemini-embedding-001)', threshold: Number(sem.threshold.toFixed(3)), ...sem.stats }
    : { method: speech.length && material.length ? 'word overlap' : 'none (single source)' };
  if (sem) console.log(`[LectureModel] Speech–slide linkage: hybrid; ${sem.stats.semanticOnly} slide block(s) linked by meaning only, ${sem.stats.movedBySemantic} moved to a better-matching part of the speech.`);
  const usage = { calls: 0, providers: new Set() };
  const results = new Array(windows.length);
  let idx = 0;
  const failedWindows = [];
  const workers = Array.from({ length: Math.min(MAX_PARALLEL_WINDOWS, windows.length) }, async () => {
    while (idx < windows.length) {
      const i = idx++;
      try {
        const r = await callJson({ systemPrompt: WINDOW_SYSTEM, prompt: windowPrompt(windows[i], ctx), maxTokens: 16000, operation: 'LECTURE_MODEL_WINDOW' });
        usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);
        results[i] = r.data;
      } catch (e) {
        // One unreadable window must not discard the rest of the lecture; it is reported instead.
        console.warn(`[LectureModel] Window ${i + 1}/${windows.length} could not be analysed: ${e.message.slice(0, 200)}`);
        results[i] = null;
        failedWindows.push(i);
      }
    }
  });
  await Promise.all(workers);
  const stageMs = { windows: Date.now() - t0 };
  const stamp = (name, since) => { stageMs[name] = Date.now() - since; };
  if (failedWindows.length === windows.length) {
    throw new Error('The analysis service is busy right now; none of the lecture could be read. Please retry in a minute.');
  }
  const unreadParts = failedWindows.map(i => {
    const w = windows[i];
    const sp = w.speech;
    if (sp.length) return `${fmtTime(sp[0].start)}–${fmtTime(sp[sp.length - 1].end)} of the recording`;
    const sl = w.material.map(b => b.slide).filter(Boolean);
    return sl.length ? `slides ${sl[0]}–${sl[sl.length - 1]}` : `material blocks ${w.material[0].id}–${w.material[w.material.length - 1].id}`;
  });

  // 4a'. Coverage pass: substantive blocks that no unit cites are re-read on their own, so the
  // completeness of the map does not depend on how thorough one model call happened to be.
  const citedIds = new Set();
  results.forEach(res => (res && res.units || []).forEach(u => (u.blocks || []).forEach(id => citedIds.add(id))));
  const failedBlockIds = new Set(failedWindows.flatMap(i => [...windows[i].speech, ...windows[i].material].map(b => b.id)));
  const uncovered = allBlocks.filter(b => !citedIds.has(b.id) && !failedBlockIds.has(b.id) && (wordCount(b.text) >= 45 || (b.kind && wordCount(b.text) >= 4)));
  const tCoverage = Date.now();
  if (uncovered.length >= 2 || (uncovered.length === 1 && allBlocks.length <= 3)) {
    const extraWindows = buildWindows(uncovered.filter(b => b.source === 'SPEECH'), uncovered.filter(b => b.source === 'MATERIAL'));
    const extra = await Promise.all(extraWindows.map(w =>
      callJson({ systemPrompt: WINDOW_SYSTEM, prompt: windowPrompt(w, ctx) + '\n\nThese blocks were not covered by an earlier pass. Extract every teachable point in them (return "segments": [] if they continue an earlier idea).', maxTokens: 8000, operation: 'LECTURE_MODEL_COVERAGE' })
        .then(r => { usage.calls++; usage.providers.add(`${r.provider}:${r.model}`); return r.data; })
        .catch(e => { console.warn(`[LectureModel] Coverage pass failed: ${e.message}`); return null; })
    ));
    extra.forEach((data, i) => {
      if (!data) return;
      // Segments for these blocks already exist from the main pass; keep only units/observations.
      windows.push(extraWindows[i]);
      results.push({ ...data, segments: [] });
    });
    console.log(`[LectureModel] Coverage pass re-read ${uncovered.length} uncited block(s).`);
  }
  stamp('coverage', tCoverage);
  const tExpand = Date.now();

  // 4a''. Expansion pass for small/medium inputs whose map is too coarse for their size
  // (weaker fallback models tend to lump a whole program or session into 2-3 points).
  const rawUnitCount = results.reduce((n, res) => n + ((res && res.units) || []).length, 0);
  // Expected density: ~1 teaching point per 3 meaningful code/SQL/command lines, ~1 per 180 words of prose.
  const CODEISH_LINE = /[;{}=]|\)\s*$|^\s*(?:\$|#|>|SELECT|FROM|WHERE|UPDATE|DELETE|INSERT|GROUP BY|ORDER BY|HAVING|JOIN|LEFT JOIN|CREATE|ALTER|try|catch|if|for|while|return|class|def|public|private)\b/i;
  const expectedUnits = Math.min(60, Math.round(allBlocks.reduce((n, b) => {
    const lines = b.text.split('\n').filter(l => l.trim().length > 2 && !/^\s*[{}()]+\s*;?\s*$/.test(l));
    const codeLines = lines.filter(l => CODEISH_LINE.test(l)).length;
    const proseWords = lines.filter(l => !CODEISH_LINE.test(l)).join(' ').split(/\s+/).filter(Boolean).length;
    return n + codeLines / 3 + proseWords / 180;
  }, 0)));
  const totalChars = allBlocks.reduce((n, b) => n + b.text.length, 0);
  if (totalChars <= 30000 && expectedUnits >= 4 && rawUnitCount < expectedUnits * 0.6) {
    try {
      const seen = results.flatMap(res => ((res && res.units) || []).map(u => `- ${u.subtopic}`)).join('\n');
      const whole = { speech: speech, material: material };
      const r = await callJson({
        systemPrompt: WINDOW_SYSTEM,
        prompt: windowPrompt(whole, ctx) + `\n\nAn earlier pass found only these teaching points:\n${seen || '(none)'}\nThis input supports about ${expectedUnits}. Return ONLY the additional distinct teaching points (units) that are missing — different commands, calls, lines, outputs, rules, edge cases or examples — in the same JSON format, with "segments": [] and "observations": [].`,
        maxTokens: 12000,
        operation: 'LECTURE_MODEL_EXPAND'
      });
      usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);
      windows.push(whole);
      results.push({ ...r.data, segments: [], observations: [] });
      console.log(`[LectureModel] Expansion pass added ${(r.data.units || []).length} candidate unit(s) (had ${rawUnitCount}, expected ~${expectedUnits}).`);
    } catch (e) {
      console.warn(`[LectureModel] Expansion pass skipped: ${e.message.slice(0, 150)}`);
    }
  }

  // 4b. Merge + verify
  const units = [];
  const observations = [];
  const contradictions = [];
  let rawSegments = [];
  let droppedUnits = 0;
  let droppedObs = 0;
  const knownTopics = [];

  const canonicalTopic = (name) => {
    const n = String(name || 'General').trim();
    const found = knownTopics.find(t => t.toLowerCase() === n.toLowerCase() || jaccard(t, n) >= 0.75);
    if (found) return found;
    knownTopics.push(n);
    return n;
  };

  results.forEach((res, wi) => {
    if (!res) return;
    const winIds = new Set([...windows[wi].speech, ...windows[wi].material].map(b => b.id));
    for (const s of (res.segments || [])) {
      if (winIds.has(s.from)) rawSegments.push({ ...s, to: winIds.has(s.to) ? s.to : s.from });
    }
    for (const u of (res.units || [])) {
      const cited = (u.blocks || []).filter(id => winIds.has(id));
      const src = cited.map(id => blockMap[id].text).join('\n');
      if (!cited.length || !quoteSupported(u.quote, src)) {
        // Try the whole window before dropping (the model sometimes cites the neighbouring block).
        const winText = [...winIds].map(id => blockMap[id].text).join('\n');
        if (!u.quote || !quoteSupported(u.quote, winText)) { droppedUnits++; continue; }
        const owner = [...winIds].find(id => quoteSupported(u.quote, blockMap[id].text));
        if (!owner) { droppedUnits++; continue; }
        cited.splice(0, cited.length, owner);
      }
      units.push({ ...u, blocks: cited, topic: canonicalTopic(u.topic) });
    }
    for (const o of (res.observations || [])) {
      const cited = (o.blocks || []).filter(id => winIds.has(id));
      const src = cited.map(id => blockMap[id].text).join('\n');
      if (!TEACHING_DIMENSIONS.some(d => d.key === o.dimension) || !cited.length || !quoteSupported(o.quote, src)) { droppedObs++; continue; }
      observations.push({ ...o, blocks: cited });
    }
    for (const c of (res.contradictions || [])) {
      const cited = (c.blocks || []).filter(id => winIds.has(id));
      if (cited.length && c.note) contradictions.push({ ...c, blocks: cited });
    }
  });

  // Dedupe near-identical units across windows
  let finalUnits = [];
  for (const u of units) {
    const dup = finalUnits.find(x => x.topic === u.topic && (jaccard(x.statement, u.statement) >= 0.7 || String(x.subtopic).toLowerCase() === String(u.subtopic).toLowerCase() && jaccard(x.statement, u.statement) >= 0.4));
    if (dup) {
      dup.blocks = Array.from(new Set([...dup.blocks, ...u.blocks]));
      dup.mentions = (dup.mentions || 1) + 1; // the same point taught again in another part of the lecture
      dup.angles = [...(dup.angles || []), ...(u.angles || [])];
      dup.misconceptions = Array.from(new Set([...(dup.misconceptions || []), ...(u.misconceptions || [])]));
      continue;
    }
    finalUnits.push(u);
  }

  // Normalise units, decorate with source + times, sanitise angles
  finalUnits.forEach((u, i) => {
    u.id = `U${String(i + 1).padStart(2, '0')}`;
    u.kind = UNIT_KINDS.includes(String(u.kind).toUpperCase()) ? String(u.kind).toUpperCase() : 'DEFINITION';
    u.depth = ['MENTIONED', 'EXPLAINED', 'DEMONSTRATED'].includes(String(u.depth).toUpperCase()) ? String(u.depth).toUpperCase() : 'EXPLAINED';
    u.importance = String(u.importance || '').toUpperCase() === 'ASIDE' ? 'ASIDE' : 'CORE';
    const srcTypes = new Set(u.blocks.map(id => blockMap[id].source));
    u.source = srcTypes.has('SPEECH') && srcTypes.has('MATERIAL') ? 'BOTH' : (srcTypes.has('SPEECH') ? 'SPOKEN' : 'MATERIAL');
    // Code and terminal sessions are what the class ran or read (pasted from the class, or the code file shown): taught.
    u.classArtifact = u.source === 'MATERIAL' && u.blocks.length > 0 && u.blocks.every(id => ['CODE', 'TERMINAL'].includes(blockMap[id] && blockMap[id].kind));
    const timedBlocks = u.blocks.map(id => blockMap[id]).filter(b => b.start !== null && b.start !== undefined);
    u.start = timedBlocks.length ? Math.min(...timedBlocks.map(b => b.start)) : null;
    u.time = fmtTime(u.start);
    const slides = u.blocks.map(id => blockMap[id].slide).filter(Boolean);
    u.slides = Array.from(new Set(slides));
    u.hasCode = CODE_KINDS.has(u.kind) || spokenCodeHits(u.blocks.map(id => blockMap[id].text).join(' ')) >= 2 || /```|;\s*$|^\s*\$ /m.test(u.blocks.map(id => blockMap[id].text).join('\n')) && (u.angles || []).some(a => ['trace', 'output', 'debug'].includes(a.type));
    u.hasFormula = u.kind === 'CALCULATION' || (u.angles || []).some(a => a.type === 'calculation');
    u.angles = sanitiseAngles(u);
    u.misconceptions = (u.misconceptions || []).filter(m => typeof m === 'string' && m.trim().length > 5).slice(0, 4);
    u.teacherExample = typeof u.teacherExample === 'string' && u.teacherExample.trim().length > 8 && !/^null$/i.test(u.teacherExample.trim()) ? u.teacherExample.trim().slice(0, 300) : null;
  });

  // Duplicate teaching points and variant topic names are consolidated in one small call; ids renumbered.
  stamp('expand', tExpand);
  const tConsolidate = Date.now();
  finalUnits = await consolidateUnits(finalUnits, usage);
  stamp('consolidate', tConsolidate);
  finalUnits.forEach((u, i) => {
    u.id = `U${String(i + 1).padStart(2, '0')}`;
    const timedBlocks = u.blocks.map(id => blockMap[id]).filter(b => b.start !== null && b.start !== undefined);
    u.start = timedBlocks.length ? Math.min(...timedBlocks.map(b => b.start)) : null;
    u.time = fmtTime(u.start);
  });

  // Cross-unit angle dedupe: same type + near-identical focus counts once
  const seenFocus = [];
  for (const u of finalUnits) {
    u.angles = u.angles.filter(a => {
      // System-added angles share one template sentence (only the subtopic differs), so text similarity
      // says nothing about them; they are unique per unit by construction.
      if (a.inferred) return true;
      const dup = seenFocus.find(f => f.type === a.type && jaccard(f.focus, a.focus) >= 0.7);
      if (dup) return false;
      seenFocus.push(a);
      return true;
    });
  }

  // Observations ids
  observations.forEach((o, i) => {
    o.id = `O${String(i + 1).padStart(2, '0')}`;
    const b = blockMap[o.blocks[0]];
    o.where = b.source === 'SPEECH' ? `at ${fmtTime(b.start)}` : (b.slide ? `slide ${b.slide}` : `material block ${b.id}`);
    o.time = b.source === 'SPEECH' ? fmtTime(b.start) : null;
  });

  // 4b'. Lecture-wide calibration: intent, what Easy/Medium/Hard mean for this class, each point's role and the
  // difficulty of every angle judged against the whole lecture (one call; window labels stand if it fails).
  const tCalibrate = Date.now();
  const calibration = await calibrateLecture({ units: finalUnits, blocks: allBlocks, title, inputDescription }, usage);
  stamp('calibrate', tCalibrate);
  if (calibration.teachable === false) finalUnits = [];
  await attachUnitVectors({ units: finalUnits }).catch(() => false); // same idea, different words -> one point when planning

  // 4c. Segments with real timestamps
  const segmentsOut = buildSegments(rawSegments, speech, material, blockMap, finalUnits);

  // 4d. Topics
  const topics = buildTopics(finalUnits, blockMap, timed);

  // 4e. Capacity
  const capacity = computeCapacity(finalUnits);

  // 4f + 4g. Title/level/summary and the teaching review run in parallel over the same verified map.
  const lectureForReview = {
    title: title || (topics[0] && topics[0].name) || 'Lecture',
    inputDescription,
    segments: segmentsOut,
    units: finalUnits,
    observations,
    blocks: allBlocks
  };
  // The teaching review can finish in the background (opts.deferTeachingScore): the teacher sees the overview
  // as soon as it is ready and the score a few seconds later (GET /api/quiz/teaching-score/:id).
  // Teaching report v2 is computed from the finished, calibrated reading (controller ensureTeachingV2); the v1 rubric
  // grader (failed validity, 22 Nov) runs only with TEACHING_SCORE_VERSION=v1.
  const teachingPromise = process.env.TEACHING_SCORE_VERSION !== 'v1'
    ? Promise.resolve({ available: false, pending: true, reason: 'The teaching review is being prepared.' })
    : scoreTeaching(lectureForReview, {
    totalWords, usage, hasSpeech: speech.length > 0,
    rawArtifactOnly: speech.length === 0 && material.length > 0 && material.filter(b => b.kind).length / material.length >= 0.6
  }).catch(e => ({ available: false, reason: `The teaching review could not be completed: ${e.message}` }));
  const tDescribe = Date.now();
  const meta = await describeLecture({ title, segments: segmentsOut, units: finalUnits, inputDescription, usage });
  stamp('describe', tDescribe);
  console.log(`[LectureModel] Read in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${Object.entries(stageMs).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`).join(', ')} (${windows.length} windows)`);
  const teaching = opts.deferTeachingScore ? { available: false, pending: true, reason: 'The teaching review is still being prepared.' } : await teachingPromise;

  const lecture = {
    title: meta.title || title || (topics[0] && topics[0].name) || 'Lecture',
    level: (calibration.status === 'ok' && calibration.level) || teaching.level || meta.level || 'INTERMEDIATE',
    intent: (calibration.status === 'ok' && calibration.intent) || teaching.intent || meta.intent || '',
    summary: meta.summary || ''
  };

  const model = {
    ok: true,
    version: MODEL_VERSION,
    id: key,
    title: lecture.title,
    level: lecture.level,
    intent: lecture.intent,
    summary: lecture.summary,
    inputDescription,
    hasTiming: timed,
    durationSec,
    durationLabel: durationSec ? fmtTime(durationSec) : null,
    wordCount: totalWords,
    segments: segmentsOut,
    topics,
    units: finalUnits,
    observations,
    contradictions,
    capacity,
    calibration,
    teaching,
    teachingStyle: null,
    incomplete: unreadParts.length ? { unreadParts, message: `Part of the input could not be read because the analysis service was busy (${unreadParts.join('; ')}). Retry to include it.` } : null,
    blocks: allBlocks.map(b => ({ id: b.id, source: b.source, start: b.start, end: b.end, slide: b.slide || null, kind: b.kind || null, label: b.label || null, text: b.text })),
    audit: {
      windows: windows.length,
      linkage,
      llmCalls: usage.calls,
      providers: Array.from(usage.providers),
      droppedUnverifiedUnits: droppedUnits,
      droppedUnverifiedObservations: droppedObs,
      buildMs: Date.now() - t0,
      stageMs,
      builtAt: new Date().toISOString()
    }
  };
  // How the lecture was taught (per part and overall) and how closely it followed the slides: no extra AI call.
  try { model.teachingStyle = teachingStyle.buildProfile(model); } catch (e) { console.warn('[LectureModel] teaching style skipped:', e.message); }
  // Incomplete models are kept in memory for generation but not persisted, so a retry re-reads them.
  const persist = () => { if (unreadParts.length) memoryCache.set(key, model); else writeCache(key, model); };
  persist();
  if (opts.deferTeachingScore) {
    teachingPromise.then(t => {
      model.teaching = t;
      if (t && t.level) model.level = t.level;
      if (t && t.intent) model.intent = t.intent;
      model.audit.teachingMs = Date.now() - t0;
      persist();
    });
  }
  return model;
}

/**
 * Topic-only input: no lecture exists, so the system writes concise reference notes on the topic
 * (clearly labelled as general knowledge) and builds the same model from them. Questions are then
 * grounded in those notes instead of free-form generation; no teaching score is produced.
 */
async function buildTopicModel({ topic, forceRefresh = false }) {
  const key = hashInput(['TOPIC_NOTES_V2', String(topic || '').trim().toLowerCase()]); // v2: non-topics refused
  if (!forceRefresh) {
    const hit = readCache(key);
    if (hit) return { ...hit, cached: true };
  }
  const r = await callJson({
    systemPrompt: 'You are a university lecturer writing concise, technically correct teaching notes. Return JSON only.',
    prompt: `Write teaching notes for one university class on: "${topic}".
Cover the standard core of this topic at undergraduate level, in teaching order: key definitions, how the main mechanisms/algorithms work and why, one or two short worked examples (with concrete values, code or commands where the subject uses them), important comparisons, and common edge cases or mistakes.
Use only well-established textbook facts. 1500-2200 words, plain paragraphs under short headings; code or commands on their own lines.
First decide whether "${topic}" names an academic subject or topic that a university class could teach (e.g. "Arrays in Python", "SQL joins", "photosynthesis"). Greetings, classroom instructions, chit-chat, requests or opinions are NOT topics.
If it is not a topic, return {"isTopic": false, "reason": "one short sentence"} and nothing else.
Otherwise return {"isTopic": true, "title":"short title","notes":"the notes text, with headings on their own lines"}`,
    maxTokens: 6000,
    operation: 'TOPIC_NOTES'
  });
  // Not a subject (a greeting, an instruction, chit-chat): nothing to write notes about, so nothing to ask.
  if (r.data && r.data.isTopic === false) {
    return { ok: false, reason: 'NOT_A_TOPIC', message: `This does not name a subject to teach${r.data.reason ? ` (${String(r.data.reason).slice(0, 160)})` : ''}.` };
  }
  const notes = String(r.data.notes || '').trim();
  if (notes.length < 300) throw new Error('Topic notes could not be written for this topic.');
  const model = await buildLectureModel({ text: notes, title: r.data.title || topic, forceRefresh });
  if (!model.ok) return model;
  const topicModel = {
    ...model,
    id: key,
    isTopicNotes: true,
    notesText: notes,
    inputDescription: 'topic only — reference notes written by the system (general knowledge, not your lecture)',
    teaching: { available: false, reason: 'Only a topic name was given, so there is no teaching to score. Add a recording, slides or notes from your class to get a teaching score and questions grounded in what you taught.' }
  };
  writeCache(key, topicModel);
  return topicModel;
}

function sanitiseAngles(u) {
  // Passing remarks (a platform mentioned, admin or career talk, anecdotes) are kept on the lecture map
  // but never assessed.
  if (u.importance === 'ASIDE') return [];
  const out = [];
  const seenTypes = new Set();
  const isCodeish = CODE_KINDS.has(u.kind) || u.hasCode;
  for (const a of (u.angles || [])) {
    const type = String(a.type || '').toLowerCase();
    let diff = String(a.difficulty || '').toLowerCase();
    if (!ANGLE_TYPES.includes(type) || !['easy', 'medium', 'hard'].includes(diff)) continue;
    if (['trace', 'output', 'debug'].includes(type) && !isCodeish) continue;
    if (type === 'calculation' && !(u.kind === 'CALCULATION' || u.hasFormula)) continue;
    if (u.depth === 'MENTIONED' && (diff !== 'easy' || out.length >= 1)) continue;
    if (diff === 'hard' && u.depth === 'MENTIONED') continue;
    // Pure recall can never be Hard; tracing/predicting output is at least Medium.
    // Hard only where the work is genuinely multi-step: tracing, calculating, predicting output, debugging,
    // edge cases, or applying ideas together in a scenario. Recall/concept/mechanism/comparison are at most Medium.
    if (diff === 'hard' && ['recall', 'concept', 'mechanism', 'comparison'].includes(type)) diff = 'medium';
    // Multi-step work (tracing, calculating) is at least Medium; a one-step code question (what one line
    // prints or does, one obvious mistake) can be Easy, so code questions exist at every difficulty.
    if (['trace', 'calculation'].includes(type) && diff === 'easy') diff = 'medium';
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    out.push({ type, difficulty: diff, focus: String(a.focus || '').trim() || `${type} of ${u.subtopic}` });
    if (out.length >= 4) break;
  }
  if (out.length === 0) out.push({ type: 'recall', difficulty: 'easy', focus: `What ${u.subtopic} is, as taught` });
  // A unit that was explained or demonstrated always supports one recall-level check and one
  // applied check; add the missing one so capacity does not depend on how terse a model was.
  if (u.depth !== 'MENTIONED' && out.length === 1) {
    const only = out[0];
    if (only.difficulty !== 'easy' && !out.some(a => a.type === 'recall')) {
      out.push({ type: 'recall', difficulty: 'easy', focus: `What ${u.subtopic} does or means, as taught`, inferred: true });
    } else if (only.difficulty === 'easy') {
      const applied = isCodeish ? 'output' : (u.kind === 'COMPARISON' ? 'comparison' : 'application');
      out.push({ type: applied, difficulty: 'medium', focus: `Apply ${u.subtopic} to a short concrete case like the one taught`, inferred: true });
    }
  }
  // Hard opportunity (lecture-relative): anything the teacher actually explained or demonstrated beyond a
  // definition supports one multi-step question — a trace for code/algorithms, a multi-step calculation for
  // formulas, and for explained mechanisms/comparisons/applications a what-if or diagnosis scenario that needs
  // reasoning through the mechanism. Plain definitions get none, so introductory lectures stay low on Hard.
  if (u.depth !== 'MENTIONED' && u.kind !== 'DEFINITION' && !out.some(a => a.difficulty === 'hard') && out.length < 4) {
    const hardType = isCodeish ? 'trace'
      : ((u.kind === 'CALCULATION' || u.hasFormula) ? 'calculation'
        : (u.kind === 'EDGE_CASE' ? 'edge_case'
          : (['MECHANISM', 'COMPARISON', 'APPLICATION', 'EXAMPLE'].includes(u.kind) ? 'scenario' : null)));
    if (hardType && !out.some(a => a.type === hardType)) {
      const focus = hardType === 'scenario'
        ? `What-if / diagnosis: reason through how ${u.subtopic} behaves in a new concrete situation (e.g. a changed condition or a failure) using what was taught`
        : (hardType === 'trace' ? `Trace ${u.subtopic} over several steps on a concrete input`
          : (hardType === 'calculation' ? `Multi-step calculation with ${u.subtopic} ending in a decision`
            : `Boundary case of ${u.subtopic} that needs two taught rules together`));
      out.push({ type: hardType, difficulty: 'hard', focus, inferred: true });
    }
  }
  // Easy code opportunity: taught code (pasted, shown or dictated) also supports a one-step question at Easy.
  if (isCodeish && u.depth !== 'MENTIONED' && out.length < 4 && !out.some(a => a.difficulty === 'easy' && ['output', 'debug'].includes(a.type))) {
    const easyType = !out.some(a => a.type === 'output') ? 'output' : (!out.some(a => a.type === 'debug') ? 'debug' : null);
    if (easyType) out.push({ type: easyType, difficulty: 'easy', focus: easyType === 'output'
      ? `One step: what a single taught line or statement of ${u.subtopic} prints, returns or does (no loop tracing)`
      : `One obvious mistake in a 1-3 line fragment of ${u.subtopic} as taught`, inferred: true });
  }
  return out;
}

function buildSegments(rawSegments, speech, material, blockMap, units) {
  const order = (id) => {
    const list = id && id.startsWith('B') ? speech : material;
    const i = list.findIndex(b => b.id === id);
    return (id && id.startsWith('B') ? 0 : 100000) + (i < 0 ? 99999 : i);
  };
  const segs = rawSegments
    .filter(s => blockMap[s.from])
    .map(s => ({ ...s, _o: order(s.from), _e: Math.max(order(s.from), order(s.to)) }))
    .sort((a, b) => a._o - b._o);

  // Remove overlaps and merge neighbours with the same title (window boundaries)
  const merged = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (prev && s._o <= prev._e) {
      if (s._e > prev._e) { prev._e = s._e; prev.to = s.to; }
      continue;
    }
    if (prev && String(prev.title).toLowerCase() === String(s.title).toLowerCase()) {
      prev._e = s._e; prev.to = s.to; continue;
    }
    merged.push({ ...s });
  }
  // Fill uncovered speech blocks into the preceding segment so the outline spans the whole lecture.
  const out = merged.map((s, i) => {
    const from = blockMap[s.from];
    const to = blockMap[s.to] || from;
    const next = merged[i + 1];
    let end = to.end;
    if (from.source === 'SPEECH' && next && blockMap[next.from] && blockMap[next.from].source === 'SPEECH') {
      end = blockMap[next.from].start;
    } else if (from.source === 'SPEECH' && !next && speech.length) {
      end = speech[speech.length - 1].end;
    }
    const segUnits = units.filter(u => u.blocks.some(id => order(id) >= s._o && order(id) <= s._e));
    const slides = Array.from(new Set(segUnits.flatMap(u => u.slides || []).concat(from.slide ? [from.slide] : []))).sort((a, b) => a - b);
    return {
      title: String(s.title || '').trim() || 'Section',
      description: String(s.description || '').trim(),
      delivery: teachingStyle.normMode(s.delivery),
      source: from.source,
      start: from.source === 'SPEECH' ? from.start : null,
      end: from.source === 'SPEECH' ? end : null,
      time: from.source === 'SPEECH' ? `${fmtTime(from.start)}–${fmtTime(end)}` : null,
      slides,
      unitIds: segUnits.map(u => u.id),
      topics: Array.from(new Set(segUnits.map(u => u.topic)))
    };
  });
  if (out.length && out[0].source === 'SPEECH' && speech.length && out[0].start > speech[0].start) {
    out[0].start = speech[0].start;
    out[0].time = `${fmtTime(out[0].start)}–${fmtTime(out[0].end)}`;
  }
  return out;
}

function buildTopics(units, blockMap, timed) {
  const byTopic = new Map();
  for (const u of units) {
    if (!byTopic.has(u.topic)) byTopic.set(u.topic, { name: u.topic, units: [], seconds: 0, blocks: new Set(), sources: new Set() });
    const t = byTopic.get(u.topic);
    t.units.push(u);
    u.blocks.forEach(id => t.blocks.add(id));
    t.sources.add(u.source);
  }
  const topics = [];
  for (const t of byTopic.values()) {
    let seconds = 0;
    for (const id of t.blocks) {
      const b = blockMap[id];
      if (b.start !== null && b.end !== null && b.start !== undefined) seconds += Math.max(0, b.end - b.start);
    }
    const words = [...t.blocks].reduce((n, id) => n + wordCount(blockMap[id].text), 0);
    const cap = computeCapacity(t.units);
    const src = t.sources.has('BOTH') || (t.sources.has('SPOKEN') && t.sources.has('MATERIAL')) ? 'BOTH' : [...t.sources][0];
    topics.push({
      name: t.name,
      subtopics: Array.from(new Set(t.units.map(u => u.subtopic))),
      unitIds: t.units.map(u => u.id),
      seconds: timed ? Math.round(seconds) : null,
      words,
      source: src,
      firstTime: t.units.map(u => u.start).filter(s => s !== null).sort((a, b) => a - b).map(fmtTime)[0] || null,
      depth: t.units.some(u => u.depth === 'DEMONSTRATED') ? 'DEMONSTRATED' : (t.units.some(u => u.depth === 'EXPLAINED') ? 'EXPLAINED' : 'MENTIONED'),
      capacity: cap.byDifficulty
    });
  }
  const totalW = topics.reduce((n, t) => n + (timed ? (t.seconds || 0) : t.words), 0) || 1;
  topics.forEach(t => { t.share = Math.round(100 * (timed ? (t.seconds || 0) : t.words) / totalW); });
  return topics;
}

/**
 * One small call over the whole unit list:
 *  - merges duplicate teaching points (e.g. a command explained, then demonstrated later),
 *  - groups over-split / variant topic names from separate windows into clean macro-topics.
 * Returns the (possibly shorter) unit list; unit.topic is rewritten in place.
 */
async function consolidateUnits(units, usage, deps = {}) {
  const ask = deps.callJson || callJson;
  if (units.length < 4) return units;
  const names = [];
  for (const u of units) if (!names.includes(u.topic)) names.push(u.topic);
  const unitList = units.map(u => `${u.id} [${u.topic}] ${u.subtopic}: ${String(u.statement || '').slice(0, 140)}`).join('\n');
  const target = Math.max(2, Math.min(10, Math.round(Math.sqrt(units.length) + 1)));
  try {
    const r = await ask({
      systemPrompt: 'You organise the teaching points of one lecture. Return JSON only.',
      prompt: `Teaching points extracted from one lecture, in teaching order (id [topic] subtopic: statement):\n${unitList}\n\nTasks:\n1. duplicates: list groups of ids that teach the SAME point (for example the same command or rule explained once and demonstrated later, or the same definition given twice). Do not group points that are merely related.\n2. topics: group the topic names ${names.map(n => `"${n}"`).join(', ')} into about ${target} macro-topics a teacher would recognise (merge spelling variants, singular/plural and parts of the same algorithm or mechanism; keep genuinely different topics apart; keep teaching order). Every topic name must appear in exactly one group.\nReturn {"duplicates":[["U01","U09"]],"topics":[{"name":"short macro-topic name","members":["exact topic names"]}]}`,
      maxTokens: 4096,
      operation: 'LECTURE_MODEL_CONSOLIDATE'
    });
    usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);

    // Topics
    const map = new Map();
    for (const g of (r.data.topics || r.data.groups || [])) {
      const gname = String(g.name || '').trim();
      if (!gname) continue;
      for (const m of (g.members || [])) {
        const key = String(m || '').split(':')[0].replace(/^[-•"\s]+|["\s]+$/g, '').trim().toLowerCase();
        const orig = names.find(n => n.toLowerCase() === key);
        if (orig && !map.has(orig)) map.set(orig, gname);
      }
    }
    for (const u of units) if (map.has(u.topic)) u.topic = map.get(u.topic);

    // Duplicates: merge into the first unit of each group
    const byId = new Map(units.map(u => [u.id, u]));
    const removed = new Set();
    const depthRank = { MENTIONED: 0, EXPLAINED: 1, DEMONSTRATED: 2 };
    for (const grp of (r.data.duplicates || [])) {
      const members = (Array.isArray(grp) ? grp : []).map(id => byId.get(String(id).trim())).filter(u => u && !removed.has(u.id));
      if (members.length < 2) continue;
      const keep = members[0];
      for (const other of members.slice(1)) {
        keep.mentions = (keep.mentions || 1) + (other.mentions || 1); // a revisit, not a new point
        keep.blocks = Array.from(new Set([...keep.blocks, ...other.blocks]));
        if (depthRank[other.depth] > depthRank[keep.depth]) keep.depth = other.depth;
        const types = new Set(keep.angles.map(a => a.type));
        for (const a of other.angles) if (!types.has(a.type) && keep.angles.length < 4) { keep.angles.push(a); types.add(a.type); }
        keep.misconceptions = Array.from(new Set([...(keep.misconceptions || []), ...(other.misconceptions || [])])).slice(0, 4);
        keep.hasCode = keep.hasCode || other.hasCode;
        keep.hasFormula = keep.hasFormula || other.hasFormula;
        if (keep.source !== other.source) keep.source = 'BOTH';
        keep.slides = Array.from(new Set([...(keep.slides || []), ...(other.slides || [])]));
        removed.add(other.id);
      }
    }
    if (removed.size) console.log(`[LectureModel] Merged ${removed.size} duplicate teaching point(s).`);
    return units.filter(u => !removed.has(u.id));
  } catch (e) {
    console.warn(`[LectureModel] Unit consolidation skipped: ${e.message.slice(0, 150)}`);
    return units;
  }
}

/** Seconds of speech a teaching point spans (sum of its cited speech blocks). 0 for material-only points. */
function unitSeconds(blocks, u) {
  const byId = new Map((blocks || []).map(b => [b.id, b]));
  return (u.blocks || []).map(id => byId.get(id)).filter(b => b && b.source === 'SPEECH' && isFinite(b.start) && isFinite(b.end))
    .reduce((s, b) => s + Math.max(0, b.end - b.start), 0);
}

/**
 * Importance of a teaching point TO THIS LECTURE, used to decide what to keep when fewer questions are asked than
 * the lecture supports, which reserves come first, and what is dropped last. Deterministic, from what the lecture
 * reader measured:
 *   role in the lecture's intent (core 3 / supporting 2 / peripheral 0.5; from the calibration step)
 *   + depth (demonstrated 1.5 / explained 1 / mentioned 0)
 *   + emphasis (the teacher stressed it: +1)
 *   + revisits (taught again later in the lecture: +0.5 per return, up to +1)
 *   + teaching time (+1 for two minutes or more, proportionally less).
 */
function unitImportance(u) {
  const role = { CORE: 3, SUPPORTING: 2, PERIPHERAL: 0.5 }[u.role] ?? 2;
  const depth = { DEMONSTRATED: 1.5, EXPLAINED: 1, MENTIONED: 0 }[u.depth] ?? 1;
  const revisits = Math.min(1, 0.5 * (Math.max(1, u.mentions || 1) - 1));
  const time = Math.min(1, (u.seconds || 0) / 120);
  return Number((role + depth + (u.stressed ? 1 : 0) + revisits + time).toFixed(2));
}

// Version 2 (27 Nov 2026): angles are judged blind (version 1 showed the window labels and copied them back).
const CALIBRATION_VERSION = 3; // 3: teachable excludes logistics, grading, motivational talk and banter
const CALIBRATE_SYSTEM = 'You calibrate the quiz plan of ONE lecture, the way an experienced teacher would before writing a quiz for the class that attended it. Return JSON only.';

function calibratePrompt(model) {
  const units = model.units.filter(u => (u.angles || []).length > 0).map(u => {
    const facts = [`kind=${u.kind}`, `depth=${u.depth}`, `source=${u.source}`, u.seconds ? `time=${Math.round(u.seconds)}s` : null,
      (u.mentions || 1) > 1 ? `taught ${u.mentions} times` : null, u.stressed ? 'stressed' : null, u.teacherExample ? 'with example' : null].filter(Boolean).join(' ');
    // The window's difficulty label is NOT shown: shown, it was copied back unchanged (measured: 156 of 156 angles).
    const angles = u.angles.map((a, i) => `   a${i} ${a.type}: ${a.focus}`).join('\n');
    return `${u.id} [${u.topic} > ${u.subtopic}] ${facts}\n   ${String(u.statement || '').slice(0, 220)}\n${angles}`;
  }).join('\n');
  return `LECTURE: ${model.title || ''}
Input: ${model.inputDescription || ''}

TEACHING POINTS (in teaching order) with the question angles proposed while reading parts of the lecture (no difficulty yet):
${units}

Look at the WHOLE lecture (its level, how deep each point went, what was worked through) and calibrate:
1. intent: one sentence, what the teacher wanted students to be able to do after this class (e.g. "explain what recursion is and how it differs from loops, using real-world examples; no coding").
2. level: INTRODUCTORY | INTERMEDIATE | ADVANCED (for this class, judged from what was taught).
3. difficulty: what Easy, Medium and Hard mean FOR THIS LECTURE, one short sentence each, anchored to what students heard:
   Easy = remember or explain an idea the teacher explained (one step);
   Medium = apply, trace or compare what was taught on a given case;
   Hard = several dependent reasoning steps on a new case, using only what was taught (an edge case, a what-if, a diagnosis, combining two taught ideas).
   A question that is easy in general can be Hard for this class if the class only just met the idea, and the reverse.
4. units: for every point, its role in the intent (CORE = what the lecture is about; SUPPORTING = helps understand a core point; PERIPHERAL = side detail), and for every angle the difficulty a question on it would have for THIS class (decide it yourself from the rubric in 3 and what this class was taught), and keep=false only if the angle does not fit what the teacher intended (e.g. a code-output angle in a class that taught the idea without any code).
5. capacityNote: two sentences: why this lecture supports many or few Easy, Medium and Hard questions (its depth, examples, worked cases).
6. teachable: false ONLY if the input teaches no subject matter at all (only greetings, attendance, seating, phones, course logistics, grading or exam announcements, motivational talk, jokes, banter or chit-chat, even if an everyday analogy is used along the way); true otherwise, even for a short or simple lesson.

Return: {"teachable":true,"intent":"...","level":"...","difficulty":{"easy":"...","medium":"...","hard":"..."},"units":[{"id":"U01","role":"CORE","angles":[{"i":0,"difficulty":"easy","keep":true}]}],"capacityNote":"..."}`;
}

/**
 * Lecture-wide calibration (one model call, after the whole lecture is read): the teacher's intent, what each
 * difficulty means for this class, each point's role, and the difficulty of every question angle judged against the
 * whole lecture rather than one window. Rules the model cannot override: a point that was only mentioned gets Easy
 * angles only; every point keeps at least one angle; unknown ids or values are ignored. If the call fails, the
 * window labels stand and calibration.status says so.
 */
async function calibrateLecture(model, usage = { calls: 0, providers: new Set() }, deps = {}) {
  const ask = deps.callJson || callJson;
  for (const u of model.units) u.seconds = unitSeconds(model.blocks, u);
  let data = null;
  try {
    // A long lecture is calibrated in parts (each part sees the whole lecture's outline), so every part fits one
    // request on any provider; the lecture-level answers (intent, level, meanings) come from the first part.
    const withAngles = model.units.filter(u => (u.angles || []).length);
    const parts = [];
    const PART = 28;
    for (let i = 0; i < withAngles.length; i += PART) parts.push(withAngles.slice(i, i + PART));
    if (!parts.length) parts.push([]);
    const outline = [...new Set(model.units.map(u => u.topic))].join('; ');
    for (const [pi, part] of parts.entries()) {
      const sub = { ...model, units: part };
      const prompt = calibratePrompt(sub) + (parts.length > 1 ? `

This is part ${pi + 1} of ${parts.length} of the lecture's points. The whole lecture covers: ${outline}.` : '');
      const r = await ask({ systemPrompt: CALIBRATE_SYSTEM, prompt, maxTokens: parts.length > 1 ? 4000 : 9000, operation: 'LECTURE_MODEL_CALIBRATE' });
      usage.calls++; if (usage.providers && usage.providers.add) usage.providers.add(`${r.provider}:${r.model}`);
      const d = r.data || null;
      if (!d || !Array.isArray(d.units)) throw new Error('no unit calibration returned');
      if (!data) data = { ...d, units: [] };
      if (d.teachable === true) data.teachable = true; // one part that teaches is enough
      data.units.push(...d.units);
    }
  } catch (e) {
    model.calibration = { status: 'unavailable', reason: String(e.message).slice(0, 160) };
    for (const u of model.units) u.importanceScore = unitImportance(u);
    return model.calibration;
  }
  const levels = ['easy', 'medium', 'hard'];
  let relabelled = 0, dropped = 0;
  const byId = new Map(model.units.map(u => [u.id, u]));
  for (const cu of data.units) {
    const u = byId.get(String(cu.id || '').trim());
    if (!u) continue;
    if (['CORE', 'SUPPORTING', 'PERIPHERAL'].includes(String(cu.role || '').toUpperCase())) u.role = String(cu.role).toUpperCase();
    const keep = [];
    let droppedHere = 0;
    (u.angles || []).forEach((a, i) => {
      const c = (Array.isArray(cu.angles) ? cu.angles : []).find(x => Number(x.i) === i);
      if (c && c.keep === false) { droppedHere++; return; }
      const d = c && levels.includes(String(c.difficulty).toLowerCase()) ? String(c.difficulty).toLowerCase() : a.difficulty;
      if (d !== a.difficulty) { relabelled++; a.windowDifficulty = a.difficulty; a.difficulty = d; }
      keep.push(a);
    });
    if (keep.length) { u.angles = keep; dropped += droppedHere; } // never leave a point without an angle
  }
  // Nothing taught (greetings, attendance, admin only): no teaching points, so no questions; the teacher is told why.
  if (data.teachable === false) {
    for (const u of model.units) { u.angles = []; u.importance = 'ASIDE'; }
    model.calibration = { status: 'ok', version: CALIBRATION_VERSION, teachable: false, intent: '', level: null, difficulty: {}, capacityNote: 'This input does not teach any subject matter.', relabelledAngles: 0, droppedAngles: 0 };
    return model.calibration;
  }
  // Guard: what was only mentioned cannot carry Medium or Hard questions.
  for (const u of model.units) {
    if (u.depth === 'MENTIONED') for (const a of (u.angles || [])) if (a.difficulty !== 'easy') { a.windowDifficulty = a.windowDifficulty || a.difficulty; a.difficulty = 'easy'; relabelled++; }
    u.importanceScore = unitImportance(u);
  }
  const str = (x, n = 300) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
  model.calibration = {
    status: 'ok',
    version: CALIBRATION_VERSION,
    teachable: true,
    intent: str(data.intent),
    level: ['INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED'].includes(String(data.level || '').toUpperCase()) ? String(data.level).toUpperCase() : null,
    difficulty: { easy: str(data.difficulty && data.difficulty.easy, 200), medium: str(data.difficulty && data.difficulty.medium, 200), hard: str(data.difficulty && data.difficulty.hard, 200) },
    capacityNote: str(data.capacityNote, 400),
    relabelledAngles: relabelled,
    droppedAngles: dropped
  };
  return model.calibration;
}

const UNIT_SAME_POINT = parseFloat(process.env.UNIT_SAME_POINT_THRESHOLD) || 0.92;

/**
 * Meaning vectors for teaching points (statement + subtopic), so planning never puts two questions on the same idea
 * worded differently. One embedding request; skipped (word comparison only) when unavailable or too many points.
 */
async function attachUnitVectors(model) {
  const units = (model.units || []).filter(u => (u.angles || []).length);
  if (!units.length || units.length > semantic.MAX_TEXTS_PER_CALL || units.every(u => Array.isArray(u.vec))) return false;
  const v = await semantic.embedMany(units.map(u => `${u.subtopic}: ${u.statement}`), { label: 'teaching points' });
  if (!v) return false;
  units.forEach((u, i) => { if (v[i]) u.vec = Array.from(v[i], x => Number(x.toFixed(4))); });
  return true;
}

/** Calibrates a saved lecture model read before calibration existed (once; the result is saved with it). */
async function ensureCalibrated(model, deps = {}) {
  if (!model || !model.ok) return model;
  const needVectors = !deps.noVectors && (model.units || []).some(u => (u.angles || []).length && !Array.isArray(u.vec));
  if (model.calibration && model.calibration.status === 'ok' && model.calibration.version === CALIBRATION_VERSION) {
    if (needVectors && await attachUnitVectors(model).catch(() => false)) { try { if (!model.incomplete && !deps.noSave) writeCache(model.id, model); } catch (_) {} }
    return model;
  }
  if (needVectors) await attachUnitVectors(model).catch(() => false);
  await calibrateLecture(model, undefined, deps);
  model.capacity = computeCapacity(model.units);
  if (model.calibration.status === 'ok') {
    if (model.calibration.intent) model.intent = model.calibration.intent;
    try { if (!model.incomplete && !deps.noSave) writeCache(model.id, model); } catch (_) { /* the cache is an optimisation */ }
  }
  return model;
}

/**
 * Taught = what the class heard (speech, or speech + slides) or ran/read in class (code and terminal sessions).
 * Points found only in uploaded slides/documents are a supplement when there is a lecture.
 */
function isTaught(u, blocks) {
  if (u.source !== 'MATERIAL') return true;
  if (typeof u.classArtifact === 'boolean') return u.classArtifact;
  const byId = blocks ? new Map(blocks.map(b => [b.id, b])) : null;
  // Readings saved before block kinds were stored: classify the block text itself.
  const kindOf = (b) => b.kind || ({ code: 'CODE', terminal: 'TERMINAL' })[classifyTextBlock(b.text)] || null;
  return Boolean(byId && (u.blocks || []).length && u.blocks.every(id => byId.get(id) && ['CODE', 'TERMINAL'].includes(kindOf(byId.get(id)))));
}

function computeCapacity(units) {
  // Capacity = every question angle the lecture supports, per difficulty (an upper bound).
  const by = { easy: 0, medium: 0, hard: 0 };
  for (const u of units) for (const a of (u.angles || [])) by[a.difficulty]++;
  const total = by.easy + by.medium + by.hard;
  // Recommended = what we are comfortable writing at high quality: one question per distinct teaching point per
  // difficulty (two questions on one point are near-duplicates), counting only what the teacher taught when there is
  // speech (points found only in uploaded material are a supplement, reported separately), and leaving out
  // peripheral points for the Balanced mix.
  const hasSpeech = units.some(u => u.source === 'SPOKEN' || u.source === 'BOTH');
  const taught = hasSpeech ? units.filter(u => isTaught(u)) : units;
  const points = (list, d) => list.filter(u => (u.angles || []).some(a => a.difficulty === d)).length;
  const supplementary = hasSpeech ? units.filter(u => !isTaught(u)) : [];
  return {
    byDifficulty: by,
    total,
    recommended: {
      easy: Math.min(MAX_QUIZ_QUESTIONS, points(taught, 'easy')),
      medium: Math.min(MAX_QUIZ_QUESTIONS, points(taught, 'medium')),
      hard: Math.min(MAX_QUIZ_QUESTIONS, points(taught, 'hard')),
      balanced: Math.min(MAX_QUIZ_QUESTIONS, taught.filter(u => (u.angles || []).length > 0 && u.role !== 'PERIPHERAL').length)
    },
    supplementary: { easy: points(supplementary, 'easy'), medium: points(supplementary, 'medium'), hard: points(supplementary, 'hard') },
    unitCount: units.length
  };
}

async function describeLecture({ title, segments, units, inputDescription, usage }) {
  const outline = segments.map(s => `${s.time ? s.time + ' ' : ''}${s.title}: ${s.description}`).join('\n');
  const unitList = units.slice(0, 80).map(u => `${u.topic} / ${u.subtopic} [${u.kind}, ${u.depth}]`).join('\n');
  try {
    const r = await callJson({
      systemPrompt: 'You summarise a lecture from its verified outline. Return JSON only. Use plain, direct language a teacher would use.',
      prompt: `Uploaded name: ${title || '(none)'}\nInput: ${inputDescription}\n\nOUTLINE:\n${outline}\n\nUNITS:\n${unitList}\n\nReturn {"title":"3-7 word academic title (ignore file names like Y2Mate, rec_01)","level":"INTRODUCTORY|INTERMEDIATE|ADVANCED","intent":"one sentence: what this lecture set out to teach","summary":"2-3 sentences: what was actually taught, in order, mentioning examples/code/calculations if present"}`,
      maxTokens: 1024,
      operation: 'LECTURE_MODEL_SUMMARY'
    });
    usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);
    const lvl = String(r.data.level || '').toUpperCase();
    return { ...r.data, level: ['INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED'].includes(lvl) ? lvl : 'INTERMEDIATE' };
  } catch (_) {
    return { title, level: 'INTERMEDIATE', intent: '', summary: segments.map(s => s.description).slice(0, 3).join(' ') };
  }
}

/**
 * Checks each gap observation against what happened around it in class (the cited block, the one before and the
 * next three). Keeps only real gaps/errors by the teacher. One small-model call per lecture; on failure every
 * observation is kept (the review's own rules still apply).
 */
/** "1:06:06", "106:06" or "66:06" → seconds; null if not a time. */
function parseClock(t) {
  const p = String(t).trim().split(':').map(Number);
  if (!p.length || p.some(x => !Number.isFinite(x))) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p.length === 2 ? p[0] * 60 + p[1] : null);
}
/** The verdict points at the shown context: a slide/block label in it, or a time inside its span. */
function pointsIntoContext(at, ctx, range) {
  if (ctx.includes(`[${at}]`)) return true;
  if (!Array.isArray(range)) return false;
  const inside = (t) => t !== null && t >= range[0] - 5 && t <= range[1] + 5;
  const sec = parseClock(at);
  // Models sometimes write 1:06:06 as "106:06"; accept that reading too.
  const p = String(at).split(':').map(Number);
  const alt = p.length === 2 && p[0] >= 100 && p[0] % 100 < 60 ? Math.floor(p[0] / 100) * 3600 + (p[0] % 100) * 60 + p[1] : null;
  return inside(sec) || inside(alt);
}

async function checkGapsInContext(lecture, usage) {
  const blocks = lecture.blocks || [];
  const gaps = (lecture.observations || []).filter(o => o.polarity === 'gap' && (o.blocks || []).length);
  if (!gaps.length || !blocks.length) return null;
  const pos = Object.fromEntries(blocks.map((b, i) => [b.id, i]));
  const contexts = [];
  const ranges = [];
  const items = gaps.map((o, k) => {
    const at = pos[o.blocks[0]];
    const ctx = at === undefined ? '' : blocks.slice(Math.max(0, at - 1), at + 4)
      .map(b => `[${b.source === 'SPEECH' && Number.isFinite(b.start) ? fmtTime(b.start) : (b.slide ? `slide ${b.slide}` : b.id)}] ${String(b.text).slice(0, 1200)}`).join('\n');
    contexts[k] = ctx;
    const shown = at === undefined ? [] : blocks.slice(Math.max(0, at - 1), at + 4);
    ranges[k] = shown.length ? [Number(shown[0].start), Number(shown[shown.length - 1].end || shown[shown.length - 1].start)] : null;
    return `ITEM ${k + 1}
Criticism: ${o.note}
Quoted: "${o.quote}"
What happened around it:
${ctx}`;
  }).join('\n\n');
  const r = await callJson({
    systemPrompt: 'You check criticisms of a recorded university class against the transcript around them. The transcript has no speaker labels: students speak too. Return JSON only.',
    prompt: `For each item decide whether the criticism is a real gap or error BY THE TEACHER.
Choose exactly one verdict:
- TEACHER_GAP: a real gap or error by the teacher that the shown blocks do not resolve. The teacher saying they do not know or are unsure about something they are teaching is a TEACHER_GAP unless they give the correct explanation in the shown blocks. When unsure, choose TEACHER_GAP.
- STUDENT_WORDS: the quoted words are clearly a student's answer, guess or proposed approach.
- ANSWERED_LATER: the teacher asked the class a question (or left a point open) and the following blocks answer or explain it.
- CORRECTED: a wrong statement is corrected in the following blocks ("no, no", "wait", a correct restatement).
- DELIBERATE_DEMO: the teacher ran a failing case, a bug or wrong data on purpose and worked out why.
- CRITIQUE_OF_STUDENT: the teacher was judging a student's approach, not stating their own.
- TRANSCRIPTION: the "error" is a misheard word or formula.
- NOT_TEACHING: about equipment or tools (a screen or annotation glitch), not about what was taught.
For every verdict other than TEACHER_GAP, give "at": the time label of the block that shows it.
${items}

Return {"items":[{"item":1,"verdict":"TEACHER_GAP","at":"","why":"one short sentence"}]}`,
    maxTokens: 2048, operation: 'TEACHING_SCORE'
  });
  usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);
  const verdicts = new Map(((r.data && r.data.items) || []).map(x => [Number(x.item), x]));
  if (process.env.TEACHING_CONTEXT_DEBUG) console.log('[ContextCheck]', r.model, JSON.stringify([...verdicts.values()]));
  const REASONS = new Set(['STUDENT_WORDS', 'ANSWERED_LATER', 'CORRECTED', 'DELIBERATE_DEMO', 'CRITIQUE_OF_STUDENT', 'TRANSCRIPTION', 'NOT_TEACHING']);
  const dropped = [];
  const kept = lecture.observations.filter(o => {
    const k = gaps.indexOf(o);
    if (k < 0) return true;
    const v = verdicts.get(k + 1);
    const verdict = v && String(v.verdict || '').toUpperCase();
    // Dropped only with a named reason AND a pointer to the block in the shown context that shows it.
    const shownAt = v && String(v.at || '').replace(/[[\]\s]/g, '');
    if (verdict && REASONS.has(verdict) && shownAt && pointsIntoContext(shownAt, contexts[k], ranges[k])) {
      dropped.push({ ...o, contextVerdict: `${verdict}: ${String(v.why || '').slice(0, 280)}` });
      return false;
    }
    return true;
  });
  if (dropped.length) console.log(`[LectureModel] Teaching review: ${dropped.length} of ${gaps.length} criticism(s) dropped after checking the classroom context`);
  return { kept, dropped };
}

async function scoreTeaching(lecture, { totalWords, usage, hasSpeech, rawArtifactOnly = false }) {
  if (rawArtifactOnly) {
    return { available: false, reason: 'This input is code or terminal output without an explanation, so there is no teaching to judge. Questions are still generated from it. Add a recording or notes that explain it to get a teaching score.' };
  }
  if (lecture.units.length < 3 || totalWords < 300) {
    return { available: false, reason: `The input is too short (${totalWords} words) to judge teaching quality fairly.` };
  }
  // Criticisms are checked in classroom context first (a student's guess, a question put to the class, a deliberate
  // live debug, or a critique of a student's approach is not the teacher's gap or error). Unsupported ones are dropped.
  if (process.env.TEACHING_CONTEXT_CHECK !== 'off') {
    const checked = await checkGapsInContext(lecture, usage).catch(() => null);
    if (checked) lecture = { ...lecture, observations: checked.kept, droppedGaps: checked.dropped };
  }
  const validIds = new Set([...lecture.units.map(u => u.id), ...lecture.observations.map(o => o.id)]);
  const ratedWithEvidence = (data) => ((data && data.dimensions) || []).filter(x => x && Number(x.rating) >= 1 && (x.evidence || []).some(id => validIds.has(id))).length;
  // Stability: one review by a small model swings (the same lecture scored 54, 92 and 70 on three readings). The review
  // runs several times in parallel and each dimension takes the MEDIAN rating among the reviews that rated it with
  // evidence; the finding and evidence shown come from a review that gave that median rating.
  const RUNS = Math.max(1, parseInt(process.env.TEACHING_REVIEW_RUNS, 10) || 1); // reviews of one reading agree; variation comes from re-reading
  const reviews = (await Promise.all(Array.from({ length: RUNS }, () =>
    callJson({ systemPrompt: EVAL_SYSTEM, prompt: evalPrompt(lecture), maxTokens: 4096, operation: 'TEACHING_SCORE' }).catch(() => null)))).filter(Boolean);
  if (!reviews.length) throw new Error('Teaching review unavailable.');
  reviews.forEach(x => { usage.calls++; usage.providers.add(`${x.provider}:${x.model}`); });
  // A reviewer that rates without citing evidence ids leaves a clear lecture "not judgeable": ask once more, explicitly.
  if (Math.max(...reviews.map(x => ratedWithEvidence(x.data))) < 4 && lecture.units.length >= 5) {
    try {
      const again = await callJson({ systemPrompt: EVAL_SYSTEM, prompt: `${evalPrompt(lecture)}

Your previous answer left most dimensions without a rating or without evidence ids. The teaching units above ARE evidence: rate every dimension they support (clarity, examples, structure, depth, reasoning, accuracy) and cite the unit/observation ids for each. Use null only when nothing in the units or observations bears on that dimension.`, maxTokens: 4096, operation: 'TEACHING_SCORE' });
      usage.calls++; usage.providers.add(`${again.provider}:${again.model}`);
      reviews.push(again);
    } catch (_) { /* keep the reviews we have */ }
  }
  const pickDimension = (key) => {
    const all = reviews.map(x => ((x.data && x.data.dimensions) || []).find(y => y && y.key === key))
      .filter(y => y && Number(y.rating) >= 1 && Number(y.rating) <= 4);
    const cited = all.filter(y => (y.evidence || []).some(id => validIds.has(id)));
    // Some reviews rate a dimension but forget the evidence ids. The rating counts towards the median; the dimension
    // is only shown when at least one review cited evidence for it (nothing is shown without verified quotes).
    if (!cited.length) return {};
    if (reviews.length >= 3 && all.length < 2) return {};
    const sorted = all.map(y => Number(y.rating)).sort((m, n) => m - n);
    const median = sorted[Math.floor((sorted.length - 1) / 2)];
    const base = cited.find(y => Number(y.rating) === median) || cited.slice().sort((m, n) => Math.abs(Number(m.rating) - median) - Math.abs(Number(n.rating) - median))[0];
    return { ...base, rating: median };
  };
  const r = { data: reviews[0].data, model: [...new Set(reviews.map(x => x.model))].join(', ') };
  const byId = Object.fromEntries([...lecture.units, ...lecture.observations].map(x => [x.id, x]));

  const dims = TEACHING_DIMENSIONS.map(d => {
    const got = pickDimension(d.key);
    // Teaching observations (which say why) are shown before raw unit quotes.
    const evidenceIds = (got.evidence || []).filter(id => validIds.has(id))
      .sort((a, b) => (a.startsWith('O') ? 0 : 1) - (b.startsWith('O') ? 0 : 1));
    let rating = Number(got.rating);
    const assessable = Number.isFinite(rating) && rating >= 1 && rating <= 4 && evidenceIds.length > 0;
    if (!assessable) rating = null;
    const evidence = evidenceIds.slice(0, 4).map(id => {
      const x = byId[id];
      return id.startsWith('O')
        ? { id, quote: x.quote, where: x.where, time: x.time, note: x.note, polarity: x.polarity }
        : { id, quote: x.quote, where: x.time ? `at ${x.time}` : (x.slides && x.slides.length ? `slide ${x.slides[0]}` : 'material'), time: x.time, note: `${x.topic} — ${x.subtopic}` };
    });
    // A technical-error verdict resting only on the speech transcript is not scored: automatic transcription mishears
    // terms and formulas, and transcripts carry no confidence signal (a KMIT lecture's "TP plus TN by total
    // predictions" and an NPTEL lecture's correct "slow start is multiplicative increase" were both scored as errors).
    // It is shown as a point to double-check; errors visible in slides or documents still count.
    let finding = assessable ? String(got.finding || '').trim() : 'Not enough evidence in this input to judge this.';
    if (d.key === 'accuracy' && rating && rating <= 2 && evidence.length && evidence.every(e => e.time)) {
      rating = null;
      finding = `Possible issue to double-check (from the automatic transcript, which can mishear words): ${finding}`;
    }
    return {
      key: d.key,
      label: d.label,
      question: d.question,
      rating,
      score: rating ? rating * 25 : null,
      levelDescription: rating ? d.levels[rating] : null,
      finding,
      improvement: assessable && rating < 4 && got.improvement ? String(got.improvement).trim() : null,
      evidence
    };
  });

  // Teachers never see internal ids: "In Unit U04, add…" becomes "Dimensionality alignment (12:40): add…".
  const unitById = new Map(lecture.units.map(u => [u.id, u]));
  const unitName = (id) => { const u = unitById.get(String(id).toUpperCase()); return u ? `${u.subtopic}${u.time ? ` (${u.time})` : ''}` : 'this part'; };
  const humanise = (txt) => String(txt || '')
    .replace(/^\s*(?:in|for|at)?\s*(?:unit\s+)?(U\d{2})\b\s*[,:]?\s*/i, (m, id) => `${unitName(id)}: `)
    .replace(/\b(?:unit\s+)?(U\d{2})\b/gi, (m, id) => unitName(id))
    .replace(/^./, c => c.toUpperCase());
  dims.forEach(d => { d.finding = humanise(d.finding); if (d.improvement) d.improvement = humanise(d.improvement); });
  const assessed = dims.filter(d => d.rating !== null);
  const verifiedEvidence = new Set(assessed.flatMap(d => d.evidence.map(e => e.id))).size;
  let confidence = 'LOW';
  if (assessed.length >= 5 && totalWords >= 1200 && verifiedEvidence >= 8) confidence = 'HIGH';
  else if (assessed.length >= 4 && totalWords >= 400 && verifiedEvidence >= 5) confidence = 'MEDIUM';

  const overall = assessed.length >= 4 ? Math.round(assessed.reduce((n, d) => n + d.score, 0) / assessed.length) : null;
  const lvl = String(r.data.level || '').toUpperCase();
  lecture.level = ['INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED'].includes(lvl) ? lvl : null;
  lecture.intent = typeof r.data.intent === 'string' ? r.data.intent : null;
  const confidenceReason = [
    `${assessed.length} of ${dims.length} dimensions could be judged`,
    `${verifiedEvidence} verified evidence items`,
    `${totalWords} words of input`,
    hasSpeech ? null : 'judged from material only (no spoken explanation)'
  ].filter(Boolean).join(', ');

  return {
    available: overall !== null,
    reason: overall === null ? 'Not enough evidence to give an overall score; see the dimensions that could be judged.' : null,
    overall,
    method: 'Average of the rubric dimensions that could be judged (each rated 1–4 = 25–100) from quoted evidence in this input.',
    confidence,
    confidenceReason,
    level: lecture.level,
    intent: lecture.intent,
    dimensions: dims,
    strengths: (r.data.strengths || []).filter(s => typeof s === 'string').slice(0, 3).map(humanise),
    // Next steps follow the median-rated dimensions (so they never repeat a point the median review did not support).
    improvements: (() => { const fromDims = dims.filter(d => d.rating !== null && d.rating < 4 && d.improvement).sort((a, b) => a.rating - b.rating).map(d => d.improvement); return (fromDims.length ? fromDims : (r.data.improvements || []).filter(s => typeof s === 'string').map(humanise)).slice(0, 3); })(),
    reviewModel: r.model,
    reviews: reviews.length,
    // Criticisms dropped by the classroom-context check (kept for transparency and for the paper).
    contextCheck: lecture.droppedGaps ? { dropped: lecture.droppedGaps.map(o => ({ time: o.time, quote: o.quote, note: o.note, why: o.contextVerdict })) } : null,
    caveat: 'This reflects the evidence in this one input, judged against a fixed rubric. It is a feedback aid, not a measure of a teacher\'s overall ability.'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Allocation + teaching units for generation
// ─────────────────────────────────────────────────────────────────────────────

/** Same unit, or near-identical teaching point (one subtopic's key words contained in the other's, or very similar statements). */
const SKILL_FAMILY = { recall: 'remember', concept: 'explain', mechanism: 'explain', comparison: 'explain', trace: 'work', output: 'work', calculation: 'work', debug: 'work', application: 'apply', scenario: 'apply', edge_case: 'apply' };
const skillOf = (type) => SKILL_FAMILY[type] || type;

function sameTeachingPoint(a, b) {
  if (a.id === b.id) return true;
  // Same meaning in different words (vectors attached by attachUnitVectors): one point, one question.
  if (a.vec && b.vec) { const c = semantic.cosine(a.vec, b.vec); if (c !== null && c >= UNIT_SAME_POINT) return true; }
  const toks = s => new Set(normWords(s).filter(w => w.length > 2 && !['the', 'and', 'with', 'using', 'for', 'from', 'checking', 'using'].includes(w)));
  const A = toks(a.subtopic), B = toks(b.subtopic);
  if (A.size && B.size) {
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    if (inter / Math.min(A.size, B.size) >= 0.99 && Math.min(A.size, B.size) >= 2) return true;
  }
  return jaccard(a.statement, b.statement) >= 0.55;
}

/** Largest-remainder allocation of n across keys proportional to weights, never above caps. */
function allocate(n, weights, caps) {
  const keys = Object.keys(weights).filter(k => (caps[k] || 0) > 0 && weights[k] > 0);
  const out = Object.fromEntries(Object.keys(weights).map(k => [k, 0]));
  let remaining = n;
  let active = keys.slice();
  while (remaining > 0 && active.length) {
    const wsum = active.reduce((s, k) => s + weights[k], 0);
    const shares = active.map(k => ({ k, exact: remaining * weights[k] / wsum }));
    let given = 0;
    for (const s of shares) {
      const add = Math.min(Math.floor(s.exact), caps[s.k] - out[s.k]);
      out[s.k] += add; given += add;
    }
    let left = remaining - given;
    shares.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
    for (const s of shares) {
      if (left <= 0) break;
      if (out[s.k] < caps[s.k]) { out[s.k]++; left--; }
    }
    remaining = left;
    active = active.filter(k => out[k] < caps[k]);
    if (given === 0 && left === remaining && shares.every(s => out[s.k] >= caps[s.k])) break;
  }
  return out;
}

/**
 * Plan which question angles to use for a request.
 * @returns {{ requested, deliverable, byDifficulty, byTopic: [{topic, count}], selected: [...], reserves: [...], shortfall }}
 */
function planRequest(fullModel, requestedCount, difficulty = 'Balanced', options = {}) {
  const n = Math.max(0, Math.min(MAX_QUIZ_QUESTIONS, Number(requestedCount) || 0));
  const diffKey = String(difficulty || 'Balanced').toLowerCase();
  // Topics the teacher unticked are left out entirely (their units cannot be selected or used as reserves).
  const excluded = new Set((options.excludeTopics || []).map(t => String(t)));
  const model = excluded.size === 0 ? fullModel : (() => {
    const units = fullModel.units.filter(u => !excluded.has(u.topic));
    return { ...fullModel, units, topics: fullModel.topics.filter(t => !excluded.has(t.name)), capacity: computeCapacity(units) };
  })();
  const cap = model.capacity.byDifficulty;
  // Teaching style (PDI v2): each point prefers the question types that fit how it was taught. Older readings
  // without style labels get them from the unit kinds. STYLE_GUIDED_PLANNING=off turns it off (ablation).
  const styleGuided = options.styleGuided !== undefined ? Boolean(options.styleGuided) : process.env.STYLE_GUIDED_PLANNING !== 'off';
  if (styleGuided && !fullModel.teachingStyle) { try { fullModel.teachingStyle = teachingStyle.buildProfile(fullModel); } catch (_) {} }
  const styleOverride = teachingStyle.normaliseOverride(options.styleOverride);
  const preferOf = (u) => (styleGuided ? teachingStyle.preferFor(u, styleOverride) : null);
  // Readings made before emphasis marking get it now (deterministic, no model call).
  if (styleGuided && (fullModel.units || []).some(u => u.stressed === undefined)) { try { teachingStyle.markEmphasis(fullModel); } catch (_) {} }

  // Replacing one question: same difficulty, traced back to the teaching point it came from, with a
  // question type not used there yet; then other points of the same topic; then anywhere in the lecture.
  // Every (point, type) pair already in the quiz is avoided, so the new question is genuinely different.
  if (options.replace) {
    const r = options.replace;
    const d = ['easy', 'medium', 'hard'].includes(diffKey) ? diffKey : String(r.difficulty || 'medium').toLowerCase();
    const used = new Set((r.usedPairs || []).map(x => `${x.unitId}|${x.type}`));
    const usedUnits = new Set((r.usedPairs || []).map(x => x.unitId));
    const origin = model.units.find(u => u.id === r.unitId)
      || model.units.find(u => r.subtopic && String(u.subtopic).toLowerCase() === String(r.subtopic).toLowerCase());
    const typeUse = {};
    (r.usedPairs || []).forEach(x => { typeUse[x.type] = (typeUse[x.type] || 0) + 1; });
    const candidates = model.units.flatMap(u => u.angles.map((a, ai) => ({ unit: u, angle: a, rank: ai })))
      .filter(p => !used.has(`${p.unit.id}|${p.angle.type}`) && !(origin && p.unit.id === origin.id && p.angle.type === r.type));
    const near = { easy: ['medium'], medium: ['easy', 'hard'], hard: ['medium'] }[d] || [];
    const score = (p) => {
      const tier = p.angle.difficulty === d ? 0 : (near.includes(p.angle.difficulty) ? 1 : 2);
      // Same point first; then points no other question covers (same topic, then anywhere); covered points last.
      const covered = usedUnits.has(p.unit.id) && !(origin && p.unit.id === origin.id);
      const place = origin && p.unit.id === origin.id ? 0
        : ((origin && p.unit.topic === origin.topic ? 1 : 2) + (covered ? 2 : 0));
      return tier * 1000 + place * 100 + (typeUse[p.angle.type] || 0) * 10 + p.rank;
    };
    const ranked = candidates.filter(p => p.angle.difficulty === d || near.includes(p.angle.difficulty)).sort((a, b) => score(a) - score(b));
    const pick = ranked.slice(0, 1).map(p => ({ ...p, difficulty: p.angle.difficulty }));
    // Two reserves at most: a replacement should cost one question's worth of calls, not a quiz's.
    const spare = ranked.slice(1, 3).map(p => ({ ...p, difficulty: p.angle.difficulty }));
    // Hard: a different form from the rejected attempt, and the form used least in the quiz.
    hardForms.assignForms([...pick, ...spare], model, {
      used: (r.usedPairs || []).map(x => x.form), avoid: r.form ? [{ unitId: null, form: r.form }] : [], isSamePoint: sameTeachingPoint
    });
    const byDiffR = { easy: 0, medium: 0, hard: 0 };
    pick.forEach(p => { byDiffR[p.difficulty]++; });
    return {
      requested: 1, difficulty, deliverable: pick.length, byDifficulty: byDiffR,
      byTopic: pick.map(p => ({ topic: p.unit.topic, count: 1 })), selected: pick, reserves: spare,
      shortfall: pick.length ? 0 : 1, filledFromOtherTiers: pick.length && pick[0].difficulty !== d ? 1 : 0,
      excludedTopics: [...excluded],
      shortfallReasons: pick.length ? [] : ['Every question opportunity in this lecture is already used in the quiz.'],
      replaceOrigin: origin ? { unitId: origin.id, subtopic: origin.subtopic, sameUnit: pick.length > 0 && pick[0].unit.id === origin.id } : null
    };
  }

  // 0. Lecture first. When the teacher spoke, the points she taught (alone or with slides) are planned first; points
  // found only in the uploaded material are a supplement, used only for what the lecture cannot fill at a difficulty.
  // With material only (no speech), every uploaded source is equal.
  const hasSpeech = model.units.some(u => u.source === 'SPOKEN' || u.source === 'BOTH');
  const taughtUnits = hasSpeech ? model.units.filter(u => isTaught(u, model.blocks)) : model.units;
  const extraUnits = hasSpeech ? model.units.filter(u => !isTaught(u, model.blocks)) : [];
  const capTaught = computeCapacity(taughtUnits).byDifficulty;
  for (const u of model.units) if (typeof u.importanceScore !== 'number') u.importanceScore = unitImportance(u);
  const imp = (u) => u.importanceScore || 0;

  // 1. Difficulty mix. Balanced follows the lecture's own calibrated capacity (an introductory lecture gives mostly
  // Easy, a deep one more Hard), taken from what was taught when that is enough for the requested count.
  let byDiff;
  let filledFromOtherTiers = 0;
  if (diffKey === 'balanced') {
    const taughtTotal = capTaught.easy + capTaught.medium + capTaught.hard;
    const mixFrom = taughtTotal >= n ? capTaught : cap;
    byDiff = allocate(n, { easy: mixFrom.easy, medium: mixFrom.medium, hard: mixFrom.hard }, cap);
  } else {
    byDiff = { easy: 0, medium: 0, hard: 0 };
    byDiff[diffKey] = Math.min(n, cap[diffKey] || 0);
    // The teacher chose "fill the rest": use the nearest other difficulty first (Medium, then the far tier).
    if (options.fillOtherTiers && byDiff[diffKey] < n) {
      const order = diffKey === 'medium' ? ['easy', 'hard'] : ['medium', diffKey === 'hard' ? 'easy' : 'hard'];
      for (const t of order) {
        const add = Math.min(n - (byDiff.easy + byDiff.medium + byDiff.hard), cap[t] || 0);
        byDiff[t] += add;
        filledFromOtherTiers += add;
      }
    }
  }

  // 2. Per difficulty, spread across topics by capacity and teaching time, then pick the best points.
  const totalShare = model.topics.reduce((s, t) => s + (t.share || 0), 0) || 1;
  const selected = [];
  const reserves = [];
  const byTopic = {};
  // The quiz blueprint has two axes, like a teacher's table of specifications: topics (allocated per difficulty
  // below by capacity and teaching time) and the kind of question, which follows how each part was taught. A
  // lecture that was 30% live code walkthrough gets about 30% code-taught questions. The target is set for the
  // whole quiz and then shared out across the difficulties, so rounding at each difficulty does not add up.
  const modeOf = (u) => teachingStyle.unitMode(u, styleOverride);
  const nWanted = byDiff.easy + byDiff.medium + byDiff.hard;
  const modeTarget = styleGuided && nWanted > 0
    ? teachingStyle.modeQuota({ ...model, units: taughtUnits }, taughtUnits.flatMap(u => u.angles.filter(a => byDiff[a.difficulty] > 0).map(a => ({ unit: u, angle: a }))), nWanted, styleOverride, allocate)
    : null;
  const modeSoFar = {};

  // Picks `want` angles of difficulty d from `units` (one pass of the selection; used for taught points, then for
  // the material-only supplement). Returns how many were picked; leftovers become reserves.
  const pickFrom = (units, d, want, supplementary) => {
    if (want <= 0) { units.forEach(u => u.angles.filter(a => a.difficulty === d).forEach((a, ai) => reserves.push({ unit: u, angle: a, rank: ai, difficulty: d, supplementary }))); return 0; }
    const pools = {};
    for (const t of model.topics) {
      pools[t.name] = units
        .filter(u => u.topic === t.name)
        .flatMap(u => u.angles.filter(a => a.difficulty === d).map((a, ai) => ({ unit: u, angle: a, rank: ai })));
      // Different points first (first angle of each point), the more important points first, merely mentioned last.
      pools[t.name].sort((a, b) => a.rank - b.rank || imp(b.unit) - imp(a.unit) || (a.unit.depth === 'MENTIONED') - (b.unit.depth === 'MENTIONED'));
    }
    const caps = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));
    const capSum = Math.max(1, Object.values(caps).reduce((s, x) => s + x, 0));
    // A topic taught through code or a terminal session the class ran has no speaking time of its own (the session
    // was pasted, not timed): it is weighted by what it supports instead of by a teaching time of zero.
    const artifactTopic = (name) => units.filter(u => u.topic === name).every(u => u.source === 'MATERIAL' && isTaught(u, model.blocks)) && units.some(u => u.topic === name);
    const weights = Object.fromEntries(model.topics.map(t => [t.name, (artifactTopic(t.name) ? caps[t.name] / capSum : 0.5 * caps[t.name] / capSum + 0.5 * (t.share || 0) / totalShare) + 1e-6]));
    const alloc = allocate(want, weights, caps);
    let modeQuota = null;
    if (modeTarget && !supplementary) {
      const modeCaps = {};
      Object.entries(pools).filter(([t]) => (alloc[t] || 0) > 0).forEach(([, p]) => p.forEach(x => { const m = modeOf(x.unit); modeCaps[m] = (modeCaps[m] || 0) + 1; }));
      const need = Object.fromEntries(Object.keys(modeCaps).map(m => [m, Math.max(0, (modeTarget[m] || 0) - (modeSoFar[m] || 0)) + 1e-6]));
      modeQuota = allocate(want, need, modeCaps);
    }
    const modeUsed = {};
    const topicLeft = { ...alloc };
    const remainingBy = Object.fromEntries(Object.entries(pools).map(([t, p]) => [t, p.slice()]));
    const typeCount = t => selected.filter(s => s.angle.type === t).length;
    const typeCountInMode = (m, t) => selected.filter(s => s.angle.type === t && modeOf(s.unit) === m).length;
    // Order of preference for each pick (topic quotas are fixed):
    //   1. a teaching point not assessed yet (the same idea taught twice counts as one point);
    //   2. a teaching mode still below its share of the quiz;
    //   3. a question type that fits how the point was taught (code taught live -> output/trace/debug; theory ->
    //      concept/comparison/mechanism; a fact the teacher stressed -> a direct question at Easy);
    //   4. the type used least so far within that teaching mode (variety without leaving the style);
    //   5. the more important point (role in the lecture's intent, depth, emphasis, revisits, time spent).
    // Without the style profile (ablation), only 1, plain type variety and importance apply.
    const pickBest = (allowRepeatPoint) => {
      let best = null, bestScore = Infinity;
      for (const [topic, remaining] of Object.entries(remainingBy)) {
        if (!(topicLeft[topic] > 0)) continue;
        remaining.forEach((p, i) => {
          if (!allowRepeatPoint && selected.some(s => sameTeachingPoint(s.unit, p.unit))) return;
          // A second question on the same point must test a different skill (recall vs explain vs trace/compute vs
          // apply); the same skill twice is a duplicate, so it is not planned at all.
          if (allowRepeatPoint && selected.some(s => sameTeachingPoint(s.unit, p.unit) && skillOf(s.angle.type) === skillOf(p.angle.type))) return;
          const m = modeOf(p.unit);
          const modeFull = modeQuota && (modeUsed[m] || 0) >= (modeQuota[m] || 0) ? 1e6 : 0;
          let score;
          if (styleGuided) {
            const prefer = preferOf(p.unit);
            const stressedRecall = Boolean(p.unit.stressed) && d === 'easy' && p.angle.type === 'recall';
            const fits = !prefer || prefer.includes(p.angle.type) || stressedRecall;
            score = modeFull + (fits ? 0 : 1e4) + typeCountInMode(m, p.angle.type) * 100 + p.rank * 10 - imp(p.unit) * 8 - (stressedRecall ? 40 : 0) + i * 0.01;
          } else {
            score = typeCount(p.angle.type) * 100 + p.rank * 10 - imp(p.unit) * 8 + i * 0.01;
          }
          if (score < bestScore) { bestScore = score; best = { topic, i }; }
        });
      }
      return best;
    };
    let toPick = Object.values(alloc).reduce((s, x) => s + x, 0);
    let picked = 0;
    while (toPick > 0) {
      const at = pickBest(false) || pickBest(true);
      if (!at) break;
      const [p] = remainingBy[at.topic].splice(at.i, 1);
      selected.push({ ...p, difficulty: d, supplementary });
      const m = modeOf(p.unit);
      modeUsed[m] = (modeUsed[m] || 0) + 1;
      topicLeft[at.topic]--; toPick--; picked++;
      byTopic[at.topic] = (byTopic[at.topic] || 0) + 1;
    }
    Object.entries(modeUsed).forEach(([m, c]) => { modeSoFar[m] = (modeSoFar[m] || 0) + c; });
    Object.values(remainingBy).forEach(rem => rem.forEach(p => reserves.push({ ...p, difficulty: d, supplementary })));
    return picked;
  };

  let fromMaterialOnly = 0;
  // Order of filling: what the lecture is about (core and supporting points), then side details the calibration
  // marked peripheral (setup clicks, tool trivia), then points found only in uploaded material.
  const mainUnits = taughtUnits.filter(u => u.role !== 'PERIPHERAL');
  const sideUnits = taughtUnits.filter(u => u.role === 'PERIPHERAL');
  for (const d of ['easy', 'medium', 'hard']) {
    const got = pickFrom(mainUnits, d, byDiff[d], false);
    const side = sideUnits.length ? pickFrom(sideUnits, d, byDiff[d] - got, false) : 0;
    const extra = extraUnits.length ? pickFrom(extraUnits, d, byDiff[d] - got - side, true) : 0;
    fromMaterialOnly += extra;
  }
  // Reserves: taught points before material-only ones, the more important first.
  reserves.sort((a, b) => (a.supplementary ? 1 : 0) - (b.supplementary ? 1 : 0) || imp(b.unit) - imp(a.unit) || a.rank - b.rank);
  // Hard picks: each gets the way of being Hard that its content supports, varied across the quiz.
  hardForms.assignForms(selected, model, { isSamePoint: sameTeachingPoint });
  hardForms.assignForms(reserves, model, { used: selected.map(p => p.hardForm), isSamePoint: sameTeachingPoint });
  const deliverable = selected.length;
  const shortfall = n - deliverable;
  const reasons = [];
  if (filledFromOtherTiers > 0) {
    reasons.push(`This input supports ${cap[diffKey] || 0} distinct ${diffKey} question${cap[diffKey] === 1 ? '' : 's'}; as you chose, the other ${filledFromOtherTiers} come from other difficulty levels.`);
  }
  if (shortfall > 0) {
    if (diffKey !== 'balanced' && !options.fillOtherTiers) {
      reasons.push(`This input supports ${cap[diffKey] || 0} distinct ${diffKey} question${cap[diffKey] === 1 ? '' : 's'}; ${n} were requested.`);
    } else {
      reasons.push(`This input supports ${model.capacity.total} distinct questions in total${excluded.size ? ' for the topics you kept' : ''}; ${n} were requested.`);
    }
  }
  // More asked than this input has distinct points: say so first, in the teacher's terms (points, not "angles").
  const recKey = diffKey === 'balanced' ? 'balanced' : diffKey;
  const recommendedN = model.capacity && model.capacity.recommended ? model.capacity.recommended[recKey] : null;
  if (typeof recommendedN === 'number' && n > recommendedN && !options.replace) {
    reasons.unshift(`This input teaches ${recommendedN} distinct point${recommendedN === 1 ? '' : 's'}${diffKey === 'balanced' ? '' : ` suited to ${diffKey} questions`}, so ${recommendedN} question${recommendedN === 1 ? ' is' : 's are'} recommended; questions beyond that look at the same points from another angle and are dropped if they repeat one.`);
    const i = reasons.findIndex(r => /distinct questions in total/.test(r));
    if (i >= 0) reasons.splice(i, 1);
  }
  if (excluded.size) reasons.push(`Left out at your request: ${[...excluded].join(', ')}.`);
  // Uploaded material on topics the lecture never touched: tell the teacher (it is not silently mixed in).
  if (hasSpeech && extraUnits.length) {
    const taughtTopics = new Set(taughtUnits.map(u => u.topic));
    const untouched = [...new Set(extraUnits.map(u => u.topic))].filter(t => !taughtTopics.has(t));
    if (untouched.length) reasons.push(`Not covered in the lecture: ${untouched.slice(0, 4).join(', ')}${untouched.length > 4 ? ` and ${untouched.length - 4} more` : ''} (from the uploaded material; used only when the lecture cannot fill the quiz).`);
  }
  if (fromMaterialOnly > 0) reasons.push(`The lecture itself supports ${deliverable - fromMaterialOnly} of these; ${fromMaterialOnly} come from points that appear only in the uploaded material.`);
  // Keep only reserves of the difficulties actually requested
  const wanted = new Set(Object.entries(byDiff).filter(([, v]) => v > 0).map(([k]) => k));
  return {
    requested: n,
    difficulty,
    deliverable,
    byDifficulty: byDiff,
    byTopic: Object.entries(byTopic).map(([topic, count]) => ({ topic, count })),
    selected,
    // Reserves of the requested difficulties first; when the teacher allows filling (default), reserves of the
    // nearest other difficulty follow as a last resort, so a failed Hard slot becomes a Medium question with a
    // notice instead of a failed quiz.
    reserves: [
      ...reserves.filter(r => wanted.has(r.difficulty)),
      ...(options.fillOtherTiers && diffKey !== 'balanced'
        ? reserves.filter(r => !wanted.has(r.difficulty)).sort((a, b) => (a.difficulty === 'medium' ? 0 : 1) - (b.difficulty === 'medium' ? 0 : 1))
        : [])
    ],
    shortfall: Math.max(0, shortfall),
    filledFromOtherTiers,
    fromMaterialOnly,
    excludedTopics: [...excluded],
    shortfallReasons: reasons
  };
}

const KIND_TO_CATEGORY = {
  DEFINITION: 'CONCEPT_DEFINITION', MECHANISM: 'SPECIFICATION', EXAMPLE: 'WORKED_EXAMPLE', CODE: 'ALGORITHM_AND_CODE',
  COMMAND: 'ALGORITHM_AND_CODE', CALCULATION: 'PROBLEM_SOLVING', ALGORITHM_TRACE: 'ALGORITHM_AND_CODE',
  COMPARISON: 'COMPARATIVE_ANALYSIS', EDGE_CASE: 'EDGE_CASE', APPLICATION: 'WORKED_EXAMPLE'
};
const ANGLE_TO_OPERATION = {
  recall: 'RECALL', concept: 'EXPLAIN', mechanism: 'EXPLAIN', trace: 'TRACE', output: 'PREDICT', calculation: 'CALCULATE',
  debug: 'DIAGNOSE', comparison: 'COMPARE', edge_case: 'DIAGNOSE', application: 'APPLY', scenario: 'APPLY'
};

/** Converts planned angles to the teaching-unit shape the existing planner/generator consume. */
/**
 * The teacher's words for one teaching point: cited speech blocks in time order, with small gaps between them
 * filled (a reader may cite 15:14 and 17:26 but skip the 16:23 block where the decisive trace happens), then cited
 * material. When too long, every block keeps an equal share (head-only truncation used to drop the end of a point).
 */
function unitEvidenceText(model, unit, maxChars = 2400, { neighbours = 0 } = {}) {
  if (!model || !unit) return '';
  const blocks = model.blocks || [];
  const idx = Object.fromEntries(blocks.map((b, i) => [b.id, i]));
  const cited = (unit.blocks || []).filter(id => idx[id] !== undefined);
  const speech = cited.filter(id => blocks[idx[id]].source === 'SPEECH').map(id => idx[id]).sort((a, b) => a - b);
  // neighbours > 0 (example-taught points): also the classroom exchange just before and after the point (student answers, the
  // teacher's follow-up), which is where in-class misconceptions and worked examples usually are.
  if (neighbours > 0 && speech.length) {
    for (let n = 1; n <= neighbours; n++) {
      const before = speech[0] - n; const after = speech[speech.length - 1] + n;
      if (before >= 0 && blocks[before].source === 'SPEECH') speech.unshift(before);
      if (after < blocks.length && blocks[after].source === 'SPEECH') speech.push(after);
    }
    speech.sort((a, b) => a - b);
  }
  const chosen = [];
  speech.forEach((pos, k) => {
    if (k > 0) {
      const prev = speech[k - 1];
      if (pos - prev > 1 && pos - prev <= 3) for (let g = prev + 1; g < pos; g++) chosen.push(g);
    }
    chosen.push(pos);
  });
  cited.filter(id => blocks[idx[id]].source !== 'SPEECH').forEach(id => chosen.push(idx[id]));
  const parts = [...new Set(chosen)].map(i => blocks[i] && blocks[i].text).filter(Boolean);
  if (!parts.length) return unit.quote || '';
  const total = parts.reduce((n, t) => n + t.length + 1, 0);
  if (total <= maxChars) return parts.join('\n');
  const share = Math.max(200, Math.floor(maxChars / parts.length) - 2);
  return parts.map(t => (t.length > share ? `${t.slice(0, share)}…` : t)).join('\n').slice(0, maxChars + parts.length);
}

function toTeachingUnits(model, plan, opts = {}) {
  // Teaching style (PDI v2): the question writer is told how each point was taught (and the teacher's own example).
  const styleGuided = opts.styleGuided !== undefined ? Boolean(opts.styleGuided) : process.env.STYLE_GUIDED_PLANNING !== 'off';
  const styleOverride = teachingStyle.normaliseOverride(opts.styleOverride);
  const make = (p, i, isReserve) => {
    const u = p.unit;
    const a = p.angle;
    // Examples often span the exchange around the point, so example-taught points also get the neighbouring block.
    const exampleTaught = styleGuided && teachingStyle.unitMode(u, styleOverride) === 'EXAMPLE';
    let passage = unitEvidenceText(model, u, exampleTaught ? 2800 : 2400, { neighbours: exampleTaught ? 1 : 0 });
    const tier = p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1);
    const form = tier === 'Hard' && p.hardForm ? p.hardForm : null;
    const linked = form === 'link' && p.linkedUnitId ? model.units.find(x => x.id === p.linkedUnitId) : null;
    if (linked) passage = `${passage}

RELATED POINT TAUGHT IN THE SAME LECTURE (${linked.subtopic}): ${linked.statement}
${unitEvidenceText(model, linked, 1200)}`;
    return {
      claimId: `${u.id}_${a.type}`,
      sequenceIndex: i + 1,
      topic: u.topic,
      subtopic: u.subtopic,
      concept: u.subtopic,
      category: KIND_TO_CATEGORY[u.kind] || 'CONCEPT_DEFINITION',
      statement: `${u.statement} Question focus (${a.type}): ${a.focus}`,
      transcriptExcerpt: passage || u.quote,
      documentExcerpt: null,
      provenance: u.source === 'MATERIAL' ? 'SHARED' : (u.source === 'BOTH' ? 'SHARED' : 'VOICE_ONLY'),
      hasCode: Boolean(u.hasCode),
      hasFormula: Boolean(u.hasFormula),
      sourceChunks: [],
      isPrimaryTargetEligible: true,
      structureType: 'INDEPENDENT_UNIT',
      plannedDifficulty: tier,
      plannedOperation: ANGLE_TO_OPERATION[a.type] || 'EXPLAIN',
      questionAngle: a.type,
      angleFocus: a.focus,
      hardForm: form,
      hardFormRecipe: form ? hardForms.HARD_FORMS[form].recipe : null,
      linkedUnitId: linked ? linked.id : null,
      lectureMisconceptions: u.misconceptions || [],
      teachingStyleNote: styleGuided ? teachingStyle.noteFor(u, model.teachingStyle, styleOverride) : null,
      teachingMode: styleGuided ? teachingStyle.unitMode(u, styleOverride) : null,
      lectureUnitId: u.id,
      // What the whole lecture set out to teach and what this difficulty means for this class (calibration step),
      // so the writer pitches the question at the lecture, not at the subject in general.
      lectureIntent: (model.calibration && model.calibration.status === 'ok' && model.calibration.intent) || model.intent || null,
      difficultyMeaning: (model.calibration && model.calibration.difficulty && model.calibration.difficulty[p.difficulty]) || null,
      unitRole: u.role || null,
      importanceScore: typeof u.importanceScore === 'number' ? u.importanceScore : unitImportance(u),
      supplementary: Boolean(p.supplementary),
      lectureTime: u.time,
      lectureSlides: u.slides,
      isReserve
    };
  };
  const primary = plan.selected.map((p, i) => make(p, i, false));
  const reserve = plan.reserves.map((p, i) => make(p, plan.selected.length + i, true));
  return { primary, reserve, all: [...primary, ...reserve] };
}

/** Compact payload for the teacher UI (no raw blocks). */
function toClientPayload(model) {
  if (!model || !model.ok) return model;
  const { blocks, ...rest } = model;
  return {
    ...rest,
    units: model.units.map(u => ({
      id: u.id, topic: u.topic, subtopic: u.subtopic, kind: u.kind, depth: u.depth, source: u.source,
      time: u.time, slides: u.slides, statement: u.statement, quote: u.quote, angles: u.angles, delivery: u.delivery || null
    })),
    teachingStyleText: model.teachingStyle ? teachingStyle.describeProfile(model.teachingStyle) : null,
    hardForms: hardForms.profile(model, { isSamePoint: sameTeachingPoint })
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache (memory + disk, keyed by content hash + model version)
// ─────────────────────────────────────────────────────────────────────────────
function readCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const f = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (data && data.version === MODEL_VERSION) { memoryCache.set(key, data); return data; }
    }
  } catch (_) {}
  return null;
}

function writeCache(key, data) {
  memoryCache.set(key, data);
  if (memoryCache.size > 200) memoryCache.delete(memoryCache.keys().next().value);
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(data), 'utf8');
  } catch (_) {}
}

function getById(id) {
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  // An existing quiz keeps working with the analysis it was made from, even after the reader is upgraded
  // (a new upload is re-read with the current version; this lookup only serves quizzes already generated).
  const current = readCache(id);
  if (current) return current;
  try {
    const f = path.join(CACHE_DIR, `${id}.json`);
    if (fs.existsSync(f)) { const data = JSON.parse(fs.readFileSync(f, 'utf8')); if (data && data.ok) return data; }
  } catch (_) {}
  return null;
}

/** Persist an updated reading (e.g. its teaching report) under its id. */
function saveModel(m) { if (m && m.id && /^[a-f0-9]{64}$/.test(m.id) && !m.incomplete) writeCache(m.id, m); }

module.exports = {
  saveModel,
  MODEL_VERSION,
  MAX_QUIZ_QUESTIONS,
  TEACHING_DIMENSIONS,
  buildLectureModel,
  buildTopicModel,
  planRequest,
  calibrateLecture,
  ensureCalibrated,
  CALIBRATION_VERSION,
  attachUnitVectors,
  unitImportance,
  computeCapacity,
  toTeachingUnits,
  toClientPayload,
  getById,
  // exported for tests
  unitEvidenceText,
  teachingStyle,
  hardForms,
  _internal: { spokenCodeHits, buildBlocks, buildWindows, prepareSemanticLinkage, buildTopics, unitSeconds, blocksFromText, quoteSupported, sanitiseAngles, computeCapacity, allocate, buildSegments, consolidateUnits, callJson, evalPrompt, EVAL_SYSTEM, checkGapsInContext, scoreTeaching, pointsIntoContext }
};
