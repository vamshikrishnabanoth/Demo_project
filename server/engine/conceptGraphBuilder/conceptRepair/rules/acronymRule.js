/**
 * acronymRule.js
 * Rule: Standardizes technical acronyms and math notations to authoritative upper-case/casing.
 * e.g., "tcp" -> "TCP", "o(1)" -> "O(1)"
 */

'use strict';

const { TECHNICAL_TERMS_MAP } = require('../../utils/conceptSanitizer');

function applyAcronymRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const lower = candidate.trim().toLowerCase();

  if (TECHNICAL_TERMS_MAP.has(lower)) {
    const repaired = TECHNICAL_TERMS_MAP.get(lower);
    if (repaired !== candidate) {
      return {
        repaired,
        confidence: 1.0,
        strategy: "authoritative_acronym_canonicalization"
      };
    }
  }

  return null;
}

module.exports = {
  name: "acronymRule",
  apply: applyAcronymRule
};
