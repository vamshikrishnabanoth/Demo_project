'use strict';
/**
 * Hard question forms.
 *
 * A Hard question needs at least two dependent reasoning steps on something new. There are many ways to build
 * that, and which ones fit depends on what the teacher actually taught: a code walkthrough supports tracing,
 * debugging and working backwards from an output; a formula supports a calculation that ends in a decision or a
 * worked solution with one wrong step; an explained mechanism supports "what changes if…" and diagnosing a
 * symptom; a comparison supports choosing under constraints; an idea taught with an example supports transfer to
 * an unfamiliar setting. Combining two linked points is one form among these, not the definition of Hard.
 *
 * Each teaching point gets the forms its content supports (ordered by fit). The planner spreads forms across a
 * quiz so the Hard questions are varied, and a replacement for a rejected Hard question tries a different form.
 * Everything here is derived from the lecture reading at planning time (no extra model calls, works on cached
 * readings).
 */

const HARD_FORMS = {
  trace: {
    label: 'Follow it through',
    recipe: 'give an initial state or input and a sequence of at least three operations/steps (or a short code fragment whose result depends on several interacting lines) in the stem, and ask for the final state or output, the step at which something specific happens, or a decision that depends on that state. Distractors are the results after a skipped, reordered or off-by-one step.'
  },
  calculate_decide: {
    label: 'Calculate, then decide',
    recipe: 'put all the numbers/vectors/matrices in the stem and ask for a DECISION or INTERPRETATION that depends on at least two dependent computations with the taught method (compute, then compare with a threshold/critical value and decide; compute every value, then pick the one that satisfies the taught condition). Options are decisions with their supporting value; distractors come from a wrong intermediate step or a wrong comparison. Plugging numbers into one formula is NOT Hard. Put any table value or constant the student needs in the stem.'
  },
  predict_change: {
    label: 'What changes if…',
    recipe: 'take the situation, code or process as taught and change ONE condition the teacher did not change (remove a step, change a parameter, an input, a line, an order, a constraint). Ask for the eventual consequence. Reaching it must take at least two links of the taught mechanism: the change causes an intermediate effect, which causes the outcome asked about. Example of the depth wanted: "if attention scores were not divided by the square root of d_k, what would happen when training with large d_k?" (larger dot products, then a saturated softmax, then vanishing gradients). The options are outcomes, not definitions; the distractors stop at the first link (only "the scores get larger"), reverse the direction, or assume nothing changes. No numbers are needed; the chain of reasoning is what makes it Hard.'
  },
  why_design: {
    label: 'Why is it built this way?',
    recipe: 'ask why the taught method includes a specific step, setting or design choice (a scaling, a mask, a buffer, a sorting step, a base case, a check), by asking what would go wrong without it. The student must reason through the mechanism to the failure it prevents (at least two links: without it, X happens, which leads to Y). The key names the actual failure prevented; distractors name a real but different property of the method, a benefit the step does not provide, or only the first link of the chain. Do not ask for the definition of the step.'
  },
  diagnose: {
    label: 'Work back from a symptom',
    recipe: 'describe a concrete observed symptom (a wrong output, an error, a failure, an unexpected value or state) in a situation built from what was taught, with the relevant details (code, settings, values) in the stem, and ask for its cause or the fix. The student must reason backwards from the symptom through the taught mechanism to the cause. Each distractor is a plausible cause that would produce a different, nearby symptom.'
  },
  reverse: {
    label: 'Work backwards',
    recipe: 'give the final result (an output, a final state, a computed value) and ask which input, setting or step must have produced it. The student must run or invert the taught procedure for the candidates. Distractors are inputs that produce near-miss results (one step off, a boundary value, a swapped order).'
  },
  spot_flaw: {
    label: 'Find the wrong step',
    recipe: 'show a short worked solution (3-5 numbered steps) to a problem like the one taught, as a student wrote it, with exactly ONE subtle wrong step that follows a likely misconception. Ask which step is wrong and what it should be (each option names a step and its corrected version). The student must check every step against the taught method; the other steps must be fully correct.'
  },
  choose_constraints: {
    label: 'Choose under constraints',
    recipe: 'give a concrete situation with two or three explicit requirements or constraints (sizes, time or memory limits, guarantees needed, costs) and ask which of the taught approaches or settings fits best. The student must check each option\'s taught properties against every constraint; each distractor satisfies some constraints but fails exactly one.'
  },
  transfer: {
    label: 'Same idea, new setting',
    recipe: 'set the question in an unfamiliar context that does not use the lecture\'s example or its key terms (a different system, domain or everyday situation) where the taught idea governs what happens. The student must first recognise which taught idea applies and then apply it to predict or decide the outcome. Do not name the taught idea in the stem. Distractors come from applying a different taught idea, or applying the right one incorrectly.'
  },
  boundary: {
    label: 'At the boundary',
    recipe: 'give a concrete boundary situation (exact values or state: empty, one element, equal values, the limit of a range, a tie, a missing condition) where the usual behaviour changes, and ask what happens. Deciding must take two taught rules together (the general rule and the condition under which it changes); not a definition of the boundary.'
  },
  link: {
    label: 'Connect two taught points',
    recipe: 'combine this point with the RELATED POINT given in the evidence (both taught in this lecture): reaching the answer must need a result from one and a rule from the other, so neither point alone is enough. Give the concrete data, code or situation in the stem.'
  }
};

const FORM_IDS = Object.keys(HARD_FORMS);

// Forms each kind of teaching point supports, best fit first.
const BY_KIND = {
  CODE: ['trace', 'why_design', 'predict_change', 'diagnose', 'reverse', 'spot_flaw', 'boundary'],
  COMMAND: ['trace', 'diagnose', 'predict_change', 'reverse', 'boundary'],
  ALGORITHM_TRACE: ['trace', 'reverse', 'why_design', 'spot_flaw', 'predict_change', 'boundary'],
  CALCULATION: ['calculate_decide', 'reverse', 'spot_flaw', 'predict_change'],
  MECHANISM: ['why_design', 'predict_change', 'diagnose', 'transfer', 'boundary'],
  COMPARISON: ['choose_constraints', 'why_design', 'predict_change', 'transfer'],
  EDGE_CASE: ['boundary', 'predict_change', 'diagnose'],
  APPLICATION: ['transfer', 'choose_constraints', 'diagnose'],
  EXAMPLE: ['transfer', 'spot_flaw', 'predict_change'],
  DEFINITION: ['transfer']
};

// The reader's own Hard angle is a strong hint about the best form.
const ANGLE_HINT = { debug: 'diagnose', edge_case: 'boundary', calculation: 'calculate_decide', trace: 'trace', output: 'trace' };
// Forms that need a worked procedure on screen or in speech (not just an explanation).
const NEEDS_DEMONSTRATION = new Set(['spot_flaw', 'reverse']);

/** The closest other teaching point of the same topic that can be combined with `unit` (or null). */
function linkedUnit(unit, model, isSamePoint) {
  const units = (model && model.units) || [];
  const at = units.findIndex(u => u.id === unit.id);
  let best = null, bestGap = Infinity;
  units.forEach((u, i) => {
    if (u.id === unit.id || u.topic !== unit.topic || u.importance === 'ASIDE' || u.depth === 'MENTIONED') return;
    if (isSamePoint && isSamePoint(u, unit)) return;
    const gap = Math.abs(i - at);
    if (gap < bestGap) { best = u; bestGap = gap; }
  });
  return best;
}

/** Ordered Hard forms this teaching point supports. */
function formsFor(unit, model, opts = {}) {
  if (!unit || unit.depth === 'MENTIONED' || unit.importance === 'ASIDE') return [];
  let forms = (BY_KIND[unit.kind] || ['predict_change', 'transfer']).slice();
  // A point taught with code is best tested on that code; a formula supports a calculation right after the
  // kind's own best form; both also allow working backwards.
  if (unit.hasCode) forms.unshift('trace', 'diagnose');
  if (unit.hasFormula) forms.splice(1, 0, 'calculate_decide');
  if (unit.hasCode || unit.hasFormula) forms.push('reverse');
  if (unit.depth !== 'DEMONSTRATED') forms = forms.filter(f => !NEEDS_DEMONSTRATION.has(f) || unit.hasFormula || unit.hasCode);
  const hardAngle = (unit.angles || []).find(a => a.difficulty === 'hard');
  const hint = hardAngle && ANGLE_HINT[hardAngle.type];
  if (hint) forms.unshift(hint);
  if (linkedUnit(unit, model, opts.isSamePoint)) forms.push('link');
  return [...new Set(forms)].filter(f => HARD_FORMS[f]);
}

/**
 * Assign a form to every Hard pick: each pick takes a well-fitting form, preferring ones used less in the quiz so
 * far, so a Hard-heavy quiz mixes tracing, what-if, diagnosis, transfer… as the lecture allows.
 * `used`: forms already in the quiz; `avoid`: { unitId, form } pairs not to repeat (a rejected attempt).
 */
function assignForms(picks, model, { used = [], avoid = [], isSamePoint } = {}) {
  const count = {};
  used.filter(Boolean).forEach(f => { count[f] = (count[f] || 0) + 1; });
  for (const p of picks) {
    if (p.difficulty !== 'hard') continue;
    const forms = formsFor(p.unit, model, { isSamePoint })
      .filter(f => !avoid.some(a => a && a.form === f && (!a.unitId || a.unitId === p.unit.id)));
    if (!forms.length) continue;
    let best = forms[0], bestScore = Infinity;
    forms.forEach((f, rank) => {
      // Fit first, variety second: a form used once already loses to the 2nd or 3rd best fit, never to a poor fit.
      const s = (count[f] || 0) * 25 + rank * 10;
      if (s < bestScore) { bestScore = s; best = f; }
    });
    p.hardForm = best;
    if (best === 'link') {
      const other = linkedUnit(p.unit, model, isSamePoint);
      p.linkedUnitId = other ? other.id : null;
    }
    count[best] = (count[best] || 0) + 1;
  }
  return picks;
}

/** Which Hard forms a lecture supports overall (for the teacher view and the paper). */
function profile(model, opts = {}) {
  const by = {};
  for (const u of (model && model.units) || []) {
    if (!(u.angles || []).some(a => a.difficulty === 'hard')) continue;
    for (const f of formsFor(u, model, opts)) by[f] = (by[f] || 0) + 1;
  }
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([form, points]) => ({ form, label: HARD_FORMS[form].label, points }));
}

module.exports = { HARD_FORMS, FORM_IDS, formsFor, assignForms, linkedUnit, profile };
