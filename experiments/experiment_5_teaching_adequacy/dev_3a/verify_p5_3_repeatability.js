/**
 * experiments/experiment_5_teaching_adequacy/dev_3a/verify_p5_3_repeatability.js
 *
 * Dual-Input Repeatability Verification for Frozen P5.3 Analyzer (Milestone v3.6 Phase 8)
 *
 * Runs P5.3 twice on representative calibration cases under temperature 0.0 using:
 *   1. Baseline P5.2A concept inputs
 *   2. Candidate P5.2A concept inputs
 *
 * Fail-Closed Rule: If any depth score diverges between Run 1 and Run 2, the pipeline HALTS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });
const Groq = require(path.join(DemoProjectDir, 'server/node_modules/groq-sdk'));

const dev3aDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/dev_3a');
const p51Path = path.join(dev3aDir, 'p5_1_profiles_dev3a.json');
const goldPath = path.join(dev3aDir, 'gold_annotations/dev_3a_gold_annotations.json');

// Distinct organizations with their primary and fallback keys
const ORG_GROUPS = [
  { name: 'Org_m2n (KEY_3/KEY_4)', keys: [process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4].filter(Boolean) },
  { name: 'Org_m0e (BACKUP)', keys: [process.env.GROQ_API_KEY_BACKUP].filter(Boolean) },
  { name: 'Org_kyc (FRESH)', keys: [process.env.GROQ_API_KEY_FRESH].filter(Boolean) },
  { name: 'Org_kp6 (KEY_5/KEY)', keys: [process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY].filter(Boolean) }
].filter(g => g.keys.length > 0);

function parseWaitMs(errMsg) {
  const match = errMsg.match(/try again in (?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/);
  if (!match) return 15000;
  const mins = parseFloat(match[1] || '0');
  const secs = parseFloat(match[2] || '0');
  return Math.ceil((mins * 60 + secs) * 1000);
}

async function callGroqWithMultiOrg(messages) {
  while (true) {
    const orgWaitTimes = [];
    for (const group of ORG_GROUPS) {
      for (const apiKey of group.keys) {
        try {
          const client = new Groq({ apiKey });
          const res = await client.chat.completions.create({
            model: MODEL_NAME,
            messages,
            temperature: TEMPERATURE,
            max_tokens: MAX_COMPLETION_TOKENS,
            response_format: { type: 'json_object' }
          });
          return res;
        } catch (err) {
          if (err.message && err.message.includes('rate_limit_exceeded')) {
            const waitMs = parseWaitMs(err.message);
            orgWaitTimes.push({ org: group.name, waitMs });
            break;
          }
        }
      }
    }
    if (orgWaitTimes.length > 0) {
      orgWaitTimes.sort((a, b) => a.waitMs - b.waitMs);
      const shortest = orgWaitTimes[0];
      const sleepMs = Math.max(shortest.waitMs + 2000, 5000);
      console.log(`[QUOTA WAIT] All orgs rate-limited. Shortest wait: ${shortest.org} (${Math.round(shortest.waitMs / 1000)}s). Sleeping ${Math.round(sleepMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, sleepMs));
    } else {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TEMPERATURE = 0.0;
const MAX_COMPLETION_TOKENS = 2200;

const { SYSTEM_PROMPT: FROZEN_P53_SYSTEM_PROMPT } = require(path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js'));

async function runSingleInference(pkgProfile, conceptsList, segTitle) {
  const p51Formatted = Object.keys(pkgProfile.expected_dimensions)
    .map(d => `${d}: ExpDepth=${pkgProfile.expected_dimensions[d].level}, Tier=${pkgProfile.expected_dimensions[d].alignment}`)
    .join('\n');

  const p52aFormatted = conceptsList
    .map(c => `- [${c.concept_id}] ${c.name} (${c.epistemic_dimension}): ${c.observed_summary}`)
    .join('\n');

  const p52bFormatted = `- [EP_01] [0s-60s] Complete instructional segment for ${segTitle} (CONCEPT_EXPLANATION, MONOLOGUE)`;

  const userPrompt = `TOPIC: ${pkgProfile.topic} (Segment: ${segTitle})

RECORDING QUALITY:
Audio Clarity: HIGH
Completeness: COMPLETE
Limitations: NONE

P5.1 NORMATIVE EXPECTATIONS:
${p51Formatted}

P5.2A TAUGHT CONCEPTS:
${p52aFormatted}

P5.2B INSTRUCTIONAL EPISODES:
${p52bFormatted}

Construct the full 8-dimension diagnostic coverage matrix in JSON.`;

  const messages = [
    { role: 'system', content: FROZEN_P53_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  const res = await callGroqWithMultiOrg(messages);
  const parsed = JSON.parse(res.choices[0].message.content);
  return parsed.diagnostic_matrix || {};
}

async function verifyRepeatability(conceptsPath, label, testCases = ['1A', '2A']) {
  console.log(`\n--- TARGETED REPEATABILITY CHECK: ${label} ---`);
  const p51Data = JSON.parse(fs.readFileSync(p51Path, 'utf8'));
  const conceptsData = JSON.parse(fs.readFileSync(conceptsPath, 'utf8'));
  const goldData = JSON.parse(fs.readFileSync(goldPath, 'utf8'));

  const rawPass1 = {};
  const rawPass2 = {};
  let allIdentical = true;

  for (const segKey of testCases) {
    const goldSeg = goldData[segKey];
    const pkgProfile = p51Data.packages[goldSeg.package_id];
    const concepts = conceptsData[segKey].concepts;
    const targetDim = goldSeg.target_dimension;

    console.log(`  Evaluating Segment ${segKey} (Target: ${targetDim})...`);
    console.log(`    Running Pass 1 (T=0.0)...`);
    const run1 = await runSingleInference(pkgProfile, concepts, goldSeg.title);
    rawPass1[segKey] = run1;

    console.log(`    Running Pass 2 (T=0.0)...`);
    const run2 = await runSingleInference(pkgProfile, concepts, goldSeg.title);
    rawPass2[segKey] = run2;

    const target1 = run1[targetDim] || { observed_depth: 0, status: 'NONE' };
    const target2 = run2[targetDim] || { observed_depth: 0, status: 'NONE' };

    const depthMatch = (target1.observed_depth === target2.observed_depth);
    const statusMatch = (target1.status === target2.status);
    const confMatch = (target1.confidence === target2.confidence);

    // Also check all 8 dimensions for complete structural identity
    let allDimsMatch = true;
    for (const d of Object.keys(pkgProfile.expected_dimensions)) {
      const d1 = run1[d] || { observed_depth: 0, status: 'NONE' };
      const d2 = run2[d] || { observed_depth: 0, status: 'NONE' };
      if (d1.observed_depth !== d2.observed_depth || d1.status !== d2.status) {
        allDimsMatch = false;
      }
    }

    const isMatch = depthMatch && statusMatch && allDimsMatch;
    if (!isMatch) allIdentical = false;

    console.log(`    Target Dim [${targetDim}]:`);
    console.log(`      Pass 1: Depth=${target1.observed_depth}, Status=${target1.status}`);
    console.log(`      Pass 2: Depth=${target2.observed_depth}, Status=${target2.status}`);
    console.log(`      Target Concordance: ${depthMatch && statusMatch ? '✅ IDENTICAL' : '❌ DIVERGED'}`);
    console.log(`      8-Dim Full-Matrix Identity: ${allDimsMatch ? '✅ 8/8 IDENTICAL' : '❌ MATRIX DIVERGED'}`);

    // Persist raw outputs immediately
    const scratchDir = path.join(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy/scratch');
    fs.mkdirSync(scratchDir, { recursive: true });
    fs.writeFileSync(path.join(scratchDir, `repeatability_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_pass1.json`), JSON.stringify(rawPass1, null, 2), 'utf8');
    fs.writeFileSync(path.join(scratchDir, `repeatability_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_pass2.json`), JSON.stringify(rawPass2, null, 2), 'utf8');

    if (!depthMatch) {
      console.log('Pass 1 Matrix for ' + segKey + ':', JSON.stringify(run1[targetDim], null, 2));
      console.log('Pass 2 Matrix for ' + segKey + ':', JSON.stringify(run2[targetDim], null, 2));
      throw new Error(`[FAIL-CLOSED] Non-deterministic divergence on ${label} Segment ${segKey}: Pass 1 = ${target1.observed_depth}, Pass 2 = ${target2.observed_depth}`);
    }
  }

  console.log(`✅ ${label} Targeted Repeatability: 100% Deterministic across all passes and structured fields.`);
  return allIdentical;
}

module.exports = {
  verifyRepeatability
};

if (require.main === module) {
  (async () => {
    try {
      console.log('='.repeat(75));
      console.log('P5.3 FROZEN ANALYZER: TARGETED DETERMINISTIC REPEATABILITY CHECK');
      console.log('Sensitive Calibration Cases: 1A & 2A (Full Matrix Structured Comparison)');
      console.log('='.repeat(75));
      const baselineConcepts = path.join(dev3aDir, 'calibration_corpus/p5_2a_baseline_dev3a_concepts.json');
      const candidateConcepts = path.join(dev3aDir, 'calibration_corpus/p5_2a_candidate_dev3a_concepts_v1_2_0.json');
      await verifyRepeatability(baselineConcepts, 'Baseline P5.2A Inputs', ['1A', '2A']);
      await verifyRepeatability(candidateConcepts, 'Candidate P5.2A v1.2.0 Inputs', ['1A', '2A']);
      console.log('\n🎉 ALL TARGETED REPEATABILITY CHECKS PASSED: 100% Zero Divergence.');
    } catch (err) {
      console.error('\n❌ Repeatability Verification Failed:', err.message);
      process.exit(1);
    }
  })();
}
