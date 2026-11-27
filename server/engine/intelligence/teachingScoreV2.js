/**
 * server/engine/intelligence/teachingScoreV2.js — teaching report v2 (C6).
 *
 * v1 asked a model to grade the teacher on a rubric. Its validity test failed (22 Nov 2026): a teacher who only read
 * the PDF scored 92, and 18 planted technical errors left the score at 96, because the grader saw paraphrased points and
 * graded leniently. v2 grades nothing by opinion: every mark is computed from measured facts of the lecture reading
 * (depth, examples, material use, pace, interaction, focus, assessable points), and accuracy comes from checking the
 * teacher's own VERBATIM quotes on core points. Each mark carries its reason and evidence.
 *
 * A component that cannot be measured for this input (e.g. no material uploaded) is left out and the total is rescaled,
 * so a teacher is never marked down for something the input could not show.
 */
'use strict';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x) => Math.round(x * 10) / 10;

function taughtUnits(lm) {
  // What the teacher taught in class: spoken points, and material points she also explained (source BOTH).
  return (lm.units || []).filter(u => u.source === 'SPOKEN' || u.source === 'BOTH' || (!u.source && u.depth));
}

/** Measured components (no model call). */
function measure(lm) {
  const units = taughtUnits(lm);
  const allUnits = lm.units || [];
  const minutes = Math.max(1, (Number(lm.durationSec) || 0) / 60);
  const comps = [];
  const w = (u) => Number(u.importanceScore) || (u.role === 'CORE' ? 3 : u.role === 'SUPPORTING' ? 2 : 1);

  // 1. Depth.
  const depthVal = { DEMONSTRATED: 1, EXPLAINED: 0.75, MENTIONED: 0.25 };
  const wsum = units.reduce((s, u) => s + w(u), 0) || 1;
  const depth = units.reduce((s, u) => s + w(u) * (depthVal[u.depth] ?? 0.5), 0) / wsum;
  const n = (d) => units.filter(u => u.depth === d).length;
  comps.push({ id: 'depth', label: 'Depth of teaching', max: 20, score: round(20 * depth),
    reason: `${n('DEMONSTRATED')} points demonstrated, ${n('EXPLAINED')} explained, ${n('MENTIONED')} only mentioned (weighted by importance).`,
    evidence: units.filter(u => u.depth === 'DEMONSTRATED').slice(0, 2).map(u => ({ time: u.time || null, quote: String(u.quote || u.statement || '').slice(0, 160) })) });

  // 2. Examples and practice.
  const withEx = units.filter(u => u.teacherExample || u.hasCode || (u.hasFormula && u.depth === 'DEMONSTRATED'));
  const exShare = units.length ? withEx.length / units.length : 0;
  comps.push({ id: 'examples', label: 'Examples and worked practice', max: 20, score: round(20 * clamp01(exShare / 0.6)),
    reason: `${withEx.length} of ${units.length} taught points came with an example, worked problem or code (full marks at 60%).`,
    evidence: withEx.slice(0, 2).map(u => ({ time: u.time || null, quote: String(u.teacherExample || u.quote || '').slice(0, 160) })) });

  // 3. Material used (only when material was uploaded).
  const both = allUnits.filter(u => u.source === 'BOTH').length;
  const matOnly = allUnits.filter(u => u.source === 'MATERIAL').length;
  if (both + matOnly > 0 && allUnits.some(u => u.source === 'SPOKEN' || u.source === 'BOTH')) {
    const share = both / (both + matOnly);
    comps.push({ id: 'material', label: 'Use of the uploaded material', max: 15, score: round(15 * clamp01(share / 0.6)),
      reason: `${both} of ${both + matOnly} points in the uploaded material were also explained in class (full marks at 60%)${share === 0 ? '; the material does not match what was taught' : ''}.`,
      evidence: [] });
  }

  // 4. Structure and clarity (four measured parts, 5 each).
  const spokenWords = Number(lm.wordCount) || 0;
  const wpm = lm.hasTiming && lm.durationSec ? spokenWords / minutes : null;
  const pace = wpm == null ? null : (wpm >= 100 && wpm <= 180 ? 1 : wpm < 100 ? clamp01(wpm / 100) : clamp01(1 - (wpm - 180) / 120));
  const style = lm.teachingStyle || {};
  const interaction = clamp01((Number(style.interaction) || 0) / 1);
  const stressed = allUnits.filter(u => u.stressed).length;
  const emphasis = clamp01(Math.max(stressed / 3, (Number(style.emphasis) || 0) / 1));
  const coreShare = units.length ? units.filter(u => u.role === 'CORE' || u.role === 'SUPPORTING').length / units.length : 0;
  const parts = [pace, interaction, emphasis, clamp01(coreShare / 0.7)].filter(x => x != null);
  comps.push({ id: 'structure', label: 'Structure and clarity', max: 20, score: round(20 * parts.reduce((s, x) => s + x, 0) / parts.length),
    reason: [wpm != null ? `pace ${Math.round(wpm)} words/min${pace === 1 ? ' (in range)' : ''}` : 'pace not measurable (no timing)',
      `questions to the class ${Number(style.interaction || 0).toFixed(2)}`, `${stressed} stressed or recapped points`,
      `${Math.round(coreShare * 100)}% of the time on core/supporting points`].join('; ') + '.',
    evidence: allUnits.filter(u => u.stressed && u.stressQuote).slice(0, 2).map(u => ({ time: u.time || null, quote: String(u.stressQuote).slice(0, 160) })) });

  // 5. Assessable content.
  const rec = lm.capacity && lm.capacity.recommended ? Number(lm.capacity.recommended.balanced) || 0 : units.length;
  const per10 = rec / (minutes / 10);
  comps.push({ id: 'assessable', label: 'Assessable content', max: 10, score: round(10 * clamp01(per10 / 3)),
    reason: `${rec} distinct points a quiz can test, ${per10.toFixed(1)} per 10 minutes (full marks at 3).`, evidence: [] });
  return comps;
}

/** Accuracy: the teacher's verbatim quotes on core points, checked in parallel batches; each clearly wrong one deducts 5 of 15. */
async function accuracy(lm, deps = {}) {
  // Every core point can hold a mistake, so all core quotes are checked (up to 42), not only the most important ones.
  const core = taughtUnits(lm).filter(u => (u.role === 'CORE' || !u.role) && String(u.quote || '').split(/\s+/).length >= 6)
    .slice(0, parseInt(process.env.TEACHING_CHECK_QUOTES, 10) || 42);
  if (!core.length) return null;
  const callJson = deps.callJson || require('./lectureModel')._internal.callJson;
  const BATCH = 14;
  const batches = [];
  for (let i = 0; i < core.length; i += BATCH) batches.push(core.slice(i, i + BATCH));
  // Small key pools (lean mode): one batch, so the report does not wait on rate limits.
  if (require('../utils/capacityMode').isLean() && !deps.callJson) batches.splice(1);
  const LIMIT_MS = parseInt(process.env.TEACHING_CHECK_TIMEOUT_MS, 10) || 25000;
  const wrong = []; let model = null; let failed = 0;
  await Promise.all(batches.map(async (b) => {
    const list = b.map((u, i) => `S${i + 1} [${u.topic || ''} / ${u.subtopic || ''}]: "${String(u.quote).slice(0, 400)}"`).join('\n');
    try {
      const res = await Promise.race([callJson({
        systemPrompt: 'You are a subject expert checking statements a teacher said in class. Return JSON only.',
        prompt: `${list}\n\nThese are verbatim quotes from a classroom lecture (speech recognition may misspell words: ignore spelling, grammar and filler). For each, decide whether the teacher stated something technically WRONG for this subject (a false fact, rule, value, or reversed relation). Simplifications for beginners are not wrong. Return {"checks":[{"s":1,"wrong":false,"why":"","correct":""}]}`,
        maxTokens: 3000, operation: 'TEACHING_SCORE'
      }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), LIMIT_MS))]);
      model = res.model || model;
      const checks = Array.isArray(res && res.data && res.data.checks) ? res.data.checks : [];
      checks.filter(c => c && c.wrong === true).forEach(c => { const u = b[Number(c.s) - 1]; if (u) wrong.push({ time: u.time || null, quote: String(u.quote).slice(0, 200), why: String(c.why || '').slice(0, 200), correct: String(c.correct || '').slice(0, 200) }); });
    } catch (_) { failed++; }
  }));
  if (failed === batches.length) return { unavailable: 'claim check service unavailable' };
  return { checked: core.length - (failed ? Math.round(core.length * failed / batches.length) : 0), model, wrong };
}

/**
 * @returns {Promise<{available, overall, components, method, notes}>}
 */
async function teachingReport(lm, deps = {}) {
  if (!lm || !lm.ok) return { available: false, reason: 'No lecture reading.' };
  if (lm.isTopicNotes) return { available: false, reason: 'A topic name has no lecture to judge; the teaching report needs the class itself.' };
  if (lm.calibration && lm.calibration.teachable === false) return { available: false, reason: 'This input does not teach a subject.' };
  if (!(lm.units || []).length) return { available: false, reason: 'No teaching points were read from this input.' };
  if (!taughtUnits(lm).length) return { available: false, reason: 'The input has no teaching by the teacher (only material); upload the lecture recording or transcript for a teaching report.' };
  const components = measure(lm);
  const acc = await accuracy(lm, deps);
  if (acc && !acc.unavailable) {
    components.push({ id: 'accuracy', label: 'Accuracy of what was taught', max: 15, score: Math.max(0, 15 - 5 * acc.wrong.length),
      reason: acc.wrong.length ? `${acc.wrong.length} of ${acc.checked} core statements checked look technically wrong.` : `${acc.checked} core statements checked; none found wrong.`,
      evidence: acc.wrong.map(w => ({ time: w.time, quote: w.quote, note: `${w.why}${w.correct ? ` Correct: ${w.correct}` : ''}` })), model: acc.model });
  }
  const max = components.reduce((s, c) => s + c.max, 0);
  const got = components.reduce((s, c) => s + c.score, 0);
  return {
    available: true, version: 'teaching-v2', overall: Math.round(100 * got / max),
    method: 'Sum of measured components (each mark computed from the lecture reading, with its reason and evidence), rescaled to 100 over the components this input allows. Accuracy checks the teacher\'s own verbatim quotes.',
    components, notes: [acc && acc.unavailable ? `Accuracy not checked now (${String(acc.unavailable).slice(0, 80)}).` : null, components.some(c => c.id === 'material') ? null : 'No uploaded material: material use not scored.'].filter(Boolean)
  };
}

module.exports = { teachingReport, measure, accuracy };

/** The report in the shape the teacher's screen shows (score, rated rows with reason and quoted evidence, keep/try). */
const TIPS = {
  depth: 'Pick one or two core points and demonstrate them step by step (trace, example run, worked case) instead of only naming them.',
  examples: 'Give a concrete example or a short worked problem for each core point.',
  material: 'Walk through the uploaded material in class, or upload the material you actually taught from.',
  structure: 'Ask the class a question every few minutes, and recap the core points before moving on.',
  assessable: 'Cover a few more distinct points, or go deeper into each, so a quiz can check understanding.',
  accuracy: 'Re-check the quoted statements; correct them in the next class.'
};
function toClientShape(r) {
  if (!r || !r.available) return { available: false, reason: (r && r.reason) || 'No teaching report for this input.', version: 'teaching-v2' };
  const rows = r.components.map(c => ({
    key: c.id, label: c.label, rating: Math.max(1, Math.min(4, 1 + Math.round(3 * c.score / c.max))), score: c.score, max: c.max,
    finding: `${c.score} of ${c.max}: ${c.reason}`,
    evidence: (c.evidence || []).map(e => ({ where: e.time || null, quote: e.quote, note: e.note || null })),
    improvement: c.score / c.max < 0.7 ? TIPS[c.id] : null
  }));
  const ratio = (c) => c.score / c.max;
  const sorted = [...r.components].sort((a, b) => ratio(b) - ratio(a));
  const hasAcc = r.components.some(c => c.id === 'accuracy');
  return {
    available: true, version: 'teaching-v2', overall: r.overall,
    confidence: hasAcc && r.components.length >= 5 ? 'HIGH' : 'MEDIUM',
    confidenceReason: `${r.components.length} measured components${hasAcc ? ', accuracy checked on the teacher\'s own words' : ', accuracy not checked'}`,
    dimensions: rows,
    strengths: sorted.filter(c => ratio(c) >= 0.8).slice(0, 2).map(c => `${c.label}: ${c.reason}`),
    improvements: sorted.slice().reverse().filter(c => ratio(c) < 0.7).slice(0, 2).map(c => TIPS[c.id]),
    method: r.method, caveat: (r.notes || []).join(' ')
  };
}

module.exports.toClientShape = toClientShape;
