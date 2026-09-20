/**
 * server/utils/productionMetrics.js
 *
 * Production Metrics & Cost Observability Collector.
 * Tracks upload counts, stage durations, LLM/OCR/Vision volumes, token estimates, and failure codes.
 */

'use strict';

class ProductionMetrics {
  constructor() {
    this.counters = {
      documents_uploaded_total: 0,
      documents_processed_total: 0,
      documents_failed_total: 0,

      mcqs_generated_total: 0,
      mcqs_rejected_total: 0,

      ocr_requests_total: 0,
      vision_requests_total: 0,
      embedding_requests_total: 0,
      llm_requests_total: 0,

      retry_count: 0,
      provider_failure_count: 0,

      insufficient_evidence_count: 0,
      grounding_rejection_count: 0,

      // Token & Cost Observability
      estimated_input_tokens: 0,
      estimated_output_tokens: 0
    };

    this.latencies = {
      retrieval: [],
      generation: [],
      ocr: [],
      vision: [],
      total_job: []
    };

    this.maxLatencySamples = 500;
  }

  inc(counterName, amount = 1) {
    if (this.counters[counterName] !== undefined) {
      this.counters[counterName] += amount;
    }
  }

  recordLatency(type, ms) {
    if (this.latencies[type]) {
      this.latencies[type].push(ms);
      if (this.latencies[type].length > this.maxLatencySamples) {
        this.latencies[type].shift();
      }
    }
  }

  recordTokens(inputTokens = 0, outputTokens = 0) {
    this.counters.estimated_input_tokens += inputTokens;
    this.counters.estimated_output_tokens += outputTokens;
  }

  _calculatePercentiles(samples) {
    if (!samples || samples.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = Math.round(sorted.reduce((sum, v) => sum + v, 0) / sorted.length);
    return { p50, p95, p99, avg };
  }

  getMetricsSummary() {
    return {
      counters: { ...this.counters },
      latencies: {
        total_job: this._calculatePercentiles(this.latencies.total_job),
        generation: this._calculatePercentiles(this.latencies.generation),
        retrieval: this._calculatePercentiles(this.latencies.retrieval),
        ocr: this._calculatePercentiles(this.latencies.ocr),
        vision: this._calculatePercentiles(this.latencies.vision)
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new ProductionMetrics();
