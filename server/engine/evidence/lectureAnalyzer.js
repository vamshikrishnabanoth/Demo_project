/**
 * server/engine/evidence/lectureAnalyzer.js
 *
 * Two-Task Lecture Understanding & Pedagogical Sequence Reconstruction.
 * Reuses depthAnalyzer for semantic segment classification and curricular extraction.
 *
 * Task 1: Content Cleaning & Segment Classification (Filter non-academic chatter, retain student Q&A)
 * Task 2: Pedagogical Lecture Reconstruction (Topic, Motivation, Definitions, Analogies, Source Attribution)
 */

'use strict';

const depthAnalyzer = require('./depthAnalyzer');
const lectureIntelligence = require('../intelligence/lectureIntelligence');

class LectureAnalyzer {
  /**
   * Split raw transcript text into segments for processing.
   * Explicitly leaves timestamps as null for text-only inputs (does not invent timestamps).
   *
   * @param {string} rawText
   * @returns {Array<Object>}
   */
  parseTranscriptIntoSegments(rawInput) {
    if (!rawInput) return [];

    // Support pre-parsed segment arrays or objects containing a segments array
    const rawSegments = Array.isArray(rawInput) ? rawInput : (Array.isArray(rawInput.segments) ? rawInput.segments : null);
    if (rawSegments) {
      return rawSegments.map((seg, idx) => {
        const segText = (seg.text || '').trim();
        const startSec = (seg.start !== undefined && seg.start !== null) ? Number(seg.start) : null;
        const endSec = (seg.end !== undefined && seg.end !== null) ? Number(seg.end) : null;
        const tsFormatted = (startSec !== null && endSec !== null)
          ? `${this.formatTimestamp(startSec)} - ${this.formatTimestamp(endSec)}`
          : (startSec !== null ? this.formatTimestamp(startSec) : null);
        const classification = depthAnalyzer.classifySegment(segText);

        return {
          id: seg.id || `seg_${idx + 1}`,
          text: segText,
          start: startSec,
          end: endSec,
          timestamp: tsFormatted,
          timestamp_end: endSec !== null ? this.formatTimestamp(endSec) : null,
          speaker: seg.speaker || 'Teacher',
          type: classification.type || 'curricular',
          confidence: classification.confidence || 0.8,
          reason: classification.reason || 'Segment analysis'
        };
      });
    }

    if (typeof rawInput !== 'string') return [];
    const textSegments = depthAnalyzer.segmentText(rawInput);
    return textSegments.map((text, idx) => {
      const segText = text.trim();
      const classification = depthAnalyzer.classifySegment(segText);
      return {
        id: `seg_${idx + 1}`,
        text: segText,
        start: null,
        end: null,
        timestamp: null,
        timestamp_end: null,
        speaker: 'Teacher',
        type: classification.type || 'curricular',
        confidence: classification.confidence || 0.8,
        reason: classification.reason || 'Segment analysis'
      };
    });
  }

  /**
   * Format seconds to HH:MM:SS or MM:SS
   *
   * @param {number} seconds
   * @returns {string}
   */
  formatTimestamp(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) {
      return null;
    }
    const s = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  /**
   * Analyze lecture recording or transcript.
   * Reuses depthAnalyzer under the hood to ensure consistency across the application.
   *
   * @param {Object} params - { rawText, segments, audioMetadata }
   * @returns {Object} analysisResult
   */
  async analyzeLecture({ rawText, segments = [], audioMetadata = null, fileName = null, requestedCount = null, requestedDifficulty = null }) {
    const text = (rawText || '').trim();
    if (!text || text.length < 15) {
      return {
        isAcademic: false,
        isCurricular: false,
        reason: 'INSUFFICIENT_CONTENT: The lecture recording or transcript does not contain enough speech content to analyze.',
        cleanedTranscript: '',
        rawTranscript: text,
        concepts: [],
        segments: [],
        pedagogical_reconstruction: {
          main_topic: 'Insufficient Content',
          subtopics: [],
          lectureDepth: { rating: 'Non-Academic', score: 0, characteristics: {} },
          summary: 'Insufficient content provided for pedagogical analysis.'
        },
        lecture_intelligence: null,
        audioMetadata
      };
    }

    // 1. Run depthAnalyzer on the transcript text
    const depthResult = depthAnalyzer.analyzeLecture(text);

    // 2. Classify and map segments
    let classifiedSegments = [];
    if (Array.isArray(segments) && segments.length > 0) {
      let prevText = null;
      classifiedSegments = segments.map((seg) => {
        const segText = seg.text || '';
        const classification = depthAnalyzer.classifySegment(segText, prevText);
        prevText = segText;
        return {
          id: seg.id,
          text: segText,
          start: seg.start !== undefined ? seg.start : null,
          end: seg.end !== undefined ? seg.end : null,
          timestamp: seg.timestamp || (seg.start !== null && seg.start !== undefined ? this.formatTimestamp(seg.start) : null),
          timestamp_end: seg.timestamp_end || (seg.end !== null && seg.end !== undefined ? this.formatTimestamp(seg.end) : null),
          speaker: seg.speaker || 'Teacher',
          type: classification.type,
          confidence: classification.confidence,
          reason: classification.reason
        };
      });
    } else {
      // Map from depthResult classified segments (text-only: start/end are strictly null)
      classifiedSegments = this.parseTranscriptIntoSegments(text).map(seg => {
        const classification = depthAnalyzer.classifySegment(seg.text);
        return {
          ...seg,
          type: classification.type,
          confidence: classification.confidence,
          reason: classification.reason
        };
      });
    }

    // 3. Task 1: Content Cleaning - Retain Curricular and Pedagogical instructional content, strip Administrative chatter
    const cleanedSegments = classifiedSegments.filter(s => s.type !== 'ADMINISTRATIVE');
    const cleanedTranscript = cleanedSegments.map(s => s.text).join(' ').trim();

    // 4. Task 2: Pedagogical Reconstruction & Concept Extraction
    const mainTopic = (depthResult.detectedFocus && depthResult.detectedFocus.length > 0)
      ? depthResult.detectedFocus[0]
      : 'Core Instructional Topic';

    const concepts = (depthResult.detectedFocus || []).map((focusTerm, idx) => {
      const matchingSeg = depthResult.curricularSegments.find(s => 
        (s.text || '').toLowerCase().includes(focusTerm.toLowerCase()) ||
        (s.classification?.matchedTerms || []).some(t => t.toLowerCase() === focusTerm.toLowerCase())
      );

      return {
        concept_id: `C${String(idx + 1).padStart(2, '0')}`,
        concept_name: focusTerm,
        definition: matchingSeg ? matchingSeg.text : `Instructional concept covered during the lecture regarding ${focusTerm}.`,
        why_needed: matchingSeg?.classification?.substanceType || 'Core Mechanism',
        substanceType: matchingSeg?.classification?.substanceType || 'DEFINITION_OR_FACT'
      };
    });

    // 5. Task 3: Invoke Lecture Intelligence Engine (Module 1)
    const hasAudioTimestamps = Array.isArray(classifiedSegments) && classifiedSegments.some(s => s.start !== null && s.start !== undefined);
    let lectureIntel = null;
    try {
      lectureIntel = await lectureIntelligence.analyze({
        evidenceText: cleanedTranscript || text,
        segments: classifiedSegments,
        modality: hasAudioTimestamps ? 'VOICE_ONLY' : 'DOCUMENT_ONLY',
        hasTimingData: hasAudioTimestamps,
        fileName: fileName || audioMetadata?.originalName || null,
        requestedCount,
        requestedDifficulty
      });
    } catch (intelErr) {
      console.warn('[LectureAnalyzer] Lecture intelligence analysis failed, using fallback:', intelErr.message);
      lectureIntel = lectureIntelligence.buildPartialFallback({
        evidenceText: cleanedTranscript || text,
        modality: hasAudioTimestamps ? 'VOICE_ONLY' : 'DOCUMENT_ONLY',
        hasTimingData: hasAudioTimestamps,
        errorReason: intelErr.message
      });
    }

    const intelligentTitle = lectureIntel?.title || mainTopic;

    return {
      isAcademic: depthResult.isAcademic,
      isCurricular: depthResult.isCurricular,
      reason: depthResult.reason,
      lectureDepth: depthResult.lectureDepth,
      detectedFocus: depthResult.detectedFocus,
      cleanedTranscript: cleanedTranscript || text,
      rawTranscript: text,
      concepts,
      segments: classifiedSegments,
      pedagogical_reconstruction: {
        main_topic: intelligentTitle,
        subtopics: depthResult.detectedFocus,
        lectureDepth: depthResult.lectureDepth,
        summary: lectureIntel?.summary || `Lecture focused on ${intelligentTitle} with ${depthResult.lectureDepth.rating} depth (${depthResult.lectureDepth.score}/100).`
      },
      lecture_intelligence: lectureIntel,
      audioMetadata
    };
  }
}

module.exports = new LectureAnalyzer();
