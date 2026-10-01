/**
 * experiments/experiment_4_2b/run_experiment_4_2b.js
 *
 * Phase 4 Experiment 4.2b — Step 1:
 * Frozen 17-Unit Zero-Shot LLM Behavior Classification.
 *
 * Evaluates:
 *   - C4_LLM_ZERO_SHOT: Zero-shot taxonomy-guided LLM classifier (openai/gpt-oss-120b on Groq)
 * Against the frozen 17-unit ground truth from Experiment 4.2:
 *   - BENCH_04: 10 units (GT-G00 to GT-G09)
 *   - BENCH_03: 7 units (GT-D01 to GT-D07)
 *
 * Zero production modifications.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

// Paths
const gtPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2/ground_truth/behavior_annotations.json');
const exp42ResultsPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2/results_experiment_4_2.json');
const outDir = path.resolve(DemoProjectDir, 'experiments/experiment_4_2b');
const rawOutDirB4 = path.join(outDir, 'raw_outputs/BENCH_04');
const rawOutDirB3 = path.join(outDir, 'raw_outputs/BENCH_03');

fs.mkdirSync(rawOutDirB4, { recursive: true });
fs.mkdirSync(rawOutDirB3, { recursive: true });

// Load Ground Truth & Experiment 4.2 Results
const groundTruth = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
const exp42Results = JSON.parse(fs.readFileSync(exp42ResultsPath, 'utf8'));

const TAXONOMY = groundTruth.taxonomy;

// Groq Runtime
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL_NAME = process.env.GROQ_MODEL || process.env.DEFAULT_LLM_MODEL || 'openai/gpt-oss-120b';
const PROVIDER_NAME = 'groq';
const TEMPERATURE = 0;

// Prompt Contract
const SYSTEM_PROMPT = `You are a teaching-behavior annotation classifier.

Given one transcript segment from a lecture, assign zero or more labels from the supplied canonical taxonomy.

Classify observable teaching behavior only.

Do not infer hidden psychological intent.

Do not infer question-generation strategy.

Use the transcript evidence itself.

Multiple labels are allowed when multiple observable behaviors are genuinely present.

Do not add labels merely because a behavior is plausible from the subject matter.

Return only labels supported by the transcript.

Canonical labels:

EXPLAIN:
Teacher explains, defines, introduces, or clarifies a concept.

DEMONSTRATE:
Teacher demonstrates a procedure, command, worked example, or concrete operation.

COMPARE:
Teacher explicitly contrasts two or more alternatives, approaches, mechanisms, or outcomes.

DEBUG:
Teacher identifies, diagnoses, or corrects an error, misconception, bug, or failed approach.

PREDICT_CHANGE:
Teacher asks or discusses what would happen if a value, condition, implementation, or situation were changed.

ASK_WHY:
Teacher explicitly asks or reasons about why something happens or why a particular behavior occurs.

PRACTICE:
Teacher provides or performs an exercise, repetition, guided practice, or student practice activity.

REAL_WORLD_APP:
Teacher explicitly connects the taught concept to a real-world or practical application.

EDGE_CASE:
Teacher explicitly examines a boundary condition, exceptional case, limiting case, or unusual input.

CODE_TRACE:
Teacher explicitly traces program execution, variable/state changes, control flow, recursion, stack behavior, or code execution step by step.

STUDENT_INTERACT:
Observable interaction with students, including responding to a student question, eliciting a student response, checking student understanding, or dialogue directed toward a student.

REINFORCE:
Teacher explicitly reiterates, emphasizes, summarizes, or reinforces an important previously established point.

Rules:

1. Use only the transcript segment.
2. Do not use outside subject knowledge to invent a behavior.
3. Do not infer latent intent.
4. Multiple labels are permitted.
5. Be conservative: absence of evidence means absence of the label.
6. Return valid JSON only.

Output:

{
  "labels": ["LABEL1", "LABEL2"],
  "evidence": [
    {
      "label": "LABEL1",
      "quote": "short exact supporting phrase"
    }
  ]
}`;

// Single Unit Classifier Call with Retries
async function classifyUnitWithLLM(unit, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    const startTime = Date.now();
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Transcript Segment (Unit ID: ${unit.unit_id}, Topic: "${unit.title}"):\n"""\n${unit.transcript_text}\n"""\n\nReturn JSON output adhering strictly to the schema.`
          }
        ],
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' }
      });

      const latencyMs = Date.now() - startTime;
      const rawText = completion.choices[0].message.content;
      const parsed = JSON.parse(rawText);

      // Validate labels against canonical taxonomy
      const rawLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
      const validLabels = rawLabels
        .map(l => String(l).trim().toUpperCase())
        .filter(l => TAXONOMY.includes(l));
      const deduplicatedLabels = Array.from(new Set(validLabels));

      return {
        unit_id: unit.unit_id,
        benchmark: unit.benchmark,
        classifier: 'C4_LLM_ZERO_SHOT',
        model: MODEL_NAME,
        provider: PROVIDER_NAME,
        temperature: TEMPERATURE,
        predicted_labels: deduplicatedLabels,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        raw_response: rawText,
        latency_ms: latencyMs,
        retry_count: attempt,
        status: 'SUCCESS'
      };
    } catch (err) {
      attempt++;
      lastError = err;
      console.warn(`Attempt ${attempt} failed for ${unit.unit_id}: ${err.message}`);
      if (attempt <= maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  return {
    unit_id: unit.unit_id,
    benchmark: unit.benchmark,
    classifier: 'C4_LLM_ZERO_SHOT',
    model: MODEL_NAME,
    provider: PROVIDER_NAME,
    temperature: TEMPERATURE,
    predicted_labels: [],
    evidence: [],
    raw_response: null,
    latency_ms: 0,
    retry_count: attempt,
    status: 'FAILURE',
    error: lastError ? lastError.message : 'Unknown error'
  };
}

// Evaluation Metrics Calculator
function evaluateClassifierAgainstGT(predictionsByUnit, groundTruthUnits) {
  const perBehavior = {};
  for (const label of TAXONOMY) {
    perBehavior[label] = { tp: 0, fp: 0, fn: 0, tn: 0 };
  }

  groundTruthUnits.forEach((u, idx) => {
    const trueLabels = new Set(u.human_canonical_labels);
    const predLabels = new Set(predictionsByUnit[idx]);

    for (const label of TAXONOMY) {
      const isTrue = trueLabels.has(label);
      const isPred = predLabels.has(label);

      if (isTrue && isPred) perBehavior[label].tp++;
      else if (!isTrue && isPred) perBehavior[label].fp++;
      else if (isTrue && !isPred) perBehavior[label].fn++;
      else perBehavior[label].tn++;
    }
  });

  const behaviorMetrics = {};
  let macroP = 0, macroR = 0, macroF1 = 0;
  let activeClasses = 0;

  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (const label of TAXONOMY) {
    const { tp, fp, fn } = perBehavior[label];
    totalTP += tp;
    totalFP += fp;
    totalFN += fn;

    const p = (tp + fp) > 0 ? tp / (tp + fp) : 0.0;
    const r = (tp + fn) > 0 ? tp / (tp + fn) : 0.0;
    const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0.0;

    behaviorMetrics[label] = {
      tp, fp, fn,
      precision: parseFloat(p.toFixed(4)),
      recall: parseFloat(r.toFixed(4)),
      f1_score: parseFloat(f1.toFixed(4))
    };

    if ((tp + fn) > 0 || (tp + fp) > 0) {
      macroP += p;
      macroR += r;
      macroF1 += f1;
      activeClasses++;
    }
  }

  macroP = activeClasses > 0 ? macroP / activeClasses : 0.0;
  macroR = activeClasses > 0 ? macroR / activeClasses : 0.0;
  macroF1 = activeClasses > 0 ? macroF1 / activeClasses : 0.0;

  const microP = (totalTP + totalFP) > 0 ? totalTP / (totalTP + totalFP) : 0.0;
  const microR = (totalTP + totalFN) > 0 ? totalTP / (totalTP + totalFN) : 0.0;
  const microF1 = (microP + microR) > 0 ? (2 * microP * microR) / (microP + microR) : 0.0;

  return {
    per_behavior: behaviorMetrics,
    aggregate: {
      micro_precision: parseFloat(microP.toFixed(4)),
      micro_recall: parseFloat(microR.toFixed(4)),
      micro_f1: parseFloat(microF1.toFixed(4)),
      macro_precision: parseFloat(macroP.toFixed(4)),
      macro_recall: parseFloat(macroR.toFixed(4)),
      macro_f1: parseFloat(macroF1.toFixed(4)),
      active_classes_count: activeClasses
    }
  };
}

// Profile & Divergence Calculator
function calculateProfile(units, getLabelsFn) {
  const counts = {};
  for (const label of TAXONOMY) counts[label] = 0;

  let totalInstances = 0;
  units.forEach((u, idx) => {
    const labels = getLabelsFn(u, idx) || [];
    labels.forEach(l => {
      if (counts[l] !== undefined) {
        counts[l]++;
        totalInstances++;
      }
    });
  });

  const percentages = {};
  const probabilityVector = [];

  for (const label of TAXONOMY) {
    const pct = totalInstances > 0 ? (counts[label] / totalInstances) * 100 : 0.0;
    percentages[label] = parseFloat(pct.toFixed(2));
    probabilityVector.push(totalInstances > 0 ? counts[label] / totalInstances : 0.0);
  }

  return {
    total_instances: totalInstances,
    counts,
    percentages,
    probabilityVector
  };
}

function computeTVD(probP, probQ) {
  let sum = 0.0;
  for (let i = 0; i < probP.length; i++) {
    sum += Math.abs(probP[i] - probQ[i]);
  }
  return parseFloat((0.5 * sum).toFixed(4));
}

function computeCosineDistance(probP, probQ) {
  let dot = 0.0, normP = 0.0, normQ = 0.0;
  for (let i = 0; i < probP.length; i++) {
    dot += probP[i] * probQ[i];
    normP += probP[i] * probP[i];
    normQ += probQ[i] * probQ[i];
  }
  normP = Math.sqrt(normP);
  normQ = Math.sqrt(normQ);
  if (normP === 0 || normQ === 0) return 1.0;
  const sim = dot / (normP * normQ);
  return parseFloat((1.0 - Math.min(1.0, Math.max(0.0, sim))).toFixed(4));
}

// Error Analysis Classifier
function classifyErrorType(missing, extra) {
  if (missing.includes('STUDENT_INTERACT') || missing.includes('PRACTICE')) {
    return 'CONVERSATIONAL_ACT_MISSED';
  }
  if (missing.length > 0 && extra.length === 0) {
    return 'MULTI_LABEL_UNDERPREDICTION';
  }
  if (extra.length > 0 && missing.length === 0) {
    return 'BEHAVIOR_OVERPREDICTION';
  }
  if (missing.length > 0 && extra.length > 0) {
    return 'MULTI_LABEL_OVERPREDICTION';
  }
  return 'OTHER';
}

// Main Runner
async function runExperiment42b() {
  console.log('================================================================');
  console.log('EXPERIMENT 4.2b — STEP 1: ZERO-SHOT LLM BEHAVIOR CLASSIFICATION');
  console.log('Runtime:', MODEL_NAME, 'via', PROVIDER_NAME);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const b4Units = groundTruth.benchmarks.BENCH_04;
  const b3Units = groundTruth.benchmarks.BENCH_03;
  const all17Units = [...b4Units, ...b3Units];

  console.log(`Units to classify: ${b4Units.length} in BENCH_04 + ${b3Units.length} in BENCH_03 = ${all17Units.length} total.`);

  const b4Predictions = [];
  const b3Predictions = [];
  let infrastructureFailures = 0;
  let totalLatencyMs = 0;

  // 1. Process BENCH_04
  console.log('\n--- Classifying BENCH_04 (10 units) ---');
  for (const u of b4Units) {
    process.stdout.write(`  ${u.unit_id}... `);
    const rawPath = path.join(rawOutDirB4, `${u.unit_id}.json`);
    let pred;
    if (fs.existsSync(rawPath)) {
      pred = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
      console.log(`Loaded from disk (${pred.latency_ms} ms, ${pred.predicted_labels.join(', ')})`);
    } else {
      pred = await classifyUnitWithLLM(u);
      fs.writeFileSync(rawPath, JSON.stringify(pred, null, 2), 'utf8');
      console.log(`Done (${pred.latency_ms} ms, ${pred.predicted_labels.join(', ')})`);
    }
    b4Predictions.push(pred);
    if (pred.status !== 'SUCCESS') infrastructureFailures++;
    totalLatencyMs += (pred.latency_ms || 0);
  }

  // 2. Process BENCH_03
  console.log('\n--- Classifying BENCH_03 (7 units) ---');
  for (const u of b3Units) {
    process.stdout.write(`  ${u.unit_id}... `);
    const rawPath = path.join(rawOutDirB3, `${u.unit_id}.json`);
    let pred;
    if (fs.existsSync(rawPath)) {
      pred = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
      console.log(`Loaded from disk (${pred.latency_ms} ms, ${pred.predicted_labels.join(', ')})`);
    } else {
      pred = await classifyUnitWithLLM(u);
      fs.writeFileSync(rawPath, JSON.stringify(pred, null, 2), 'utf8');
      console.log(`Done (${pred.latency_ms} ms, ${pred.predicted_labels.join(', ')})`);
    }
    b3Predictions.push(pred);
    if (pred.status !== 'SUCCESS') infrastructureFailures++;
    totalLatencyMs += (pred.latency_ms || 0);
  }

  // 3. Evaluations
  const b4C4Preds = b4Predictions.map(p => p.predicted_labels);
  const b3C4Preds = b3Predictions.map(p => p.predicted_labels);
  const allC4Preds = [...b4C4Preds, ...b3C4Preds];

  const evalB4 = evaluateClassifierAgainstGT(b4C4Preds, b4Units);
  const evalB3 = evaluateClassifierAgainstGT(b3C4Preds, b3Units);
  const evalCombined = evaluateClassifierAgainstGT(allC4Preds, all17Units);

  // 4. Profiles
  const humanProfileB4 = calculateProfile(b4Units, u => u.human_canonical_labels);
  const c4ProfileB4 = calculateProfile(b4Units, (u, i) => b4C4Preds[i]);
  const divB4 = {
    total_variation_distance: computeTVD(humanProfileB4.probabilityVector, c4ProfileB4.probabilityVector),
    cosine_distance: computeCosineDistance(humanProfileB4.probabilityVector, c4ProfileB4.probabilityVector)
  };

  const humanProfileB3 = calculateProfile(b3Units, u => u.human_canonical_labels);
  const c4ProfileB3 = calculateProfile(b3Units, (u, i) => b3C4Preds[i]);
  const divB3 = {
    total_variation_distance: computeTVD(humanProfileB3.probabilityVector, c4ProfileB3.probabilityVector),
    cosine_distance: computeCosineDistance(humanProfileB3.probabilityVector, c4ProfileB3.probabilityVector)
  };

  const humanProfileCombined = calculateProfile(all17Units, u => u.human_canonical_labels);
  const c4ProfileCombined = calculateProfile(all17Units, (u, i) => allC4Preds[i]);
  const divCombined = {
    total_variation_distance: computeTVD(humanProfileCombined.probabilityVector, c4ProfileCombined.probabilityVector),
    cosine_distance: computeCosineDistance(humanProfileCombined.probabilityVector, c4ProfileCombined.probabilityVector)
  };

  // 5. Error Analysis across all 17 units
  const errorUnits = [];
  all17Units.forEach((u, i) => {
    const humanSet = new Set(u.human_canonical_labels);
    const predSet = new Set(allC4Preds[i]);

    const missing = u.human_canonical_labels.filter(l => !predSet.has(l));
    const extra = allC4Preds[i].filter(l => !humanSet.has(l));

    if (missing.length > 0 || extra.length > 0) {
      const errType = classifyErrorType(missing, extra);
      errorUnits.push({
        unit_id: u.unit_id,
        benchmark: u.benchmark,
        title: u.title,
        human_labels: u.human_canonical_labels,
        predicted_labels: allC4Preds[i],
        missing_labels: missing,
        extra_labels: extra,
        error_category: errType,
        short_transcript_excerpt: u.transcript_text.substring(0, 150) + '...'
      });
    }
  });

  // Group error counts
  const errorCategoryCounts = {};
  errorUnits.forEach(e => {
    errorCategoryCounts[e.error_category] = (errorCategoryCounts[e.error_category] || 0) + 1;
  });

  // 6. Direct Comparison with Experiment 4.2 C1, C2, C3
  // Extract frozen metrics from Experiment 4.2 results
  const exp42B4 = exp42Results.benchmarks.BENCH_04;
  const exp42B3 = exp42Results.benchmarks.BENCH_03;

  const comparisonTable = {
    BENCH_04: [
      {
        classifier: 'C1_LEXICAL',
        micro_precision: exp42B4.evaluations.C1_LEXICAL.aggregate.micro_precision,
        micro_recall: exp42B4.evaluations.C1_LEXICAL.aggregate.micro_recall,
        micro_f1: exp42B4.evaluations.C1_LEXICAL.aggregate.micro_f1,
        macro_precision: exp42B4.evaluations.C1_LEXICAL.aggregate.macro_precision,
        macro_recall: exp42B4.evaluations.C1_LEXICAL.aggregate.macro_recall,
        macro_f1: exp42B4.evaluations.C1_LEXICAL.aggregate.macro_f1,
        tvd: exp42B4.divergences.C1_LEXICAL.total_variation_distance,
        cosine_distance: exp42B4.divergences.C1_LEXICAL.cosine_distance
      },
      {
        classifier: 'C2_CONTEXTUAL',
        micro_precision: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.micro_precision,
        micro_recall: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.micro_recall,
        micro_f1: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.micro_f1,
        macro_precision: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.macro_precision,
        macro_recall: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.macro_recall,
        macro_f1: exp42B4.evaluations.C2_CONTEXTUAL.aggregate.macro_f1,
        tvd: exp42B4.divergences.C2_CONTEXTUAL.total_variation_distance,
        cosine_distance: exp42B4.divergences.C2_CONTEXTUAL.cosine_distance
      },
      {
        classifier: 'C3_HYBRID',
        micro_precision: exp42B4.evaluations.C3_HYBRID.aggregate.micro_precision,
        micro_recall: exp42B4.evaluations.C3_HYBRID.aggregate.micro_recall,
        micro_f1: exp42B4.evaluations.C3_HYBRID.aggregate.micro_f1,
        macro_precision: exp42B4.evaluations.C3_HYBRID.aggregate.macro_precision,
        macro_recall: exp42B4.evaluations.C3_HYBRID.aggregate.macro_recall,
        macro_f1: exp42B4.evaluations.C3_HYBRID.aggregate.macro_f1,
        tvd: exp42B4.divergences.C3_HYBRID.total_variation_distance,
        cosine_distance: exp42B4.divergences.C3_HYBRID.cosine_distance
      },
      {
        classifier: 'C4_LLM_ZERO_SHOT',
        micro_precision: evalB4.aggregate.micro_precision,
        micro_recall: evalB4.aggregate.micro_recall,
        micro_f1: evalB4.aggregate.micro_f1,
        macro_precision: evalB4.aggregate.macro_precision,
        macro_recall: evalB4.aggregate.macro_recall,
        macro_f1: evalB4.aggregate.macro_f1,
        tvd: divB4.total_variation_distance,
        cosine_distance: divB4.cosine_distance
      }
    ],
    BENCH_03: [
      {
        classifier: 'C1_LEXICAL',
        micro_precision: exp42B3.evaluations.C1_LEXICAL.aggregate.micro_precision,
        micro_recall: exp42B3.evaluations.C1_LEXICAL.aggregate.micro_recall,
        micro_f1: exp42B3.evaluations.C1_LEXICAL.aggregate.micro_f1,
        macro_precision: exp42B3.evaluations.C1_LEXICAL.aggregate.macro_precision,
        macro_recall: exp42B3.evaluations.C1_LEXICAL.aggregate.macro_recall,
        macro_f1: exp42B3.evaluations.C1_LEXICAL.aggregate.macro_f1,
        tvd: exp42B3.divergences.C1_LEXICAL.total_variation_distance,
        cosine_distance: exp42B3.divergences.C1_LEXICAL.cosine_distance
      },
      {
        classifier: 'C2_CONTEXTUAL',
        micro_precision: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.micro_precision,
        micro_recall: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.micro_recall,
        micro_f1: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.micro_f1,
        macro_precision: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.macro_precision,
        macro_recall: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.macro_recall,
        macro_f1: exp42B3.evaluations.C2_CONTEXTUAL.aggregate.macro_f1,
        tvd: exp42B3.divergences.C2_CONTEXTUAL.total_variation_distance,
        cosine_distance: exp42B3.divergences.C2_CONTEXTUAL.cosine_distance
      },
      {
        classifier: 'C3_HYBRID',
        micro_precision: exp42B3.evaluations.C3_HYBRID.aggregate.micro_precision,
        micro_recall: exp42B3.evaluations.C3_HYBRID.aggregate.micro_recall,
        micro_f1: exp42B3.evaluations.C3_HYBRID.aggregate.micro_f1,
        macro_precision: exp42B3.evaluations.C3_HYBRID.aggregate.macro_precision,
        macro_recall: exp42B3.evaluations.C3_HYBRID.aggregate.macro_recall,
        macro_f1: exp42B3.evaluations.C3_HYBRID.aggregate.macro_f1,
        tvd: exp42B3.divergences.C3_HYBRID.total_variation_distance,
        cosine_distance: exp42B3.divergences.C3_HYBRID.cosine_distance
      },
      {
        classifier: 'C4_LLM_ZERO_SHOT',
        micro_precision: evalB3.aggregate.micro_precision,
        micro_recall: evalB3.aggregate.micro_recall,
        micro_f1: evalB3.aggregate.micro_f1,
        macro_precision: evalB3.aggregate.macro_precision,
        macro_recall: evalB3.aggregate.macro_recall,
        macro_f1: evalB3.aggregate.macro_f1,
        tvd: divB3.total_variation_distance,
        cosine_distance: divB3.cosine_distance
      }
    ]
  };

  // 7. Problematic Behaviors Specific Inspection
  const problematicBehaviors = ['STUDENT_INTERACT', 'PRACTICE', 'DEBUG', 'CODE_TRACE', 'EDGE_CASE'];
  const problematicInspection = problematicBehaviors.map(beh => {
    // In BENCH_03 where these primarily occur
    const hCount = exp42B3.evaluations.C1_LEXICAL.per_behavior[beh].tp + exp42B3.evaluations.C1_LEXICAL.per_behavior[beh].fn;
    return {
      behavior: beh,
      bench03_human_support: hCount,
      c1_f1: exp42B3.evaluations.C1_LEXICAL.per_behavior[beh].f1_score,
      c2_f1: exp42B3.evaluations.C2_CONTEXTUAL.per_behavior[beh].f1_score,
      c3_f1: exp42B3.evaluations.C3_HYBRID.per_behavior[beh].f1_score,
      c4_f1: evalB3.per_behavior[beh].f1_score,
      c4_precision: evalB3.per_behavior[beh].precision,
      c4_recall: evalB3.per_behavior[beh].recall
    };
  });

  // Construct Final Machine-Readable JSON
  const finalResults = {
    metadata: {
      experiment_id: 'EXP_4_2B_ZERO_SHOT_LLM',
      title: 'Experiment 4.2b — Step 1: Frozen 17-Unit Zero-Shot LLM Behavior Classification',
      timestamp: new Date().toISOString(),
      provider: PROVIDER_NAME,
      model: MODEL_NAME,
      temperature: TEMPERATURE,
      total_units_evaluated: all17Units.length,
      infrastructure_failures: infrastructureFailures,
      total_latency_ms: totalLatencyMs,
      average_latency_ms: Math.round(totalLatencyMs / all17Units.length)
    },
    benchmarks: {
      BENCH_04: {
        benchmark_id: 'BENCH_04',
        unit_count: b4Units.length,
        evaluation: evalB4,
        human_profile: humanProfileB4,
        c4_profile: c4ProfileB4,
        divergence: divB4,
        units: b4Predictions
      },
      BENCH_03: {
        benchmark_id: 'BENCH_03',
        unit_count: b3Units.length,
        evaluation: evalB3,
        human_profile: humanProfileB3,
        c4_profile: c4ProfileB3,
        divergence: divB3,
        units: b3Predictions
      },
      COMBINED_17_UNITS: {
        unit_count: all17Units.length,
        evaluation: evalCombined,
        human_profile: humanProfileCombined,
        c4_profile: c4ProfileCombined,
        divergence: divCombined
      }
    },
    direct_comparison: comparisonTable,
    problematic_behaviors_inspection: problematicInspection,
    error_analysis: {
      total_misclassified_units: errorUnits.length,
      total_correct_units: all17Units.length - errorUnits.length,
      category_breakdown: errorCategoryCounts,
      misclassified_units: errorUnits
    }
  };

  // Write results_experiment_4_2b.json
  const outJsonPath = path.join(outDir, 'results_experiment_4_2b.json');
  const jsonStr = JSON.stringify(finalResults, null, 2);
  fs.writeFileSync(outJsonPath, jsonStr, 'utf8');

  // Compute SHA-256
  const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');
  const shaPath = path.join(outDir, 'results_experiment_4_2b.sha256');
  fs.writeFileSync(shaPath, sha256 + '  results_experiment_4_2b.json\n', 'utf8');

  // Copy run script to experiments directory for self-containment
  const runScriptContent = fs.readFileSync(__filename, 'utf8');
  fs.writeFileSync(path.join(outDir, 'run_experiment_4_2b.js'), runScriptContent, 'utf8');

  console.log('\n================================================================');
  console.log('EXPERIMENT 4.2b STEP 1 COMPLETED SUCCESSFULLY');
  console.log('Output JSON:', outJsonPath);
  console.log('Artifact SHA-256:', sha256);
  console.log('Units classified:', all17Units.length, '| Failures:', infrastructureFailures);
  console.log('================================================================');

  return { finalResults, sha256 };
}

runExperiment42b().catch(err => {
  console.error('Experiment 4.2b Step 1 failed:', err);
  process.exit(1);
});
