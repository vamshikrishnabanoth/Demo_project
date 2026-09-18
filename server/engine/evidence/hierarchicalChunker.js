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
    const voiceText = (sessionInputs.voiceTranscript || '').trim();
    const rawSegments = sessionInputs.transcriptSegments || [];

    let segmentsToProcess = [];

    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      segmentsToProcess = rawSegments;
    } else if (voiceText.length > 0) {
      // Split raw transcript into natural pseudo-sentence segments to preserve incremental chunking
      const sentences = voiceText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [voiceText];
      let runningTime = 0.0;
      for (const sent of sentences) {
        const text = sent.trim();
        if (!text) continue;
        const wCount = countWords(text);
        // Estimate ~130 words per minute -> ~0.46s per word
        const duration = Math.max(1.0, wCount * 0.46);
        segmentsToProcess.push({
          text,
          start: runningTime,
          end: runningTime + duration
        });
        runningTime += duration;
      }
    }

    if (segmentsToProcess.length > 0) {
      // Step A: Build Child Chunks (75 words each)
      let currWords = [];
      let currStart = 0.0;
      let currEnd = 0.0;
      let childIdx = 1;
      const tempChildren = [];

      for (const seg of segmentsToProcess) {
        const text = (seg.text || '').trim();
        const sTime = typeof seg.start === 'number' ? seg.start : 0.0;
        const eTime = typeof seg.end === 'number' ? seg.end : 0.0;

        if (currWords.length === 0) {
          currStart = sTime;
        }
        currEnd = eTime;
        currWords.push(text);

        if (countWords(currWords.join(' ')) >= CHILD_WINDOW_WORDS) {
          const cText = currWords.join(' ');
          const cid = `C_${String(childIdx).padStart(3, '0')}`;
          const eid = `E_CHILD_${String(childIdx).padStart(3, '0')}`;
          tempChildren.push({
            childId: cid,
            evidenceId: eid,
            start: currStart,
            end: currEnd,
            text: cText,
            wordCount: countWords(cText),
            keywords: tokenizeKeywords(cText)
          });
          childIdx++;
          currWords = [];
        }
      }

      if (currWords.length > 0) {
        const cText = currWords.join(' ');
        const cid = `C_${String(childIdx).padStart(3, '0')}`;
        const eid = `E_CHILD_${String(childIdx).padStart(3, '0')}`;
        tempChildren.push({
          childId: cid,
          evidenceId: eid,
          start: currStart,
          end: currEnd,
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
          const pStart = currPChildren[0].start;
          const pEnd = currPChildren[currPChildren.length - 1].end;
          const pText = currPChildren.map(c => c.text).join(' ');
          const cIds = currPChildren.map(c => c.evidenceId);

          const startMin = Math.floor(pStart / 60);
          const startSec = Math.floor(pStart % 60);
          const endMin = Math.floor(pEnd / 60);
          const endSec = Math.floor(pEnd % 60);

          const parentObj = {
            parentId: pId,
            evidenceId: pEid,
            title: `Lecture Segment ${parentIdx} (${startMin}m${String(startSec).padStart(2, '0')}s - ${endMin}m${String(endSec).padStart(2, '0')}s)`,
            sourceType: 'TRANSCRIPT',
            timeSpan: { start: pStart, end: pEnd },
            fullText: pText,
            wordCount: countWords(pText),
            childIds: cIds
          };
          parents.push(parentObj);
          parentMap[pEid] = parentObj;

          for (const c of currPChildren) {
            const childObj = {
              childId: c.childId,
              evidenceId: c.evidenceId,
              parentId: pEid,
              sourceType: 'TRANSCRIPT',
              timeSpan: { start: c.start, end: c.end },
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
        const pStart = currPChildren[0].start;
        const pEnd = currPChildren[currPChildren.length - 1].end;
        const pText = currPChildren.map(c => c.text).join(' ');
        const cIds = currPChildren.map(c => c.evidenceId);

        const startMin = Math.floor(pStart / 60);
        const startSec = Math.floor(pStart % 60);
        const endMin = Math.floor(pEnd / 60);
        const endSec = Math.floor(pEnd % 60);

        const parentObj = {
          parentId: pId,
          evidenceId: pEid,
          title: `Lecture Segment ${parentIdx} (${startMin}m${String(startSec).padStart(2, '0')}s - ${endMin}m${String(endSec).padStart(2, '0')}s)`,
          sourceType: 'TRANSCRIPT',
          timeSpan: { start: pStart, end: pEnd },
          fullText: pText,
          wordCount: countWords(pText),
          childIds: cIds
        };
        parents.push(parentObj);
        parentMap[pEid] = parentObj;

        for (const c of currPChildren) {
          const childObj = {
            childId: c.childId,
            evidenceId: c.evidenceId,
            parentId: pEid,
            sourceType: 'TRANSCRIPT',
            timeSpan: { start: c.start, end: c.end },
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
      } else {
        // Each document element or markdown header section treated as slide unit
        slideSections = docArray.map(d => d.trim()).filter(Boolean);
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
              title: `Document Section ${slideNum}.${pIdx} Context`,
              sourceType: 'SLIDE',
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
            title: `Slide ${slideNum} Full Context`,
            sourceType: 'SLIDE',
            fullText: secText,
            wordCount: countWords(secText),
            childIds: [cEid]
          };

          const childSnippet = secText.substring(0, 400);
          const childObj = {
            childId: cId,
            evidenceId: cEid,
            parentId: pEid,
            sourceType: 'SLIDE',
            text: childSnippet,
            wordCount: countWords(childSnippet),
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
