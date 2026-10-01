/**
 * experiments/experiment_5_teaching_adequacy/runner/evaluate_p5_1.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Evaluation of Component P5.1 (Normative Depth Profile Generator / RQ2)
 *
 * Evaluates generated normative profiles against the independently adjudicated,
 * sealed human normative reference ground truth:
 *   - Mean Absolute Depth Error (MADE)
 *   - Signed Depth Bias (SDB)
 *   - Profile Vector Cosine Similarity
 *   - Dimension Selection / Alignment Concordance (Precision, Recall, F1, Jaccard)
 *   - Objective-Conditioning Sensitivity (BFS Conceptual vs Implementation)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');

const gtPath = path.join(exp5Dir, 'ground_truth/normative/normative_reference_profiles.json');
const predPath = path.join(exp5Dir, 'raw_results/p5_1_profiles.json');
const evalOutputPath = path.join(exp5Dir, 'raw_results/p5_1_evaluation_summary.json');

const DIMENSIONS = [
  'IDENTIFICATION',
  'MEANING',
  'STRUCTURE_COMPONENTS',
  'RELATIONSHIPS_MECHANISM',
  'JUSTIFICATION_WHY',
  'APPLICATION_INTERPRETATION',
  'BOUNDARIES_EXCEPTIONS',
  'TRANSFER_SYNTHESIS'
];

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function evaluate() {
  if (!fs.existsSync(gtPath)) {
    throw new Error(`Ground truth file not found: ${gtPath}`);
  }
  if (!fs.existsSync(predPath)) {
    throw new Error(`Predictions file not found: ${predPath}`);
  }

  const gtData = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
  const predData = JSON.parse(fs.readFileSync(predPath, 'utf8'));

  const packages = Object.keys(gtData.packages).sort();
  console.log('='.repeat(80));
  console.log('PHASE 5: COMPONENT P5.1 EVALUATION (RQ2 — NORMATIVE CONCORDANCE)');
  console.log('='.repeat(80));
  console.log(`Ground Truth: ${gtPath}`);
  console.log(`Predictions:  ${predPath}`);
  console.log(`Packages:     ${packages.length}`);
  console.log('-'.repeat(80));

  const packageSummaries = {};
  let totalMadeSum = 0;
  let totalSdbSum = 0;
  let totalDimsEvaluated = 0;
  let totalCosineSimSum = 0;
  let totalAlignmentMatches = 0;

  // Binary classification of core scope (REQUIRED or RECOMMENDED vs OPTIONAL or PERMISSIBLE)
  let totalCoreTP = 0;
  let totalCoreFP = 0;
  let totalCoreFN = 0;
  let totalCoreTN = 0;

  for (const pkgId of packages) {
    const pkgGT = gtData.packages[pkgId];
    const pkgPred = predData.packages[pkgId];

    if (!pkgPred) {
      console.error(`Missing prediction for package: ${pkgId}`);
      continue;
    }

    const gtDims = pkgGT.expected_dimensions;
    const predDims = pkgPred.expected_dimensions;

    const gtLevels = [];
    const predLevels = [];

    let pkgAbsErrorSum = 0;
    let pkgSignedErrorSum = 0;
    let pkgAlignmentMatches = 0;
    let pkgCoreTP = 0, pkgCoreFP = 0, pkgCoreFN = 0, pkgCoreTN = 0;

    const dimDetails = {};

    for (const dim of DIMENSIONS) {
      const gtItem = gtDims[dim];
      const predItem = predDims[dim];

      const gtLevel = gtItem ? gtItem.level : 0;
      const predLevel = predItem ? predItem.level : 0;

      gtLevels.push(gtLevel);
      predLevels.push(predLevel);

      const absDiff = Math.abs(predLevel - gtLevel);
      const signedDiff = predLevel - gtLevel;

      pkgAbsErrorSum += absDiff;
      pkgSignedErrorSum += signedDiff;

      // Alignment check
      const gtAlign = gtItem ? gtItem.alignment : 'PERMISSIBLE_SCOPE_OMISSION';
      const predAlign = predItem ? predItem.alignment : 'PERMISSIBLE_SCOPE_OMISSION';
      const alignMatch = (gtAlign === predAlign);
      if (alignMatch) pkgAlignmentMatches++;

      // Core scope classification: REQUIRED / RECOMMENDED vs OPTIONAL / PERMISSIBLE
      const gtIsCore = (gtAlign === 'REQUIRED' || gtAlign === 'RECOMMENDED');
      const predIsCore = (predAlign === 'REQUIRED' || predAlign === 'RECOMMENDED');

      if (predIsCore && gtIsCore) {
        pkgCoreTP++;
        totalCoreTP++;
      } else if (predIsCore && !gtIsCore) {
        pkgCoreFP++;
        totalCoreFP++;
      } else if (!predIsCore && gtIsCore) {
        pkgCoreFN++;
        totalCoreFN++;
      } else {
        pkgCoreTN++;
        totalCoreTN++;
      }

      dimDetails[dim] = {
        gt_level: gtLevel,
        pred_level: predLevel,
        level_diff: signedDiff,
        abs_diff: absDiff,
        gt_alignment: gtAlign,
        pred_alignment: predAlign,
        alignment_match: alignMatch,
        pred_rationale: predItem ? predItem.rationale : ''
      };
    }

    const pkgMade = pkgAbsErrorSum / DIMENSIONS.length;
    const pkgSdb = pkgSignedErrorSum / DIMENSIONS.length;
    const pkgCosine = cosineSimilarity(predLevels, gtLevels);
    const pkgAlignmentAcc = (pkgAlignmentMatches / DIMENSIONS.length) * 100;

    const pkgCorePrecision = (pkgCoreTP + pkgCoreFP > 0) ? (pkgCoreTP / (pkgCoreTP + pkgCoreFP)) : 1.0;
    const pkgCoreRecall = (pkgCoreTP + pkgCoreFN > 0) ? (pkgCoreTP / (pkgCoreTP + pkgCoreFN)) : 1.0;
    const pkgCoreF1 = (pkgCorePrecision + pkgCoreRecall > 0) ? (2 * pkgCorePrecision * pkgCoreRecall / (pkgCorePrecision + pkgCoreRecall)) : 0;
    const pkgCoreJaccard = (pkgCoreTP + pkgCoreFP + pkgCoreFN > 0) ? (pkgCoreTP / (pkgCoreTP + pkgCoreFP + pkgCoreFN)) : 1.0;

    totalMadeSum += pkgAbsErrorSum;
    totalSdbSum += pkgSignedErrorSum;
    totalDimsEvaluated += DIMENSIONS.length;
    totalCosineSimSum += pkgCosine;
    totalAlignmentMatches += pkgAlignmentMatches;

    packageSummaries[pkgId] = {
      package_id: pkgId,
      made: Number(pkgMade.toFixed(4)),
      sdb: Number(pkgSdb.toFixed(4)),
      cosine_similarity: Number(pkgCosine.toFixed(4)),
      alignment_accuracy_pct: Number(pkgAlignmentAcc.toFixed(2)),
      core_scope_selection: {
        precision: Number(pkgCorePrecision.toFixed(4)),
        recall: Number(pkgCoreRecall.toFixed(4)),
        f1: Number(pkgCoreF1.toFixed(4)),
        jaccard: Number(pkgCoreJaccard.toFixed(4))
      },
      dimensions: dimDetails
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  MADE: ${pkgMade.toFixed(3)} levels | SDB: ${pkgSdb > 0 ? '+' : ''}${pkgSdb.toFixed(3)} | Cosine Sim: ${pkgCosine.toFixed(4)} | Align Acc: ${pkgAlignmentAcc.toFixed(1)}% | Core F1: ${pkgCoreF1.toFixed(3)}`);
    console.log('  Dimension-by-Dimension Breakdown:');
    for (const dim of DIMENSIONS) {
      const d = dimDetails[dim];
      const matchSymbol = d.level_diff === 0 ? '==' : (d.abs_diff <= 1 ? '~=' : '!=');
      const alignSymbol = d.alignment_match ? '✓' : '✗';
      console.log(`    ${dim.padEnd(26)}: GT=${d.gt_level} Pred=${d.pred_level} (${matchSymbol}, diff=${d.level_diff > 0 ? '+' : ''}${d.level_diff}) | Align: ${d.pred_alignment.padEnd(12)} (GT: ${d.gt_alignment}) [${alignSymbol}]`);
    }
  }

  const overallMade = totalMadeSum / totalDimsEvaluated;
  const overallSdb = totalSdbSum / totalDimsEvaluated;
  const overallMeanCosine = totalCosineSimSum / packages.length;
  const overallAlignmentAcc = (totalAlignmentMatches / totalDimsEvaluated) * 100;

  const overallCorePrecision = (totalCoreTP + totalCoreFP > 0) ? (totalCoreTP / (totalCoreTP + totalCoreFP)) : 1.0;
  const overallCoreRecall = (totalCoreTP + totalCoreFN > 0) ? (totalCoreTP / (totalCoreTP + totalCoreFN)) : 1.0;
  const overallCoreF1 = (overallCorePrecision + overallCoreRecall > 0) ? (2 * overallCorePrecision * overallCoreRecall / (overallCorePrecision + overallCoreRecall)) : 0;
  const overallCoreJaccard = (totalCoreTP + totalCoreFP + totalCoreFN > 0) ? (totalCoreTP / (totalCoreTP + totalCoreFP + totalCoreFN)) : 1.0;

  console.log('\n' + '='.repeat(80));
  console.log('OVERALL RQ2 NORMATIVE PERFORMANCE SUMMARY (N = 6 packages, 48 dimensions)');
  console.log('='.repeat(80));
  console.log(`Overall Mean Absolute Depth Error (MADE): ${overallMade.toFixed(4)} depth levels`);
  console.log(`Overall Signed Depth Bias (SDB):          ${overallSdb > 0 ? '+' : ''}${overallSdb.toFixed(4)} depth levels`);
  console.log(`Mean Profile Cosine Similarity:           ${overallMeanCosine.toFixed(4)}`);
  console.log(`Exact Alignment Agreement:               ${overallAlignmentAcc.toFixed(2)}% (${totalAlignmentMatches}/${totalDimsEvaluated})`);
  console.log(`Core Scope Selection Precision:          ${(overallCorePrecision * 100).toFixed(2)}%`);
  console.log(`Core Scope Selection Recall:             ${(overallCoreRecall * 100).toFixed(2)}%`);
  console.log(`Core Scope Selection F1 Score:           ${overallCoreF1.toFixed(4)}`);
  console.log(`Core Scope Selection Jaccard Index:      ${overallCoreJaccard.toFixed(4)}`);

  // Targeted Objective-Conditioning Sensitivity Test (pkg_03 vs pkg_04)
  console.log('\n' + '='.repeat(80));
  console.log('CAUSAL ISOLATION SENSITIVITY TEST: BFS CONCEPTUAL (pkg_03) vs IMPLEMENTATION (pkg_04)');
  console.log('='.repeat(80));

  const p03 = predData.packages['pkg_03_dsa_bfs_conceptual'];
  const p04 = predData.packages['pkg_04_dsa_bfs_implementation'];

  const causalTest = {
    package_03_conceptual: {
      application_interpretation: p03.expected_dimensions.APPLICATION_INTERPRETATION,
      boundaries_exceptions: p03.expected_dimensions.BOUNDARIES_EXCEPTIONS
    },
    package_04_implementation: {
      application_interpretation: p04.expected_dimensions.APPLICATION_INTERPRETATION,
      boundaries_exceptions: p04.expected_dimensions.BOUNDARIES_EXCEPTIONS
    },
    shifts: {
      application_depth_shift: p04.expected_dimensions.APPLICATION_INTERPRETATION.level - p03.expected_dimensions.APPLICATION_INTERPRETATION.level,
      boundaries_depth_shift: p04.expected_dimensions.BOUNDARIES_EXCEPTIONS.level - p03.expected_dimensions.BOUNDARIES_EXCEPTIONS.level,
      application_alignment_shift: `${p03.expected_dimensions.APPLICATION_INTERPRETATION.alignment} -> ${p04.expected_dimensions.APPLICATION_INTERPRETATION.alignment}`,
      boundaries_alignment_shift: `${p03.expected_dimensions.BOUNDARIES_EXCEPTIONS.alignment} -> ${p04.expected_dimensions.BOUNDARIES_EXCEPTIONS.alignment}`
    }
  };

  console.log('APPLICATION_INTERPRETATION:');
  console.log(`  pkg_03 (Conceptual):     Level ${p03.expected_dimensions.APPLICATION_INTERPRETATION.level} [${p03.expected_dimensions.APPLICATION_INTERPRETATION.alignment}]`);
  console.log(`  pkg_04 (Implementation): Level ${p04.expected_dimensions.APPLICATION_INTERPRETATION.level} [${p04.expected_dimensions.APPLICATION_INTERPRETATION.alignment}]`);
  console.log(`  Shift:                   +${causalTest.shifts.application_depth_shift} levels (${causalTest.shifts.application_alignment_shift})`);

  console.log('\nBOUNDARIES_EXCEPTIONS:');
  console.log(`  pkg_03 (Conceptual):     Level ${p03.expected_dimensions.BOUNDARIES_EXCEPTIONS.level} [${p03.expected_dimensions.BOUNDARIES_EXCEPTIONS.alignment}]`);
  console.log(`  pkg_04 (Implementation): Level ${p04.expected_dimensions.BOUNDARIES_EXCEPTIONS.level} [${p04.expected_dimensions.BOUNDARIES_EXCEPTIONS.alignment}]`);
  console.log(`  Shift:                   +${causalTest.shifts.boundaries_depth_shift} levels (${causalTest.shifts.boundaries_alignment_shift})`);

  const evaluationSummary = {
    evaluation_timestamp: new Date().toISOString(),
    benchmark_corpus_size: packages.length,
    total_epistemic_dimensions: totalDimsEvaluated,
    overall_metrics: {
      made: Number(overallMade.toFixed(4)),
      sdb: Number(overallSdb.toFixed(4)),
      mean_cosine_similarity: Number(overallMeanCosine.toFixed(4)),
      alignment_accuracy_pct: Number(overallAlignmentAcc.toFixed(2)),
      core_scope_precision: Number(overallCorePrecision.toFixed(4)),
      core_scope_recall: Number(overallCoreRecall.toFixed(4)),
      core_scope_f1: Number(overallCoreF1.toFixed(4)),
      core_scope_jaccard: Number(overallCoreJaccard.toFixed(4))
    },
    causal_isolation_sensitivity: causalTest,
    packages: packageSummaries
  };

  fs.writeFileSync(evalOutputPath, JSON.stringify(evaluationSummary, null, 2), 'utf8');
  console.log(`\nEvaluation summary saved to: ${evalOutputPath}`);
  console.log('='.repeat(80));

  return evaluationSummary;
}

if (require.main === module) {
  evaluate();
}

module.exports = { evaluate };
