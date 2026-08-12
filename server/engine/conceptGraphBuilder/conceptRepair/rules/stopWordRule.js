/**
 * stopWordRule.js
 * Rule: Strips sentence-initial or sentence-terminal stop words.
 * e.g., "An ACK flag is" -> "ACK Flag"
 *       "The TCP protocol" -> "TCP Protocol"
 */

'use strict';

const { trimStopWords, sanitizeConcept } = require('../../utils/conceptSanitizer');

function applyStopWordRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const raw = candidate.trim();

  // If sentence starts with "An ", "A ", "The " followed by technical terms and ends with " is", " are"
  if (/^(?:an|a|the)\s+(.+?)(?:\s+(?:is|are|was|were))?$/i.test(raw)) {
    const trimmed = trimStopWords(raw);
    const sanitized = sanitizeConcept(trimmed);
    if (sanitized && sanitized !== raw) {
      return {
        repaired: sanitized,
        confidence: 0.95,
        strategy: "stop_word_boundary_strip"
      };
    }
  }

  return null;
}

module.exports = {
  name: "stopWordRule",
  apply: applyStopWordRule
};
