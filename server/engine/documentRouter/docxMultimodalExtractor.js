/**
 * server/engine/documentRouter/docxMultimodalExtractor.js
 *
 * Multimodal DOCX / Word Document Extractor.
 * Preserves headings, paragraphs, lists, markdown tables, and embedded media (word/media/).
 * Processes embedded charts/diagrams with Vision/OCR and attaches them to corresponding sections.
 */

'use strict';

const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const path = require('path');
const { CommonDocumentModel, DocumentPage, DocumentBlock, BlockTypes } = require('./commonDocumentModel');
const visionService = require('./visionService');

class DocxMultimodalExtractor {
  /**
   * Extract structured multimodal document from a DOCX buffer or file path.
   * @param {Buffer} docxBuffer - Raw DOCX file buffer
   * @param {Object} options - { filename, documentId }
   * @returns {Promise<CommonDocumentModel>}
   */
  static async extract(docxBuffer, options = {}) {
    const filename = options.filename || 'uploaded_document.docx';
    const documentId = options.documentId || null;

    const doc = new CommonDocumentModel({
      documentId,
      sourceType: 'DOCX',
      filename,
      totalPages: 1
    });

    try {
      // 1. Extract HTML to retain structural hierarchy (h1, h2, table, p, ul)
      const htmlResult = await mammoth.convertToHtml({ buffer: docxBuffer });
      const html = htmlResult.value || '';

      // 2. Extract Embedded Media from DOCX zip archive (word/media/)
      const embeddedImages = await DocxMultimodalExtractor._extractMediaFiles(docxBuffer);
      if (embeddedImages.length > 0) {
        doc.metadata.hasImages = true;
      }

      // 3. Parse HTML DOM/tags into structured CommonDocumentModel blocks
      const page = new DocumentPage({ pageNumber: null, section: 'Document Body' });
      let currentSection = 'General';
      let blockCount = 1;

      // Split HTML by top-level block elements
      const tagRegex = /<(h[1-6]|p|table|ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match;

      while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const innerContent = match[2];

        if (tag.startsWith('h')) {
          const headingText = innerContent.replace(/<[^>]+>/g, '').trim();
          if (headingText) {
            currentSection = headingText;
            page.addBlock(new DocumentBlock({
              blockId: `blk_docx_${blockCount++}`,
              type: BlockTypes.HEADING,
              content: headingText,
              metadata: {
                headingLevel: parseInt(tag.charAt(1)) || 2,
                section: currentSection
              }
            }));
          }
        } else if (tag === 'table') {
          doc.metadata.hasTables = true;
          const mdTable = DocxMultimodalExtractor._convertHtmlTableToMarkdown(innerContent);
          if (mdTable) {
            page.addBlock(new DocumentBlock({
              blockId: `blk_docx_tbl_${blockCount++}`,
              type: BlockTypes.TABLE,
              content: mdTable,
              metadata: {
                section: currentSection,
                tableId: `tbl_docx_${blockCount}`
              }
            }));
          }
        } else {
          // Paragraph or list item
          const text = innerContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 0) {
            page.addBlock(new DocumentBlock({
              blockId: `blk_docx_${blockCount++}`,
              type: BlockTypes.PARAGRAPH,
              content: text,
              metadata: { section: currentSection }
            }));
          }
        }
      }

      // 4. Attach Embedded Visual Media Descriptions to the document
      let imageIdx = 1;
      for (const img of embeddedImages) {
        // Skip tiny decorative icons (< 4KB)
        if (img.buffer.length < 4096) continue;

        try {
          const descResult = await visionService.describeImage(img.buffer, img.mimeType, 'diagram');
          if (descResult && descResult.description && descResult.isSuccessful) {
            doc.metadata.hasCharts = true;
            page.addBlock(new DocumentBlock({
              blockId: `blk_docx_fig_${imageIdx++}`,
              type: BlockTypes.CHART,
              content: descResult.description,
              metadata: {
                imageId: img.name,
                figureId: `FIG_${imageIdx}`,
                section: currentSection,
                isVisualEvidence: true,
                extractionMethod: descResult.method
              }
            }));
          }
        } catch (visionErr) {
          console.warn(`⚠️ [DocxExtractor] Visual extraction notice for ${img.name}: ${visionErr.message}`);
        }
      }

      // If HTML parsing yielded no blocks, fallback to raw text extraction
      if (page.blocks.length === 0) {
        const rawResult = await mammoth.extractRawText({ buffer: docxBuffer });
        const rawText = (rawResult.value || '').trim();
        if (rawText) {
          const paragraphs = rawText.split(/\n\s*\n/).filter(Boolean);
          paragraphs.forEach((p, idx) => {
            page.addBlock(new DocumentBlock({
              blockId: `blk_raw_${idx + 1}`,
              type: BlockTypes.PARAGRAPH,
              content: p.trim()
            }));
          });
        }
      }

      doc.addPage(page);
      return doc;
    } catch (err) {
      console.warn(`⚠️ [DocxExtractor] Structured DOCX extraction notice: ${err.message}. Falling back to raw text.`);
      const rawResult = await mammoth.extractRawText({ buffer: docxBuffer });
      const page = new DocumentPage();
      page.addBlock(new DocumentBlock({
        blockId: 'blk_fallback',
        type: BlockTypes.PARAGRAPH,
        content: rawResult.value || ''
      }));
      doc.addPage(page);
      return doc;
    }
  }

  /**
   * Converts HTML <table> content into a clean Markdown table.
   */
  static _convertHtmlTableToMarkdown(tableHtml) {
    const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rowMatches.length === 0) return '';

    const rows = [];
    let maxCols = 0;

    for (const rowHtml of rowMatches) {
      const cellMatches = rowHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
      const cells = cellMatches.map(cellHtml => {
        return cellHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\|/g, '\\|')
          .replace(/\s+/g, ' ')
          .trim();
      });

      if (cells.length > 0) {
        rows.push(cells);
        maxCols = Math.max(maxCols, cells.length);
      }
    }

    if (rows.length === 0 || maxCols < 2) return '';

    const normalized = rows.map(r => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push('-');
      return padded.map(c => (c === '' ? '-' : c));
    });

    const header = normalized[0];
    const separator = Array(maxCols).fill('---');
    const dataRows = normalized.slice(1);

    const mdLines = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`
    ];

    for (const row of dataRows) {
      mdLines.push(`| ${row.join(' | ')} |`);
    }

    return mdLines.join('\n');
  }

  /**
   * Extract image media buffers from DOCX zip archive.
   */
  static async _extractMediaFiles(docxBuffer) {
    const images = [];
    try {
      const zip = new AdmZip(docxBuffer);
      const zipEntries = zip.getEntries();

      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('word/media/')) {
          const ext = path.extname(entry.entryName).toLowerCase();
          let mimeType = 'image/png';
          if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === '.gif') mimeType = 'image/gif';
          else if (ext === '.webp') mimeType = 'image/webp';

          images.push({
            name: path.basename(entry.entryName),
            buffer: entry.getData(),
            mimeType
          });
        }
      }
    } catch (zipErr) {
      console.warn(`⚠️ [DocxExtractor] Media zip extraction notice: ${zipErr.message}`);
    }
    return images;
  }
}

module.exports = DocxMultimodalExtractor;
