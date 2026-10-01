/**
 * experiments/experiment_5_teaching_adequacy/runner/p5_2b_episode_reconstructor.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Component P5.2B: Instructional Episode & Revisitation Reconstructor (RQ1B)
 *
 * PURPOSE:
 * Analyzes timestamped lecture records and reconstructed P5.2A concepts to reconstruct:
 *   1. Chronological instructional episodes with temporal boundaries (start, end)
 *   2. Dominant intellectual activities (EXPLAIN, COMPARE, DERIVE, TRACE, APPLY, JUSTIFY, LIMIT, GENERALIZE, UNCERTAIN)
 *   3. Classroom interaction modes (LECTURE_MONOLOGUE, QUESTION_ANSWER, STUDENT_RESPONSE, etc., UNCERTAIN)
 *   4. Explicit concept revisitations across non-linear teaching trajectories
 *
 * CRITICAL METHODOLOGICAL CONTROLS & INFORMATION PARTITIONING:
 *   1. P5.2B receives ONLY transcript.json and P5.2A reconstructed concepts.
 *   2. P5.2B is STRICTLY FORBIDDEN from reading declared_learning_objective, syllabus_context,
 *      P5.1 normative profiles, human normative GT, human observational GT, or generated questions.
 *   3. Strictly OBSERVATIONAL: captures chronological discourse progression and revisitations.
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

const conceptsFile = path.join(rawResultsDir, 'p5_2a_concepts.json');
const outputFile = path.join(rawResultsDir, 'p5_2b_episodes.json');

// Groq API client pool with round-robin rotation across available keys
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
const MAX_COMPLETION_TOKENS = 2200;

const SYSTEM_PROMPT = `You are an Expert Instructional Episode and Discourse Progression Reconstructor.
Analyze a timestamped lecture timeline and its reconstructed technical concepts to reconstruct the CHRONOLOGICAL INSTRUCTIONAL EPISODES and CONCEPT REVISITATIONS.

CRITICAL INSTRUCTIONS & DEFINITIONS:
1. Decouple Intellectual Activity from Interaction Mode:
   - Intellectual Activity (The Cognitive Work):
     * EXPLAIN: Conceptual definitions, background intuition, core principles.
     * COMPARE: Contrasting two or more mechanisms, precedents, theories, or trade-offs.
     * DERIVE: Step-by-step mathematical proof, logical deduction, formal statutory derivation.
     * TRACE: Chronological execution walkthrough of an algorithm, process, or legal precedent.
     * APPLY: Calculating a concrete numerical problem, worked scenario, or case application.
     * JUSTIFY: Establishing underlying theoretical rationale, constitutional purpose, or motivation.
     * LIMIT: Identifying boundary conditions, edge cases, failure modes, or statutory limitations.
     * GENERALIZE: Synthesizing abstract theorems, high-level architectures, or transferable rules.
     * UNCERTAIN: Evidence does not clearly indicate one primary activity.
   - Interaction Mode (Classroom Dynamics):
     * LECTURE_MONOLOGUE: Uninterrupted exposition by the instructor.
     * QUESTION_ANSWER: Instructor poses a rhetorical or direct query to students.
     * STUDENT_RESPONSE: Explicit student dialogue, question, or verbal feedback.
     * STUDENT_TASK: In-class student exercise, polling, or independent problem solving.
     * SOCRATIC_DISCUSSION: Collaborative dialogue leading to a conceptual conclusion.
     * LIVE_DEMONSTRATION: Real-time software terminal, laboratory apparatus, or slide walkthrough.
     * UNCERTAIN: Audio/transcript does not definitively establish the dynamic.

2. Explicit Concept Revisitation Capture:
   - Set "revisitation": true whenever an episode returns to, contrasts with, re-applies, or deepens a concept that was already introduced earlier in the lecture timeline.
   - Specify "revisitation_target" indicating which earlier concept is being revisited (or null).

3. Temporal Boundaries:
   - Cover the entire lecture timeline continuously using integer start and end seconds matching segment transitions.
   - Keep evidence_quote concise (5-10 words).

OUTPUT SCHEMA (JSON):
{
  "episodes": [
    {
      "episode_id": "E01",
      "start": 0,
      "end": 45,
      "dominant_concept": "concept name or ID",
      "intellectual_activity": "EXPLAIN"|"COMPARE"|"DERIVE"|"TRACE"|"APPLY"|"JUSTIFY"|"LIMIT"|"GENERALIZE"|"UNCERTAIN",
      "interaction_mode": "LECTURE_MONOLOGUE"|"QUESTION_ANSWER"|"STUDENT_RESPONSE"|"STUDENT_TASK"|"SOCRATIC_DISCUSSION"|"LIVE_DEMONSTRATION"|"UNCERTAIN",
      "revisitation": boolean,
      "revisitation_target": string or null,
      "evidence_quote": "short quote (5-10 words)",
      "confidence": "HIGH"|"MEDIUM"|"LOW"
    }
  ]
}`;

const VALID_ACTIVITIES = new Set([
  'EXPLAIN', 'COMPARE', 'DERIVE', 'TRACE', 'APPLY', 'JUSTIFY', 'LIMIT', 'GENERALIZE', 'UNCERTAIN'
]);

const VALID_MODES = new Set([
  'LECTURE_MONOLOGUE', 'QUESTION_ANSWER', 'STUDENT_RESPONSE', 'STUDENT_TASK', 'SOCRATIC_DISCUSSION', 'LIVE_DEMONSTRATION', 'UNCERTAIN'
]);

const VALID_CONFIDENCES = new Set(['HIGH', 'MEDIUM', 'LOW']);

function validateEpisodes(parsed, pkgId) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.episodes) || parsed.episodes.length < 2) {
    throw new Error(`Output for ${pkgId} must contain an episodes array with at least 2 episodes`);
  }

  for (let i = 0; i < parsed.episodes.length; i++) {
    const e = parsed.episodes[i];
    if (typeof e.start !== 'number' || typeof e.end !== 'number' || e.start < 0 || e.end <= e.start) {
      throw new Error(`Episode ${e.episode_id || i} in ${pkgId} has invalid temporal boundaries: [${e.start}s - ${e.end}s]`);
    }
    const actUpper = (e.intellectual_activity || '').toUpperCase();
    e.intellectual_activity = VALID_ACTIVITIES.has(actUpper) ? actUpper : 'EXPLAIN';

    const modeUpper = (e.interaction_mode || '').toUpperCase();
    e.interaction_mode = VALID_MODES.has(modeUpper) ? modeUpper : 'LECTURE_MONOLOGUE';

    e.revisitation = Boolean(e.revisitation);
    e.revisitation_target = e.revisitation ? (e.revisitation_target || 'Earlier Topic') : null;
    e.evidence_quote = typeof e.evidence_quote === 'string' ? e.evidence_quote : 'Transcript evidence';

    const confUpper = (e.confidence || '').toUpperCase();
    e.confidence = VALID_CONFIDENCES.has(confUpper) ? confUpper : 'HIGH';
  }
}

async function reconstructEpisodesForPackage(pkgDirName, pkgConcepts, maxRetries = 10) {
  const transcriptPath = path.join(corpusDir, pkgDirName, 'transcript.json');
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Missing transcript for ${pkgDirName}`);
  }

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
      const waitMs = Math.min(6000 + (attempt * 2000), 25000);
      console.warn(`[P5.2B] Attempt ${attempt} for ${pkgDirName} encountered: ${err.message.slice(0, 100)}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      if (attempt > maxRetries) {
        throw new Error(`Failed to reconstruct episodes for ${pkgDirName} after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('PHASE 5: COMPONENT P5.2B — EPISODE & REVISITATION RECONSTRUCTOR (RQ1B)');
  console.log('='.repeat(70));
  console.log(`Corpus Directory: ${corpusDir}`);
  console.log(`Concepts File:    ${conceptsFile}`);
  console.log(`Target Model:     ${MODEL_NAME}`);
  console.log(`Temperature:      ${TEMPERATURE}`);
  console.log(`Output File:      ${outputFile}`);
  console.log('-'.repeat(70));

  if (!fs.existsSync(conceptsFile)) {
    throw new Error(`P5.2A concepts file not found: ${conceptsFile}`);
  }

  const conceptsData = JSON.parse(fs.readFileSync(conceptsFile, 'utf8'));

  const pkgDirs = fs.readdirSync(corpusDir).filter(f => {
    return fs.statSync(path.join(corpusDir, f)).isDirectory() && f.startsWith('pkg_');
  }).sort();

  console.log(`Found ${pkgDirs.length} packages to reconstruct episodes for: ${pkgDirs.join(', ')}`);

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
    if (results.packages[pkgDir] && results.packages[pkgDir].episodes && results.packages[pkgDir].episodes.length >= 2) {
      console.log(`\nPackage ${pkgDir} already completed on disk (${results.packages[pkgDir].episode_count} episodes). Skipping.`);
      continue;
    }

    const pkgConcepts = conceptsData.packages[pkgDir] ? conceptsData.packages[pkgDir].concepts : [];
    console.log(`\nReconstructing episodes for: ${pkgDir} (using ${pkgConcepts.length} P5.2A concepts)...`);
    const epMap = await reconstructEpisodesForPackage(pkgDir, pkgConcepts);
    results.packages[pkgDir] = {
      package_id: pkgDir,
      episode_count: epMap.episode_count,
      episodes: epMap.episodes,
      execution_stats: epMap.execution_stats
    };
    console.log(`  ✓ Reconstructed ${epMap.episode_count} episodes for ${pkgDir} (${epMap.execution_stats.latency_ms} ms)`);

    // Incrementally save to disk after every package
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\n' + '='.repeat(70));
  console.log(`P5.2B RUN COMPLETE: All reconstructed episode maps written to ${outputFile}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal execution error in P5.2B runner:', err);
    process.exit(1);
  });
}

module.exports = {
  run,
  reconstructEpisodesForPackage,
  SYSTEM_PROMPT,
  validateEpisodes
};
