const { EventEmitter } = require('events');

class TelemetryService {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
    this.memoryLogs = new Map();
    this.aliases = new Map();
  }

  static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Register a bidirectional link between taskId and sessionId (or any two identifiers)
   * so event emissions and log lookups under either key resolve identically.
   */
  registerAlias(id1, id2) {
    if (!id1 || !id2 || id1 === id2) return;
    this.aliases.set(id1, id2);
    this.aliases.set(id2, id1);

    // If one already has logs and the other doesn't, sync logs
    const logs1 = this.memoryLogs.get(id1);
    const logs2 = this.memoryLogs.get(id2);
    if (logs1 && logs1.length > 0 && (!logs2 || logs2.length === 0)) {
      this.memoryLogs.set(id2, [...logs1]);
    } else if (logs2 && logs2.length > 0 && (!logs1 || logs1.length === 0)) {
      this.memoryLogs.set(id1, [...logs2]);
    }
  }

  getAlias(id) {
    return this.aliases.get(id) || null;
  }

  async emitStageUpdate(sessionId, payload) {
    if (!payload.timestamp) {
      payload.timestamp = Date.now();
    }
    await this.saveLog(sessionId, payload);
    this.emitter.emit(`telemetry:${sessionId}`, payload);

    const alias = this.aliases.get(sessionId);
    if (alias && alias !== sessionId) {
      await this.saveLog(alias, payload);
      this.emitter.emit(`telemetry:${alias}`, payload);
    }
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

  getLatestSessionId() {
    const keys = Array.from(this.memoryLogs.keys());
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  async getLogs(sessionId) {
    let list = this.memoryLogs.get(sessionId);
    if ((!list || list.length === 0) && this.aliases.has(sessionId)) {
      const alias = this.aliases.get(sessionId);
      list = this.memoryLogs.get(alias);
    }

    if ((!list || list.length === 0) && (sessionId === 'live-session' || sessionId === 'default_session' || sessionId === 'latest')) {
      const latestId = this.getLatestSessionId();
      if (latestId) {
        list = this.memoryLogs.get(latestId);
      }
    }
    return (list || []).sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = TelemetryService.getInstance();
