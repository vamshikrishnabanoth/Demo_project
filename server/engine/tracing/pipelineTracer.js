/**
 * server/engine/tracing/pipelineTracer.js
 * 
 * COMPREHENSIVE MCQ PIPELINE TRACER CORE
 * Captures stage-by-stage execution metrics, inputs, outputs, decisions, prompts,
 * validator scores, evidence bounds, and exports structured trace JSON.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const TRACE_DIR = path.resolve(__dirname, '../../logs/traces');

class PipelineTracer {
  constructor(requestId, options = {}) {
    this.requestId = requestId || `req_${Date.now()}`;
    this.enabled = process.env.ENABLE_PIPELINE_TRACING !== 'false';
    this.startTime = performance.now();
    this.timestamp = new Date().toISOString();

    this.traceData = {
      version: '2.0.0',
      requestId: this.requestId,
      timestamp: this.timestamp,
      environment: process.env.NODE_ENV || 'development',
      provider: process.env.LLM_PROVIDER || 'mock',
      timeline: [],
      stages: {},
      decisions: [],
      prompts: [],
      validators: [],
      questionLineage: [],
      finalQuiz: null,
      metadata: {
        totalDurationMs: 0
      }
    };

    if (this.enabled) {
      this.ensureTraceDirectory();
    }
  }

  ensureTraceDirectory() {
    try {
      if (!fs.existsSync(TRACE_DIR)) {
        fs.mkdirSync(TRACE_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[PIPELINE_TRACER] Failed to create trace directory:', err.message);
    }
  }

  recordStageStart(stageNumber, stageName) {
    if (!this.enabled) return;
    const stageKey = `stage_${stageNumber}_${stageName.toLowerCase().replace(/\s+/g, '_')}`;
    this.traceData.stages[stageKey] = {
      stageNumber,
      stageName,
      startTimeMs: performance.now() - this.startTime,
      status: 'IN_PROGRESS',
      inputs: {},
      outputs: {},
      warnings: [],
      decisions: []
    };
  }

  recordStageComplete(stageNumber, stageName, inputs = {}, outputs = {}, warnings = [], decisions = []) {
    if (!this.enabled) return;
    const stageKey = `stage_${stageNumber}_${stageName.toLowerCase().replace(/\s+/g, '_')}`;
    const stage = this.traceData.stages[stageKey] || {
      stageNumber,
      stageName,
      startTimeMs: performance.now() - this.startTime
    };

    const endTimeMs = performance.now() - this.startTime;
    const durationMs = Math.round(endTimeMs - (stage.startTimeMs || 0));

    this.traceData.stages[stageKey] = {
      ...stage,
      status: 'COMPLETED',
      durationMs,
      inputs,
      outputs,
      warnings,
      decisions
    };

    this.traceData.timeline.push({
      stageNumber,
      stageName,
      durationMs,
      timestamp: new Date().toISOString()
    });
  }

  recordDecision(category, description, details = {}) {
    if (!this.enabled) return;
    this.traceData.decisions.push({
      timestamp: new Date().toISOString(),
      category,
      description,
      details
    });
  }

  recordPrompt(slotId, conceptLabel, systemPrompt, userPrompt, metadata = {}) {
    if (!this.enabled) return;
    this.traceData.prompts.push({
      slotId,
      conceptLabel,
      systemPrompt,
      userPrompt,
      metadata
    });
  }

  recordValidatorResult(slotId, result) {
    if (!this.enabled) return;
    this.traceData.validators.push({
      slotId,
      isValid: result.isValid,
      qualityScore: result.qualityScore,
      failureStage: result.failureStage,
      findings: result.findings,
      telemetry: result.telemetry
    });
  }

  setQuestionLineage(lineageArray) {
    if (!this.enabled) return;
    this.traceData.questionLineage = lineageArray || [];
  }

  finalizeTrace(finalQuizPayload) {
    if (!this.enabled) return this.traceData;

    this.traceData.finalQuiz = finalQuizPayload;
    this.traceData.metadata.totalDurationMs = Math.round(performance.now() - this.startTime);

    const filePath = path.join(TRACE_DIR, `trace_${this.requestId}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.traceData, null, 2), 'utf8');
      console.log(`[PIPELINE_TRACER] Trace saved: ${filePath} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error('[PIPELINE_TRACER] Error writing trace file:', err.message);
    }

    return this.traceData;
  }

  static loadTrace(requestId) {
    const filePath = path.join(TRACE_DIR, `trace_${requestId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
    return null;
  }

  static listTraces(limit = 20) {
    if (!fs.existsSync(TRACE_DIR)) return [];
    const files = fs.readdirSync(TRACE_DIR)
      .filter(f => f.startsWith('trace_') && f.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(TRACE_DIR, a));
        const statB = fs.statSync(path.join(TRACE_DIR, b));
        return statB.mtimeMs - statA.mtimeMs;
      })
      .slice(0, limit);

    return files.map(f => {
      const reqId = f.replace(/^trace_/, '').replace(/\.json$/, '');
      const filePath = path.join(TRACE_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        requestId: reqId,
        filename: f,
        sizeKb: Number((stats.size / 1024).toFixed(1)),
        updatedAt: stats.mtime
      };
    });
  }
}

module.exports = PipelineTracer;
