/**
 * server/engine/evidence/lectureAnalyzer.js
 *
 * Pedagogy-Aware Lecture Understanding & Semantic Sequence Reconstruction (v4.0).
 * Reuses depthAnalyzer for multi-label segment classification, partial evidence extraction, and curricular linking.
 *
 * Task 1: Pedagogy-Aware Content Cleaning & Segment Classification
 *         (Extracts evidence from KEEP_WHOLE & KEEP_PARTIAL, discards administrative/fictional noise)
 * Task 2: Pedagogical Lecture Reconstruction (Topic, Motivation, Definitions, Analogies, Teacher Experiences)
 */

'use strict';

const depthAnalyzer = require('./depthAnalyzer');
let lectureIntelligence = null;
function getLectureIntelligence() {
  if (!lectureIntelligence) {
    try {
      lectureIntelligence = require('../intelligence/lectureIntelligence');
    } catch (_) {}
  }
  return lectureIntelligence;
}

class LectureAnalyzer {
  /**
   * Split raw transcript text into segments for processing.
   * Explicitly leaves timestamps as null for text-only inputs.
   *
   * @param {string|Array} rawInput
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
          type: classification.type || 'CORE_EXPLANATION',
          teaching_value: classification.teaching_value !== undefined ? classification.teaching_value : 0.8,
          concept_links: classification.concept_links || [],
          evidence_text: classification.evidence_text || segText,
          action: classification.action || 'KEEP_WHOLE',
          substanceType: classification.substanceType || 'DEFINITION_OR_FACT',
          confidence: classification.confidence || 'HIGH',
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
        type: classification.type || 'CORE_EXPLANATION',
        teaching_value: classification.teaching_value !== undefined ? classification.teaching_value : 0.8,
        concept_links: classification.concept_links || [],
        evidence_text: classification.evidence_text || segText,
        action: classification.action || 'KEEP_WHOLE',
        substanceType: classification.substanceType || 'DEFINITION_OR_FACT',
        confidence: classification.confidence || 'HIGH',
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
   * Analyze lecture recording or transcript with Pedagogy-Aware Ingestion.
   *
   * @param {Object} params - { rawText, segments, audioMetadata, fileName, requestedCount, requestedDifficulty }
   * @returns {Object} analysisResult
   */
  async analyzeLecture({ rawText, segments = [], audioMetadata = null, fileName = null, requestedCount = null, requestedDifficulty = null }) {
    const text = (rawText || '').trim();
    if (!text || text.length < 15) {
      return {
        isAcademic: false,
        isCurricular: false,
        reason: 'INSUFFICIENT_CONTENT: The lecture recording or transcript does not contain enough speech content to analyze.',
        teachingValueScore: 0,
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

    // 1. Run Pedagogy-Aware depthAnalyzer on the transcript text
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
          teaching_value: classification.teaching_value,
          concept_links: classification.concept_links || [],
          evidence_text: classification.evidence_text || segText,
          action: classification.action || 'KEEP_WHOLE',
          substanceType: classification.substanceType,
          confidence: classification.confidence,
          reason: classification.reason
        };
      });
    } else {
      classifiedSegments = this.parseTranscriptIntoSegments(text);
    }

    // 3. Task 1: Content Cleaning - Retain KEEP_WHOLE & KEEP_PARTIAL, discard DISCARD
    const retainedSegments = classifiedSegments.filter(s => s.action !== 'DISCARD' && s.type !== 'ADMINISTRATIVE' && s.type !== 'OFF_TOPIC');
    const cleanedTranscript = retainedSegments.map(s => s.evidence_text || s.text).join(' ').trim();

    // 4. Task 2: Pedagogical Reconstruction & Concept Linking
    const mainTopic = (depthResult.detectedFocus && depthResult.detectedFocus.length > 0)
      ? depthResult.detectedFocus[0]
      : 'Core Instructional Topic';

    const concepts = (depthResult.detectedFocus || []).map((focusTerm, idx) => {
      const matchingSeg = (depthResult.curricularSegments || []).find(s => 
        (s.text || '').toLowerCase().includes(focusTerm.toLowerCase()) ||
        (s.classification?.concept_links || []).some(t => t.toLowerCase() === focusTerm.toLowerCase()) ||
        (s.classification?.matchedTerms || []).some(t => t.toLowerCase() === focusTerm.toLowerCase())
      );

      const expOrAnalogy = (depthResult.pedagogicalSegments || []).find(s => 
        (s.classification?.concept_links || []).some(t => t.toLowerCase() === focusTerm.toLowerCase()) &&
        (s.classification?.type === 'TEACHER_EXPERIENCE' || s.classification?.type === 'ANALOGY')
      );

      return {
        concept_id: `C${String(idx + 1).padStart(2, '0')}`,
        concept_name: focusTerm,
        definition: matchingSeg ? (matchingSeg.classification?.evidence_text || matchingSeg.text) : `Instructional concept covered during the lecture regarding ${focusTerm}.`,
        why_needed: matchingSeg?.classification?.substanceType || 'Core Mechanism',
        substanceType: matchingSeg?.classification?.substanceType || 'DEFINITION_OR_FACT',
        teaching_evidence: expOrAnalogy ? {
          type: expOrAnalogy.classification.type,
          evidence: expOrAnalogy.classification.evidence_text || expOrAnalogy.text,
          reason: expOrAnalogy.classification.reason
        } : null
      };
    });

    // 5. Task 3: Invoke Lecture Intelligence Engine (Module 1)
    const hasAudioTimestamps = Array.isArray(classifiedSegments) && classifiedSegments.some(s => s.start !== null && s.start !== undefined);
    const intelModule = getLectureIntelligence();
    if (intelModule) {
      try {
        lectureIntel = await intelModule.analyze({
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
        if (typeof intelModule.buildPartialFallback === 'function') {
          lectureIntel = intelModule.buildPartialFallback({
            evidenceText: cleanedTranscript || text,
            modality: hasAudioTimestamps ? 'VOICE_ONLY' : 'DOCUMENT_ONLY',
            hasTimingData: hasAudioTimestamps,
            errorReason: intelErr.message
          });
        }
      }
    }

    const intelligentTitle = lectureIntel?.title || mainTopic;

    return {
      isAcademic: depthResult.isAcademic,
      isCurricular: depthResult.isCurricular,
      reason: depthResult.reason,
      teachingValueScore: depthResult.teachingValueScore,
      lectureDepth: depthResult.lectureDepth,
      detectedFocus: depthResult.detectedFocus,
      cleanedTranscript: cleanedTranscript || text,
      rawTranscript: text,
      concepts,
      segments: classifiedSegments,
      retainedSegments: retainedSegments,
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
