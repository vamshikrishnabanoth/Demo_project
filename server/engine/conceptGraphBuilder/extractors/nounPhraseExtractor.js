/**
 * Noun Phrase Extractor: Discovers multi-word noun phrases and technical terms
 */
'use strict';

const { isValidConcept } = require('../utils/conceptSanitizer');
const { repairConcept } = require('../conceptRepair/index');

function extractNounPhrases(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  // Match multi-word technical noun phrases or camelCase/snake_case terms
  const nounRegex = /\b([A-Z][a-z0-9]+(?:\s+[A-Za-z0-9]+){1,3}|[a-z0-9]+_[a-z0-9_]+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+)\b/g;
  let match;

  while ((match = nounRegex.exec(text)) !== null) {
    const rawTerm = match[1].trim();
    if (rawTerm.length >= 2 && !rawTerm.includes('\n')) {
      // Pass candidate through repair engine & sanitizer
      const repairRes = repairConcept(rawTerm);
      const cleanTerm = repairRes.repaired;

      if (cleanTerm && isValidConcept(cleanTerm)) {
        candidates.push({
          rawTerm: cleanTerm,
          originalTerm: rawTerm,
          source: "MULTI_WORD_NOUN_PHRASE",
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
  name: "nounPhraseExtractor",
  extract: extractNounPhrases
};
