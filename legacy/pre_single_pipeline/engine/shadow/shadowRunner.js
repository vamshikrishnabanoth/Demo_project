/**
 * server/engine/shadow/shadowRunner.js
 * 
 * v3.5 Asynchronous Shadow Intelligence Runner
 * 
 * Safety Invariants:
 * 1. Zero Blocking: Executes asynchronously off the main request-response path.
 * 2. Strict Concurrency & Queue Bounding: Max concurrency = 1, Max queue = 10.
 * 3. Resource Cancellation: AbortController with 60s hard timeout.
 * 4. Fault Isolation: A shadow failure NEVER fails, delays, or alters live quiz generation.
 * 5. Full Structured Tracing: Emits structured JSONL trace events per stage.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const featureFlags = require('../../config/featureFlags');
const traceService = require('../../services/traceService');

class ShadowRunner {
  constructor(options = {}) {
    this.maxQueueSize = options.maxQueueSize || featureFlags.SHADOW_QUEUE_MAX_SIZE || 10;
    this.maxConcurrency = options.maxConcurrency || featureFlags.MAX_CONCURRENT_SHADOW_TASKS || 1;
    this.taskTimeoutMs = options.taskTimeoutMs || featureFlags.SHADOW_TASK_TIMEOUT_MS || 60000;
    this.queue = [];
    this.activeTaskCount = 0;
    this.shadowOutputDir = path.resolve(__dirname, '..', '..', 'logs', 'shadow_intelligence');
    
    if (!fs.existsSync(this.shadowOutputDir)) {
      try {
        fs.mkdirSync(this.shadowOutputDir, { recursive: true });
      } catch (e) {
        console.error('[ShadowRunner] Failed creating shadow output directory:', e.message);
      }
    }
  }

  /**
   * Enqueue a shadow pipeline task. Callers return immediately.
   */
  enqueueShadowTask(taskData) {
    if (!featureFlags.SHADOW_MODE_ENABLED && !taskData.forceShadow) {
      // Shadow mode disabled by configuration
      traceService.emitEvent({
        traceId: taskData.traceId,
        requestId: taskData.requestId,
        sessionId: taskData.sessionId,
        stage: 'P5_SHADOW_INTELLIGENCE',
        substage: 'SHADOW_MODE_GATE',
        status: 'SKIPPED',
        decisions: {
          gateName: 'SHADOW_MODE_ENABLED',
          actionTaken: 'SKIPPED',
          rejectionReason: 'Shadow mode disabled by feature flag'
        }
      });
      return false;
    }

    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`[ShadowRunner] Shadow queue full (${this.queue.length}/${this.maxQueueSize}). Dropping oldest task.`);
      const dropped = this.queue.shift();
      traceService.emitEvent({
        traceId: dropped.traceId,
        requestId: dropped.requestId,
        sessionId: dropped.sessionId,
        stage: 'P5_SHADOW_INTELLIGENCE',
        substage: 'SHADOW_QUEUE',
        status: 'SKIPPED',
        decisions: {
          gateName: 'QUEUE_BOUND',
          actionTaken: 'DROPPED_QUEUE_OVERFLOW',
          rejectionReason: 'Maximum queue size reached'
        }
      });
    }

    this.queue.push({
      ...taskData,
      enqueuedAt: Date.now()
    });

    traceService.emitEvent({
      traceId: taskData.traceId,
      requestId: taskData.requestId,
      sessionId: taskData.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'TASK_ENQUEUED',
      status: 'COMPLETED',
      inputs: {
        queueLength: this.queue.length,
        activeTasks: this.activeTaskCount
      }
    });

    setImmediate(() => this.processNext());
    return true;
  }

  async processNext() {
    if (this.activeTaskCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.activeTaskCount++;

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      console.warn(`[ShadowRunner] Task ${task.requestId} timed out after ${this.taskTimeoutMs}ms. Aborting.`);
      abortController.abort();
    }, this.taskTimeoutMs);

    const queueWaitMs = Date.now() - task.enqueuedAt;
    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'TASK_EXECUTION_START',
      status: 'STARTED',
      durationMs: queueWaitMs,
      configuration: {
        componentVersion: 'v3.5-shadow',
        featureFlags: {
          SHADOW_MODE_ENABLED: featureFlags.SHADOW_MODE_ENABLED,
          ENABLE_P5_INTELLIGENCE: featureFlags.ENABLE_P5_INTELLIGENCE
        },
        parameters: {
          taskTimeoutMs: this.taskTimeoutMs,
          queueWaitMs
        }
      }
    });

    try {
      await this.executeShadowPipeline(task, abortController.signal);
    } catch (err) {
      console.error(`[ShadowRunner] Shadow pipeline execution error for ${task.requestId}:`, err.message);
      traceService.emitEvent({
        traceId: task.traceId,
        requestId: task.requestId,
        sessionId: task.sessionId,
        stage: 'P5_SHADOW_INTELLIGENCE',
        substage: 'TASK_EXECUTION_ERROR',
        status: 'FAILED',
        error: {
          message: err.message,
          stack: err.stack,
          fallbackTriggered: false
        }
      });
    } finally {
      clearTimeout(timeoutHandle);
      this.activeTaskCount--;
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Shadow Pipeline Execution: P5.1 -> P5.2A/B -> P5.3 -> P5.4
   */
  async executeShadowPipeline(task, abortSignal) {
    if (abortSignal.aborted) {
      throw new Error('Shadow task was aborted before starting');
    }

    const startTime = Date.now();
    const shadowResult = {
      requestId: task.requestId,
      sessionId: task.sessionId,
      topic: task.topic,
      declaredObjective: task.declaredObjective,
      learnerLevel: task.learnerLevel || 'INTERMEDIATE',
      academicDiscipline: task.academicDiscipline || 'General',
      timestamp: new Date().toISOString(),
      stages: {}
    };

    // Stage 1: P5.1 Normative Profiling (Emits expected depth profile)
    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_1_NORMATIVE_PROFILE',
      status: 'STARTED'
    });
    
    // In shadow mode, we construct the standardized P5.1 output object
    shadowResult.stages.p5_1_normative = {
      profileId: `norm_${task.requestId}`,
      status: 'COMPLETED',
      dimensions: task.normativeDimensions || {
        IDENTIFICATION: { expectedDepth: 2, alignmentTier: 'REQUIRED' },
        MEANING: { expectedDepth: 4, alignmentTier: 'REQUIRED' },
        STRUCTURE_COMPONENTS: { expectedDepth: 4, alignmentTier: 'REQUIRED' },
        RELATIONSHIPS_MECHANISM: { expectedDepth: 5, alignmentTier: 'REQUIRED' },
        JUSTIFICATION_WHY: { expectedDepth: 5, alignmentTier: 'REQUIRED' },
        APPLICATION_INTERPRETATION: { expectedDepth: 6, alignmentTier: 'REQUIRED' },
        BOUNDARIES_EXCEPTIONS: { expectedDepth: 4, alignmentTier: 'RECOMMENDED' },
        TRANSFER_SYNTHESIS: { expectedDepth: 2, alignmentTier: 'OPTIONAL' }
      }
    };

    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_1_NORMATIVE_PROFILE',
      status: 'COMPLETED',
      outputs: shadowResult.stages.p5_1_normative
    });

    if (abortSignal.aborted) throw new Error('Task aborted after P5.1');

    // Stage 2: P5.2A / P5.2B Observational Reconstruction
    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_2_OBSERVATIONAL_RECONSTRUCTION',
      status: 'STARTED'
    });

    shadowResult.stages.p5_2_observational = {
      status: 'COMPLETED',
      conceptsCount: task.concepts ? task.concepts.length : 0,
      episodesCount: task.episodes ? task.episodes.length : 0,
      evidenceQuotes: task.evidenceQuotes || []
    };

    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_2_OBSERVATIONAL_RECONSTRUCTION',
      status: 'COMPLETED',
      outputs: shadowResult.stages.p5_2_observational
    });

    if (abortSignal.aborted) throw new Error('Task aborted after P5.2');

    // Stage 3: P5.3 Diagnostic Coverage & Gap Screening
    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_3_GAP_SCREENING',
      status: 'STARTED'
    });

    shadowResult.stages.p5_3_diagnosis = {
      status: 'COMPLETED',
      reviewState: 'PENDING_TEACHER_REVIEW',
      actionableGapWarnings: task.actionableGaps || [],
      permissibleOmissions: task.permissibleOmissions || []
    };

    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'P5_3_GAP_SCREENING',
      status: 'COMPLETED',
      decisions: {
        gateName: 'P5_3_GAP_SCREENING',
        passed: shadowResult.stages.p5_3_diagnosis.actionableGapWarnings.length === 0,
        actionTaken: 'FLAGGED_FOR_REVIEW',
        adjudicationDetails: {
          warningCount: shadowResult.stages.p5_3_diagnosis.actionableGapWarnings.length,
          requiresHumanReview: true
        }
      },
      outputs: shadowResult.stages.p5_3_diagnosis
    });

    // Stage 4: Persist Shadow Intelligence Artifact for Teacher Review
    const outputFile = path.join(this.shadowOutputDir, `${task.requestId}.json`);
    shadowResult.totalDurationMs = Date.now() - startTime;
    fs.writeFileSync(outputFile, JSON.stringify(shadowResult, null, 2), 'utf-8');

    traceService.emitEvent({
      traceId: task.traceId,
      requestId: task.requestId,
      sessionId: task.sessionId,
      stage: 'P5_SHADOW_INTELLIGENCE',
      substage: 'SHADOW_PIPELINE_COMPLETE',
      status: 'COMPLETED',
      durationMs: shadowResult.totalDurationMs,
      outputs: {
        shadowStoragePath: outputFile,
        totalDurationMs: shadowResult.totalDurationMs
      }
    });

    console.log(`[ShadowRunner] Successfully executed shadow intelligence for ${task.requestId} in ${shadowResult.totalDurationMs}ms`);
    return shadowResult;
  }
}

module.exports = new ShadowRunner();
