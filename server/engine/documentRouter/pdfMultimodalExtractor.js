/**
 * server/engine/documentRouter/pdfMultimodalExtractor.js
 *
 * Page-Aware Multimodal PDF Extractor.
 * Extracts text page-by-page, detects table alignments into Markdown tables,
 * runs Tesseract OCR on sparse/scanned pages, and populates CommonDocumentModel.
 * Preserves a resilient flat-text fallback so standard documents never break.
 */

'use strict';

const pdfParse = require('pdf-parse');
const { CommonDocumentModel, DocumentPage, DocumentBlock, BlockTypes } = require('./commonDocumentModel');
const TableExtractor = require('./tableExtractor');
const OcrService = require('./ocrService');
const visionService = require('./visionService');

class PdfMultimodalExtractor {
  /**
   * Extract structured multimodal document from a PDF buffer.
   * @param {Buffer} pdfBuffer - Raw PDF file buffer
   * @param {Object} options - { filename, documentId, startPage, endPage }
   * @returns {Promise<CommonDocumentModel>}
   */
  static async extract(pdfBuffer, options = {}) {
    const filename = options.filename || 'uploaded_document.pdf';
    const documentId = options.documentId || null;
    const startPage = Math.max(1, parseInt(options.startPage) || 1);
    const endPage = Math.max(startPage, parseInt(options.endPage) || 9999);

    const doc = new CommonDocumentModel({
      documentId,
      sourceType: 'PDF',
      filename,
      totalPages: 1
    });

    const rawPages = [];

    // Custom pagerender to capture exact page-level text items without DOM font loading
    const pagerender = async (pageData) => {
      const pageNumber = pageData.pageIndex + 1;
      if (pageNumber < startPage || pageNumber > endPage) {
        return '';
      }

      try {
        const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
        const items = textContent.items || [];

        // Group items into lines based on Y-coordinates
        const lineMap = new Map();
        for (const item of items) {
          const str = (item.str || '').trim();
          if (!str) continue;

          // Round Y-coordinate to 2 decimal places to cluster same-line tokens
          const y = Math.round((item.transform[5] || 0) * 10) / 10;
          const fontSize = Math.round(Math.abs(item.transform[0] || item.height || 10));

          if (!lineMap.has(y)) {
            lineMap.set(y, { text: str, fontSize, items: [item] });
          } else {
            const entry = lineMap.get(y);
            entry.text += ' ' + str;
            entry.fontSize = Math.max(entry.fontSize, fontSize);
            entry.items.push(item);
          }
        }

        // Sort lines descending by Y (top to bottom of page)
        const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
        const lines = sortedY.map(y => lineMap.get(y));

        rawPages.push({
          pageNumber,
          lines,
          rawText: lines.map(l => l.text).join('\n')
        });

        return lines.map(l => l.text).join('\n');
      } catch (pageErr) {
        console.warn(`⚠️ [PdfExtractor] Page ${pageNumber} structured extraction notice: ${pageErr.message}. Falling back to default text.`);
        return '';
      }
    };

    try {
      const parsed = await pdfParse(pdfBuffer, { pagerender });
      doc.totalPages = parsed.numpages || rawPages.length || 1;

      // Process extracted pages
      for (const p of rawPages) {
        const page = new DocumentPage({ pageNumber: p.pageNumber });

        // Check text density for scanned page detection
        const pageText = p.rawText || '';
        const isSparseOrScanned = OcrService.isScannedPage(pageText, 100);

        if (isSparseOrScanned) {
          doc.metadata.hasScans = true;

          // Attempt local OCR on any embedded JPEG images within the PDF
          const embeddedImages = PdfMultimodalExtractor.extractEmbeddedImages(pdfBuffer);
          let ocrExtracted = '';
          for (const img of embeddedImages) {
            try {
              const ocrResult = await OcrService.recognize(img);
              if (ocrResult.isReadable && ocrResult.text) {
                ocrExtracted += '\n' + ocrResult.text;
              }
            } catch (err) {
              // Ignore single image OCR failures
            }
          }

          if (ocrExtracted.trim().length > pageText.length) {
            doc.metadata.ocrApplied = true;
            page.addBlock(new DocumentBlock({
              blockId: `blk_p${p.pageNumber}_ocr`,
              type: BlockTypes.OCR_TEXT,
              content: ocrExtracted.trim(),
              metadata: {
                ocrConfidence: 75,
                pageNumber: p.pageNumber
              }
            }));
            doc.addPage(page);
            continue;
          }
        }

        // Extract headings, tables, and paragraphs from line clusters
        const textLines = p.lines.map(l => l.text);
        const segments = TableExtractor.extractTablesAndText(textLines.join('\n'));

        let blockIndex = 1;
        for (const seg of segments) {
          if (seg.type === 'table') {
            doc.metadata.hasTables = true;
            page.addBlock(new DocumentBlock({
              blockId: `blk_p${p.pageNumber}_tbl_${blockIndex++}`,
              type: BlockTypes.TABLE,
              content: seg.content,
              metadata: {
                tableId: seg.metadata.tableId || `tbl_p${p.pageNumber}`,
                rowCount: seg.metadata.rowCount,
                colCount: seg.metadata.colCount,
                pageNumber: p.pageNumber
              }
            }));
          } else {
            // Check if paragraph is a heading (short line, upper casing or large font)
            const isHeading = seg.content.length < 90 && (
              /^[A-Z0-9\s:.-]{4,}$/.test(seg.content) ||
              /^(Chapter|Section|Unit|Part|Table|Figure)\s+\d+/i.test(seg.content) ||
              seg.content.endsWith(':')
            );

            page.addBlock(new DocumentBlock({
              blockId: `blk_p${p.pageNumber}_txt_${blockIndex++}`,
              type: isHeading ? BlockTypes.HEADING : BlockTypes.PARAGRAPH,
              content: seg.content,
              metadata: {
                pageNumber: p.pageNumber,
                headingLevel: isHeading ? 2 : null
              }
            }));
          }
        }

        doc.addPage(page);
      }

      // Only scan for embedded images if document is sparse (<500 chars) or explicitly contains scans
      const isDocumentSparse = doc.getAllBlocks().length === 0 || doc.toUnifiedText().length < 500;
      if (doc.metadata.hasScans || isDocumentSparse) {
        const embeddedImages = PdfMultimodalExtractor.extractEmbeddedImages(pdfBuffer);
        if (embeddedImages.length > 0) {
          doc.metadata.hasImages = true;
          let imgIdx = 1;
          for (const img of embeddedImages) {
            if (img.length < 1500) continue; // Skip tiny icons
            try {
              const descResult = await visionService.describeImage(img, 'image/jpeg', 'chart');
              if (descResult && descResult.description && descResult.isSuccessful) {
                doc.metadata.hasCharts = true;
                const targetPage = doc.pages[0] || new DocumentPage({ pageNumber: 1 });
                targetPage.addBlock(new DocumentBlock({
                  blockId: `blk_pdf_img_${imgIdx++}`,
                  type: BlockTypes.CHART,
                  content: descResult.description,
                  metadata: {
                    figureId: `FIG_PDF_${imgIdx}`,
                    pageNumber: targetPage.pageNumber || 1,
                    isVisualEvidence: true,
                    extractionMethod: descResult.method
                  }
                }));
                if (doc.pages.length === 0) doc.addPage(targetPage);
              }
            } catch (imgErr) {
              console.warn(`⚠️ [PdfExtractor] Embedded image description notice: ${imgErr.message}`);
            }
          }
        }
      }

      // If page-level extraction produced no blocks (e.g. edge case PDF format), use flat text safety net
      if (doc.getAllBlocks().length === 0) {
        console.warn(`⚠️ [PdfExtractor] Page-level blocks empty. Using flat-text safety net.`);
        const fallbackText = parsed.text || '';
        return PdfMultimodalExtractor._buildFlatFallback(fallbackText, filename, documentId);
      }

      return doc;
    } catch (parseErr) {
      console.warn(`⚠️ [PdfExtractor] Full structured extraction error: ${parseErr.message}. Executing resilient flat-text fallback.`);
      try {
        const flatParsed = await pdfParse(pdfBuffer);
        return PdfMultimodalExtractor._buildFlatFallback(flatParsed.text || '', filename, documentId);
      } catch (fatalErr) {
        console.error(`❌ [PdfExtractor] Flat fallback also failed: ${fatalErr.message}`);
        // Return empty document model so controller can issue controlled failure
        return doc;
      }
    }
  }

  /**
   * Resilient fallback constructing CommonDocumentModel from flat text.
   */
  static _buildFlatFallback(text, filename, documentId) {
    const doc = new CommonDocumentModel({
      documentId,
      sourceType: 'PDF',
      filename,
      totalPages: 1
    });

    const clean = (text || '').trim();
    if (!clean) return doc;

    // Check for form-feed page delimiters
    const pages = clean.includes('\f') ? clean.split('\f').filter(Boolean) : [clean];
    doc.totalPages = pages.length;

    pages.forEach((pageText, pIdx) => {
      const page = new DocumentPage({ pageNumber: pIdx + 1 });
      const segments = TableExtractor.extractTablesAndText(pageText);

      segments.forEach((seg, sIdx) => {
        page.addBlock(new DocumentBlock({
          blockId: `blk_p${pIdx + 1}_${sIdx + 1}`,
          type: seg.type === 'table' ? BlockTypes.TABLE : BlockTypes.PARAGRAPH,
          content: seg.content,
          metadata: seg.metadata
        }));
      });

      doc.addPage(page);
    });

    return doc;
  }

  /**
   * Search PDF binary buffer for embedded JPEG images (FF D8 FF ... FF D9).
   * @param {Buffer} buffer
   * @returns {Buffer[]}
   */
  static extractEmbeddedImages(buffer) {
    if (!Buffer.isBuffer(buffer)) return [];
    const images = [];
    let offset = 0;
    const validJpegMarkers = [0xE0, 0xE1, 0xE2, 0xDB, 0xC0, 0xC2, 0xEE, 0xFE];
    while (offset < buffer.length - 5) {
      // JPEG SOI: 0xFF 0xD8 0xFF followed by valid JPEG marker
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xD8 && buffer[offset + 2] === 0xFF && validJpegMarkers.includes(buffer[offset + 3])) {
        let end = offset + 2;
        while (end < buffer.length - 1) {
          // JPEG EOI: 0xFF 0xD9
          if (buffer[end] === 0xFF && buffer[end + 1] === 0xD9) {
            const imgBuf = buffer.slice(offset, end + 2);
            if (imgBuf.length > 1024) { // Only images > 1KB
              images.push(imgBuf);
            }
            offset = end + 2;
            break;
          }
          end++;
        }
        if (end >= buffer.length - 1) break;
      } else {
        offset++;
      }
    }
    return images;
  }
}

module.exports = PdfMultimodalExtractor;
