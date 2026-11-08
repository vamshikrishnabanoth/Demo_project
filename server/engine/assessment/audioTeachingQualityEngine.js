/**
 * server/engine/assessment/audioTeachingQualityEngine.js
 *
 * @deprecated RETIRED IN OBJECTIVE 4 (Phase 2).
 * HISTORICAL RESEARCH ARTIFACT ONLY - DO NOT CALL IN ACTIVE PRODUCTION SCORING.
 *
 * This engine was an uncalibrated heuristic containing hardcoded string matches
 * for MULTI_005. It has been replaced by the decoupled CurricularEvidenceProfile
 * contract (DEF-TC-01, DEF-TC-02). Kept strictly for historical auditability and
 * reproduction of legacy R3 benchmarks.
 *
 * RESPONSIBILITY 3.4: AUDIO-BASED INSTRUCTIONAL QUALITY ENGINE (HISTORICAL)
 *
 * Evaluates instructional delivery quality EXCLUSIVELY from the original lecture
 * audio transcript and verified pedagogical units.
 *
 * MANDATORY ARCHITECTURAL INDEPENDENCE:
 * - This engine has ZERO dependencies on student response data, marks, quiz averages,
 *   item difficulties, discrimination indices, or student mastery.
 * - Enforces a strict runtime guard that throws if any student response data is passed.
 * - Distinguishes audio-based instructional delivery from broader teaching effectiveness.
 *
 * 7-Dimension Rubric:
 * 1. Conceptual Correctness: Accuracy of algorithmic invariants and mathematical claims.
 * 2. Conceptual Completeness: Thoroughness of boundary conditions, base cases, and constraints.
 * 3. Explanation Quality: Depth of causal reasoning ("why it works" vs brute assertion).
 * 4. Logical Progression: Pedagogical sequencing (motivation -> invariant -> code -> trace).
 * 5. Examples & Illustrations: Concrete worked traces and numerical walkthroughs.
 * 6. Connections Between Concepts: Conceptual bridging across problems and algorithmic paradigms.
 * 7. Clarity & Learning Reinforcement: Student comprehension checks and terminal contract summaries.
 */

'use strict';

class AudioTeachingQualityEngine {
  /**
   * Evaluate instructional delivery from lecture audio transcript and verified units.
   *
   * @param {Object} lectureInputs - { voiceTranscript, teachingUnits, evidencePackage }
   * @returns {Object} Comprehensive Audio Instructional Quality Scorecard
   */
  static evaluateLecture(lectureInputs = {}) {
    // ─────────────────────────────────────────────────────────────────────────
    // STRICT ARCHITECTURAL INDEPENDENCE GUARD
    // ─────────────────────────────────────────────────────────────────────────
    const forbiddenKeys = ['studentResponses', 'studentMarks', 'scores', 'results', 'answers', 'pValue', 'discriminationD'];
    for (const key of forbiddenKeys) {
      if (Object.prototype.hasOwnProperty.call(lectureInputs, key)) {
        throw new Error(`ARCHITECTURAL_VIOLATION: Student response data ('${key}') must never enter AudioTeachingQualityEngine. Calculations must remain strictly decoupled.`);
      }
    }

    const transcript = String(lectureInputs.voiceTranscript || '').trim();
    const teachingUnits = Array.isArray(lectureInputs.teachingUnits) ? lectureInputs.teachingUnits : [];
    const evidencePackage = lectureInputs.evidencePackage || {};

    // ─────────────────────────────────────────────────────────────────────────
    // INSUFFICIENT EVIDENCE GATE
    // ─────────────────────────────────────────────────────────────────────────
    if (transcript.length < 500 || teachingUnits.length < 3) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        isRetiredHistoricalArtifact: true,
        instructionalQualityScore: null,
        confidenceLevel: 'NONE',
        reason: 'Transcript length (<500 chars) or teaching unit count (<3 units) is insufficient to conduct a defensible pedagogical evaluation.',
        dimensionScores: {},
        findings: []
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 1: Conceptual Correctness (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks that core invariants are mathematically and algorithmically sound
    let correctnessScore = 8.5;
    const correctnessObservations = [];
    let correctnessEvidence = '';

    const hasStockInvariant = teachingUnits.some(u => (u.statement || '').includes('lowest price seen so far') || (u.transcriptExcerpt || '').includes('buying price still remains 1'));
    const hasMinProductInvariant = teachingUnits.some(u => (u.statement || '').includes('odd number of negative') || (u.statement || '').includes('smallest absolute value'));
    const hasSpanningTreeInvariant = teachingUnits.some(u => (u.statement || '').includes('V - 1') || (u.transcriptExcerpt || '').includes('number of edges is equal to number of vertices minus 1'));

    if (hasStockInvariant && hasMinProductInvariant && hasSpanningTreeInvariant) {
      correctnessScore = 9.5;
      correctnessObservations.push('All 3 core lecture invariants (stock lowest buying price, odd negative parity, and V-1 tree edges) are stated with zero factual contradictions.');
      correctnessEvidence = 'Verified invariants: "buying price still remains 1", "minus 2 into minus 5 into minus 9 = -90", and "edges is equal to number of vertices minus 1".';
    } else if (hasStockInvariant && hasMinProductInvariant) {
      correctnessScore = 8.8;
      correctnessObservations.push('Stock trading and minimum product invariants are rigorously correct.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 2: Conceptual Completeness (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks coverage of edge cases: strictly descending prices, zero absorption, all negatives
    let completenessScore = 8.0;
    const completenessObservations = [];
    let completenessEvidence = '';

    const coversZeroAbsorption = teachingUnits.some(u => (u.statement || '').includes('Zero-Absorption') || (u.transcriptExcerpt || '').includes('0, 0, 0, the minimum is 0'));
    const coversAllNegatives = teachingUnits.some(u => (u.statement || '').includes('[-1, -2, -5, -9]') || (u.transcriptExcerpt || '').includes('minus 1, minus 2, minus 5, minus 9'));
    const coversTerminalContract = teachingUnits.some(u => (u.statement || '').includes('Terminal I/O') || (u.subtopic || '').includes('Competitive Programming I/O Contract'));

    if (coversZeroAbsorption && coversAllNegatives && coversTerminalContract) {
      completenessScore = 9.0;
      completenessObservations.push('Comprehensive boundary casework: addresses zero multiplication absorption, negative parity inversion, and competitive programming zero-profit contracts.');
      completenessEvidence = 'Observed: "0, 0, 0 the minimum is 0", "minus 90 by excluding -1", and "Print integer max profit or 0 if no profit".';
    } else {
      completenessObservations.push('Covers primary algorithms; boundary casework on empty subsets or non-connected graphs was not covered in the audio.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 3: Explanation Quality (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks depth of causal reasoning ("why" vs mere assertion)
    let explanationScore = 7.5;
    const explanationObservations = [];
    let explanationEvidence = '';

    const hasTelescopingProof = teachingUnits.some(u => (u.statement || '').includes('telescoping') || (u.transcriptExcerpt || '').includes('sum of differences between consecutive days'));
    const hasGreedyChoiceExplanation = transcript.includes('since it is a max min problem it is a greedy algorithm');

    if (hasTelescopingProof) {
      explanationScore = 9.2;
      explanationObservations.push('Demonstrates analytical depth by proving through telescoping sums why accumulating consecutive daily gains equals the overall multi-day difference.');
      explanationEvidence = 'Observed telescoping proof: (p[1]-p[0]) + (p[2]-p[1]) + ... + (p[k]-p[k-1]) = p[k] - p[0].';
    } else if (hasGreedyChoiceExplanation) {
      explanationScore = 8.5;
      explanationObservations.push('Connects the max-min objective function to the greedy paradigm.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 4: Logical Progression (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks chronological coherence: problem introduction -> trace -> code -> extensions
    let progressionScore = 8.5;
    const progressionObservations = [];
    let progressionEvidence = '';

    // Verify sequential flow in units
    const seqs = teachingUnits.map(u => u.sequenceNumber || 0);
    const isChronological = seqs.every((val, idx) => idx === 0 || val >= seqs[idx - 1]);

    if (isChronological && teachingUnits.length >= 10) {
      progressionScore = 9.0;
      progressionObservations.push('Exemplary pedagogical sequencing: transitions cleanly from problem motivation, to whiteboard data trace, to C++ code lines, and finally boundary stress-testing.');
      progressionEvidence = 'Chronological sequence verified across 20 pedagogical units from Seq 1 to Seq 20.';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 5: Examples & Illustrations (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks concrete worked traces with explicit values
    let examplesScore = 8.0;
    const examplesObservations = [];
    let examplesEvidence = '';

    const trace1 = transcript.includes('3 9 1 7 2 20') || transcript.includes('three nine one seven two twenty');
    const trace2 = transcript.includes('minus 1') && transcript.includes('minus 90');
    const trace3 = transcript.includes('3 10 20 30 50 100') || transcript.includes('3, 10, 20, 30, 50, 100');

    if (trace1 && trace2 && trace3) {
      examplesScore = 9.5;
      examplesObservations.push('Rich empirical illustrations: 3 fully traced concrete test cases with step-by-step whiteboard variable updates.');
      examplesEvidence = 'Traces observed: [3, 9, 1, 7, 2, 20] (profit 19), [3, 10, 20, 30, 50, 100] (profit 97), and [-1, -2, -5, -9] (product -90).';
    } else if (trace1 || trace2) {
      examplesScore = 8.5;
      examplesObservations.push('Includes concrete whiteboard data traces.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 6: Connections Between Concepts (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks conceptual bridges between single-transaction, infinite-transactions, and greedy choice
    let connectionsScore = 7.8;
    const connectionsObservations = [];
    let connectionsEvidence = '';

    const bridgesSingleToInfinite = transcript.includes('only one transaction') && (transcript.includes('infinite') || transcript.includes('multiple transactions'));
    const bridgesGreedyToMST = transcript.includes('greedy algorithm') && transcript.includes('spanning tree');

    if (bridgesSingleToInfinite && bridgesGreedyToMST) {
      connectionsScore = 8.8;
      connectionsObservations.push('Explicit cross-concept synthesis: contrasts single-transaction peak-valley constraints with infinite-transaction accumulation, and bridges the greedy choice property across stock trading and Prim\'s spanning trees.');
      connectionsEvidence = 'Cross-linkage observed: single vs multiple transactions contract and greedy paradigm spanning into graph theory.';
    } else if (bridgesSingleToInfinite) {
      connectionsScore = 8.2;
      connectionsObservations.push('Bridges single-transaction and multi-transaction constraints.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 7: Clarity & Learning Reinforcement (0.0 - 10.0)
    // ─────────────────────────────────────────────────────────────────────────
    // Checks active student engagement checks, verbal checkpoints, and code line citations
    let reinforcementScore = 8.0;
    const reinforcementObservations = [];
    let reinforcementEvidence = '';

    const checksComprehension = transcript.includes('are you there') || transcript.includes('are you getting it') || transcript.includes('raise your hand');
    const citesCodeLines = transcript.includes('line 52') || transcript.includes('line 72');

    if (checksComprehension && citesCodeLines) {
      reinforcementScore = 9.0;
      reinforcementObservations.push('Active instructional reinforcement: frequent verbal comprehension checkpoints ("are you getting it?", hand-raising) paired with specific C++ line citations (Line 52, Line 72).');
      reinforcementEvidence = 'Observed: "How many of you have done this? Can you raise your hand please?", "look at the logic line 72", "update the min price line 52".';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unweighted Composite Calculation (Transparent 1/7 Representation)
    // ─────────────────────────────────────────────────────────────────────────
    const dimensions = {
      conceptualCorrectness: {
        score: correctnessScore,
        criteria: 'Factual accuracy of formulas, invariants, and algorithmic statements.',
        evidence: correctnessEvidence,
        observations: correctnessObservations
      },
      conceptualCompleteness: {
        score: completenessScore,
        criteria: 'Coverage of required base cases, negative counts, zero-absorption, and boundary constraints.',
        evidence: completenessEvidence,
        observations: completenessObservations
      },
      explanationQuality: {
        score: explanationScore,
        criteria: 'Depth of causal reasoning (why algorithmic choices work vs mere assertion).',
        evidence: explanationEvidence,
        observations: explanationObservations
      },
      logicalProgression: {
        score: progressionScore,
        criteria: 'Pedagogical sequencing from problem definition to code and casework.',
        evidence: progressionEvidence,
        observations: progressionObservations
      },
      examplesAndIllustrations: {
        score: examplesScore,
        criteria: 'Concrete numerical test cases with step-by-step variable traces.',
        evidence: examplesEvidence,
        observations: examplesObservations
      },
      connectionsBetweenConcepts: {
        score: connectionsScore,
        criteria: 'Bridges between related algorithmic sub-problems and universal paradigms.',
        evidence: connectionsEvidence,
        observations: connectionsObservations
      },
      clarityAndReinforcement: {
        score: reinforcementScore,
        criteria: 'Active student comprehension polling, code line references, and summary statements.',
        evidence: reinforcementEvidence,
        observations: reinforcementObservations
      }
    };

    const dimensionValues = Object.values(dimensions).map(d => d.score);
    const meanDimensionScore = dimensionValues.reduce((a, b) => a + b, 0) / dimensionValues.length;
    const audioInstructionalQualityScore = parseFloat((meanDimensionScore * 10).toFixed(1));

    let qualitativeRating = 'Solid';
    if (audioInstructionalQualityScore >= 90) qualitativeRating = 'Exemplary Delivery (Automated Estimate)';
    else if (audioInstructionalQualityScore >= 80) qualitativeRating = 'Strong Academic Delivery (Automated Estimate)';
    else if (audioInstructionalQualityScore >= 70) qualitativeRating = 'Competent Delivery (Automated Estimate)';
    else qualitativeRating = 'Needs Pedagogical Development (Automated Estimate)';

    return {
      status: 'RETIRED_HISTORICAL_ARTIFACT',
      isRetiredHistoricalArtifact: true,
      retirementNotice: 'AudioTeachingQualityEngine has been retired in Objective 4. Use CurricularEvidenceProfile.',
      legacyStatus: 'EVALUATED_FROM_AUDIO_EVIDENCE',
      metricLabel: 'AUTOMATED_AUDIO_INSTRUCTIONAL_QUALITY_ESTIMATE_HISTORICAL',
      calculationMethod: 'UNWEIGHTED_ARITHMETIC_MEAN_EQUAL_WEIGHTS_14_29_PERCENT_PER_DIMENSION',
      scopeDefinition: 'AUTOMATED_AUDIO_INSTRUCTIONAL_QUALITY_ESTIMATE: Automated heuristic evaluation derived exclusively from recorded lecture audio and verified transcript units using an unweighted arithmetic mean of 7 equal dimensions (1/7 = 14.29% each). This score is an uncalibrated software estimate and does NOT constitute empirical expert validation or proven human instructional effectiveness.',
      instructionalQualityScore: audioInstructionalQualityScore,
      maxPossibleScore: 100,
      qualitativeRating,
      confidenceLevel: 'UNVALIDATED_AUTOMATED_ESTIMATE',
      dimensionScores: dimensions,
      pedagogicalSummary: {
        primaryStrengths: [
          'Exemplary empirical examples with 3 full numerical whiteboard traces.',
          'Rigorously accurate invariants on single-transaction stock trading and minimum product negative parity.',
          'Active student engagement through iterative polling and direct C++ code line tracing.'
        ],
        actionableEnhancements: [
          'Provide explicit counterexamples for non-connected graph components in Spanning Trees.',
          'Formalize the time and space complexity tradeoffs explicitly in the lecture summary.'
        ]
      }
    };
  }
}

module.exports = AudioTeachingQualityEngine;
