/**
 * server/engine/documentRouter/ocrService.js
 *
 * Local OCR Service using Tesseract.js with Bounded Worker Pool.
 * Features:
 *   - Configurable bounded worker pool (OCR_WORKERS=2 default)
 *   - Concurrent multi-page dispatch (eliminates sequential bottleneck)
 *   - Magic-byte image stream validation (prevents worker crashes on non-image bytes)
 *   - Observable metrics & duration tracking
 *   - Graceful fallback on memory/worker constraints
 */

'use strict';

const providerConfig = require('../../config/providerConfig');
const productionMetrics = require('../../utils/productionMetrics');

let Tesseract = null;
try {
  Tesseract = require('tesseract.js');
} catch (e) {
  console.warn('⚠️ [OcrService] Tesseract.js module not available:', e.message);
}

class OcrWorkerPool {
  constructor(size = providerConfig.ocr.workerCount) {
    this.poolSize = Math.max(1, size);
    this.workers = [];
    this.busyFlags = [];
    this.queue = [];
    this.isInitialized = false;
    this.initPromise = null;
  }

  async init() {
    if (!Tesseract) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log(`[OcrWorkerPool] Initializing OCR worker pool (size=${this.poolSize})...`);
        for (let i = 0; i < this.poolSize; i++) {
          const worker = await Tesseract.createWorker('eng', 1, {
            logger: () => {} // Silent logger
          });
          this.workers.push(worker);
          this.busyFlags.push(false);
        }
        this.isInitialized = true;
        console.log(`[OcrWorkerPool] ✅ OCR worker pool initialized with ${this.workers.length} workers.`);
      } catch (err) {
        console.warn(`[OcrWorkerPool] ⚠️ Pool initialization notice: ${err.message}. Falling back to on-demand workers.`);
        this.isInitialized = false;
      }
    })();

    return this.initPromise;
  }

  async acquireWorker() {
    await this.init();

    if (!this.isInitialized || this.workers.length === 0) {
      return null; // Fallback to direct Tesseract.recognize
    }

    // Find first idle worker
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.busyFlags[i]) {
        this.busyFlags[i] = true;
        return { index: i, worker: this.workers[i] };
      }
    }

    // All busy: wait for next available
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  releaseWorker(index) {
    if (index === undefined || index < 0 || index >= this.busyFlags.length) return;

    if (this.queue.length > 0) {
      const nextInQueue = this.queue.shift();
      nextInQueue({ index, worker: this.workers[index] });
    } else {
      this.busyFlags[index] = false;
    }
  }

  async terminate() {
    for (const w of this.workers) {
      try { await w.terminate(); } catch (_) {}
    }
    this.workers = [];
    this.busyFlags = [];
    this.isInitialized = false;
    this.initPromise = null;
  }
}

const globalWorkerPool = new OcrWorkerPool();

class OcrService {
  /**
   * Validate image buffer magic bytes before handing off to Tesseract.
   */
  static validateImageBuffer(imageInput) {
    if (!Buffer.isBuffer(imageInput)) return { valid: true };

    if (imageInput.length < 8) {
      return { valid: false, error: 'Image buffer too small or empty.' };
    }
    if (imageInput.slice(0, 4).toString() === '%PDF') {
      return { valid: false, error: 'Cannot run OCR directly on raw PDF binary; input must be an image buffer.' };
    }

    const isPng = imageInput[0] === 0x89 && imageInput[1] === 0x50 && imageInput[2] === 0x4E && imageInput[3] === 0x47;
    const validJpegMarkers = [0xE0, 0xE1, 0xE2, 0xDB, 0xC0, 0xC2, 0xEE, 0xFE];
    const isJpeg = imageInput[0] === 0xFF && imageInput[1] === 0xD8 && imageInput[2] === 0xFF && validJpegMarkers.includes(imageInput[3]);
    const isGif = imageInput[0] === 0x47 && imageInput[1] === 0x49 && imageInput[2] === 0x46;
    const isBmp = imageInput[0] === 0x42 && imageInput[1] === 0x4D;
    const isTiff = (imageInput[0] === 0x49 && imageInput[1] === 0x49) || (imageInput[0] === 0x4D && imageInput[1] === 0x4D);
    const isWebp = imageInput.length >= 12 && imageInput.slice(0, 4).toString() === 'RIFF' && imageInput.slice(8, 12).toString() === 'WEBP';

    if (!isPng && !isJpeg && !isGif && !isBmp && !isTiff && !isWebp) {
      return { valid: false, error: 'Unsupported or corrupted image format. Input must be a valid PNG, JPEG, BMP, or TIFF image.' };
    }

    return { valid: true };
  }

  /**
   * Perform OCR on an image buffer or file path with worker pool dispatch.
   * @param {Buffer|string} imageInput - Image buffer or file path
   * @param {Object} options - { language: 'eng', minConfidence: 35 }
   * @returns {Promise<{ text: string, confidence: number, isReadable: boolean, error?: string }>}
   */
  static async recognize(imageInput, options = {}) {
    if (!Tesseract) {
      return { text: '', confidence: 0, isReadable: false, error: 'Tesseract OCR engine is not installed or available.' };
    }
    if (!imageInput) {
      return { text: '', confidence: 0, isReadable: false, error: 'No image input provided for OCR.' };
    }

    const validation = OcrService.validateImageBuffer(imageInput);
    if (!validation.valid) {
      return { text: '', confidence: 0, isReadable: false, error: validation.error };
    }

    const minConfidence = typeof options.minConfidence === 'number' ? options.minConfidence : providerConfig.ocr.minConfidence;
    const language = options.language || 'eng';
    const startTime = Date.now();
    productionMetrics.inc('ocr_requests_total');

    let workerToken = null;
    try {
      workerToken = await globalWorkerPool.acquireWorker();
      let result;

      if (workerToken && workerToken.worker) {
        result = await workerToken.worker.recognize(imageInput);
      } else {
        result = await Tesseract.recognize(imageInput, language, { logger: () => {} });
      }

      const durationMs = Date.now() - startTime;
      productionMetrics.recordLatency('ocr', durationMs);

      const text = (result?.data?.text || '').trim();
      const confidence = Math.round(result?.data?.confidence || 0);

      const cleanText = text
        .replace(/[^\x20-\x7E\s]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const isReadable = cleanText.length >= 10 && confidence >= minConfidence;

      return {
        text: cleanText,
        confidence: confidence / 100,
        isReadable,
        durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      productionMetrics.recordLatency('ocr', durationMs);
      return {
        text: '',
        confidence: 0,
        isReadable: false,
        error: `OCR execution failed: ${err.message}`
      };
    } finally {
      if (workerToken) {
        globalWorkerPool.releaseWorker(workerToken.index);
      }
    }
  }

  /**
   * Concurrently recognize a batch of page images using the worker pool.
   * @param {Array<Buffer|string>} images - Array of page image buffers
   * @param {Object} options - OCR options
   * @returns {Promise<Array<{ text: string, confidence: number, isReadable: boolean }>>}
   */
  static async recognizeBatch(images = [], options = {}) {
    if (!Array.isArray(images) || images.length === 0) return [];
    return Promise.all(images.map(img => OcrService.recognize(img, options)));
  }

  /**
   * Check whether an extracted page text indicates a scanned/sparse page requiring OCR.
   * @param {string} text
   * @param {number} minChars
   * @returns {boolean}
   */
  static isScannedPage(text = '', minChars = 100) {
    if (!text || typeof text !== 'string') return true;
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length < minChars;
  }

  static getWorkerPool() {
    return globalWorkerPool;
  }
}

module.exports = OcrService;
