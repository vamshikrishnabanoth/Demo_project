/**
 * markdownRule.js
 * Rule: Strips raw markdown hashes, multi-line header breaks, and decorative symbols.
 * e.g., "# Computer Network Protocols" -> "Computer Network Protocols"
 *       "Architecture\n\nTransmission Control Protocol" -> "Transmission Control Protocol"
 */

'use strict';

const { sanitizeConcept } = require('../../utils/conceptSanitizer');

function applyMarkdownRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  let raw = candidate;

  // Check if candidate contains newline line breaks or markdown hashes
  if (/\n|\r|#{1,6}/.test(raw)) {
    // If multiline, take the most descriptive line (usually the last or non-header line)
    const lines = raw.split(/[\r\n]+/).map(l => l.replace(/^#{1,6}\s+/, '').trim()).filter(Boolean);
    if (lines.length > 0) {
      const bestLine = lines[lines.length - 1]; // Select target title
      const sanitized = sanitizeConcept(bestLine);
      if (sanitized) {
        return {
          repaired: sanitized,
          confidence: 0.92,
          strategy: "markdown_header_repair"
        };
      }
    }
  }

  return null;
}

module.exports = {
  name: "markdownRule",
  apply: applyMarkdownRule
};
