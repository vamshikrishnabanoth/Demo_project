/**
 * pluralNormalizationRule.js
 * Rule: Normalizes plural technical nouns into singular canonical concepts.
 * e.g., "Hash Indexes" -> "Hash Index"
 *       "Network Protocols" -> "Network Protocol"
 */

'use strict';

function applyPluralNormalizationRule(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const raw = candidate.trim();

  // Pattern: Nouns ending in " Indexes", " Protocols", " Algorithms", " Trees", " Structures"
  const pluralRegex = /^(.+?)\s+(Indexes|Protocols|Algorithms|Trees|Structures|Tables|Sockets|Frames|Packets)$/i;
  const match = raw.match(pluralRegex);

  if (match) {
    const base = match[1];
    const pluralSuffix = match[2];
    let singularSuffix = pluralSuffix;

    if (pluralSuffix.toLowerCase() === 'indexes') singularSuffix = 'Index';
    else if (pluralSuffix.toLowerCase().endsWith('s')) singularSuffix = pluralSuffix.slice(0, -1);

    const repaired = `${base} ${singularSuffix}`;
    return {
      repaired,
      confidence: 0.90,
      strategy: "plural_singular_normalization"
    };
  }

  return null;
}

module.exports = {
  name: "pluralNormalizationRule",
  apply: applyPluralNormalizationRule
};
