const { EventEmitter } = require('events');

class TelemetryService {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
    this.memoryLogs = new Map();
  }

  static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  async emitStageUpdate(sessionId, payload) {
    if (!payload.timestamp) {
      payload.timestamp = Date.now();
    }
    await this.saveLog(sessionId, payload);
    this.emitter.emit(`telemetry:${sessionId}`, payload);
  }

  subscribe(sessionId, callback) {
    const eventName = `telemetry:${sessionId}`;
    this.emitter.on(eventName, callback);
    return () => {
      this.emitter.off(eventName, callback);
    };
  }

  async saveLog(sessionId, stageData) {
    if (!this.memoryLogs.has(sessionId)) {
      this.memoryLogs.set(sessionId, []);
    }
    const list = this.memoryLogs.get(sessionId);
    const existingIdx = list.findIndex(item => item.stageNumber === stageData.stageNumber && item.status === stageData.status);
    if (existingIdx >= 0) {
      list[existingIdx] = stageData;
    } else {
      list.push(stageData);
    }
  }

  async getLogs(sessionId) {
    return (this.memoryLogs.get(sessionId) || []).sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = TelemetryService.getInstance();
