/**
 * Phase 3 — Item Versioning & Lineage Manager
 * Tracks item revision history (v1 -> v2 -> v3), change logs, diffs, and trigger reasons.
 */

'use strict';

class ItemVersionManager {
  constructor() {
    this.versionStore = new Map(); // questionId -> Array of ItemVersion objects
  }

  createInitialVersion(questionId, questionPayload) {
    if (!questionId || !questionPayload) return null;

    const initialRecord = {
      versionNumber: 1,
      timestamp: new Date().toISOString(),
      questionId,
      stem: questionPayload.stem || questionPayload.questionText || '',
      options: Array.isArray(questionPayload.options) ? [...questionPayload.options] : [],
      correctAnswer: questionPayload.correctAnswer || '',
      explanation: questionPayload.explanation || '',
      changeReason: 'Initial AI Generation',
      diffNotes: 'Baseline version created'
    };

    this.versionStore.set(questionId, [initialRecord]);
    return initialRecord;
  }

  createRevision(questionId, updatedPayload, changeReason = 'Teacher Edit') {
    const history = this.versionStore.get(questionId) || [];
    const lastVersion = history.length > 0 ? history[history.length - 1] : null;

    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;
    const diffNotes = lastVersion ? `Updated from v${lastVersion.versionNumber}: ${changeReason}` : 'Revised version created';

    const newRecord = {
      versionNumber,
      timestamp: new Date().toISOString(),
      questionId,
      stem: updatedPayload.stem || updatedPayload.questionText || (lastVersion ? lastVersion.stem : ''),
      options: Array.isArray(updatedPayload.options) ? [...updatedPayload.options] : (lastVersion ? lastVersion.options : []),
      correctAnswer: updatedPayload.correctAnswer || (lastVersion ? lastVersion.correctAnswer : ''),
      explanation: updatedPayload.explanation || (lastVersion ? lastVersion.explanation : ''),
      changeReason,
      diffNotes
    };

    history.push(newRecord);
    this.versionStore.set(questionId, history);
    return newRecord;
  }

  getVersionHistory(questionId) {
    return this.versionStore.get(questionId) || [];
  }

  getLatestVersion(questionId) {
    const history = this.versionStore.get(questionId) || [];
    return history.length > 0 ? history[history.length - 1] : null;
  }
}

module.exports = new ItemVersionManager();
