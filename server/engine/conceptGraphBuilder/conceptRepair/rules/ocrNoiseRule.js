/**
 * ocrNoiseRule.js
 * Rule: Cleans OCR artifacts such as spaced hyphens ("B - Tree"), stray underscores, or dot leaders.
 * e.g., "B - Tree" -> "B-Tree"
 */

'use strict';

function applyOcrNoiseRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  let raw = candidate.trim();

  // Pattern 1: Spaced hyphen in technical terms (e.g., "B - Tree", "B - Tree Index")
  if (/\b[A-Za-z0-9]+\s+-\s+[A-Za-z0-9]+\b/.test(raw)) {
    const repaired = raw.replace(/\b([A-Za-z0-9]+)\s+-\s+([A-Za-z0-9]+)\b/g, '$1-$2');
    return {
      repaired,
      confidence: 0.90,
      strategy: "ocr_spaced_hyphen_fix"
    };
  }

  // Pattern 2: Stray dot leaders or underscores at edges
  if (/[\._]{2,}/.test(raw)) {
    const repaired = raw.replace(/[\._]{2,}/g, '').trim();
    if (repaired && repaired !== raw) {
      return {
        repaired,
        confidence: 0.85,
        strategy: "ocr_dot_leader_strip"
      };
    }
  }

  return null;
}

module.exports = {
  name: "ocrNoiseRule",
  apply: applyOcrNoiseRule
};
