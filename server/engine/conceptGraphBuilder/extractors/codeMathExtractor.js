/**
 * Code & Math Extractor: Discovers code tokens, backtick identifiers, and mathematical terms
 */
function extractCodeMath(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  const codeRegex = /`([^`]+)`/g;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const rawTerm = match[1].trim();
    if (rawTerm.length >= 2 && rawTerm.length <= 40) {
      candidates.push({
        rawTerm,
        source: "CODE_OR_MATH",
        startOffset: match.index + 1,
        endOffset: match.index + 1 + rawTerm.length,
        hasCodeOrMath: true
      });
    }
  }

  return candidates;
}

module.exports = {
  name: "codeMathExtractor",
  extract: extractCodeMath
};
