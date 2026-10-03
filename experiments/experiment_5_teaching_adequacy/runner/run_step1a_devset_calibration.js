/**
 * experiments/experiment_5_teaching_adequacy/runner/run_step1a_devset_calibration.js
 *
 * Step 1A.2: P5.3 Diagnostic Reasoning Calibration Runner
 *
 * Executes the calibrated P5.3 diagnostic analyzer across the 6 development packages
 * (pkg_01 through pkg_06) and evaluates performance against adjudicated development ground truth:
 *   1. Measures structural completeness and 3-way retry outcomes.
 *   2. Evaluates core REQUIRED actionable gaps (TP, FP, FN, TN, Precision, Recall, F1).
 *   3. Evaluates permissible scope omissions (Specificity).
 *   4. Reports SECONDARY_ADVISORY_GAP independently without contaminating core metrics.
 *   5. Computes observed depth estimation error (MADE, SDB).
 *   6. Documents dimension-level resolved and unresolved disagreements.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');

const {
  analyzeCoverageForPackage,
  EXPECTED_DIMENSIONS
} = require('./p5_3_coverage_gap_analyzer');

const DEV_PACKAGES = [
  'pkg_01_indian_constitution_art21',
  'pkg_02_linear_algebra_eigenvalues',
  'pkg_03_dsa_bfs_conceptual',
  'pkg_04_dsa_bfs_implementation',
  'pkg_05_deep_learning_vaes',
  'pkg_06_economics_elasticity'
];

const p51File = path.join(exp5Dir, 'raw_results/p5_1_profiles.json');
const p52aFile = path.join(exp5Dir, 'raw_results/p5_2a_concepts.json');
const p52bFile = path.join(exp5Dir, 'raw_results/p5_2b_episodes.json');

const gtNormFile = path.join(exp5Dir, 'ground_truth/normative/normative_reference_profiles.json');
const gtObsFile = path.join(exp5Dir, 'ground_truth/observational/observational_reference_evidence.json');

const devsetOutDir = path.join(exp5Dir, 'raw_results/devset_v3_6');
fs.mkdirSync(devsetOutDir, { recursive: true });

const devsetPredFile = path.join(devsetOutDir, 'p5_3_diagnostic_matrix_revised.json');
const devsetEvalFile = path.join(devsetOutDir, 'p5_3_evaluation_summary_revised.json');

async function main() {
  console.log('='.repeat(80));
  console.log('STEP 1A.2: P5.3 DIAGNOSTIC REASONING CALIBRATION (DEVELOPMENT SET ONLY)');
  console.log('Target Packages: pkg_01 through pkg_06 (48 epistemic dimensions)');
  console.log('='.repeat(80));

  if (!fs.existsSync(p51File) || !fs.existsSync(p52aFile) || !fs.existsSync(p52bFile)) {
    throw new Error('Prerequisite dev-set files missing in raw_results.');
  }
  if (!fs.existsSync(gtNormFile) || !fs.existsSync(gtObsFile)) {
    throw new Error('Development ground truth files missing in ground_truth.');
  }

  const p51Data = JSON.parse(fs.readFileSync(p51File, 'utf8'));
  const p52aData = JSON.parse(fs.readFileSync(p52aFile, 'utf8'));
  const p52bData = JSON.parse(fs.readFileSync(p52bFile, 'utf8'));

  const gtNormData = JSON.parse(fs.readFileSync(gtNormFile, 'utf8'));
  const gtObsData = JSON.parse(fs.readFileSync(gtObsFile, 'utf8'));

  let predictions = {
    calibration_timestamp: new Date().toISOString(),
    benchmark_scope: 'Development Set Calibration (pkg_01 to pkg_06)',
    packages: {}
  };

  if (fs.existsSync(devsetPredFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(devsetPredFile, 'utf8'));
      if (existing.packages) {
        predictions.packages = existing.packages;
        console.log(`Loaded ${Object.keys(predictions.packages).length} cached dev packages from ${devsetPredFile}`);
      }
    } catch (e) {
      // fresh
    }
  }

  // 1. Run Diagnostic Analysis for dev packages
  for (const pkgId of DEV_PACKAGES) {
    if (predictions.packages[pkgId] && predictions.packages[pkgId].diagnostic_matrix) {
      console.log(`\n[DEV CACHE] ${pkgId} already generated. Using cached result.`);
      continue;
    }

    console.log(`\n[P5.3 ANALYZING] ${pkgId}...`);
    const p51Pkg = p51Data.packages[pkgId];
    const p52aPkg = p52aData.packages[pkgId];
    const p52bPkg = p52bData.packages[pkgId];

    const result = await analyzeCoverageForPackage(pkgId, p51Pkg, p52aPkg, p52bPkg);
    predictions.packages[pkgId] = result;

    console.log(`  ✓ Done in ${result.execution_stats.latency_ms} ms (${result.execution_stats.response_reliability})`);
    console.log(`    Actionable Gaps: ${result.actionable_gaps.length} | Advisory Gaps: ${result.secondary_advisory_gaps ? result.secondary_advisory_gaps.length : 0} | Permissible: ${result.permissible_omissions.length}`);

    fs.writeFileSync(devsetPredFile, JSON.stringify(predictions, null, 2), 'utf8');
  }

  fs.writeFileSync(devsetPredFile, JSON.stringify(predictions, null, 2), 'utf8');
  console.log(`\nAll 6 dev packages analyzed. Diagnostic matrices saved to ${devsetPredFile}`);

  // 2. Perform Detailed Evaluation against Development Ground Truth
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION AGAINST ADJUDICATED DEVELOPMENT GROUND TRUTH');
  console.log('='.repeat(80));

  const packageSummaries = {};
  let totalDimensions = 0;
  let totalValidDimensions = 0;
  let totalStructuralIncompletes = 0;

  let totalObsMadeSum = 0;
  let totalObsSdbSum = 0;
  let totalStatusMatches = 0;

  // Aggregate Core Actionable Gaps (REQUIRED tier only)
  let gapTP = 0, gapFP = 0, gapFN = 0, gapTN = 0;

  // Aggregate Permissible Scope Omissions
  let permTP = 0, permFP = 0, permFN = 0, permTN = 0;

  // Secondary Advisory Gaps
  let totalAdvisoryPredicted = 0;
  const advisoryGapsList = [];

  // Reliability distribution
  const reliabilityCounts = {
    valid_first_response: 0,
    valid_after_retry: 0,
    incomplete_after_retry: 0
  };

  const dimensionDisagreements = [];

  for (const pkgId of DEV_PACKAGES) {
    const predPkg = predictions.packages[pkgId];
    const gtObsPkg = gtObsData.packages[pkgId];
    const gtNormPkg = gtNormData.packages[pkgId];

    const rel = predPkg.execution_stats.response_reliability || 'valid_first_response';
    reliabilityCounts[rel] = (reliabilityCounts[rel] || 0) + 1;

    let pkgValidDims = 0;
    let pkgStructInc = 0;
    let pkgObsAbsErr = 0;
    let pkgObsSignedErr = 0;
    let pkgStatusMatches = 0;

    let pkgGapTP = 0, pkgGapFP = 0, pkgGapFN = 0, pkgGapTN = 0;
    let pkgPermTP = 0, pkgPermFP = 0, pkgPermFN = 0, pkgPermTN = 0;
    let pkgAdvisoryCount = 0;

    const dimDetails = {};

    for (const dim of EXPECTED_DIMENSIONS) {
      totalDimensions++;
      const predEntry = predPkg.diagnostic_matrix[dim];
      const gtMatrixEntry = gtObsPkg.diagnostic_coverage_matrix[dim];
      const gtObsDim = gtObsPkg.observed_dimensions[dim];
      const gtNormDim = gtNormPkg.expected_dimensions[dim];

      const gtStatus = gtMatrixEntry ? gtMatrixEntry.status : 'NOT_OBSERVED';
      const predStatus = predEntry ? predEntry.status : 'NOT_OBSERVED';

      // Check structural incompleteness
      if (predStatus === 'STRUCTURAL_OUTPUT_INCOMPLETE' || (predEntry && predEntry.observed_depth === null)) {
        pkgStructInc++;
        totalStructuralIncompletes++;
        dimDetails[dim] = {
          status: 'STRUCTURAL_OUTPUT_INCOMPLETE',
          evaluated_in_pedagogical_metrics: false
        };
        continue;
      }

      pkgValidDims++;
      totalValidDimensions++;

      const gtObsLevel = gtObsDim ? gtObsDim.level : 0;
      const predObsLevel = predEntry.observed_depth !== null ? predEntry.observed_depth : 0;

      const absErr = Math.abs(predObsLevel - gtObsLevel);
      const signedErr = predObsLevel - gtObsLevel;

      pkgObsAbsErr += absErr;
      pkgObsSignedErr += signedErr;
      totalObsMadeSum += absErr;
      totalObsSdbSum += signedErr;

      const statusMatch = (predStatus === gtStatus);
      if (statusMatch) {
        pkgStatusMatches++;
        totalStatusMatches++;
      } else {
        dimensionDisagreements.push({
          package_id: pkgId,
          dimension: dim,
          expected_depth: predEntry.expected_depth,
          alignment_tier: predEntry.alignment_tier,
          pred_observed_depth: predObsLevel,
          gt_observed_depth: gtObsLevel,
          pred_status: predStatus,
          gt_status: gtStatus,
          evidence_synthesis: predEntry.evidence_synthesis
        });
      }

      // Core Actionable Gaps (REQUIRED tier only)
      const gtIsGap = (gtStatus === 'ACTIONABLE_COVERAGE_GAP');
      const predIsGap = (predStatus === 'ACTIONABLE_COVERAGE_GAP');

      if (predIsGap && gtIsGap) { gapTP++; pkgGapTP++; }
      else if (predIsGap && !gtIsGap) { gapFP++; pkgGapFP++; }
      else if (!predIsGap && gtIsGap) { gapFN++; pkgGapFN++; }
      else { gapTN++; pkgGapTN++; }

      // Permissible Scope Omissions
      const gtIsPerm = (gtStatus === 'PERMISSIBLE_SCOPE_OMISSION');
      const predIsPerm = (predStatus === 'PERMISSIBLE_SCOPE_OMISSION');

      if (predIsPerm && gtIsPerm) { permTP++; pkgPermTP++; }
      else if (predIsPerm && !gtIsPerm) { permFP++; pkgPermFP++; }
      else if (!predIsPerm && gtIsPerm) { permFN++; pkgPermFN++; }
      else { permTN++; pkgPermTN++; }

      // Secondary Advisory Gaps (RECOMMENDED tier)
      if (predStatus === 'SECONDARY_ADVISORY_GAP') {
        pkgAdvisoryCount++;
        totalAdvisoryPredicted++;
        advisoryGapsList.push({
          package_id: pkgId,
          dimension: dim,
          expected_depth: predEntry.expected_depth,
          observed_depth: predObsLevel,
          evidence: predEntry.evidence_synthesis
        });
      }

      dimDetails[dim] = {
        expected_depth: predEntry.expected_depth,
        alignment_tier: predEntry.alignment_tier,
        gt_observed_depth: gtObsLevel,
        pred_observed_depth: predObsLevel,
        depth_diff: signedErr,
        gt_status: gtStatus,
        pred_status: predStatus,
        status_match: statusMatch,
        evidence_synthesis: predEntry.evidence_synthesis
      };
    }

    const pkgMade = pkgValidDims > 0 ? (pkgObsAbsErr / pkgValidDims) : 0;
    const pkgSdb = pkgValidDims > 0 ? (pkgObsSignedErr / pkgValidDims) : 0;
    const pkgConcordance = pkgValidDims > 0 ? (pkgStatusMatches / pkgValidDims) * 100 : 0;

    const pkgPrec = (pkgGapTP + pkgGapFP > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFP)) * 100 : null;
    const pkgRec = (pkgGapTP + pkgGapFN > 0) ? (pkgGapTP / (pkgGapTP + pkgGapFN)) * 100 : null;
    const pkgGapSpec = (pkgGapTN + pkgGapFP > 0) ? (pkgGapTN / (pkgGapTN + pkgGapFP)) * 100 : 100.0;
    const pkgPermSpec = (pkgPermTN + pkgPermFP > 0) ? (pkgPermTN / (pkgPermTN + pkgPermFP)) * 100 : 100.0;

    packageSummaries[pkgId] = {
      package_id: pkgId,
      reliability: rel,
      total_dimensions: 8,
      valid_dimensions: pkgValidDims,
      structural_incompletes: pkgStructInc,
      observed_depth_made: Number(pkgMade.toFixed(4)),
      observed_depth_sdb: Number(pkgSdb.toFixed(4)),
      status_concordance_pct: Number(pkgConcordance.toFixed(2)),
      actionable_gaps: {
        tp: pkgGapTP,
        fp: pkgGapFP,
        fn: pkgGapFN,
        tn: pkgGapTN,
        precision_pct: pkgPrec !== null ? Number(pkgPrec.toFixed(1)) : 'N/A',
        recall_pct: pkgRec !== null ? Number(pkgRec.toFixed(1)) : 'N/A',
        specificity_pct: Number(pkgGapSpec.toFixed(1)),
        predicted_count: predPkg.actionable_gaps ? predPkg.actionable_gaps.length : 0,
        gt_count: gtObsPkg.actionable_gaps ? gtObsPkg.actionable_gaps.length : 0
      },
      secondary_advisory_gaps: {
        count: pkgAdvisoryCount,
        items: predPkg.secondary_advisory_gaps || []
      },
      permissible_omissions: {
        tp: pkgPermTP,
        fp: pkgPermFP,
        fn: pkgPermFN,
        tn: pkgPermTN,
        specificity_pct: Number(pkgPermSpec.toFixed(1))
      },
      dimensions: dimDetails
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  Reliability: ${rel} | Valid: ${pkgValidDims}/8 | Incomplete: ${pkgStructInc}`);
    console.log(`  Observed MADE: ${pkgMade.toFixed(3)} | SDB: ${pkgSdb > 0 ? '+' : ''}${pkgSdb.toFixed(3)} | Concordance: ${pkgConcordance.toFixed(1)}% (${pkgStatusMatches}/${pkgValidDims})`);
    console.log(`  Core Gaps: TP=${pkgGapTP}, FP=${pkgGapFP}, FN=${pkgGapFN}, TN=${pkgGapTN} | Prec: ${pkgPrec !== null ? pkgPrec.toFixed(1) + '%' : 'N/A'}, Rec: ${pkgRec !== null ? pkgRec.toFixed(1) + '%' : 'N/A'}, GapSpec: ${pkgGapSpec.toFixed(1)}%`);
    console.log(`  Advisory Gaps (RECOMMENDED): ${pkgAdvisoryCount} | Permissible Spec: ${pkgPermSpec.toFixed(1)}%`);
  }

  // Aggregate Metrics
  const overallMade = totalValidDimensions > 0 ? totalObsMadeSum / totalValidDimensions : 0;
  const overallSdb = totalValidDimensions > 0 ? totalObsSdbSum / totalValidDimensions : 0;
  const overallConcordance = totalValidDimensions > 0 ? (totalStatusMatches / totalValidDimensions) * 100 : 0;
  const structuralCompletenessPct = (totalValidDimensions / totalDimensions) * 100;

  const gapPrec = (gapTP + gapFP > 0) ? (gapTP / (gapTP + gapFP)) * 100 : null;
  const gapRec = (gapTP + gapFN > 0) ? (gapTP / (gapTP + gapFN)) * 100 : null;
  const gapSpec = (gapTN + gapFP > 0) ? (gapTN / (gapTN + gapFP)) * 100 : 100.0;
  const gapF1 = (gapPrec !== null && gapRec !== null && (gapPrec + gapRec) > 0)
    ? (2 * gapPrec * gapRec) / (gapPrec + gapRec)
    : 0;

  const permSpec = (permTN + permFP > 0) ? (permTN / (permTN + permFP)) * 100 : 100.0;

  const evalSummary = {
    evaluation_timestamp: new Date().toISOString(),
    benchmark_scope: 'Step 1A.2 Development Set Diagnostic Calibration (pkg_01 to pkg_06)',
    lead_model: 'openai/gpt-oss-120b',
    structural_reliability: {
      total_dimensions: totalDimensions,
      valid_dimensions: totalValidDimensions,
      structural_incompletes: totalStructuralIncompletes,
      structural_completeness_pct: Number(structuralCompletenessPct.toFixed(2)),
      reliability_distribution: reliabilityCounts
    },
    pedagogical_evaluation: {
      denominator_valid_dimensions: totalValidDimensions,
      observed_depth_made: Number(overallMade.toFixed(4)),
      observed_depth_sdb: Number(overallSdb.toFixed(4)),
      exact_status_concordance_pct: Number(overallConcordance.toFixed(2)),
      actionable_gaps: {
        tp: gapTP,
        fp: gapFP,
        fn: gapFN,
        tn: gapTN,
        precision_pct: gapPrec !== null ? Number(gapPrec.toFixed(2)) : 'N/A',
        recall_pct: gapRec !== null ? Number(gapRec.toFixed(2)) : 'N/A',
        specificity_pct: Number(gapSpec.toFixed(2)),
        f1_score_pct: Number(gapF1.toFixed(2))
      },
      secondary_advisory_gaps: {
        total_predicted: totalAdvisoryPredicted,
        items: advisoryGapsList
      },
      permissible_scope_omissions: {
        tp: permTP,
        fp: permFP,
        fn: permFN,
        tn: permTN,
        specificity_pct: Number(permSpec.toFixed(2))
      }
    },
    dimension_disagreements: dimensionDisagreements,
    packages: packageSummaries
  };

  fs.writeFileSync(devsetEvalFile, JSON.stringify(evalSummary, null, 2), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log('STEP 1A.2 DEVELOPMENT CALIBRATION AGGREGATE RESULTS');
  console.log('='.repeat(80));
  console.log(`Structural Completeness:        ${structuralCompletenessPct.toFixed(2)}% (${totalValidDimensions}/${totalDimensions} dims)`);
  console.log(`Reliability Distribution:       First-Response: ${reliabilityCounts.valid_first_response}, After-Retry: ${reliabilityCounts.valid_after_retry}, Incomplete: ${reliabilityCounts.incomplete_after_retry}`);
  console.log('-'.repeat(80));
  console.log(`Observed Depth MADE:            ${overallMade.toFixed(3)} levels`);
  console.log(`Signed Depth Bias (SDB):        ${overallSdb > 0 ? '+' : ''}${overallSdb.toFixed(3)} levels`);
  console.log(`Exact Status Concordance:       ${overallConcordance.toFixed(2)}% (${totalStatusMatches}/${totalValidDimensions})`);
  console.log('-'.repeat(80));
  console.log('CORE ACTIONABLE GAPS (REQUIRED TIERS ONLY):');
  console.log(`  Raw Counts:       TP=${gapTP}, FP=${gapFP}, FN=${gapFN}, TN=${gapTN} (Denominator: ${totalValidDimensions})`);
  console.log(`  Precision:        ${gapPrec !== null ? gapPrec.toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Recall:           ${gapRec !== null ? gapRec.toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Gap Specificity:  ${gapSpec.toFixed(2)}% (TN / (TN + FP) = ${gapTN}/${gapTN + gapFP})`);
  console.log(`  F1-Score:         ${gapF1.toFixed(2)}%`);
  console.log('-'.repeat(80));
  console.log(`SECONDARY ADVISORY GAPS (RECOMMENDED): ${totalAdvisoryPredicted} reported independently`);
  console.log('PERMISSIBLE SCOPE OMISSIONS:');
  console.log(`  Raw Counts:       TP=${permTP}, FP=${permFP}, FN=${permFN}, TN=${permTN}`);
  console.log(`  Perm Specificity: ${permSpec.toFixed(2)}% (TN_perm / (TN_perm + FP_perm) = ${permTN}/${permTN + permFP})`);
  console.log('='.repeat(80));
  console.log(`Evaluation report saved to: ${devsetEvalFile}\n`);
}

main().catch(err => {
  console.error('Fatal error in Step 1A.2 calibration runner:', err);
  process.exit(1);
});
