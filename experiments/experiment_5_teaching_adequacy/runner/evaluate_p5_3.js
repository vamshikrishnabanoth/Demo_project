/**
 * experiments/experiment_5_teaching_adequacy/runner/evaluate_p5_3.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Evaluation of Component P5.3 (Teaching Adequacy & Coverage Gap Analyzer / RQ3)
 *
 * Evaluates diagnostic coverage matrices against the independently adjudicated
 * human observational and normative ground truth:
 *   1. Coverage Status Concordance (COVERED, PARTIAL, ACTIONABLE_GAP, PERMISSIBLE_OMISSION)
 *   2. Actionable Gap Identification Precision, Recall, and F1
 *   3. Permissible Scope Omission Specificity and True Negative Rate
 *   4. Observed Depth Estimation Error (MADE and SDB)
 *   5. Causal Isolation Sensitivity on Paired BFS Packages (pkg_03 vs pkg_04)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');

const gtObservationalPath = path.join(exp5Dir, 'ground_truth/observational/observational_reference_evidence.json');
const predPath = path.join(exp5Dir, 'raw_results/p5_3_diagnostic_matrix.json');
const evalOutputPath = path.join(exp5Dir, 'raw_results/p5_3_evaluation_summary.json');

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
  console.log('PHASE 5: COMPONENT P5.3 EVALUATION (RQ3 — TEACHING ADEQUACY & GAPS)');
  console.log('='.repeat(80));
  console.log(`Observational GT: ${gtObservationalPath}`);
  console.log(`Predictions:      ${predPath}`);
  console.log(`Packages:         ${packages.length}`);
  console.log('-'.repeat(80));

  const packageSummaries = {};

  let totalDimsEvaluated = 0;
  let totalStatusMatches = 0;
  let totalObsMadeSum = 0;
  let totalObsSdbSum = 0;

  // Confusion stats for Actionable Gaps
  let gapTP = 0, gapFP = 0, gapFN = 0, gapTN = 0;

  // Confusion stats for Permissible Omissions
  let permTP = 0, permFP = 0, permFN = 0, permTN = 0;

  // Confusion stats for Covered / Partial
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
      if (predIsGap && gtIsGap) gapTP++;
      else if (predIsGap && !gtIsGap) gapFP++;
      else if (!predIsGap && gtIsGap) gapFN++;
      else gapTN++;

      // Permissible Omission classification
      const gtIsPerm = (gtStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      const predIsPerm = (predStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      if (predIsPerm && gtIsPerm) permTP++;
      else if (predIsPerm && !gtIsPerm) permFP++;
      else if (!predIsPerm && gtIsPerm) permFN++;
      else permTN++;

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

    packageSummaries[pkgId] = {
      package_id: pkgId,
      observed_depth_made: Number(pkgMade.toFixed(4)),
      observed_depth_sdb: Number(pkgSdb.toFixed(4)),
      status_agreement_pct: Number(pkgStatusAcc.toFixed(2)),
      actionable_gaps_predicted: pkgPred.actionable_gaps.length,
      actionable_gaps_gt: pkgGTObs.actionable_gaps.length,
      permissible_omissions_predicted: pkgPred.permissible_omissions.length,
      permissible_omissions_gt: pkgGTObs.permissible_omissions.length,
      dimensions: dimDetails
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  Observed MADE: ${pkgMade.toFixed(3)} levels | SDB: ${pkgSdb > 0 ? '+' : ''}${pkgSdb.toFixed(3)} | Status Agreement: ${pkgStatusAcc.toFixed(1)}% (${pkgStatusMatches}/8)`);
    console.log(`  Actionable Gaps: Pred = ${pkgPred.actionable_gaps.length}, GT = ${pkgGTObs.actionable_gaps.length}`);
    console.log(`  Permissible Omissions: Pred = ${pkgPred.permissible_omissions.length}, GT = ${pkgGTObs.permissible_omissions.length}`);
    for (const dim of DIMENSIONS) {
      const d = dimDetails[dim];
      const matchSymbol = d.status_match ? '✓' : '✗';
      console.log(`    ${dim.padEnd(26)}: Pred Status: ${d.pred_status.padEnd(24)} (GT: ${d.gt_status}) [${matchSymbol}] | ObsDepth: ${d.pred_observed_depth} (GT: ${d.gt_observed_depth})`);
    }
  }

  const overallMade = totalObsMadeSum / totalDimsEvaluated;
  const overallSdb = totalObsSdbSum / totalDimsEvaluated;
  const overallStatusAcc = (totalStatusMatches / totalDimsEvaluated) * 100;

  // Actionable Gap metrics
  const gapPrec = (gapTP + gapFP > 0) ? (gapTP / (gapTP + gapFP)) : 1.0;
  const gapRec = (gapTP + gapFN > 0) ? (gapTP / (gapTP + gapFN)) : 1.0;
  const gapF1 = (gapPrec + gapRec > 0) ? (2 * gapPrec * gapRec / (gapPrec + gapRec)) : 0;

  // Permissible Omission metrics
  const permPrec = (permTP + permFP > 0) ? (permTP / (permTP + permFP)) : 1.0;
  const permRec = (permTP + permFN > 0) ? (permTP / (permTP + permFN)) : 1.0;
  const permF1 = (permPrec + permRec > 0) ? (2 * permPrec * permRec / (permPrec + permRec)) : 0;
  const permSpec = (permTN + permFP > 0) ? (permTN / (permTN + permFP)) : 1.0;

  console.log('\n' + '='.repeat(80));
  console.log('OVERALL RQ3 TEACHING ADEQUACY PERFORMANCE SUMMARY (N = 6 packages, 48 dimensions)');
  console.log('='.repeat(80));
  console.log(`Overall Observed Depth MADE:             ${overallMade.toFixed(4)} depth levels`);
  console.log(`Overall Observed Depth SDB:              ${overallSdb > 0 ? '+' : ''}${overallSdb.toFixed(4)} depth levels`);
  console.log(`Exact Diagnostic Status Agreement:       ${overallStatusAcc.toFixed(2)}% (${totalStatusMatches}/${totalDimsEvaluated})`);
  console.log(`Actionable Gap Detection:`);
  console.log(`  TP = ${gapTP}, FP = ${gapFP}, FN = ${gapFN}, TN = ${gapTN}`);
  console.log(`  Precision: ${(gapPrec * 100).toFixed(2)}% | Recall: ${(gapRec * 100).toFixed(2)}% | F1 Score: ${gapF1.toFixed(4)}`);
  console.log(`Permissible Scope Omission Detection:`);
  console.log(`  TP = ${permTP}, FP = ${permFP}, FN = ${permFN}, TN = ${permTN}`);
  console.log(`  Precision: ${(permPrec * 100).toFixed(2)}% | Recall: ${(permRec * 100).toFixed(2)}% | F1: ${permF1.toFixed(4)} | Specificity: ${(permSpec * 100).toFixed(2)}%`);

  // Targeted Causal Sensitivity Validation: pkg_03 vs pkg_04
  console.log('\n' + '='.repeat(80));
  console.log('CAUSAL ISOLATION SENSITIVITY TEST: BFS CONCEPTUAL (pkg_03) vs IMPLEMENTATION (pkg_04)');
  console.log('='.repeat(80));

  const p03 = predData.packages['pkg_03_dsa_bfs_conceptual'];
  const p04 = predData.packages['pkg_04_dsa_bfs_implementation'];

  console.log(`pkg_03 (Conceptual Objective):`);
  console.log(`  Actionable Gaps Count: ${p03.actionable_gaps.length}`);
  console.log(`  APPLICATION_INTERPRETATION: Status = ${p03.diagnostic_matrix.APPLICATION_INTERPRETATION.status} (Exp: ${p03.diagnostic_matrix.APPLICATION_INTERPRETATION.expected_depth}, Obs: ${p03.diagnostic_matrix.APPLICATION_INTERPRETATION.observed_depth})`);
  console.log(`  BOUNDARIES_EXCEPTIONS:      Status = ${p03.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.status} (Exp: ${p03.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.expected_depth}, Obs: ${p03.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.observed_depth})`);

  console.log(`\npkg_04 (Implementation Objective):`);
  console.log(`  Actionable Gaps Count: ${p04.actionable_gaps.length}`);
  console.log(`  APPLICATION_INTERPRETATION: Status = ${p04.diagnostic_matrix.APPLICATION_INTERPRETATION.status} (Exp: ${p04.diagnostic_matrix.APPLICATION_INTERPRETATION.expected_depth}, Obs: ${p04.diagnostic_matrix.APPLICATION_INTERPRETATION.observed_depth})`);
  console.log(`  BOUNDARIES_EXCEPTIONS:      Status = ${p04.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.status} (Exp: ${p04.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.expected_depth}, Obs: ${p04.diagnostic_matrix.BOUNDARIES_EXCEPTIONS.observed_depth})`);

  const evaluationSummary = {
    evaluation_timestamp: new Date().toISOString(),
    benchmark_corpus_size: packages.length,
    total_dimensions_evaluated: totalDimsEvaluated,
    overall_metrics: {
      observed_depth_made: Number(overallMade.toFixed(4)),
      observed_depth_sdb: Number(overallSdb.toFixed(4)),
      exact_status_agreement_pct: Number(overallStatusAcc.toFixed(2)),
      actionable_gap_metrics: {
        tp: gapTP, fp: gapFP, fn: gapFN, tn: gapTN,
        precision: Number(gapPrec.toFixed(4)),
        recall: Number(gapRec.toFixed(4)),
        f1: Number(gapF1.toFixed(4))
      },
      permissible_omission_metrics: {
        tp: permTP, fp: permFP, fn: permFN, tn: permTN,
        precision: Number(permPrec.toFixed(4)),
        recall: Number(permRec.toFixed(4)),
        f1: Number(permF1.toFixed(4)),
        specificity: Number(permSpec.toFixed(4))
      }
    },
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
