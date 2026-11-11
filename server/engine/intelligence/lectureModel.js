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

const MODEL_VERSION = 'lecture-model-v1.8';
// Largest quiz a teacher can request (one setting for server, planner and UI). Default 30: a daily-quiz size.
const MAX_QUIZ_QUESTIONS = Math.max(1, parseInt(process.env.MAX_QUIZ_QUESTIONS, 10) || 30);
const CACHE_DIR = path.join(__dirname, '..', '..', 'storage', 'lecture_model_cache');
const WINDOW_CHARS = 24000;
const MAX_PARALLEL_WINDOWS = 3;
const memoryCache = new Map();
const modelCooldownUntil = new Map();
const rateLimitedUntil = new Map();

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

const TERMINAL_PROMPT = /^\s*(?:\$|#|>|PS [A-Za-z]:\\[^>]*>|[A-Za-z]:\\[^>]*>|[\w.-]+@[\w.-]+:[^$#]*[$#]|mysql>|postgres=#|sqlite>)\s*\S/;

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
function buildWindows(speech, material) {
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
    for (const m of material) {
      let best = -1; let bestScore = 0;
      windows.forEach((w, i) => {
        const score = jaccard(m.text, w.speech.map(s => s.text).join(' '));
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0 && bestScore >= 0.04) {
        const w = windows[best];
        const used = w.material.reduce((n, x) => n + x.text.length, 0);
        if (used + m.text.length <= 6000) { w.material.push(m); continue; }
      }
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
  const genAI = new GoogleGenerativeAI(String(process.env.GEMINI_API_KEY).trim());
  const m = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
  });
  const result = await m.generateContent(prompt);
  return result.response.text();
}

async function callJson({ systemPrompt, prompt, maxTokens = 8192, operation }) {
  const geminiModels = (process.env.LECTURE_MODEL_GEMINI || 'gemini-3.5-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map(s => s.trim()).filter(Boolean);
  let lastErr = null;
  if (process.env.GEMINI_API_KEY && process.env.DISABLE_GEMINI !== 'true') {
    // Two rounds over the model list: a model that is only rate-limited (429) gets a second chance
    // after its retry delay; an overloaded model (503) is skipped for a minute.
    for (let round = 0; round < 2; round++) {
      for (const geminiModel of geminiModels) {
        if ((modelCooldownUntil.get(geminiModel) || 0) > Date.now()) continue;
        const waitUntil = rateLimitedUntil.get(geminiModel) || 0;
        if (waitUntil > Date.now()) {
          if (round === 0) continue;
          await new Promise(r => setTimeout(r, Math.min(25000, waitUntil - Date.now())));
        }
        try {
          const raw = await withTimeout(callGeminiDirect({ systemPrompt, prompt, maxTokens, model: geminiModel }), 150000, 'Gemini lecture model timeout');
          const parsed = safeParseJson(raw, null);
          if (parsed) return { data: parsed, provider: 'gemini', model: geminiModel };
          lastErr = new Error('Gemini returned unparseable JSON');
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || '');
          console.warn(`[LectureModel] ${operation} via ${geminiModel} failed (round ${round + 1}): ${msg.slice(0, 160)}`);
          if (/429|RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg)) {
            const m = msg.match(/retry(?:Delay)?["\s:]*(?:in\s*)?(\d+(?:\.\d+)?)s/i);
            rateLimitedUntil.set(geminiModel, Date.now() + Math.min(30000, (m ? parseFloat(m[1]) : 10) * 1000 + 500));
          } else if (/503|overloaded|UNAVAILABLE|high demand/i.test(msg)) {
            modelCooldownUntil.set(geminiModel, Date.now() + 60000);
          }
        }
      }
    }
  }
  try {
    const raw = await llmRouter.complete({
      prompt, systemPrompt, temperature: 0, responseFormat: 'json', maxTokens, operation,
      model: process.env.LECTURE_MODEL_GROQ || 'openai/gpt-oss-120b'
    });
    const parsed = safeParseJson(raw, null);
    if (parsed) return { data: parsed, provider: 'groq', model: process.env.LECTURE_MODEL_GROQ || 'openai/gpt-oss-120b' };
    throw new Error('Groq returned unparseable JSON');
  } catch (e) {
    throw new Error(`Lecture model call failed (${operation}): ${lastErr ? lastErr.message + ' | ' : ''}${e.message}`);
  }
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
- Return JSON only.`;

function windowPrompt(win, ctx) {
  const blocks = [...win.speech, ...win.material].map(renderBlock).join('\n\n');
  return `Lecture context: ${ctx}

BLOCKS:
${blocks}

Return this JSON:
{
  "segments": [ { "from": "B01", "to": "B03", "title": "3-6 word title", "description": "one short plain sentence stating what was taught, starting with the content itself (e.g. 'Four benefits of IPC: ...', 'Traces git add moving a file to the staging area') — never start with 'The lecture' or 'The instructor'" } ],
  "units": [
    {
      "topic": "macro topic (reuse the same name for the same topic)",
      "subtopic": "specific idea, rule, command, algorithm or example",
      "kind": "one of ${UNIT_KINDS.join('|')}",
      "blocks": ["B02"],
      "statement": "1-2 sentences: the precise point that was taught, in your own words",
      "quote": "verbatim words from one of the cited blocks",
      "depth": "MENTIONED (only named) | EXPLAINED (explained) | DEMONSTRATED (worked example, code, trace or calculation shown)",
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
- segments: cover every speech block in order (if there are speech blocks). Make a new segment whenever the idea being taught changes — typically every 1-3 minutes, so a ${win.speech.length}-block window usually has about ${Math.max(1, Math.round(win.speech.length / 2))} segments. For material-only input, make one segment per section/slide group instead. Titles name the specific idea (e.g. "git add and the staging area"), never generic ("Introduction", "Practical demonstration").
- units: be thorough and fine-grained. Make one unit for EACH distinct teachable point: every definition, every command or flag explained, every step of a procedure, every rule, every example worked through, every comparison, every warning or edge case. Every block that is not chatter must be cited by at least one unit. For code or terminal sessions, each command (with its flags and its output or state change) and each code construct is its own unit. A substantive block usually contains 1-3 units; this window has ${win.speech.length + win.material.length} blocks, so expect roughly ${Math.max(2, Math.round((win.speech.length + win.material.length) * 1.3))} units or more if the content is dense (fewer only if much of it is chatter). Do not create units for things only listed in a slide title and never discussed. If the same point is explained and later demonstrated (or repeated), make ONE unit that cites all of those blocks.
- For code, SQL or terminal material, think like a teacher setting a lab quiz: the exact output of the whole program/session, the effect of each important call or command (and its flags), what each key line or keyword does and why it is there, what happens for a boundary or invalid input, and what goes wrong if one line is changed. Each of these is its own unit or angle.
- angles: give every EXPLAINED or DEMONSTRATED unit 2-4 angles; only angles this unit's content really supports, each testing something different (max 4):
  * trace / output / debug only for code, commands, algorithm steps or traces that were shown;
  * calculation only if a formula or numeric procedure was shown;
  * hard only for real multi-step reasoning on what was taught (edge case, what-if, combining ideas, diagnosing a wrong result) — not for long or wordy recall;
  * a MENTIONED unit gets at most one easy recall angle.
- misconceptions: 2-3 per unit, drawn from contrasts or warnings the teacher made, near-miss steps, off-by-one or boundary errors, or confusion with a related idea from the same lecture.
- observations: 2-6 specific ones about teaching quality, each tied to a block and quote. Gaps must say what was missing and where (e.g. "showed the steps of X but not why Y holds").`;
}

const EVAL_SYSTEM = `You are a careful, fair reviewer of university teaching. You rate one lecture against a fixed rubric using ONLY the evidence listed. You judge what was taught, relative to what the lecture set out to teach and its level: an introductory lecture is not penalised for lacking advanced material. You never judge accent, fluency, filler words, voice, enthusiasm, speaking speed or transcription errors. If the evidence for a dimension is too thin to judge, you say so instead of guessing. Return JSON only.`;

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
      "evidence": ["O3", "U5"],
      "finding": "one sentence on what the evidence shows, naming the specific topic",
      "improvement": "one short, specific, actionable suggestion naming the unit/topic and what to add (or null if rating is 4)"
    }
  ],
  "strengths": ["2-3 specific strengths, each naming the topic"],
  "improvements": ["2-3 specific improvements, each naming the topic and exactly what was missing"]
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
  const key = hashInput([allBlocks.map(b => `${b.id}|${b.start}|${b.text}`).join('\n'), title]);

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
  const windows = buildWindows(speech, material);
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
    const srcTypes = new Set(u.blocks.map(id => blockMap[id].source));
    u.source = srcTypes.has('SPEECH') && srcTypes.has('MATERIAL') ? 'BOTH' : (srcTypes.has('SPEECH') ? 'SPOKEN' : 'MATERIAL');
    const timedBlocks = u.blocks.map(id => blockMap[id]).filter(b => b.start !== null && b.start !== undefined);
    u.start = timedBlocks.length ? Math.min(...timedBlocks.map(b => b.start)) : null;
    u.time = fmtTime(u.start);
    const slides = u.blocks.map(id => blockMap[id].slide).filter(Boolean);
    u.slides = Array.from(new Set(slides));
    u.hasCode = CODE_KINDS.has(u.kind) || /```|;\s*$|^\s*\$ /m.test(u.blocks.map(id => blockMap[id].text).join('\n')) && (u.angles || []).some(a => ['trace', 'output', 'debug'].includes(a.type));
    u.hasFormula = u.kind === 'CALCULATION' || (u.angles || []).some(a => a.type === 'calculation');
    u.angles = sanitiseAngles(u);
    u.misconceptions = (u.misconceptions || []).filter(m => typeof m === 'string' && m.trim().length > 5).slice(0, 4);
  });

  // Duplicate teaching points and variant topic names are consolidated in one small call; ids renumbered.
  finalUnits = await consolidateUnits(finalUnits, usage);
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
    observations
  };
  const [meta, teachingResult] = await Promise.all([
    describeLecture({ title, segments: segmentsOut, units: finalUnits, inputDescription, usage }),
    scoreTeaching(lectureForReview, {
      totalWords, usage, hasSpeech: speech.length > 0,
      rawArtifactOnly: speech.length === 0 && material.length > 0 && material.filter(b => b.kind).length / material.length >= 0.6
    })
      .catch(e => ({ available: false, reason: `The teaching review could not be completed: ${e.message}` }))
  ]);
  const teaching = teachingResult;

  const lecture = {
    title: meta.title || title || (topics[0] && topics[0].name) || 'Lecture',
    level: teaching.level || meta.level || 'INTERMEDIATE',
    intent: teaching.intent || meta.intent || '',
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
    teaching,
    incomplete: unreadParts.length ? { unreadParts, message: `Part of the input could not be read because the analysis service was busy (${unreadParts.join('; ')}). Retry to include it.` } : null,
    blocks: allBlocks.map(b => ({ id: b.id, source: b.source, start: b.start, end: b.end, slide: b.slide || null, text: b.text })),
    audit: {
      windows: windows.length,
      llmCalls: usage.calls,
      providers: Array.from(usage.providers),
      droppedUnverifiedUnits: droppedUnits,
      droppedUnverifiedObservations: droppedObs,
      buildMs: Date.now() - t0,
      builtAt: new Date().toISOString()
    }
  };
  // Incomplete models are kept in memory for generation but not persisted, so a retry re-reads them.
  if (unreadParts.length) memoryCache.set(key, model); else writeCache(key, model);
  return model;
}

/**
 * Topic-only input: no lecture exists, so the system writes concise reference notes on the topic
 * (clearly labelled as general knowledge) and builds the same model from them. Questions are then
 * grounded in those notes instead of free-form generation; no teaching score is produced.
 */
async function buildTopicModel({ topic, forceRefresh = false }) {
  const key = hashInput(['TOPIC_NOTES', String(topic || '').trim().toLowerCase()]);
  if (!forceRefresh) {
    const hit = readCache(key);
    if (hit) return { ...hit, cached: true };
  }
  const r = await callJson({
    systemPrompt: 'You are a university lecturer writing concise, technically correct teaching notes. Return JSON only.',
    prompt: `Write teaching notes for one university class on: "${topic}".
Cover the standard core of this topic at undergraduate level, in teaching order: key definitions, how the main mechanisms/algorithms work and why, one or two short worked examples (with concrete values, code or commands where the subject uses them), important comparisons, and common edge cases or mistakes.
Use only well-established textbook facts. 1500-2200 words, plain paragraphs under short headings; code or commands on their own lines.
Return {"title":"short title","notes":"the notes text, with headings on their own lines"}`,
    maxTokens: 6000,
    operation: 'TOPIC_NOTES'
  });
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
    if (type === 'recall' && diff === 'hard') diff = 'medium';
    if (['trace', 'output', 'calculation', 'debug'].includes(type) && diff === 'easy') diff = 'medium';
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
async function consolidateUnits(units, usage) {
  if (units.length < 4) return units;
  const names = [];
  for (const u of units) if (!names.includes(u.topic)) names.push(u.topic);
  const unitList = units.map(u => `${u.id} [${u.topic}] ${u.subtopic}: ${String(u.statement || '').slice(0, 140)}`).join('\n');
  const target = Math.max(2, Math.min(10, Math.round(Math.sqrt(units.length) + 1)));
  try {
    const r = await callJson({
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

function computeCapacity(units) {
  const by = { easy: 0, medium: 0, hard: 0 };
  for (const u of units) for (const a of (u.angles || [])) by[a.difficulty]++;
  const total = by.easy + by.medium + by.hard;
  return {
    byDifficulty: by,
    total,
    // Recommended leaves headroom for questions that fail validation, capped at the 30-question maximum.
    recommended: {
      easy: Math.min(MAX_QUIZ_QUESTIONS, by.easy),
      medium: Math.min(MAX_QUIZ_QUESTIONS, by.medium),
      hard: Math.min(MAX_QUIZ_QUESTIONS, by.hard),
      balanced: Math.min(MAX_QUIZ_QUESTIONS, total <= 4 ? total : Math.max(3, Math.round(total * 0.75)))
    },
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

async function scoreTeaching(lecture, { totalWords, usage, hasSpeech, rawArtifactOnly = false }) {
  if (rawArtifactOnly) {
    return { available: false, reason: 'This input is code or terminal output without an explanation, so there is no teaching to judge. Questions are still generated from it. Add a recording or notes that explain it to get a teaching score.' };
  }
  if (lecture.units.length < 3 || totalWords < 300) {
    return { available: false, reason: `The input is too short (${totalWords} words) to judge teaching quality fairly.` };
  }
  const r = await callJson({ systemPrompt: EVAL_SYSTEM, prompt: evalPrompt(lecture), maxTokens: 4096, operation: 'TEACHING_SCORE' });
  usage.calls++; usage.providers.add(`${r.provider}:${r.model}`);
  const validIds = new Set([...lecture.units.map(u => u.id), ...lecture.observations.map(o => o.id)]);
  const byId = Object.fromEntries([...lecture.units, ...lecture.observations].map(x => [x.id, x]));

  const dims = TEACHING_DIMENSIONS.map(d => {
    const got = (r.data.dimensions || []).find(x => x && x.key === d.key) || {};
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
    return {
      key: d.key,
      label: d.label,
      question: d.question,
      rating,
      score: rating ? rating * 25 : null,
      levelDescription: rating ? d.levels[rating] : null,
      finding: assessable ? String(got.finding || '').trim() : 'Not enough evidence in this input to judge this.',
      improvement: assessable && rating < 4 && got.improvement ? String(got.improvement).trim() : null,
      evidence
    };
  });

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
    strengths: (r.data.strengths || []).filter(s => typeof s === 'string').slice(0, 3),
    improvements: (r.data.improvements || []).filter(s => typeof s === 'string').slice(0, 3),
    reviewModel: r.model,
    caveat: 'This reflects the evidence in this one input, judged against a fixed rubric. It is a feedback aid, not a measure of a teacher\'s overall ability.'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Allocation + teaching units for generation
// ─────────────────────────────────────────────────────────────────────────────

/** Same unit, or near-identical teaching point (one subtopic's key words contained in the other's, or very similar statements). */
function sameTeachingPoint(a, b) {
  if (a.id === b.id) return true;
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

  // 1. Difficulty mix
  let byDiff;
  let filledFromOtherTiers = 0;
  if (diffKey === 'balanced') {
    byDiff = allocate(n, { easy: cap.easy, medium: cap.medium, hard: cap.hard }, cap);
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

  // 2. Per difficulty, spread across topics by capacity and teaching time
  const totalShare = model.topics.reduce((s, t) => s + (t.share || 0), 0) || 1;
  const selected = [];
  const reserves = [];
  const byTopic = {};
  for (const d of ['easy', 'medium', 'hard']) {
    const want = byDiff[d];
    const pools = {};
    for (const t of model.topics) {
      pools[t.name] = model.units
        .filter(u => u.topic === t.name)
        .flatMap(u => u.angles.filter(a => a.difficulty === d).map((a, ai) => ({ unit: u, angle: a, rank: ai })));
      // Different units first, then second angles of the same unit
      pools[t.name].sort((a, b) => a.rank - b.rank || (a.unit.depth === 'MENTIONED') - (b.unit.depth === 'MENTIONED'));
    }
    const caps = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));
    const weights = Object.fromEntries(model.topics.map(t => {
      const capShare = caps[t.name] / Math.max(1, Object.values(caps).reduce((s, x) => s + x, 0));
      const timeShare = (t.share || 0) / totalShare;
      return [t.name, 0.5 * capShare + 0.5 * timeShare + 1e-6];
    }));
    const alloc = want > 0 ? allocate(want, weights, caps) : {};
    for (const [topic, pool] of Object.entries(pools)) {
      const k = alloc[topic] || 0;
      // Diversity first: skip a point that was already assessed (same unit, or the same command/idea
      // taught twice, e.g. explained and later demonstrated) while other points are still available.
      const chosen = [];
      const rest = [];
      for (const p of pool) {
        if (chosen.length < k && !selected.some(s => sameTeachingPoint(s.unit, p.unit))) {
          chosen.push(p); selected.push({ ...p, difficulty: d });
        } else rest.push(p);
      }
      while (chosen.length < k && rest.length) {
        const p = rest.shift(); chosen.push(p); selected.push({ ...p, difficulty: d });
      }
      rest.forEach(p => reserves.push({ ...p, difficulty: d }));
      if (k) byTopic[topic] = (byTopic[topic] || 0) + k;
    }
  }
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
  if (excluded.size) reasons.push(`Left out at your request: ${[...excluded].join(', ')}.`);
  // Keep only reserves of the difficulties actually requested
  const wanted = new Set(Object.entries(byDiff).filter(([, v]) => v > 0).map(([k]) => k));
  return {
    requested: n,
    difficulty,
    deliverable,
    byDifficulty: byDiff,
    byTopic: Object.entries(byTopic).map(([topic, count]) => ({ topic, count })),
    selected,
    reserves: reserves.filter(r => wanted.has(r.difficulty)),
    shortfall: Math.max(0, shortfall),
    filledFromOtherTiers,
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
function toTeachingUnits(model, plan) {
  const blockMap = Object.fromEntries((model.blocks || []).map(b => [b.id, b]));
  const make = (p, i, isReserve) => {
    const u = p.unit;
    const a = p.angle;
    const passage = u.blocks.map(id => blockMap[id] && blockMap[id].text).filter(Boolean).join('\n').slice(0, 1100);
    const tier = p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1);
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
      lectureMisconceptions: u.misconceptions || [],
      lectureUnitId: u.id,
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
      time: u.time, slides: u.slides, statement: u.statement, quote: u.quote, angles: u.angles
    }))
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
  return readCache(id);
}

module.exports = {
  MODEL_VERSION,
  MAX_QUIZ_QUESTIONS,
  TEACHING_DIMENSIONS,
  buildLectureModel,
  buildTopicModel,
  planRequest,
  toTeachingUnits,
  toClientPayload,
  getById,
  // exported for tests
  _internal: { buildBlocks, buildWindows, quoteSupported, sanitiseAngles, computeCapacity, allocate, buildSegments, consolidateUnits, callJson }
};
