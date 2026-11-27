/**
 * server/engine/observability/stageLogger.js
 *
 * Level 1 Observability: Developer Terminal Logger.
 * Emits clear, structured, readable logs highlighting:
 * - What entered the stage
 * - What was calculated & why decisions were made
 * - Model, duration, target IDs, attempts, and verification results.
 */

'use strict';

class StageLogger {
  logStage({ stage, sessionId, status, durationMs, model, details = {}, decisions = [], calculations = null }) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const header = `[${timestamp}] [${stage.padEnd(16)}] session=${sessionId} | status=${status}${durationMs ? ` (${durationMs}ms)` : ''}${model ? ` | model=${model}` : ''}`;
    console.log(header);

    if (decisions && decisions.length > 0) {
      console.log(`   💡 WHY / DECISIONS:`);
      decisions.forEach(d => console.log(`      • ${d}`));
    }

    if (calculations) {
      console.log(`   🔢 CALCULATIONS:`);
      Object.entries(calculations).forEach(([key, val]) => {
        console.log(`      • ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      });
    }

    if (details.reason) {
      console.log(`   ⚠️ REASON: ${details.reason}`);
    }
    if (details.repair) {
      console.log(`   🔧 REPAIR: ${details.repair}`);
    }
  }

  logTargetSummary(targetId, concept, dimension, difficulty, evidenceChunks = []) {
    console.log(`   🎯 TARGET [${targetId}]: ${concept}`);
    console.log(`      Dimension: ${dimension} | Difficulty: ${difficulty} | Evidence: [${evidenceChunks.join(', ')}]`);
  }

  logMCQSummary(qIdx, questionText, correctAnswer, optionsCount = 4) {
    console.log(`   📝 Q${qIdx}: "${questionText.substring(0, 80)}..."`);
    console.log(`      Correct: "${correctAnswer}" | Options: ${optionsCount}`);
  }
}

module.exports = new StageLogger();
