/**
 * verbPhraseRule.js
 * Rule: Repairs concepts containing trailing verb phrases or cutoff sentence fragments.
 * e.g., "Hash indexes provide O" -> "Hash Index"
 *       "Checksum is used for" -> "Checksum"
 *       "Database B" -> "Database"
 */

'use strict';

const { TECHNICAL_TERMS_MAP } = require('../../utils/conceptSanitizer');

function applyVerbPhraseRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const raw = candidate.trim();

  // Pattern 1: Verb phrase trailing cutoffs like "... provide O", "... is used for", "... is defined as"
  const cutoffRegex = /^(.+?)\s+(?:provide|provides|is used for|is defined as|is a mechanism|is a protocol|is an algorithm|is a|is an)\b.*$/i;
  const cutoffMatch = raw.match(cutoffRegex);
  if (cutoffMatch) {
    let repaired = cutoffMatch[1].trim();

    // Singularize plural technical nouns (e.g. "Hash indexes" -> "Hash Index")
    repaired = repaired.replace(/\b([A-Za-z0-9]+)\s+indexes\b/i, '$1 Index');
    repaired = repaired.replace(/\b([A-Za-z0-9]+)\s+protocols\b/i, '$1 Protocol');
    repaired = repaired.replace(/\b([A-Za-z0-9]+)\s+algorithms\b/i, '$1 Algorithm');

    // Normalize technical term if matched
    const lower = repaired.toLowerCase();
    if (TECHNICAL_TERMS_MAP.has(lower)) {
      repaired = TECHNICAL_TERMS_MAP.get(lower);
    }
    return {
      repaired,
      confidence: 0.95,
      strategy: "verb_phrase_trim"
    };
  }

  // Pattern 2: Isolated dangling letters after noun (e.g. "Database B", "Algorithm A")
  const danglingLetterRegex = /^([A-Z][a-zA-Z0-9_\s]+)\s+[A-Z]$/;
  const danglingMatch = raw.match(danglingLetterRegex);
  if (danglingMatch && !/b\+\s+tree|b\-\s*tree/i.test(raw)) {
    let repaired = danglingMatch[1].trim();
    return {
      repaired,
      confidence: 0.90,
      strategy: "dangling_letter_trim"
    };
  }

  return null;
}

module.exports = {
  name: "verbPhraseRule",
  apply: applyVerbPhraseRule
};
