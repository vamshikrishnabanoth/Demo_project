/**
 * Header Extractor: Discovers concepts from Markdown and section headers
 */

'use strict';

const { isValidConcept } = require('../utils/conceptSanitizer');
const { repairConcept } = require('../conceptRepair/index');

function extractHeaders(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  const lines = text.split('\n');
  let charOffset = 0;

  lines.forEach((line) => {
    const lineTrim = line.trim();
    const headerMatch = lineTrim.match(/^#{1,6}\s+(.+)$/) || lineTrim.match(/^([A-Z0-9\s_\-]{3,50}):$/);

    if (headerMatch) {
      const title = headerMatch[1].replace(/^#{1,6}\s+/, '').trim();
      if (title.length > 2 && title.length < 60) {
        const repairRes = repairConcept(title);
        const cleanTerm = repairRes.repaired;

        if (cleanTerm && isValidConcept(cleanTerm)) {
          const start = charOffset + line.indexOf(title);
          candidates.push({
            rawTerm: cleanTerm,
            originalTerm: title,
            source: "HEADER",
            startOffset: start,
            endOffset: start + title.length,
            repairStrategy: repairRes.strategy,
            confidence: repairRes.confidence
          });
        }
      }
    }
    charOffset += line.length + 1; // +1 for newline
  });

  return candidates;
}

module.exports = {
  name: "headerExtractor",
  extract: extractHeaders
};
