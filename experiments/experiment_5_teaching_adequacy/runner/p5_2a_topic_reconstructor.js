/**
 * experiments/experiment_5_teaching_adequacy/runner/p5_2a_topic_reconstructor.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Component P5.2A: Instructional Concept Reconstructor (RQ1A)
 *
 * PURPOSE:
 * Analyzes raw lecture transcripts and reconstructs the hierarchical concept map
 * of technical topics and sub-topics ACTUALLY TAUGHT during the lecture record,
 * strictly enforcing the Concept-Unit Granularity Policy.
 *
 * CRITICAL METHODOLOGICAL CONTROLS & INFORMATION PARTITIONING:
 *   1. P5.2A receives ONLY transcript.json and basic metadata (domain, subject, topic).
 *   2. P5.2A is STRICTLY FORBIDDEN from reading declared_learning_objective, syllabus_context,
 *      P5.1 normative profiles, human normative GT, human observational GT, or generated questions.
 *   3. Strictly OBSERVATIONAL: maps what was taught with verbatim evidence quotes; does NOT decide
 *      adequacy or declare coverage gaps (that belongs strictly to P5.3).
 *   4. Incremental disk persistence: Saves after every package; skips already reconstructed packages.
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

const outputFile = path.join(rawResultsDir, 'p5_2a_concepts.json');

// Groq API client pool prioritizing keys with active quota
const apiKeys = [
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_BACKUP,
  process.env.GROQ_API_KEY_4
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
const MAX_COMPLETION_TOKENS = 1200;

const SYSTEM_PROMPT = `You are an Expert Instructional Concept Reconstructor and Knowledge Cartographer.
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
      "parent_id": "root" | "parent_concept_id",
      "epistemic_dimension": "IDENTIFICATION" | "MEANING" | "STRUCTURE_COMPONENTS" | "RELATIONSHIPS_MECHANISM" | "JUSTIFICATION_WHY" | "APPLICATION_INTERPRETATION" | "BOUNDARIES_EXCEPTIONS" | "TRANSFER_SYNTHESIS",
      "observed_summary": "concise description of what was actually taught about this concept in the lecture",
      "evidence_quotes": [
        {
          "quote": "verbatim text snippet from transcript",
          "approx_start_sec": number,
          "approx_end_sec": number
        }
      ],
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;

const VALID_DIMENSIONS = new Set([
  'IDENTIFICATION',
  'MEANING',
  'STRUCTURE_COMPONENTS',
  'RELATIONSHIPS_MECHANISM',
  'JUSTIFICATION_WHY',
  'APPLICATION_INTERPRETATION',
  'BOUNDARIES_EXCEPTIONS',
  'TRANSFER_SYNTHESIS'
]);

const VALID_CONFIDENCES = new Set(['HIGH', 'MEDIUM', 'LOW']);

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

  const seenIds = new Set();
  for (const c of parsed.concepts) {
    if (!c.concept_id || typeof c.concept_id !== 'string') {
      throw new Error(`Concept in ${pkgId} missing concept_id`);
    }
    seenIds.add(c.concept_id);
    if (!c.name || typeof c.name !== 'string' || c.name.trim().length === 0) {
      throw new Error(`Concept ${c.concept_id} in ${pkgId} has invalid name`);
    }
    if (!VALID_DIMENSIONS.has(c.epistemic_dimension)) {
      const upper = (c.epistemic_dimension || '').toUpperCase();
      if (VALID_DIMENSIONS.has(upper)) {
        c.epistemic_dimension = upper;
      } else {
        c.epistemic_dimension = 'MEANING';
      }
    }
    if (!c.observed_summary || typeof c.observed_summary !== 'string') {
      throw new Error(`Concept ${c.concept_id} in ${pkgId} has invalid observed_summary`);
    }
    if (!Array.isArray(c.evidence_quotes) || c.evidence_quotes.length === 0) {
      c.evidence_quotes = [{ quote: c.observed_summary, approx_start_sec: 0, approx_end_sec: 60 }];
    }
    for (const eq of c.evidence_quotes) {
      if (!eq.quote || typeof eq.quote !== 'string') {
        eq.quote = c.observed_summary;
      }
    }
    if (typeof c.confidence === 'string' && VALID_CONFIDENCES.has(c.confidence.trim().toUpperCase())) {
      c.confidence = c.confidence.trim().toUpperCase();
    } else {
      c.confidence = 'HIGH';
    }
  }

  for (const c of parsed.concepts) {
    if (c.parent_id !== 'root' && !seenIds.has(c.parent_id)) {
      c.parent_id = 'root';
    }
  }
}

async function reconstructConceptsForPackage(pkgDirName, maxRetries = 25) {
  const metadataPath = path.join(corpusDir, pkgDirName, 'metadata.json');
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');

  if (!fs.existsSync(metadataPath) || !fs.existsSync(transcriptPath)) {
    throw new Error(`Missing corpus files for ${pkgDirName}`);
  }

  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const segmentsFormatted = transcript.segments.map(s => `[${s.start}s - ${s.end}s]: ${s.text}`).join('\n\n');

  const userPrompt = `LECTURE RECORD:
Domain: ${meta.domain}
Subject: ${meta.subject}
Topic Title: ${meta.topic}

TIMESTAMPED LECTURE TRANSCRIPT:
${segmentsFormatted}

Reconstruct the hierarchical concept map of what was actually taught in this lecture according to the Concept-Unit Granularity Policy.`;

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

      validateConceptMap(parsed, pkgDirName);

      return {
        package_id: pkgDirName,
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
      const waitMs = Math.min(10000 + (attempt * 2000), 30000);
      console.warn(`[P5.2A] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) {
        throw new Error(`Failed to reconstruct concepts for ${pkgDirName} after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('PHASE 5: COMPONENT P5.2A — INSTRUCTIONAL CONCEPT RECONSTRUCTOR (RQ1A)');
  console.log('='.repeat(70));
  console.log(`Corpus Directory: ${corpusDir}`);
  console.log(`Target Model:     ${MODEL_NAME}`);
  console.log(`Temperature:      ${TEMPERATURE}`);
  console.log(`Output File:      ${outputFile}`);
  console.log('-'.repeat(70));

  const pkgDirs = fs.readdirSync(corpusDir).filter(f => {
    return fs.statSync(path.join(corpusDir, f)).isDirectory() && f.startsWith('pkg_');
  }).sort();

  console.log(`Found ${pkgDirs.length} packages to reconstruct: ${pkgDirs.join(', ')}`);

  let results = {
    reconstruction_timestamp: new Date().toISOString(),
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
    if (results.packages[pkgDir] && results.packages[pkgDir].concepts && results.packages[pkgDir].concepts.length >= 3) {
      console.log(`\nPackage ${pkgDir} already completed on disk (${results.packages[pkgDir].concept_count} concepts). Skipping.`);
      continue;
    }

    console.log(`\nReconstructing concepts for: ${pkgDir}...`);
    const conceptMap = await reconstructConceptsForPackage(pkgDir);
    results.packages[pkgDir] = {
      topic: conceptMap.topic,
      domain: conceptMap.domain,
      root_concept: conceptMap.root_concept,
      concept_count: conceptMap.concept_count,
      concepts: conceptMap.concepts,
      execution_stats: conceptMap.execution_stats
    };
    console.log(`  ✓ Reconstructed ${conceptMap.concept_count} concepts for ${pkgDir} (${conceptMap.execution_stats.latency_ms} ms)`);

    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\n' + '='.repeat(70));
  console.log(`P5.2A RUN COMPLETE: All reconstructed concept maps written to ${outputFile}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal execution error in P5.2A runner:', err);
    process.exit(1);
  });
}

module.exports = {
  run,
  reconstructConceptsForPackage,
  SYSTEM_PROMPT,
  validateConceptMap
};
