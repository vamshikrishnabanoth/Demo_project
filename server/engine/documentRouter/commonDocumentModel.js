/**
 * server/engine/documentRouter/commonDocumentModel.js
 *
 * Canonical Intermediate Representation for all ingested documents (PDF, DOCX, Images, Scans).
 * Downstream chunking, indexing, and retrieval operate strictly on this model.
 */

'use strict';

const BlockTypes = Object.freeze({
  TEXT: 'text',
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  TABLE: 'table',
  IMAGE: 'image',
  CHART: 'chart',
  DIAGRAM: 'diagram',
  CAPTION: 'caption',
  OCR_TEXT: 'ocr_text'
});

class DocumentBlock {
  constructor({ blockId, type = BlockTypes.PARAGRAPH, content = '', metadata = {} }) {
    this.blockId = blockId || `blk_${Math.random().toString(36).substring(2, 10)}`;
    this.type = Object.values(BlockTypes).includes(type) ? type : BlockTypes.TEXT;
    this.content = String(content || '').trim();
    this.metadata = {
      headingLevel: metadata.headingLevel || null,
      tableId: metadata.tableId || null,
      rowCount: metadata.rowCount || null,
      colCount: metadata.colCount || null,
      imageId: metadata.imageId || null,
      figureId: metadata.figureId || null,
      caption: metadata.caption || null,
      ocrConfidence: typeof metadata.ocrConfidence === 'number' ? metadata.ocrConfidence : null,
      bbox: metadata.bbox || null,
      isVisualEvidence: Boolean(metadata.isVisualEvidence),
      ...metadata
    };
  }
}

class DocumentPage {
  constructor({ pageNumber = null, section = null, paragraphIndex = null, blocks = [], metadata = {} }) {
    this.pageNumber = typeof pageNumber === 'number' ? pageNumber : null;
    this.section = section || null;
    this.paragraphIndex = typeof paragraphIndex === 'number' ? paragraphIndex : null;
    this.blocks = Array.isArray(blocks) ? blocks.map(b => (b instanceof DocumentBlock ? b : new DocumentBlock(b))) : [];
    this.metadata = { ...metadata };
  }

  addBlock(blockData) {
    const block = blockData instanceof DocumentBlock ? blockData : new DocumentBlock(blockData);
    this.blocks.push(block);
    return block;
  }
}

class CommonDocumentModel {
  constructor({
    documentId = null,
    sourceType = 'DOCUMENT',
    filename = 'unknown_document',
    totalPages = 1,
    pages = [],
    metadata = {}
  }) {
    this.documentId = documentId || `doc_${Math.random().toString(36).substring(2, 12)}`;
    this.sourceType = String(sourceType || 'DOCUMENT').toUpperCase();
    this.filename = filename;
    this.totalPages = Math.max(1, parseInt(totalPages) || 1);
    this.pages = Array.isArray(pages) ? pages.map(p => (p instanceof DocumentPage ? p : new DocumentPage(p))) : [];
    this.metadata = {
      extractedAt: Date.now(),
      hasTables: false,
      hasImages: false,
      hasCharts: false,
      hasScans: false,
      ocrApplied: false,
      ...metadata
    };
  }

  addPage(pageData) {
    const page = pageData instanceof DocumentPage ? pageData : new DocumentPage(pageData);
    this.pages.push(page);
    this.totalPages = Math.max(this.totalPages, this.pages.length);
    return page;
  }

  getAllBlocks() {
    const all = [];
    for (const page of this.pages) {
      for (const block of page.blocks) {
        all.push({
          pageNumber: page.pageNumber,
          section: page.section,
          ...block
        });
      }
    }
    return all;
  }

  getBlocksByType(type) {
    return this.getAllBlocks().filter(b => b.type === type);
  }

  /**
   * Produces a clean concatenated text representation for backwards compatibility.
   */
  toFlattenedText() {
    const lines = [];
    for (const page of this.pages) {
      if (page.pageNumber) {
        lines.push(`\n--- Page ${page.pageNumber} ---\n`);
      }
      for (const block of page.blocks) {
        if (!block.content) continue;
        if (block.type === BlockTypes.HEADING) {
          lines.push(`\n## ${block.content}\n`);
        } else if (block.type === BlockTypes.TABLE) {
          lines.push(`\n${block.content}\n`);
        } else if (block.type === BlockTypes.CHART || block.type === BlockTypes.DIAGRAM) {
          lines.push(`\n[VISUAL EVIDENCE: ${block.type.toUpperCase()}]\n${block.content}\n`);
        } else {
          lines.push(block.content);
        }
      }
    }
    return lines.join('\n').trim();
  }

  /**
   * Alias for toFlattenedText.
   */
  toUnifiedText() {
    return this.toFlattenedText();
  }

  getSummaryStats() {
    const blocks = this.getAllBlocks();
    return {
      documentId: this.documentId,
      sourceType: this.sourceType,
      filename: this.filename,
      totalPages: this.totalPages,
      totalBlocks: blocks.length,
      textBlocks: blocks.filter(b => [BlockTypes.TEXT, BlockTypes.PARAGRAPH].includes(b.type)).length,
      headings: blocks.filter(b => b.type === BlockTypes.HEADING).length,
      tables: blocks.filter(b => b.type === BlockTypes.TABLE).length,
      images: blocks.filter(b => b.type === BlockTypes.IMAGE).length,
      charts: blocks.filter(b => [BlockTypes.CHART, BlockTypes.DIAGRAM].includes(b.type)).length,
      ocrBlocks: blocks.filter(b => b.type === BlockTypes.OCR_TEXT).length
    };
  }
}

module.exports = {
  BlockTypes,
  DocumentBlock,
  DocumentPage,
  CommonDocumentModel
};
