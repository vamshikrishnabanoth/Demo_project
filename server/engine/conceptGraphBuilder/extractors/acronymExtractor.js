/**
 * Acronym & Parenthetical Extractor: Discovers uppercase acronyms and explicit expansions like "Transmission Control Protocol (TCP)"
 */
function extractAcronyms(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  // Pattern 1: Explicit expansion "Transmission Control Protocol (TCP)"
  const expansionRegex = /\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)+)\s*\(([A-Z]{2,10})\)/g;
  let match;

  while ((match = expansionRegex.exec(text)) !== null) {
    const fullPhrase = match[1].trim();
    const acronym = match[2].trim();

    candidates.push({
      rawTerm: fullPhrase,
      source: "ACRONYM",
      alias: acronym,
      startOffset: match.index,
      endOffset: match.index + match[0].length
    });
  }

  // Pattern 2: Standalone Acronyms (e.g., "TCP", "DNS", "UDP")
  const acronymRegex = /\b([A-Z]{2,10}[0-9]?)\b/g;
  while ((match = acronymRegex.exec(text)) !== null) {
    const acronym = match[1].trim();
    if (!['THE', 'FOR', 'AND', 'NOT', 'YOU', 'CAN', 'SEE', 'ANY'].includes(acronym)) {
      candidates.push({
        rawTerm: acronym,
        source: "ACRONYM",
        startOffset: match.index,
        endOffset: match.index + acronym.length
      });
    }
  }

  return candidates;
}

module.exports = {
  name: "acronymExtractor",
  extract: extractAcronyms
};
