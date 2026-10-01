/**
 * experiments/experiment_4_3_blueprint_impact/runner/run_stage_4_3b_blinded_judge.js
 *
 * Phase 4 Experiment 4.3 — Stage 4.3B:
 * Multi-Dimensional Blinded LLM Evaluation across 146 MCQs.
 *
 * Evaluates each generated MCQ on a 1-5 integer Likert scale across 6 independent dimensions:
 *   - D1: Teaching-Context Alignment
 *   - D2: Cognitive Demand & Rigor
 *   - D3: Stem Clarity & Unambiguity
 *   - D4: Distractor Plausibility
 *   - D5: Single-Key Determinism
 *   - D6: Question Novelty & Authenticity
 *
 * CRITICAL METHODOLOGICAL CONTROLS:
 *   1. Condition identity, classifier provenance, and target IDs are COMPLETELY WITHHELD.
 *   2. Evaluator receives only: Lecture Evidence, Question Text, 4 Options, Correct Answer, Explanation.
 *   3. NO composite or scalar averaging requested from the judge.
 *
 * Model: openai/gpt-oss-120b on Groq
 * Temperature: 0.0
 * Max Tokens: 800
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const { getTargetEvidenceContext } = require(path.join(DemoProjectDir, 'server/engine/evidence/evidenceContextSelector'));

// Paths
const exp43Dir = path.resolve(DemoProjectDir, 'experiments/experiment_4_3_blueprint_impact');
const rawQuestionsDir = path.join(exp43Dir, 'raw_results/questions');
const testPackagesDir = path.join(exp43Dir, 'test_packages');
const evaluationsDir = path.join(exp43Dir, 'raw_results/blinded_evaluations');
fs.mkdirSync(evaluationsDir, { recursive: true });

// Dedicated round-robin across the 3 distinct Groq Organizations:
const apiKeys = [
  process.env.GROQ_API_KEY_BACKUP, // Org 2 (Available now)
  process.env.GROQ_API_KEY_3,      // Org 3 (Available now)
  process.env.GROQ_API_KEY_5       // Org 1 (Available now / rolling off)
].filter(Boolean);

let keyIndex = 0;
function getGroqClient() {
  const currentKey = apiKeys[keyIndex % apiKeys.length];
  return new Groq({ apiKey: currentKey });
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % apiKeys.length;
}

const MODEL_NAME = process.env.JUDGE_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;
const MAX_COMPLETION_TOKENS = 1200;

const JUDGE_SYSTEM_PROMPT = `You are a Blinded Expert Assessment Evaluator.
Evaluate the supplied multiple-choice question against the provided lecture transcript evidence.
Condition identity, experimental provenance, and model metadata are completely withheld.

Rate the question on a 1 to 5 integer Likert scale across SIX INDEPENDENT DIMENSIONS.
Do NOT compute or provide an overall, composite, or average score. Evaluate each dimension independently.

EVALUATION RUBRIC (1 = Very Poor / Failing, 3 = Acceptable / Baseline, 5 = Exemplary):
1. D1 - Teaching-Context Alignment: Does the question test content actually taught and emphasized in the lecture evidence, rather than extraneous trivia or unmentioned assumptions?
2. D2 - Cognitive Demand & Rigor: Does answering require genuine conceptual comprehension, causal deduction, or procedural reasoning, rather than superficial verbatim token matching?
3. D3 - Stem Clarity & Unambiguity: Is the question stem clear, self-contained, grammatically sound, and unambiguous in what it asks?
4. D4 - Distractor Plausibility: Are the incorrect options plausible, realistic misconceptions that require discrimination, rather than obvious throwaway foils or grammatical giveaways?
5. D5 - Single-Key Determinism: Under the provided evidence, is exactly ONE option demonstrably correct and defendable, with all three distractors definitively incorrect?
6. D6 - Question Novelty & Authenticity: Does the question frame an authentic pedagogical inquiry rather than a trivial definition regurgitation?

JSON OUTPUT SCHEMA:
{
  "d1_teaching_alignment": { "score": 1-5, "rationale": "brief reason" },
  "d2_cognitive_demand": { "score": 1-5, "rationale": "brief reason" },
  "d3_stem_clarity": { "score": 1-5, "rationale": "brief reason" },
  "d4_distractor_plausibility": { "score": 1-5, "rationale": "brief reason" },
  "d5_single_key_determinism": { "score": 1-5, "rationale": "brief reason" },
  "d6_question_novelty": { "score": 1-5, "rationale": "brief reason" }
}`;

function buildBlindedPrompt(mcq, evidenceContext) {
  const letters = ['A', 'B', 'C', 'D'];
  const formattedOptions = mcq.options.map((opt, i) => `${letters[i]}) ${opt}`).join('\n');

  return `
[LECTURE EVIDENCE]
${evidenceContext}

[QUESTION UNDER EVALUATION]
Question: ${mcq.questionText}
Options:
${formattedOptions}
Declared Correct Answer: ${mcq.correctAnswer}
Declared Explanation: ${mcq.explanation || 'No explanation provided.'}

TASK:
Provide your blinded 1-5 scores and rationales across all 6 independent dimensions in valid JSON format.
`;
}

async function evaluateQuestionBlinded(item, pkg, maxRetries = 200) {
  const evidenceContext = getTargetEvidenceContext(
    { supportingEvidence: item.target_concept, concept: item.target_concept },
    { unifiedRawContent: pkg.raw_content },
    1500
  );

  const prompt = buildBlindedPrompt(item.mcq, evidenceContext);
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    const startTime = Date.now();
    try {
      const client = getGroqClient();
      const completion = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' }
      });

      const latencyMs = Date.now() - startTime;
      const rawText = completion.choices[0].message.content;
      const parsed = JSON.parse(rawText);

      // Verify all 6 dimensions are present
      const dims = ['d1_teaching_alignment', 'd2_cognitive_demand', 'd3_stem_clarity', 'd4_distractor_plausibility', 'd5_single_key_determinism', 'd6_question_novelty'];
      for (const d of dims) {
        if (!parsed[d] || typeof parsed[d].score !== 'number') {
          throw new Error(`Judge output missing score for dimension: ${d}`);
        }
      }

      // Rotate key on success to spread load across orgs
      rotateKey();

      return {
        success: true,
        package_id: item.package_id,
        condition: item.condition,
        target_id: item.target_id,
        target_concept: item.target_concept,
        evaluation: parsed,
        latency_ms: latencyMs,
        retry_count: attempt,
        raw_response: rawText
      };

    } catch (err) {
      attempt++;
      lastError = err;
      console.warn(`[Judge | ${item.package_id} | ${item.condition} | ${item.target_id}] Attempt ${attempt} failed: ${err.message}`);
      rotateKey();
      if (attempt <= maxRetries) {
        const isRateLimit = err.status === 429 || (err.message && err.message.toLowerCase().includes('rate'));
        const waitMs = isRateLimit ? (attempt % apiKeys.length === 0 ? 60000 : 5000) : 2000 * attempt;
        console.log(`[Judge] Waiting ${waitMs / 1000}s before attempt ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  return {
    success: false,
    package_id: item.package_id,
    condition: item.condition,
    target_id: item.target_id,
    error: lastError?.message || 'Unknown judge failure',
    retry_count: attempt
  };
}

async function runStage43BJudge(isDryRun = false) {
  // Load packages map
  const pkgFiles = fs.readdirSync(testPackagesDir).filter(f => f.startsWith('pkg_') && f.endsWith('.json'));
  const packagesMap = {};
  for (const f of pkgFiles) {
    const p = JSON.parse(fs.readFileSync(path.join(testPackagesDir, f), 'utf8'));
    packagesMap[p.package_id] = p;
  }

  // Load questions
  const qFiles = fs.readdirSync(rawQuestionsDir).filter(f => f.endsWith('.json')).sort();
  console.log(`Found ${qFiles.length} generated questions to evaluate.`);

  if (qFiles.length !== 146) {
    throw new Error(`FATAL: Expected exactly 146 questions to evaluate, found ${qFiles.length}!`);
  }

  if (isDryRun) {
    console.log('[DRY RUN COMPLETE] Zero judge evaluations called.');
    return;
  }

  console.log('\n=== EXECUTING STAGE 4.3B: BLINDED 6-DIMENSION LLM EVALUATION ===');
  const allEvaluations = [];
  let itemCounter = 0;

  for (const qFile of qFiles) {
    itemCounter++;
    const evalPath = path.join(evaluationsDir, qFile);

    // Check if already evaluated for idempotency
    if (fs.existsSync(evalPath)) {
      console.log(`[${itemCounter}/146] Found cached evaluation: ${qFile}`);
      allEvaluations.push(JSON.parse(fs.readFileSync(evalPath, 'utf8')));
      continue;
    }

    const item = JSON.parse(fs.readFileSync(path.join(rawQuestionsDir, qFile), 'utf8'));
    const pkg = packagesMap[item.package_id];

    console.log(`[${itemCounter}/146] Judging question: ${item.package_id} | ${item.condition} | ${item.target_id}...`);
    const evalRes = await evaluateQuestionBlinded(item, pkg);

    if (!evalRes.success) {
      console.error(`FATAL: Judge evaluation failed for ${qFile}: ${evalRes.error}`);
      process.exit(1);
    }

    fs.writeFileSync(evalPath, JSON.stringify(evalRes, null, 2), 'utf8');
    allEvaluations.push(evalRes);

    const scores = evalRes.evaluation;
    console.log(`   -> Scores: D1=${scores.d1_teaching_alignment.score} D2=${scores.d2_cognitive_demand.score} D3=${scores.d3_stem_clarity.score} D4=${scores.d4_distractor_plausibility.score} D5=${scores.d5_single_key_determinism.score} D6=${scores.d6_question_novelty.score} (${evalRes.latency_ms}ms)`);

    await new Promise(r => setTimeout(r, 1200));
  }

  // Summary file
  const summary = {
    experiment_id: 'experiment_4_3_blueprint_impact',
    stage: 'Stage_4.3B_Blinded_Evaluations',
    timestamp: new Date().toISOString(),
    total_evaluated: allEvaluations.length,
    model: MODEL_NAME,
    temperature: TEMPERATURE,
    max_tokens: MAX_COMPLETION_TOKENS,
    evaluations: allEvaluations.map(e => ({
      package_id: e.package_id,
      condition: e.condition,
      target_id: e.target_id,
      scores: {
        d1: e.evaluation.d1_teaching_alignment.score,
        d2: e.evaluation.d2_cognitive_demand.score,
        d3: e.evaluation.d3_stem_clarity.score,
        d4: e.evaluation.d4_distractor_plausibility.score,
        d5: e.evaluation.d5_single_key_determinism.score,
        d6: e.evaluation.d6_question_novelty.score
      },
      latency_ms: e.latency_ms
    }))
  };

  const summaryPath = path.join(exp43Dir, 'raw_results/stage_4_3b_blinded_evaluations.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  // SHA-256
  const summaryHash = crypto.createHash('sha256').update(fs.readFileSync(summaryPath)).digest('hex');
  fs.writeFileSync(path.join(exp43Dir, 'raw_results/stage_4_3b_blinded_evaluations.sha256'), summaryHash, 'utf8');

  console.log('\n=== STAGE 4.3B BLINDED EVALUATION COMPLETE ===');
  console.log(`Evaluated ${allEvaluations.length} MCQs across 6 dimensions.`);
  console.log(`Saved individual evaluations to: ${evaluationsDir}`);
  console.log(`Saved summary to: ${summaryPath}`);
  console.log(`Summary SHA-256: ${summaryHash}`);
}

const isDryRun = process.argv.includes('--dry-run');
runStage43BJudge(isDryRun).catch(err => {
  console.error('Unhandled fatal error in Stage 4.3B judge runner:', err);
  process.exit(1);
});
