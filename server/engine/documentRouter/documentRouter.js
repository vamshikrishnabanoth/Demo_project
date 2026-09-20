/**
 * server/engine/documentRouter/documentRouter.js
 *
 * Central Document Ingestion Router.
 * Validates file magic bytes and routes inputs to specialized extractors (PDF, DOCX, Images, Text)
 * to construct a canonical CommonDocumentModel.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { CommonDocumentModel, DocumentPage, DocumentBlock, BlockTypes } = require('./commonDocumentModel');
const PdfMultimodalExtractor = require('./pdfMultimodalExtractor');
const DocxMultimodalExtractor = require('./docxMultimodalExtractor');
const visionService = require('./visionService');
const OcrService = require('./ocrService');

// Magic byte signatures for strict type verification
const MAGIC_SIGNATURES = {
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  docx: [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // PK (ZIP)
  jpg: [Buffer.from([0xFF, 0xD8, 0xFF])],
  png: [Buffer.from([0x89, 0x50, 0x4E, 0x47])]
};
class DocumentRouter {
  /**
   * Validate that the buffer starts with the expected magic bytes for the claimed extension.
   * Throws FILE_MAGIC_BYTES_MISMATCH if validation fails.
   */
  static validateMagicBytes(input, claimedExt = '') {
    let buffer;
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string' && fs.existsSync(input)) {
      buffer = fs.readFileSync(input);
    } else {
      return true;
    }
    const ext = String(claimedExt || '').toLowerCase().replace(/^\./, '');
    const sigs = MAGIC_SIGNATURES[ext];
    if (!sigs) return true;
    const matches = sigs.some(sig => buffer.length >= sig.length && buffer.slice(0, sig.length).equals(sig));
    if (!matches) {
      const err = new Error(`FILE_MAGIC_BYTES_MISMATCH: File header does not match declared .${ext} extension.`);
      err.code = 'FILE_MAGIC_BYTES_MISMATCH';
      throw err;
    }
    return true;
  }

  /**

   * Determine file type using both extension and magic byte verification.
   * @param {Buffer} buffer
   * @param {string} claimedExt
   * @returns {'pdf'|'docx'|'image'|'text'|'unknown'}
   */
  static detectFileType(buffer, claimedExt = '') {
    const ext = String(claimedExt || '').toLowerCase().replace(/^\./, '');

    if (buffer && buffer.length >= 4) {
      if (MAGIC_SIGNATURES.pdf.some(sig => buffer.slice(0, sig.length).equals(sig))) {
        return 'pdf';
      }
      if (MAGIC_SIGNATURES.docx.some(sig => buffer.slice(0, sig.length).equals(sig))) {
        return 'docx';
      }
      if (
        MAGIC_SIGNATURES.png.some(sig => buffer.slice(0, sig.length).equals(sig)) ||
        MAGIC_SIGNATURES.jpg.some(sig => buffer.slice(0, sig.length).equals(sig))
      ) {
        return 'image';
      }
    }

    if (ext === 'pdf') return 'pdf';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
    if (['txt', 'md', 'csv', 'json'].includes(ext)) return 'text';

    return 'unknown';
  }

  /**
   * Ingest any document into a canonical CommonDocumentModel.
   * @param {string|Buffer} input - File path or raw buffer
   * @param {Object} options - { filename, documentId, startPage, endPage }
   * @returns {Promise<CommonDocumentModel>}
   */
  static async ingestDocument(input, options = {}) {
    let buffer = null;
    let filename = options.filename || 'uploaded_document';
    let documentId = options.documentId || null;

    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      if (input.startsWith('base64:')) {
        buffer = Buffer.from(input.substring(7), 'base64');
      } else if (fs.existsSync(input)) {
        buffer = fs.readFileSync(input);
        if (!options.filename) {
          filename = path.basename(input);
        }
      } else {
        // Raw text content string
        return DocumentRouter._buildFromRawText(input, filename, documentId);
      }
    } else {
      throw new Error('Invalid document input provided to DocumentRouter.');
    }

    const claimedExt = path.extname(filename).toLowerCase();
    const fileType = DocumentRouter.detectFileType(buffer, claimedExt);

    console.log(`📑 [DocumentRouter] Ingesting document: ${filename} (Type: ${fileType.toUpperCase()})`);

    let doc = null;

    if (fileType === 'pdf') {
      doc = await PdfMultimodalExtractor.extract(buffer, {
        filename,
        documentId,
        startPage: options.startPage,
        endPage: options.endPage
      });
    } else if (fileType === 'docx') {
      doc = await DocxMultimodalExtractor.extract(buffer, {
        filename,
        documentId
      });
    } else if (fileType === 'image') {
      doc = await DocumentRouter._extractFromStandaloneImage(buffer, filename, documentId);
    } else {
      // Default: parse as utf-8 text
      const text = buffer.toString('utf8');
      doc = DocumentRouter._buildFromRawText(text, filename, documentId);
    }

    // Attach summary stats to document metadata
    doc.metadata = {
      ...doc.metadata,
      ...doc.getSummaryStats()
    };

    return doc;
  }

  /**
   * Process a standalone image into a CommonDocumentModel.
   */
  static async _extractFromStandaloneImage(buffer, filename, documentId) {
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'image/png';
    if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';

    const doc = new CommonDocumentModel({
      documentId,
      sourceType: 'IMAGE',
      filename,
      totalPages: 1
    });

    const page = new DocumentPage({ pageNumber: 1, section: 'Visual Document' });

    // Step 1: Run local OCR
    const ocrResult = await OcrService.recognize(buffer);
    if (ocrResult.isReadable && ocrResult.text.length > 20) {
      doc.metadata.hasScans = true;
      doc.metadata.ocrApplied = true;
      page.addBlock(new DocumentBlock({
        blockId: 'blk_img_ocr',
        type: BlockTypes.OCR_TEXT,
        content: ocrResult.text,
        metadata: {
          ocrConfidence: ocrResult.confidence,
          isVisualEvidence: true
        }
      }));
    }

    // Step 2: Query vision service for diagrams / charts
    try {
      const visionResult = await visionService.describeImage(buffer, mimeType, 'diagram');
      if (visionResult && visionResult.description && visionResult.isSuccessful) {
        doc.metadata.hasCharts = true;
        page.addBlock(new DocumentBlock({
          blockId: 'blk_img_vision',
          type: BlockTypes.DIAGRAM,
          content: visionResult.description,
          metadata: {
            extractionMethod: visionResult.method,
            isVisualEvidence: true
          }
        }));
      }
    } catch (vErr) {
      console.warn(`⚠️ [DocumentRouter] Vision extraction notice: ${vErr.message}`);
    }

    doc.addPage(page);
    return doc;
  }

  /**
   * Wrap raw text string into CommonDocumentModel.
   */
  static _buildFromRawText(text, filename, documentId) {
    const clean = String(text || '').trim();
    const doc = new CommonDocumentModel({
      documentId,
      sourceType: 'TEXT',
      filename,
      totalPages: 1
    });

    const page = new DocumentPage({ pageNumber: 1, section: 'General' });
    if (clean) {
      const paragraphs = clean.split(/\n\s*\n/).filter(Boolean);
      paragraphs.forEach((p, idx) => {
        page.addBlock(new DocumentBlock({
          blockId: `blk_txt_${idx + 1}`,
          type: BlockTypes.PARAGRAPH,
          content: p.trim()
        }));
      });
    }

    doc.addPage(page);
    return doc;
  }
}

module.exports = DocumentRouter;
