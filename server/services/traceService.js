/**
 * Trace Service for Live Pipeline Observability & Explainability Workbench
 * Emits structured JSONL trace events per request.
 * 
 * Invariants:
 * - Asynchronous appending: does not block the event loop.
 * - Zero fabricated data: records exact inputs, outputs, decisions, and timings.
 * - Auto-creates traces directory and updates manifest.json.
 */

const fs = require('fs');
const path = require('path');
const featureFlags = require('../config/featureFlags');

class TraceService {
  constructor() {
    this.tracesDir = path.resolve(__dirname, '..', '..', featureFlags.TRACE_LOG_DIR);
    this.manifestPath = path.join(this.tracesDir, 'manifest.json');
    this.activeTraces = new Map();
    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.tracesDir)) {
        fs.mkdirSync(this.tracesDir, { recursive: true });
      }
      if (!fs.existsSync(this.manifestPath)) {
        fs.writeFileSync(this.manifestPath, JSON.stringify({ traces: [] }, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('[TraceService] Failed to initialize trace storage directory:', err.message);
    }
  }

  /**
   * Starts a new trace for an incoming request.
   */
  startTrace(requestId, sessionId, meta = {}) {
    if (!featureFlags.ENABLE_STRUCTURED_TRACING) return null;

    const traceId = meta.traceId || `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const traceMeta = {
      traceId,
      requestId,
      sessionId: sessionId || 'default_session',
      startTime: new Date().toISOString(),
      componentVersion: meta.componentVersion || 'v3.5-shadow',
      featureFlags: {
        SHADOW_MODE_ENABLED: featureFlags.SHADOW_MODE_ENABLED,
        ENABLE_P5_INTELLIGENCE: featureFlags.ENABLE_P5_INTELLIGENCE,
        ALLOW_P5_LIVE_BLOCKING: featureFlags.ALLOW_P5_LIVE_BLOCKING
      }
    };

    this.activeTraces.set(requestId, traceMeta);

    this.emitEvent({
      traceId,
      requestId,
      sessionId: traceMeta.sessionId,
      stage: 'INPUT_INGESTION',
      substage: 'REQUEST_RECEIVED',
      status: 'STARTED',
      configuration: {
        componentVersion: traceMeta.componentVersion,
        featureFlags: traceMeta.featureFlags,
        parameters: meta.parameters || {}
      },
      inputs: {
        payloadSummary: meta.payloadSummary || 'Quiz generation request initiated'
      }
    });

    return traceId;
  }

  /**
   * Emit a single structured trace event (appends to <requestId>.jsonl).
   */
  emitEvent(event) {
    if (!featureFlags.ENABLE_STRUCTURED_TRACING) return;

    try {
      const requestId = event.requestId || 'unassigned';
      const filePath = path.join(this.tracesDir, `${requestId}.jsonl`);
      
      const payload = {
        traceId: event.traceId || (this.activeTraces.get(requestId) ? this.activeTraces.get(requestId).traceId : 'unknown'),
        requestId,
        sessionId: event.sessionId || (this.activeTraces.get(requestId) ? this.activeTraces.get(requestId).sessionId : 'default_session'),
        timestamp: event.timestamp || new Date().toISOString(),
        stage: event.stage,
        substage: event.substage || null,
        status: event.status || 'COMPLETED',
        durationMs: typeof event.durationMs === 'number' ? event.durationMs : undefined,
        configuration: event.configuration || undefined,
        inputs: event.inputs || undefined,
        outputs: event.outputs || undefined,
        decisions: event.decisions || undefined,
        modelCall: event.modelCall || undefined,
        error: event.error || undefined,
        evidenceRefs: event.evidenceRefs || undefined
      };

      const line = JSON.stringify(payload) + '\n';
      fs.appendFile(filePath, line, (err) => {
        if (err) console.error(`[TraceService] Failed appending event for ${requestId}:`, err.message);
      });
    } catch (err) {
      console.error('[TraceService] Error emitting trace event:', err.message);
    }
  }

  /**
   * Complete the trace and update manifest.json.
   */
  completeTrace(requestId, finalStatus = 'COMPLETED', summary = {}) {
    if (!featureFlags.ENABLE_STRUCTURED_TRACING) return;

    const traceMeta = this.activeTraces.get(requestId);
    const traceId = traceMeta ? traceMeta.traceId : 'unknown';
    const filePath = path.join(this.tracesDir, `${requestId}.jsonl`);

    this.emitEvent({
      traceId,
      requestId,
      sessionId: traceMeta ? traceMeta.sessionId : 'default_session',
      stage: 'STORAGE_PERSISTENCE',
      substage: 'TRACE_FINALIZED',
      status: finalStatus,
      outputs: summary
    });

    // Update manifest
    try {
      let manifest = { traces: [] };
      if (fs.existsSync(this.manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      }

      const existingIndex = manifest.traces.findIndex(t => t.requestId === requestId);
      const manifestEntry = {
        requestId,
        traceId,
        sessionId: traceMeta ? traceMeta.sessionId : 'default_session',
        timestamp: new Date().toISOString(),
        finalStatus,
        traceFile: `${requestId}.jsonl`,
        summary
      };

      if (existingIndex >= 0) {
        manifest.traces[existingIndex] = manifestEntry;
      } else {
        manifest.traces.push(manifestEntry);
      }

      fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TraceService] Error updating manifest:', err.message);
    } finally {
      this.activeTraces.delete(requestId);
    }
  }

  /**
   * Helper to execute and trace an async block with duration measurement.
   */
  async traceBlock(requestId, stage, substage, fn, inputData = {}) {
    const start = Date.now();
    this.emitEvent({
      requestId,
      stage,
      substage,
      status: 'STARTED',
      inputs: inputData
    });

    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.emitEvent({
        requestId,
        stage,
        substage,
        status: 'COMPLETED',
        durationMs,
        outputs: result
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      this.emitEvent({
        requestId,
        stage,
        substage,
        status: 'FAILED',
        durationMs,
        error: {
          message: err.message,
          stack: err.stack,
          fallbackTriggered: false
        }
      });
      throw err;
    }
  }
}

module.exports = new TraceService();
