/**
 * server/engine/observability/telemetryLedger.js
 *
 * Operational Telemetry Ledger for Phase 2:
 * Captures granular per-job operational metrics in append-only JSONL format:
 * - job_id, request_id, stage, provider, model
 * - start_time, end_time, duration_ms
 * - llm_calls, input_tokens_actual, input_tokens_estimated
 * - output_tokens_actual, output_tokens_estimated
 * - attempt, retries, status, grounding_score, error_code
 *
 * Strict Separation:
 * - Business Data -> DB / taskManager
 * - Operational Telemetry -> server/logs/operational_telemetry.jsonl
 * - Debug Payloads -> server/logs/debug/sessions/...
 */

'use strict';

const fs = require('fs');
const path = require('path');

class TelemetryLedger {
  constructor() {
    this.logDir = path.resolve(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'operational_telemetry.jsonl');
    this.recentJobs = [];
    this.maxMemoryBuffer = 100;

    // Cumulative token tracker by sessionId
    this.sessionUsage = new Map();

    this._ensureLogDirectory();
  }

  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (_) {}
  }

  /**
   * Record token usage from an individual LLM call.
   */
  recordCallUsage(sessionId, { prompt = '', completion = '', usage = null, requestId = null, model = null, provider = 'groq' }) {
    if (!sessionId) return;

    if (!this.sessionUsage.has(sessionId)) {
      this.sessionUsage.set(sessionId, {
        llm_calls: 0,
        input_tokens_actual: 0,
        input_tokens_estimated: 0,
        output_tokens_actual: 0,
        output_tokens_estimated: 0,
        has_actual_tokens: false,
        request_ids: [],
        models: new Set(),
        provider: provider
      });
    }

    const data = this.sessionUsage.get(sessionId);
    data.llm_calls += 1;
    if (model) data.models.add(model);
    if (requestId) data.request_ids.push(requestId);

    // Actual tokens from API if provided
    if (usage && typeof usage.prompt_tokens === 'number') {
      data.has_actual_tokens = true;
      data.input_tokens_actual += usage.prompt_tokens;
      data.output_tokens_actual += (usage.completion_tokens || 0);
    }

    // Deterministic estimated tokens (approx 4 chars per token)
    const estIn = Math.ceil((prompt.length || 0) / 4);
    const estOut = Math.ceil((completion.length || 0) / 4);
    data.input_tokens_estimated += estIn;
    data.output_tokens_estimated += estOut;
  }

  /**
   * Record a completed or failed job entry into the operational ledger.
   */
  recordJob({
    job_id,
    request_id = null,
    stage = 'OVERALL',
    provider = 'groq',
    model = null,
    start_time,
    end_time,
    duration_ms = 0,
    llm_calls = 0,
    input_tokens_actual = null,
    input_tokens_estimated = null,
    output_tokens_actual = null,
    output_tokens_estimated = null,
    attempt = 1,
    retries = 0,
    status = 'COMPLETED',
    grounding_score = null,
    error_code = 'NONE'
  }) {
    // Pull tracked cumulative data if available
    const tracked = this.sessionUsage.get(job_id) || {};

    const finalRecord = {
      job_id: job_id || 'unknown_job',
      request_id: request_id || (tracked.request_ids && tracked.request_ids[0]) || null,
      stage,
      provider: provider || tracked.provider || 'groq',
      model: model || (tracked.models ? Array.from(tracked.models).join(', ') : 'openai/gpt-oss-120b'),
      start_time: start_time ? new Date(start_time).toISOString() : new Date().toISOString(),
      end_time: end_time ? new Date(end_time).toISOString() : new Date().toISOString(),
      duration_ms: duration_ms || 0,
      llm_calls: llm_calls || tracked.llm_calls || 0,
      input_tokens_actual: tracked.has_actual_tokens ? tracked.input_tokens_actual : input_tokens_actual,
      input_tokens_estimated: input_tokens_estimated || tracked.input_tokens_estimated || 0,
      output_tokens_actual: tracked.has_actual_tokens ? tracked.output_tokens_actual : output_tokens_actual,
      output_tokens_estimated: output_tokens_estimated || tracked.output_tokens_estimated || 0,
      attempt,
      retries,
      status,
      grounding_score: typeof grounding_score === 'number' ? Number(grounding_score.toFixed(3)) : null,
      error_code: error_code || 'NONE'
    };

    // 1. Maintain in-memory ring buffer
    this.recentJobs.unshift(finalRecord);
    if (this.recentJobs.length > this.maxMemoryBuffer) {
      this.recentJobs.pop();
    }

    // 2. Append to operational JSONL log
    try {
      this._ensureLogDirectory();
      fs.appendFileSync(this.logFile, JSON.stringify(finalRecord) + '\n', 'utf8');
    } catch (err) {
      console.warn('⚠️ [TelemetryLedger] Could not append to operational_telemetry.jsonl:', err.message);
    }

    // 3. Clear session usage memory
    this.sessionUsage.delete(job_id);

    return finalRecord;
  }

  getRecentJobs(limit = 10) {
    return this.recentJobs.slice(0, limit);
  }
}

module.exports = new TelemetryLedger();
