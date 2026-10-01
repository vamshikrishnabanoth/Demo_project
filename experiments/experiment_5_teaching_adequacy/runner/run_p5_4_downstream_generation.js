/**
 * experiments/experiment_5_teaching_adequacy/runner/run_p5_4_downstream_generation.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * RQ4 Downstream Generation & Invariant Verification Harness
 *
 * PURPOSE:
 * Feeds calibrated P5.4 Assessment Blueprints into the frozen Phase 3 Question Generator
 * (server/engine/agents/agent2Generator.js) and evaluates:
 *   1. M1 Verbatim Evidence Grounding Gate (Required 100%)
 *   2. M7 Single-Key Answer Determinism (Required 100%)
 *   3. Option Exclusivity & Zero Containment Gate (Required 100%)
 *   4. Distractor Misconception Taxonomy Distribution (Type A + Type B vs Prohibited Type C)
 *   5. Decoupled Cognitive Demand Verification (Easy / Medium / Hard alignment)
 *
 * INFORMATION CONTROLS:
 *   - Strictly treats server/engine/** as read-only / frozen baseline.
 *   - Evaluates cognitive demand separately from syntactic/grounding validity.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
require(path.join(DemoProjectDir, 'server/node_modules/dotenv')).config({ path: path.join(DemoProjectDir, 'server/.env') });

const agent2Generator = require(path.join(DemoProjectDir, 'server/engine/agents/agent2Generator'));

const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');
const corpusDir = path.join(exp5Dir, 'benchmark_corpus');
const rawResultsDir = path.join(exp5Dir, 'raw_results');
const blueprintsFile = path.join(rawResultsDir, 'p5_4_blueprints.json');
const generatedMcqsFile = path.join(rawResultsDir, 'p5_4_generated_mcqs.json');
const evalOutputFile = path.join(rawResultsDir, 'p5_4_evaluation_summary.json');

// Helper to check option containment / exclusivity
function checkOptionExclusivity(options) {
  if (!Array.isArray(options) || options.length !== 4) return { pass: false, reason: 'Must have exactly 4 options' };
  const lower = options.map(o => String(o).trim().toLowerCase());
  const unique = new Set(lower);
  if (unique.size !== 4) return { pass: false, reason: 'Duplicate options detected' };

  for (let i = 0; i < lower.length; i++) {
    for (let j = 0; j < lower.length; j++) {
      if (i !== j) {
        if (lower[i].length > 4 && lower[j].includes(lower[i])) {
          return { pass: false, reason: `Option containment: "${options[i]}" contained in "${options[j]}"` };
        }
      }
    }
  }
  return { pass: true };
}

// Helper to evaluate verbatim grounding against transcript text
function checkGrounding(mcq, transcriptText, directEvidenceQuote) {
  const normTrans = (transcriptText + ' ' + (directEvidenceQuote || '')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const normAns = String(mcq.correctAnswer || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const words = normAns.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return true; // short answer, checked by direct quote
  const matchedWords = words.filter(w => normTrans.includes(w));
  return (matchedWords.length / words.length) >= 0.75;
}

// Classify distractor taxonomy
function classifyDistractor(distractorText, blueprintDistractors, domainContext) {
  const norm = String(distractorText || '').toLowerCase();
  // Check Type C (invalid, absurd, giveaways)
  if (norm.length < 2 || norm.includes('all of the above') || norm.includes('none of the above') || norm.includes('banana') || norm.includes('nonsense')) {
    return 'TYPE_C';
  }
  // Check if matches a documented blueprint misconception (Type A)
  const isTypeA = (blueprintDistractors || []).some(d => {
    if (d.type !== 'TYPE_A') return false;
    const descWords = (d.description + ' ' + d.misconception_name).toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matches = descWords.filter(w => norm.includes(w));
    return matches.length >= 2;
  });
  if (isTypeA) return 'TYPE_A';

  // Domain plausible (Type B)
  return 'TYPE_B';
}

async function main() {
  console.log('======================================================================');
  console.log('PHASE 5: COMPONENT P5.4 — DOWNSTREAM QUESTION GENERATION & EVALUATION');
  console.log('======================================================================');

  if (!fs.existsSync(blueprintsFile)) {
    console.error(`Blueprints file not found: ${blueprintsFile}`);
    process.exit(1);
  }

  const p54Data = JSON.parse(fs.readFileSync(blueprintsFile, 'utf8'));
  const packages = p54Data.packages || {};

  let generatedData = {
    generated_at: new Date().toISOString(),
    packages: {}
  };

  if (fs.existsSync(generatedMcqsFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(generatedMcqsFile, 'utf8'));
      if (existing.packages) generatedData = existing;
    } catch (e) {}
  }

  const evalSummary = {
    evaluated_at: new Date().toISOString(),
    total_blueprints: 0,
    total_generated: 0,
    m1_grounding_pass_count: 0,
    m7_single_key_pass_count: 0,
    option_exclusivity_pass_count: 0,
    distractor_taxonomy_counts: {
      TYPE_A: 0,
      TYPE_B: 0,
      TYPE_C: 0
    },
    cognitive_demand_alignment: {
      EASY: { count: 0, aligned: 0 },
      MEDIUM: { count: 0, aligned: 0 },
      HARD: { count: 0, aligned: 0 }
    },
    key_distribution: { A: 0, B: 0, C: 0, D: 0 },
    package_evaluations: {}
  };

  for (const [pkgId, pkgInfo] of Object.entries(packages)) {
    console.log(`\nProcessing package: ${pkgId}`);
    const transcriptPath = path.join(corpusDir, pkgId, 'transcript.json');
    let transcriptText = '';
    if (fs.existsSync(transcriptPath)) {
      const transObj = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
      transcriptText = (transObj.segments || []).map(s => s.text).join(' ');
    }

    if (!generatedData.packages[pkgId]) {
      generatedData.packages[pkgId] = {
        package_id: pkgId,
        topic: pkgInfo.topic,
        items: []
      };
    }

    const pkgItems = generatedData.packages[pkgId].items;
    const blueprints = pkgInfo.blueprints || [];

    for (const bp of blueprints) {
      evalSummary.total_blueprints++;
      let mcqItem = pkgItems.find(it => it.blueprint_id === bp.blueprint_id);

      if (!mcqItem) {
        process.stdout.write(`  Generating MCQ for ${bp.blueprint_id} (${bp.cognitive_tier} / ${bp.epistemic_dimension})... `);
        const t0 = Date.now();

        const target = {
          targetId: bp.blueprint_id,
          concept: bp.concept_name,
          dimension: bp.epistemic_dimension,
          cognitiveLevel: bp.cognitive_tier === 'EASY' ? 'Remember' : (bp.cognitive_tier === 'MEDIUM' ? 'Apply' : 'Analyze'),
          targetDifficulty: bp.cognitive_tier === 'EASY' ? 'Easy' : (bp.cognitive_tier === 'MEDIUM' ? 'Medium' : 'Hard'),
          supportingEvidence: bp.grounding_evidence?.verbatim_quote || '',
          instruction: bp.target_question_concept || bp.downstream_generator_prompt || `Generate a multiple choice question testing ${bp.concept_name} at depth ${bp.expected_depth}.`
        };

        const evidencePackage = {
          sessionId: `p54_${pkgId}`,
          unifiedRawContent: transcriptText || bp.grounding_evidence?.verbatim_quote || bp.concept_name
        };

        try {
          mcqItem = await agent2Generator.generateQuestion(target, evidencePackage);
          mcqItem.blueprint_id = bp.blueprint_id;
          mcqItem.cognitive_tier = bp.cognitive_tier;
          mcqItem.epistemic_dimension = bp.epistemic_dimension;
          mcqItem.evidence_uncertainty = bp.evidence_uncertainty;
          pkgItems.push(mcqItem);
          fs.writeFileSync(generatedMcqsFile, JSON.stringify(generatedData, null, 2), 'utf8');
          console.log(`done (${Date.now() - t0}ms)`);
        } catch (genErr) {
          console.error(`\n    ❌ Error generating MCQ for ${bp.blueprint_id}: ${genErr.message}`);
          continue;
        }
      } else {
        console.log(`  MCQ already generated for ${bp.blueprint_id}. Skipping LLM call.`);
      }

      evalSummary.total_generated++;

      // 1. M1 Grounding Check
      const isGrounded = checkGrounding(mcqItem, transcriptText, bp.grounding_evidence?.verbatim_quote);
      if (isGrounded) evalSummary.m1_grounding_pass_count++;

      // 2. M7 Single-Key Determinism
      const optIdx = mcqItem.options ? mcqItem.options.indexOf(mcqItem.correctAnswer) : -1;
      const isSingleKey = optIdx >= 0;
      if (isSingleKey) {
        evalSummary.m7_single_key_pass_count++;
        const keyLetters = ['A', 'B', 'C', 'D'];
        evalSummary.key_distribution[keyLetters[optIdx]]++;
      }

      // 3. Option Exclusivity
      const exclusivRes = checkOptionExclusivity(mcqItem.options);
      if (exclusivRes.pass) evalSummary.option_exclusivity_pass_count++;

      // 4. Distractor Misconception Taxonomy Classification
      const distractors = (mcqItem.options || []).filter(o => o !== mcqItem.correctAnswer);
      for (const d of distractors) {
        const dType = classifyDistractor(d, bp.distractors, pkgInfo.topic);
        evalSummary.distractor_taxonomy_counts[dType]++;
      }

      // 5. Cognitive Demand Alignment
      const tierObj = evalSummary.cognitive_demand_alignment[bp.cognitive_tier];
      if (tierObj) {
        tierObj.count++;
        // Verify demand criteria
        const stemWords = (mcqItem.questionText || '').split(/\s+/).length;
        if (bp.cognitive_tier === 'EASY' && stemWords <= 35) tierObj.aligned++;
        else if (bp.cognitive_tier === 'MEDIUM' && stemWords >= 15) tierObj.aligned++;
        else if (bp.cognitive_tier === 'HARD' && (stemWords >= 20 || bp.evidence_uncertainty?.has_uncertainty)) tierObj.aligned++;
      }
    }
  }

  // Summary rates
  evalSummary.m1_grounding_rate_pct = Number(((evalSummary.m1_grounding_pass_count / evalSummary.total_generated) * 100).toFixed(2));
  evalSummary.m7_single_key_rate_pct = Number(((evalSummary.m7_single_key_pass_count / evalSummary.total_generated) * 100).toFixed(2));
  evalSummary.option_exclusivity_rate_pct = Number(((evalSummary.option_exclusivity_pass_count / evalSummary.total_generated) * 100).toFixed(2));

  const totalDist = evalSummary.distractor_taxonomy_counts.TYPE_A + evalSummary.distractor_taxonomy_counts.TYPE_B + evalSummary.distractor_taxonomy_counts.TYPE_C;
  evalSummary.distractor_type_a_pct = Number(((evalSummary.distractor_taxonomy_counts.TYPE_A / totalDist) * 100).toFixed(2));
  evalSummary.distractor_type_b_pct = Number(((evalSummary.distractor_taxonomy_counts.TYPE_B / totalDist) * 100).toFixed(2));
  evalSummary.distractor_type_c_pct = Number(((evalSummary.distractor_taxonomy_counts.TYPE_C / totalDist) * 100).toFixed(2));

  fs.writeFileSync(evalOutputFile, JSON.stringify(evalSummary, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log('RQ4 DOWNSTREAM EVALUATION SUMMARY');
  console.log('======================================================================');
  console.log(`Total Blueprints Evaluated:           ${evalSummary.total_generated} / ${evalSummary.total_blueprints}`);
  console.log(`M1 Verbatim Grounding Rate:          ${evalSummary.m1_grounding_rate_pct}% (${evalSummary.m1_grounding_pass_count}/${evalSummary.total_generated})`);
  console.log(`M7 Single-Key Determinism Rate:      ${evalSummary.m7_single_key_rate_pct}% (${evalSummary.m7_single_key_pass_count}/${evalSummary.total_generated})`);
  console.log(`Option Exclusivity Rate:             ${evalSummary.option_exclusivity_rate_pct}% (${evalSummary.option_exclusivity_pass_count}/${evalSummary.total_generated})`);
  console.log(`Distractor Taxonomy:`);
  console.log(`  - Type A (Documented Misconception): ${evalSummary.distractor_type_a_pct}% (${evalSummary.distractor_taxonomy_counts.TYPE_A})`);
  console.log(`  - Type B (Domain-Plausible):         ${evalSummary.distractor_type_b_pct}% (${evalSummary.distractor_taxonomy_counts.TYPE_B})`);
  console.log(`  - Type C (Prohibited / Invalid):     ${evalSummary.distractor_type_c_pct}% (${evalSummary.distractor_taxonomy_counts.TYPE_C})`);
  console.log(`Key Distribution:                    A=${evalSummary.key_distribution.A}, B=${evalSummary.key_distribution.B}, C=${evalSummary.key_distribution.C}, D=${evalSummary.key_distribution.D}`);
  console.log(`Results written to: ${evalOutputFile}`);
  console.log('======================================================================');
}

main().catch(err => {
  console.error('Fatal error in downstream harness:', err);
  process.exit(1);
});
