/**
 * server/engine/evidence/structureAwareChunker.js
 *
 * Structure-Aware Chunker for Multimodal RAG.
 * - Keeps tables as complete single chunks (never splits mid-table).
 * - Pre-pends headings to succeeding paragraphs to preserve context.
 * - Handles visual blocks (charts, diagrams, images) with their descriptions intact.
 * - Attaches rich provenance metadata (documentId, chunkId, parentChunkId, contentType, pageNumber, section).
 * - Builds dual-level Parent-Child chunks fully compatible with HierarchicalEvidenceStore.
 */

'use strict';

const { BlockTypes } = require('../documentRouter/commonDocumentModel');

const CHILD_TARGET_WORDS = 80;
const PARENT_TARGET_WORDS = 400;

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'when', 'where',
  'which', 'there', 'their', 'about', 'would', 'could', 'should', 'going',
  'because', 'these', 'those', 'being', 'other', 'into', 'each', 'than'
]);

function countWords(text = '') {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tokenizeKeywords(text = '') {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b[a-zA-Z_]{4,}\b/g) || [];
  const unique = Array.from(new Set(words.filter(w => !STOPWORDS.has(w))));
  return unique.slice(0, 12);
}

class StructureAwareChunker {
  /**
   * Chunk a CommonDocumentModel into parent and child chunks preserving tables and headings.
   * @param {Object} commonDoc - Instance of CommonDocumentModel
   * @param {Object} options - { childSize: 80, parentSize: 400 }
   * @returns {{ parents: Array, children: Array, parentMap: Object, childMap: Object }}
   */
  static chunkDocument(commonDoc, options = {}) {
    const childTargetWords = options.childSize || CHILD_TARGET_WORDS;
    const parentTargetWords = options.parentSize || PARENT_TARGET_WORDS;

    const parents = [];
    const children = [];
    const parentMap = {};
    const childMap = {};

    if (!commonDoc || !Array.isArray(commonDoc.pages)) {
      return { parents, children, parentMap, childMap };
    }

    const docId = commonDoc.documentId || 'doc_' + Date.now();
    let currentHeading = '';
    let globalParentIdx = 1;
    let globalChildIdx = 1;

    for (const page of commonDoc.pages) {
      const pageNum = page.pageNumber || 1;
      const blocks = page.blocks || [];

      // Buffer of textual items to cluster into parent/child chunks
      let textBuffer = [];
      let bufferWordCount = 0;

      const flushTextBuffer = () => {
        if (textBuffer.length === 0) return;

        const combinedText = textBuffer.map(b => b.content).join('\n\n');
        const totalWords = countWords(combinedText);
        if (totalWords === 0) {
          textBuffer = [];
          bufferWordCount = 0;
          return;
        }

        // Create Parent chunk
        const parentId = `P_${docId}_p${pageNum}_${globalParentIdx}`;
        const parentEid = `E_PARENT_${docId}_p${pageNum}_${globalParentIdx}`;
        globalParentIdx++;

        const parentChildIds = [];
        const words = combinedText.split(/\s+/).filter(Boolean);

        // Partition words into child chunks
        let cIdx = 1;
        for (let w = 0; w < words.length; w += childTargetWords) {
          const cWords = words.slice(w, w + childTargetWords);
          const cText = cWords.join(' ');
          const childId = `C_${docId}_p${pageNum}_${globalChildIdx}`;
          const childEid = `E_CHILD_${docId}_p${pageNum}_${globalChildIdx}`;
          globalChildIdx++;

          parentChildIds.push(childEid);

          const childObj = {
            childId,
            evidenceId: childEid,
            parentId: parentEid,
            documentId: docId,
            pageNumber: pageNum,
            contentType: BlockTypes.PARAGRAPH,
            section: currentHeading || `Page ${pageNum}`,
            text: cText,
            wordCount: countWords(cText),
            keywords: tokenizeKeywords(cText),
            sourceType: commonDoc.sourceType || 'DOCUMENT'
          };

          children.push(childObj);
          childMap[childEid] = childObj;
          cIdx++;
        }

        const parentObj = {
          parentId,
          evidenceId: parentEid,
          documentId: docId,
          pageNumber: pageNum,
          contentType: BlockTypes.PARAGRAPH,
          section: currentHeading || `Page ${pageNum}`,
          title: `${commonDoc.filename || 'Document'} - Page ${pageNum} (${currentHeading || 'Content'})`,
          sourceType: commonDoc.sourceType || 'DOCUMENT',
          fullText: combinedText,
          wordCount: totalWords,
          childIds: parentChildIds
        };

        parents.push(parentObj);
        parentMap[parentEid] = parentObj;

        textBuffer = [];
        bufferWordCount = 0;
      };

      for (const block of blocks) {
        if (block.type === BlockTypes.HEADING) {
          currentHeading = block.content.trim();
          // Add heading context to text buffer
          textBuffer.push({
            content: `### ${block.content}`,
            type: BlockTypes.HEADING,
            blockId: block.blockId
          });
          bufferWordCount += countWords(block.content);
        } else if (block.type === BlockTypes.TABLE) {
          // Flush any preceding text buffer so table stands alone
          flushTextBuffer();

          // TABLE RULE: Never split table mid-table. Whole table is kept intact.
          const tableText = block.content;
          const tableWords = countWords(tableText);
          const parentId = `P_${docId}_p${pageNum}_tbl_${globalParentIdx++}`;
          const parentEid = `E_PARENT_${docId}_p${pageNum}_tbl_${globalParentIdx}`;
          const childId = `C_${docId}_p${pageNum}_tbl_${globalChildIdx++}`;
          const childEid = `E_CHILD_${docId}_p${pageNum}_tbl_${globalChildIdx}`;

          const childObj = {
            childId,
            evidenceId: childEid,
            parentId: parentEid,
            documentId: docId,
            pageNumber: pageNum,
            contentType: BlockTypes.TABLE,
            tableId: block.metadata?.tableId || `tbl_p${pageNum}`,
            section: currentHeading || `Table (Page ${pageNum})`,
            text: currentHeading ? `[Table Context: ${currentHeading}]\n${tableText}` : tableText,
            wordCount: tableWords,
            keywords: tokenizeKeywords(tableText),
            metadata: block.metadata || {},
            sourceType: commonDoc.sourceType || 'DOCUMENT'
          };

          const parentObj = {
            parentId,
            evidenceId: parentEid,
            documentId: docId,
            pageNumber: pageNum,
            contentType: BlockTypes.TABLE,
            tableId: block.metadata?.tableId || `tbl_p${pageNum}`,
            section: currentHeading || `Table (Page ${pageNum})`,
            title: `${commonDoc.filename || 'Document'} - Page ${pageNum} (Table: ${currentHeading || 'Structured Data'})`,
            sourceType: commonDoc.sourceType || 'DOCUMENT',
            fullText: childObj.text,
            wordCount: tableWords,
            childIds: [childEid],
            metadata: block.metadata || {}
          };

          children.push(childObj);
          childMap[childEid] = childObj;
          parents.push(parentObj);
          parentMap[parentEid] = parentObj;

        } else if (block.type === BlockTypes.CHART || block.type === BlockTypes.DIAGRAM || block.type === BlockTypes.IMAGE) {
          // Dedicated visual description chunk
          flushTextBuffer();

          const visualText = block.content;
          const visualWords = countWords(visualText);
          const parentId = `P_${docId}_p${pageNum}_vis_${globalParentIdx++}`;
          const parentEid = `E_PARENT_${docId}_p${pageNum}_vis_${globalParentIdx}`;
          const childId = `C_${docId}_p${pageNum}_vis_${globalChildIdx++}`;
          const childEid = `E_CHILD_${docId}_p${pageNum}_vis_${globalChildIdx}`;

          const visualContent = `[VISUAL ${block.type.toUpperCase()}${block.metadata?.caption ? ': ' + block.metadata.caption : ''}]\n${visualText}`;

          const childObj = {
            childId,
            evidenceId: childEid,
            parentId: parentEid,
            documentId: docId,
            pageNumber: pageNum,
            contentType: block.type,
            section: currentHeading || `Visual Figure (Page ${pageNum})`,
            text: visualContent,
            wordCount: visualWords,
            keywords: tokenizeKeywords(visualText),
            metadata: block.metadata || {},
            sourceType: commonDoc.sourceType || 'DOCUMENT'
          };

          const parentObj = {
            parentId,
            evidenceId: parentEid,
            documentId: docId,
            pageNumber: pageNum,
            contentType: block.type,
            section: currentHeading || `Visual Figure (Page ${pageNum})`,
            title: `${commonDoc.filename || 'Document'} - Page ${pageNum} (${block.type}: ${block.metadata?.caption || currentHeading || 'Figure'})`,
            sourceType: commonDoc.sourceType || 'DOCUMENT',
            fullText: visualContent,
            wordCount: visualWords,
            childIds: [childEid],
            metadata: block.metadata || {}
          };

          children.push(childObj);
          childMap[childEid] = childObj;
          parents.push(parentObj);
          parentMap[parentEid] = parentObj;

        } else {
          // Paragraph or OCR Text: accumulate into text buffer
          textBuffer.push({
            content: block.content,
            type: block.type,
            blockId: block.blockId
          });
          bufferWordCount += countWords(block.content);

          // If buffer exceeds parentTargetWords, flush
          if (bufferWordCount >= parentTargetWords) {
            flushTextBuffer();
          }
        }
      }

      // Flush remainder of page
      flushTextBuffer();
    }

    return { parents, children, parentMap, childMap };
  }

  /**
   * Build complete HierarchicalEvidenceStore compatible with HierarchicalChunker.
   * Merges structured document chunks with any sessionInputs (voice transcripts, code snippets).
   */
  static buildMultimodalStore(commonDocs = [], sessionInputs = {}) {
    const docs = Array.isArray(commonDocs) ? commonDocs : [commonDocs];
    const allParents = [];
    const allChildren = [];
    const parentMap = {};
    const childMap = {};

    // 1. Chunk structured documents
    for (const doc of docs) {
      if (!doc) continue;
      const { parents, children } = StructureAwareChunker.chunkDocument(doc);
      for (const p of parents) {
        allParents.push(p);
        parentMap[p.evidenceId] = p;
      }
      for (const c of children) {
        allChildren.push(c);
        childMap[c.evidenceId] = c;
      }
    }

    return {
      parents: allParents,
      children: allChildren,
      parentMap,
      childMap,
      sessionId: sessionInputs.sessionId || 'session_' + Date.now()
    };
  }
}

module.exports = StructureAwareChunker;
