/**
 * experiments/experiment_5_teaching_adequacy/runner/run_step2a_diagnostic_pipeline.js
 *
 * Milestone v3.6 Step 2A Phase 4: Diagnostic Pipeline Runner
 *
 * Executes the complete frozen Phase 5 pipeline across the 4 dedicated Option B
 * development packages (dev_2a_01 through dev_2a_04) focusing on Diagnostic Segments A & B.
 *
 * Configuration & Invariants:
 *   - Model: openai/gpt-oss-120b on Groq
 *   - Temperature: 0.0
 *   - P5.1 max_tokens: 3500
 *   - P5.2A max_tokens: 4500
 *   - P5.2B max_tokens: 4500
 *   - P5.3 max_tokens: 4500
 *   - P5.3 analyzer imported from p5_3_coverage_gap_analyzer.js (frozen hash: 0884d2923fc5581a...)
 *   - Strict structural incomplete isolation: Incomplete keys -> STRUCTURAL_OUTPUT_INCOMPLETE (depth: null)
 *   - ZERO tuning or prompt modification during runs.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const dev2aDir = path.join(exp5Dir, 'dev_2a');
const outputDir = path.join(dev2aDir, 'diagnostic_runs');
fs.mkdirSync(outputDir, { recursive: true });

// Frozen P5.3 imports
const {
  SYSTEM_PROMPT: P53_SYSTEM_PROMPT,
  validateAndCompleteDiagnosticMatrix,
  EXPECTED_DIMENSIONS
} = require('./p5_3_coverage_gap_analyzer');

const TARGET_PACKAGES = [
  'dev_2a_01_logic_predicates',
  'dev_2a_02_pharmacology_clearance',
  'dev_2a_03_clinical_dosing',
  'dev_2a_04_signal_processing_fourier'
];

// 6-key pool with active rotation
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
  return new Groq({ apiKey: currentKey });
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % apiKeys.length;
}

const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;

const p51OutputFile = path.join(outputDir, 'p5_1_profiles_dev2a_diagnostic.json');
const p52aOutputFile = path.join(outputDir, 'p5_2a_concepts_dev2a_diagnostic.json');
const p52bOutputFile = path.join(outputDir, 'p5_2b_episodes_dev2a_diagnostic.json');
const p53OutputFile = path.join(outputDir, 'p5_3_diagnostic_matrix_dev2a.json');
const evidenceOutputFile = path.join(outputDir, 'diagnostic_evidence_table.json');

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
// P5.1 DEFINITION
// ============================================================================
const P51_SYSTEM_PROMPT = `You are a Senior Curricular Architect and Normative Pedagogical Evaluator.
Given a lecture topic, declared learning objective, syllabus context, and learner level, your task is to construct the NORMATIVE EXPECTED DEPTH PROFILE for the lecture.
You determine what SHOULD be taught in this session to adequately satisfy the declared objective within the given syllabus context.

You must evaluate across EIGHT UNIVERSAL EPISTEMIC DIMENSIONS:
1. IDENTIFICATION: Naming, terminology, formal recognition, core symbols.
2. MEANING: Conceptual definition, qualitative intuition, primary assertions, significance.
3. STRUCTURE_COMPONENTS: Internal constituent elements, syntax, parameters, clauses, structural architecture.
4. RELATIONSHIPS_MECHANISM: Dynamic interaction between components, operational flow, execution steps, inter-clause relationships, causal dynamics.
5. JUSTIFICATION_WHY: Underlying theoretical rationale, formal mathematical derivation/proof, constitutional/philosophical purpose, why the principle holds against alternatives.
6. APPLICATION_INTERPRETATION: Concrete problem-solving, worked numerical/code execution trace, judicial case-precedent analysis, practical instantiation.
7. BOUNDARIES_EXCEPTIONS: Boundary evaluation, edge cases, failure modes, invariant breakdowns, constitutional/statutory limitations, non-applicability conditions.
8. TRANSFER_SYNTHESIS: Cross-domain transfer, novel constraint adaptation, synthesis with disparate frameworks, counterfactual reasoning.

OPERATIONAL DEPTH ANCHORS (Level 0 to 8):
- Level 0: No Observable Evidence
- Level 1: Nominal Recognition / Mention
- Level 2: Surface Description / Core Definition
- Level 3: Univariate Mechanism / Structured Elaboration
- Level 4: Systemic Interaction / Dynamic Operational Flow
- Level 5: Formal Derivation / Foundational Justification
- Level 6: Concrete Application / Worked Interpretation
- Level 7: Boundary Evaluation / Failure-Mode Analysis
- Level 8: Cross-Domain Synthesis / Generalization

ALIGNMENT TIERS:
- REQUIRED: Essential core dimension for the declared objective and syllabus context.
- RECOMMENDED: Desirable enrichment dimension.
- OPTIONAL: Supplementary depth.
- PERMISSIBLE_SCOPE_OMISSION: Explicitly outside declared objective/syllabus level.

OUTPUT FORMAT (JSON strictly):
{
  "topic": "...",
  "declared_objective": "...",
  "expected_dimensions": {
    "IDENTIFICATION": { "level": 0-8, "alignment": "REQUIRED"|"RECOMMENDED"|"OPTIONAL"|"PERMISSIBLE_SCOPE_OMISSION", "rationale": "...", "confidence": "HIGH"|"MEDIUM"|"LOW" },
    "MEANING": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "STRUCTURE_COMPONENTS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "RELATIONSHIPS_MECHANISM": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "JUSTIFICATION_WHY": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "APPLICATION_INTERPRETATION": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "BOUNDARIES_EXCEPTIONS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." },
    "TRANSFER_SYNTHESIS": { "level": 0-8, "alignment": "...", "rationale": "...", "confidence": "..." }
  }
}`;

async function runP51(pkgDirName, maxRetries = 20) {
  const metadataPath = path.join(dev2aDir, pkgDirName, 'metadata.json');
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
      const waitMs = Math.min(3000 + (attempt * 2000), 20000);
      console.warn(`[P5.1] Attempt ${attempt} for ${pkgDirName}: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// P5.2A DEFINITION
// ============================================================================
const P52A_SYSTEM_PROMPT = `You are an Expert Instructional Concept Reconstructor and Knowledge Cartographer.
Your task is to analyze the provided lecture transcript and reconstruct the hierarchical concept map of technical topics and sub-topics ACTUALLY TAUGHT during the lecture.

CONCEPT-UNIT GRANULARITY POLICY:
- Target approximately 6 to 10 distinct technical concepts for the session.
- Identify distinct technical principles, theorems, precedents, formulas, mechanisms, structural components, or boundary conditions.
- Every concept must be grounded in explicit transcript evidence.
- Map ONLY what was actually communicated in the transcript.

OUTPUT SCHEMA (JSON):
{
  "root_concept": "string",
  "concepts": [
    {
      "concept_id": "C01",
      "name": "string",
      "parent_id": "root",
      "epistemic_dimension": "IDENTIFICATION"|"MEANING"|"STRUCTURE_COMPONENTS"|"RELATIONSHIPS_MECHANISM"|"JUSTIFICATION_WHY"|"APPLICATION_INTERPRETATION"|"BOUNDARIES_EXCEPTIONS"|"TRANSFER_SYNTHESIS",
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

async function runP52A(pkgDirName, maxRetries = 20) {
  const metadataPath = path.join(dev2aDir, pkgDirName, 'metadata.json');
  const transcriptPath = path.join(dev2aDir, pkgDirName, 'transcript.json');
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
      const waitMs = Math.min(3000 + (attempt * 2000), 20000);
      console.warn(`[P5.2A] Attempt ${attempt} for ${pkgDirName}: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// P5.2B DEFINITION
// ============================================================================
const P52B_SYSTEM_PROMPT = `You are an Expert Instructional Episode and Discourse Progression Reconstructor.
Analyze a timestamped lecture timeline and its reconstructed technical concepts to reconstruct the CHRONOLOGICAL INSTRUCTIONAL EPISODES and CONCEPT REVISITATIONS.

CRITICAL INSTRUCTIONS:
1. Intellectual Activity: EXPLAIN, COMPARE, DERIVE, TRACE, APPLY, JUSTIFY, LIMIT, GENERALIZE, UNCERTAIN.
2. Interaction Mode: LECTURE_MONOLOGUE, QUESTION_ANSWER, STUDENT_RESPONSE, STUDENT_TASK, SOCRATIC_DISCUSSION, LIVE_DEMONSTRATION, UNCERTAIN.
3. Set revisitation: true whenever an episode returns to or deepens a concept introduced earlier.

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

async function runP52B(pkgDirName, pkgConcepts, maxRetries = 20) {
  const transcriptPath = path.join(dev2aDir, pkgDirName, 'transcript.json');
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const conceptListFormatted = pkgConcepts.map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension})`).join('\n');
  const segmentsFormatted = transcript.segments.map(s => `[${s.start}s - ${s.end}s]: ${s.text || s.summary || ''}`).join('\n\n');

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
      const waitMs = Math.min(3000 + (attempt * 2000), 20000);
      console.warn(`[P5.2B] Attempt ${attempt} for ${pkgDirName}: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// P5.3 DIAGNOSTIC ANALYZER (FROZEN RULES & PROMPTS)
// ============================================================================
async function runP53Diagnostic(pkgDirName, p51Pkg, p52aPkg, p52bPkg, maxRetries = 20) {
  const metadataPath = path.join(dev2aDir, pkgDirName, 'metadata.json');
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
          { role: 'system', content: P53_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: 4500,
        response_format: { type: 'json_object' }
      });
      const latencyMs = Date.now() - startTime;
      rotateKey();

      const rawContent = res.choices[0].message.content;
      const parsed = JSON.parse(rawContent);

      // Check missing keys & targeted repair
      const missingKeys = EXPECTED_DIMENSIONS.filter(d => !parsed.diagnostic_matrix || !parsed.diagnostic_matrix[d]);
      let reliability = 'valid_first_response';

      if (missingKeys.length > 0) {
        console.warn(`[P5.3] ${pkgDirName} initial response omitted ${missingKeys.length} keys: ${missingKeys.join(', ')}. Triggering repair...`);
        const repairPrompt = `Your previous diagnostic response omitted the following ${missingKeys.length} required dimensions:
${missingKeys.join(', ')}

Please provide the diagnostic coverage matrix entries strictly for these missing dimensions, formatted in JSON matching the schema:
{
  "diagnostic_matrix": {
    ${missingKeys.map(k => `"${k}": { "observed_depth": number, "evidence_synthesis": string, "confidence": "HIGH" }`).join(',\n    ')}
  }
}`;
        try {
          const repairClient = getGroqClient();
          const repairRes = await repairClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [
              { role: 'system', content: P53_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
              { role: 'assistant', content: rawContent },
              { role: 'user', content: repairPrompt }
            ],
            temperature: TEMPERATURE,
            max_tokens: 1500,
            response_format: { type: 'json_object' }
          });
          rotateKey();
          const repairParsed = JSON.parse(repairRes.choices[0].message.content);
          if (repairParsed.diagnostic_matrix) {
            for (const mk of missingKeys) {
              if (repairParsed.diagnostic_matrix[mk]) {
                parsed.diagnostic_matrix[mk] = repairParsed.diagnostic_matrix[mk];
              }
            }
          }
          const stillMissing = EXPECTED_DIMENSIONS.filter(d => !parsed.diagnostic_matrix || !parsed.diagnostic_matrix[d]);
          reliability = stillMissing.length === 0 ? 'valid_after_retry' : 'incomplete_after_retry';
        } catch (repairErr) {
          rotateKey();
          reliability = 'incomplete_after_retry';
        }
      }

      validateAndCompleteDiagnosticMatrix(parsed, p51Pkg, pkgDirName);

      return {
        package_id: pkgDirName,
        topic: meta.topic,
        observability_assessment: {
          audio_clarity: meta.recording_quality.audio_clarity,
          transcript_completeness: meta.recording_quality.transcript_completeness,
          known_limitations: meta.recording_quality.known_observability_limitations
        },
        diagnostic_matrix: parsed.diagnostic_matrix,
        actionable_gaps: parsed.actionable_gaps,
        secondary_advisory_gaps: parsed.secondary_advisory_gaps,
        permissible_omissions: parsed.permissible_omissions,
        structural_incompletes: parsed.structural_incompletes,
        summary_diagnosis: parsed.summary_diagnosis,
        execution_stats: {
          latency_ms: latencyMs,
          model: MODEL_NAME,
          temperature: TEMPERATURE,
          retries: attempt,
          response_reliability: reliability
        }
      };
    } catch (err) {
      attempt++;
      rotateKey();
      const waitMs = Math.min(3000 + (attempt * 2000), 20000);
      console.warn(`[P5.3] Attempt ${attempt} for ${pkgDirName}: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) throw err;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================================
// MAIN CONTROLLER & EVIDENCE COMPILER
// ============================================================================
async function main() {
  console.log('='.repeat(80));
  console.log('MILESTONE v3.6 STEP 2A PHASE 4: DIAGNOSTIC PIPELINE RUNNER');
  console.log('Packages: dev_2a_01 through dev_2a_04 (Option B Diagnostic Set)');
  console.log('Configuration: openai/gpt-oss-120b, temp=0.0, max_tokens=4500');
  console.log('Mode: Diagnostic Inspection (NO Prompt or Threshold Tuning)');
  console.log('='.repeat(80));

  // Stage 1: P5.1
  console.log('\n[STAGE 1/4] Running P5.1 Normative Expected Depth...');
  let p51Results = loadOrCreate(p51OutputFile, { component: 'P5.1 Normative Expected Depth (dev_2a)' });
  for (const pkgId of TARGET_PACKAGES) {
    if (p51Results.packages[pkgId]) {
      console.log(`  - ${pkgId}: cached`);
      continue;
    }
    console.log(`  - Generating P5.1 for ${pkgId}...`);
    p51Results.packages[pkgId] = await runP51(pkgId);
    fs.writeFileSync(p51OutputFile, JSON.stringify(p51Results, null, 2), 'utf8');
    console.log(`    ✓ Done (${p51Results.packages[pkgId].execution_stats.latency_ms} ms)`);
  }

  // Stage 2: P5.2A
  console.log('\n[STAGE 2/4] Running P5.2A Concept Reconstruction...');
  let p52aResults = loadOrCreate(p52aOutputFile, { component: 'P5.2A Observational Concepts (dev_2a)' });
  for (const pkgId of TARGET_PACKAGES) {
    if (p52aResults.packages[pkgId]) {
      console.log(`  - ${pkgId}: cached`);
      continue;
    }
    console.log(`  - Reconstructing P5.2A concepts for ${pkgId}...`);
    p52aResults.packages[pkgId] = await runP52A(pkgId);
    fs.writeFileSync(p52aOutputFile, JSON.stringify(p52aResults, null, 2), 'utf8');
    console.log(`    ✓ Done (${p52aResults.packages[pkgId].concept_count} concepts)`);
  }

  // Stage 3: P5.2B
  console.log('\n[STAGE 3/4] Running P5.2B Instructional Episodes...');
  let p52bResults = loadOrCreate(p52bOutputFile, { component: 'P5.2B Instructional Episodes (dev_2a)' });
  for (const pkgId of TARGET_PACKAGES) {
    if (p52bResults.packages[pkgId]) {
      console.log(`  - ${pkgId}: cached`);
      continue;
    }
    console.log(`  - Reconstructing P5.2B episodes for ${pkgId}...`);
    const pkgConcepts = p52aResults.packages[pkgId].concepts;
    p52bResults.packages[pkgId] = await runP52B(pkgId, pkgConcepts);
    fs.writeFileSync(p52bOutputFile, JSON.stringify(p52bResults, null, 2), 'utf8');
    console.log(`    ✓ Done (${p52bResults.packages[pkgId].episode_count} episodes)`);
  }

  // Stage 4: P5.3
  console.log('\n[STAGE 4/4] Running P5.3 Diagnostic Coverage Analyzer (Frozen)...');
  let p53Results = loadOrCreate(p53OutputFile, { component: 'P5.3 Diagnostic Coverage Matrix (dev_2a)' });
  for (const pkgId of TARGET_PACKAGES) {
    if (p53Results.packages[pkgId]) {
      console.log(`  - ${pkgId}: cached`);
      continue;
    }
    console.log(`  - Diagnosing coverage for ${pkgId}...`);
    const p51Pkg = p51Results.packages[pkgId];
    const p52aPkg = p52aResults.packages[pkgId];
    const p52bPkg = p52bResults.packages[pkgId];
    p53Results.packages[pkgId] = await runP53Diagnostic(pkgId, p51Pkg, p52aPkg, p52bPkg);
    fs.writeFileSync(p53OutputFile, JSON.stringify(p53Results, null, 2), 'utf8');
    console.log(`    ✓ Done (${p53Results.packages[pkgId].execution_stats.response_reliability})`);
  }

  // Stage 5: Compile Evidence Table against Phase 3 Reference
  console.log('\n[STAGE 5] Compiling Diagnostic Evidence Table against Phase 3 Reference...');
  const refPath = path.join(dev2aDir, 'diagnostic_adjudication_summary.json');
  const refData = JSON.parse(fs.readFileSync(refPath, 'utf8'));

  const evidenceTable = [];
  const targetMap = {
    'dev_2a_01_logic_predicates': {
      pattern: 'Pattern 1: Meaning vs. Static Notation',
      target_dim: 'MEANING',
      segments: ['segment_1A_syntactic_duality', 'segment_1B_domain_semantics']
    },
    'dev_2a_02_pharmacology_clearance': {
      pattern: 'Pattern 2: Math Identity vs. Empirical Mechanism',
      target_dim: 'CORE_CONCEPTS',
      secondary_dim: 'JUSTIFICATION_WHY',
      segments: ['segment_2A_algebraic_elimination', 'segment_2B_organ_extraction_mechanism']
    },
    'dev_2a_03_clinical_dosing': {
      pattern: 'Pattern 3: Worked Application vs. Verbal Walkthrough',
      target_dim: 'WORKED_APPLICATION',
      alt_dim: 'APPLICATION_INTERPRETATION',
      segments: ['segment_3A_conversational_gentamicin_walkthrough', 'segment_3B_stepwise_gentamicin_execution_trace']
    },
    'dev_2a_04_signal_processing_fourier': {
      pattern: 'Pattern 4: Structural Primitives vs. Parameter Listing',
      target_dim: 'STRUCTURE_COMPONENTS',
      segments: ['segment_4A_dft_parameter_roster', 'segment_4B_dft_structural_primitives']
    }
  };

  for (const pkgId of TARGET_PACKAGES) {
    const info = targetMap[pkgId];
    const p53Matrix = p53Results.packages[pkgId].diagnostic_matrix;
    const p52aConcepts = p52aResults.packages[pkgId].concepts;
    const p52bEpisodes = p52bResults.packages[pkgId].episodes;

    const dimKey = p53Matrix[info.target_dim] ? info.target_dim : (info.alt_dim && p53Matrix[info.alt_dim] ? info.alt_dim : info.target_dim);
    const analyzerDim = p53Matrix[dimKey] || {};

    for (const segId of info.segments) {
      const refEntry = refData.adjudicated_consensus_diagnostic_profile.find(
        r => r.package_id === pkgId && r.segment_id === segId
      ) || {};

      // Find extracted concepts touching this segment or topic
      const relatedConcepts = p52aConcepts.filter(c =>
        c.name.toLowerCase().includes(segId.split('_')[2] || '') ||
        c.observed_summary.toLowerCase().includes(segId.split('_')[2] || '')
      ).map(c => `[${c.concept_id}] ${c.name} (${c.epistemic_dimension})`);

      evidenceTable.push({
        package_id: pkgId,
        segment_id: segId,
        pattern: info.pattern,
        epistemic_dimension: dimKey,
        human_reference: {
          adjudicated_depth: refEntry.adjudicated_depth,
          verdict: refEntry.consensus_verdict
        },
        analyzer_result: {
          evaluated_dimension: dimKey,
          expected_depth: analyzerDim.expected_depth,
          observed_depth: analyzerDim.observed_depth,
          status: analyzerDim.status,
          evidence_synthesis: analyzerDim.evidence_synthesis,
          confidence: analyzerDim.confidence
        },
        upstream_extraction: {
          total_concepts_extracted: p52aConcepts.length,
          total_episodes_extracted: p52bEpisodes.length,
          related_concepts: relatedConcepts
        }
      });
    }
  }

  const finalReport = {
    timestamp: new Date().toISOString(),
    milestone: 'Milestone v3.6 Step 2A Phase 4: Diagnostic Evidence Summary',
    analyzer_configuration: {
      model: MODEL_NAME,
      temperature: TEMPERATURE,
      max_tokens: 4500,
      system_prompt_source: 'p5_3_coverage_gap_analyzer.js (frozen)',
      structural_incomplete_handling: 'Isolate observed_depth: null from pedagogical gaps'
    },
    evidence_table: evidenceTable
  };

  fs.writeFileSync(evidenceOutputFile, JSON.stringify(finalReport, null, 2), 'utf8');
  console.log(`\n✓ Diagnostic evidence table written to: ${evidenceOutputFile}`);
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
