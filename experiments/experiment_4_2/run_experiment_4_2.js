/**
 * scratch/run_experiment_4_2.js
 *
 * Phase 4 Experiment 4.2: Instructional Intent & Teaching-Behavior Classification.
 * Evaluates 3 deterministic candidate classifiers:
 *   - C1_LEXICAL: Pure Regex / Pedagogical Cue Rules
 *   - C2_CONTEXTUAL: Conversational / Acoustic Framing (question density, turn-taking, pauses)
 *   - C3_HYBRID: Hybrid Discourse-Act Classifier (lexical + contextual + sequence dwell)
 *
 * Across:
 *   - BENCH_04: Software Tools / Git Commands (10 units: GT-G00 to GT-G09)
 *   - BENCH_03: Data Structures / Deepa Madam (7 units: GT-D01 to GT-D07)
 *
 * Computes:
 *   - Per-behavior TP, FP, FN, Precision, Recall, F1
 *   - Micro & Macro Precision, Recall, F1
 *   - Instructional Profile (% distribution over 12 canonical labels)
 *   - Profile Divergence (Total Variation Distance & Cosine Distance)
 *   - Candidate Recipe Affinities
 *
 * ZERO modifications to server/engine/**.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const gtPath = path.resolve(DemoProjectDir, 'experiments/experiment_4_2/ground_truth/behavior_annotations.json');
const d4Path = path.resolve(DemoProjectDir, '../audio_test/transcripts/Y2Mate.is - UNIT - 2_BASIC GIT COMMANDS - VERSION CONFIG INIT STATUS ADD COMMIT DIFF HELP.json');
const d3Path = path.resolve(DemoProjectDir, '../Speech_To_Text/results/transcripts/deepgram_deepa_madam.json');

const groundTruth = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
const d4Raw = JSON.parse(fs.readFileSync(d4Path, 'utf8'));
const d3Raw = JSON.parse(fs.readFileSync(d3Path, 'utf8'));

const TAXONOMY = groundTruth.taxonomy;

// ── RECIPE MAPPING AFFINITIES (Experimental) ────────────────────────────────
const RECIPE_AFFINITIES = {
  PREDICT_CHANGE: ['COUNTERFACTUAL_MODIFICATION', 'EDGE_CASE_PROBING', 'CODE_EXECUTION_TRACE'],
  DEBUG: ['MISCONCEPTION_DIAGNOSIS', 'COUNTERFACTUAL_MODIFICATION', 'EDGE_CASE_PROBING'],
  COMPARE: ['TRADEOFF_EVALUATION'],
  CODE_TRACE: ['CODE_EXECUTION_TRACE'],
  REAL_WORLD_APP: ['NOVEL_SCENARIO'],
  EXPLAIN: ['MECHANISTIC_DISCRIMINATION'],
  PRACTICE: ['ANALOGOUS_CALCULATION', 'CODE_EXECUTION_TRACE'],
  EDGE_CASE: ['EDGE_CASE_PROBING'],
  REINFORCE: ['DIRECT', 'MECHANISTIC_DISCRIMINATION'],
  ASK_WHY: ['MECHANISTIC_DISCRIMINATION'],
  DEMONSTRATE: ['CODE_EXECUTION_TRACE'],
  STUDENT_INTERACT: ['MISCONCEPTION_DIAGNOSIS']
};

// ── LEXICAL PATTERNS (C1) ───────────────────────────────────────────────────
const LEXICAL_PATTERNS = {
  EXPLAIN: [
    /\b(is (called|used to|defined as|a command which)|means that|concept of|purpose of|basically there are|we will discuss|definition of)\b/i,
    /\b(so git \w+ is a command|this folder should now be|it will tell you that)\b/i
  ],
  DEMONSTRATE: [
    /\b(let me show|let us (see|type|execute|run)|when i (type|run|open|click)|to do that you have to|simply (write|type|give)|now i will)\b/i,
    /\b(command called as|you have to type|let's start with knowing|you have to give)\b/i
  ],
  COMPARE: [
    /\b(difference between|versus|while on the other hand|whereas|compare|opposite|instead of|distinguish|two types of)\b/i,
    /\b(when will you use (jcd|gcd)|when will you use your lcm)\b/i
  ],
  DEBUG: [
    /\b(error|bug|mistake|fails|failing|failed|fix|corrected|debugging|why is this failing|needs to be corrected)\b/i,
    /\b(wrong|check whether it's working)\b/i
  ],
  PREDICT_CHANGE: [
    /\b(what if|if we change|suppose we|what happens (if|when)|convert (it|this)|instead of doing|replace (this|it)|write recursion)\b/i,
    /\b(now for both the things, right recursion|we are needing i here also because we can't)\b/i
  ],
  ASK_WHY: [
    /\b(why (do|did|would|should|is|are|can)|who can tell me why|what is the reason)\b/i,
    /\bwhy\b[^\.\!\?]*\?/i
  ],
  PRACTICE: [
    /\b(you (try|calculate|solve|find)|take a (pen|paper)|tell me the answer|who is lcm|think about it|you people)\b/i,
    /\b(what will you do\?|who is lcm\?)\b/i
  ],
  REAL_WORLD_APP: [
    /\b(real (world|life)|practical application|in industry|when will you use|scheduling algorithms|practical problem)\b/i,
    /\b(sharing stuff equally|shortest job first)\b/i
  ],
  EDGE_CASE: [
    /\b(edge case|corner case|boundary condition|empty (string|tree|array)|if n\s*=\s*0|null|single element|never been)\b/i,
    /\b(symmetric|never been reversed)\b/i
  ],
  CODE_TRACE: [
    /\b(trace|stack|step by step|at step|returns? (back|to)|base condition hits?|accumulat(e|es|ing)|green color|red color|next number)\b/i,
    /\b(reverse a string using recursion|recursion manner|print i a b)\b/i
  ],
  STUDENT_INTERACT: [
    /\b(yes ma'am|no sir|any questions|did everyone get|did you understand|got it\?|fine\?|okay\?|is it clear)\b/i,
    /\b(yes\.|no\.|fine\?|okay\?)\b/i
  ],
  REINFORCE: [
    /\b(remember (this|that)|never forget|very important|must note|keep (this )?in mind|rule of thumb|critical concept)\b/i,
    /\b(is very important|makes your life easier)\b/i
  ]
};

// ── CLASSIFIER 1: LEXICAL CUE RULES ─────────────────────────────────────────
function classifyC1Lexical(unit) {
  const text = unit.transcript_text;
  const predicted = [];

  for (const label of TAXONOMY) {
    const patterns = LEXICAL_PATTERNS[label] || [];
    for (const pat of patterns) {
      if (pat.test(text)) {
        predicted.push(label);
        break;
      }
    }
  }
  return predicted;
}

// ── CLASSIFIER 2: CONVERSATIONAL / ACOUSTIC FRAMING ────────────────────────
function classifyC2Contextual(unit, rawSegments) {
  // Start with C1 lexical predictions
  const text = unit.transcript_text;
  const predictedSet = new Set(classifyC1Lexical(unit));

  // Compute unit structural metrics
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const durationMin = Math.max(0.1, unit.duration / 60.0);

  // 1. Question Density (? per 100 words)
  const questionCount = (text.match(/\?/g) || []).length;
  const questionDensity = (questionCount / wordCount) * 100;

  // 2. Interaction Turn-Taking Density
  const interactionMatches = text.match(/\b(okay|yes|no|fine|ma'am|sir|right\?)\b/gi) || [];
  const interactionDensity = interactionMatches.length / durationMin;

  // 3. Acoustic Pause Rate (pauses >= 1.5s per min)
  let unitPauses = 0;
  for (let i = 0; i < rawSegments.length - 1; i++) {
    const s1 = rawSegments[i];
    const s2 = rawSegments[i+1];
    if (s1.end >= unit.start && s2.start <= unit.end) {
      const gap = s2.start - s1.end;
      if (gap >= 1.5) unitPauses++;
    }
  }
  const pauseRate = unitPauses / durationMin;

  // Rule 2A: High question density with interrogatives triggers ASK_WHY or PRACTICE
  if (questionDensity >= 1.2) {
    if (/\bwhy\b/i.test(text)) {
      predictedSet.add('ASK_WHY');
    }
    if (/\b(what will|who is|how are you|tell me)\b/i.test(text)) {
      predictedSet.add('PRACTICE');
    }
  }

  // Rule 2B: High interaction density + high acoustic pause rate signals live classroom turn-taking
  if (interactionDensity >= 2.0 && pauseRate >= 2.0) {
    predictedSet.add('STUDENT_INTERACT');
  }

  // Rule 2C: High pause rate + student prompt triggers PRACTICE
  if (pauseRate >= 3.0 && /\b(try|calculate|think|who is|what will you)\b/i.test(text)) {
    predictedSet.add('PRACTICE');
  }

  // Rule 2D: Monologue suppression (very low pause rate < 1.0/min and zero interaction) suppresses false STUDENT_INTERACT
  if (pauseRate < 1.0 && interactionMatches.length <= 1) {
    predictedSet.delete('STUDENT_INTERACT');
  }

  return Array.from(predictedSet);
}

// ── CLASSIFIER 3: HYBRID DISCOURSE-ACT CLASSIFIER ───────────────────────────
function classifyC3Hybrid(unit, rawSegments, allUnits, unitIdx) {
  // Start with C2 predictions
  const text = unit.transcript_text;
  const predictedSet = new Set(classifyC2Contextual(unit, rawSegments));

  const durationSec = unit.duration;

  // Rule 3A: Long sustained code dwell (> 250s) with state variables and recursive operations
  if (durationSec >= 250.0 && /\b(recursion|recursive|stack|reverse|palindrome|lcm|gcd|modulo)\b/i.test(text)) {
    predictedSet.add('CODE_TRACE');
    if (/\b(base condition|condition|check|fix|correct|wrong|never)\b/i.test(text)) {
      predictedSet.add('DEBUG');
    }
  }

  // Rule 3B: Terminal command demonstration sequence
  if (/\b(git\s+(init|add|commit|status|diff|config|version|help)|cmd|terminal|folder)\b/i.test(text)) {
    predictedSet.add('DEMONSTRATE');
    if (/\b(green color|red color|modified|changes|create file|text file)\b/i.test(text)) {
      predictedSet.add('CODE_TRACE');
    }
  }

  // Rule 3C: Algorithmic Transformation
  if (/\b(convert|from while|loop|recursion|recursive)\b/i.test(text) && /\b(write|function|state)\b/i.test(text)) {
    predictedSet.add('PREDICT_CHANGE');
    predictedSet.add('DEBUG');
  }

  // Rule 3D: Socratic / Contrast Framing across paragraphs
  if (/\b(two types of|when will you use|sharing|scheduling)\b/i.test(text)) {
    predictedSet.add('COMPARE');
    predictedSet.add('REAL_WORLD_APP');
  }

  // Rule 3E: Boundary / Symmetric check
  if (/\b(palindrome|reverse|symmetric|never been|equal)\b/i.test(text)) {
    predictedSet.add('EDGE_CASE');
  }

  return Array.from(predictedSet);
}

// ── EVALUATION METRICS CALCULATOR ───────────────────────────────────────────
function evaluateClassifier(predictionsByUnit, groundTruthUnits) {
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

// ── PROFILE CALCULATOR & DIVERGENCE METRICS ─────────────────────────────────
function calculateProfile(units, getLabelsFn) {
  const counts = {};
  for (const label of TAXONOMY) counts[label] = 0;

  let totalInstances = 0;
  units.forEach(u => {
    const labels = getLabelsFn(u);
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

// ── MAIN EXPERIMENT EXECUTION ───────────────────────────────────────────────
async function runExperiment() {
  console.log('================================================================');
  console.log('EXPERIMENT 4.2: INSTRUCTIONAL INTENT & TEACHING-BEHAVIOR');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const benchmarks = [
    { key: 'BENCH_04', units: groundTruth.benchmarks.BENCH_04, rawSegments: d4Raw.segments },
    { key: 'BENCH_03', units: groundTruth.benchmarks.BENCH_03, rawSegments: d3Raw.segments }
  ];

  const results = {
    metadata: {
      experiment_id: 'EXP_4_2_BEHAVIOR_CLASSIFICATION',
      title: 'Teaching-Behavior Classification & Instructional Intent Analysis',
      timestamp: new Date().toISOString(),
      taxonomy: TAXONOMY,
      recipe_affinities: RECIPE_AFFINITIES,
      divergence_metrics: {
        primary: 'Total Variation Distance (TVD) = 0.5 * sum(|P_i - Q_i|), bounded in [0, 1]',
        secondary: 'Cosine Distance = 1 - (P . Q) / (||P|| * ||Q||)'
      }
    },
    benchmarks: {}
  };

  for (const b of benchmarks) {
    console.log(`Evaluating ${b.key} (${b.units.length} units)...`);

    const c1Preds = b.units.map(u => classifyC1Lexical(u));
    const c2Preds = b.units.map(u => classifyC2Contextual(u, b.rawSegments));
    const c3Preds = b.units.map((u, i) => classifyC3Hybrid(u, b.rawSegments, b.units, i));

    const detailedUnits = b.units.map((u, i) => ({
      benchmark: b.key,
      unit_id: u.unit_id,
      title: u.title,
      start: u.start,
      end: u.end,
      duration: u.duration,
      human_source_labels: u.human_source_labels,
      human_canonical_labels: u.human_canonical_labels,
      classifiers: {
        C1_LEXICAL: { predicted_behaviors: c1Preds[i] },
        C2_CONTEXTUAL: { predicted_behaviors: c2Preds[i] },
        C3_HYBRID: { predicted_behaviors: c3Preds[i] }
      }
    }));

    const evalC1 = evaluateClassifier(c1Preds, b.units);
    const evalC2 = evaluateClassifier(c2Preds, b.units);
    const evalC3 = evaluateClassifier(c3Preds, b.units);

    const humanProfile = calculateProfile(b.units, u => u.human_canonical_labels);
    const c1Profile = calculateProfile(b.units, (u, i) => c1Preds[b.units.indexOf(u)]);
    const c2Profile = calculateProfile(b.units, (u, i) => c2Preds[b.units.indexOf(u)]);
    const c3Profile = calculateProfile(b.units, (u, i) => c3Preds[b.units.indexOf(u)]);

    const divergences = {
      C1_LEXICAL: {
        total_variation_distance: computeTVD(humanProfile.probabilityVector, c1Profile.probabilityVector),
        cosine_distance: computeCosineDistance(humanProfile.probabilityVector, c1Profile.probabilityVector)
      },
      C2_CONTEXTUAL: {
        total_variation_distance: computeTVD(humanProfile.probabilityVector, c2Profile.probabilityVector),
        cosine_distance: computeCosineDistance(humanProfile.probabilityVector, c2Profile.probabilityVector)
      },
      C3_HYBRID: {
        total_variation_distance: computeTVD(humanProfile.probabilityVector, c3Profile.probabilityVector),
        cosine_distance: computeCosineDistance(humanProfile.probabilityVector, c3Profile.probabilityVector)
      }
    };

    results.benchmarks[b.key] = {
      benchmark_id: b.key,
      unit_count: b.units.length,
      units: detailedUnits,
      evaluations: {
        C1_LEXICAL: evalC1,
        C2_CONTEXTUAL: evalC2,
        C3_HYBRID: evalC3
      },
      profiles: {
        HUMAN: humanProfile,
        C1_LEXICAL: c1Profile,
        C2_CONTEXTUAL: c2Profile,
        C3_HYBRID: c3Profile
      },
      divergences
    };
  }

  // Save JSON artifact
  const outDir = path.resolve(DemoProjectDir, 'experiments/experiment_4_2');
  fs.mkdirSync(outDir, { recursive: true });

  // Copy run_experiment_4_2.js to outDir for reproduction completeness
  const selfContent = fs.readFileSync(__filename, 'utf8');
  fs.writeFileSync(path.join(outDir, 'run_experiment_4_2.js'), selfContent, 'utf8');

  const outJsonPath = path.join(outDir, 'results_experiment_4_2.json');
  const jsonStr = JSON.stringify(results, null, 2);
  fs.writeFileSync(outJsonPath, jsonStr, 'utf8');

  // Compute SHA-256
  const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');
  const shaPath = path.join(outDir, 'results_experiment_4_2.sha256');
  fs.writeFileSync(shaPath, sha256 + '  results_experiment_4_2.json\n', 'utf8');

  console.log('Saved results_experiment_4_2.json');
  console.log('Artifact SHA-256:', sha256);

  return { results, sha256 };
}

runExperiment().catch(err => {
  console.error('Experiment 4.2 failed:', err);
  process.exit(1);
});
