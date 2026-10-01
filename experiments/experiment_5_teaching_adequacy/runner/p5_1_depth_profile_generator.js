/**
 * experiments/experiment_5_teaching_adequacy/runner/p5_1_depth_profile_generator.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Component P5.1: Normative Depth Profile Generator (RQ2)
 *
 * PURPOSE:
 * Given a lecture topic, declared learning objective, syllabus context, and learner level,
 * constructs the normative expected depth profile across the 8 Universal Epistemic Dimensions.
 *
 * CRITICAL METHODOLOGICAL CONTROLS & INFORMATION PARTITIONING:
 *   1. P5.1 receives ONLY metadata.json (topic, declared_learning_objective, syllabus_context, learner_level).
 *   2. P5.1 is STRICTLY FORBIDDEN from reading transcripts, audio, video, supporting materials,
 *      observational ground truth, or human normative ground truth.
 *   3. Evaluates 8 epistemic dimensions independently with operational depth anchors (Levels 0-8).
 *   4. Zero hardcoded domain rules; prompt operates strictly via universal pedagogical principles.
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

const outputFile = path.join(rawResultsDir, 'p5_1_profiles.json');

// Groq API client pool with round-robin rotation across available keys
const apiKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_BACKUP,
  process.env.GROQ_API_KEY_3,
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
const MAX_COMPLETION_TOKENS = 2500;

const SYSTEM_PROMPT = `You are a Senior Curricular Architect and Normative Pedagogical Evaluator.
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

const EXPECTED_DIMENSION_KEYS = [
  'IDENTIFICATION',
  'MEANING',
  'STRUCTURE_COMPONENTS',
  'RELATIONSHIPS_MECHANISM',
  'JUSTIFICATION_WHY',
  'APPLICATION_INTERPRETATION',
  'BOUNDARIES_EXCEPTIONS',
  'TRANSFER_SYNTHESIS'
];

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

  for (const dim of EXPECTED_DIMENSION_KEYS) {
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

async function generateProfileForPackage(pkgDirName, maxRetries = 5) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Metadata not found for ${pkgDirName} at ${metadataPath}`);
  }

  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  // Strict information partitioning: extract ONLY curriculum context
  const userPrompt = `CURRICULUM CONTEXT:
Topic: ${meta.topic}
Learner Level: ${meta.learner_level}
Syllabus Context: ${meta.syllabus_context}
Declared Learning Objective: ${meta.declared_learning_objective}

Construct the normative expected depth profile across all 8 dimensions in JSON.`;

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

      validateGeneratedProfile(parsed, pkgDirName);

      return {
        package_id: pkgDirName,
        topic: parsed.topic || meta.topic,
        declared_objective: parsed.declared_objective || meta.declared_learning_objective,
        expected_dimensions: parsed.expected_dimensions,
        metadata_source: {
          topic: meta.topic,
          learner_level: meta.learner_level,
          syllabus_context: meta.syllabus_context,
          declared_learning_objective: meta.declared_learning_objective
        },
        execution_stats: {
          latency_ms: latencyMs,
          model: MODEL_NAME,
          temperature: TEMPERATURE,
          retries: attempt
        }
      };
    } catch (err) {
      attempt++;
      console.warn(`[P5.1] Attempt ${attempt} failed for ${pkgDirName}: ${err.message}. Retrying...`);
      rotateKey();
      if (attempt > maxRetries) {
        throw new Error(`Failed to generate profile for ${pkgDirName} after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('PHASE 5: COMPONENT P5.1 — NORMATIVE DEPTH PROFILE GENERATOR (RQ2)');
  console.log('='.repeat(70));
  console.log(`Corpus Directory: ${corpusDir}`);
  console.log(`Target Model:     ${MODEL_NAME}`);
  console.log(`Temperature:      ${TEMPERATURE}`);
  console.log(`Output File:      ${outputFile}`);
  console.log('-'.repeat(70));

  const pkgDirs = fs.readdirSync(corpusDir).filter(f => {
    return fs.statSync(path.join(corpusDir, f)).isDirectory() && f.startsWith('pkg_');
  }).sort();

  console.log(`Found ${pkgDirs.length} packages to evaluate: ${pkgDirs.join(', ')}`);

  const results = {
    generation_timestamp: new Date().toISOString(),
    lead_model: MODEL_NAME,
    temperature: TEMPERATURE,
    packages: {}
  };

  for (const pkgDir of pkgDirs) {
    console.log(`\nGenerating normative depth profile for: ${pkgDir}...`);
    const profile = await generateProfileForPackage(pkgDir);
    results.packages[pkgDir] = {
      topic: profile.topic,
      declared_objective: profile.declared_objective,
      expected_dimensions: profile.expected_dimensions,
      execution_stats: profile.execution_stats
    };
    console.log(`  ✓ Successfully generated and validated ${pkgDir} (${profile.execution_stats.latency_ms} ms)`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\n' + '='.repeat(70));
  console.log(`P5.1 RUN COMPLETE: All profiles written to ${outputFile}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal execution error in P5.1 runner:', err);
    process.exit(1);
  });
}

module.exports = {
  run,
  generateProfileForPackage,
  SYSTEM_PROMPT,
  EXPECTED_DIMENSION_KEYS
};
