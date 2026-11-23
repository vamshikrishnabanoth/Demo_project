/**
 * Teaching style profile (PDI v2: Pedagogical Delivery Index, style based).
 *
 * The same topic can be taught in very different ways: a theory class, a live notebook walkthrough, worked
 * problems, a class built on examples, or a quick revision. Each needs different questions. This module
 *   1. labels every part of the lecture with how it was taught (the label comes from the lecture reader, which
 *      already reads every block; a deterministic fallback from the unit kind is used for older readings),
 *   2. measures how closely the teacher followed the slides (word-trigram overlap between speech and material,
 *      no AI call),
 *   3. turns both into a soft question-type preference and a short note for the question writer, per teaching
 *      point. Variety, difficulty and every quality check stay exactly as they are.
 *
 * The teacher can correct the profile; the correction replaces the detected modes for that request.
 * The original input-based PDI (pdiRouter.js) is kept as the baseline it is compared against.
 */

'use strict';

const DELIVERY_MODES = ['CONCEPTUAL', 'CODE', 'NUMERICAL', 'EXAMPLE', 'REVISION'];

const MODE_LABEL = {
  CONCEPTUAL: 'Concept explanation',
  CODE: 'Code walkthrough',
  NUMERICAL: 'Worked problems',
  EXAMPLE: 'Teaching through examples',
  REVISION: 'Quick revision'
};

// Question types each way of teaching calls for, strongest first. A preference only: it reorders the
// opportunities the lecture already supports and never adds a type the content does not support.
const MODE_PREFER = {
  CONCEPTUAL: ['concept', 'comparison', 'mechanism', 'application'],
  CODE: ['output', 'trace', 'debug', 'edge_case'],
  NUMERICAL: ['calculation', 'trace', 'edge_case', 'application'],
  EXAMPLE: ['application', 'scenario', 'concept', 'comparison'],
  REVISION: ['recall', 'concept', 'comparison']
};

const MODE_NOTE = {
  CONCEPTUAL: 'This part was taught as concept explanation: ask about meaning, differences and why something holds; build wrong options from near-miss definitions and confusions with related ideas from this lecture.',
  CODE: 'This part was taught by walking through code or commands live: where the passage shows code, ask what it outputs, what a specific line does, or what changes if one line is changed, and quote the code exactly.',
  NUMERICAL: 'This part was taught through worked problems: ask the student to carry out the same procedure on the teacher\'s numbers or a close variant; build wrong options from the results of typical slips (a skipped step, a swapped value, an off-by-one).',
  EXAMPLE: 'This part was taught through examples: build the question around the teacher\'s own example or a close variant of it, not a textbook example.',
  REVISION: 'This part was a quick revision: ask a direct, exam-style question on the key fact or distinction, with a short stem.'
};

const SLIDE_USE = ['READS', 'OUTLINE', 'BEYOND', 'NO_MATERIAL'];
const SLIDE_USE_LABEL = {
  READS: 'Followed the slides closely',
  OUTLINE: 'Used the slides as an outline',
  BEYOND: 'Explained well beyond the slides',
  NO_MATERIAL: 'Taught without slides'
};
const SLIDE_USE_NOTE = {
  READS: 'Students saw these slides read out: keep the terms and definitions in the slide wording.',
  OUTLINE: null,
  BEYOND: 'The teacher explained well beyond the slides: use the spoken explanation and the teacher\'s own examples rather than slide or textbook phrasing.',
  NO_MATERIAL: 'The teacher taught without slides: use the teacher\'s own explanation and examples rather than textbook phrasing.'
};
// Share of spoken word-trigrams also found in the material. Reading slides aloud repeats their phrases; an
// outline shares some terms; explaining beyond the slides shares few. Calibrated on lectures labelled by hand.
const READS_AT = Number(process.env.SLIDE_READS_AT) || 0.18;
const OUTLINE_AT = Number(process.env.SLIDE_OUTLINE_AT) || 0.06;

const DIALOGUE_CUES = [/\bany questions\b/gi, /\byes sir\b/gi, /\byes ma'?am\b/gi, /\bright\?/gi, /\bgot it\b/gi, /\bwho can tell\b/gi, /\bwhat happens if\b/gi, /\bwhy is that\b/gi, /\bdo you agree\b/gi, /\bwhat do you think\b/gi];
const EMPHASIS_CUES = [/\bremember\b/gi, /\bimportant\b/gi, /\bnote that\b/gi, /\bpay attention\b/gi, /\bkey point\b/gi, /\bmistake\b/gi, /\bdon'?t forget\b/gi, /\bexam\b/gi, /\bcareful\b/gi];

const STOP = new Set('the a an of to in is are and or for with by on as at it its this that be from which what when how why not no does do into than then so we you i they he she our your will can this these those there here just like okay ok um uh yeah'.split(' '));

function normMode(m) {
  const v = String(m || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (DELIVERY_MODES.includes(v)) return v;
  if (/^(THEORY|CONCEPT)/.test(v)) return 'CONCEPTUAL';
  if (/^(DEMO|LAB|PRACTICAL|NOTEBOOK)/.test(v)) return 'CODE';
  if (/^(WORKED|PROBLEM|CALCULATION|DERIVATION)/.test(v)) return 'NUMERICAL';
  if (/^(RECAP|REVIEW|SUMMARY)/.test(v)) return 'REVISION';
  return null;
}

/** Fallback when the reader gave no label (older readings): how the point itself was taught. */
function modeFromKind(unit) {
  const k = String(unit && unit.kind || '').toUpperCase();
  if (['CODE', 'COMMAND', 'ALGORITHM_TRACE'].includes(k) || (unit && unit.hasCode)) return 'CODE';
  if (k === 'CALCULATION') return 'NUMERICAL';
  if (k === 'EXAMPLE' || k === 'APPLICATION') return 'EXAMPLE';
  return 'CONCEPTUAL';
}

function trigrams(text) {
  const w = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x && !STOP.has(x));
  const out = new Set();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

/** How closely the speech follows the material (null when one of them is missing). */
function slideReliance(blocks) {
  const speech = (blocks || []).filter(b => b.source === 'SPEECH').map(b => b.text).join(' ');
  const material = (blocks || []).filter(b => b.source !== 'SPEECH').map(b => b.text).join(' ');
  if (!speech.trim()) return null;
  if (material.trim().length < 200) return { label: 'NO_MATERIAL', overlap: 0, covered: 0 };
  const s = trigrams(speech); const m = trigrams(material);
  if (!s.size || !m.size) return { label: 'NO_MATERIAL', overlap: 0, covered: 0 };
  let shared = 0; s.forEach(t => { if (m.has(t)) shared++; });
  const overlap = shared / s.size;        // how much of what was said comes from the slides
  const covered = shared / m.size;        // how much of the slides was said
  const label = overlap >= READS_AT ? 'READS' : (overlap >= OUTLINE_AT ? 'OUTLINE' : 'BEYOND');
  return { label, overlap: +overlap.toFixed(3), covered: +covered.toFixed(3) };
}

/**
 * Slide use from the reading itself: of the points the teacher taught aloud, how many the reader linked to the
 * slides (BOTH) versus taught only in speech (SPOKEN). Robust to paraphrase and spoken code, which word overlap is
 * not, and to a recording that covers only part of the slide deck. Word overlap is kept as a secondary number.
 * Null when there is no speech or no material (the word-overlap function then decides NO_MATERIAL).
 */
const ALIGNED_READS_AT = Number(process.env.SLIDE_ALIGNED_READS_AT) || 0.7;
const ALIGNED_OUTLINE_AT = Number(process.env.SLIDE_ALIGNED_OUTLINE_AT) || 0.35;
function slideUseFromUnits(model) {
  const blocks = model.blocks || [];
  if (!blocks.some(b => b.source === 'SPEECH') || blocks.filter(b => b.source !== 'SPEECH').map(b => b.text).join(' ').trim().length < 200) return null;
  const core = (model.units || []).filter(u => u.importance !== 'ASIDE' && (u.source === 'BOTH' || u.source === 'SPOKEN'));
  if (core.length < 3) return null;
  const aligned = core.filter(u => u.source === 'BOTH').length / core.length;
  const lexical = slideReliance(blocks) || {};
  const label = aligned >= ALIGNED_READS_AT ? 'READS' : (aligned >= ALIGNED_OUTLINE_AT ? 'OUTLINE' : 'BEYOND');
  return { label, aligned: +aligned.toFixed(3), spokenPoints: core.length, overlap: lexical.overlap ?? null, covered: lexical.covered ?? null, basis: 'reading' };
}

function cueDensity(text, cues, words) {
  const n = cues.reduce((c, re) => c + ((String(text).match(re) || []).length), 0);
  return +((n / Math.max(1, words)) * 1000).toFixed(2);
}

/**
 * Label each unit with the way its part of the lecture was taught: the label of the lecture part (segment) it
 * belongs to, else the reader's own label on the unit, else the fallback from its kind.
 */
function assignUnitModes(model) {
  const bySeg = new Map();
  (model.segments || []).forEach(s => { const m = normMode(s.delivery); if (m) (s.unitIds || []).forEach(id => { if (!bySeg.has(id)) bySeg.set(id, m); }); });
  (model.units || []).forEach(u => {
    const fromSeg = bySeg.get(u.id);
    const own = normMode(u.delivery);
    u.delivery = fromSeg || own || modeFromKind(u);
    u.deliverySource = fromSeg ? 'reader' : (own ? 'reader-unit' : 'kind');
  });
}

/** Lecture-level profile: share of teaching time per mode, slide use, interaction and emphasis. */
function buildProfile(model) {
  if (!model || !Array.isArray(model.units)) return null;
  assignUnitModes(model);
  const mixRaw = Object.fromEntries(DELIVERY_MODES.map(m => [m, 0]));
  const timedSegs = (model.segments || []).filter(s => s.start != null && s.end != null && s.end > s.start);
  let basis = 'units';
  if (timedSegs.length && timedSegs.some(s => normMode(s.delivery))) {
    basis = 'time';
    timedSegs.forEach(s => {
      const m = normMode(s.delivery) || (() => {
        const us = (model.units || []).filter(u => (s.unitIds || []).includes(u.id));
        return us.length ? us[0].delivery : 'CONCEPTUAL';
      })();
      mixRaw[m] += s.end - s.start;
    });
  } else {
    model.units.filter(u => u.importance !== 'ASIDE').forEach(u => { mixRaw[u.delivery] += 1; });
  }
  const total = Object.values(mixRaw).reduce((a, b) => a + b, 0) || 1;
  const mix = Object.fromEntries(DELIVERY_MODES.map(m => [m, Math.round((mixRaw[m] / total) * 100)]).filter(([, v]) => v > 0));
  const ranked = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  const speechText = (model.blocks || []).filter(b => b.source === 'SPEECH').map(b => b.text).join(' ');
  const words = speechText.split(/\s+/).filter(Boolean).length;
  const slides = slideUseFromUnits(model) || slideReliance(model.blocks || []);
  return {
    version: 'pdi-v2-style',
    mix,
    dominant: ranked.length ? ranked[0][0] : 'CONCEPTUAL',
    basis,
    slideUse: slides,
    interaction: words ? cueDensity(speechText, DIALOGUE_CUES, words) : null,
    emphasis: words ? cueDensity(speechText, EMPHASIS_CUES, words) : null,
    unitsFromReader: model.units.filter(u => u.deliverySource !== 'kind').length,
    unitsTotal: model.units.length
  };
}

/** Human-readable one-liner, e.g. "Concept explanation 60% · Code walkthrough 40% · Explained well beyond the slides". */
function describeProfile(profile) {
  if (!profile) return '';
  const parts = Object.entries(profile.mix || {}).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 5).map(([m, v]) => `${MODE_LABEL[m]} ${v}%`);
  if (profile.slideUse && profile.slideUse.label) parts.push(SLIDE_USE_LABEL[profile.slideUse.label]);
  return parts.join(' · ');
}

/**
 * Sanitises a teacher correction: { modes: [...], slideUse: 'READS'|... }. Returns null when nothing usable.
 */
function normaliseOverride(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const modes = Array.from(new Set((Array.isArray(raw.modes) ? raw.modes : []).map(normMode).filter(Boolean)));
  const slideUse = SLIDE_USE.includes(String(raw.slideUse || '').toUpperCase()) ? String(raw.slideUse).toUpperCase() : null;
  if (!modes.length && !slideUse) return null;
  return { modes, slideUse };
}

/**
 * The mode used for one unit in this request. With a teacher correction, a unit whose detected mode the teacher
 * removed takes the corrected mode that fits its content best (its kind-based mode if selected, else the first).
 */
function unitMode(unit, override) {
  const detected = normMode(unit.delivery) || modeFromKind(unit);
  if (!override || !override.modes || !override.modes.length) return detected;
  if (override.modes.includes(detected)) return detected;
  const byKind = modeFromKind(unit);
  return override.modes.includes(byKind) ? byKind : override.modes[0];
}

function preferFor(unit, override) {
  return MODE_PREFER[unitMode(unit, override)] || null;
}

/** Note for the question writer about how this point was taught (plus the teacher's own example, if any). */
function noteFor(unit, profile, override) {
  const mode = unitMode(unit, override);
  const slide = (override && override.slideUse) || (profile && profile.slideUse && profile.slideUse.label) || null;
  const parts = [`Teaching style: ${MODE_NOTE[mode]}`];
  if (slide && SLIDE_USE_NOTE[slide]) parts.push(SLIDE_USE_NOTE[slide]);
  if (unit.teacherExample && String(unit.teacherExample).trim().length > 8) parts.push(`The teacher's own example for this point: ${String(unit.teacherExample).trim().slice(0, 300)}`);
  return parts.join(' ');
}

module.exports = {
  DELIVERY_MODES, MODE_LABEL, MODE_PREFER, SLIDE_USE, SLIDE_USE_LABEL,
  normMode, modeFromKind, slideReliance, assignUnitModes, buildProfile, describeProfile,
  normaliseOverride, unitMode, preferFor, noteFor
};
