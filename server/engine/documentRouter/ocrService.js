/**
 * server/engine/documentRouter/ocrService.js
 *
 * Local OCR Service using Tesseract.js.
 * Strictly extracts observable text with confidence scores; NEVER fabricates unreadable content.
 */

'use strict';

let Tesseract = null;
try {
  Tesseract = require('tesseract.js');
} catch (e) {
  console.warn('⚠️ [OcrService] Tesseract.js module not available:', e.message);
}

class OcrService {
  /**
   * Perform OCR on an image buffer or file path.
   * @param {Buffer|string} imageInput - Image buffer or file path
   * @param {Object} options - { language: 'eng', minConfidence: 40 }
   * @returns {Promise<{ text: string, confidence: number, isReadable: boolean, error?: string }>}
   */
  static async recognize(imageInput, options = {}) {
    if (!Tesseract) {
      return {
        text: '',
        confidence: 0,
        isReadable: false,
        error: 'Tesseract OCR engine is not installed or available.'
      };
    }

    if (!imageInput) {
      return {
        text: '',
        confidence: 0,
        isReadable: false,
        error: 'No image input provided for OCR.'
      };
    }

    if (Buffer.isBuffer(imageInput) && imageInput.length >= 4 && imageInput.slice(0, 4).toString() === '%PDF') {
      return {
        text: '',
        confidence: 0,
        isReadable: false,
        error: 'Cannot run OCR directly on raw PDF binary; input must be an image buffer.'
      };
    }

    const minConfidence = typeof options.minConfidence === 'number' ? options.minConfidence : 35;
    const language = options.language || 'eng';

    try {
      const result = await Tesseract.recognize(imageInput, language, {
        logger: () => {} // Silent logger to avoid polluting logs
      });

      const text = (result?.data?.text || '').trim();
      const confidence = Math.round(result?.data?.confidence || 0);

      // Sanitize extracted OCR text
      const cleanText = text
        .replace(/[^\x20-\x7E\s]/g, '') // remove non-printable ASCII
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const isReadable = cleanText.length >= 10 && confidence >= minConfidence;

      return {
        text: cleanText,
        confidence: confidence / 100, // normalize to 0.0 - 1.0
        isReadable,
        wordCount: cleanText.split(/\s+/).filter(Boolean).length
      };
    } catch (err) {
      console.warn(`⚠️ [OcrService] OCR recognition failed: ${err.message}`);
      return {
        text: '',
        confidence: 0,
        isReadable: false,
        error: err.message
      };
    }
  }

  /**
   * Evaluates text density to detect whether a document page is likely a scan.
   * @param {string} pageText
   * @param {number} minCharsThreshold - Default 100 characters
   * @returns {boolean}
   */
  static isScannedPage(pageText, minCharsThreshold = 100) {
    if (!pageText || typeof pageText !== 'string') return true;
    const clean = pageText.replace(/\s+/g, ' ').trim();
    return clean.length < minCharsThreshold;
  }
}

module.exports = OcrService;
