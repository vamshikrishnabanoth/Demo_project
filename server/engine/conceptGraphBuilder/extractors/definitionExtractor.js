/**
 * Definition Extractor: Discovers concepts introduced via definition phrases
 * e.g., "X is defined as...", "X refers to...", "X is a mechanism that..."
 */

'use strict';

const { isValidConcept } = require('../utils/conceptSanitizer');
const { repairConcept } = require('../conceptRepair/index');

function extractDefinitions(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  // Single-line definition regex to prevent capturing across double newlines / Markdown headers
  const defRegex = /\b([A-Z][a-zA-Z0-9_\-\s]{2,40})\s+(?:is defined as|refers to|is a mechanism|is a protocol|is an algorithm|is a process)\b/gi;
  let match;

  while ((match = defRegex.exec(text)) !== null) {
    const rawTerm = match[1].trim();

    // Reject multi-line matches
    if (rawTerm.includes('\n') || rawTerm.includes('\r') || rawTerm.includes('#')) continue;

    if (rawTerm.length >= 2) {
      const repairRes = repairConcept(rawTerm);
      const cleanTerm = repairRes.repaired;

      if (cleanTerm && isValidConcept(cleanTerm)) {
        candidates.push({
          rawTerm: cleanTerm,
          originalTerm: rawTerm,
          source: "DEFINITION_PATTERN",
          startOffset: match.index,
          endOffset: match.index + rawTerm.length,
          repairStrategy: repairRes.strategy,
          confidence: repairRes.confidence
        });
      }
    }
  }

  return candidates;
}

module.exports = {
  name: "definitionExtractor",
  extract: extractDefinitions
};
