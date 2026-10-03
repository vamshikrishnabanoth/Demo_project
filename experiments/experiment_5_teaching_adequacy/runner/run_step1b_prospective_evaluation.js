/**
 * experiments/experiment_5_teaching_adequacy/runner/run_step1b_prospective_evaluation.js
 *
 * Milestone v3.6 Step 1B: Prospective Generalization Evaluation
 *
 * Executes the complete frozen Phase 5 pipeline across the 4 newly curated,
 * previously unencountered academic domains (pkg_11 through pkg_14, 32 epistemic dimensions):
 *   - pkg_11_physics_thermodynamics (Carnot Cycle, Efficiency, Entropy)
 *   - pkg_12_pharmacology_clearance (Pharmacokinetics, Clearance, Half-Life)
 *   - pkg_13_logic_predicates (First-Order Predicate Logic, Models, Semantics)
 *   - pkg_14_signal_processing_fourier (Discrete Fourier Transform, Sampling, Resolution)
 *
 * Information Partitioning & Pipeline Protocol:
 *   1. P5.1 receives ONLY metadata.json (topic, declared_learning_objective, syllabus_context, learner_level).
 *   2. P5.2A receives ONLY transcript.json and basic metadata (domain, subject, topic).
 *   3. P5.2B receives ONLY transcript.json and P5.2A concepts.
 *   4. Calibrated P5.3 receives ONLY P5.1 profiles, P5.2A concepts, P5.2B episodes, and recording metadata.
 *   5. ZERO ground truth is read by any component during execution.
 *   6. Single-shot protocol: Zero mid-test tuning, zero prompt tweaking, frozen calibrated P5.3.
 *
 * Predeclared Acceptance Gates (N=32 dimensions, 7 actionable gaps):
 *   - Gate 1 (Actionable Gap Recall): >= 80.0% (target: TP >= 6 out of 7)
 *   - Gate 2 (Actionable Gap Precision): >= 50.0% (target: FP <= TP)
 *   - Gate 3 (Permissible Scope Omission Specificity): >= 85.0% (target: TN_perm >= 24 out of 28 non-permissible)
 *   - Primary Gate: All 3 gates must pass concurrently.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const corpusDir = path.join(exp5Dir, 'benchmark_corpus');

// Frozen P5.3 analyzer (manifest verified hash 0884d2923fc5581a2e0e193c285e98acc646e9ea282a09db67238e4541bee9ee)
const {
  analyzeCoverageForPackage,
  EXPECTED_DIMENSIONS
} = require('./p5_3_coverage_gap_analyzer');

const TARGET_PACKAGES = [
  'pkg_11_physics_thermodynamics',
  'pkg_12_pharmacology_clearance',
  'pkg_13_logic_predicates',
  'pkg_14_signal_processing_fourier'
];

// Unified 6-key pool with active quota rotation
const apiKeys = [
  process.env.GROQ_API_KEY_FRESH,
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

const prospectiveOutDir = path.join(exp5Dir, 'raw_results/prospective_v3_6');
fs.mkdirSync(prospectiveOutDir, { recursive: true });

const p51OutputFile = path.join(prospectiveOutDir, 'p5_1_profiles_prospective.json');
const p52aOutputFile = path.join(prospectiveOutDir, 'p5_2a_concepts_prospective.json');
const p52bOutputFile = path.join(prospectiveOutDir, 'p5_2b_episodes_prospective.json');
const p53OutputFile = path.join(prospectiveOutDir, 'p5_3_diagnostic_matrix_prospective.json');
const evalOutputFile = path.join(prospectiveOutDir, 'p5_3_evaluation_summary_prospective.json');

const gtNormFile = path.join(exp5Dir, 'ground_truth/normative/normative_reference_profiles_pkg11_14.json');
const gtObsFile = path.join(exp5Dir, 'ground_truth/observational/observational_reference_evidence_pkg11_14.json');

function loadOrCreate(filePath, defaultHeader) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.warn(`Warning: could not parse ${filePath}, creating fresh.`);
    }
  }
  return { ...defaultHeader, packages: {} };
}

// ============================================================================
// P5.1 DEFINITION & ROBUST RUNNER
// ============================================================================
const P51_SYSTEM_PROMPT = `You are a Senior Curricular Architect and Normative Pedagogical Evaluator.
Given a lecture topic, declared learning objective, syllabus context, and learner level, your task is to construct the NORMATIVE EXPECTED DEPTH PROFILE for the lecture.
You determine what SHOULD be taught in this session to adequately satisfy the declared objective within the given syllabus context.

You must evaluate across EIGHT UNIVERSAL EPISTEMIC DIMENSIONS. These dimensions are an expressive reference vocabulary, NOT a mandatory sequential staircase:
1. IDENTIFICATION: Naming, terminology, formal recognition, core symbols.
2. MEANING: Conceptual definition, qualitative intuition, primary assertions, significance.
3. STRUCTURE_COMPONENTS: Internal constituent elements, syntax, parameters, clauses, structural architecture.
4. RELATIONSHIPS_MECHANISM: Dynamic interaction between components, operational flow, execution steps, inter-clause relationships, causal dynamics.
5. JUSTIFICATION_WHY: Underlying theoretical rationale, formal mathematical derivation/proof, constitutional/philosophical purpose, why the principle holds against alternatives.
6. APPLICATION_INTERPRETATION: Concrete problem-solving, worked numerical/code execution trace, judicial case-precedent analysis, practical instantiation.
7. BOUNDARIES_EXCEPTIONS: Boundary evaluation, edge cases, failure modes, invariant breakdowns, constitutional/statutory limitations, non-applicability conditions.
8. TRANSFER_SYNTHESIS: Cross-domain transfer, novel constraint adaptation, synthesis with disparate frameworks, counterfactual reasoning.

OPERATIONAL DEPTH ANCHORS (Level 0 to 8):
- Level 0: No Observable Evidence (Not expected or absent from instructional scope).
- Level 1: Nominal Recognition / Mention (Named, labeled, or stated as a term without conceptual definition).
- Level 2: Surface Description / Core Definition (Basic qualitative definition, primary assertion, or intuitive description).
- Level 3: Univariate Mechanism / Structured Elaboration (Internal components, basic steps, or direct causal sequence articulated).
- Level 4: Systemic Interaction / Dynamic Operational Flow (Components interacting dynamically under operational conditions; intermediate execution states or inter-clause relationships).
- Level 5: Formal Derivation / Foundational Justification (Rigorous explanation of WHY the concept holds; formal proof, theoretical necessity, or constitutional purpose against alternatives).
- Level 6: Concrete Application / Worked Interpretation (Comprehensive application to a complete practical problem, non-trivial worked execution trace, or judicial case-precedent analysis).
- Level 7: Boundary Evaluation / Failure-Mode Analysis (Explicit examination of edge cases, invariant breakdowns, constitutional limitations, or algorithmic failure modes).
- Level 8: Cross-Domain Synthesis / Generalization (Transfer to novel problem constraints, counterfactual scenarios, or synthesis with disparate domain frameworks).

ALIGNMENT TIERS:
- REQUIRED: Essential core dimension for the declared objective and syllabus context. If omitted or below threshold, it constitutes an actionable gap.
- RECOMMENDED: Desirable enrichment dimension that reinforces the objective, but secondary to required core elements.
- OPTIONAL: Supplementary depth or context that instructor may introduce if time permits.
- PERMISSIBLE_SCOPE_OMISSION: Explicitly outside the declared objective or syllabus level for this session; zero expectation to be covered in this lecture.

CONFIDENCE RATINGS:
- HIGH: Direct, unambiguous match with declared objective and explicit syllabus scope.
- MEDIUM: Reasonable pedagogical inference from syllabus context or learner level.
- LOW: Ambiguous curricular expectation requiring subjective judgment.

OUTPUT FORMAT:
Respond strictly with a valid JSON object matching this schema:
{
  "topic": "...",
  "declared_objective": "...",
  "expected_dimensions": {
    "IDENTIFICATION": { "level": 0-8, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": "concise explanation", "confidence": "HIGH"|"MEDIUM"|"LOW" },
    "MEANING": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "STRUCTURE_COMPONENTS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "RELATIONSHIPS_MECHANISM": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "JUSTIFICATION_WHY": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "APPLICATION_INTERPRETATION": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "BOUNDARIES_EXCEPTIONS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "TRANSFER_SYNTHESIS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." }
  }
}`;

const VALID_ALIGNMENTS = new Set([
  'REQUIRED',
  'RECOMMENDED',
  'OPTIONAL',
  'PERMISSIBLE_SCOPE_OMISSION'
]);
const VALID_CONFIDENCES = new Set(['HIGH', 'MEDIUM', 'LOW']);

function validateGeneratedProfile(profile, pkgId) {
  if (!profile || typeof profile !== 'object') {
    throw new Error(`Profile for ${pkgId} is not an object`);
  }
  if (!profile.expected_dimensions || typeof profile.expected_dimensions !== 'object') {
    throw new Error(`Profile for ${pkgId} missing expected_dimensions`);
  }

  for (const dim of EXPECTED_DIMENSIONS) {
    const d = profile.expected_dimensions[dim];
    if (!d) {
      throw new Error(`Profile for ${pkgId} missing dimension: ${dim}`);
    }
    if (typeof d.level !== 'number' || d.level < 0 || d.level > 8 || !Number.isInteger(d.level)) {
      throw new Error(`Profile for ${pkgId} dimension ${dim} has invalid level: ${d.level}`);
    }
    if (!VALID_ALIGNMENTS.has(d.alignment)) {
      throw new Error(`Profile for ${pkgId} dimension ${dim} has invalid alignment: ${d.alignment}`);
    }
    if (typeof d.rationale !== 'string' || d.rationale.trim().length === 0) {
      throw new Error(`Profile for ${pkgId} dimension ${dim} has invalid rationale`);
    }
    if (!VALID_CONFIDENCES.has(d.confidence)) {
      throw new Error(`Profile for ${pkgId} dimension ${dim} has invalid confidence: ${d.confidence}`);
    }
  }
}

async function runP51(pkgDirName, maxRetries = 40) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  const userPrompt = `TOPIC: ${meta.topic}
LEARNER LEVEL: ${meta.learner_level}
SYLLABUS CONTEXT: ${meta.syllabus_context}
DECLARED LEARNING OBJECTIVE: ${meta.declared_learning_objective}

Evaluate the normative depth expectations across all 8 dimensions in JSON format.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const startTime = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: P51_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: 3500,
        response_format: { type: 'json_object' }
      });
      const latencyMs = Date.now() - startTime;
      rotateKey();

      const parsed = JSON.parse(res.choices[0].message.content);
      validateGeneratedProfile(parsed, pkgDirName);

      return {
        topic: parsed.topic || meta.topic,
        declared_objective: parsed.declared_objective || meta.declared_learning_objective,
        expected_dimensions: parsed.expected_dimensions,
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
      const waitMs = Math.min(4000 + (attempt * 2000), 30000);
      console.warn(`[P5.1] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// P5.2A DEFINITION & ROBUST RUNNER (4500 max_tokens for reasoning model)
// ============================================================================
const P52A_SYSTEM_PROMPT = `You are an Expert Instructional Concept Reconstructor and Knowledge Cartographer.
Your task is to analyze the provided lecture transcript and reconstruct the hierarchical concept map of technical topics and sub-topics ACTUALLY TAUGHT during the lecture.

CONCEPT-UNIT GRANULARITY POLICY:
A concept unit is the smallest independently assessable domain proposition required to distinguish one instructional target from another.
- Target approximately 6 to 10 distinct technical concepts for the session.
- Do NOT output trivial phrase fragments or single words.
- Do NOT output overly broad monolithic headers (e.g., 'Linear Algebra' as a single concept).
- Identify distinct technical principles, theorems, precedents, formulas, mechanisms, structural components, or boundary conditions.
- Group closely related sub-mechanisms as child concepts under their parent concept.
- Every concept must be grounded in explicit transcript evidence.

UNIVERSAL EPISTEMIC DIMENSIONS:
Classify each concept by its primary epistemic dimension:
- IDENTIFICATION: Naming, statutory/formal notation, terminology, identification of key entities.
- MEANING: Conceptual definition, qualitative intuition, core significance.
- STRUCTURE_COMPONENTS: Structural parts, parameters, clauses, data structures, constituent elements.
- RELATIONSHIPS_MECHANISM: Dynamic interaction, execution flow, procedural sequence, mutual relationships.
- JUSTIFICATION_WHY: Underlying theoretical rationale, formal proof, constitutional purpose, why it holds against alternatives.
- APPLICATION_INTERPRETATION: Concrete worked problem, practical scenario, judicial precedent application, execution trace.
- BOUNDARIES_EXCEPTIONS: Boundary conditions, failure modes, edge cases, exceptions, statutory limitations.
- TRANSFER_SYNTHESIS: Cross-domain transfer, novel extensions, future implications.

CRITICAL INSTRUCTIONS:
- You are strictly an OBSERVATIONAL reconstructor. Do NOT assess whether teaching was adequate. Do NOT declare missing concepts or gaps. Map ONLY what was actually communicated in the transcript.
- For each concept, extract a concise verbatim evidence quote from the transcript with approximate timestamps.

OUTPUT SCHEMA (JSON):
{
  "root_concept": "string",
  "concepts": [
    {
      "concept_id": "C01",
      "name": "string",
      "parent_id": "root",
      "epistemic_dimension": "IDENTIFICATION",
      "observed_summary": "concise description of what was actually taught about this concept in the lecture",
      "evidence_quotes": [
        {
          "quote": "verbatim text snippet from transcript",
          "approx_start_sec": number,
          "approx_end_sec": number
        }
      ],
      "confidence": "HIGH"
    }
  ]
}`;

function validateConceptMap(parsed, pkgId) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Output for ${pkgId} is not an object`);
  }
  if (!parsed.root_concept || typeof parsed.root_concept !== 'string') {
    throw new Error(`Output for ${pkgId} missing root_concept`);
  }
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length < 3) {
    throw new Error(`Output for ${pkgId} concepts must be an array with at least 3 concepts`);
  }
}

async function runP52A(pkgDirName, maxRetries = 40) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const userPrompt = `DOMAIN: ${meta.domain}
SUBJECT: ${meta.subject}
TOPIC: ${meta.topic}

TRANSCRIPT TO ANALYZE:
${transcript.raw_transcript}

Reconstruct the observed technical concept map in valid JSON matching the schema.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const startTime = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: P52A_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: 4500,
        response_format: { type: 'json_object' }
      });
      const latencyMs = Date.now() - startTime;
      rotateKey();

      const parsed = JSON.parse(res.choices[0].message.content);
      validateConceptMap(parsed, pkgDirName);

      return {
        topic: meta.topic,
        domain: meta.domain,
        root_concept: parsed.root_concept,
        concept_count: parsed.concepts.length,
        concepts: parsed.concepts,
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
      const waitMs = Math.min(4000 + (attempt * 2000), 30000);
      console.warn(`[P5.2A] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// P5.2B DEFINITION & ROBUST RUNNER (4500 max_tokens for reasoning model)
// ============================================================================
const P52B_SYSTEM_PROMPT = `You are an Expert Instructional Episode and Discourse Progression Reconstructor.
Analyze a timestamped lecture timeline and its reconstructed technical concepts to reconstruct the CHRONOLOGICAL INSTRUCTIONAL EPISODES and CONCEPT REVISITATIONS.

CRITICAL INSTRUCTIONS & DEFINITIONS:
1. Decouple Intellectual Activity from Interaction Mode:
   - Intellectual Activity: EXPLAIN, COMPARE, DERIVE, TRACE, APPLY, JUSTIFY, LIMIT, GENERALIZE, UNCERTAIN.
   - Interaction Mode: LECTURE_MONOLOGUE, QUESTION_ANSWER, STUDENT_RESPONSE, STUDENT_TASK, SOCRATIC_DISCUSSION, LIVE_DEMONSTRATION, UNCERTAIN.
2. Explicit Concept Revisitation Capture:
   - Set "revisitation": true whenever an episode returns to, contrasts with, re-applies, or deepens a concept introduced earlier.
3. Temporal Boundaries:
   - Cover the entire lecture timeline continuously using integer start and end seconds matching segment transitions.

OUTPUT SCHEMA (JSON):
{
  "episodes": [
    {
      "episode_id": "E01",
      "start": 0,
      "end": 45,
      "dominant_concept": "concept name or ID",
      "intellectual_activity": "EXPLAIN",
      "interaction_mode": "LECTURE_MONOLOGUE",
      "revisitation": boolean,
      "revisitation_target": null,
      "evidence_quote": "short quote",
      "confidence": "HIGH"
    }
  ]
}`;

function validateEpisodes(parsed, pkgId) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.episodes) || parsed.episodes.length < 2) {
    throw new Error(`Output for ${pkgId} must contain an episodes array with at least 2 episodes`);
  }
}

async function runP52B(pkgDirName, pkgConcepts, maxRetries = 40) {
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const conceptListFormatted = pkgConcepts.map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension})`).join('\n');
  const segmentsFormatted = transcript.segments.map(s => `[${s.start}s - ${s.end}s]: ${s.text}`).join('\n\n');

  const userPrompt = `RECONSTRUCTED TECHNICAL CONCEPTS (from P5.2A):
${conceptListFormatted}

TIMESTAMPED LECTURE TIMELINE:
${segmentsFormatted}

Reconstruct the chronological instructional episodes across the full timeline in valid JSON.`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const client = getGroqClient();
      const startTime = Date.now();
      const res = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: P52B_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: 4500,
        response_format: { type: 'json_object' }
      });
      const latencyMs = Date.now() - startTime;
      rotateKey();

      const parsed = JSON.parse(res.choices[0].message.content);
      validateEpisodes(parsed, pkgDirName);

      return {
        package_id: pkgDirName,
        episode_count: parsed.episodes.length,
        episodes: parsed.episodes,
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
      const waitMs = Math.min(4000 + (attempt * 2000), 30000);
      console.warn(`[P5.2B] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// MAIN BENCHMARK CONTROLLER
// ============================================================================
async function main() {
  console.log('='.repeat(80));
  console.log('MILESTONE v3.6 STEP 1B: PROSPECTIVE GENERALIZATION EVALUATION');
  console.log('Target Packages: pkg_11 through pkg_14 (32 epistemic dimensions, 4 distinct domains)');
  console.log('Lead Model:      openai/gpt-oss-120b on Groq (Temperature: 0.0)');
  console.log('Key Pool Size:  ', apiKeys.length, 'keys active');
  console.log('Execution Mode:  Single-Shot Frozen Benchmark');
  console.log('='.repeat(80));

  if (!fs.existsSync(gtNormFile) || !fs.existsSync(gtObsFile)) {
    throw new Error('Consensus ground truth files missing for pkg_11-14 in ground_truth directory.');
  }

  // --------------------------------------------------------------------------
  // STAGE 1: P5.1 NORMATIVE DEPTH PROFILES
  // --------------------------------------------------------------------------
  console.log('\n[STAGE 1/4] Running P5.1 Normative Depth Profile Generator...');
  let p51Results = loadOrCreate(p51OutputFile, {
    generation_timestamp: new Date().toISOString(),
    benchmark_scope: 'Step 1B Prospective Generalization (pkg_11 to pkg_14)',
    component: 'P5.1 Normative Expected Depth'
  });

  for (const pkgId of TARGET_PACKAGES) {
    if (p51Results.packages[pkgId] && p51Results.packages[pkgId].expected_dimensions) {
      console.log(`  - ${pkgId}: Cached profile found. Skipping.`);
      continue;
    }
    console.log(`  - Generating P5.1 profile for ${pkgId}...`);
    const profile = await runP51(pkgId);
    p51Results.packages[pkgId] = {
      topic: profile.topic,
      declared_objective: profile.declared_objective,
      expected_dimensions: profile.expected_dimensions,
      execution_stats: profile.execution_stats
    };
    fs.writeFileSync(p51OutputFile, JSON.stringify(p51Results, null, 2), 'utf8');
    console.log(`    ✓ Done in ${profile.execution_stats.latency_ms} ms`);
  }

  // --------------------------------------------------------------------------
  // STAGE 2: P5.2A INSTRUCTIONAL CONCEPT RECONSTRUCTION
  // --------------------------------------------------------------------------
  console.log('\n[STAGE 2/4] Running P5.2A Concept Reconstructor...');
  let p52aResults = loadOrCreate(p52aOutputFile, {
    reconstruction_timestamp: new Date().toISOString(),
    benchmark_scope: 'Step 1B Prospective Generalization (pkg_11 to pkg_14)',
    component: 'P5.2A Observational Concepts'
  });

  for (const pkgId of TARGET_PACKAGES) {
    if (p52aResults.packages[pkgId] && p52aResults.packages[pkgId].concepts && p52aResults.packages[pkgId].concepts.length >= 3) {
      console.log(`  - ${pkgId}: Cached concepts found (${p52aResults.packages[pkgId].concept_count} concepts). Skipping.`);
      continue;
    }
    console.log(`  - Reconstructing P5.2A concepts for ${pkgId}...`);
    const conceptMap = await runP52A(pkgId);
    p52aResults.packages[pkgId] = {
      topic: conceptMap.topic,
      domain: conceptMap.domain,
      root_concept: conceptMap.root_concept,
      concept_count: conceptMap.concept_count,
      concepts: conceptMap.concepts,
      execution_stats: conceptMap.execution_stats
    };
    fs.writeFileSync(p52aOutputFile, JSON.stringify(p52aResults, null, 2), 'utf8');
    console.log(`    ✓ Done in ${conceptMap.execution_stats.latency_ms} ms (${conceptMap.concept_count} concepts)`);
  }

  // --------------------------------------------------------------------------
  // STAGE 3: P5.2B INSTRUCTIONAL EPISODE RECONSTRUCTION
  // --------------------------------------------------------------------------
  console.log('\n[STAGE 3/4] Running P5.2B Episode Reconstructor...');
  let p52bResults = loadOrCreate(p52bOutputFile, {
    reconstruction_timestamp: new Date().toISOString(),
    benchmark_scope: 'Step 1B Prospective Generalization (pkg_11 to pkg_14)',
    component: 'P5.2B Observational Episodes'
  });

  for (const pkgId of TARGET_PACKAGES) {
    if (p52bResults.packages[pkgId] && p52bResults.packages[pkgId].episodes && p52bResults.packages[pkgId].episodes.length > 0) {
      console.log(`  - ${pkgId}: Cached episodes found (${p52bResults.packages[pkgId].episode_count} episodes). Skipping.`);
      continue;
    }
    console.log(`  - Reconstructing P5.2B episodes for ${pkgId}...`);
    const pkgConcepts = p52aResults.packages[pkgId].concepts;
    const episodeMap = await runP52B(pkgId, pkgConcepts);
    p52bResults.packages[pkgId] = {
      package_id: pkgId,
      episode_count: episodeMap.episode_count,
      episodes: episodeMap.episodes,
      execution_stats: episodeMap.execution_stats
    };
    fs.writeFileSync(p52bOutputFile, JSON.stringify(p52bResults, null, 2), 'utf8');
    console.log(`    ✓ Done in ${episodeMap.execution_stats.latency_ms} ms (${episodeMap.episode_count} episodes)`);
  }

  // --------------------------------------------------------------------------
  // STAGE 4: CALIBRATED P5.3 DIAGNOSTIC COVERAGE ANALYZER (FROZEN)
  // --------------------------------------------------------------------------
  console.log('\n[STAGE 4/4] Running Calibrated P5.3 Diagnostic Coverage Gap Analyzer...');
  let p53Results = loadOrCreate(p53OutputFile, {
    analysis_timestamp: new Date().toISOString(),
    benchmark_scope: 'Step 1B Prospective Generalization (pkg_11 to pkg_14)',
    component: 'P5.3 Diagnostic Coverage Matrix'
  });

  for (const pkgId of TARGET_PACKAGES) {
    if (p53Results.packages[pkgId] && p53Results.packages[pkgId].diagnostic_matrix) {
      console.log(`  - ${pkgId}: Cached diagnostic matrix found. Skipping.`);
      continue;
    }
    console.log(`  - Diagnosing coverage for ${pkgId}...`);
    const p51Pkg = p51Results.packages[pkgId];
    const p52aPkg = p52aResults.packages[pkgId];
    const p52bPkg = p52bResults.packages[pkgId];

    const analysis = await analyzeCoverageForPackage(pkgId, p51Pkg, p52aPkg, p52bPkg);
    p53Results.packages[pkgId] = {
      package_id: pkgId,
      topic: analysis.topic,
      observability_assessment: analysis.observability_assessment,
      diagnostic_matrix: analysis.diagnostic_matrix,
      actionable_gaps: analysis.actionable_gaps,
      secondary_advisory_gaps: analysis.secondary_advisory_gaps,
      permissible_omissions: analysis.permissible_omissions,
      structural_incompletes: analysis.structural_incompletes,
      summary_diagnosis: analysis.summary_diagnosis,
      execution_stats: analysis.execution_stats
    };
    fs.writeFileSync(p53OutputFile, JSON.stringify(p53Results, null, 2), 'utf8');
    console.log(`    ✓ Done in ${analysis.execution_stats.latency_ms} ms (${analysis.execution_stats.response_reliability})`);
    console.log(`      Actionable Gaps: ${analysis.actionable_gaps.length} | Advisory: ${analysis.secondary_advisory_gaps ? analysis.secondary_advisory_gaps.length : 0} | Permissible: ${analysis.permissible_omissions.length}`);
  }

  // --------------------------------------------------------------------------
  // STAGE 5: SCIENTIFIC EVALUATION AGAINST ADJUDICATED CONSENSUS GROUND TRUTH
  // --------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION AGAINST ADJUDICATED CONSENSUS GROUND TRUTH (pkg_11 to pkg_14)');
  console.log('='.repeat(80));

  const gtNormData = JSON.parse(fs.readFileSync(gtNormFile, 'utf8'));
  const gtObsData = JSON.parse(fs.readFileSync(gtObsFile, 'utf8'));

  const packageSummaries = {};
  let totalDimensions = 0;
  let totalValidDimensions = 0;
  let totalStructuralIncompletes = 0;

  let totalObsMadeSum = 0;
  let totalObsSdbSum = 0;
  let totalStatusMatches = 0;

  // Core Actionable Gaps (REQUIRED tier only)
  let gapTP = 0, gapFP = 0, gapFN = 0, gapTN = 0;

  // Permissible Scope Omissions
  let permTP = 0, permFP = 0, permFN = 0, permTN = 0;

  // Secondary Advisory Gaps (RECOMMENDED tier)
  let totalAdvisoryPredicted = 0;
  const advisoryGapsList = [];

  // Reliability distribution
  const reliabilityCounts = {
    valid_first_response: 0,
    valid_after_retry: 0,
    incomplete_after_retry: 0
  };

  const dimensionDisagreements = [];

  for (const pkgId of TARGET_PACKAGES) {
    const predPkg = p53Results.packages[pkgId];
    const gtObsPkg = gtObsData.packages[pkgId];
    const gtNormPkg = gtNormData.packages[pkgId];

    const rel = predPkg.execution_stats.response_reliability || 'valid_first_response';
    reliabilityCounts[rel] = (reliabilityCounts[rel] || 0) + 1;

    let pkgValidDims = 0;
    let pkgStructInc = 0;
    let pkgObsAbsErr = 0;
    let pkgObsSignedErr = 0;
    let pkgStatusMatches = 0;

    let pkgGapTP = 0, pkgGapFP = 0, pkgGapFN = 0, pkgGapTN = 0;
    let pkgPermTP = 0, pkgPermFP = 0, pkgPermFN = 0, pkgPermTN = 0;
    let pkgAdvisoryCount = 0;

    const dimDetails = {};

    for (const dim of EXPECTED_DIMENSIONS) {
      totalDimensions++;
      const predEntry = predPkg.diagnostic_matrix[dim];
      const gtMatrixEntry = gtObsPkg.diagnostic_coverage_matrix[dim];
      const gtObsDim = gtObsPkg.observed_dimensions[dim];
      const gtNormDim = gtNormPkg.expected_dimensions[dim];

      const gtStatus = gtMatrixEntry ? gtMatrixEntry.status : 'NOT_OBSERVED';
      const predStatus = predEntry ? predEntry.status : 'NOT_OBSERVED';

      // Structural incompleteness check
      if (predStatus === 'STRUCTURAL_OUTPUT_INCOMPLETE' || (predEntry && predEntry.observed_depth === null)) {
        pkgStructInc++;
        totalStructuralIncompletes++;
        dimDetails[dim] = {
          status: 'STRUCTURAL_OUTPUT_INCOMPLETE',
          evaluated_in_pedagogical_metrics: false
        };
        continue;
      }

      pkgValidDims++;
      totalValidDimensions++;

      const gtObsLevel = gtObsDim ? gtObsDim.level : 0;
      const predObsLevel = predEntry.observed_depth !== null ? predEntry.observed_depth : 0;

      const absErr = Math.abs(predObsLevel - gtObsLevel);
      const signedErr = predObsLevel - gtObsLevel;

      pkgObsAbsErr += absErr;
      pkgObsSignedErr += signedErr;
      totalObsMadeSum += absErr;
      totalObsSdbSum += signedErr;

      const statusMatch = (predStatus === gtStatus);
      if (statusMatch) {
        pkgStatusMatches++;
        totalStatusMatches++;
      } else {
        dimensionDisagreements.push({
          package_id: pkgId,
          dimension: dim,
          expected_depth: predEntry.expected_depth,
          alignment_tier: predEntry.alignment_tier,
          pred_observed_depth: predObsLevel,
          gt_observed_depth: gtObsLevel,
          pred_status: predStatus,
          gt_status: gtStatus,
          evidence_synthesis: predEntry.evidence_synthesis
        });
      }

      // Core Actionable Gaps (REQUIRED tier only)
      const gtIsGap = (gtStatus === 'ACTIONABLE_COVERAGE_GAP');
      const predIsGap = (predStatus === 'ACTIONABLE_COVERAGE_GAP');

      if (predIsGap && gtIsGap) { gapTP++; pkgGapTP++; }
      else if (predIsGap && !gtIsGap) { gapFP++; pkgGapFP++; }
      else if (!predIsGap && gtIsGap) { gapFN++; pkgGapFN++; }
      else { gapTN++; pkgGapTN++; }

      // Permissible Scope Omissions
      const gtIsPerm = (gtStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      const predIsPerm = (predStatus === 'PERMISSIBLE_SCOPE_OMISSION');

      if (predIsPerm && gtIsPerm) { permTP++; pkgPermTP++; }
      else if (predIsPerm && !gtIsPerm) { permFP++; pkgPermFP++; }
      else if (!predIsPerm && gtIsPerm) { permFN++; pkgPermFN++; }
      else { permTN++; pkgPermTN++; }

      // Secondary Advisory Gaps (RECOMMENDED tier)
      if (predStatus === 'SECONDARY_ADVISORY_GAP') {
        pkgAdvisoryCount++;
        totalAdvisoryPredicted++;
        advisoryGapsList.push({
          package_id: pkgId,
          dimension: dim,
          expected_depth: predEntry.expected_depth,
          observed_depth: predObsLevel,
          evidence: predEntry.evidence_synthesis
        });
      }

      dimDetails[dim] = {
        expected_depth: predEntry.expected_depth,
        alignment_tier: predEntry.alignment_tier,
        gt_observed_depth: gtObsLevel,
        pred_observed_depth: predObsLevel,
        depth_diff: signedErr,
        gt_status: gtStatus,
        pred_status: predStatus,
        status_match: statusMatch,
        evidence_synthesis: predEntry.evidence_synthesis
      };
    }

    const pkgMade = pkgValidDims > 0 ? (pkgObsAbsErr / pkgValidDims) : 0;
    const pkgSdb = pkgValidDims > 0 ? (pkgObsSignedErr / pkgValidDims) : 0;
    const pkgConcordance = pkgValidDims > 0 ? (pkgStatusMatches / pkgValidDims) * 100 : 0;

    const pkgPrec = (pkgGapTP + pkgGapFP > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFP)) * 100 : null;
    const pkgRec = (pkgGapTP + pkgGapFN > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFN)) * 100 : null;
    const pkgGapSpec = (pkgGapTN + pkgGapFP > 0) ? (pkgGapTN / (pkgGapTN + pkgGapFP)) * 100 : 100.0;
    const pkgPermSpec = (pkgPermTN + pkgPermFP > 0) ? (pkgPermTN / (pkgPermTN + pkgPermFP)) * 100 : 100.0;

    packageSummaries[pkgId] = {
      package_id: pkgId,
      reliability: rel,
      total_dimensions: 8,
      valid_dimensions: pkgValidDims,
      structural_incompletes: pkgStructInc,
      observed_depth_made: Number(pkgMade.toFixed(4)),
      observed_depth_sdb: Number(pkgSdb.toFixed(4)),
      status_concordance_pct: Number(pkgConcordance.toFixed(2)),
      actionable_gaps: {
        tp: pkgGapTP,
        fp: pkgGapFP,
        fn: pkgGapFN,
        tn: pkgGapTN,
        precision_pct: pkgPrec !== null ? Number(pkgPrec.toFixed(1)) : 'N/A',
        recall_pct: pkgRec !== null ? Number(pkgRec.toFixed(1)) : 'N/A',
        specificity_pct: Number(pkgGapSpec.toFixed(1)),
        predicted_count: predPkg.actionable_gaps ? predPkg.actionable_gaps.length : 0,
        gt_count: gtObsPkg.actionable_gaps ? gtObsPkg.actionable_gaps.length : 0
      },
      secondary_advisory_gaps: {
        count: pkgAdvisoryCount,
        items: predPkg.secondary_advisory_gaps || []
      },
      permissible_omissions: {
        tp: pkgPermTP,
        fp: pkgPermFP,
        fn: pkgPermFN,
        tn: pkgPermTN,
        specificity_pct: Number(pkgPermSpec.toFixed(1))
      },
      dimensions: dimDetails
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  Reliability: ${rel} | Valid: ${pkgValidDims}/8 | Incomplete: ${pkgStructInc}`);
    console.log(`  Observed MADE: ${pkgMade.toFixed(3)} | SDB: ${pkgSdb > 0 ? '+' : ''}${pkgSdb.toFixed(3)} | Concordance: ${pkgConcordance.toFixed(1)}% (${pkgStatusMatches}/${pkgValidDims})`);
    console.log(`  Core Gaps: TP=${pkgGapTP}, FP=${pkgGapFP}, FN=${pkgGapFN}, TN=${pkgGapTN} | Prec: ${pkgPrec !== null ? pkgPrec.toFixed(1) + '%' : 'N/A'}, Rec: ${pkgRec !== null ? pkgRec.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  Advisory: ${pkgAdvisoryCount} | Permissible Spec: ${pkgPermSpec.toFixed(1)}%`);
  }

  // Aggregate Metrics Across 32 Dimensions
  const overallMade = totalValidDimensions > 0 ? totalObsMadeSum / totalValidDimensions : 0;
  const overallSdb = totalValidDimensions > 0 ? totalObsSdbSum / totalValidDimensions : 0;
  const overallConcordance = totalValidDimensions > 0 ? (totalStatusMatches / totalValidDimensions) * 100 : 0;
  const structuralCompletenessPct = (totalValidDimensions / totalDimensions) * 100;

  const gapPrec = (gapTP + gapFP > 0) ? (gapTP / (gapTP + gapFP)) * 100 : 0.0;
  const gapRec = (gapTP + gapFN > 0) ? (gapTP / (gapTP + gapFN)) * 100 : 0.0;
  const gapSpec = (gapTN + gapFP > 0) ? (gapTN / (gapTN + gapFP)) * 100 : 100.0;
  const gapF1 = (gapPrec > 0 && gapRec > 0) ? (2 * gapPrec * gapRec) / (gapPrec + gapRec) : 0.0;

  // Permissible Specificity evaluated on non-permissible class (N = 28)
  const permSpec = (permTN + permFP > 0) ? (permTN / (permTN + permFP)) * 100 : 100.0;

  // Gate Evaluation
  const gateRecallPass = gapRec >= 80.0;
  const gatePrecisionPass = gapPrec >= 50.0;
  const gatePermSpecPass = permSpec >= 85.0;
  const allGatesPass = gateRecallPass && gatePrecisionPass && gatePermSpecPass;

  const evalSummary = {
    evaluation_timestamp: new Date().toISOString(),
    benchmark_scope: 'Milestone v3.6 Step 1B: Prospective Generalization Evaluation (pkg_11 to pkg_14)',
    lead_model: 'openai/gpt-oss-120b',
    acceptance_gates: {
      gate_1_actionable_gap_recall: {
        target: '>= 80.0%',
        target_count: '>= 6 of 7',
        achieved: `${gapRec.toFixed(2)}%`,
        achieved_count: `${gapTP}/${gapTP + gapFN}`,
        passed: gateRecallPass
      },
      gate_2_actionable_gap_precision: {
        target: '>= 50.0%',
        target_condition: 'FP <= TP',
        achieved: `${gapPrec.toFixed(2)}%`,
        achieved_counts: `TP=${gapTP}, FP=${gapFP}`,
        passed: gatePrecisionPass
      },
      gate_3_permissible_omission_specificity: {
        target: '>= 85.0%',
        target_count: '>= 24 of 28 non-permissible dims',
        achieved: `${permSpec.toFixed(2)}%`,
        achieved_counts: `TN=${permTN}, FP=${permFP} (denom=${permTN + permFP})`,
        passed: gatePermSpecPass
      },
      primary_verdict: allGatesPass ? 'PASS' : 'FAIL'
    },
    structural_reliability: {
      total_dimensions: totalDimensions,
      valid_dimensions: totalValidDimensions,
      structural_incompletes: totalStructuralIncompletes,
      structural_completeness_pct: Number(structuralCompletenessPct.toFixed(2)),
      reliability_distribution: reliabilityCounts
    },
    pedagogical_evaluation: {
      denominator_valid_dimensions: totalValidDimensions,
      observed_depth_made: Number(overallMade.toFixed(4)),
      observed_depth_sdb: Number(overallSdb.toFixed(4)),
      exact_status_concordance_pct: Number(overallConcordance.toFixed(2)),
      status_concordance_counts: `${totalStatusMatches}/${totalValidDimensions}`,
      actionable_gaps: {
        tp: gapTP,
        fp: gapFP,
        fn: gapFN,
        tn: gapTN,
        precision_pct: Number(gapPrec.toFixed(2)),
        recall_pct: Number(gapRec.toFixed(2)),
        specificity_pct: Number(gapSpec.toFixed(2)),
        f1_score_pct: Number(gapF1.toFixed(2)),
        ground_truth_total: gapTP + gapFN,
        predicted_total: gapTP + gapFP
      },
      secondary_advisory_gaps: {
        total_predicted: totalAdvisoryPredicted,
        items: advisoryGapsList
      },
      permissible_scope_omissions: {
        tp: permTP,
        fp: permFP,
        fn: permFN,
        tn: permTN,
        specificity_pct: Number(permSpec.toFixed(2)),
        ground_truth_total: permTP + permFN,
        non_permissible_denominator: permTN + permFP
      }
    },
    dimension_disagreements: dimensionDisagreements,
    packages: packageSummaries
  };

  fs.writeFileSync(evalOutputFile, JSON.stringify(evalSummary, null, 2), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log('PROSPECTIVE BENCHMARK SUMMARY REPORT');
  console.log('='.repeat(80));
  console.log(`Structural Completeness:   ${structuralCompletenessPct.toFixed(2)}% (${totalValidDimensions}/${totalDimensions} dimensions)`);
  console.log(`Exact Status Concordance:  ${overallConcordance.toFixed(2)}% (${totalStatusMatches}/${totalValidDimensions})`);
  console.log(`Observed Depth Error MADE: ${overallMade.toFixed(4)}`);
  console.log(`Observed Depth Bias SDB:   ${overallSdb > 0 ? '+' : ''}${overallSdb.toFixed(4)}`);
  console.log('-'.repeat(80));
  console.log('ACCEPTANCE GATES (Milestone v3.6 Step 1B):');
  console.log(`  Gate 1 - Actionable Gap Recall:    ${gapRec.toFixed(2)}% (${gapTP}/${gapTP + gapFN}) [Target: >=80.0%] -> ${gateRecallPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Gate 2 - Actionable Gap Precision: ${gapPrec.toFixed(2)}% (TP=${gapTP}, FP=${gapFP}) [Target: >=50.0%] -> ${gatePrecisionPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Gate 3 - Permissible Specificity:  ${permSpec.toFixed(2)}% (${permTN}/${permTN + permFP}) [Target: >=85.0%] -> ${gatePermSpecPass ? 'PASS' : 'FAIL'}`);
  console.log(`  PRIMARY ACCEPTANCE VERDICT:        ${allGatesPass ? 'ALL GATES PASSED' : 'GATE FAILURE'}`);
  console.log('='.repeat(80));
  console.log(`Results written to: ${evalOutputFile}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal execution error in Step 1B prospective runner:', err);
    process.exit(1);
  });
}

module.exports = { main };
