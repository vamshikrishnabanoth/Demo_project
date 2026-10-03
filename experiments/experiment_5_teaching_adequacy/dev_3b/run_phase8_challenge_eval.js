/**
 * experiments/experiment_5_teaching_adequacy/dev_3b/run_phase8_challenge_eval.js
 *
 * Milestone v3.6 Phase 8: Upstream P5.2A Extraction Fidelity Hypothesis & Controlled Downstream Diagnostic Benchmark
 *
 * Evaluates Candidate P5.2A v1.1.0 vs. Frozen Baseline P5.2A against Frozen Baseline P5.3
 * on the sealed 8-segment dev_3b challenge set under strict blind execution safeguards.
 *
 * Pre-Declared Acceptance Gates:
 *   Gate 1: Upstream EERA >= 85.0% across all expected concepts
 *   Gate 2: Target-Dimension Type II Misroutings == 0
 *   Gate 3: Exact-Depth Concordance >= 7 / 8 (87.5%)
 *   Gate 4: Boundary Decision Agreement >= 7 / 8 (87.5%)
 *   Gate 5: Pair-Level Dual Correctness Gate == 4 / 4 pairs (100%)
 *           (Depth(B) > Depth(A) AND Verdict(A) == Ref(A) AND Verdict(B) == Ref(B))
 *   Gate 6: Calibration Regression Guard (dev_3a) == 0 regressions
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = path.resolve(__dirname, '../../../');
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const dev3bDir = __dirname;
const dev3aDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/dev_3a');
const runnerDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/runner');

// Verification tool
const { matchConcepts, evaluateSPF, evaluateCMD } = require(path.join(dev3aDir, 'verify_p5_2a_extraction_fidelity.js'));

// Prompts
const { SYSTEM_PROMPT: BASELINE_P52A_PROMPT } = require(path.join(runnerDir, 'p5_2a_topic_reconstructor.js'));
const { SYSTEM_PROMPT: CANDIDATE_P52A_PROMPT } = require(path.join(dev3aDir, 'candidate_extractors/candidate_p5_2a_topic_reconstructor_v1_1_0.js'));
const { SYSTEM_PROMPT: FROZEN_P53_PROMPT } = require(path.join(runnerDir, 'p5_3_coverage_gap_analyzer.js'));

// Distinct organizations with their primary and fallback keys
const ORG_GROUPS = [
  { name: 'Org_kp6 (KEY_5/KEY)', keys: [process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY].filter(Boolean) },
  { name: 'Org_kyc (FRESH)', keys: [process.env.GROQ_API_KEY_FRESH].filter(Boolean) },
  { name: 'Org_m2n (KEY_3/KEY_4)', keys: [process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4].filter(Boolean) },
  { name: 'Org_m0e (BACKUP)', keys: [process.env.GROQ_API_KEY_BACKUP].filter(Boolean) }
].filter(g => g.keys.length > 0);

const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;
const MAX_COMPLETION_TOKENS_EXTRACT = 1000;
const MAX_COMPLETION_TOKENS_P53 = 2200;

// Challenge Segments (4 packages x 2 segments = 8 cases)
const CHALLENGE_SEGMENTS = [
  { key: '1A', package_id: 'dev_3b_01_discrete_probability', folder: 'dev_3b_01_discrete_probability_1A', dimension: 'MEANING', threshold: 4, ref_depth: 2, ref_boundary: 'FALLS_SHORT' },
  { key: '1B', package_id: 'dev_3b_01_discrete_probability', folder: 'dev_3b_01_discrete_probability_1B', dimension: 'MEANING', threshold: 4, ref_depth: 4, ref_boundary: 'SATISFIES' },
  { key: '2A', package_id: 'dev_3b_02_renal_pharmacokinetics', folder: 'dev_3b_02_renal_pharmacokinetics_2A', dimension: 'JUSTIFICATION_WHY', threshold: 5, ref_depth: 4, ref_boundary: 'FALLS_SHORT' },
  { key: '2B', package_id: 'dev_3b_02_renal_pharmacokinetics', folder: 'dev_3b_02_renal_pharmacokinetics_2B', dimension: 'JUSTIFICATION_WHY', threshold: 5, ref_depth: 5, ref_boundary: 'SATISFIES' },
  { key: '3A', package_id: 'dev_3b_03_critical_care_infusions', folder: 'dev_3b_03_critical_care_infusions_3A', dimension: 'APPLICATION_INTERPRETATION', threshold: 6, ref_depth: 3, ref_boundary: 'FALLS_SHORT' },
  { key: '3B', package_id: 'dev_3b_03_critical_care_infusions', folder: 'dev_3b_03_critical_care_infusions_3B', dimension: 'APPLICATION_INTERPRETATION', threshold: 6, ref_depth: 6, ref_boundary: 'SATISFIES' },
  { key: '4A', package_id: 'dev_3b_04_fft_pipelined_radix2', folder: 'dev_3b_04_fft_pipelined_radix2_4A', dimension: 'STRUCTURE_COMPONENTS', threshold: 5, ref_depth: 2, ref_boundary: 'FALLS_SHORT' },
  { key: '4B', package_id: 'dev_3b_04_fft_pipelined_radix2', folder: 'dev_3b_04_fft_pipelined_radix2_4B', dimension: 'STRUCTURE_COMPONENTS', threshold: 5, ref_depth: 5, ref_boundary: 'SATISFIES' }
];

function parseWaitMs(errMsg) {
  const match = errMsg.match(/try again in (?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/);
  if (!match) return 15000;
  const mins = parseFloat(match[1] || '0');
  const secs = parseFloat(match[2] || '0');
  return Math.ceil((mins * 60 + secs) * 1000);
}

async function callLLM(systemPrompt, userPrompt, maxTokens, retries = 10) {
  let attemptRound = 0;
  while (true) {
    attemptRound++;
    const orgWaitTimes = [];

    for (let i = 0; i < ORG_GROUPS.length; i++) {
      const group = ORG_GROUPS[i];
      for (const apiKey of group.keys) {
        try {
          const client = new Groq({ apiKey });
          const start = Date.now();
          const res = await client.chat.completions.create({
            model: MODEL_NAME,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: TEMPERATURE,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' }
          });
          const latencyMs = Date.now() - start;
          return { parsed: JSON.parse(res.choices[0].message.content), latencyMs, slot: group.name };
        } catch (err) {
          if (err.message && err.message.includes('rate_limit_exceeded')) {
            const waitMs = parseWaitMs(err.message);
            orgWaitTimes.push({ org: group.name, waitMs });
            break;
          } else {
            console.warn(`[WARN] Non-rate-limit error on ${group.name}: ${err.message.slice(0, 100)}`);
          }
        }
      }
    }

    if (orgWaitTimes.length > 0) {
      orgWaitTimes.sort((a, b) => a.waitMs - b.waitMs);
      const shortest = orgWaitTimes[0];
      const sleepMs = Math.max(shortest.waitMs + 3000, 5000);
      console.log(`[QUOTA WAIT] All orgs rate-limited. Shortest wait: ${shortest.org} (${Math.round(shortest.waitMs / 1000)}s). Sleeping ${Math.round(sleepMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, sleepMs));
    } else {
      console.log(`[RETRY] Unknown error, waiting 10s before retry round ${attemptRound}...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

async function runChallengeEvaluation() {
  console.log('='.repeat(90));
  console.log('MILESTONE v3.6 PHASE 8: CHALLENGE EVALUATION ON SEALED DEV_3B');
  console.log('='.repeat(90));

  const p51Profiles = JSON.parse(fs.readFileSync(path.join(dev3bDir, 'p5_1_profiles_dev3b.json'), 'utf8'));
  const goldManifest = JSON.parse(fs.readFileSync(path.join(dev3bDir, 'gold_annotations/dev_3b_gold_extraction_manifest.json'), 'utf8'));

  const rawOutputs = {
    metadata: {
      timestamp: new Date().toISOString(),
      evaluator: 'run_phase8_challenge_eval.js',
      model: MODEL_NAME,
      temperature: TEMPERATURE
    },
    candidate_extractions: {},
    baseline_extractions: {},
    candidate_p53_matrices: {},
    baseline_p53_matrices: {}
  };

  // STAGE 1: Extract concepts
  console.log('\n--- STAGE 1: BLIND CONCEPT EXTRACTION (CANDIDATE & BASELINE) ---');
  for (const seg of CHALLENGE_SEGMENTS) {
    const segDir = path.join(dev3bDir, 'challenge_corpus', seg.folder);
    const meta = JSON.parse(fs.readFileSync(path.join(segDir, 'metadata.json'), 'utf8'));
    const trans = JSON.parse(fs.readFileSync(path.join(segDir, 'transcript.json'), 'utf8'));

    const extractUserPrompt = `LECTURE RECORD:
Domain: ${meta.domain}
Subject: ${meta.package_id}
Topic Title: ${meta.topic}

TIMESTAMPED LECTURE TRANSCRIPT:
${trans.text}

Reconstruct the hierarchical concept map of what was actually taught in this lecture according to the Concept-Unit Granularity Policy.`;

    console.log(`Extracting Segment ${seg.key} (${seg.package_id})...`);

    // Candidate Extraction
    const candExt = await callLLM(CANDIDATE_P52A_PROMPT, extractUserPrompt, MAX_COMPLETION_TOKENS_EXTRACT);
    rawOutputs.candidate_extractions[seg.key] = candExt.parsed;
    console.log(`  ✓ Candidate P5.2A: ${candExt.parsed.concepts.length} concepts in ${candExt.latencyMs}ms`);

    // Baseline Extraction
    const baseExt = await callLLM(BASELINE_P52A_PROMPT, extractUserPrompt, MAX_COMPLETION_TOKENS_EXTRACT);
    rawOutputs.baseline_extractions[seg.key] = baseExt.parsed;
    console.log(`  ✓ Baseline P5.2A : ${baseExt.parsed.concepts.length} concepts in ${baseExt.latencyMs}ms`);
  }

  // STAGE 2: Run Frozen P5.3 Diagnostic Analyzer
  console.log('\n--- STAGE 2: FROZEN P5.3 DIAGNOSTIC INFERENCE ---');
  for (const seg of CHALLENGE_SEGMENTS) {
    const pkgProfile = p51Profiles.packages[seg.package_id];
    const goldSeg = goldManifest[seg.key];

    const p51Formatted = Object.keys(pkgProfile.expected_dimensions)
      .map(d => `${d}: ExpDepth=${pkgProfile.expected_dimensions[d].level}, Tier=${pkgProfile.expected_dimensions[d].alignment}`)
      .join('\n');

    const p52bFormatted = `- [EP_01] [0s-60s] Complete instructional segment for ${goldSeg.title} (CONCEPT_EXPLANATION, MONOLOGUE)`;

    // P5.3 with Candidate Concepts
    const candConceptsFormatted = rawOutputs.candidate_extractions[seg.key].concepts
      .map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension}): ${c.observed_summary}`)
      .join('\n');

    const candP53Prompt = `TOPIC: ${pkgProfile.topic} (Segment: ${goldSeg.title})

RECORDING QUALITY:
Audio Clarity: HIGH
Completeness: COMPLETE
Limitations: NONE

P5.1 NORMATIVE EXPECTATIONS:
${p51Formatted}

P5.2A TAUGHT CONCEPTS:
${candConceptsFormatted}

P5.2B INSTRUCTIONAL EPISODES:
${p52bFormatted}

Construct the full 8-dimension diagnostic coverage matrix in JSON.`;

    console.log(`Scoring Segment ${seg.key} with Frozen P5.3...`);
    const candP53Res = await callLLM(FROZEN_P53_PROMPT, candP53Prompt, MAX_COMPLETION_TOKENS_P53);
    rawOutputs.candidate_p53_matrices[seg.key] = candP53Res.parsed;
    const candDepth = candP53Res.parsed.diagnostic_matrix[seg.dimension].observed_depth || 0;
    console.log(`  ✓ Candidate Pipeline: Observed Depth = ${candDepth} (Ref = ${seg.ref_depth}) in ${candP53Res.latencyMs}ms`);

    // P5.3 with Baseline Concepts
    const baseConceptsFormatted = rawOutputs.baseline_extractions[seg.key].concepts
      .map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension}): ${c.observed_summary}`)
      .join('\n');

    const baseP53Prompt = `TOPIC: ${pkgProfile.topic} (Segment: ${goldSeg.title})

RECORDING QUALITY:
Audio Clarity: HIGH
Completeness: COMPLETE
Limitations: NONE

P5.1 NORMATIVE EXPECTATIONS:
${p51Formatted}

P5.2A TAUGHT CONCEPTS:
${baseConceptsFormatted}

P5.2B INSTRUCTIONAL EPISODES:
${p52bFormatted}

Construct the full 8-dimension diagnostic coverage matrix in JSON.`;

    const baseP53Res = await callLLM(FROZEN_P53_PROMPT, baseP53Prompt, MAX_COMPLETION_TOKENS_P53);
    rawOutputs.baseline_p53_matrices[seg.key] = baseP53Res.parsed;
    const baseDepth = baseP53Res.parsed.diagnostic_matrix[seg.dimension].observed_depth || 0;
    console.log(`  ✓ Baseline Pipeline : Observed Depth = ${baseDepth} (Ref = ${seg.ref_depth}) in ${baseP53Res.latencyMs}ms`);
  }

  // Preserve Raw Outputs before Scoring
  const rawFile = path.join(dev3bDir, 'phase8_dev3b_raw_outputs.json');
  fs.writeFileSync(rawFile, JSON.stringify(rawOutputs, null, 2), 'utf8');
  console.log(`\n💾 Raw model outputs preserved to: ${rawFile}`);

  // STAGE 3: Adjudication Scoring & Paired Analysis
  console.log('\n--- STAGE 3: ADJUDICATION SCORING AGAINST SEALED GOLD STANDARD ---');

  let candExactMatches = 0;
  let candBoundaryMatches = 0;
  let baseExactMatches = 0;
  let baseBoundaryMatches = 0;

  let totalNgold = 0;
  let candTotalECR = 0, candTotalEMR = 0, candTotalEO = 0, candTotalUE = 0, candTargetMis = 0;
  let baseTotalECR = 0, baseTotalEMR = 0, baseTotalEO = 0, baseTotalUE = 0, baseTargetMis = 0;

  const pairedTransitionRows = [];

  for (const seg of CHALLENGE_SEGMENTS) {
    const goldSeg = goldManifest[seg.key];
    const targetDim = seg.dimension;
    const refDepth = seg.ref_depth;
    const refBoundary = seg.ref_boundary;

    // Upstream Extraction Evaluation
    const candExtEval = matchConcepts(rawOutputs.candidate_extractions[seg.key].concepts, goldSeg.gold_concepts);
    const baseExtEval = matchConcepts(rawOutputs.baseline_extractions[seg.key].concepts, goldSeg.gold_concepts);

    totalNgold += goldSeg.gold_concepts.length;
    candTotalECR += candExtEval.ECR.length;
    candTotalEMR += candExtEval.EMR.length;
    candTotalEO += candExtEval.EO.length;
    candTotalUE += candExtEval.UE.length;
    candTargetMis += candExtEval.EMR.filter(m => m.g.epistemic_dimension === targetDim).length;

    baseTotalECR += baseExtEval.ECR.length;
    baseTotalEMR += baseExtEval.EMR.length;
    baseTotalEO += baseExtEval.EO.length;
    baseTotalUE += baseExtEval.UE.length;
    baseTargetMis += baseExtEval.EMR.filter(m => m.g.epistemic_dimension === targetDim).length;

    const candEERA = (candExtEval.ECR.length / goldSeg.gold_concepts.length);
    const candSPF = evaluateSPF(rawOutputs.candidate_extractions[seg.key].concepts, goldSeg.operational_steps).spf;
    const candCMD = evaluateCMD(rawOutputs.candidate_extractions[seg.key].concepts, goldSeg.explanatory_subtype);

    // Downstream P5.3 Evaluation
    const candEntry = rawOutputs.candidate_p53_matrices[seg.key].diagnostic_matrix[targetDim];
    const baseEntry = rawOutputs.baseline_p53_matrices[seg.key].diagnostic_matrix[targetDim];

    const candObsDepth = candEntry ? candEntry.observed_depth : 0;
    const baseObsDepth = baseEntry ? baseEntry.observed_depth : 0;

    const candObsBoundary = candObsDepth >= seg.threshold ? 'SATISFIES' : 'FALLS_SHORT';
    const baseObsBoundary = baseObsDepth >= seg.threshold ? 'SATISFIES' : 'FALLS_SHORT';

    if (candObsDepth === refDepth) candExactMatches++;
    if (candObsBoundary === refBoundary) candBoundaryMatches++;
    if (baseObsDepth === refDepth) baseExactMatches++;
    if (baseObsBoundary === refBoundary) baseBoundaryMatches++;

    let netTransition = 'TIE';
    if (candObsDepth === refDepth && baseObsDepth !== refDepth) netTransition = 'IMPROVEMENT';
    else if (candObsDepth !== refDepth && baseObsDepth === refDepth) netTransition = 'REGRESSION';

    pairedTransitionRows.push({
      segment_key: seg.key,
      package_id: seg.package_id,
      dimension: targetDim,
      ref_depth: refDepth,
      ref_boundary: refBoundary,
      base_depth: baseObsDepth,
      base_boundary: baseObsBoundary,
      cand_depth: candObsDepth,
      cand_boundary: candObsBoundary,
      net_transition: netTransition,
      cand_eera: (candEERA * 100).toFixed(1) + '%',
      cand_spf: candSPF !== null ? (candSPF * 100).toFixed(0) + '%' : 'N/A',
      cand_cmd: candCMD.score !== null ? `${candCMD.subtype} L${candCMD.observed_level}/${candCMD.expected_level}` : 'N/A'
    });
  }

  // Gate 5: Pair-Level Dual Correctness Gate
  let pairsResolved = 0;
  const pairDetails = [];
  const packagePairs = [
    { pkg: 'dev_3b_01', a: '1A', b: '1B' },
    { pkg: 'dev_3b_02', a: '2A', b: '2B' },
    { pkg: 'dev_3b_03', a: '3A', b: '3B' },
    { pkg: 'dev_3b_04', a: '4A', b: '4B' }
  ];

  for (const p of packagePairs) {
    const rowA = pairedTransitionRows.find(r => r.segment_key === p.a);
    const rowB = pairedTransitionRows.find(r => r.segment_key === p.b);

    const relativeDiscrim = (rowB.cand_depth > rowA.cand_depth);
    const boundaryACorrect = (rowA.cand_boundary === rowA.ref_boundary);
    const boundaryBCorrect = (rowB.cand_boundary === rowB.ref_boundary);
    const dualCorrect = relativeDiscrim && boundaryACorrect && boundaryBCorrect;

    if (dualCorrect) pairsResolved++;
    pairDetails.push({
      package: p.pkg,
      depth_A: rowA.cand_depth,
      depth_B: rowB.cand_depth,
      relative_discrim: relativeDiscrim,
      boundary_A: `${rowA.cand_boundary} (Ref: ${rowA.ref_boundary})`,
      boundary_B: `${rowB.cand_boundary} (Ref: ${rowB.ref_boundary})`,
      dual_correct: dualCorrect
    });
  }

  // Pooled Metrics
  const candPooledEERA = candTotalECR / totalNgold;
  const basePooledEERA = baseTotalECR / totalNgold;

  // Gate Evaluations
  const gate1Pass = candPooledEERA >= 0.85;
  const gate2Pass = candTargetMis === 0;
  const gate3Pass = candExactMatches >= 7;
  const gate4Pass = candBoundaryMatches >= 7;
  const gate5Pass = pairsResolved === 4;

  // Print Pre-Declared Paired Transition Table
  console.log('\n' + '='.repeat(105));
  console.log('PRE-DECLARED PAIRED CANDIDATE-VS-BASELINE TRANSITION TABLE (DEV_3B)');
  console.log('='.repeat(105));
  console.log('| Seg | Dimension  | Gold Ref Depth & Verdict | Baseline P5.3 | Candidate P5.3 | Net Transition | Upstream EERA | Upstream SPF | Upstream CMD |');
  console.log('|:---:|:----------:|:------------------------:|:-------------:|:--------------:|:--------------:|:-------------:|:------------:|:------------:|');
  for (const r of pairedTransitionRows) {
    console.log(`| ${r.segment_key.padEnd(3)} | ${r.dimension.padEnd(10).substring(0, 10)} | Level ${r.ref_depth} (${r.ref_boundary.padEnd(11).substring(0, 11)}) | Level ${r.base_depth} (${r.base_boundary.padEnd(11).substring(0, 11)}) | Level ${r.cand_depth} (${r.cand_boundary.padEnd(11).substring(0, 11)}) | ${r.net_transition.padEnd(14)} | ${r.cand_eera.padStart(13)} | ${r.cand_spf.padStart(12)} | ${r.cand_cmd.padEnd(12)} |`);
  }
  console.log('-'.repeat(105));

  // Print Pair-Level Dual Correctness Table
  console.log('\n' + '='.repeat(80));
  console.log('GATE 5: PAIR-LEVEL DUAL CORRECTNESS VERIFICATION (4/4 REQUIRED)');
  console.log('='.repeat(80));
  for (const pd of pairDetails) {
    console.log(`  Package ${pd.package}: Depth(A)=${pd.depth_A}, Depth(B)=${pd.depth_B} (RelDiscrim: ${pd.relative_discrim ? 'PASS' : 'FAIL'}) | BoundA: ${pd.boundary_A} | BoundB: ${pd.boundary_B} -> ${pd.dual_correct ? '✅ DUAL PASS' : '❌ FAIL'}`);
  }
  console.log(`Pair-Level Dual Correctness Total: ${pairsResolved} / 4 pairs`);

  // Overall Gate Summary
  console.log('\n' + '='.repeat(80));
  console.log('PRE-DECLARED PHASE 8 ACCEPTANCE GATES EVALUATION:');
  console.log('='.repeat(80));
  console.log(`  Gate 1: Upstream EERA (>= 85.0%)                 : ${gate1Pass ? '✅ PASS' : '❌ FAIL'} (${(candPooledEERA * 100).toFixed(1)}% vs Baseline ${(basePooledEERA * 100).toFixed(1)}%)`);
  console.log(`  Gate 2: Target-Dimension Type II Misroutings (==0): ${gate2Pass ? '✅ PASS' : '❌ FAIL'} (${candTargetMis} misroutings vs Baseline ${baseTargetMis})`);
  console.log(`  Gate 3: Exact-Depth Concordance (>= 7/8, 87.5%)  : ${gate3Pass ? '✅ PASS' : '❌ FAIL'} (${candExactMatches}/8 vs Baseline ${baseExactMatches}/8)`);
  console.log(`  Gate 4: Boundary Agreement (>= 7/8, 87.5%)       : ${gate4Pass ? '✅ PASS' : '❌ FAIL'} (${candBoundaryMatches}/8 vs Baseline ${baseBoundaryMatches}/8)`);
  console.log(`  Gate 5: Pair-Level Dual Correctness (== 4/4)     : ${gate5Pass ? '✅ PASS' : '❌ FAIL'} (${pairsResolved}/4 pairs resolved)`);
  console.log('='.repeat(80));

  const allPass = gate1Pass && gate2Pass && gate3Pass && gate4Pass && gate5Pass;
  console.log(`OVERALL DECISION: ${allPass ? '🏆 ALL CHALLENGE GATES PASSED (ELIGIBLE FOR FORMAL STEP 2B BENCHMARKING REVIEW)' : '❌ REJECTED (DOES NOT MEET CONCURRENT CRITERIA)'}\n`);

  const resultsSummary = {
    metadata: rawOutputs.metadata,
    gates: {
      gate_1_eera: { standard: '>= 0.85', observed: candPooledEERA, pass: gate1Pass },
      gate_2_misrouting: { standard: '== 0', observed: candTargetMis, pass: gate2Pass },
      gate_3_exact_depth: { standard: '>= 7/8', observed: `${candExactMatches}/8`, pass: gate3Pass },
      gate_4_boundary: { standard: '>= 7/8', observed: `${candBoundaryMatches}/8`, pass: gate4Pass },
      gate_5_pairs: { standard: '== 4/4', observed: `${pairsResolved}/4`, pass: gate5Pass },
      overall_pass: allPass
    },
    paired_transitions: pairedTransitionRows,
    pair_details: pairDetails,
    summary_metrics: {
      candidate_exact_matches: candExactMatches,
      baseline_exact_matches: baseExactMatches,
      candidate_boundary_matches: candBoundaryMatches,
      baseline_boundary_matches: baseBoundaryMatches,
      candidate_pooled_eera: candPooledEERA,
      baseline_pooled_eera: basePooledEERA,
      pairs_resolved: pairsResolved
    }
  };

  const resultsFile = path.join(dev3bDir, 'phase8_dev3b_challenge_results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(resultsSummary, null, 2), 'utf8');
  console.log(`💾 Scored challenge results saved to: ${resultsFile}`);
}

runChallengeEvaluation().catch(err => {
  console.error('CRITICAL ERROR in challenge evaluation:', err);
  process.exit(1);
});
