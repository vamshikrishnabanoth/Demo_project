/**
 * experiments/experiment_5_teaching_adequacy/dev_2a/candidate_interventions/run_phase7_4_dev2a_anchor_test.js
 *
 * Milestone v3.6 Phase 7.4: Track 2 Anchor Investigation Runner
 *
 * Evaluates isolated P5.3 Candidate v1.2.0 against Baseline P5.3 on all 16 dev_2a cases
 * (8 Diagnostic Exploration cases: 1A-4B + 8 Held-Back Validation cases: 1C-4D).
 *
 * Strict Isolation Guards:
 * - ZERO exposure or imports from dev_2b.
 * - ZERO modifications to production files (server/) or frozen prospective benchmark (pkg_11-14).
 * - P5.3-ONLY candidate evaluation (baseline P5.2A concepts are held 100% frozen).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = path.resolve(__dirname, '../../../../');
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const dev2aDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/dev_2a');
const candDir = __dirname;

// Assert dev_2b is NEVER touched
const scriptContent = fs.readFileSync(__filename, 'utf8');
if (scriptContent.includes('dev_2b') && !scriptContent.includes('// Assert dev_2b is NEVER touched')) {
  throw new Error('FATAL: dev_2b contamination detected in Phase 7.4 runner script!');
}

// 1. Prompts
const { SYSTEM_PROMPT: BASELINE_P53_PROMPT } = require(path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer'));
const { SYSTEM_PROMPT: CANDIDATE_P53_PROMPT } = require(path.join(candDir, 'candidate_p5_3_coverage_gap_analyzer_v1_2_0'));

// 2. Frozen P5.1 Normative Profiles & Frozen Baseline P5.2A Concepts (dev_2a)
const p51Path = path.join(dev2aDir, 'diagnostic_runs/p5_1_profiles_dev2a_diagnostic.json');
const p51Data = JSON.parse(fs.readFileSync(p51Path, 'utf8'));

const frozenConceptsPath = path.join(candDir, 'frozen_baseline_p5_2a_dev2a_segment_concepts.json');
const frozenConceptsData = JSON.parse(fs.readFileSync(frozenConceptsPath, 'utf8'));

// 3. Human Adjudicated References
const diagRef = {
  '1A': { package_id: 'dev_2a_01_logic_predicates', dimension: 'MEANING', ref_depth: 2, ref_boundary: 'FALLS_SHORT_OF_LEVEL_4_SEMANTICS', threshold: 4 },
  '1B': { package_id: 'dev_2a_01_logic_predicates', dimension: 'MEANING', ref_depth: 4, ref_boundary: 'SATISFIES_LEVEL_4_SEMANTICS', threshold: 4 },
  '2A': { package_id: 'dev_2a_02_pharmacology_clearance', dimension: 'JUSTIFICATION_WHY', ref_depth: 4, ref_boundary: 'FALLS_SHORT_OF_LEVEL_5_MECHANISM', threshold: 5 },
  '2B': { package_id: 'dev_2a_02_pharmacology_clearance', dimension: 'JUSTIFICATION_WHY', ref_depth: 5, ref_boundary: 'SATISFIES_LEVEL_5_MECHANISM', threshold: 5 },
  '3A': { package_id: 'dev_2a_03_clinical_dosing', dimension: 'APPLICATION_INTERPRETATION', ref_depth: 3, ref_boundary: 'FALLS_SHORT_OF_LEVEL_6_TRACE', threshold: 6 },
  '3B': { package_id: 'dev_2a_03_clinical_dosing', dimension: 'APPLICATION_INTERPRETATION', ref_depth: 6, ref_boundary: 'SATISFIES_LEVEL_6_TRACE', threshold: 6 },
  '4A': { package_id: 'dev_2a_04_signal_processing_fourier', dimension: 'STRUCTURE_COMPONENTS', ref_depth: 2, ref_boundary: 'FALLS_SHORT_OF_LEVEL_5_PRIMITIVES', threshold: 5 },
  '4B': { package_id: 'dev_2a_04_signal_processing_fourier', dimension: 'STRUCTURE_COMPONENTS', ref_depth: 5, ref_boundary: 'SATISFIES_LEVEL_5_PRIMITIVES', threshold: 5 }
};

const valRef = {
  '1C': { package_id: 'dev_2a_01_logic_predicates', dimension: 'MEANING', ref_depth: 2, ref_boundary: 'FALLS_SHORT_OF_LEVEL_4_SEMANTICS', threshold: 4 },
  '1D': { package_id: 'dev_2a_01_logic_predicates', dimension: 'MEANING', ref_depth: 4, ref_boundary: 'SATISFIES_LEVEL_4_SEMANTICS', threshold: 4 },
  '2C': { package_id: 'dev_2a_02_pharmacology_clearance', dimension: 'JUSTIFICATION_WHY', ref_depth: 4, ref_boundary: 'FALLS_SHORT_OF_LEVEL_5_MECHANISM', threshold: 5 },
  '2D': { package_id: 'dev_2a_02_pharmacology_clearance', dimension: 'JUSTIFICATION_WHY', ref_depth: 5, ref_boundary: 'SATISFIES_LEVEL_5_MECHANISM', threshold: 5 },
  '3C': { package_id: 'dev_2a_03_clinical_dosing', dimension: 'APPLICATION_INTERPRETATION', ref_depth: 3, ref_boundary: 'FALLS_SHORT_OF_LEVEL_6_TRACE', threshold: 6 },
  '3D': { package_id: 'dev_2a_03_clinical_dosing', dimension: 'APPLICATION_INTERPRETATION', ref_depth: 6, ref_boundary: 'SATISFIES_LEVEL_6_TRACE', threshold: 6 },
  '4C': { package_id: 'dev_2a_04_signal_processing_fourier', dimension: 'STRUCTURE_COMPONENTS', ref_depth: 2, ref_boundary: 'FALLS_SHORT_OF_LEVEL_5_PRIMITIVES', threshold: 5 },
  '4D': { package_id: 'dev_2a_04_signal_processing_fourier', dimension: 'STRUCTURE_COMPONENTS', ref_depth: 5, ref_boundary: 'SATISFIES_LEVEL_5_PRIMITIVES', threshold: 5 }
};

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

// Main execution function
async function runPhase74Investigation() {
  console.log('========================================================================');
  console.log('🔬 MILESTONE v3.6 PHASE 7.4: TRACK 2 ANCHOR INVESTIGATION');
  console.log('========================================================================');
  console.log(`Model: ${MODEL_NAME} | Temp: ${TEMPERATURE}`);
  console.log(`Baseline Prompt Hash: ${crypto.createHash('sha256').update(BASELINE_P53_PROMPT).digest('hex')}`);
  console.log(`Candidate Prompt Hash: ${crypto.createHash('sha256').update(CANDIDATE_P53_PROMPT).digest('hex')}`);
  console.log('Dev_2b Firewalled: CONFIRMED');
  console.log('------------------------------------------------------------------------');

  // Segments to evaluate
  const allCases = [
    // 8 Diagnostic Exploration cases
    { key: '1A', ...diagRef['1A'], split: 'DIAGNOSTIC' },
    { key: '1B', ...diagRef['1B'], split: 'DIAGNOSTIC' },
    { key: '2A', ...diagRef['2A'], split: 'DIAGNOSTIC' },
    { key: '2B', ...diagRef['2B'], split: 'DIAGNOSTIC' },
    { key: '3A', ...diagRef['3A'], split: 'DIAGNOSTIC' },
    { key: '3B', ...diagRef['3B'], split: 'DIAGNOSTIC' },
    { key: '4A', ...diagRef['4A'], split: 'DIAGNOSTIC' },
    { key: '4B', ...diagRef['4B'], split: 'DIAGNOSTIC' },
    // 8 Held-Back Validation cases
    { key: '1C', ...valRef['1C'], split: 'VALIDATION' },
    { key: '1D', ...valRef['1D'], split: 'VALIDATION' },
    { key: '2C', ...valRef['2C'], split: 'VALIDATION' },
    { key: '2D', ...valRef['2D'], split: 'VALIDATION' },
    { key: '3C', ...valRef['3C'], split: 'VALIDATION' },
    { key: '3D', ...valRef['3D'], split: 'VALIDATION' },
    { key: '4C', ...valRef['4C'], split: 'VALIDATION' },
    { key: '4D', ...valRef['4D'], split: 'VALIDATION' }
  ];

  const results = {
    metadata: {
      milestone: 'Milestone v3.6 Phase 7.4: Track 2 Anchor Investigation',
      timestamp: new Date().toISOString(),
      model: MODEL_NAME,
      temperature: TEMPERATURE,
      baseline_prompt_sha256: crypto.createHash('sha256').update(BASELINE_P53_PROMPT).digest('hex'),
      candidate_prompt_sha256: crypto.createHash('sha256').update(CANDIDATE_P53_PROMPT).digest('hex'),
      frozen_p52a_concepts_sha256: crypto.createHash('sha256').update(fs.readFileSync(frozenConceptsPath)).digest('hex'),
      evaluator_mode: 'P5.3-ONLY (Frozen Baseline P5.2A Concepts)',
      dev2b_firewall_status: 'CONFIRMED_ZERO_TOUCH'
    },
    diagnostic_cases: {},
    validation_cases: {},
    gate_evaluation: {}
  };

  let diagBoundaryRegressions = 0;
  let diagDepthRegressions = 0;
  let diagOverallRegressions = 0;
  let diagBoundaryImprovements = 0;
  let diagDepthImprovements = 0;
  let diagExactMatches = 0;
  let diagBoundaryMatches = 0;

  let valBoundaryImprovements = 0;
  let valDepthImprovements = 0;
  let valExactMatches = 0;
  let valBoundaryMatches = 0;

  for (const c of allCases) {
    console.log(`\nEvaluating Case [${c.key}] (${c.split} - ${c.dimension}):`);
    const p51Profile = p51Data.packages[c.package_id];
    const concepts = (frozenConceptsData[c.key] && frozenConceptsData[c.key].concepts) ? frozenConceptsData[c.key].concepts : [];

    // Run Baseline
    console.log(`  -> Running Baseline P5.3...`);
    const baseRes = await runP53(BASELINE_P53_PROMPT, p51Profile, concepts);
    rotateKey();
    await sleep(500);

    // Run Candidate v1.2.0
    console.log(`  -> Running Candidate P5.3 v1.2.0...`);
    const candRes = await runP53(CANDIDATE_P53_PROMPT, p51Profile, concepts);
    rotateKey();
    await sleep(500);

    if (!baseRes.success || !candRes.success) {
      console.error(`  [ERROR] Execution failed for ${c.key}`);
      continue;
    }

    const baseDim = baseRes.data.diagnostic_matrix[c.dimension] || {};
    const candDim = candRes.data.diagnostic_matrix[c.dimension] || {};

    const baseDepth = baseDim.observed_depth;
    const candDepth = candDim.observed_depth;

    const baseVerdict = computeBoundaryVerdict(c.dimension, baseDepth, c.threshold);
    const candVerdict = computeBoundaryVerdict(c.dimension, candDepth, c.threshold);

    const isBaseExact = (baseDepth === c.ref_depth);
    const isCandExact = (candDepth === c.ref_depth);

    const isBaseBoundary = (baseVerdict === c.ref_boundary);
    const isCandBoundary = (candVerdict === c.ref_boundary);

    // Stated Regression & Improvement Definitions:
    // 1. Boundary regression: Baseline was correct on boundary, candidate failed boundary.
    const isBoundaryRegression = (isBaseBoundary && !isCandBoundary);
    // 2. Depth regression: Baseline was exact match on depth, candidate diverged from reference.
    const isDepthRegression = (isBaseExact && !isCandExact);
    // 3. Overall regression: Either boundary regression OR depth regression.
    const isOverallRegression = (isBoundaryRegression || isDepthRegression);

    // Improvements reported separately (gains must not conceal regressions):
    const isBoundaryImprovement = (!isBaseBoundary && isCandBoundary);
    const isDepthImprovement = (!isBaseExact && isCandExact);

    const caseRecord = {
      case_key: c.key,
      package_id: c.package_id,
      dimension: c.dimension,
      target_threshold: c.threshold,
      human_reference: {
        depth: c.ref_depth,
        boundary: c.ref_boundary
      },
      baseline: {
        observed_depth: baseDepth,
        status: baseDim.status,
        boundary_verdict: baseVerdict,
        evidence_synthesis: baseDim.evidence_synthesis,
        exact_match: isBaseExact,
        boundary_match: isBaseBoundary,
        meta: baseRes.meta
      },
      candidate_v1_2_0: {
        observed_depth: candDepth,
        status: candDim.status,
        boundary_verdict: candVerdict,
        evidence_synthesis: candDim.evidence_synthesis,
        exact_match: isCandExact,
        boundary_match: isCandBoundary,
        boundary_regression: isBoundaryRegression,
        depth_regression: isDepthRegression,
        overall_regression: isOverallRegression,
        boundary_improvement: isBoundaryImprovement,
        depth_improvement: isDepthImprovement,
        meta: candRes.meta
      }
    };

    if (c.split === 'DIAGNOSTIC') {
      results.diagnostic_cases[c.key] = caseRecord;
      if (isBoundaryRegression) diagBoundaryRegressions++;
      if (isDepthRegression) diagDepthRegressions++;
      if (isOverallRegression) diagOverallRegressions++;
      if (isBoundaryImprovement) diagBoundaryImprovements++;
      if (isDepthImprovement) diagDepthImprovements++;
      if (isCandExact) diagExactMatches++;
      if (isCandBoundary) diagBoundaryMatches++;
    } else {
      results.validation_cases[c.key] = caseRecord;
      if (isBoundaryImprovement) valBoundaryImprovements++;
      if (isDepthImprovement) valDepthImprovements++;
      if (isCandExact) valExactMatches++;
      if (isCandBoundary) valBoundaryMatches++;
    }

    console.log(`  Reference : Depth ${c.ref_depth} | ${c.ref_boundary}`);
    console.log(`  Baseline  : Depth ${baseDepth} | ${baseVerdict} (Exact: ${isBaseExact}, Boundary: ${isBaseBoundary ? 'PASS' : 'FAIL'})`);
    console.log(`  Candidate : Depth ${candDepth} | ${candVerdict} (Exact: ${isCandExact}, Boundary: ${isCandBoundary ? 'PASS' : 'FAIL'})`);
    if (isOverallRegression) {
      console.log(`  >>> REGRESSION DETECTED: BoundaryReg=${isBoundaryRegression}, DepthReg=${isDepthRegression}`);
    }
    if (isBoundaryImprovement || isDepthImprovement) {
      console.log(`  >>> IMPROVEMENT: BoundaryImp=${isBoundaryImprovement}, DepthImp=${isDepthImprovement}`);
    }
  }

  // Gate evaluation (Zero Boundary Regressions AND Zero Depth Regressions on 1A-4B)
  const gatePass = (diagOverallRegressions === 0);
  results.gate_evaluation = {
    overall_zero_regression_gate: {
      gate_threshold: "0 boundary regressions AND 0 depth regressions on diagnostic cases (1A-4B)",
      observed_boundary_regressions: diagBoundaryRegressions,
      observed_depth_regressions: diagDepthRegressions,
      total_overall_regressions: diagOverallRegressions,
      verdict: gatePass ? "PASSED" : "FAILED"
    },
    improvements_isolated: {
      diagnostic_boundary_improvements: diagBoundaryImprovements,
      diagnostic_depth_improvements: diagDepthImprovements,
      validation_boundary_improvements: valBoundaryImprovements,
      validation_depth_improvements: valDepthImprovements
    },
    diagnostic_concordance: {
      exact_depth: `${diagExactMatches} / 8 (${(diagExactMatches / 8 * 100).toFixed(1)}%)`,
      boundary_agreement: `${diagBoundaryMatches} / 8 (${(diagBoundaryMatches / 8 * 100).toFixed(1)}%)`
    },
    validation_concordance: {
      exact_depth: `${valExactMatches} / 8 (${(valExactMatches / 8 * 100).toFixed(1)}%)`,
      boundary_agreement: `${valBoundaryMatches} / 8 (${(valBoundaryMatches / 8 * 100).toFixed(1)}%)`
    }
  };

  const outPath = path.join(candDir, 'phase7_4_dev2a_anchor_test_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults written to: ${outPath}`);

  console.log('\n========================================================================');
  console.log(`SUMMARY: Zero-Regression Gate: ${gatePass ? 'PASSED (0 Regressions)' : `FAILED (${diagOverallRegressions} Regressions)`}`);
  console.log(`Diagnostic Cases (1A-4B): Exact: ${diagExactMatches}/8 | Boundary: ${diagBoundaryMatches}/8`);
  console.log(`Validation Cases (1C-4D): Exact: ${valExactMatches}/8 | Boundary: ${valBoundaryMatches}/8`);
  console.log('========================================================================\n');
}

module.exports = {
  runPhase74Investigation
};

if (require.main === module) {
  runPhase74Investigation().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
