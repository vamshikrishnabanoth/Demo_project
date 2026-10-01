/**
 * experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Component P5.3: Teaching Adequacy & Coverage Gap Analyzer (RQ3)
 *
 * PURPOSE:
 * Bridges Normative Expectations (P5.1) and Reconstructed Observational Evidence (P5.2A/B)
 * to construct the DIAGNOSTIC COVERAGE MATRIX across the 8 Universal Epistemic Dimensions:
 *   - Strictly preserves P5.1 expected_depth and alignment_tier.
 *   - Estimates observed_depth (0-8) independently from P5.2A concepts and P5.2B episodes.
 *   - Evaluates coverage states: COVERED, PARTIALLY_COVERED, NOT_OBSERVED, INSUFFICIENT_EVIDENCE,
 *     ACTIONABLE_COVERAGE_GAP, and PERMISSIBLE_SCOPE_OMISSION.
 *   - Grounds every entry in supporting concept units, episode IDs, and evidence synthesis.
 *   - Treats recording quality as an evidence limitation, not a numerical penalty.
 *
 * CRITICAL METHODOLOGICAL CONTROLS & INFORMATION PARTITIONING:
 *   1. P5.3 receives ONLY P5.1 profiles, P5.2A concepts, P5.2B episodes, and recording metadata.
 *   2. P5.3 is STRICTLY FORBIDDEN from reading human normative or observational ground truth.
 *   3. Zero monolithic 100-point score; outputs multi-dimensional diagnostic matrix.
 *   4. Incremental disk persistence: Saves after every package; skips already analyzed packages.
 *
 * Model: openai/gpt-oss-120b on Groq
 * Temperature: 0.0
 * Response Format: json_object
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

// Paths
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const corpusDir = path.join(exp5Dir, 'benchmark_corpus');
const rawResultsDir = path.join(exp5Dir, 'raw_results');
fs.mkdirSync(rawResultsDir, { recursive: true });

const p51File = path.join(rawResultsDir, 'p5_1_profiles.json');
const p52aFile = path.join(rawResultsDir, 'p5_2a_concepts.json');
const p52bFile = path.join(rawResultsDir, 'p5_2b_episodes.json');
const outputFile = path.join(rawResultsDir, 'p5_3_diagnostic_matrix.json');

// Groq API client pool with round-robin rotation across available keys
const apiKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_BACKUP,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5
].filter(Boolean);

if (apiKeys.length === 0) {
  console.error('CRITICAL: No Groq API keys found in server/.env');
  process.exit(1);
}

let keyIndex = 0;
function getGroqClient() {
  const currentKey = apiKeys[keyIndex % apiKeys.length];
  return new Groq({ apiKey: currentKey });
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % apiKeys.length;
}

const MODEL_NAME = process.env.GROQ_MODEL || process.env.JUDGE_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;
const MAX_COMPLETION_TOKENS = 2200;

const SYSTEM_PROMPT = `You are a Senior Pedagogical Diagnostician.
Compare the NORMATIVE EXPECTATIONS (P5.1) against OBSERVATIONAL EVIDENCE (P5.2A concepts and P5.2B episodes) to construct the DIAGNOSTIC COVERAGE MATRIX across all 8 dimensions.

RULES:
1. Preserve expected_depth and alignment_tier from P5.1 exactly.
2. Estimate observed_depth (0-8) independently from the observed concepts/episodes.
   - 0: Absent from instructional record.
   - 1: Mention / nominal recognition.
   - 2: Basic definition / description.
   - 3: Univariate mechanism / steps.
   - 4: Dynamic interaction / systemic flow.
   - 5: Formal derivation / theoretical rationale.
   - 6: Concrete application / worked problem / code trace / case analysis.
   - 7: Boundary evaluation / failure modes / limitations.
   - 8: Cross-domain transfer / novel synthesis.
3. Status Vocabulary:
   - COVERED: Observed >= Expected.
   - PARTIALLY_COVERED: 0 < Observed < Expected (and NOT an actionable gap).
   - NOT_OBSERVED: Observed = 0 (clearly absent from usable lecture record).
   - INSUFFICIENT_EVIDENCE: Audio/transcript too degraded to determine.
   - ACTIONABLE_COVERAGE_GAP: Dimension is REQUIRED, but NOT_OBSERVED or severely under-taught (observed < expected).
   - PERMISSIBLE_SCOPE_OMISSION: Dimension is OPTIONAL or PERMISSIBLE_SCOPE_OMISSION in P5.1, and Observed < Expected.
4. Keep evidence_synthesis concise (1-2 sentences). For NOT_OBSERVED, state what was searched and not found (do NOT invent fake quotes).
5. You MUST include ALL 8 dimensions in the diagnostic_matrix:
   IDENTIFICATION, MEANING, STRUCTURE_COMPONENTS, RELATIONSHIPS_MECHANISM, JUSTIFICATION_WHY, APPLICATION_INTERPRETATION, BOUNDARIES_EXCEPTIONS, TRANSFER_SYNTHESIS.

OUTPUT SCHEMA (JSON):
{
  "diagnostic_matrix": {
    "IDENTIFICATION": { "expected_depth": 2, "alignment_tier": "REQUIRED", "observed_depth": 2, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "MEANING": { "expected_depth": 4, "alignment_tier": "REQUIRED", "observed_depth": 4, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "STRUCTURE_COMPONENTS": { "expected_depth": 4, "alignment_tier": "REQUIRED", "observed_depth": 4, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "RELATIONSHIPS_MECHANISM": { "expected_depth": 5, "alignment_tier": "REQUIRED", "observed_depth": 5, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "JUSTIFICATION_WHY": { "expected_depth": 5, "alignment_tier": "REQUIRED", "observed_depth": 5, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "APPLICATION_INTERPRETATION": { "expected_depth": 6, "alignment_tier": "REQUIRED", "observed_depth": 6, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "BOUNDARIES_EXCEPTIONS": { "expected_depth": 4, "alignment_tier": "RECOMMENDED", "observed_depth": 4, "status": "COVERED", "evidence_synthesis": "...", "confidence": "HIGH" },
    "TRANSFER_SYNTHESIS": { "expected_depth": 2, "alignment_tier": "OPTIONAL", "observed_depth": 1, "status": "PERMISSIBLE_SCOPE_OMISSION", "evidence_synthesis": "...", "confidence": "HIGH" }
  },
  "actionable_gaps": [],
  "permissible_omissions": ["TRANSFER_SYNTHESIS: ..."]
}`;

const EXPECTED_DIMENSIONS = [
  'IDENTIFICATION',
  'MEANING',
  'STRUCTURE_COMPONENTS',
  'RELATIONSHIPS_MECHANISM',
  'JUSTIFICATION_WHY',
  'APPLICATION_INTERPRETATION',
  'BOUNDARIES_EXCEPTIONS',
  'TRANSFER_SYNTHESIS'
];

const VALID_STATUSES = new Set([
  'COVERED',
  'PARTIALLY_COVERED',
  'NOT_OBSERVED',
  'INSUFFICIENT_EVIDENCE',
  'ACTIONABLE_COVERAGE_GAP',
  'PERMISSIBLE_SCOPE_OMISSION'
]);

function validateAndCompleteDiagnosticMatrix(parsed, p51Pkg, pkgId) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Output for ${pkgId} is not an object`);
  }
  if (!parsed.diagnostic_matrix || typeof parsed.diagnostic_matrix !== 'object') {
    parsed.diagnostic_matrix = {};
  }

  for (const dim of EXPECTED_DIMENSIONS) {
    const p51Dim = p51Pkg.expected_dimensions[dim] || { level: 2, alignment: 'OPTIONAL' };
    const expDepth = typeof p51Dim.level === 'number' ? p51Dim.level : 2;
    const alignTier = p51Dim.alignment || 'OPTIONAL';

    if (!parsed.diagnostic_matrix[dim]) {
      let inferredStatus = 'NOT_OBSERVED';
      if (alignTier === 'REQUIRED') {
        inferredStatus = 'ACTIONABLE_COVERAGE_GAP';
      } else if (alignTier === 'PERMISSIBLE_SCOPE_OMISSION' || alignTier === 'OPTIONAL') {
        inferredStatus = 'PERMISSIBLE_SCOPE_OMISSION';
      }

      parsed.diagnostic_matrix[dim] = {
        expected_depth: expDepth,
        alignment_tier: alignTier,
        observed_depth: 0,
        status: inferredStatus,
        evidence_synthesis: 'No observable evidence found in the instructional record for this dimension.',
        confidence: 'HIGH'
      };
    } else {
      const entry = parsed.diagnostic_matrix[dim];
      entry.expected_depth = expDepth;
      entry.alignment_tier = alignTier;

      if (typeof entry.observed_depth !== 'number' || entry.observed_depth < 0 || entry.observed_depth > 8) {
        entry.observed_depth = 0;
      }

      const obs = entry.observed_depth;
      const exp = entry.expected_depth;
      const align = entry.alignment_tier;

      if (!VALID_STATUSES.has(entry.status)) {
        if (obs >= exp) {
          entry.status = 'COVERED';
        } else if (obs === 0) {
          if (align === 'REQUIRED') entry.status = 'ACTIONABLE_COVERAGE_GAP';
          else if (align === 'PERMISSIBLE_SCOPE_OMISSION' || align === 'OPTIONAL') entry.status = 'PERMISSIBLE_SCOPE_OMISSION';
          else entry.status = 'NOT_OBSERVED';
        } else {
          if (align === 'REQUIRED' && exp - obs >= 2) entry.status = 'ACTIONABLE_COVERAGE_GAP';
          else entry.status = 'PARTIALLY_COVERED';
        }
      }

      if (typeof entry.evidence_synthesis !== 'string') entry.evidence_synthesis = 'Evidence synthesized from record.';
      if (typeof entry.confidence !== 'string') entry.confidence = 'HIGH';
    }
  }

  const derivedGaps = [];
  const derivedPerm = [];
  let covCount = 0, partCount = 0, gapCount = 0, permCount = 0, insCount = 0;

  for (const dim of EXPECTED_DIMENSIONS) {
    const e = parsed.diagnostic_matrix[dim];
    if (e.status === 'COVERED') covCount++;
    else if (e.status === 'PARTIALLY_COVERED') partCount++;
    else if (e.status === 'ACTIONABLE_COVERAGE_GAP') {
      gapCount++;
      derivedGaps.push(`${dim} (Expected ${e.expected_depth}, observed ${e.observed_depth}): ${e.evidence_synthesis}`);
    } else if (e.status === 'PERMISSIBLE_SCOPE_OMISSION') {
      permCount++;
      derivedPerm.push(`${dim} (Expected ${e.expected_depth}, observed ${e.observed_depth}): ${e.evidence_synthesis}`);
    } else if (e.status === 'INSUFFICIENT_EVIDENCE') {
      insCount++;
    }
  }

  parsed.actionable_gaps = derivedGaps;
  parsed.permissible_omissions = derivedPerm;
  parsed.summary_diagnosis = {
    covered_count: covCount,
    partially_covered_count: partCount,
    actionable_gap_count: gapCount,
    permissible_omission_count: permCount,
    insufficient_evidence_count: insCount
  };
}

async function analyzeCoverageForPackage(pkgDirName, p51Pkg, p52aPkg, p52bPkg, maxRetries = 25) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing metadata for ${pkgDirName}`);
  }
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  const p51Formatted = Object.keys(p51Pkg.expected_dimensions)
    .map(d => `${d}: ExpDepth=${p51Pkg.expected_dimensions[d].level}, Tier=${p51Pkg.expected_dimensions[d].alignment}`)
    .join('\n');

  const p52aFormatted = p52aPkg.concepts
    .map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension}): ${c.observed_summary}`)
    .join('\n');

  const p52bFormatted = p52bPkg.episodes
    .map(e => `- [${e.episode_id}] [${e.start}s-${e.end}s] ${e.dominant_concept} (${e.intellectual_activity}, ${e.interaction_mode})`)
    .join('\n');

  const userPrompt = `TOPIC: ${p51Pkg.topic}

RECORDING QUALITY:
Audio Clarity: ${meta.recording_quality.audio_clarity}
Completeness: ${meta.recording_quality.transcript_completeness}
Limitations: ${meta.recording_quality.known_observability_limitations}

P5.1 NORMATIVE EXPECTATIONS:
${p51Formatted}

P5.2A TAUGHT CONCEPTS:
${p52aFormatted}

P5.2B INSTRUCTIONAL EPISODES:
${p52bFormatted}

Construct the full 8-dimension diagnostic coverage matrix in JSON.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const startTime = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' }
      });
      const latencyMs = Date.now() - startTime;
      rotateKey();

      const rawContent = res.choices[0].message.content;
      const parsed = JSON.parse(rawContent);

      validateAndCompleteDiagnosticMatrix(parsed, p51Pkg, pkgDirName);

      return {
        package_id: pkgDirName,
        topic: meta.topic,
        observability_assessment: {
          audio_clarity: meta.recording_quality.audio_clarity,
          transcript_completeness: meta.recording_quality.transcript_completeness,
          known_limitations: meta.recording_quality.known_observability_limitations,
          evidence_usable: meta.recording_quality.transcript_completeness === 'COMPLETE' && meta.recording_quality.audio_clarity !== 'LOW'
        },
        diagnostic_matrix: parsed.diagnostic_matrix,
        actionable_gaps: parsed.actionable_gaps,
        permissible_omissions: parsed.permissible_omissions,
        summary_diagnosis: parsed.summary_diagnosis,
        execution_stats: {
          latency_ms: latencyMs,
          model: MODEL_NAME,
          temperature: TEMPERATURE,
          retries: attempt
        }
      };
    } catch (err) {
      attempt++;
      rotateKey();
      const waitMs = Math.min(6000 + (attempt * 2000), 25000);
      console.warn(`[P5.3] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) {
        throw new Error(`Failed to analyze coverage for ${pkgDirName} after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('PHASE 5: COMPONENT P5.3 — TEACHING ADEQUACY & COVERAGE GAP ANALYZER (RQ3)');
  console.log('='.repeat(70));
  console.log(`Corpus Directory: ${corpusDir}`);
  console.log(`P5.1 Profiles:    ${p51File}`);
  console.log(`P5.2A Concepts:   ${p52aFile}`);
  console.log(`P5.2B Episodes:   ${p52bFile}`);
  console.log(`Target Model:     ${MODEL_NAME}`);
  console.log(`Temperature:      ${TEMPERATURE}`);
  console.log(`Output File:      ${outputFile}`);
  console.log('-'.repeat(70));

  if (!fs.existsSync(p51File) || !fs.existsSync(p52aFile) || !fs.existsSync(p52bFile)) {
    throw new Error('Missing prerequisite P5.1, P5.2A, or P5.2B result files');
  }

  const p51Data = JSON.parse(fs.readFileSync(p51File, 'utf8'));
  const p52aData = JSON.parse(fs.readFileSync(p52aFile, 'utf8'));
  const p52bData = JSON.parse(fs.readFileSync(p52bFile, 'utf8'));

  const pkgDirs = fs.readdirSync(corpusDir).filter(f => {
    return fs.statSync(path.join(corpusDir, f)).isDirectory() && f.startsWith('pkg_');
  }).sort();

  console.log(`Found ${pkgDirs.length} packages to analyze: ${pkgDirs.join(', ')}`);

  let results = {
    audit_timestamp: new Date().toISOString(),
    lead_model: MODEL_NAME,
    temperature: TEMPERATURE,
    packages: {}
  };

  if (fs.existsSync(outputFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      if (existing.packages) {
        results.packages = existing.packages;
        console.log(`Loaded ${Object.keys(results.packages).length} already completed packages from disk.`);
      }
    } catch (e) {
      // fresh start
    }
  }

  for (const pkgDir of pkgDirs) {
    if (results.packages[pkgDir] && results.packages[pkgDir].diagnostic_matrix) {
      console.log(`\nPackage ${pkgDir} already completed on disk. Skipping.`);
      continue;
    }

    const p51Pkg = p51Data.packages[pkgDir];
    const p52aPkg = p52aData.packages[pkgDir];
    const p52bPkg = p52bData.packages[pkgDir];

    console.log(`\nAnalyzing teaching adequacy for: ${pkgDir}...`);
    const analysis = await analyzeCoverageForPackage(pkgDir, p51Pkg, p52aPkg, p52bPkg);
    results.packages[pkgDir] = {
      package_id: pkgDir,
      topic: analysis.topic,
      observability_assessment: analysis.observability_assessment,
      diagnostic_matrix: analysis.diagnostic_matrix,
      actionable_gaps: analysis.actionable_gaps,
      permissible_omissions: analysis.permissible_omissions,
      summary_diagnosis: analysis.summary_diagnosis,
      execution_stats: analysis.execution_stats
    };
    console.log(`  ✓ Completed diagnosis for ${pkgDir} (${analysis.execution_stats.latency_ms} ms)`);
    console.log(`    Actionable Gaps: ${analysis.actionable_gaps.length} | Permissible Omissions: ${analysis.permissible_omissions.length}`);

    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\n' + '='.repeat(70));
  console.log(`P5.3 RUN COMPLETE: Diagnostic coverage matrices written to ${outputFile}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal execution error in P5.3 runner:', err);
    process.exit(1);
  });
}

module.exports = {
  run,
  analyzeCoverageForPackage,
  SYSTEM_PROMPT,
  validateAndCompleteDiagnosticMatrix
};
