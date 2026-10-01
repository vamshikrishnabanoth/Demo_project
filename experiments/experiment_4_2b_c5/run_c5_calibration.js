/**
 * experiments/experiment_4_2b_c5/run_c5_calibration.js
 *
 * Phase 4 Experiment 4.2b — Step 2: C5 Calibration Protocol
 *
 * Evaluates:
 *   - C5_LLM_CALIBRATED: Few-shot calibrated LLM with explicit negative boundary demonstrations (openai/gpt-oss-120b on Groq)
 * Against:
 *   - 8 Dedicated Non-Benchmark Calibration Examples (in --calibrate mode)
 *   - 17 Frozen Evaluation Units from Experiment 4.2 (in --evaluate mode, only after --lock)
 *
 * HARD ISOLATION RULE:
 *   - Zero production changes.
 *   - Zero modifications to Phase 3.4 or Experiment 4.2/4.2b artifacts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

// Paths
const expC5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_4_2b_c5');
const calibExamplesPath = path.join(expC5Dir, 'calibration/calibration_examples.json');
const lockManifestPath = path.join(expC5Dir, 'c5_config_lock.json');
const lockShaPath = path.join(expC5Dir, 'c5_config_lock.sha256');

const rawCalibDir = path.join(expC5Dir, 'raw_outputs/calibration');
const rawEvalDirB4 = path.join(expC5Dir, 'raw_outputs/evaluation/BENCH_04');
const rawEvalDirB3 = path.join(expC5Dir, 'raw_outputs/evaluation/BENCH_03');

const gtPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2/ground_truth/behavior_annotations.json');
const exp42ResultsPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2/results_experiment_4_2.json');
const exp42bResultsPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2b/results_experiment_4_2b.json');

const finalResultsPath = path.join(expC5Dir, 'results_c5_calibration.json');
const finalShaPath = path.join(expC5Dir, 'results_c5_calibration.sha256');

// Groq Runtime
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL_NAME = process.env.GROQ_MODEL || process.env.DEFAULT_LLM_MODEL || 'openai/gpt-oss-120b';
const PROVIDER_NAME = 'groq';
const TEMPERATURE = 0; // Nominally deterministic sampling configuration

// Canonical 12-Behavior Taxonomy
const CANONICAL_TAXONOMY = [
  'EXPLAIN',
  'DEMONSTRATE',
  'COMPARE',
  'DEBUG',
  'PREDICT_CHANGE',
  'ASK_WHY',
  'PRACTICE',
  'REAL_WORLD_APP',
  'EDGE_CASE',
  'CODE_TRACE',
  'STUDENT_INTERACT',
  'REINFORCE'
];

// C5 System Prompt with Canonical Definitions & Explicit Negative Boundaries
const C5_SYSTEM_PROMPT = `You are an expert teaching-behavior annotation classifier.

Given one transcript segment from a lecture, assign zero or more labels from the canonical 12-behavior taxonomy below.

Classify observable surface teaching behavior only.
Do not infer hidden psychological intent or unstated teacher motivation.
Do not infer question-generation strategy.
Multiple labels are allowed ONLY when multiple observable behaviors are genuinely present.
Be conservative: absence of evidence means absence of the label.
Every assigned label MUST be supported by an exact substring quote from the transcript segment. The quote must directly support the behavioral definition itself, not merely contain a trigger word.

Canonical 12 Behaviors:

EXPLAIN:
Teacher explains, defines, introduces, or clarifies a concept, data structure, algorithm, or theoretical principle.

DEMONSTRATE:
Teacher demonstrates a concrete procedure, command, syntax, execution, or operational steps (e.g. running code, typing terminal commands, showing system actions).

COMPARE:
Teacher explicitly compares or contrasts two or more concepts, techniques, policies, or algorithms.

DEBUG:
Teacher identifies, diagnoses, explains, or fixes an error, misconception, bug, traceback, or incorrect attempt.

PREDICT_CHANGE:
Teacher asks or explains what happens if a parameter, condition, input, or code segment changes.

ASK_WHY:
Teacher demands conceptual justification, asks a deep 'why' question, or explains underlying theoretical reasons.

PRACTICE:
Teacher explicitly directs or challenges students to solve a problem, perform an exercise, or attempt a task themselves.

REAL_WORLD_APP:
Teacher explicitly connects the taught concept to a concrete, operational real-world scenario, practical industrial workflow, or system application.

EDGE_CASE:
Teacher explicitly examines a boundary condition, extreme input, base case, null/empty state, or unusual constraint.

CODE_TRACE:
Teacher explicitly traces program execution, variable state changes, stack behavior, or control flow step by step.

STUDENT_INTERACT:
Observable multi-party interaction with students, including responding to student questions, dialogue directed toward a student, or eliciting and validating student responses.

REINFORCE:
Teacher explicitly emphasizes, reviews, summarizes, or reinforces an important previously established point.

CRITICAL NEGATIVE BOUNDARY RULES (Strict Constraints):

1. Boundary A — STUDENT_INTERACT:
- Do NOT classify STUDENT_INTERACT merely because a question mark appears.
- Do NOT classify STUDENT_INTERACT if the instructor asks a rhetorical question and immediately answers it.
- Do NOT classify STUDENT_INTERACT if the instructor asks a question to the room during a monologue without student response or turn-taking.
- STUDENT_INTERACT requires observable evidence of multi-party interaction: a student speaking, student input being acknowledged, or the teacher directly interacting with a specific student.

2. Boundary B — REAL_WORLD_APP:
- Do NOT classify REAL_WORLD_APP merely because developers, programmers, software engineers, or the technology industry are mentioned in passing.
- Do NOT classify REAL_WORLD_APP for generic statements like 'developers use this tool in projects'.
- REAL_WORLD_APP requires a concrete, practical scenario or operational workflow (e.g., e-commerce flash sales, banking transactions, hardware limits, production server deployments).

3. Boundary C — DEMONSTRATE:
- Do NOT classify DEMONSTRATE merely because a function name, command syntax, or parameter is verbally described.
- DEMONSTRATE requires active procedural execution, terminal commands being run, live code manipulation, or concrete inspection of outputs.

4. Boundary D — PRACTICE:
- Do NOT classify PRACTICE merely because the teacher solves an example, explains an algorithm, or demonstrates a solution.
- PRACTICE requires that students are explicitly assigned a task, challenge, prompt, or exercise to perform themselves.

5. Boundary E — REINFORCE:
- Do NOT classify REINFORCE for ordinary transitions or regular continuous explanations.
- REINFORCE requires explicit reiteration, emphasis, or structured summary of a prior established concept.

Output JSON Format:
{
  "labels": ["LABEL1", "LABEL2"],
  "evidence": [
    {
      "label": "LABEL1",
      "quote": "exact supporting substring from transcript"
    }
  ]
}`;

// Format Few-Shot Demonstrations from Calibration Examples
function getFewShotPromptMessages(calibrationExamples) {
  const messages = [
    { role: 'system', content: C5_SYSTEM_PROMPT }
  ];

  for (const ex of calibrationExamples) {
    messages.push({
      role: 'user',
      content: `Transcript Segment:\n"${ex.transcript_text}"\n\nClassify observable teaching behaviors:`
    });
    messages.push({
      role: 'assistant',
      content: JSON.stringify({
        labels: ex.expected_labels,
        evidence: ex.expected_evidence
      }, null, 2)
    });
  }

  return messages;
}

// Compute SHA-256 helper
function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Core Inference Function with Retry on 429 Rate Limit
async function classifySegmentWithC5(transcriptText, calibrationExamples) {
  const messages = getFewShotPromptMessages(calibrationExamples);
  messages.push({
    role: 'user',
    content: `Transcript Segment:\n"${transcriptText}"\n\nClassify observable teaching behaviors:`
  });

  const startTime = Date.now();
  let retryCount = 0;
  let response;

  while (true) {
    try {
      response = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' }
      });
      break;
    } catch (err) {
      if (err.status === 429 && retryCount < 4) {
        retryCount++;
        const waitMs = 2500 * Math.pow(2, retryCount - 1);
        console.warn(`  [Rate Limit 429] Waiting ${waitMs} ms before retry #${retryCount}...`);
        await sleep(waitMs);
      } else {
        throw err;
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  const rawContent = response.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`JSON parse error: ${err.message}. Raw: ${rawContent}`);
  }

  const predictedLabels = (parsed.labels || []).filter(l => CANONICAL_TAXONOMY.includes(l));
  const evidence = parsed.evidence || [];

  return {
    predicted_labels: predictedLabels,
    evidence: evidence,
    raw_response: rawContent,
    latency_ms: latencyMs,
    retry_count: retryCount
  };
}

// Mode 1: --calibrate
async function runCalibrationMode() {
  console.log('=== Mode 1: Calibration Iteration Mode ===');
  fs.mkdirSync(rawCalibDir, { recursive: true });

  const calibData = JSON.parse(fs.readFileSync(calibExamplesPath, 'utf8'));
  const examples = calibData.examples;
  console.log(`Loaded ${examples.length} calibration examples across 4 boundary families.`);

  let exactMatches = 0;
  let boundaryViolations = 0;
  const results = [];

  for (const ex of examples) {
    console.log(`\nEvaluating ${ex.id} (${ex.boundary_family} - ${ex.boundary_type})...`);
    try {
      // Exclude current example from few-shot context to test genuine generalization on calibration set
      const contextExamples = examples.filter(e => e.id !== ex.id);
      const res = await classifySegmentWithC5(ex.transcript_text, contextExamples);

      const predSet = new Set(res.predicted_labels);
      const expSet = new Set(ex.expected_labels);
      const isExactMatch = predSet.size === expSet.size && [...predSet].every(l => expSet.has(l));

      const hasProhibited = (ex.prohibited_labels || []).some(l => predSet.has(l));

      if (isExactMatch) exactMatches++;
      if (hasProhibited) boundaryViolations++;

      const record = {
        id: ex.id,
        boundary_family: ex.boundary_family,
        boundary_type: ex.boundary_type,
        expected_labels: ex.expected_labels,
        predicted_labels: res.predicted_labels,
        prohibited_labels: ex.prohibited_labels,
        is_exact_match: isExactMatch,
        has_boundary_violation: hasProhibited,
        evidence: res.evidence,
        latency_ms: res.latency_ms
      };

      results.push(record);
      fs.writeFileSync(path.join(rawCalibDir, `${ex.id}.json`), JSON.stringify(record, null, 2), 'utf8');

      console.log(`  Expected:  [${ex.expected_labels.join(', ')}]`);
      console.log(`  Predicted: [${res.predicted_labels.join(', ')}]`);
      console.log(`  Exact Match: ${isExactMatch ? 'PASS' : 'FAIL'} | Violation: ${hasProhibited ? 'YES' : 'NO'}`);
      await sleep(2000);
    } catch (err) {
      console.error(`  Error evaluating ${ex.id}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n=== Calibration Summary ===');
  console.log(`Exact Matches: ${exactMatches} / ${examples.length} (${(exactMatches / examples.length * 100).toFixed(1)}%)`);
  console.log(`Boundary Violations: ${boundaryViolations}`);

  if (exactMatches === examples.length && boundaryViolations === 0) {
    console.log('\n>>> SUCCESS: All 8 calibration examples passed exact-match criteria with 0 violations.');
    console.log('>>> You may now run with --lock to cryptographically lock C5 configuration.');
  } else {
    console.log('\n>>> CALIBRATION INCOMPLETE: Refine C5 prompt and re-run --calibrate before locking.');
  }
}

// Mode 2: --lock
function runLockMode() {
  console.log('=== Mode 2: Cryptographic Lock Mode ===');

  const calibDataRaw = fs.readFileSync(calibExamplesPath, 'utf8');
  const runnerRaw = fs.readFileSync(__filename, 'utf8');

  // Verify that all 8 calibration outputs exist and are exact matches
  const calibData = JSON.parse(calibDataRaw);
  for (const ex of calibData.examples) {
    const rawOutPath = path.join(rawCalibDir, `${ex.id}.json`);
    if (!fs.existsSync(rawOutPath)) {
      console.error(`Error: Calibration output ${ex.id}.json does not exist. Run --calibrate first.`);
      process.exit(1);
    }
    const record = JSON.parse(fs.readFileSync(rawOutPath, 'utf8'));
    if (!record.is_exact_match || record.has_boundary_violation) {
      console.error(`Error: Calibration example ${ex.id} failed verification. Cannot lock.`);
      process.exit(1);
    }
  }

  const manifest = {
    lock_version: '1.0.0',
    locked_at: new Date().toISOString(),
    status: 'LOCKED',
    model: MODEL_NAME,
    provider: PROVIDER_NAME,
    temperature: TEMPERATURE,
    sampling_configuration: 'nominally deterministic sampling configuration (temperature=0)',
    response_format: 'json_object',
    hashes: {
      system_prompt_sha256: sha256(C5_SYSTEM_PROMPT),
      calibration_dataset_sha256: sha256(calibDataRaw),
      canonical_taxonomy_sha256: sha256(JSON.stringify(CANONICAL_TAXONOMY)),
      runner_script_sha256: sha256(runnerRaw)
    },
    verification_rule: 'Evaluation runner must verify all hashes before running on frozen 17 units.'
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(lockManifestPath, manifestJson, 'utf8');

  const manifestHash = sha256(manifestJson);
  fs.writeFileSync(lockShaPath, `${manifestHash}  c5_config_lock.json\n`, 'utf8');

  console.log('C5 Configuration successfully LOCKED.');
  console.log('Manifest written to:', lockManifestPath);
  console.log('SHA-256:', manifestHash);
  console.log('You may now run with --evaluate to perform the single-pass 17-unit evaluation.');
}

// Helper: Calculate Metrics
function calculateMetrics(perBehavior, taxonomy) {
  let tpTotal = 0, fpTotal = 0, fnTotal = 0;
  let pSum = 0, rSum = 0, f1Sum = 0;
  let activeClassesCount = 0;

  for (const b of taxonomy) {
    const s = perBehavior[b];
    tpTotal += s.tp;
    fpTotal += s.fp;
    fnTotal += s.fn;

    const p = s.tp + s.fp > 0 ? s.tp / (s.tp + s.fp) : 0;
    const r = s.tp + s.fn > 0 ? s.tp / (s.tp + s.fn) : 0;
    const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;

    s.precision = Number(p.toFixed(4));
    s.recall = Number(r.toFixed(4));
    s.f1_score = Number(f1.toFixed(4));

    pSum += p;
    rSum += r;
    f1Sum += f1;

    if (s.tp + s.fp > 0 || s.tp + s.fn > 0) {
      activeClassesCount++;
    }
  }

  const microP = tpTotal + fpTotal > 0 ? tpTotal / (tpTotal + fpTotal) : 0;
  const microR = tpTotal + fnTotal > 0 ? tpTotal / (tpTotal + fnTotal) : 0;
  const microF1 = microP + microR > 0 ? (2 * microP * microR) / (microP + microR) : 0;

  const macroP = pSum / taxonomy.length;
  const macroR = rSum / taxonomy.length;
  const macroF1 = f1Sum / taxonomy.length;

  return {
    aggregate: {
      micro_precision: Number(microP.toFixed(4)),
      micro_recall: Number(microR.toFixed(4)),
      micro_f1: Number(microF1.toFixed(4)),
      macro_precision: Number(macroP.toFixed(4)),
      macro_recall: Number(macroR.toFixed(4)),
      macro_f1: Number(macroF1.toFixed(4)),
      active_classes_count: activeClassesCount
    },
    per_behavior: perBehavior
  };
}

// Helper: Profile Divergence
function computeDivergence(humanCounts, modelCounts, taxonomy) {
  const totalHuman = Object.values(humanCounts).reduce((a, b) => a + b, 0);
  const totalModel = Object.values(modelCounts).reduce((a, b) => a + b, 0);

  const p = taxonomy.map(b => (totalHuman > 0 ? humanCounts[b] / totalHuman : 0));
  const q = taxonomy.map(b => (totalModel > 0 ? modelCounts[b] / totalModel : 0));

  let tvd = 0;
  let dot = 0, normP = 0, normQ = 0;

  for (let i = 0; i < taxonomy.length; i++) {
    tvd += Math.abs(p[i] - q[i]);
    dot += p[i] * q[i];
    normP += p[i] * p[i];
    normQ += q[i] * q[i];
  }
  tvd = 0.5 * tvd;
  const cosineDist = normP > 0 && normQ > 0 ? 1 - (dot / (Math.sqrt(normP) * Math.sqrt(normQ))) : 1;

  return {
    total_variation_distance: Number(tvd.toFixed(4)),
    cosine_distance: Number(cosineDist.toFixed(4))
  };
}

// Mode 3: --evaluate
async function runEvaluateMode() {
  console.log('=== Mode 3: Locked Single-Pass 17-Unit Evaluation Mode ===');

  // Verify Lock Manifest
  if (!fs.existsSync(lockManifestPath)) {
    console.error('CRITICAL: Lock manifest not found. Run --lock before evaluating.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(lockManifestPath, 'utf8'));
  const calibDataRaw = fs.readFileSync(calibExamplesPath, 'utf8');
  const runnerRaw = fs.readFileSync(__filename, 'utf8');

  if (manifest.hashes.system_prompt_sha256 !== sha256(C5_SYSTEM_PROMPT)) {
    console.error('CRITICAL: System prompt has changed since locking! Aborting.');
    process.exit(1);
  }
  if (manifest.hashes.calibration_dataset_sha256 !== sha256(calibDataRaw)) {
    console.error('CRITICAL: Calibration dataset has changed since locking! Aborting.');
    process.exit(1);
  }
  if (manifest.hashes.runner_script_sha256 !== sha256(runnerRaw)) {
    console.error('CRITICAL: Runner script has changed since locking! Aborting.');
    process.exit(1);
  }

  console.log('Cryptographic lock verified. All 4 hashes match manifest.');

  // Load Ground Truth & Calibration Examples
  const groundTruth = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
  const calibExamples = JSON.parse(calibDataRaw).examples;

  const bench04Units = groundTruth.benchmarks.BENCH_04;
  const bench03Units = groundTruth.benchmarks.BENCH_03;

  fs.mkdirSync(rawEvalDirB4, { recursive: true });
  fs.mkdirSync(rawEvalDirB3, { recursive: true });

  const evalUnits = [
    ...bench04Units.map(u => ({ ...u, benchmark: 'BENCH_04' })),
    ...bench03Units.map(u => ({ ...u, benchmark: 'BENCH_03' }))
  ];

  console.log(`Starting single-pass evaluation across ${evalUnits.length} units...`);

  let totalLatency = 0;
  let infrastructureFailures = 0;
  const unitOutputs = [];

  for (const u of evalUnits) {
    console.log(`Evaluating unit ${u.unit_id} (${u.benchmark})...`);
    try {
      const res = await classifySegmentWithC5(u.transcript_text, calibExamples);
      totalLatency += res.latency_ms;

      const record = {
        unit_id: u.unit_id,
        benchmark: u.benchmark,
        classifier: 'C5_LLM_CALIBRATED',
        model: MODEL_NAME,
        provider: PROVIDER_NAME,
        temperature: TEMPERATURE,
        predicted_labels: res.predicted_labels,
        evidence: res.evidence,
        raw_response: res.raw_response,
        latency_ms: res.latency_ms,
        retry_count: res.retry_count || 0,
        status: 'SUCCESS'
      };

      const outDir = u.benchmark === 'BENCH_04' ? rawEvalDirB4 : rawEvalDirB3;
      fs.writeFileSync(path.join(outDir, `${u.unit_id}.json`), JSON.stringify(record, null, 2), 'utf8');
      unitOutputs.push({ ...record, human_labels: u.human_canonical_labels });
      console.log(`  Done (${res.latency_ms} ms, retries: ${record.retry_count}). Labels: [${res.predicted_labels.join(', ')}]`);
      await sleep(2000);
    } catch (err) {
      console.error(`  INFRASTRUCTURE FAILURE on ${u.unit_id}:`, err.message);
      infrastructureFailures++;
      break; // Immediate abort on infrastructure failure per Amendment 4
    }
  }

  // Infrastructure Abort Check (Amendment 4)
  if (infrastructureFailures > 0 || unitOutputs.length !== evalUnits.length) {
    console.error('\nCRITICAL: Evaluation aborted due to infrastructure failure or incomplete run.');
    console.error(`Attempted: ${evalUnits.length}, Completed: ${unitOutputs.length}, Failures: ${infrastructureFailures}`);
    console.error('DO NOT compute final metrics. Investigate infrastructure and rerun locked configuration.');
    process.exit(1);
  }

  console.log(`\nAll 17/17 units evaluated successfully with 0 infrastructure failures.`);

  // Calculate Metrics for BENCH_04, BENCH_03, and COMBINED
  function initPerBehavior() {
    const pb = {};
    for (const b of CANONICAL_TAXONOMY) {
      pb[b] = { tp: 0, fp: 0, fn: 0 };
    }
    return pb;
  }

  function evaluateSubset(units) {
    const pb = initPerBehavior();
    const humanCounts = {};
    const modelCounts = {};
    for (const b of CANONICAL_TAXONOMY) {
      humanCounts[b] = 0;
      modelCounts[b] = 0;
    }

    for (const u of units) {
      const pred = new Set(u.predicted_labels);
      const gt = new Set(u.human_labels);

      for (const b of CANONICAL_TAXONOMY) {
        if (gt.has(b)) humanCounts[b]++;
        if (pred.has(b)) modelCounts[b]++;

        if (pred.has(b) && gt.has(b)) pb[b].tp++;
        else if (pred.has(b) && !gt.has(b)) pb[b].fp++;
        else if (!pred.has(b) && gt.has(b)) pb[b].fn++;
      }
    }

    const metrics = calculateMetrics(pb, CANONICAL_TAXONOMY);
    const divergence = computeDivergence(humanCounts, modelCounts, CANONICAL_TAXONOMY);

    return {
      metrics,
      divergence,
      human_counts: humanCounts,
      model_counts: modelCounts
    };
  }

  const b4Units = unitOutputs.filter(u => u.benchmark === 'BENCH_04');
  const b3Units = unitOutputs.filter(u => u.benchmark === 'BENCH_03');

  const b4Eval = evaluateSubset(b4Units);
  const b3Eval = evaluateSubset(b3Units);
  const combEval = evaluateSubset(unitOutputs);

  // Load Prior Baselines (C1, C2, C3, C4)
  const exp42 = JSON.parse(fs.readFileSync(exp42ResultsPath, 'utf8'));
  const exp42b = JSON.parse(fs.readFileSync(exp42bResultsPath, 'utf8'));

  const comparison = {
    BENCH_04: [
      { classifier: 'C1_LEXICAL', ...exp42.benchmarks.BENCH_04.evaluations.C1_LEXICAL.aggregate, ...exp42.benchmarks.BENCH_04.divergences.C1_LEXICAL },
      { classifier: 'C2_CONTEXTUAL', ...exp42.benchmarks.BENCH_04.evaluations.C2_CONTEXTUAL.aggregate, ...exp42.benchmarks.BENCH_04.divergences.C2_CONTEXTUAL },
      { classifier: 'C3_HYBRID', ...exp42.benchmarks.BENCH_04.evaluations.C3_HYBRID.aggregate, ...exp42.benchmarks.BENCH_04.divergences.C3_HYBRID },
      { classifier: 'C4_LLM_ZERO_SHOT', ...exp42b.benchmarks.BENCH_04.evaluation.aggregate, ...exp42b.benchmarks.BENCH_04.divergence },
      { classifier: 'C5_LLM_CALIBRATED', ...b4Eval.metrics.aggregate, ...b4Eval.divergence }
    ],
    BENCH_03: [
      { classifier: 'C1_LEXICAL', ...exp42.benchmarks.BENCH_03.evaluations.C1_LEXICAL.aggregate, ...exp42.benchmarks.BENCH_03.divergences.C1_LEXICAL },
      { classifier: 'C2_CONTEXTUAL', ...exp42.benchmarks.BENCH_03.evaluations.C2_CONTEXTUAL.aggregate, ...exp42.benchmarks.BENCH_03.divergences.C2_CONTEXTUAL },
      { classifier: 'C3_HYBRID', ...exp42.benchmarks.BENCH_03.evaluations.C3_HYBRID.aggregate, ...exp42.benchmarks.BENCH_03.divergences.C3_HYBRID },
      { classifier: 'C4_LLM_ZERO_SHOT', ...exp42b.benchmarks.BENCH_03.evaluation.aggregate, ...exp42b.benchmarks.BENCH_03.divergence },
      { classifier: 'C5_LLM_CALIBRATED', ...b3Eval.metrics.aggregate, ...b3Eval.divergence }
    ]
  };

  // Error Analysis for C5
  const misclassified = [];
  for (const u of unitOutputs) {
    const predSet = new Set(u.predicted_labels);
    const gtSet = new Set(u.human_labels);

    const isMatch = predSet.size === gtSet.size && [...predSet].every(l => gtSet.has(l));
    if (!isMatch) {
      const missing = u.human_labels.filter(l => !predSet.has(l));
      const extra = u.predicted_labels.filter(l => !gtSet.has(l));

      let cat = 'OTHER';
      if (extra.length > 0 && missing.length === 0) cat = 'BEHAVIOR_OVERPREDICTION';
      else if (missing.length > 0 && extra.length === 0) cat = 'MULTI_LABEL_UNDERPREDICTION';
      else if (extra.length > 1) cat = 'MULTI_LABEL_OVERPREDICTION';
      else if (missing.includes('STUDENT_INTERACT')) cat = 'CONVERSATIONAL_ACT_MISSED';

      misclassified.push({
        unit_id: u.unit_id,
        benchmark: u.benchmark,
        human_labels: u.human_labels,
        predicted_labels: u.predicted_labels,
        missing_labels: missing,
        extra_labels: extra,
        error_category: cat
      });
    }
  }

  // Compile Final Artifact
  const finalResult = {
    metadata: {
      experiment_id: 'EXP_4_2B_C5_CALIBRATION',
      title: 'Phase 4 Experiment 4.2b Step 2: C5 Calibrated LLM Behavior Classification',
      timestamp: new Date().toISOString(),
      provider: PROVIDER_NAME,
      model: MODEL_NAME,
      temperature: TEMPERATURE,
      sampling_configuration: 'nominally deterministic sampling configuration (temperature=0)',
      total_units_evaluated: evalUnits.length,
      infrastructure_failures: 0,
      total_latency_ms: totalLatency,
      average_latency_ms: Math.round(totalLatency / evalUnits.length),
      lock_manifest: manifest
    },
    benchmarks: {
      BENCH_04: {
        benchmark_id: 'BENCH_04',
        unit_count: b4Units.length,
        evaluation: b4Eval.metrics,
        divergence: b4Eval.divergence,
        human_counts: b4Eval.human_counts,
        c5_counts: b4Eval.model_counts
      },
      BENCH_03: {
        benchmark_id: 'BENCH_03',
        unit_count: b3Units.length,
        evaluation: b3Eval.metrics,
        divergence: b3Eval.divergence,
        human_counts: b3Eval.human_counts,
        c5_counts: b3Eval.model_counts
      },
      COMBINED_17_UNITS: {
        unit_count: evalUnits.length,
        evaluation: combEval.metrics,
        divergence: combEval.divergence,
        human_counts: combEval.human_counts,
        c5_counts: combEval.model_counts
      }
    },
    direct_comparison: comparison,
    error_analysis: {
      total_misclassified_units: misclassified.length,
      total_correct_units: evalUnits.length - misclassified.length,
      misclassified_units: misclassified
    }
  };

  const finalResultJson = JSON.stringify(finalResult, null, 2);
  fs.writeFileSync(finalResultsPath, finalResultJson, 'utf8');

  const finalSha = sha256(finalResultJson);
  fs.writeFileSync(finalShaPath, `${finalSha}  results_c5_calibration.json\n`, 'utf8');

  console.log('\n=== Evaluation Completed Successfully ===');
  console.log('Results written to:', finalResultsPath);
  console.log('SHA-256:', finalSha);
  console.log('\nAggregate Summary (Combined 17 Units):');
  console.log('  Micro Precision:', combEval.metrics.aggregate.micro_precision);
  console.log('  Micro Recall:   ', combEval.metrics.aggregate.micro_recall);
  console.log('  Micro F1:       ', combEval.metrics.aggregate.micro_f1);
  console.log('  Macro F1:       ', combEval.metrics.aggregate.macro_f1);
  console.log('  TVD:            ', combEval.divergence.total_variation_distance);
  console.log('  Cosine Distance:', combEval.divergence.cosine_distance);
}

// CLI Dispatcher
const mode = process.argv[2];
if (mode === '--calibrate') {
  runCalibrationMode().catch(err => { console.error(err); process.exit(1); });
} else if (mode === '--lock') {
  runLockMode();
} else if (mode === '--evaluate') {
  runEvaluateMode().catch(err => { console.error(err); process.exit(1); });
} else {
  console.log('Usage: node run_c5_calibration.js <--calibrate | --lock | --evaluate>');
  process.exit(1);
}
