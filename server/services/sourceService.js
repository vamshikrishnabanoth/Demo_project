const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');
const cacheManager = require('../utils/cacheManager');
const { generateAssetCacheKey } = require('../utils/cacheHash');

/**
 * Source Processing Service with Namespaced Asset Caching
 */
class SourceService {
  /**
   * Extract text from a file with L1/L2 asset caching
   */
  async extractTextFromFile(filePath, reqId = 'default') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = path.extname(filePath).toLowerCase();

    // 1. Generate Namespaced Asset Cache Key: asset:${fileHash}
    const cacheKey = generateAssetCacheKey(fileBuffer, stats.size, mimeType);

    // 2. Fetch using Cache Read Priority & Singleflight Request Coalescing
    return await cacheManager.fetchCoalesced(cacheKey, async () => {
      const startTime = Date.now();
      let extractedText = '';

      if (mimeType === '.pdf') {
        const data = await pdfParse(fileBuffer);
        extractedText = data.text;
      } else if (mimeType === '.docx') {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } else if (['.pptx', '.xlsx', '.ppt'].includes(mimeType)) {
        extractedText = await new Promise((resolve, reject) => {
          officeParser.parseOffice(filePath, (data, err) => {
            if (err) return reject(err);
            resolve(typeof data === 'string' ? data : JSON.stringify(data));
          });
        });
      } else {
        extractedText = fileBuffer.toString('utf8');
      }

      const processingTimeMs = Date.now() - startTime;

      if (extractedText && extractedText.trim().length > 10) {
        // Cache write on success
        cacheManager.set(cacheKey, extractedText, {
          measuredProcessingTimeMs: processingTimeMs,
          qualityScore: 1.0,
          category: 'asset'
        }, reqId);
      }

      return extractedText;
    }, reqId);
  }
}

module.exports = new SourceService();
