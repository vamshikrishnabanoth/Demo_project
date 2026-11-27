/**
 * server/engine/observability/debugRecorder.js
 *
 * Level 2 Observability: Persistent Stage Debug JSON Recorder.
 * Automatically persists structured snapshots of every pipeline stage to:
 *   server/logs/debug/sessions/<sessionId>/<stageOrder>_<stageName>.json
 *
 * Captures: input, processing metadata, calculations, decision justifications (WHY),
 * evidence citations, errors, and output.
 */

'use strict';

const fs = require('fs');
const path = require('path');

class DebugRecorder {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../../logs/debug/sessions');
  }

  /** Ensure session directory exists */
  _ensureSessionDir(sessionId) {
    const sessionDir = path.join(this.baseDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  /**
   * Save a stage snapshot to disk.
   * @param {String} sessionId
   * @param {String} filename - e.g. "01_ingestion.json", "06_agent1.json"
   * @param {Object} stageRecord - Complete Universal Stage Record
   */
  async recordStage(sessionId, filename, stageRecord) {
    try {
      const sessionDir = this._ensureSessionDir(sessionId);
      const filePath = path.join(sessionDir, filename);

      const payload = {
        sessionId,
        filename,
        recordedAt: new Date().toISOString(),
        ...stageRecord
      };

      await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      return filePath;
    } catch (err) {
      console.warn(`⚠️ [DebugRecorder] Failed to write stage debug log for ${filename}: ${err.message}`);
      return null;
    }
  }

  /** Save the complete aggregated session trace */
  async recordFinalTrace(sessionId, traceData) {
    return this.recordStage(sessionId, 'final_session_trace.json', traceData);
  }
}

module.exports = new DebugRecorder();
