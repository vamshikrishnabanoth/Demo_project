/**
 * experiments/experiment_5_teaching_adequacy/dev_2b/run_phase7_5_challenge_eval.js
 *
 * Milestone v3.6 Phase 7.5: Track 2 Model Alignment on Sealed dev_2b Challenge Set
 *
 * Evaluates isolated Candidate P5.3 v1.2.0 against Baseline P5.3 on all 8 dev_2b challenge segments
 * under strict blind execution safeguards.
 *
 * Stricter Dual Acceptance Gate (Pre-Declared):
 * - Minimum 7 / 8 Exact-Depth Matches (>= 87.5%)
 * - Minimum 7 / 8 Boundary Decision Matches (>= 87.5%)
 * - Prerequisite: Zero Diagnostic Regressions on dev_2a (Established in Phase 7.4)
 *
 * Strict Methodological Controls:
 * - Fail-closed identity check: halts if any prompt, input, or reference hash diverges.
 * - 100% blind generation: generation loop has ZERO access to human adjudication labels.
 * - Raw output preservation: writes phase7_5_dev2b_raw_outputs.json before scoring commences.
 * - P5.3-ONLY scope: baseline P5.2A concepts are held 100% frozen.
 * - ZERO modifications to production files (server/) or frozen prospective benchmark (pkg_11-14).
 * - Full 5x5 confusion matrix, marginal distributions, 2x2 contingency table, and Cohen's kappa.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = path.resolve(__dirname, '../../../');
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const dev2bDir = __dirname;
const candDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/dev_2a/candidate_interventions');
const runnerDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/runner');

// -----------------------------------------------------------------------------
// Expected SHA-256 Hashes for Fail-Closed Identity Verification
// -----------------------------------------------------------------------------
const EXPECTED_HASHES = {
  candidate_prompt_md: {
    path: path.join(candDir, 'candidate_prompt_intervention_v1_2_0.md'),
    expected: 'd940ac8b7728485ad7f06ebed5c30ccb589bc106072e7e4c4715618779f810f1'
  },
  candidate_p5_3_module: {
    path: path.join(candDir, 'candidate_p5_3_coverage_gap_analyzer_v1_2_0.js'),
    expected: 'e9d2b53e3ea78c7182e35a696645fa82f5be0d6f075da1c6e375431a56e1f94d'
  },
  baseline_p5_3_module: {
    path: path.join(runnerDir, 'p5_3_coverage_gap_analyzer.js'),
    expected: '0884d2923fc5581a2e0e193c285e98acc646e9ea282a09db67238e4541bee9ee'
  },
  p5_1_profiles_dev2b: {
    path: path.join(dev2bDir, 'p5_1_profiles_dev2b.json'),
    expected: 'ac354a6fb8d1f799f5fed76627b029b7bb110fbed235ea24b1c74a960eca814c'
  },
  frozen_p52a_concepts: {
    path: path.join(dev2bDir, 'frozen_baseline_p5_2a_dev2b_segment_concepts.json'),
    expected: '2089e6a739dca628a52048c947e84e713f214c2acf7ce96a76093b7f6a550ca5'
  },
  adjudication_summary: {
    path: path.join(dev2bDir, 'dev_2b_adjudication_summary.json'),
    expected: '344d8b2efe1672a45419cae8eed524d0f339015cbed8ff1402f3ff1f936d8e14'
  },
  track1_manifest: {
    path: path.join(dev2bDir, 'dev_2b_track1_manifest.json'),
    expected: '84cee24d7be0150c71ffba1f9b5923174722142b73049834520020e02eba4417'
  },
  corpus_manifest: {
    path: path.join(dev2bDir, 'dev_2b_corpus_manifest.json'),
    expected: 'd7aa61fc75680ae5fe036031fa90e0a16ef680275ac147cb5b805aa3493e416e'
  }
};

function verifyFailClosedIdentity() {
  console.log('🔒 Performing fail-closed cryptographic identity checks...');
  for (const [key, item] of Object.entries(EXPECTED_HASHES)) {
    if (!fs.existsSync(item.path)) {
      throw new Error(`[FAIL-CLOSED] Required artifact missing: ${item.path}`);
    }
    const hash = crypto.createHash('sha256').update(fs.readFileSync(item.path)).digest('hex');
    if (hash !== item.expected) {
      throw new Error(`[FAIL-CLOSED] Hash mismatch on ${key} (${item.path}): expected ${item.expected}, got ${hash}`);
    }
    console.log(`  ✓ ${key.padEnd(24)}: ${hash.substring(0, 16)}... (VERIFIED)`);
  }
  console.log('🔒 All 8 identity checkpoints verified. No altered artifacts detected.\n');
}

// 1. Prompts
const { SYSTEM_PROMPT: BASELINE_P53_PROMPT } = require(EXPECTED_HASHES.baseline_p5_3_module.path);
const { SYSTEM_PROMPT: CANDIDATE_P53_PROMPT } = require(EXPECTED_HASHES.candidate_p5_3_module.path);

// Verify extracted prompt string hashes
const EXPECTED_BASE_PROMPT_STR_HASH = '10a632cb5df3d1252b33c87437b18a49b21fcbd615bd859a9bdd327101e7d35b';
const EXPECTED_CAND_PROMPT_STR_HASH = '2d5a9500c1726ee917f3e5ef93d00c5aec6f3b7952993cff2df4e554b6b54388';

const actualBaseStrHash = crypto.createHash('sha256').update(BASELINE_P53_PROMPT).digest('hex');
const actualCandStrHash = crypto.createHash('sha256').update(CANDIDATE_P53_PROMPT).digest('hex');

if (actualBaseStrHash !== EXPECTED_BASE_PROMPT_STR_HASH) {
  throw new Error(`[FAIL-CLOSED] Baseline prompt string hash mismatch: expected ${EXPECTED_BASE_PROMPT_STR_HASH}, got ${actualBaseStrHash}`);
}
if (actualCandStrHash !== EXPECTED_CAND_PROMPT_STR_HASH) {
  throw new Error(`[FAIL-CLOSED] Candidate prompt string hash mismatch: expected ${EXPECTED_CAND_PROMPT_STR_HASH}, got ${actualCandStrHash}`);
}

// 2. Frozen Input Observational Evidence (dev_2b)
const p51Path = EXPECTED_HASHES.p5_1_profiles_dev2b.path;
const p51Data = JSON.parse(fs.readFileSync(p51Path, 'utf8'));

const frozenConceptsPath = EXPECTED_HASHES.frozen_p52a_concepts.path;
const frozenConceptsData = JSON.parse(fs.readFileSync(frozenConceptsPath, 'utf8'));

// 3. Challenge Segments Definition (BLIND TO HUMAN LABELS DURING GENERATION)
const challengeCases = [
  { key: '1A', package_id: 'dev_2b_01_set_theory_relations', dimension: 'MEANING', threshold: 4 },
  { key: '1B', package_id: 'dev_2b_01_set_theory_relations', dimension: 'MEANING', threshold: 4 },
  { key: '2A', package_id: 'dev_2b_02_hepatic_metabolism', dimension: 'JUSTIFICATION_WHY', threshold: 5 },
  { key: '2B', package_id: 'dev_2b_02_hepatic_metabolism', dimension: 'JUSTIFICATION_WHY', threshold: 5 },
  { key: '3A', package_id: 'dev_2b_03_aminoglycoside_dosing', dimension: 'APPLICATION_INTERPRETATION', threshold: 6 },
  { key: '3B', package_id: 'dev_2b_03_aminoglycoside_dosing', dimension: 'APPLICATION_INTERPRETATION', threshold: 6 },
  { key: '4A', package_id: 'dev_2b_04_iir_filter_realization', dimension: 'STRUCTURE_COMPONENTS', threshold: 5 },
  { key: '4B', package_id: 'dev_2b_04_iir_filter_realization', dimension: 'STRUCTURE_COMPONENTS', threshold: 5 }
];

// 4. API Client & 6-Key Pool Rotation
const apiKeys = [
  process.env.GROQ_API_KEY_FRESH,
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_BACKUP,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5
].filter(Boolean);

let keyIndex = 0;
function getGroqClient() {
  const currentKey = apiKeys[keyIndex % apiKeys.length];
  const slot = keyIndex % apiKeys.length;
  return {
    client: new Groq({ apiKey: currentKey }),
    slot: `key_slot_${slot}`,
    keyPrefix: currentKey ? currentKey.substring(0, 8) + '...' : 'none'
  };
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % apiKeys.length;
}

const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;
const MAX_COMPLETION_TOKENS = 4096;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 5. Model Execution Helper
async function runP53(systemPrompt, p51Profile, p52aConcepts, p52bEpisodes = [], maxRetries = 6) {
  const p51Formatted = Object.keys(p51Profile.expected_dimensions)
    .map(d => `${d}: ExpDepth=${p51Profile.expected_dimensions[d].level}, Tier=${p51Profile.expected_dimensions[d].alignment}`)
    .join('\n');

  const p52aFormatted = (p52aConcepts && p52aConcepts.length > 0)
    ? p52aConcepts.map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension}): ${c.observed_summary}`).join('\n')
    : 'No concepts extracted';

  const userPrompt = `TOPIC: ${p51Profile.topic}

RECORDING QUALITY:
Audio Clarity: HIGH
Completeness: COMPLETE
Limitations: none

P5.1 NORMATIVE EXPECTATIONS:
${p51Formatted}

P5.2A TAUGHT CONCEPTS:
${p52aFormatted}

P5.2B INSTRUCTIONAL EPISODES:
- [E01] Single instructional segment.

Construct the full 8-dimension diagnostic coverage matrix in JSON.`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { client, slot, keyPrefix } = getGroqClient();
    try {
      const response = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });

      if (response.choices[0].finish_reason === 'length') {
        throw new Error('Completion truncated by token length limit');
      }

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw);
      if (!parsed.diagnostic_matrix || Object.keys(parsed.diagnostic_matrix).length === 0) {
        throw new Error('Response missing diagnostic_matrix');
      }

      return {
        success: true,
        data: parsed,
        rawResponse: raw,
        meta: {
          model: MODEL_NAME,
          provider: 'Groq',
          keySlot: slot,
          keyPrefix: keyPrefix,
          promptHash: crypto.createHash('sha256').update(systemPrompt).digest('hex').substring(0, 16),
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      console.warn(`[WARN] Call failed on attempt ${attempt} using ${slot}: ${err.message}`);
      rotateKey();
      await sleep(2000 * attempt);
      if (attempt === maxRetries) {
        return {
          success: false,
          error: err.message,
          meta: {
            model: MODEL_NAME,
            provider: 'Groq',
            keySlot: slot,
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  }
}

// Helper to determine boundary verdict from observed depth
function computeBoundaryVerdict(dim, depth, threshold) {
  if (depth >= threshold) {
    if (dim === 'MEANING') return 'SATISFIES_LEVEL_4_SEMANTICS';
    if (dim === 'JUSTIFICATION_WHY') return 'SATISFIES_LEVEL_5_MECHANISM';
    if (dim === 'APPLICATION_INTERPRETATION') return 'SATISFIES_LEVEL_6_TRACE';
    if (dim === 'STRUCTURE_COMPONENTS') return 'SATISFIES_LEVEL_5_PRIMITIVES';
  } else {
    if (dim === 'MEANING') return 'FALLS_SHORT_OF_LEVEL_4_SEMANTICS';
    if (dim === 'JUSTIFICATION_WHY') return 'FALLS_SHORT_OF_LEVEL_5_MECHANISM';
    if (dim === 'APPLICATION_INTERPRETATION') return 'FALLS_SHORT_OF_LEVEL_6_TRACE';
    if (dim === 'STRUCTURE_COMPONENTS') return 'FALLS_SHORT_OF_LEVEL_5_PRIMITIVES';
  }
  return depth >= threshold ? 'SATISFIES' : 'FALLS_SHORT';
}

function computeBinaryVerdict(dim, depth, threshold) {
  return depth >= threshold ? 'SATISFIES' : 'FALLS_SHORT';
}

// Helper to calculate Cohen's Kappa
function calculateCohenKappa(categories, ratersMatrix) {
  const n = ratersMatrix.length;
  if (n === 0) return { Po: 0, Pe: 0, kappa: 0 };

  // Observed agreement Po
  let agreeCount = 0;
  for (const [a, b] of ratersMatrix) {
    if (a === b) agreeCount++;
  }
  const Po = agreeCount / n;

  // Marginal distributions
  const countA = {};
  const countB = {};
  for (const c of categories) {
    countA[c] = 0;
    countB[c] = 0;
  }
  for (const [a, b] of ratersMatrix) {
    countA[a] = (countA[a] || 0) + 1;
    countB[b] = (countB[b] || 0) + 1;
  }

  // Expected agreement Pe
  let Pe = 0;
  for (const c of categories) {
    Pe += (countA[c] / n) * (countB[c] / n);
  }

  if (Pe === 1) return { Po: Number(Po.toFixed(4)), Pe: 1.0, kappa: 1.0 };
  const kappa = (Po - Pe) / (1 - Pe);
  return {
    Po: Number(Po.toFixed(4)),
    Pe: Number(Pe.toFixed(4)),
    kappa: Number(kappa.toFixed(4))
  };
}

// Main execution function
async function runPhase75Evaluation() {
  console.log('========================================================================');
  console.log('🎯 MILESTONE v3.6 PHASE 7.5: TRACK 2 CHALLENGE EVALUATION (dev_2b)');
  console.log('========================================================================');

  // Step 0: Fail-closed identity check
  verifyFailClosedIdentity();

  console.log(`Model: ${MODEL_NAME} | Temp: ${TEMPERATURE} | MaxTokens: ${MAX_COMPLETION_TOKENS}`);
  console.log(`Baseline Prompt Hash:  ${actualBaseStrHash}`);
  console.log(`Candidate Prompt Hash: ${actualCandStrHash}`);
  console.log('Blind Execution Guard: CONFIRMED (Generation loop has ZERO human label exposure)');
  console.log('------------------------------------------------------------------------');

  const rawEvaluations = {};

  // Phase A: Blind Model Execution Loop
  console.log('\n--- Phase A: Executing Blind Model Calls across 8 Challenge Segments ---');
  for (const c of challengeCases) {
    console.log(`\nEvaluating Case [${c.key}] (${c.package_id} - ${c.dimension}):`);
    const p51Profile = p51Data.packages[c.package_id];
    const concepts = (frozenConceptsData[c.key] && frozenConceptsData[c.key].concepts) ? frozenConceptsData[c.key].concepts : [];

    // 1. Run Baseline P5.3
    console.log(`  -> Running Baseline P5.3...`);
    const baseRes = await runP53(BASELINE_P53_PROMPT, p51Profile, concepts);
    rotateKey();
    await sleep(500);

    // 2. Run Candidate P5.3 v1.2.0
    console.log(`  -> Running Candidate P5.3 v1.2.0...`);
    const candRes = await runP53(CANDIDATE_P53_PROMPT, p51Profile, concepts);
    rotateKey();
    await sleep(500);

    if (!baseRes.success || !candRes.success) {
      console.error(`  [ERROR] Execution failed for ${c.key}`);
      throw new Error(`Model execution failure on case ${c.key}`);
    }

    const baseDim = baseRes.data.diagnostic_matrix[c.dimension] || {};
    const candDim = candRes.data.diagnostic_matrix[c.dimension] || {};

    const baseDepth = baseDim.observed_depth;
    const candDepth = candDim.observed_depth;

    const baseVerdict = computeBoundaryVerdict(c.dimension, baseDepth, c.threshold);
    const candVerdict = computeBoundaryVerdict(c.dimension, candDepth, c.threshold);

    rawEvaluations[c.key] = {
      case_key: c.key,
      package_id: c.package_id,
      dimension: c.dimension,
      threshold: c.threshold,
      baseline: {
        observed_depth: baseDepth,
        status: baseDim.status,
        boundary_verdict: baseVerdict,
        binary_verdict: computeBinaryVerdict(c.dimension, baseDepth, c.threshold),
        evidence_synthesis: baseDim.evidence_synthesis,
        meta: baseRes.meta,
        full_diagnostic_matrix: baseRes.data.diagnostic_matrix
      },
      candidate_v1_2_0: {
        observed_depth: candDepth,
        status: candDim.status,
        boundary_verdict: candVerdict,
        binary_verdict: computeBinaryVerdict(c.dimension, candDepth, c.threshold),
        evidence_synthesis: candDim.evidence_synthesis,
        meta: candRes.meta,
        full_diagnostic_matrix: candRes.data.diagnostic_matrix
      }
    };

    console.log(`  Baseline  Observed: Depth ${baseDepth} | ${baseVerdict}`);
    console.log(`  Candidate Observed: Depth ${candDepth} | ${candVerdict}`);
  }

  // PRESERVATION GATE: Write raw model outputs to disk BEFORE reading human reference adjudication!
  const rawOutPath = path.join(dev2bDir, 'phase7_5_dev2b_raw_outputs.json');
  fs.writeFileSync(rawOutPath, JSON.stringify(rawEvaluations, null, 2), 'utf8');
  const rawHash = crypto.createHash('sha256').update(fs.readFileSync(rawOutPath)).digest('hex');
  console.log(`\n💾 [RAW PRESERVATION] Raw model outputs saved to: ${rawOutPath}`);
  console.log(`   SHA-256 of raw outputs: ${rawHash}`);
  console.log('   All 8 segments completed blindly without access to human reference labels.\n');

  // Phase B: Post-Generation Scoring against Sealed Human Reference Profiles
  console.log('--- Phase B: Scoring against Sealed Human Ground Truth (Phase 7.3) ---');
  const adjudicationPath = EXPECTED_HASHES.adjudication_summary.path;
  const adjudicationData = JSON.parse(fs.readFileSync(adjudicationPath, 'utf8'));
  const refProfiles = adjudicationData.adjudicated_reference_profiles;

  let candExactMatches = 0;
  let candBoundaryMatches = 0;
  let baseExactMatches = 0;
  let baseBoundaryMatches = 0;

  let boundaryRegressions = 0;
  let depthRegressions = 0;
  let boundaryImprovements = 0;
  let depthImprovements = 0;

  // Confusion Matrices (Rows: Human Reference Depth, Cols: Model Depth)
  const depthLabels = [2, 3, 4, 5, 6];
  const candidateConfusionMatrix = {};
  const baselineConfusionMatrix = {};
  for (const r of depthLabels) {
    candidateConfusionMatrix[r] = {};
    baselineConfusionMatrix[r] = {};
    for (const c of depthLabels) {
      candidateConfusionMatrix[r][c] = 0;
      baselineConfusionMatrix[r][c] = 0;
    }
  }

  // Boundary Contingency Tables (2x2: Rows = Ref [SATISFIES, FALLS_SHORT], Cols = Model [SATISFIES, FALLS_SHORT])
  const candidateBoundaryContingency = {
    SATISFIES: { SATISFIES: 0, FALLS_SHORT: 0 },
    FALLS_SHORT: { SATISFIES: 0, FALLS_SHORT: 0 }
  };
  const baselineBoundaryContingency = {
    SATISFIES: { SATISFIES: 0, FALLS_SHORT: 0 },
    FALLS_SHORT: { SATISFIES: 0, FALLS_SHORT: 0 }
  };

  const depthPairsCand = [];
  const depthPairsBase = [];
  const boundaryPairsCand = [];
  const boundaryPairsBase = [];

  const scoredCases = {};
  for (const c of challengeCases) {
    const raw = rawEvaluations[c.key];
    const ref = refProfiles[c.key];

    const isBaseExact = (raw.baseline.observed_depth === ref.adjudicated_depth);
    const isCandExact = (raw.candidate_v1_2_0.observed_depth === ref.adjudicated_depth);

    const isBaseBoundary = (raw.baseline.boundary_verdict === ref.operational_verdict);
    const isCandBoundary = (raw.candidate_v1_2_0.boundary_verdict === ref.operational_verdict);

    if (isBaseExact) baseExactMatches++;
    if (isCandExact) candExactMatches++;
    if (isBaseBoundary) baseBoundaryMatches++;
    if (isCandBoundary) candBoundaryMatches++;

    // Track regressions & improvements
    const isBoundaryRegression = (isBaseBoundary && !isCandBoundary);
    const isDepthRegression = (isBaseExact && !isCandExact);
    const isBoundaryImprovement = (!isBaseBoundary && isCandBoundary);
    const isDepthImprovement = (!isBaseExact && isCandExact);

    if (isBoundaryRegression) boundaryRegressions++;
    if (isDepthRegression) depthRegressions++;
    if (isBoundaryImprovement) boundaryImprovements++;
    if (isDepthImprovement) depthImprovements++;

    // Update confusion matrices
    const rDepth = ref.adjudicated_depth;
    const cDepthCand = raw.candidate_v1_2_0.observed_depth;
    const cDepthBase = raw.baseline.observed_depth;

    if (candidateConfusionMatrix[rDepth] && candidateConfusionMatrix[rDepth][cDepthCand] !== undefined) {
      candidateConfusionMatrix[rDepth][cDepthCand]++;
    }
    if (baselineConfusionMatrix[rDepth] && baselineConfusionMatrix[rDepth][cDepthBase] !== undefined) {
      baselineConfusionMatrix[rDepth][cDepthBase]++;
    }

    // Binary boundary verdict comparison
    const refBinary = ref.adjudicated_depth >= c.threshold ? 'SATISFIES' : 'FALLS_SHORT';
    const candBinary = raw.candidate_v1_2_0.binary_verdict;
    const baseBinary = raw.baseline.binary_verdict;

    candidateBoundaryContingency[refBinary][candBinary]++;
    baselineBoundaryContingency[refBinary][baseBinary]++;

    depthPairsCand.push([rDepth, cDepthCand]);
    depthPairsBase.push([rDepth, cDepthBase]);
    boundaryPairsCand.push([refBinary, candBinary]);
    boundaryPairsBase.push([refBinary, baseBinary]);

    scoredCases[c.key] = {
      case_key: c.key,
      package_id: c.package_id,
      dimension: c.dimension,
      target_threshold: c.threshold,
      human_reference: {
        adjudicated_depth: ref.adjudicated_depth,
        operational_verdict: ref.operational_verdict,
        adjudication_rationale: ref.adjudication_rationale
      },
      baseline: {
        observed_depth: raw.baseline.observed_depth,
        status: raw.baseline.status,
        boundary_verdict: raw.baseline.boundary_verdict,
        exact_match: isBaseExact,
        boundary_match: isBaseBoundary,
        evidence_synthesis: raw.baseline.evidence_synthesis,
        meta: raw.baseline.meta
      },
      candidate_v1_2_0: {
        observed_depth: raw.candidate_v1_2_0.observed_depth,
        status: raw.candidate_v1_2_0.status,
        boundary_verdict: raw.candidate_v1_2_0.boundary_verdict,
        exact_match: isCandExact,
        boundary_match: isCandBoundary,
        boundary_regression: isBoundaryRegression,
        depth_regression: isDepthRegression,
        boundary_improvement: isBoundaryImprovement,
        depth_improvement: isDepthImprovement,
        evidence_synthesis: raw.candidate_v1_2_0.evidence_synthesis,
        meta: raw.candidate_v1_2_0.meta
      }
    };

    console.log(`\nCase [${c.key}] Scoring:`);
    console.log(`  Reference : Depth ${ref.adjudicated_depth} | ${ref.operational_verdict}`);
    console.log(`  Baseline  : Depth ${raw.baseline.observed_depth} | ${raw.baseline.boundary_verdict} (Exact: ${isBaseExact}, Boundary: ${isBaseBoundary ? 'PASS' : 'FAIL'})`);
    console.log(`  Candidate : Depth ${raw.candidate_v1_2_0.observed_depth} | ${raw.candidate_v1_2_0.boundary_verdict} (Exact: ${isCandExact}, Boundary: ${isCandBoundary ? 'PASS' : 'FAIL'})`);
    if (isBoundaryRegression || isDepthRegression) {
      console.log(`  >>> REGRESSION: BoundaryReg=${isBoundaryRegression}, DepthReg=${isDepthRegression}`);
    }
    if (isBoundaryImprovement || isDepthImprovement) {
      console.log(`  >>> IMPROVEMENT: BoundaryImp=${isBoundaryImprovement}, DepthImp=${isDepthImprovement}`);
    }
  }

  // Kappa statistics
  const candDepthKappa = calculateCohenKappa(depthLabels, depthPairsCand);
  const baseDepthKappa = calculateCohenKappa(depthLabels, depthPairsBase);
  const candBoundaryKappa = calculateCohenKappa(['SATISFIES', 'FALLS_SHORT'], boundaryPairsCand);
  const baseBoundaryKappa = calculateCohenKappa(['SATISFIES', 'FALLS_SHORT'], boundaryPairsBase);

  // Marginal distributions
  const marginals = {
    reference_depth: {},
    candidate_depth: {},
    baseline_depth: {},
    reference_boundary: { SATISFIES: 0, FALLS_SHORT: 0 },
    candidate_boundary: { SATISFIES: 0, FALLS_SHORT: 0 },
    baseline_boundary: { SATISFIES: 0, FALLS_SHORT: 0 }
  };
  for (const d of depthLabels) {
    marginals.reference_depth[d] = 0;
    marginals.candidate_depth[d] = 0;
    marginals.baseline_depth[d] = 0;
  }
  for (const c of challengeCases) {
    const raw = rawEvaluations[c.key];
    const ref = refProfiles[c.key];
    marginals.reference_depth[ref.adjudicated_depth]++;
    marginals.candidate_depth[raw.candidate_v1_2_0.observed_depth]++;
    marginals.baseline_depth[raw.baseline.observed_depth]++;

    const refBin = ref.adjudicated_depth >= c.threshold ? 'SATISFIES' : 'FALLS_SHORT';
    marginals.reference_boundary[refBin]++;
    marginals.candidate_boundary[raw.candidate_v1_2_0.binary_verdict]++;
    marginals.baseline_boundary[raw.baseline.binary_verdict]++;
  }

  // Acceptance Gate Evaluation (Stricter Dual Rule)
  const exactPass = (candExactMatches >= 7);
  const boundaryPass = (candBoundaryMatches >= 7);
  const overallGatePass = (exactPass && boundaryPass);

  const results = {
    metadata: {
      milestone: 'Milestone v3.6 Phase 7.5: Track 2 Challenge Evaluation (dev_2b)',
      timestamp: new Date().toISOString(),
      model: MODEL_NAME,
      temperature: TEMPERATURE,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      baseline_prompt_sha256: actualBaseStrHash,
      candidate_prompt_sha256: actualCandStrHash,
      p5_1_profiles_sha256: crypto.createHash('sha256').update(fs.readFileSync(p51Path)).digest('hex'),
      frozen_p52a_concepts_sha256: crypto.createHash('sha256').update(fs.readFileSync(frozenConceptsPath)).digest('hex'),
      adjudication_summary_sha256: crypto.createHash('sha256').update(fs.readFileSync(adjudicationPath)).digest('hex'),
      raw_outputs_sha256: rawHash,
      evaluator_mode: 'P5.3-ONLY (Frozen Baseline P5.2A Concepts)',
      blind_execution_protocol: 'STRICTLY_BLINDED'
    },
    predeclared_acceptance_rule: {
      rule_description: 'Stricter Dual Acceptance Rule: >= 7/8 Exact Depth Concordance AND >= 7/8 Boundary Decision Agreement',
      exact_depth_threshold: '>= 7 / 8 (87.5%)',
      boundary_decision_threshold: '>= 7 / 8 (87.5%)',
      zero_diagnostic_regressions_prerequisite: 'PASSED (0 regressions on dev_2a in Phase 7.4)'
    },
    challenge_cases: scoredCases,
    gate_evaluation: {
      candidate_exact_depth_concordance: `${candExactMatches} / 8 (${(candExactMatches / 8 * 100).toFixed(1)}%)`,
      candidate_boundary_agreement: `${candBoundaryMatches} / 8 (${(candBoundaryMatches / 8 * 100).toFixed(1)}%)`,
      candidate_depth_kappa: candDepthKappa,
      candidate_boundary_kappa: candBoundaryKappa,
      baseline_exact_depth_concordance: `${baseExactMatches} / 8 (${(baseExactMatches / 8 * 100).toFixed(1)}%)`,
      baseline_boundary_agreement: `${baseBoundaryMatches} / 8 (${(baseBoundaryMatches / 8 * 100).toFixed(1)}%)`,
      baseline_depth_kappa: baseDepthKappa,
      baseline_boundary_kappa: baseBoundaryKappa,
      exact_depth_gate_verdict: exactPass ? 'PASSED' : 'FAILED',
      boundary_agreement_gate_verdict: boundaryPass ? 'PASSED' : 'FAILED',
      overall_challenge_gate_verdict: overallGatePass ? 'PASSED' : 'FAILED'
    },
    isolated_transitions: {
      boundary_regressions: boundaryRegressions,
      depth_regressions: depthRegressions,
      boundary_improvements: boundaryImprovements,
      depth_improvements: depthImprovements
    },
    statistical_distributions: {
      marginal_distributions: marginals,
      candidate_confusion_matrix_5x5: candidateConfusionMatrix,
      baseline_confusion_matrix_5x5: baselineConfusionMatrix,
      candidate_boundary_contingency_2x2: candidateBoundaryContingency,
      baseline_boundary_contingency_2x2: baselineBoundaryContingency
    }
  };

  const outPath = path.join(dev2bDir, 'phase7_5_dev2b_challenge_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nScored results written to: ${outPath}`);

  console.log('\n========================================================================');
  console.log(`SUMMARY: Phase 7.5 Challenge Gate: ${overallGatePass ? 'PASSED' : 'FAILED'}`);
  console.log(`Candidate Exact Depth: ${candExactMatches}/8 (${(candExactMatches / 8 * 100).toFixed(1)}%) | Gate: ${exactPass ? 'PASS' : 'FAIL'} | Kappa: ${candDepthKappa.kappa}`);
  console.log(`Candidate Boundary:    ${candBoundaryMatches}/8 (${(candBoundaryMatches / 8 * 100).toFixed(1)}%) | Gate: ${boundaryPass ? 'PASS' : 'FAIL'} | Kappa: ${candBoundaryKappa.kappa}`);
  console.log(`Baseline Comparison:   Exact: ${baseExactMatches}/8 (Kappa: ${baseDepthKappa.kappa}) | Boundary: ${baseBoundaryMatches}/8 (Kappa: ${baseBoundaryKappa.kappa})`);
  console.log(`Improvements vs Baseline: Boundary: +${boundaryImprovements}, Depth: +${depthImprovements}`);
  console.log(`Regressions vs Baseline:  Boundary: -${boundaryRegressions}, Depth: -${depthRegressions}`);
  console.log('========================================================================\n');
}

module.exports = {
  runPhase75Evaluation
};

if (require.main === module) {
  runPhase75Evaluation().catch(err => {
    console.error('Fatal error in Phase 7.5 runner:', err);
    process.exit(1);
  });
}
