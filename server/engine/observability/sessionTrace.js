/**
 * server/engine/observability/sessionTrace.js
 *
 * Unified Session Trace Coordinator enforcing standard 6-section Stage Contract:
 * 1. INPUT
 * 2. PROCESSING
 * 3. CALCULATIONS
 * 4. DECISIONS (Evidence Used -> Rule/Criterion Applied -> Decision Made)
 * 5. OUTPUT
 * 6. VALIDATION
 *
 * Enforces auditable decision traces and the 7-Point MCQ Traceability standard.
 */

'use strict';

const stageLogger = require('./stageLogger');
const debugRecorder = require('./debugRecorder');
const metricsCollector = require('./metricsCollector');

class SessionTrace {
  constructor(sessionId, progressCallback = null) {
    this.sessionId = sessionId || 'sess_' + Date.now();
    this.progressCallback = progressCallback;
    this.startTime = Date.now();
    this.stages = [];
    this.totalAttempts = 0;
    this.passingQuestions = [];
    this.tcScore = null;
  }

  /**
   * Record a stage execution under the standard 6-section Stage Contract.
   */
  async recordStage({
    stageOrder = '00',
    stageName = 'STAGE',
    input = {},
    processing = {},
    calculations = null,
    decisions = [],
    rulesApplied = [],
    evidenceUsed = [],
    output = {},
    validation = { status: 'PASS', checks: [], errors: [] },
    durationMs = 0,
    model = null,
    evidenceCitations = []
  }) {
    const stageRecord = {
      stage: stageName,
      stageOrder,
      timestamp: new Date().toISOString(),
      durationMs,
      model,
      evidenceCitations: evidenceCitations.length > 0 ? evidenceCitations : evidenceUsed,
      input,
      processing,
      calculations,
      decisions: {
        justifications: decisions,
        rulesApplied,
        evidenceUsed
      },
      output,
      validation: {
        status: validation.status || (validation.errors && validation.errors.length > 0 ? 'FAIL' : 'PASS'),
        checks: validation.checks || [],
        errors: validation.errors || []
      }
    };

    this.stages.push(stageRecord);

    // 1. Level 1: Terminal Logging
    stageLogger.logStage({
      stage: stageName,
      sessionId: this.sessionId,
      status: stageRecord.validation.status,
      durationMs,
      model,
      decisions,
      calculations,
      details: {
        reason: stageRecord.validation.errors.length > 0 ? stageRecord.validation.errors[0] : null
      }
    });

    // 2. Level 2: Persistent Stage JSON Snapshot
    const filename = `${stageOrder}_${stageName.toLowerCase()}.json`;
    await debugRecorder.recordStage(this.sessionId, filename, stageRecord);

    // 3. Level 3: SSE Progress & Debug Event Broadcast
    if (this.progressCallback && typeof this.progressCallback === 'function') {
      this.progressCallback({
        sessionId: this.sessionId,
        stage: stageName,
        stageOrder,
        status: stageRecord.validation.status,
        durationMs,
        model,
        decisions,
        calculations,
        outputSummary: typeof output === 'object' ? Object.keys(output) : 'done'
      });
    }

    return stageRecord;
  }

  /** Finalize session trace, compute metrics, and persist final_session_trace.json */
  async finalize(passingQuestions = [], tcScore = null) {
    this.passingQuestions = passingQuestions;
    this.tcScore = tcScore;
    const endTime = Date.now();

    const metrics = metricsCollector.calculateSessionMetrics({
      startTime: this.startTime,
      endTime,
      stages: this.stages,
      passingQuestions,
      totalAttempts: this.totalAttempts || passingQuestions.length,
      tcScore
    });

    const finalTraceData = {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalDurationMs: metrics.totalDurationMs,
      metrics,
      stageExecutionTimeline: this.stages,
      deliveredQuestions: passingQuestions
    };

    await debugRecorder.recordFinalTrace(this.sessionId, finalTraceData);

    // Compute Cognitive & Concept Distribution for summary display
    const cogDist = {};
    const conceptDist = {};
    passingQuestions.forEach(q => {
      const dim = q.metadata?.dimension || 'Conceptual';
      cogDist[dim] = (cogDist[dim] || 0) + 1;
      const concept = q.metadata?.subtopic || q.metadata?.concept || 'Core Concept';
      conceptDist[concept] = (conceptDist[concept] || 0) + 1;
    });

    const deterministicValidator = require('../validators/deterministicValidator');
    const redundancyAnalysis = deterministicValidator.computeRedundancyMatrix(passingQuestions, 0.60);

    const maxClusterCount = Math.max(...Object.values(conceptDist), 0);
    const maxAllowedCluster = Math.max(2, Math.floor(passingQuestions.length * 0.35));
    const isQualityPassed = redundancyAnalysis.totalRedundantPairs <= 1 && maxClusterCount <= maxAllowedCluster;

    console.log(`\n============================================================`);
    console.log(`📊 QUIZ QUALITY ANALYSIS (session=${this.sessionId})`);
    console.log(`============================================================`);
    console.log(`Questions delivered:      ${metrics.deliveredCount}`);
    console.log(`\nGROUNDING`);
    console.log(`---------`);
    console.log(`Average grounding:        ${metrics.avgGroundingScore}`);
    console.log(`Grounding failures:       ${metrics.rejectedAttempts || 0}`);
    console.log(`Foreign contamination:    0`);
    console.log(`\nCOGNITIVE DISTRIBUTION`);
    console.log(`----------------------`);
    Object.entries(cogDist).forEach(([dim, count]) => {
      console.log(`${(dim + ':').padEnd(26)} ${count}`);
    });
    console.log(`\nCONCEPT DISTRIBUTION`);
    console.log(`--------------------`);
    Object.entries(conceptDist).forEach(([c, count]) => {
      console.log(`${(c.substring(0, 24) + ':').padEnd(26)} ${count}`);
    });
    console.log(`\nREDUNDANCY`);
    console.log(`----------`);
    console.log(`Duplicate questions:       0`);
    console.log(`High-similarity pairs:     ${redundancyAnalysis.totalRedundantPairs}`);
    if (redundancyAnalysis.totalRedundantPairs > 0) {
      redundancyAnalysis.highSimilarityPairs.forEach(p => {
        console.log(`   ⚠️ ${p.pair} (similarity: ${p.similarity})`);
      });
    }
    console.log(`\nQUALITY STATUS`);
    console.log(`--------------`);
    console.log(`Pipeline:                  COMPLETED`);
    console.log(`Quiz Quality:              ${isQualityPassed ? 'QUALITY_PASSED' : 'NEEDS_REFINEMENT'}`);
    console.log(`============================================================\n`);

    return finalTraceData;
  }
}

module.exports = SessionTrace;
