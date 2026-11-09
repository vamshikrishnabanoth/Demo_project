/**
 * server/test/benchmarks/run_change1_verification.js
 *
 * Dedicated verification script for Change 1 (Capacity Metric Unification).
 * Evaluates both the Introductory Lecture and the Deep Architecture & GANs Lecture
 * against the newly implemented evidence-grounded capacity rules.
 *
 * Writes to change1_capacity_verification_output.json WITHOUT overwriting historical baselines.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const lectureIntelligence = require('../../engine/intelligence/lectureIntelligence');
const agent1Planner = require('../../engine/agents/agent1Planner');
const evidencePackager = require('../../engine/evidence/evidencePackager');

async function runChange1Verification() {
  console.log('========================================================================');
  console.log('🔬 CHANGE 1 VERIFICATION: CAPACITY CALCULATION & ACTION OPTIONS AUDIT');
  console.log('========================================================================\n');

  const results = {};

  // ── 1. Introductory Lecture Verification ──────────────────────────────────
  console.log('▶ 1. Evaluating Introductory Lecture (Model Templates)...');
  const introBaselinePath = path.resolve(__dirname, '../../../evaluation_dataset/benchmark_results/introductory_lecture_templates_n10_balanced_output.json');
  const introBaseline = JSON.parse(fs.readFileSync(introBaselinePath, 'utf8'));

  const introText = (introBaseline.evidencePackage?.hierarchicalStore?.children || [])
    .map(c => c.text)
    .join('\n');

  const introIntel = lectureIntelligence.buildPartialFallback({
    evidenceText: introText,
    modality: 'DOCUMENT_ONLY',
    hasTimingData: false
  });

  const introEvidencePkg = evidencePackager.packageSessionEvidence({
    documentTexts: [introText],
    documentNames: ['intro_model_templates.txt'],
    count: 10,
    difficulty: 'Balanced'
  });
  introEvidencePkg.lectureIntelligence = introIntel;

  // Use fast fallback plan for target generation to decouple benchmark from Groq live rate limits
  const origLlm1 = agent1Planner._callLlmPlanGeneration;
  agent1Planner._callLlmPlanGeneration = async () => null;

  let introPlan;
  try {
    introPlan = await agent1Planner.planAssessment(introEvidencePkg, {
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    });
  } finally {
    agent1Planner._callLlmPlanGeneration = origLlm1;
  }

  const introValidTargets = introPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
  const introDeficitTargets = introPlan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

  results.introductoryLecture = {
    baseline: {
      totalDefensibleCapacity: introBaseline.capacityDeficitReport.totalDefensibleCapacity,
      recommendedQuestionCount: introBaseline.capacityDeficitReport.recommendedQuestionCount,
      requestedCount: introBaseline.requestedCount,
      deliveredCount: introBaseline.deliveredCount,
      capacityWarning: introBaseline.capacityDeficitReport.capacityWarning,
      actionOptions: introBaseline.capacityDeficitReport.options
    },
    change1: {
      totalDefensibleCapacity: introIntel.evidenceCapacity.totalDefensibleCapacity,
      recommendedQuestionCount: introIntel.evidenceCapacity.recommendedQuestionCount,
      distinctConceptCount: introIntel.evidenceCapacity.distinctConceptCount,
      capacityByDifficulty: introIntel.evidenceCapacity.capacityByDifficulty,
      recommendedByDifficulty: introIntel.evidenceCapacity.recommendedByDifficulty,
      plannedTargetsTotal: introPlan.assessmentTargets.length,
      fulfilledTargets: introValidTargets.length,
      deficitTargets: introDeficitTargets.length,
      capacityWarning: introPlan.capacityDeficitReport.capacityWarning,
      actionOptions: introPlan.capacityDeficitReport.options
    }
  };

  console.log(`  • Baseline Defensible Capacity: ${results.introductoryLecture.baseline.totalDefensibleCapacity}`);
  console.log(`  • Change 1 Defensible Capacity: ${results.introductoryLecture.change1.totalDefensibleCapacity}`);
  console.log(`  • Recommended Question Count:   ${results.introductoryLecture.change1.recommendedQuestionCount}`);
  console.log(`  • Action Options:`);
  introPlan.capacityDeficitReport.options.forEach(opt => console.log(`    - [${opt.action}]: "${opt.label}"`));

  // ── 2. Deep Technical Lecture (Architecture & GANs) ───────────────────────
  console.log('\n▶ 2. Evaluating Deep Technical Lecture (Architecture & GANs)...');
  const gansFixturePath = path.resolve(__dirname, '../fixtures/lecture_arch_gans.json');
  const gansFixture = JSON.parse(fs.readFileSync(gansFixturePath, 'utf8'));
  const gansBaselinePath = path.resolve(__dirname, '../../../evaluation_dataset/benchmark_results/real_lecture_arch_gans_n10_balanced_output.json');
  const gansBaseline = JSON.parse(fs.readFileSync(gansBaselinePath, 'utf8'));

  const gansText = gansFixture.inputs[0].content;
  const gansIntel = lectureIntelligence.buildPartialFallback({
    evidenceText: gansText,
    modality: 'DOCUMENT_ONLY',
    hasTimingData: false
  });

  const gansEvidencePkg = evidencePackager.packageSessionEvidence({
    documentTexts: [gansText],
    documentNames: ['lecture_arch_gans.txt'],
    count: 10,
    difficulty: 'Balanced'
  });
  gansEvidencePkg.lectureIntelligence = gansIntel;

  let gansPlan;
  try {
    agent1Planner._callLlmPlanGeneration = async () => null;
    gansPlan = await agent1Planner.planAssessment(gansEvidencePkg, {
      requestedDifficulty: 'Balanced',
      requestedCount: 10
    });
  } finally {
    agent1Planner._callLlmPlanGeneration = origLlm1;
  }

  const gansValidTargets = gansPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
  const gansDeficitTargets = gansPlan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

  results.deepArchitectureGans = {
    baseline: {
      totalDefensibleCapacity: gansBaseline.capacityDeficitReport.totalDefensibleCapacity,
      recommendedQuestionCount: gansBaseline.capacityDeficitReport.recommendedQuestionCount,
      requestedCount: gansBaseline.requestedCount,
      deliveredCount: gansBaseline.deliveredCount,
      capacityWarning: gansBaseline.capacityDeficitReport.capacityWarning,
      actionOptions: gansBaseline.capacityDeficitReport.options
    },
    change1: {
      totalDefensibleCapacity: gansIntel.evidenceCapacity.totalDefensibleCapacity,
      recommendedQuestionCount: gansIntel.evidenceCapacity.recommendedQuestionCount,
      distinctConceptCount: gansIntel.evidenceCapacity.distinctConceptCount,
      capacityByDifficulty: gansIntel.evidenceCapacity.capacityByDifficulty,
      recommendedByDifficulty: gansIntel.evidenceCapacity.recommendedByDifficulty,
      plannedTargetsTotal: gansPlan.assessmentTargets.length,
      fulfilledTargets: gansValidTargets.length,
      deficitTargets: gansDeficitTargets.length,
      capacityWarning: gansPlan.capacityDeficitReport.capacityWarning,
      actionOptions: gansPlan.capacityDeficitReport.options
    }
  };

  console.log(`  • Baseline Defensible Capacity: ${results.deepArchitectureGans.baseline.totalDefensibleCapacity}`);
  console.log(`  • Change 1 Defensible Capacity: ${results.deepArchitectureGans.change1.totalDefensibleCapacity}`);
  console.log(`  • Recommended Question Count:   ${results.deepArchitectureGans.change1.recommendedQuestionCount}`);
  console.log(`  • Action Options:`);
  gansPlan.capacityDeficitReport.options.forEach(opt => console.log(`    - [${opt.action}]: "${opt.label}"`));

  // ── 3. Write Output Artifact ──────────────────────────────────────────────
  const outputPath = path.resolve(__dirname, '../../../evaluation_dataset/benchmark_results/change1_capacity_verification_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Change 1 verification report cleanly written to:`);
  console.log(`   ${outputPath}`);

  return results;
}

runChange1Verification().catch(err => {
  console.error('Fatal Change 1 verification error:', err);
  process.exit(1);
});
