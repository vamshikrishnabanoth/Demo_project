/**
 * server/engine/evidence/hierarchicalChunker.js
 *
 * Faithful port of Speech_To_Text/production_engine/experimental/hierarchical_rag/hierarchical_chunker.py.
 * Builds dual-level Parent-Child chunk hierarchy from transcripts, slides, and code snippets.
 * - Child Window: 75 words (micro-unit for high-precision citation, ~30-45s)
 * - Parent Window: 400 words (macro-unit for narrative reasoning context, ~3-5 mins)
 */

'use strict';

const CHILD_WINDOW_WORDS = 75;
const PARENT_WINDOW_WORDS = 400;

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'when', 'where',
  'which', 'there', 'their', 'about', 'would', 'could', 'should', 'going',
  'because', 'these', 'those', 'being', 'other'
]);

function tokenizeKeywords(text = '') {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b[a-zA-Z_]{4,}\b/g) || [];
  const unique = Array.from(new Set(words.filter(w => !STOPWORDS.has(w))));
  return unique.slice(0, 10);
}

function countWords(text = '') {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Decomposes long unpunctuated speech into natural clause-level propositions.
 * Respects discourse markers, conjunctions, punctuation, and bounds chunk sizes
 * to prevent monolithic chunks (e.g., Whisper 565-word unpunctuated blocks).
 */
function breakLongSegment(text = '', targetWords = 75, maxWords = 85) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text.trim()];

  const boundaryRegex = /(?<=[,;:\n])\s+|(?<=\s)(?=\b(?:now\s+if\s+i\s+say|now\s+if\s+you|now\s+run|okay\s+now|so\s+what\s+happened|look\s+at\s+this|look\s+at\s+the|can\s+anyone\s+tell|can\s+you\s+tell|what\s+would\s+the|let's\s+look\s+at|the\\s+problem\\s+statement|this\s+is\s+test\s+case|how\s+many\s+of\s+you|in\s+this\s+case|give\s+5\s+elements|give\s+six\s+elements|the\s+other\s+version\s+is|is\s+that\s+helping\s+you|initially\s+we\s+say|what\s+you\s+are\s+basically\s+doing|so\s+there\s+is|and\s+then|because|since|so\s+that|therefore|however|otherwise|and\s+|so\s+|but\s+|then\s+|if\s+|when\s+|where\s+|while\s+|which\s+|provided\s+)\b)/i;

  const rawParts = text.split(boundaryRegex).map(p => p.trim()).filter(Boolean);
  const result = [];
  let cur = [];
  let curCount = 0;

  for (const part of rawParts) {
    const pWords = part.split(/\s+/).filter(Boolean);
    if (pWords.length > maxWords) {
      if (cur.length > 0) {
        result.push(cur.join(' '));
        cur = [];
        curCount = 0;
      }
      for (let i = 0; i < pWords.length; i += targetWords) {
        result.push(pWords.slice(i, i + targetWords).join(' '));
      }
      continue;
    }

    if (curCount + pWords.length <= maxWords) {
      cur.push(part);
      curCount += pWords.length;
    } else {
      if (cur.length > 0) {
        result.push(cur.join(' '));
        cur = [];
        curCount = 0;
      }
      cur.push(part);
      curCount += pWords.length;
    }
  }

  if (cur.length > 0) {
    result.push(cur.join(' '));
  }

  return result;
}

class HierarchicalChunker {
  /**
   * Build dual-level Parent-Child evidence store from session inputs.
   * @param {Object} sessionInputs - { voiceTranscript, documentTexts, codeSnippets, transcriptSegments, sessionId, title }
   * @returns {Object} HierarchicalEvidenceStore
   */
  static buildStore(sessionInputs = {}) {
    const parents = [];
    const children = [];
    const parentMap = {};
    const childMap = {};

    const inputId = sessionInputs.sessionId || 'session_' + Date.now();
    const title = sessionInputs.title || sessionInputs.subject || 'Educational Session';

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Process Spoken Audio Transcript
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Process Spoken Audio Transcript
    // ──────────────────────────────────────────────────────────────────────────
    const voiceText = (sessionInputs.voiceTranscript || '').trim();
    const rawSegments = sessionInputs.transcriptSegments || [];

    // Strictly detect genuine Whisper numeric timestamps
    const hasRealTimestamps = Array.isArray(rawSegments) && rawSegments.length > 0 &&
      rawSegments.some(s => typeof s.start === 'number' && typeof s.end === 'number' && !isNaN(s.start) && !isNaN(s.end));

    let segmentsToProcess = [];

    if (hasRealTimestamps) {
      segmentsToProcess = rawSegments.map(s => ({
        text: (s.text || '').trim(),
        start: typeof s.start === 'number' ? s.start : null,
        end: typeof s.end === 'number' ? s.end : null,
        speaker: s.speaker || 'Speaker'
      }));
    } else if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      segmentsToProcess = rawSegments.map(s => ({
        text: (s.text || (typeof s === 'string' ? s : '')).trim(),
        start: null,
        end: null,
        speaker: s.speaker || 'Speaker'
      }));
    } else if (voiceText.length > 0) {
      // Split raw transcript into natural pseudo-sentence segments to preserve incremental chunking
      // Zero fabrication: no estimated words * 0.46s timing
      const sentences = voiceText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [voiceText];
      for (const sent of sentences) {
        const text = sent.trim();
        if (!text) continue;
        const subParts = breakLongSegment(text, CHILD_WINDOW_WORDS, 85);
        for (const sp of subParts) {
          segmentsToProcess.push({
            text: sp,
            start: null,
            end: null
          });
        }
      }
    }

    if (segmentsToProcess.length > 0) {
      // Step A: Build Child Chunks (75 words each)
      let currWords = [];
      let currStart = null;
      let currEnd = null;
      let childIdx = 1;
      const tempChildren = [];

      for (const seg of segmentsToProcess) {
        const text = (seg.text || '').trim();
        const sTime = typeof seg.start === 'number' ? seg.start : null;
        const eTime = typeof seg.end === 'number' ? seg.end : null;

        const segWordCount = countWords(text);
        const curWordCount = countWords(currWords.join(' '));
        if (curWordCount >= CHILD_WINDOW_WORDS || (curWordCount >= 20 && curWordCount + segWordCount > 95)) {
          if (currWords.length > 0) {
            const cText = currWords.join(' ');
            const cid = `C_${String(childIdx).padStart(3, '0')}`;
            const eid = `E_CHILD_${String(childIdx).padStart(3, '0')}`;
            tempChildren.push({
              childId: cid,
              evidenceId: eid,
              start: hasRealTimestamps ? currStart : null,
              end: hasRealTimestamps ? currEnd : null,
              hasRealTimestamps,
              text: cText,
              wordCount: countWords(cText),
              keywords: tokenizeKeywords(cText)
            });
            childIdx++;
            currWords = [];
            currStart = null;
            currEnd = null;
          }
        }
        if (currWords.length === 0) {
          currStart = sTime;
        }
        if (eTime !== null) {
          currEnd = eTime;
        }
        currWords.push(text);
      }

      if (currWords.length > 0) {
        const cText = currWords.join(' ');
        const cid = `C_${String(childIdx).padStart(3, '0')}`;
        const eid = `E_CHILD_${String(childIdx).padStart(3, '0')}`;
        tempChildren.push({
          childId: cid,
          evidenceId: eid,
          start: hasRealTimestamps ? currStart : null,
          end: hasRealTimestamps ? currEnd : null,
          hasRealTimestamps,
          text: cText,
          wordCount: countWords(cText),
          keywords: tokenizeKeywords(cText)
        });
      }

      // Step B: Group Children into Parent Windows (~400 words, ~4-5 children)
      let parentIdx = 1;
      let currPChildren = [];
      let currPWords = 0;

      for (const tc of tempChildren) {
        currPChildren.push(tc);
        currPWords += tc.wordCount;

        if (currPWords >= PARENT_WINDOW_WORDS) {
          const pId = `P_${String(parentIdx).padStart(2, '0')}`;
          const pEid = `E_PARENT_${String(parentIdx).padStart(2, '0')}`;
          const pStart = hasRealTimestamps ? currPChildren[0].start : null;
          const pEnd = hasRealTimestamps ? currPChildren[currPChildren.length - 1].end : null;
          const pText = currPChildren.map(c => c.text).join(' ');
          const cIds = currPChildren.map(c => c.evidenceId);

          const hasValidTimes = typeof pStart === 'number' && typeof pEnd === 'number';
          let parentTitle = `Lecture Segment ${parentIdx}`;
          let timeSpan = null;

          if (hasValidTimes) {
            const startMin = Math.floor(pStart / 60);
            const startSec = Math.floor(pStart % 60);
            const endMin = Math.floor(pEnd / 60);
            const endSec = Math.floor(pEnd % 60);
            const formatted = `${String(startMin).padStart(2, '0')}:${String(startSec).padStart(2, '0')} - ${String(endMin).padStart(2, '0')}:${String(endSec).padStart(2, '0')}`;
            parentTitle = `Lecture Segment ${parentIdx} (${startMin}m${String(startSec).padStart(2, '0')}s - ${endMin}m${String(endSec).padStart(2, '0')}s)`;
            timeSpan = { start: pStart, end: pEnd, formatted, hasRealTimestamps: true };
          }

          const parentObj = {
            parentId: pId,
            evidenceId: pEid,
            title: parentTitle,
            sourceType: 'TRANSCRIPT',
            timeSpan,
            hasRealTimestamps: hasValidTimes,
            fullText: pText,
            wordCount: countWords(pText),
            childIds: cIds
          };
          parents.push(parentObj);
          parentMap[pEid] = parentObj;

          for (const c of currPChildren) {
            const childValidTimes = typeof c.start === 'number' && typeof c.end === 'number';
            const childTimeSpan = childValidTimes
              ? {
                  start: c.start,
                  end: c.end,
                  formatted: `${Math.floor(c.start / 60).toString().padStart(2, '0')}:${Math.floor(c.start % 60).toString().padStart(2, '0')} - ${Math.floor(c.end / 60).toString().padStart(2, '0')}:${Math.floor(c.end % 60).toString().padStart(2, '0')}`,
                  hasRealTimestamps: true
                }
              : null;

            const childObj = {
              childId: c.childId,
              evidenceId: c.evidenceId,
              parentId: pEid,
              sourceType: 'TRANSCRIPT',
              start: childValidTimes ? c.start : null,
              end: childValidTimes ? c.end : null,
              timeSpan: childTimeSpan,
              hasRealTimestamps: childValidTimes,
              text: c.text,
              wordCount: c.wordCount,
              keywords: c.keywords
            };
            children.push(childObj);
            childMap[c.evidenceId] = childObj;
          }

          parentIdx++;
          currPChildren = [];
          currPWords = 0;
        }
      }

      if (currPChildren.length > 0) {
        const pId = `P_${String(parentIdx).padStart(2, '0')}`;
        const pEid = `E_PARENT_${String(parentIdx).padStart(2, '0')}`;
        const pStart = hasRealTimestamps ? currPChildren[0].start : null;
        const pEnd = hasRealTimestamps ? currPChildren[currPChildren.length - 1].end : null;
        const pText = currPChildren.map(c => c.text).join(' ');
        const cIds = currPChildren.map(c => c.evidenceId);

        const hasValidTimes = typeof pStart === 'number' && typeof pEnd === 'number';
        let parentTitle = `Lecture Segment ${parentIdx}`;
        let timeSpan = null;

        if (hasValidTimes) {
          const startMin = Math.floor(pStart / 60);
          const startSec = Math.floor(pStart % 60);
          const endMin = Math.floor(pEnd / 60);
          const endSec = Math.floor(pEnd % 60);
          const formatted = `${String(startMin).padStart(2, '0')}:${String(startSec).padStart(2, '0')} - ${String(endMin).padStart(2, '0')}:${String(endSec).padStart(2, '0')}`;
          parentTitle = `Lecture Segment ${parentIdx} (${startMin}m${String(startSec).padStart(2, '0')}s - ${endMin}m${String(endSec).padStart(2, '0')}s)`;
          timeSpan = { start: pStart, end: pEnd, formatted, hasRealTimestamps: true };
        }

        const parentObj = {
          parentId: pId,
          evidenceId: pEid,
          title: parentTitle,
          sourceType: 'TRANSCRIPT',
          timeSpan,
          hasRealTimestamps: hasValidTimes,
          fullText: pText,
          wordCount: countWords(pText),
          childIds: cIds
        };
        parents.push(parentObj);
        parentMap[pEid] = parentObj;

        for (const c of currPChildren) {
          const childValidTimes = typeof c.start === 'number' && typeof c.end === 'number';
          const childTimeSpan = childValidTimes
            ? {
                start: c.start,
                end: c.end,
                formatted: `${Math.floor(c.start / 60).toString().padStart(2, '0')}:${Math.floor(c.start % 60).toString().padStart(2, '0')} - ${Math.floor(c.end / 60).toString().padStart(2, '0')}:${Math.floor(c.end % 60).toString().padStart(2, '0')}`,
                hasRealTimestamps: true
              }
            : null;

          const childObj = {
            childId: c.childId,
            evidenceId: c.evidenceId,
            parentId: pEid,
            sourceType: 'TRANSCRIPT',
            start: childValidTimes ? c.start : null,
            end: childValidTimes ? c.end : null,
            timeSpan: childTimeSpan,
            hasRealTimestamps: childValidTimes,
            text: c.text,
            wordCount: c.wordCount,
            keywords: c.keywords
          };
          children.push(childObj);
          childMap[c.evidenceId] = childObj;
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Process Slide / PDF Sections & Supporting Materials
    // ──────────────────────────────────────────────────────────────────────────
    const docArray = Array.isArray(sessionInputs.documentTexts) ? sessionInputs.documentTexts : [];
    const docText = docArray.join('\n\n');

    if (docText.includes('--- Slide ') || docArray.length > 0) {
      let slideSections = [];
      if (docText.includes('--- Slide ')) {
        slideSections = docText.split('--- Slide ').map(s => s.trim()).filter(Boolean);
      } else if (docText.includes('--- Page ')) {
        slideSections = docText.split('--- Page ').map(s => s.trim()).filter(Boolean);
      } else if (docArray.length > 1) {
        slideSections = docArray.map(d => d.trim()).filter(Boolean);
      } else if (docArray.length === 1) {
        // Heading / Title-based slide boundary fallback for unsegmented presentation text:
        // Matches title lines followed immediately by numbered list items (1. ...)
        const rawDoc = docArray[0].trim();
        const headingSplit = rawDoc.split(/(?:^|\n\n|\r?\n)(?=[A-Z][A-Za-z0-9\s,&:\-\(\)]{3,80}\r?\n\s*1\.)/g).map(s => s.trim()).filter(Boolean);
        if (headingSplit.length > 1) {
          slideSections = headingSplit;
        } else {
          slideSections = [rawDoc];
        }
      }

      for (let sIdx = 0; sIdx < slideSections.length; sIdx++) {
        const sec = slideSections[sIdx];
        const lines = sec.split('\n');
        let slideNum = String(sIdx + 1);
        let secText = sec;

        if (lines[0].includes('---')) {
          slideNum = lines[0].split('---')[0].trim() || slideNum;
          secText = lines.slice(1).join('\n').trim();
        }

        const secWords = countWords(secText);
        if (secWords > PARENT_WINDOW_WORDS) {
          // Chunk long document/PDF into standard 400-word parent windows and 75-word child chunks
          const words = secText.split(/\s+/).filter(Boolean);
          let pIdx = 1;
          for (let wPos = 0; wPos < words.length; wPos += PARENT_WINDOW_WORDS) {
            const pWords = words.slice(wPos, wPos + PARENT_WINDOW_WORDS);
            const pId = `P_DOC_${slideNum}_${pIdx}`;
            const pEid = `E_PARENT_DOC_${slideNum}_${pIdx}`;
            const pText = pWords.join(' ');

            const pChildIds = [];
            let cIdx = 1;
            for (let cPos = 0; cPos < pWords.length; cPos += CHILD_WINDOW_WORDS) {
              const cWords = pWords.slice(cPos, cPos + CHILD_WINDOW_WORDS);
              const cText = cWords.join(' ');
              const cId = `C_DOC_${slideNum}_${pIdx}_${cIdx}`;
              const cEid = `E_DOC_${slideNum}_${pIdx}_${cIdx}`;
              pChildIds.push(cEid);

              const childObj = {
                childId: cId,
                evidenceId: cEid,
                parentId: pEid,
                sourceType: 'SLIDE',
                pageNumber: parseInt(slideNum, 10) || (sIdx + 1),
                text: cText,
                wordCount: countWords(cText),
                keywords: tokenizeKeywords(cText)
              };
              children.push(childObj);
              childMap[cEid] = childObj;
              cIdx++;
            }

            const parentObj = {
              parentId: pId,
              evidenceId: pEid,
              title: docText.includes('--- Page ') ? `Page ${slideNum}.${pIdx} Context` : `Document Section ${slideNum}.${pIdx} Context`,
              sourceType: 'SLIDE',
              pageNumber: parseInt(slideNum, 10) || (sIdx + 1),
              fullText: pText,
              wordCount: countWords(pText),
              childIds: pChildIds
            };
            parents.push(parentObj);
            parentMap[pEid] = parentObj;
            pIdx++;
          }
        } else {
          const pId = `P_SLIDE_${slideNum}`;
          const pEid = `E_PARENT_SLIDE_${slideNum}`;
          const cId = `C_SLIDE_${slideNum}`;
          const cEid = `E_SLIDE_${slideNum}`;

          const parentObj = {
            parentId: pId,
            evidenceId: pEid,
            title: docText.includes('--- Page ') ? `Page ${slideNum} Full Context` : `Slide ${slideNum} Full Context`,
            sourceType: 'SLIDE',
            pageNumber: parseInt(slideNum, 10) || (sIdx + 1),
            fullText: secText,
            wordCount: secWords,
            childIds: [cEid]
          };

          // Retain full cohesive slide text for atomic slide indexing (do not truncate by arbitrary 400 characters)
          const childObj = {
            childId: cId,
            evidenceId: cEid,
            parentId: pEid,
            sourceType: 'SLIDE',
            pageNumber: parseInt(slideNum, 10) || (sIdx + 1),
            text: secText,
            wordCount: secWords,
            keywords: tokenizeKeywords(secText)
          };

          parents.push(parentObj);
          children.push(childObj);
          parentMap[pEid] = parentObj;
          childMap[cEid] = childObj;
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Process Code Snippets
    // ──────────────────────────────────────────────────────────────────────────
    const codeText = (sessionInputs.codeSnippets || '').trim();
    if (codeText.length > 0) {
      const pId = 'P_CODE_01';
      const pEid = 'E_PARENT_CODE_01';
      const cId = 'C_CODE_01';
      const cEid = 'E_CODE_01';

      const parentObj = {
        parentId: pId,
        evidenceId: pEid,
        title: 'Code Snippets Context',
        sourceType: 'CODE',
        fullText: codeText,
        wordCount: countWords(codeText),
        childIds: [cEid]
      };

      const childObj = {
        childId: cId,
        evidenceId: cEid,
        parentId: pEid,
        sourceType: 'CODE',
        text: codeText.substring(0, 400),
        wordCount: countWords(codeText.substring(0, 400)),
        keywords: tokenizeKeywords(codeText)
      };

      parents.push(parentObj);
      children.push(childObj);
      parentMap[pEid] = parentObj;
      childMap[cEid] = childObj;
    }

    return {
      inputId,
      title,
      parents,
      children,
      parentMap,
      childMap
    };
  }
}

module.exports = {
  HierarchicalChunker,
  CHILD_WINDOW_WORDS,
  PARENT_WINDOW_WORDS,
  tokenizeKeywords
};
