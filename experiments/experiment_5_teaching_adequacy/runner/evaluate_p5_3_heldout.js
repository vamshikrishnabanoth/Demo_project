/**
 * experiments/experiment_5_teaching_adequacy/runner/evaluate_p5_3_heldout.js
 *
 * Phase 5 Experiment 5: Held-Out P5.3 Diagnostic Evaluation
 * 
 * Evaluates the calibrated P5.3 diagnostic coverage matrix on the held-out benchmark
 * (pkg_07_os_deadlocks, pkg_08_biochem_kinetics, pkg_09_discrete_math_trees, pkg_10_microecon_game_theory)
 * against independently adjudicated human observational and normative ground truth:
 *   1. Per-Package integer confusion counts (TP, FP, FN, TN) and percentages
 *   2. Aggregate Actionable Gap Recall, Precision, and F1
 *   3. Permissible Scope Omission Specificity and True Negative Rate
 *   4. Observed Depth Estimation Error (MADE and SDB)
 *   5. Verification against the Single Primary Acceptance Gate:
 *      - Actionable Gap Recall >= 80.0%
 *      - Actionable Gap Precision >= 50.0%
 *      - Permissible Scope Omission Specificity >= 85.0%
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');

const gtObservationalPath = path.join(exp5Dir, 'ground_truth/observational/observational_reference_evidence_heldout.json');
const predPath = path.join(exp5Dir, 'raw_results/heldout/p5_3_diagnostic_matrix_heldout.json');
const evalOutputPath = path.join(exp5Dir, 'raw_results/heldout/p5_3_evaluation_summary_heldout.json');

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

function evaluate() {
  if (!fs.existsSync(gtObservationalPath)) {
    throw new Error(`Observational ground truth file not found: ${gtObservationalPath}`);
  }
  if (!fs.existsSync(predPath)) {
    throw new Error(`Predictions file not found: ${predPath}`);
  }

  const gtObsData = JSON.parse(fs.readFileSync(gtObservationalPath, 'utf8'));
  const predData = JSON.parse(fs.readFileSync(predPath, 'utf8'));

  const packages = Object.keys(gtObsData.packages).sort();
  console.log('='.repeat(80));
  console.log('PHASE 5: HELDOUT P5.3 EVALUATION (STEP 1 ONLY — UNSEEN BENCHMARK)');
  console.log('='.repeat(80));
  console.log(`Observational GT: ${gtObservationalPath}`);
  console.log(`Predictions:      ${predPath}`);
  console.log(`Packages:         ${packages.length} (${packages.join(', ')})`);
  console.log('-'.repeat(80));

  const packageSummaries = {};

  let totalDimsEvaluated = 0;
  let totalStatusMatches = 0;
  let totalObsMadeSum = 0;
  let totalObsSdbSum = 0;

  // Aggregate confusion stats for Actionable Gaps
  let gapTP = 0, gapFP = 0, gapFN = 0, gapTN = 0;

  // Aggregate confusion stats for Permissible Omissions
  let permTP = 0, permFP = 0, permFN = 0, permTN = 0;

  // Aggregate confusion stats for Covered / Partial
  let covTP = 0, covFP = 0, covFN = 0, covTN = 0;

  for (const pkgId of packages) {
    const pkgGTObs = gtObsData.packages[pkgId];
    const pkgPred = predData.packages[pkgId];

    if (!pkgPred) {
      console.error(`Missing prediction for package: ${pkgId}`);
      continue;
    }

    const gtMatrix = pkgGTObs.diagnostic_coverage_matrix;
    const predMatrix = pkgPred.diagnostic_matrix;
    const gtObsDims = pkgGTObs.observed_dimensions;

    let pkgStatusMatches = 0;
    let pkgObsAbsErr = 0;
    let pkgObsSignedErr = 0;

    let pkgGapTP = 0, pkgGapFP = 0, pkgGapFN = 0, pkgGapTN = 0;
    let pkgPermTP = 0, pkgPermFP = 0, pkgPermFN = 0, pkgPermTN = 0;

    const dimDetails = {};

    for (const dim of DIMENSIONS) {
      const gtEntry = gtMatrix[dim];
      const predEntry = predMatrix[dim];
      const gtObsDim = gtObsDims[dim];

      const gtObsLevel = gtObsDim ? gtObsDim.level : 0;
      const predObsLevel = predEntry ? predEntry.observed_depth : 0;

      const absErr = Math.abs(predObsLevel - gtObsLevel);
      const signedErr = predObsLevel - gtObsLevel;

      pkgObsAbsErr += absErr;
      pkgObsSignedErr += signedErr;

      const gtStatus = gtEntry ? gtEntry.status : 'NOT_OBSERVED';
      const predStatus = predEntry ? predEntry.status : 'NOT_OBSERVED';

      const statusMatch = (gtStatus === predStatus);
      if (statusMatch) {
        pkgStatusMatches++;
        totalStatusMatches++;
      }

      // Actionable Gap classification
      const gtIsGap = (gtStatus === 'ACTIONABLE_COVERAGE_GAP');
      const predIsGap = (predStatus === 'ACTIONABLE_COVERAGE_GAP');
      if (predIsGap && gtIsGap) { gapTP++; pkgGapTP++; }
      else if (predIsGap && !gtIsGap) { gapFP++; pkgGapFP++; }
      else if (!predIsGap && gtIsGap) { gapFN++; pkgGapFN++; }
      else { gapTN++; pkgGapTN++; }

      // Permissible Omission classification
      const gtIsPerm = (gtStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      const predIsPerm = (predStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      if (predIsPerm && gtIsPerm) { permTP++; pkgPermTP++; }
      else if (predIsPerm && !gtIsPerm) { permFP++; pkgPermFP++; }
      else if (!predIsPerm && gtIsPerm) { permFN++; pkgPermFN++; }
      else { permTN++; pkgPermTN++; }

      // Covered classification
      const gtIsCov = (gtStatus === 'COVERED');
      const predIsCov = (predStatus === 'COVERED');
      if (predIsCov && gtIsCov) covTP++;
      else if (predIsCov && !gtIsCov) covFP++;
      else if (!predIsCov && gtIsCov) covFN++;
      else covTN++;

      dimDetails[dim] = {
        expected_depth: predEntry ? predEntry.expected_depth : 0,
        alignment_tier: predEntry ? predEntry.alignment_tier : 'REQUIRED',
        gt_observed_depth: gtObsLevel,
        pred_observed_depth: predObsLevel,
        depth_diff: signedErr,
        gt_status: gtStatus,
        pred_status: predStatus,
        status_match: statusMatch,
        evidence_synthesis: predEntry ? predEntry.evidence_synthesis : ''
      };
    }

    const pkgMade = pkgObsAbsErr / DIMENSIONS.length;
    const pkgSdb = pkgObsSignedErr / DIMENSIONS.length;
    const pkgStatusAcc = (pkgStatusMatches / DIMENSIONS.length) * 100;

    totalDimsEvaluated += DIMENSIONS.length;
    totalObsMadeSum += pkgObsAbsErr;
    totalObsSdbSum += pkgObsSignedErr;

    const pkgGapPrec = (pkgGapTP + pkgGapFP > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFP)) * 100 : null;
    const pkgGapRec = (pkgGapTP + pkgGapFN > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFN)) * 100 : 100.0;
    const pkgPermSpec = (pkgPermTN + pkgPermFP > 0) ? (pkgPermTN / (pkgPermTN + pkgPermFP)) * 100 : 100.0;

    packageSummaries[pkgId] = {
      package_id: pkgId,
      observed_depth_made: Number(pkgMade.toFixed(4)),
      observed_depth_sdb: Number(pkgSdb.toFixed(4)),
      status_agreement_pct: Number(pkgStatusAcc.toFixed(2)),
      actionable_gaps: {
        tp: pkgGapTP,
        fp: pkgGapFP,
        fn: pkgGapFN,
        tn: pkgGapTN,
        precision_pct: pkgGapPrec !== null ? Number(pkgGapPrec.toFixed(1)) : "N/A",
        recall_pct: Number(pkgGapRec.toFixed(1)),
        predicted_count: pkgPred.actionable_gaps ? pkgPred.actionable_gaps.length : 0,
        gt_count: pkgGTObs.actionable_gaps ? pkgGTObs.actionable_gaps.length : 0
      },
      permissible_omissions: {
        tp: pkgPermTP,
        fp: pkgPermFP,
        fn: pkgPermFN,
        tn: pkgPermTN,
        specificity_pct: Number(pkgPermSpec.toFixed(1)),
        predicted_count: pkgPred.permissible_omissions ? pkgPred.permissible_omissions.length : 0,
        gt_count: pkgGTObs.permissible_omissions ? pkgGTObs.permissible_omissions.length : 0
      },
      dimensions: dimDetails
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  Observed MADE: ${pkgMade.toFixed(3)} levels | SDB: ${pkgSdb > 0 ? '+' : ''}${pkgSdb.toFixed(3)} | Status Agreement: ${pkgStatusAcc.toFixed(1)}% (${pkgStatusMatches}/8)`);
    console.log(`  Actionable Gaps: TP=${pkgGapTP}, FP=${pkgGapFP}, FN=${pkgGapFN}, TN=${pkgGapTN} | Prec: ${pkgGapPrec !== null ? pkgGapPrec.toFixed(1) + '%' : 'N/A'}, Rec: ${pkgGapRec.toFixed(1)}%`);
    console.log(`  Permissible Omissions: TP=${pkgPermTP}, FP=${pkgPermFP}, FN=${pkgPermFN}, TN=${pkgPermTN} | Spec: ${pkgPermSpec.toFixed(1)}%`);
    for (const dim of DIMENSIONS) {
      const d = dimDetails[dim];
      const matchSymbol = d.status_match ? '✓' : '✗';
      console.log(`    ${dim.padEnd(26)}: Pred: ${d.pred_status.padEnd(24)} (GT: ${d.gt_status}) [${matchSymbol}] | ObsDepth: ${d.pred_observed_depth} (GT: ${d.gt_observed_depth})`);
    }
  }

  const overallMade = totalObsMadeSum / totalDimsEvaluated;
  const overallSdb = totalObsSdbSum / totalDimsEvaluated;
  const overallStatusAcc = (totalStatusMatches / totalDimsEvaluated) * 100;

  // Actionable Gap metrics
  const gapPrec = (gapTP + gapFP > 0) ? (gapTP / (gapTP + gapFP)) * 100 : 100.0;
  const gapRec = (gapTP + gapFN > 0) ? (gapTP / (gapTP + gapFN)) * 100 : 100.0;
  const gapF1 = (gapPrec + gapRec > 0) ? (2 * gapPrec * gapRec / (gapPrec + gapRec)) : 0;

  // Permissible Omission metrics
  const permPrec = (permTP + permFP > 0) ? (permTP / (permTP + permFP)) * 100 : 100.0;
  const permRec = (permTP + permFN > 0) ? (permTP / (permTP + permFN)) * 100 : 100.0;
  const permF1 = (permPrec + permRec > 0) ? (2 * permPrec * permRec / (permPrec + permRec)) : 0;
  const permSpec = (permTN + permFP > 0) ? (permTN / (permTN + permFP)) * 100 : 100.0;

  // Primary Acceptance Gate Evaluation
  const recallPass = (gapRec >= 80.0);
  const precisionPass = (gapPrec >= 50.0);
  const specificityPass = (permSpec >= 85.0);
  const gatePassed = (recallPass && precisionPass && specificityPass);

  // Secondary exploratory target
  const secondaryPass = (gapPrec > 60.0 && gapRec > 85.0);

  console.log('\n' + '='.repeat(80));
  console.log('AGGREGATE HELDOUT EVALUATION RESULTS (N = 4 PACKAGES, 32 DIMENSIONS)');
  console.log('='.repeat(80));
  console.log(`Overall Observed Depth MADE:    ${overallMade.toFixed(3)} depth levels`);
  console.log(`Overall Signed Depth Bias (SDB): ${overallSdb > 0 ? '+' : ''}${overallSdb.toFixed(3)} depth levels`);
  console.log(`Exact Status Concordance:        ${overallStatusAcc.toFixed(2)}% (${totalStatusMatches}/${totalDimsEvaluated})`);
  console.log('-'.repeat(80));
  console.log('ACTIONABLE COVERAGE GAPS:');
  console.log(`  Raw Counts:  TP=${gapTP}, FP=${gapFP}, FN=${gapFN}, TN=${gapTN}`);
  console.log(`  Precision:   ${gapPrec.toFixed(2)}%`);
  console.log(`  Recall:      ${gapRec.toFixed(2)}%`);
  console.log(`  F1-Score:    ${gapF1.toFixed(2)}%`);
  console.log('-'.repeat(80));
  console.log('PERMISSIBLE SCOPE OMISSIONS:');
  console.log(`  Raw Counts:  TP=${permTP}, FP=${permFP}, FN=${permFN}, TN=${permTN}`);
  console.log(`  Specificity: ${permSpec.toFixed(2)}%`);
  console.log(`  Precision:   ${permPrec.toFixed(2)}%`);
  console.log(`  Recall:      ${permRec.toFixed(2)}%`);
  console.log(`  F1-Score:    ${permF1.toFixed(2)}%`);
  console.log('-'.repeat(80));
  console.log('SINGLE PRIMARY ACCEPTANCE GATE VERIFICATION:');
  console.log(`  1. Actionable Gap Recall >= 80.0%:               ${gapRec.toFixed(2)}% [${recallPass ? 'PASSED ✓' : 'FAILED ✗'}]`);
  console.log(`  2. Actionable Gap Precision >= 50.0%:            ${gapPrec.toFixed(2)}% [${precisionPass ? 'PASSED ✓' : 'FAILED ✗'}]`);
  console.log(`  3. Permissible Scope Omission Spec >= 85.0%:     ${permSpec.toFixed(2)}% [${specificityPass ? 'PASSED ✓' : 'FAILED ✗'}]`);
  console.log(`  OVERALL PRIMARY ACCEPTANCE GATE:                 ${gatePassed ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`  SECONDARY EXPLORATORY TARGET (Prec>60, Rec>85):  ${secondaryPass ? 'MET ✓' : 'NOT MET (Exploratory)'}`);
  console.log('='.repeat(80));

  const evaluationReport = {
    evaluation_timestamp: new Date().toISOString(),
    benchmark_scope: 'Curated Controlled Held-Out Benchmark (4 packages, 32 dimensions)',
    model: predData.packages[packages[0]] ? predData.packages[packages[0]].execution_stats.model : 'unknown',
    summary_metrics: {
      total_dimensions_evaluated: totalDimsEvaluated,
      status_concordance_pct: Number(overallStatusAcc.toFixed(2)),
      observed_depth_made: Number(overallMade.toFixed(4)),
      observed_depth_sdb: Number(overallSdb.toFixed(4)),
      actionable_gaps: {
        tp: gapTP,
        fp: gapFP,
        fn: gapFN,
        tn: gapTN,
        precision_pct: Number(gapPrec.toFixed(2)),
        recall_pct: Number(gapRec.toFixed(2)),
        f1_pct: Number(gapF1.toFixed(2))
      },
      permissible_scope_omissions: {
        tp: permTP,
        fp: permFP,
        fn: permFN,
        tn: permTN,
        specificity_pct: Number(permSpec.toFixed(2)),
        precision_pct: Number(permPrec.toFixed(2)),
        recall_pct: Number(permRec.toFixed(2)),
        f1_pct: Number(permF1.toFixed(2))
      },
      primary_acceptance_gate: {
        recall_threshold_pct: 80.0,
        recall_achieved_pct: Number(gapRec.toFixed(2)),
        recall_passed: recallPass,
        precision_threshold_pct: 50.0,
        precision_achieved_pct: Number(gapPrec.toFixed(2)),
        precision_passed: precisionPass,
        specificity_threshold_pct: 85.0,
        specificity_achieved_pct: Number(permSpec.toFixed(2)),
        specificity_passed: specificityPass,
        gate_passed: gatePassed
      },
      secondary_exploratory_target: {
        target: 'Precision > 60.0%, Recall > 85.0%',
        met: secondaryPass
      }
    },
    packages: packageSummaries
  };

  fs.writeFileSync(evalOutputPath, JSON.stringify(evaluationReport, null, 2));
  console.log(`\nEvaluation summary saved to: ${evalOutputPath}`);
}

evaluate();
