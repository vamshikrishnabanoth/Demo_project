/**
 * experiments/experiment_5_teaching_adequacy/runner/evaluate_p5_2b.js
 *
 * Phase 5 Experiment 5: Contextual Teaching Adequacy & Deep Lecture Understanding
 * Evaluation of Component P5.2B (Instructional Episode & Revisitation Reconstructor / RQ1B)
 *
 * Evaluates reconstructed instructional episodes against the independently adjudicated
 * observational reference evidence ground truth:
 *   1. Windowed Boundary Agreement (Precision, Recall, F1 at ±5s, ±10s, ±15s)
 *   2. Continuous Episode Overlap (Mean Temporal Segment IoU)
 *   3. Intellectual Activity Classification Agreement
 *   4. Interaction Mode Classification Agreement
 *   5. Concept Revisitation Capture Rate (Precision, Recall, F1)
 *   6. Observational Decoupling / Paired BFS Invariance (pkg_03 vs pkg_04)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DemoProjectDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop\\git_kahoot\\Demo_project';
const exp5Dir = path.resolve(DemoProjectDir, 'experiments/experiment_5_teaching_adequacy');

const gtPath = path.join(exp5Dir, 'ground_truth/observational/observational_reference_evidence.json');
const predPath = path.join(exp5Dir, 'raw_results/p5_2b_episodes.json');
const evalOutputPath = path.join(exp5Dir, 'raw_results/p5_2b_evaluation_summary.json');

function calculateSegmentIoU(startA, endA, startB, endB) {
  const intersectionStart = Math.max(startA, startB);
  const intersectionEnd = Math.min(endA, endB);
  const intersection = Math.max(0, intersectionEnd - intersectionStart);

  const unionStart = Math.min(startA, startB);
  const unionEnd = Math.max(endA, endB);
  const union = unionEnd - unionStart;

  if (union <= 0) return 0;
  return intersection / union;
}

function evaluateBoundaryWindow(gtBoundaries, predBoundaries, toleranceSec) {
  let tp = 0;
  const matchedPred = new Set();

  for (const gtB of gtBoundaries) {
    for (let i = 0; i < predBoundaries.length; i++) {
      if (!matchedPred.has(i)) {
        if (Math.abs(predBoundaries[i] - gtB) <= toleranceSec) {
          tp++;
          matchedPred.add(i);
          break;
        }
      }
    }
  }

  const fp = predBoundaries.length - tp;
  const fn = gtBoundaries.length - tp;

  const precision = (tp + fp > 0) ? (tp / (tp + fp)) : 1.0;
  const recall = (tp + fn > 0) ? (tp / (tp + fn)) : 1.0;
  const f1 = (precision + recall > 0) ? (2 * precision * recall / (precision + recall)) : 0;

  return { precision, recall, f1, tp, fp, fn };
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
  console.log('PHASE 5: COMPONENT P5.2B EVALUATION (RQ1B — EPISODES & REVISITATIONS)');
  console.log('='.repeat(80));
  console.log(`Ground Truth: ${gtPath}`);
  console.log(`Predictions:  ${predPath}`);
  console.log(`Packages:     ${packages.length}`);
  console.log('-'.repeat(80));

  const packageSummaries = {};

  let totalGtBoundaries = 0;
  let totalPredBoundaries = 0;
  let totalTp5 = 0, totalTp10 = 0, totalTp15 = 0;

  let totalEpisodesEvaluated = 0;
  let totalIoUSum = 0;
  let totalActivityMatches = 0;
  let totalModeMatches = 0;

  let totalGtRevisitations = 0;
  let totalPredRevisitations = 0;
  let totalMatchedRevisitations = 0;

  for (const pkgId of packages) {
    const pkgGT = gtData.packages[pkgId];
    const pkgPred = predData.packages[pkgId];

    if (!pkgPred) {
      console.error(`Missing prediction for package: ${pkgId}`);
      continue;
    }

    const gtEpisodes = pkgGT.episodes;
    const predEpisodes = pkgPred.episodes;

    // Boundary points (excluding start=0 and final lecture end)
    const gtBounds = gtEpisodes.map(e => e.end).slice(0, -1);
    const predBounds = predEpisodes.map(e => e.end).slice(0, -1);

    totalGtBoundaries += gtBounds.length;
    totalPredBoundaries += predBounds.length;

    const b5 = evaluateBoundaryWindow(gtBounds, predBounds, 5);
    const b10 = evaluateBoundaryWindow(gtBounds, predBounds, 10);
    const b15 = evaluateBoundaryWindow(gtBounds, predBounds, 15);

    totalTp5 += b5.tp;
    totalTp10 += b10.tp;
    totalTp15 += b15.tp;

    // Segment IoU, Activity, and Mode evaluation via bipartite matching
    let pkgIoUSum = 0;
    let pkgActivityMatches = 0;
    let pkgModeMatches = 0;
    let pkgMatchedPairs = 0;

    for (const gtE of gtEpisodes) {
      let bestIoU = 0;
      let bestPred = null;

      for (const predE of predEpisodes) {
        const iou = calculateSegmentIoU(gtE.start, gtE.end, predE.start, predE.end);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestPred = predE;
        }
      }

      if (bestPred) {
        pkgIoUSum += bestIoU;
        pkgMatchedPairs++;

        if (gtE.intellectual_activity === bestPred.intellectual_activity) {
          pkgActivityMatches++;
          totalActivityMatches++;
        }
        if (gtE.interaction_mode === bestPred.interaction_mode) {
          pkgModeMatches++;
          totalModeMatches++;
        }
      }
    }

    totalEpisodesEvaluated += pkgMatchedPairs;
    totalIoUSum += pkgIoUSum;

    const pkgMeanIoU = pkgMatchedPairs > 0 ? (pkgIoUSum / pkgMatchedPairs) : 0;
    const pkgActivityAcc = pkgMatchedPairs > 0 ? (pkgActivityMatches / pkgMatchedPairs) * 100 : 0;
    const pkgModeAcc = pkgMatchedPairs > 0 ? (pkgModeMatches / pkgMatchedPairs) * 100 : 0;

    // Revisitation capture
    const gtRevCount = gtEpisodes.filter(e => e.revisitation).length;
    const predRevCount = predEpisodes.filter(e => e.revisitation).length;
    totalGtRevisitations += gtRevCount;
    totalPredRevisitations += predRevCount;

    let pkgMatchedRev = 0;
    for (const gtE of gtEpisodes) {
      if (gtE.revisitation) {
        // Find if any overlapping predicted episode also flagged revisitation
        for (const predE of predEpisodes) {
          if (predE.revisitation && calculateSegmentIoU(gtE.start, gtE.end, predE.start, predE.end) >= 0.3) {
            pkgMatchedRev++;
            break;
          }
        }
      }
    }
    totalMatchedRevisitations += pkgMatchedRev;

    const revPrec = predRevCount > 0 ? (pkgMatchedRev / predRevCount) : 1.0;
    const revRec = gtRevCount > 0 ? (pkgMatchedRev / gtRevCount) : 1.0;
    const revF1 = (revPrec + revRec > 0) ? (2 * revPrec * revRec / (revPrec + revRec)) : 0;

    packageSummaries[pkgId] = {
      package_id: pkgId,
      gt_episode_count: gtEpisodes.length,
      pred_episode_count: predEpisodes.length,
      mean_segment_iou: Number(pkgMeanIoU.toFixed(4)),
      boundary_f1_pm5s: Number(b5.f1.toFixed(4)),
      boundary_f1_pm10s: Number(b10.f1.toFixed(4)),
      boundary_f1_pm15s: Number(b15.f1.toFixed(4)),
      activity_agreement_pct: Number(pkgActivityAcc.toFixed(2)),
      mode_agreement_pct: Number(pkgModeAcc.toFixed(2)),
      revisitations: {
        gt_count: gtRevCount,
        pred_count: predRevCount,
        matched: pkgMatchedRev,
        precision: Number(revPrec.toFixed(4)),
        recall: Number(revRec.toFixed(4)),
        f1: Number(revF1.toFixed(4))
      }
    };

    console.log(`\nPackage: ${pkgId}`);
    console.log(`  Episodes: GT = ${gtEpisodes.length}, Reconstructed = ${predEpisodes.length} | Mean Segment IoU: ${pkgMeanIoU.toFixed(4)}`);
    console.log(`  Boundary F1: ±5s = ${b5.f1.toFixed(3)} | ±10s = ${b10.f1.toFixed(3)} | ±15s = ${b15.f1.toFixed(3)}`);
    console.log(`  Classification: Activity Match = ${pkgActivityAcc.toFixed(1)}% | Mode Match = ${pkgModeAcc.toFixed(1)}%`);
    console.log(`  Revisitations: GT = ${gtRevCount}, Pred = ${predRevCount}, Matched = ${pkgMatchedRev} (F1: ${revF1.toFixed(3)})`);
  }

  const overallIoU = totalEpisodesEvaluated > 0 ? (totalIoUSum / totalEpisodesEvaluated) : 0;
  const overallActivityAcc = totalEpisodesEvaluated > 0 ? (totalActivityMatches / totalEpisodesEvaluated) * 100 : 0;
  const overallModeAcc = totalEpisodesEvaluated > 0 ? (totalModeMatches / totalEpisodesEvaluated) * 100 : 0;

  const prec5 = (totalPredBoundaries > 0) ? (totalTp5 / totalPredBoundaries) : 1.0;
  const rec5 = (totalGtBoundaries > 0) ? (totalTp5 / totalGtBoundaries) : 1.0;
  const f1_5 = (prec5 + rec5 > 0) ? (2 * prec5 * rec5 / (prec5 + rec5)) : 0;

  const prec10 = (totalPredBoundaries > 0) ? (totalTp10 / totalPredBoundaries) : 1.0;
  const rec10 = (totalGtBoundaries > 0) ? (totalTp10 / totalGtBoundaries) : 1.0;
  const f1_10 = (prec10 + rec10 > 0) ? (2 * prec10 * rec10 / (prec10 + rec10)) : 0;

  const prec15 = (totalPredBoundaries > 0) ? (totalTp15 / totalPredBoundaries) : 1.0;
  const rec15 = (totalGtBoundaries > 0) ? (totalTp15 / totalGtBoundaries) : 1.0;
  const f1_15 = (prec15 + rec15 > 0) ? (2 * prec15 * rec15 / (prec15 + rec15)) : 0;

  const overallRevPrec = totalPredRevisitations > 0 ? (totalMatchedRevisitations / totalPredRevisitations) : 1.0;
  const overallRevRec = totalGtRevisitations > 0 ? (totalMatchedRevisitations / totalGtRevisitations) : 1.0;
  const overallRevF1 = (overallRevPrec + overallRevRec > 0) ? (2 * overallRevPrec * overallRevRec / (overallRevPrec + overallRevRec)) : 0;

  console.log('\n' + '='.repeat(80));
  console.log('OVERALL RQ1B EPISODE RECONSTRUCTION PERFORMANCE SUMMARY');
  console.log('='.repeat(80));
  console.log(`Mean Continuous Segment IoU:              ${overallIoU.toFixed(4)}`);
  console.log(`Windowed Boundary F1 (±5s):               ${f1_5.toFixed(4)} (Prec: ${(prec5*100).toFixed(1)}%, Rec: ${(rec5*100).toFixed(1)}%)`);
  console.log(`Windowed Boundary F1 (±10s):              ${f1_10.toFixed(4)} (Prec: ${(prec10*100).toFixed(1)}%, Rec: ${(rec10*100).toFixed(1)}%)`);
  console.log(`Windowed Boundary F1 (±15s):              ${f1_15.toFixed(4)} (Prec: ${(prec15*100).toFixed(1)}%, Rec: ${(rec15*100).toFixed(1)}%)`);
  console.log(`Intellectual Activity Agreement:         ${overallActivityAcc.toFixed(2)}% (${totalActivityMatches}/${totalEpisodesEvaluated})`);
  console.log(`Interaction Mode Agreement:              ${overallModeAcc.toFixed(2)}% (${totalModeMatches}/${totalEpisodesEvaluated})`);
  console.log(`Concept Revisitation Capture:            GT = ${totalGtRevisitations}, Pred = ${totalPredRevisitations}, Matched = ${totalMatchedRevisitations}`);
  console.log(`  Revisitation Precision:                ${(overallRevPrec * 100).toFixed(2)}%`);
  console.log(`  Revisitation Recall:                   ${(overallRevRec * 100).toFixed(2)}%`);
  console.log(`  Revisitation F1 Score:                 ${overallRevF1.toFixed(4)}`);

  // Targeted Observational Invariance Test: pkg_03 vs pkg_04
  console.log('\n' + '='.repeat(80));
  console.log('OBSERVATIONAL INVARIANCE TEST: BFS CONCEPTUAL (pkg_03) vs IMPLEMENTATION (pkg_04)');
  console.log('='.repeat(80));

  const p03 = predData.packages['pkg_03_dsa_bfs_conceptual'];
  const p04 = predData.packages['pkg_04_dsa_bfs_implementation'];

  console.log(`pkg_03 Episodes: ${p03.episodes.length} | Boundaries: ${p03.episodes.map(e => `[${e.start}s-${e.end}s]`).join(' ')}`);
  console.log(`pkg_04 Episodes: ${p04.episodes.length} | Boundaries: ${p04.episodes.map(e => `[${e.start}s-${e.end}s]`).join(' ')}`);

  const evaluationSummary = {
    evaluation_timestamp: new Date().toISOString(),
    total_packages: packages.length,
    overall_metrics: {
      mean_segment_iou: Number(overallIoU.toFixed(4)),
      boundary_f1_pm5s: Number(f1_5.toFixed(4)),
      boundary_f1_pm10s: Number(f1_10.toFixed(4)),
      boundary_f1_pm15s: Number(f1_15.toFixed(4)),
      intellectual_activity_agreement_pct: Number(overallActivityAcc.toFixed(2)),
      interaction_mode_agreement_pct: Number(overallModeAcc.toFixed(2)),
      revisitation_precision: Number(overallRevPrec.toFixed(4)),
      revisitation_recall: Number(overallRevRec.toFixed(4)),
      revisitation_f1: Number(overallRevF1.toFixed(4))
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
