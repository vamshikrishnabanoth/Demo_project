/**
 * server/engine/docketPolicy.js
 *
 * Enforces the formal Assessment Docket Policy for Architecture E + Production Hardening:
 * - Up to 4 audio files across accumulated draft
 * - Up to 180 minutes (3 hours) cumulative audio duration
 * - Up to 180 minutes (3 hours) for any single audio recording
 * - Warning on brief recordings (< 2 minutes)
 * - Up to 5 supporting documents across accumulated draft
 * - Up to 100 pages cumulative
 * - Up to 50 MB total document size
 * - Question request range: 1 to 30 MCQs
 *
 * Docket limits are evaluated against the COMPLETE accumulated draft docket.
 */

'use strict';

const DOCKET_LIMITS = {
  MAX_AUDIO_FILES: 4,
  MAX_TOTAL_AUDIO_DURATION_SEC: 10800, // 180 minutes (3 hours)
  MAX_SINGLE_AUDIO_DURATION_SEC: 10800, // 180 minutes (3 hours)
  MIN_INFORMATIVE_AUDIO_SEC: 120, // 2 minutes
  MAX_DOCUMENTS: 5,
  MAX_TOTAL_PAGES: 100,
  MAX_TOTAL_DOC_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MIN_REQUESTED_QUESTIONS: 1,
  MAX_REQUESTED_QUESTIONS: 30
};

class DocketPolicy {
  /**
   * Get the current frozen docket limits.
   */
  static getLimits() {
    return { ...DOCKET_LIMITS };
  }

  /**
   * Validate the complete accumulated docket plus any new incoming materials.
   * @param {Object} params
   * @param {Array} [params.accumulatedAudio=[]] - Existing audio items in draft docket
   * @param {Array} [params.newAudio=[]] - New audio items being added
   * @param {Array} [params.accumulatedDocs=[]] - Existing doc items in draft docket
   * @param {Array} [params.newDocs=[]] - New doc items being added
   * @param {Number} [params.requestedCount=10] - Number of MCQs requested
   * @returns {Object} { isValid: boolean, error: string | null, warnings: string[], metrics: Object }
   */
  static validateDocket({
    accumulatedAudio = [],
    newAudio = [],
    accumulatedDocs = [],
    newDocs = [],
    requestedCount = 10
  } = {}) {
    const warnings = [];
    const allAudio = [...(accumulatedAudio || []), ...(newAudio || [])];
    const allDocs = [...(accumulatedDocs || []), ...(newDocs || [])];

    // 1. Question Count Bounds
    const count = parseInt(requestedCount, 10);
    if (isNaN(count) || count < DOCKET_LIMITS.MIN_REQUESTED_QUESTIONS || count > DOCKET_LIMITS.MAX_REQUESTED_QUESTIONS) {
      return {
        isValid: false,
        error: "Requested question count (" + requestedCount + ") is outside the supported range of " + DOCKET_LIMITS.MIN_REQUESTED_QUESTIONS + " to " + DOCKET_LIMITS.MAX_REQUESTED_QUESTIONS + " MCQs.",
        warnings,
        metrics: {}
      };
    }

    // 2. Audio File Count Boundary (evaluated against accumulated docket)
    if (allAudio.length > DOCKET_LIMITS.MAX_AUDIO_FILES) {
      return {
        isValid: false,
        error: "Accumulated docket limit exceeded: Maximum " + DOCKET_LIMITS.MAX_AUDIO_FILES + " audio recordings allowed per assessment. The docket currently has " + allAudio.length + " recordings. Please remove an existing recording or continue with the current docket.",
        warnings,
        metrics: { totalAudioFiles: allAudio.length }
      };
    }

    // 3. Audio Duration Boundaries (single file & cumulative)
    let totalAudioSec = 0;
    for (let i = 0; i < allAudio.length; i++) {
      const a = allAudio[i];
      const durationSec = Number(a.duration || a.durationSec || 0);
      const name = a.name || a.filename || a.originalname || ("Audio " + (i + 1));

      if (durationSec > DOCKET_LIMITS.MAX_SINGLE_AUDIO_DURATION_SEC) {
        return {
          isValid: false,
          error: "Individual recording limit exceeded: Recording '" + name + "' duration is " + Math.round(durationSec / 60) + " minutes. Maximum allowed is 180 minutes (3 hours) per recording session.",
          warnings,
          metrics: { offendingFile: name, durationSec }
        };
      }

      if (durationSec > 0 && durationSec < DOCKET_LIMITS.MIN_INFORMATIVE_AUDIO_SEC) {
        warnings.push("Recording '" + name + "' is very short (" + Math.round(durationSec) + "s). Question capacity will be bounded by available academic evidence.");
      }

      totalAudioSec += durationSec;
    }

    if (totalAudioSec > DOCKET_LIMITS.MAX_TOTAL_AUDIO_DURATION_SEC) {
      return {
        isValid: false,
        error: "Cumulative audio limit exceeded: Total audio duration across accumulated docket is " + Math.round(totalAudioSec / 60) + " minutes. Maximum allowed is 180 minutes (3 hours). Please remove or trim one recording.",
        warnings,
        metrics: { totalAudioDurationSec: totalAudioSec }
      };
    }

    // Real-time approaching limit warning (within 10 minutes)
    if (totalAudioSec >= 10200 && totalAudioSec <= DOCKET_LIMITS.MAX_TOTAL_AUDIO_DURATION_SEC) {
      const remainingMin = Math.round((DOCKET_LIMITS.MAX_TOTAL_AUDIO_DURATION_SEC - totalAudioSec) / 60);
      warnings.push("Approaching cumulative audio limit: " + remainingMin + " minute(s) of recording time remaining in this assessment docket.");
    }

    // 4. Document Count Boundary
    if (allDocs.length > DOCKET_LIMITS.MAX_DOCUMENTS) {
      return {
        isValid: false,
        error: "Accumulated docket limit exceeded: Maximum " + DOCKET_LIMITS.MAX_DOCUMENTS + " supporting documents allowed per assessment. The docket currently has " + allDocs.length + " documents.",
        warnings,
        metrics: { totalDocs: allDocs.length }
      };
    }

    // 5. Document Page & Size Boundaries
    let totalPages = 0;
    let totalSizeBytes = 0;

    for (let j = 0; j < allDocs.length; j++) {
      const d = allDocs[j];
      const pages = Number(d.pages || d.totalPages || d.pageCount || 1);
      const sizeBytes = Number(d.size || d.sizeBytes || d.fileSizeBytes || 0);
      totalPages += pages;
      totalSizeBytes += sizeBytes;
    }

    if (totalPages > DOCKET_LIMITS.MAX_TOTAL_PAGES) {
      return {
        isValid: false,
        error: "Document page limit exceeded: Combined documents contain " + totalPages + " pages. Maximum allowed is " + DOCKET_LIMITS.MAX_TOTAL_PAGES + " pages. Please select specific page ranges for large documents.",
        warnings,
        metrics: { totalPages }
      };
    }

    if (totalSizeBytes > DOCKET_LIMITS.MAX_TOTAL_DOC_SIZE_BYTES) {
      const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
      return {
        isValid: false,
        error: "Document size limit exceeded: Combined documents are " + sizeMB + " MB. Maximum allowed is 50 MB.",
        warnings,
        metrics: { totalSizeBytes }
      };
    }

    return {
      isValid: true,
      error: null,
      warnings,
      metrics: {
        totalAudioFiles: allAudio.length,
        totalAudioDurationSec: totalAudioSec,
        totalDocs: allDocs.length,
        totalPages,
        totalSizeBytes
      }
    };
  }
}

module.exports = DocketPolicy;
