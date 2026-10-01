/**
 * experiments/experiment_5_teaching_adequacy/runner/p5_4_assessment_demand_specifier.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Component P5.4: Assessment Demand & Misconception Distractor Specifier (RQ4)
 *
 * PURPOSE:
 * Translates frozen Normative Profiles (P5.1) and Diagnostic Coverage Findings (P5.3)
 * into calibrated assessment blueprints across 3 cognitive demand tiers:
 *   - EASY: Direct definition recall / property lookup (1 reasoning step, low complexity, zero transfer).
 *   - MEDIUM: Multi-step procedural application / mechanism tracing (2-3 steps, moderate complexity, near transfer).
 *   - HARD: Boundary evaluation / trade-offs / failure modes / gap diagnostic (3+ steps, high complexity, far transfer).
 *
 * DISTRACTOR TAXONOMY:
 *   - TYPE_A: Evidence-backed or documented learner misconceptions.
 *   - TYPE_B: Domain-plausible errors (near-misses, category shifts, step omissions).
 *   - TYPE_C: Strictly PROHIBITED (absurd, grammatical giveaways, non-domain garbage).
 *
 * INFORMATION CONTROLS:
 *   - Does NOT re-diagnose coverage; takes P5.1/P5.3 as immutable constraints.
 *   - Flags evidence uncertainty whenever dimension has coverage gap or observed depth = 0.
 *
 * Model: openai/gpt-oss-120b on Groq
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const rawResultsDir = path.join(exp5Dir, 'raw_results');
fs.mkdirSync(rawResultsDir, { recursive: true });

const p51File = path.join(rawResultsDir, 'p5_1_profiles.json');
const p52aFile = path.join(rawResultsDir, 'p5_2a_concepts.json');
const p52bFile = path.join(rawResultsDir, 'p5_2b_episodes.json');
const p53File = path.join(rawResultsDir, 'p5_3_diagnostic_matrix.json');
const outputFile = path.join(rawResultsDir, 'p5_4_blueprints.json');

const p51 = JSON.parse(fs.readFileSync(p51File, 'utf8'));
const p52a = JSON.parse(fs.readFileSync(p52aFile, 'utf8'));
const p52b = JSON.parse(fs.readFileSync(p52bFile, 'utf8'));
const p53 = JSON.parse(fs.readFileSync(p53File, 'utf8'));

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

let activeApiKeys = [...apiKeys];
let keyIndex = 0;
function getGroqClient() {
  if (activeApiKeys.length === 0) throw new Error('All Groq API keys are currently rate-limited on daily token quota.');
  const key = activeApiKeys[keyIndex % activeApiKeys.length];
  return { client: new Groq({ apiKey: key }), key };
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % Math.max(1, activeApiKeys.length);
}
function dropDepletedKey(depletedKey, reason) {
  console.warn(`\n  ⚠️ Dropping depleted key ${depletedKey.substring(0, 10)}... from pool: ${reason}`);
  activeApiKeys = activeApiKeys.filter(k => k !== depletedKey);
  keyIndex = 0;
}

const PACKAGE_TIER_MAPPING = {
  'pkg_01_indian_constitution_art21': [
    { tier: 'EASY', dimension: 'IDENTIFICATION', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'MEANING', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'APPLICATION_INTERPRETATION', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ],
  'pkg_02_linear_algebra_eigenvalues': [
    { tier: 'EASY', dimension: 'IDENTIFICATION', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'STRUCTURE_COMPONENTS', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'APPLICATION_INTERPRETATION', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ],
  'pkg_03_dsa_bfs_conceptual': [
    { tier: 'EASY', dimension: 'IDENTIFICATION', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'STRUCTURE_COMPONENTS', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'APPLICATION_INTERPRETATION', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ],
  'pkg_04_dsa_bfs_implementation': [
    { tier: 'EASY', dimension: 'MEANING', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'RELATIONSHIPS_MECHANISM', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'APPLICATION_INTERPRETATION', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ],
  'pkg_05_deep_learning_vaes': [
    { tier: 'EASY', dimension: 'IDENTIFICATION', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'RELATIONSHIPS_MECHANISM', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'APPLICATION_INTERPRETATION', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ],
  'pkg_06_economics_elasticity': [
    { tier: 'EASY', dimension: 'IDENTIFICATION', steps: 1, complexity: 'LOW', transfer: 'ZERO' },
    { tier: 'MEDIUM', dimension: 'RELATIONSHIPS_MECHANISM', steps: 2, complexity: 'MODERATE', transfer: 'NEAR' },
    { tier: 'HARD', dimension: 'BOUNDARIES_EXCEPTIONS', steps: 3, complexity: 'HIGH', transfer: 'FAR' }
  ]
};

async function generateBlueprint(pkgId, tierConfig) {
  const pkgP51 = p51.packages[pkgId];
  const pkgP52a = p52a.packages[pkgId];
  const pkgP53 = p53.packages[pkgId];
  const dimInfo = pkgP53.diagnostic_matrix[tierConfig.dimension];

  const systemPrompt = `You are a Senior Assessment Demand & Cognitive Blueprint Architect.
Specify an assessment blueprint for the given COGNITIVE TIER (${tierConfig.tier}) using the frozen diagnostic coverage.
RULES:
1. Do NOT re-diagnose coverage.
2. Cognitive demand: ${tierConfig.steps} reasoning steps, complexity ${tierConfig.complexity}, transfer ${tierConfig.transfer}.
3. Distractors: Exactly 3 distractors.
   - Distractor 1: TYPE_A (evidence-backed or documented student misconception).
   - Distractor 2: TYPE_B (domain-plausible near-miss or procedural error).
   - Distractor 3: TYPE_B (domain-plausible category confusion or step omission).
   - Type C (trivia, grammatical giveaway, absurd non-domain option) is STRICTLY PROHIBITED.
4. If dimension status is ACTIONABLE_COVERAGE_GAP or observed_depth is 0, set has_uncertainty: true and explain why the lecture evidence does not support testing this as taught content.

OUTPUT SCHEMA (JSON):
{
  "blueprint_id": "${pkgId}_${tierConfig.tier}",
  "cognitive_tier": "${tierConfig.tier}",
  "concept_id": "C01",
  "concept_name": "...",
  "epistemic_dimension": "${tierConfig.dimension}",
  "expected_depth": ${dimInfo.expected_depth},
  "observed_depth": ${dimInfo.observed_depth},
  "diagnostic_status": "${dimInfo.status}",
  "cognitive_demand_spec": {
    "cognitive_operations": "...",
    "reasoning_steps": ${tierConfig.steps},
    "constraint_complexity": "${tierConfig.complexity}",
    "ambiguity_level": "LOW",
    "transfer_distance": "${tierConfig.transfer}"
  },
  "grounding_evidence": {
    "verbatim_quote": "...",
    "episode_id": "..."
  },
  "evidence_uncertainty": {
    "has_uncertainty": ${(dimInfo.status || '').includes('GAP') || dimInfo.observed_depth === 0},
    "uncertainty_rationale": "..."
  },
  "distractors": [
    { "type": "TYPE_A", "misconception_name": "...", "description": "..." },
    { "type": "TYPE_B", "misconception_name": "...", "description": "..." },
    { "type": "TYPE_B", "misconception_name": "...", "description": "..." }
  ],
  "target_question_concept": "...",
  "downstream_generator_prompt": "Specific instruction for MCQ generator to construct the question matching these constraints."
}`;

  const userPrompt = `
PACKAGE: ${pkgId}
TOPIC: ${pkgP51.topic}
OBJECTIVE: ${pkgP51.declared_objective}
DIMENSION: ${tierConfig.dimension} (Expected: ${dimInfo.expected_depth}, Observed: ${dimInfo.observed_depth}, Status: ${dimInfo.status})
EVIDENCE SYNTHESIS: ${dimInfo.evidence_synthesis}
RECONSTRUCTED CONCEPTS:
${pkgP52a.concepts.map(c => `- ${c.concept_id}: ${c.concept_name} ("${(c.evidence_quotes?.[0]?.quote || '').substring(0, 80)}")`).join('\n')}

Produce the JSON blueprint for ${tierConfig.tier}.
`;

  let lastErr = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const { client: groq } = getGroqClient();
    try {
      const res = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 850,
        response_format: { type: 'json_object' }
      });
      rotateKey();
      return JSON.parse(res.choices[0].message.content);
    } catch (err) {
      lastErr = err;
      rotateKey();
      const is429 = err.status === 429 || (err.message || '').includes('429');
      const waitTime = is429 ? 8000 : 1000;
      if (is429) process.stdout.write(`[429, waiting ${waitTime/1000}s]... `);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  throw lastErr;
}

async function main() {
  console.log('======================================================================');
  console.log('PHASE 5: COMPONENT P5.4 — ASSESSMENT DEMAND & DISTRACTOR SPECIFIER (RQ4)');
  console.log('======================================================================');

  let outputData = {
    generated_at: new Date().toISOString(),
    component: 'P5.4_assessment_demand_specifier',
    packages: {}
  };

  if (fs.existsSync(outputFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      if (existing.packages) outputData = existing;
    } catch (e) {}
  }

  const pkgIds = Object.keys(PACKAGE_TIER_MAPPING);
  for (const pkgId of pkgIds) {
    if (!outputData.packages[pkgId]) {
      outputData.packages[pkgId] = {
        package_id: pkgId,
        topic: p51.packages[pkgId].topic,
        objective: p51.packages[pkgId].declared_objective,
        blueprints: []
      };
    }

    if (outputData.packages[pkgId].blueprints?.length === 3) {
      console.log(`Package ${pkgId} already completed (3/3 blueprints). Skipping.`);
      continue;
    }

    console.log(`\nGenerating blueprints for ${pkgId}...`);
    const tierConfigs = PACKAGE_TIER_MAPPING[pkgId];

    for (const tierConfig of tierConfigs) {
      const alreadyHasTier = outputData.packages[pkgId].blueprints.some(b => b.cognitive_tier === tierConfig.tier);
      if (alreadyHasTier) {
        console.log(`  - Tier ${tierConfig.tier} already completed. Skipping.`);
        continue;
      }

      const t0 = Date.now();
      process.stdout.write(`  - Tier ${tierConfig.tier} (${tierConfig.dimension})... `);
      const bp = await generateBlueprint(pkgId, tierConfig);
      outputData.packages[pkgId].blueprints.push(bp);
      fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');
      console.log(`done (${Date.now() - t0}ms)`);
    }

    console.log(`  ✓ Completed all 3 tiers for ${pkgId} (saved to disk).`);
  }

  console.log('\n======================================================================');
  console.log(`P5.4 RUN COMPLETE: Blueprints saved to ${outputFile}`);
  console.log('======================================================================');
}

main().catch(err => {
  console.error('Fatal error in P5.4 runner:', err);
  process.exit(1);
});
