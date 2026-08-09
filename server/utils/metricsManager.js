/**
 * Centralized Metrics Manager for Caching & Observability
 */

class MetricsManager {
  constructor() {
    this.globalCounters = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      writesSkipped: 0,
      bytesSaved: 0,
      processingTimeSavedMs: 0
    };

    this.requestCounters = new Map();
  }

  getRequestMetrics(reqId) {
    if (!reqId) reqId = 'default';
    if (!this.requestCounters.has(reqId)) {
      this.requestCounters.set(reqId, {
        l1Hits: 0,
        l2Hits: 0,
        misses: 0,
        writesSkipped: 0,
        bytesSaved: 0,
        processingTimeSavedMs: 0
      });
    }
    return this.requestCounters.get(reqId);
  }

  recordL1Hit(reqId, processingTimeSavedMs = 0, bytesSaved = 0) {
    this.globalCounters.l1Hits++;
    this.globalCounters.processingTimeSavedMs += processingTimeSavedMs;
    this.globalCounters.bytesSaved += bytesSaved;

    const reqM = this.getRequestMetrics(reqId);
    reqM.l1Hits++;
    reqM.processingTimeSavedMs += processingTimeSavedMs;
    reqM.bytesSaved += bytesSaved;
  }

  recordL2Hit(reqId, processingTimeSavedMs = 0, bytesSaved = 0) {
    this.globalCounters.l2Hits++;
    this.globalCounters.processingTimeSavedMs += processingTimeSavedMs;
    this.globalCounters.bytesSaved += bytesSaved;

    const reqM = this.getRequestMetrics(reqId);
    reqM.l2Hits++;
    reqM.processingTimeSavedMs += processingTimeSavedMs;
    reqM.bytesSaved += bytesSaved;
  }

  recordMiss(reqId) {
    this.globalCounters.misses++;
    const reqM = this.getRequestMetrics(reqId);
    reqM.misses++;
  }

  recordSkip(reqId) {
    this.globalCounters.writesSkipped++;
    const reqM = this.getRequestMetrics(reqId);
    reqM.writesSkipped++;
  }

  getRequestSummary(reqId) {
    return this.getRequestMetrics(reqId);
  }

  getGlobalMetrics() {
    return { ...this.globalCounters };
  }

  clearRequestMetrics(reqId) {
    if (reqId) this.requestCounters.delete(reqId);
  }
}

module.exports = new MetricsManager();
