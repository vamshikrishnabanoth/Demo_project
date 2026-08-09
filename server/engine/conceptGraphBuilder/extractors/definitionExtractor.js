/**
 * Definition Extractor: Discovers concepts introduced via definition phrases
 * e.g., "X is defined as...", "X refers to...", "X is a mechanism that..."
 */
function extractDefinitions(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  const defRegex = /\b([A-Z][a-zA-Z0-9_\-\s]{2,40})\s+(?:is defined as|refers to|is a mechanism|is a protocol|is an algorithm|is a process)\b/gi;
  let match;

  while ((match = defRegex.exec(text)) !== null) {
    const rawTerm = match[1].trim();
    if (rawTerm.length >= 3) {
      candidates.push({
        rawTerm,
        source: "DEFINITION_PATTERN",
        startOffset: match.index,
        endOffset: match.index + rawTerm.length
      });
    }
  }

  return candidates;
}

module.exports = {
  name: "definitionExtractor",
  extract: extractDefinitions
};
