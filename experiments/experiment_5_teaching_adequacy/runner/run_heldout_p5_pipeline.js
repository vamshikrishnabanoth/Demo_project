/**
 * experiments/experiment_5_teaching_adequacy/runner/run_heldout_p5_pipeline.js
 *
 * Phase 5 Experiment 5: Held-Out P5.3 Validation Pipeline
 * 
 * Executes P5.1, P5.2A, P5.2B, and Calibrated P5.3 across the 4 held-out packages:
 *   - pkg_07_os_deadlocks
 *   - pkg_08_biochem_kinetics
 *   - pkg_09_discrete_math_trees
 *   - pkg_10_microecon_game_theory
 *
 * CRITICAL METHODOLOGICAL CONTROLS & INFORMATION PARTITIONING:
 *   1. P5.1 receives ONLY metadata.json (topic, declared_learning_objective, syllabus_context, learner_level).
 *   2. P5.2A receives ONLY transcript.json and basic metadata (domain, subject, topic).
 *   3. P5.2B receives ONLY transcript.json and P5.2A concepts.
 *   4. P5.3 receives ONLY P5.1 profiles, P5.2A concepts, P5.2B episodes, and recording metadata.
 *   5. ZERO ground truth is read by any component during execution.
 *   6. ZERO mid-test tuning: uses frozen calibrated prompts and depth anchors.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const corpusDir = path.join(exp5Dir, 'benchmark_corpus');
const heldoutDir = path.join(exp5Dir, 'raw_results/heldout');
fs.mkdirSync(heldoutDir, { recursive: true });

const p51OutputFile = path.join(heldoutDir, 'p5_1_profiles_heldout.json');
const p52aOutputFile = path.join(heldoutDir, 'p5_2a_concepts_heldout.json');
const p52bOutputFile = path.join(heldoutDir, 'p5_2b_episodes_heldout.json');
const p53OutputFile = path.join(heldoutDir, 'p5_3_diagnostic_matrix_heldout.json');

const TARGET_PACKAGES = [
  'pkg_07_os_deadlocks',
  'pkg_08_biochem_kinetics',
  'pkg_09_discrete_math_trees',
  'pkg_10_microecon_game_theory'
];

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

// ============================================================================
// P5.1 DEFINITION & RUNNER
// ============================================================================
const P51_SYSTEM_PROMPT = `You are a Senior Curriculum Specialist and Normative Pedagogical Assessor.
Your task is to analyze a declared learning objective, syllabus context, learner level, and topic to construct the NORMATIVE EXPECTED DEPTH PROFILE across the 8 Universal Epistemic Dimensions.

EPISTEMIC DIMENSIONS & ANCHORS (Level 0 to 8):
1. IDENTIFICATION: Nominal recognition, statutory/mathematical naming, formal definition.
2. MEANING: Conceptual definitions, semantic scope, underlying intuitions.
3. STRUCTURE_COMPONENTS: Core constituent parts, mathematical terms, algorithmic primitives, data structures.
4. RELATIONSHIPS_MECHANISM: Invariant operations, interactions between components, operational dynamics.
5. JUSTIFICATION_WHY: Theoretical rationale, proofs, causal necessity, why mechanisms hold.
6. APPLICATION_INTERPRETATION: Worked execution traces, problem-solving application, case law / clinical scenario.
7. BOUNDARIES_EXCEPTIONS: Statutory/theoretical limitations, failure modes, counterfactual conditions, edge cases.
8. TRANSFER_SYNTHESIS: Cross-domain generalization, novel problem synthesis, long-term extensions.

ALIGNMENT TIERS:
- REQUIRED: Mandatory for satisfying the core syllabus objective.
- RECOMMENDED: Pedagogically valuable, but secondary to primary objective.
- OPTIONAL: Nice-to-have supplementary enrichment.
- PERMISSIBLE_SCOPE_OMISSION: Explicitly out of scope for a single lecture session; omission is expected and not penalized.

OUTPUT SCHEMA (JSON):
{
  "topic": string,
  "declared_objective": string,
  "expected_dimensions": {
    "IDENTIFICATION": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "MEANING": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "STRUCTURE_COMPONENTS": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "RELATIONSHIPS_MECHANISM": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "JUSTIFICATION_WHY": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "APPLICATION_INTERPRETATION": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "BOUNDARIES_EXCEPTIONS": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string },
    "TRANSFER_SYNTHESIS": { "level": number, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": string }
  }
}`;

async function runP51Package(pkgDirName, maxRetries = 10) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  const userPrompt = `ANALYZE THE SYLLABUS AND LEARNING OBJECTIVE FOR:
Topic: ${meta.topic}
Learner Level: ${meta.learner_level}
Syllabus Context: ${meta.syllabus_context}
Declared Learning Objective: ${meta.declared_learning_objective}

Construct the normative expected depth profile across all 8 dimensions in JSON format.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const t0 = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: P51_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      });
      rotateKey();
      const parsed = JSON.parse(res.choices[0].message.content);
      return {
        package_id: pkgDirName,
        topic: parsed.topic || meta.topic,
        declared_objective: parsed.declared_objective || meta.declared_learning_objective,
        expected_dimensions: parsed.expected_dimensions,
        execution_stats: { latency_ms: Date.now() - t0, model: MODEL_NAME }
      };
    } catch (err) {
      attempt++;
      console.warn(`[P5.1] Attempt ${attempt} for ${pkgDirName} failed: ${err.message}. Retrying...`);
      rotateKey();
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================================================
// P5.2A DEFINITION & RUNNER
// ============================================================================
const P52A_SYSTEM_PROMPT = `You are a Senior Instructional Analyst and Concept Reconstructor.
Your task is to analyze a raw lecture transcript and reconstruct the hierarchical concept tree of technical topics actually taught during the lecture.

RULES:
1. Base your reconstruction strictly on observable statements and derivations in the transcript.
2. Form a hierarchical tree:
   - Root represents the overall lecture domain.
   - Children (Level 1) represent primary thematic units (3 to 6 major themes).
   - Sub-children (Level 2) represent fine-grained concept units with specific operational mechanisms.
3. Every concept unit MUST have verbatim supporting quotes from the transcript.
4. Output JSON strictly matching the schema:
{
  "concept_hierarchy": {
    "root": string,
    "children": [
      {
        "id": string,
        "name": string,
        "parent": "root",
        "verbatim_evidence": [string],
        "children": [
          {
            "id": string,
            "name": string,
            "parent": string,
            "verbatim_evidence": [string],
            "children": []
          }
        ]
      }
    ]
  },
  "total_concepts_reconstructed": number
}`;

async function runP52aPackage(pkgDirName, maxRetries = 10) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const userPrompt = `RECONSTRUCT THE CONCEPT HIERARCHY FOR:
Topic: ${meta.topic}
Domain: ${meta.domain}
Raw Transcript:
"""
${transcript.raw_transcript}
"""`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const t0 = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: P52A_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      });
      rotateKey();
      const parsed = JSON.parse(res.choices[0].message.content);
      return {
        package_id: pkgDirName,
        concept_hierarchy: parsed.concept_hierarchy,
        total_concepts: parsed.total_concepts_reconstructed || (parsed.concept_hierarchy.children ? parsed.concept_hierarchy.children.length : 0),
        execution_stats: { latency_ms: Date.now() - t0, model: MODEL_NAME }
      };
    } catch (err) {
      attempt++;
      console.warn(`[P5.2A] Attempt ${attempt} for ${pkgDirName} failed: ${err.message}. Retrying...`);
      rotateKey();
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================================================
// P5.2B DEFINITION & RUNNER
// ============================================================================
const P52B_SYSTEM_PROMPT = `You are a Classroom Discourse Analyst and Instructional Episode Reconstructor.
Your task is to analyze timestamped transcript segments and reconstructed concept units to segment the lecture into chronological episodes.

INTELLECTUAL ACTIVITIES:
- EXPLAIN: Introducing definitions, conceptual mechanics, or descriptive summaries.
- COMPARE: Contrasting two or more models, approaches, or algorithms.
- DERIVE: Formal mathematical proof or step-by-step analytical deduction.
- EXECUTE: Step-by-step problem-solving trace or worked numerical scenario.
- FORMALIZE: Defining formal data structures, matrices, or mathematical notations.
- LIMIT: Outlining boundary limitations, scope constraints, or omitted topics.

OUTPUT SCHEMA (JSON):
{
  "episodes": [
    {
      "start": number,
      "end": number,
      "intellectual_activity": "EXPLAIN"|"COMPARE"|"DERIVE"|"EXECUTE"|"FORMALIZE"|"LIMIT",
      "interaction_mode": "LECTURE_MONOLOGUE"|"QUESTION_ANSWER",
      "dominant_concept": string,
      "revisitation": boolean
    }
  ],
  "total_episodes": number
}`;

async function runP52bPackage(pkgDirName, p52aPkg, maxRetries = 10) {
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const userPrompt = `RECONSTRUCT INSTRUCTIONAL EPISODES FOR:
Lecture Segments:
${JSON.stringify(transcript.segments, null, 2)}

Reconstructed Concepts:
${JSON.stringify(p52aPkg.concept_hierarchy, null, 2)}

Segment into chronological episodes with intellectual activity and revisitations.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const t0 = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: P52B_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      });
      rotateKey();
      const parsed = JSON.parse(res.choices[0].message.content);
      return {
        package_id: pkgDirName,
        episodes: parsed.episodes || [],
        total_episodes: parsed.total_episodes || (parsed.episodes ? parsed.episodes.length : 0),
        execution_stats: { latency_ms: Date.now() - t0, model: MODEL_NAME }
      };
    } catch (err) {
      attempt++;
      console.warn(`[P5.2B] Attempt ${attempt} for ${pkgDirName} failed: ${err.message}. Retrying...`);
      rotateKey();
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================================================
// CALIBRATED P5.3 DEFINITION & RUNNER
// ============================================================================
const P53_SYSTEM_PROMPT = `You are a Senior Pedagogical Diagnostician.
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
    "IDENTIFICATION": { "expected_depth": number, "alignment_tier": string, "observed_depth": number, "status": string, "evidence_synthesis": string, "confidence": "HIGH"|"MEDIUM"|"LOW" },
    ...
  },
  "actionable_gaps": [string],
  "permissible_omissions": [string]
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

function validateAndCompleteP53Matrix(parsed, p51Pkg, pkgId) {
  if (!parsed || typeof parsed !== 'object') parsed = {};
  if (!parsed.diagnostic_matrix || typeof parsed.diagnostic_matrix !== 'object') parsed.diagnostic_matrix = {};

  for (const dim of EXPECTED_DIMENSIONS) {
    const p51Dim = p51Pkg.expected_dimensions[dim] || { level: 2, alignment: 'OPTIONAL' };
    const expDepth = typeof p51Dim.level === 'number' ? p51Dim.level : 2;
    const alignTier = p51Dim.alignment || 'OPTIONAL';

    if (!parsed.diagnostic_matrix[dim]) {
      let inferredStatus = 'NOT_OBSERVED';
      if (alignTier === 'REQUIRED') inferredStatus = 'ACTIONABLE_COVERAGE_GAP';
      else if (alignTier === 'PERMISSIBLE_SCOPE_OMISSION' || alignTier === 'OPTIONAL') inferredStatus = 'PERMISSIBLE_SCOPE_OMISSION';

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
      derivedGaps.push(`${dim} (Expected ${e.expected_depth}, Observed ${e.observed_depth}): ${e.evidence_synthesis}`);
    } else if (e.status === 'PERMISSIBLE_SCOPE_OMISSION') {
      permCount++;
      derivedPerm.push(`${dim} (Expected ${e.expected_depth}, Observed ${e.observed_depth}): ${e.evidence_synthesis}`);
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

async function runP53Package(pkgDirName, p51Pkg, p52aPkg, p52bPkg, maxRetries = 10) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  const userPrompt = `AUDIT CONTEXT:
Package ID: ${pkgDirName}
Topic: ${meta.topic}
Learner Level: ${meta.learner_level}
Declared Learning Objective: ${meta.declared_learning_objective}
Recording Quality: ${JSON.stringify(meta.recording_quality)}

NORMATIVE EXPECTED DEPTH PROFILE (P5.1):
${JSON.stringify(p51Pkg.expected_dimensions, null, 2)}

RECONSTRUCTED INSTRUCTIONAL CONCEPTS (P5.2A):
${JSON.stringify(p52aPkg.concept_hierarchy, null, 2)}

RECONSTRUCTED INSTRUCTIONAL EPISODES (P5.2B):
${JSON.stringify(p52bPkg.episodes, null, 2)}

Construct the complete DIAGNOSTIC COVERAGE MATRIX across all 8 dimensions in JSON format.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const t0 = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: P53_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      });
      rotateKey();
      const parsed = JSON.parse(res.choices[0].message.content);
      validateAndCompleteP53Matrix(parsed, p51Pkg, pkgDirName);

      return {
        package_id: pkgDirName,
        topic: meta.topic,
        diagnostic_matrix: parsed.diagnostic_matrix,
        actionable_gaps: parsed.actionable_gaps,
        permissible_omissions: parsed.permissible_omissions,
        summary_diagnosis: parsed.summary_diagnosis,
        execution_stats: { latency_ms: Date.now() - t0, model: MODEL_NAME }
      };
    } catch (err) {
      attempt++;
      console.warn(`[P5.3] Attempt ${attempt} for ${pkgDirName} failed: ${err.message}. Retrying...`);
      rotateKey();
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================================================
// MAIN PIPELINE CONTROLLER
// ============================================================================
async function runHeldOutPipeline() {
  console.log('='.repeat(75));
  console.log('PHASE 5: HELDOUT VALIDATION PIPELINE (STEP 1 ONLY)');
  console.log('Target Packages: ', TARGET_PACKAGES.join(', '));
  console.log('Model:           ', MODEL_NAME);
  console.log('Output Directory:', heldoutDir);
  console.log('='.repeat(75));

  let p51Results = fs.existsSync(p51OutputFile) ? JSON.parse(fs.readFileSync(p51OutputFile, 'utf8')) : { packages: {} };
  let p52aResults = fs.existsSync(p52aOutputFile) ? JSON.parse(fs.readFileSync(p52aOutputFile, 'utf8')) : { packages: {} };
  let p52bResults = fs.existsSync(p52bOutputFile) ? JSON.parse(fs.readFileSync(p52bOutputFile, 'utf8')) : { packages: {} };
  let p53Results = fs.existsSync(p53OutputFile) ? JSON.parse(fs.readFileSync(p53OutputFile, 'utf8')) : { packages: {} };

  for (const pkgId of TARGET_PACKAGES) {
    console.log(`\n>>> Processing Held-Out Package: [${pkgId}]`);

    // Step 1: P5.1 Normative Depth Profile
    if (!p51Results.packages[pkgId]) {
      process.stdout.write(`  [P5.1] Generating normative profile... `);
      const res = await runP51Package(pkgId);
      p51Results.packages[pkgId] = res;
      fs.writeFileSync(p51OutputFile, JSON.stringify(p51Results, null, 2));
      console.log(`Done (${res.execution_stats.latency_ms} ms)`);
    } else {
      console.log(`  [P5.1] Cached.`);
    }

    // Step 2: P5.2A Topic Concept Reconstructor
    if (!p52aResults.packages[pkgId]) {
      process.stdout.write(`  [P5.2A] Reconstructing concepts... `);
      const res = await runP52aPackage(pkgId);
      p52aResults.packages[pkgId] = res;
      fs.writeFileSync(p52aOutputFile, JSON.stringify(p52aResults, null, 2));
      console.log(`Done (${res.execution_stats.latency_ms} ms, ${res.total_concepts} concepts)`);
    } else {
      console.log(`  [P5.2A] Cached.`);
    }

    // Step 3: P5.2B Episode Reconstructor
    if (!p52bResults.packages[pkgId]) {
      process.stdout.write(`  [P5.2B] Reconstructing episodes... `);
      const res = await runP52bPackage(pkgId, p52aResults.packages[pkgId]);
      p52bResults.packages[pkgId] = res;
      fs.writeFileSync(p52bOutputFile, JSON.stringify(p52bResults, null, 2));
      console.log(`Done (${res.execution_stats.latency_ms} ms, ${res.total_episodes} episodes)`);
    } else {
      console.log(`  [P5.2B] Cached.`);
    }

    // Step 4: Calibrated P5.3 Diagnostic Coverage Analyzer
    if (!p53Results.packages[pkgId]) {
      process.stdout.write(`  [P5.3] Analyzing diagnostic coverage matrix... `);
      const res = await runP53Package(
        pkgId,
        p51Results.packages[pkgId],
        p52aResults.packages[pkgId],
        p52bResults.packages[pkgId]
      );
      p53Results.packages[pkgId] = res;
      fs.writeFileSync(p53OutputFile, JSON.stringify(p53Results, null, 2));
      console.log(`Done (${res.execution_stats.latency_ms} ms, ${res.actionable_gaps.length} gaps, ${res.permissible_omissions.length} omissions)`);
    } else {
      console.log(`  [P5.3] Cached.`);
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log('Held-Out Pipeline Execution Complete for all 4 packages!');
  console.log(`P5.1 Profiles:     ${p51OutputFile}`);
  console.log(`P5.2A Concepts:    ${p52aOutputFile}`);
  console.log(`P5.2B Episodes:    ${p52bOutputFile}`);
  console.log(`P5.3 Diagnostics:  ${p53OutputFile}`);
  console.log('='.repeat(75));
}

runHeldOutPipeline().catch(err => {
  console.error('\nCRITICAL PIPELINE FAILURE:', err);
  process.exit(1);
});
