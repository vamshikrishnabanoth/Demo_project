/**
 * The MCQ pipeline: ONE path for every input (lecture audio, audio + material, material only, or a topic name).
 *
 *   1. READ        quizController: speech -> timed transcript (Whisper; code-mixed speech translated to English),
 *                  PDFs / slides / photos / handwriting -> text (Gemini vision, OCR as backup), code and terminal text kept as is.
 *   2. UNDERSTAND  lectureModel.buildLectureModel: typed blocks -> speech-material linkage (when both exist) -> windows ->
 *                  teaching points with verbatim quotes (quote check) -> repeats merged -> lecture-wide calibration
 *                  (intent, what Easy/Medium/Hard mean for this class, each point's role) -> capacity.
 *                  A topic name alone -> reference notes (lectureModel.buildTopicModel), read the same way.
 *   3. PLAN        lectureModel.planRequest: lecture first (material-only points only for what the lecture cannot fill),
 *                  difficulty mix from the calibrated capacity, topics by capacity and teaching time, points by
 *                  importance, question type by how each point was taught, Hard form per point; reserves kept.
 *   4. WRITE       agent2Generator: each target with the teacher's passage for its point (the same passage the
 *                  checks use), the lecture's intent, what its difficulty means for this class, misconceptions for
 *                  distractors, the Hard recipe.                                                    <- this module
 *   5. CHECK EACH  agent3Evaluator: rule checks on every question; a question that fails one gets the critic and
 *                  one repair; a question that still fails is replaced by a reserve of the same difficulty.  <- this module
 *   6. ACCEPT      quizController: Final Quality Gate (13 criteria, with the lecture passage) next to a key-blind solve
 *                  by another model family; duplicates by meaning.
 *   7. REPLACE     quizController: rejected slots refilled from reserves, at most two rounds, each checked again.
 *   8. DELIVER     the questions and a notice saying what was delivered and why.
 *
 * Fallbacks (each is explicit and reported): a lecture that cannot be read -> the teacher is told to retry (no other
 * reader is substituted); calibration unavailable -> window difficulty labels stand (recorded on the model);
 * semantic linkage unavailable -> word-overlap linkage; a writer batch that fails -> its targets are written one by
 * one; a question that cannot pass -> replaced from reserves, and any shortfall is stated in the notice.
 */
const agent2Generator = require('../agents/agent2Generator');
const agent3Evaluator = require('../agents/agent3Evaluator');
const deterministicValidator = require('../validators/deterministicValidator');

const TIERS = ['Easy', 'Medium', 'Hard'];
// Step-5 findings that are wording heuristics; the gate (which sees the lecture passage) has the final say on these.
const SOFT_CHECKS = new Set(['AMBIGUOUS_DISTRACTOR', 'OPTION_VALIDATION_ERROR', 'DISTRACTOR_FORMAT_ASYMMETRY', 'DISTRACTOR_INSUFFICIENT_COGNITIVE_DEMAND', 'AMBIGUOUS_EQUIVALENT_OPTIONS', 'IMPLAUSIBLE_DISTRACTOR', 'STYLE_VIOLATION', 'UNNECESSARY_META_LANGUAGE']);

/** Runs async jobs with at most `limit` in flight (free-tier keys have small per-minute token budgets). */
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** How many write requests may run at once: about one per two Groq keys (at least 1, at most 4). */
function writeConcurrency() {
  if (process.env.WRITE_CONCURRENCY) return Math.max(1, parseInt(process.env.WRITE_CONCURRENCY, 10) || 1);
  const keys = Object.keys(process.env).filter(k => /^GROQ_(API_)?KEY/.test(k) && String(process.env[k] || '').length > 10).length;
  return Math.max(1, Math.min(4, Math.floor(keys / 2) || 1));
}

/** Step 3 -> 4: a planned point (lectureModel.toTeachingUnits) becomes a writing target. Order is kept (T01.., R01..). */
function toTarget(u, prefix, idx, requestedDifficulty) {
  const tier = TIERS.includes(u.plannedDifficulty) ? u.plannedDifficulty : 'Medium';
  return {
    targetId: `${prefix}${String(idx + 1).padStart(2, '0')}`,
    claimId: u.claimId,
    sequenceIndex: u.sequenceIndex || idx + 1,
    macroTopic: u.topic,
    subtopic: u.subtopic,
    concept: u.subtopic,
    learningObjective: u.statement,
    instruction: u.statement,
    specificReasoningTask: u.angleFocus || u.statement,
    statement: u.statement,
    teachingStyleNote: u.teachingStyleNote || null,
    // The planned question type decides the format: output/trace/debug questions must show code; a concept question
    // about a point that involved code may or may not (no format rule); points without code get prose questions.
    formatRecommendation: ['output', 'trace', 'debug'].includes(u.questionAngle) ? 'CODE_ANALYSIS' : (u.hasCode ? null : 'PROSE_MULTIPLE_CHOICE'),
    assessmentAngle: String(u.questionAngle || 'concept').toUpperCase(),
    questionAngle: u.questionAngle,
    hardForm: u.hardForm || null,
    hardFormRecipe: u.hardFormRecipe || null,
    timestamp: u.lectureTime || null,
    tier: 'Core',
    dimension: u.questionAngle || 'concept',
    cognitiveLevel: tier === 'Easy' ? 'Understand' : (tier === 'Medium' ? 'Apply' : 'Analyze'),
    targetDifficulty: tier,
    allocatedTier: tier,
    allowDifficultyRelabel: String(requestedDifficulty || 'Balanced').toLowerCase() === 'balanced',
    intendedCognitiveOperation: u.plannedOperation || 'EXPLAIN',
    distractorStrategy: 'LECTURE_MISCONCEPTIONS',
    distractorMisconceptions: (u.lectureMisconceptions || []).map(m => ({ concept: u.subtopic, description: m })),
    operationalGuidance: `Question focus: ${u.angleFocus || u.statement}`,
    evidenceType: u.provenance === 'VOICE_ONLY' ? 'VOICE' : 'SHARED',
    provenance: u.provenance,
    // The teacher's passage for this point: the only evidence the writer gets, and the same passage the checks use.
    supportingEvidence: u.transcriptExcerpt || u.statement || '',
    confidence: 'HIGH',
    sourceChunks: [],
    requiresExactArtifact: Boolean(u.hasCode || u.hasFormula),
    hasCode: Boolean(u.hasCode),
    structureType: 'INDEPENDENT_UNIT',
    lectureUnitId: u.lectureUnitId,
    lectureSlides: u.lectureSlides || [],
    lectureIntent: u.lectureIntent || null,
    difficultyMeaning: u.difficultyMeaning || null,
    unitRole: u.unitRole || null,
    importanceScore: u.importanceScore || 0,
    supplementary: Boolean(u.supplementary),
    isReserve: Boolean(u.isReserve)
  };
}

/** The writer and the reviewer read only these fields of the session (no evidence store, no router). */
function sessionContext(sessionInputs, lm) {
  const blocks = (lm && lm.blocks) || [];
  return {
    sessionId: sessionInputs.sessionId || sessionInputs.taskId || null,
    abortSignal: sessionInputs.abortSignal || null,
    inputModality: lm && lm.isTopicNotes ? 'TOPIC_NOTES' : 'LECTURE_MODEL',
    representationMode: 'UNIFIED',
    // Only a topic-only request carries a topic: writer and reviewer treat a non-empty topic as "topic mode".
    topic: sessionInputs.topic || '',
    unifiedRawContent: blocks.map(b => b.text).join('\n\n') || [sessionInputs.voiceTranscript, ...(sessionInputs.documentTexts || [])].filter(Boolean).join('\n\n'),
    curricularContent: '',
    voiceTranscript: sessionInputs.voiceTranscript || '',
    documentTexts: sessionInputs.documentTexts || [],
    // Code reaches the writer inside each point's passage. These flags stay off: with them on, the reviewer rejected
    // every planned code question written in prose before the gate could judge it; whether a question needs code it
    // does not show is the gate's completeness check ("refers to code but does not show the code").
    codeSnippets: '',
    hasCode: false,
    artifacts: [],
    negativeBoundaries: []
  };
}

/** A failed slot takes the most important unused reserve of the same difficulty, preferring a different point. */
function takeReserve(reserves, failed, usedUnits) {
  // Same difficulty first; only when none is left, the nearest difficulty (the notice reports the delivered mix).
  const near = { Easy: ['Medium'], Medium: ['Easy', 'Hard'], Hard: ['Medium'] }[failed.targetDifficulty] || [];
  const tiers = [failed.targetDifficulty, ...near];
  let pick = null;
  for (const tier of tiers) {
    const same = reserves.filter(r => r.targetDifficulty === tier);
    pick = same.find(r => !usedUnits.has(r.lectureUnitId)) || same[0];
    if (pick) break;
  }
  if (!pick) return null;
  reserves.splice(reserves.indexOf(pick), 1);
  return pick;
}

/**
 * Medium and Hard must make the student work on something (the gate's DEPTH criterion): a short scenario, given
 * data, or a code fragment in the stem. A Medium/Hard stem with none of these can be answered by recalling one
 * sentence, so it gets one rewrite before it is accepted. Easy questions are exempt.
 */
function lacksConcreteCase(q, tier) {
  if (tier === 'Easy') return false;
  const stem = String(q.question || q.questionText || '');
  if (/```|\n\s*\S.*[;{}()=[\]]/.test(stem)) return false; // code
  if (/\d/.test(stem) && stem.split(/\s+/).length >= 12) return false; // given data
  const situation = /\b(given|suppose|consider|imagine|if|after|when|while|instead|replaced|removed|changes?|increase[sd]?|decrease[sd]?)\b/i;
  const actor = /\b(a|an|the)\s+(student|developer|engineer|team|programmer|model|network|system|process|teacher|user|dataset|program|function|query|server|company)\b/i;
  if (situation.test(stem) && actor.test(stem)) return false; // scenario
  return true;
}

const DEPTH_REPAIR = (tier) => `REWRITE FOR ${tier.toUpperCase()}: this question can be answered by recalling one sentence from the lecture. Rewrite it so the student must apply what was taught to a concrete case written into the stem: a short scenario, given numbers, or a small code fragment in the style the teacher used${tier === 'Hard' ? ', with at least two dependent reasoning steps (an edge case, a what-if change, a diagnosis, or combining two taught ideas)' : ''}. Keep the stem under 45 words and keep the same taught point.`;

/** Instruction for a replacement of a question the gate rejected as too shallow for its level. */
const DEEPER_HINT = (tier, reason) => `The previous question on this point was rejected by the quality gate${reason ? ` (${String(reason).replace(/^DEPTH:\s*/, '').slice(0, 200)})` : ''}. Write a genuinely ${tier} question: give a concrete case in the stem (a scenario, numbers, or a short code fragment in the teacher's style)${tier === 'Hard' ? ' that needs at least two dependent reasoning steps, where the second step uses the result of the first (trace then predict, compute then compare, diagnose then fix, or combine two taught ideas)' : ' that the student must apply the taught idea to, not recall it'}. Keep the same taught point, a single correct answer, and the stem under 60 words.`;

function answerKeyProblem(q) {
  if (!Array.isArray(q.options) || q.options.length !== 4) return 'does not have exactly 4 options';
  if (!q.options.includes(q.correctAnswer)) return 'the key is not one of the options';
  if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== 4) return 'two options are the same';
  return null;
}

/**
 * Steps 4-5. Returns the shape quizController expects from the pipeline (questions, notice, status fields).
 * @param {object} sessionInputs  from quizController (teachingUnits = planned points incl. reserves)
 * @param {object} lm             the lecture model the plan came from
 * @param {function} progress     progress events for the teacher's screen
 * @param {object} deps           injectable writer/reviewer (unit tests)
 */
async function run(sessionInputs, lm, progress = () => {}, deps = {}) {
  const writer = deps.writer || agent2Generator;
  const reviewer = deps.reviewer || agent3Evaluator;
  const requested = Math.max(0, parseInt(sessionInputs.count, 10) || 0);
  const units = Array.isArray(sessionInputs.teachingUnits) ? sessionInputs.teachingUnits : [];
  const primary = units.filter(u => !u.isReserve).map((u, i) => toTarget(u, 'T', i, sessionInputs.difficulty));
  const reserves = units.filter(u => u.isReserve).map((u, i) => toTarget(u, 'R', i, sessionInputs.difficulty));
  // Relabelling a question's difficulty is a safety valve for Balanced quizzes, capped at ~10% of the quiz.
  const relabelBudget = { remaining: Math.max(1, Math.round(primary.length * 0.1)) };
  [...primary, ...reserves].forEach(t => { t.relabelBudget = relabelBudget; });
  const ctx = sessionContext(sessionInputs, lm);

  const accepted = [];
  const failed = [];
  const usedUnits = new Set(primary.map(t => t.lectureUnitId));
  const queue = primary.slice();
  // Hard questions are the ones most often rejected afterwards (too shallow, unproven), and a replacement is a slow
  // single-question run. So the first wave writes ~40% extra Hard candidates from Hard reserves; the controller keeps
  // the requested number of the best proven ones (S04 re-run: Hard 2 of 5 delivered without this).
  // Easy/Medium get ~50% extra as well (cheap writer): the proof step refuses some questions at every level.
  let extraHard = 0; let extraOther = 0;
  const overgen = (tier, share) => {
    const planned = primary.filter(t => t.targetDifficulty === tier).length;
    if (!planned || sessionInputs.writeHint || process.env.HARD_OVERGENERATE === '0') return 0;
    let added = 0;
    for (let i = 0; i < Math.ceil(share * planned); i++) {
      const r = takeReserve(reserves, { targetDifficulty: tier }, usedUnits);
      if (!r) break;
      if (r.targetDifficulty !== tier) { reserves.push(r); break; }
      usedUnits.add(r.lectureUnitId); queue.push(r); added++;
    }
    return added;
  };
  extraHard = overgen('Hard', parseFloat(process.env.HARD_OVERGENERATE) || 0.4);
  extraOther = overgen('Medium', parseFloat(process.env.OVERGENERATE) || 0.5) + overgen('Easy', parseFloat(process.env.OVERGENERATE) || 0.5);
  const writeGoal = requested + extraHard + extraOther;
  const maxAttempts = Math.max(writeGoal * 3, writeGoal + 6);
  let attempts = 0;
  let providerWaits = 0, waitedFor = 0;
  const BATCH = Math.max(1, Math.min(5, parseInt(process.env.GENERATION_BATCH_SIZE, 10) || 5));
  // Hard targets are written one per request: the reasoning they need must fit the provider's per-minute budget.
  const HARD_BATCH = Math.max(1, Math.min(3, parseInt(process.env.HARD_BATCH_SIZE, 10) || 1));

  const writeAndCheck = async (batch) => {
    let candidates;
    try {
      // A replacement for a too-shallow question is written alone, with the gate's reason as the instruction.
      candidates = sessionInputs.writeHint && writer.generateQuestion
        ? await Promise.all(batch.map(t => writer.generateQuestion(t, ctx, sessionInputs.writeHint).catch(() => null)))
        : await writer.generateQuestionBatch(batch, ctx);
    } catch (e) {
      // Fallback: the batch failed as a whole -> each target is written on its own.
      candidates = await Promise.all(batch.map(t => writer.generateQuestion(t, ctx).catch(() => null)));
    }
    return Promise.all(batch.map(async (t, i) => {
      const c = candidates && candidates[i];
      if (!c || c.isUnfulfilled) return { t, reason: (c && c.message) || 'the writer returned no question' };
      try {
        let r = await reviewer.evaluateAndRepairQuestion(c, t, ctx, writer, { allowRepair: true });
        // One rewrite for a Medium/Hard question with nothing to work on (it would fail the gate's depth check).
        if (r && r.status === 'PASS' && lacksConcreteCase(r.mcq, t.targetDifficulty) && writer.generateQuestion) {
          const again = await writer.generateQuestion(t, ctx, DEPTH_REPAIR(t.targetDifficulty)).catch(() => null);
          if (again && !again.isUnfulfilled && !lacksConcreteCase(again, t.targetDifficulty)) {
            const r2 = await reviewer.evaluateAndRepairQuestion(again, t, ctx, writer, { allowRepair: true });
            if (r2 && r2.status === 'PASS') { r = r2; r.depthRewritten = true; }
          }
        }
        if (r && r.status === 'PASS') return { t, r };
        // Wording heuristics (similar-looking options, a longer key, format asymmetry) are hints, not verdicts: a
        // question that fails only those goes to the Final Quality Gate, which judges them against the lecture.
        const reasons = (r && r.failureReasons) || [];
        if (reasons.length && reasons.every(x => SOFT_CHECKS.has(String(x).split(':')[0])) && c && !c.isUnfulfilled && !answerKeyProblem(c)) {
          return { t, r: { status: 'PASS', mcq: c, softFlags: reasons, verificationMethod: 'SOFT_FLAGS_TO_GATE' } };
        }
        return { t, reason: reasons.join('; ') || (r && r.status) || 'failed review' };
      } catch (e) {
        return { t, reason: `review failed: ${e.message}` };
      }
    }));
  };

  progress({ stage: 'QUESTION_GENERATION', decisions: [`Writing ${primary.length} planned questions`] });
  let firstWave = true;
  while (accepted.length < writeGoal && queue.length > 0 && attempts < maxAttempts) {
    // Time budget: after the first wave, no new wave starts past the write deadline (the gate and proof still need time).
    if (!firstWave && sessionInputs.writeDeadlineAt && Date.now() > sessionInputs.writeDeadlineAt) { console.log('[TimeBudget] write deadline reached; no further wave'); break; }
    firstWave = false;
    if (ctx.abortSignal && ctx.abortSignal.aborted) break;
    const wave = queue.splice(0, Math.min(writeGoal - accepted.length, BATCH * 3));
    attempts += wave.filter(t => !t.providerRetries).length;
    const batches = [];
    const hard = wave.filter(t => t.targetDifficulty === 'Hard');
    const other = wave.filter(t => t.targetDifficulty !== 'Hard');
    for (let i = 0; i < other.length; i += BATCH) batches.push(other.slice(i, i + BATCH));
    for (let i = 0; i < hard.length; i += HARD_BATCH) batches.push(hard.slice(i, i + HARD_BATCH));
    const outcomes = (await mapLimited(batches, writeConcurrency(), writeAndCheck)).flat();
    for (const o of outcomes) {
      let reason = o.reason || null;
      const q = o.r && o.r.mcq;
      if (q && !reason) reason = answerKeyProblem(q);
      if (q && !reason) {
        const dup = deterministicValidator.checkDuplicateQuestion(q, accepted, o.t);
        if (dup && dup.isDuplicate) reason = 'duplicate of a question already accepted';
      }
      if (q && !reason && accepted.length < writeGoal) {
        q.difficulty = q.difficulty || o.t.targetDifficulty;
        q.metadata = {
          ...(q.metadata || {}),
          targetId: o.t.targetId,
          targetDifficulty: o.t.targetDifficulty,
          subtopic: o.t.subtopic,
          concept: o.t.concept,
          lectureUnitId: o.t.lectureUnitId,
          supplementary: o.t.supplementary,
          repaired: Boolean(o.r.repaired),
          reviewMethod: o.r.verificationMethod || null
        };
        accepted.push(q);
        continue;
      }
      if (!reason) continue; // accepted count already reached
      // A busy provider is not a bad question: retry the same target (twice at most, after a pause) instead of
      // spending a reserve on it. Three tries: a provider outage (all keys at once) can last a few minutes.
      if (/PROVIDER_UNAVAILABLE|NO_LLM_PROVIDER|usage limit|DAILY_LIMIT|rate.?limit|timed? ?out|quota|429|5\d\d/i.test(reason) && (o.t.providerRetries || 0) < 3) {
        o.t.providerRetries = (o.t.providerRetries || 0) + 1;
        providerWaits++;
        queue.push(o.t);
        continue;
      }
      failed.push({ targetId: o.t.targetId, difficulty: o.t.targetDifficulty, subtopic: o.t.subtopic, reason });
      const next = takeReserve(reserves, o.t, usedUnits);
      if (next) { usedUnits.add(next.lectureUnitId); queue.push(next); }
    }
    progress({ stage: 'AGENT_3_QUESTION_EVAL', decisions: [`Question ${accepted.length}/${requested} passed its checks`] });
    if (providerWaits > waitedFor && queue.length && accepted.length < requested) {
      waitedFor = providerWaits;
      const waitMs = deps.providerWaitMs ?? (parseInt(process.env.PROVIDER_RETRY_WAIT_MS, 10) || 30000);
      if (sessionInputs.writeDeadlineAt && Date.now() + waitMs > sessionInputs.writeDeadlineAt) break;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  const short = Math.max(0, requested - accepted.length);
  console.log(`[MCQ pipeline] write+check: ${accepted.length}/${requested} accepted from ${attempts} written` +
    (failed.length ? `; failed: ${failed.map(f => `${f.targetId} ${f.difficulty} (${String(f.reason).slice(0, 80)})`).join(' | ')}` : '') +
    (providerWaits ? `; ${providerWaits} busy-provider retr${providerWaits === 1 ? 'y' : 'ies'}` : ''));
  return {
    questions: accepted,
    notice: null,
    error: accepted.length ? null : 'No question passed the checks for this input.',
    isPartial: short > 0,
    pipelineStatus: short > 0 ? 'PARTIAL' : 'COMPLETE',
    representationMode: 'LECTURE_MODEL',
    stages: [{ stage: 'WRITE_AND_CHECK', written: attempts, accepted: accepted.length, failed: failed.length }],
    writeCheck: { attempts, failed, providerRetries: providerWaits, extraHard, extraOther },
    // Remaining reserves go back to the controller for the replacement step (step 7).
    remainingReserveIds: reserves.map(r => r.targetId)
  };
}

module.exports = { SOFT_CHECKS, DEEPER_HINT, run, toTarget, takeReserve, answerKeyProblem, sessionContext, mapLimited, writeConcurrency, lacksConcreteCase };
