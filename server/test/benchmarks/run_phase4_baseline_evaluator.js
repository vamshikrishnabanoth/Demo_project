/**
 * server/test/benchmarks/run_phase4_baseline_evaluator.js
 *
 * Phase 4 Baseline Evaluator: Runs the current production system (unmodified)
 * against the 22 Phase 4 Golden Benchmark Cases.
 * 
 * Invariants:
 * - Read-only: Zero production code modified.
 * - Establishes empirical baseline for:
 *   1. Negative Boundary Adherence & Anti-Hallucination Rate
 *   2. Contrasting Style Differentiation (Lecturer A vs Lecturer B)
 *   3. Conceptual-Hard False Deficit Rate
 *   4. True Deficit Detection Precision
 *   5. Instructional Intent Recognition Rate
 */

'use strict';

const fs = require('fs');
const path = require('path');
const evidencePackager = require('../../engine/evidence/evidencePackager');
const agent1Planner = require('../../engine/agents/agent1Planner');

const GOLDEN_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_benchmark.json');
const HOLDOUT_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_holdout_unseen.json');

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function evaluateDataset(datasetName, cases) {
  console.log('=========================================================================================================');
  console.log(`                       EVALUATING BASELINE ON: ${datasetName} (${cases.length} cases)`);
  console.log('=========================================================================================================');

  const results = [];

  for (const tc of cases) {
    const sessionInputs = {
      sessionId: `baseline_${tc.testId}`,
      voiceTranscript: tc.voiceSnippet,
      documentTexts: [tc.documentSnippet]
    };

    // 1. Current Evidence Packager
    const pkg = evidencePackager.packageSessionEvidence(sessionInputs);

    // 2. Current Agent 1 Planner
    const plan = agent1Planner._buildFallbackPlan(
      pkg.unifiedRawContent,
      'Balanced',
      3,
      pkg.categoryWeights,
      pkg.lectureDepth,
      pkg.detectedFocus,
      pkg
    );
    agent1Planner._applyDifficultyBlueprint(plan, 'Balanced', 3, pkg);

    // A. Intent extraction check
    const hasIntentExtraction = Boolean(pkg.teacherIntent || plan.teacherIntent);
    const extractedIntent = pkg.teacherIntent || plan.teacherIntent || 'BLOOM_QUOTA_DEFAULT';

    // B. Negative boundary check
    const hasBoundaryDetection = Boolean(pkg.negativeBoundaries || plan.negativeBoundaries);
    const extractedBoundaries = pkg.negativeBoundaries || plan.negativeBoundaries || [];
    const boundaryRespected = (tc.negativeBoundaries.length === 0) || (hasBoundaryDetection && tc.negativeBoundaries.every(b => extractedBoundaries.includes(b)));

    // C. Hard feasibility check
    const hasDeficit = (plan.capacityLimitations || []).some(l => l.limitationType === 'INSUFFICIENT_EVIDENCE_FOR_HARD') ||
      (plan.depthCapacity && plan.depthCapacity.deficit > 0);

    let feasibilityStatus;
    if (tc.hardFeasible) {
      feasibilityStatus = !hasDeficit ? 'CORRECT_SUPPORTED' : 'FALSE_DEFICIT';
    } else {
      feasibilityStatus = hasDeficit ? 'CORRECT_DEFICIT' : 'FALSE_SUPPORTED';
    }

    results.push({
      testId: tc.testId,
      name: tc.name,
      category: tc.category,
      pairId: tc.pairId,
      expectedIntent: tc.expectedIntent,
      extractedIntent,
      intentMatch: extractedIntent === tc.expectedIntent,
      negativeBoundaries: tc.negativeBoundaries,
      extractedBoundaries,
      boundaryRespected,
      expectedHardFeasible: tc.hardFeasible,
      systemHasDeficit: hasDeficit,
      feasibilityStatus
    });
  }

  // Calculate Metrics
  const intentCorrect = results.filter(r => r.intentMatch).length;
  const intentAccuracy = ((intentCorrect / results.length) * 100).toFixed(1);

  const boundaryCases = results.filter(r => r.negativeBoundaries.length > 0);
  const boundaryCorrect = boundaryCases.filter(r => r.boundaryRespected).length;
  const boundaryAdherence = boundaryCases.length > 0 ? ((boundaryCorrect / boundaryCases.length) * 100).toFixed(1) : '100.0';

  const cat3Cases = results.filter(r => r.category === 'CONCEPTUAL_HARD_FEASIBILITY');
  const cat3Success = cat3Cases.filter(r => r.feasibilityStatus === 'CORRECT_SUPPORTED').length;
  const cat3Recall = cat3Cases.length > 0 ? ((cat3Success / cat3Cases.length) * 100).toFixed(1) : 'N/A';

  const cat4Cases = results.filter(r => r.category === 'GENUINE_HARD_INFEASIBILITY');
  const cat4CorrectDeficits = cat4Cases.filter(r => r.feasibilityStatus === 'CORRECT_DEFICIT').length;
  const cat4Precision = cat4Cases.length > 0 ? ((cat4CorrectDeficits / cat4Cases.length) * 100).toFixed(1) : 'N/A';

  const pairIds = Array.from(new Set(cases.map(c => c.pairId).filter(Boolean)));
  let distinctPairs = 0;
  pairIds.forEach(pid => {
    const pairCases = results.filter(r => r.pairId === pid);
    if (pairCases.length === 2 && pairCases[0].extractedIntent !== pairCases[1].extractedIntent) {
      distinctPairs++;
    }
  });
  const pairDiff = pairIds.length > 0 ? ((distinctPairs / pairIds.length) * 100).toFixed(1) : 'N/A';

  console.log(`Intent Recognition Rate                 : ${intentCorrect}/${results.length} (${intentAccuracy}%)`);
  console.log(`Negative Boundary Adherence             : ${boundaryCorrect}/${boundaryCases.length} (${boundaryAdherence}%)`);
  console.log(`Conceptual-Hard Feasibility (No Code)   : ${cat3Success}/${cat3Cases.length} (${cat3Recall}%)`);
  console.log(`Genuine Infeasibility Deficit Precision : ${cat4CorrectDeficits}/${cat4Cases.length} (${cat4Precision}%)`);
  console.log(`Contrasting Style Differentiation       : ${distinctPairs}/${pairIds.length} (${pairDiff}%)\n`);

  return { intentAccuracy, boundaryAdherence, cat3Recall, cat4Precision, pairDiff, results };
}

function runAllBaselines() {
  console.log('========================================================================');
  console.log('       PHASE 4: INSTRUCTIONAL INTENT & RELATIVE DIFFICULTY BASELINE     ');
  console.log('========================================================================\n');

  const goldenCases = loadJson(GOLDEN_FILE);
  const holdoutCases = loadJson(HOLDOUT_FILE);

  const rGolden = evaluateDataset('PHASE 4 GOLDEN (DEVELOPMENT)', goldenCases);
  const rHoldout = evaluateDataset('PHASE 4 UNSEEN HOLDOUT (TEST)', holdoutCases);

  console.log('=========================================================================================================');
  console.log('                               CURRENT PRODUCTION BASELINE MATRIX                                        ');
  console.log('=========================================================================================================');
  console.log('Evaluation Metric                   | Phase 4 Golden (22 cases)     | Unseen Holdout (14 cases)');
  console.log('------------------------------------|-------------------------------|------------------------------------');
  console.log(`Instructional Intent Recognition    | ${rGolden.intentAccuracy}%                        | ${rHoldout.intentAccuracy}%`);
  console.log(`Negative Boundary Adherence         | ${rGolden.boundaryAdherence}%                        | ${rHoldout.boundaryAdherence}%`);
  console.log(`Conceptual-Hard Feasibility         | ${rGolden.cat3Recall}%                        | ${rHoldout.cat3Recall}%`);
  console.log(`Genuine Deficit Precision           | ${rGolden.cat4Precision}%                      | ${rHoldout.cat4Precision}%`);
  console.log(`Contrasting Style Differentiation   | ${rGolden.pairDiff}%                        | ${rHoldout.pairDiff}%`);
  console.log('=========================================================================================================\n');
}

if (require.main === module) {
  runAllBaselines();
}

module.exports = { runAllBaselines, evaluateDataset };
