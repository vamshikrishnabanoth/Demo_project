const { CONCEPT_CONFIG } = require('../../config/conceptConfig');

/**
 * Snippet Extractor: Extracts verbatim 150-250 char source text snippet
 */
function extractSummaryContext(fullText, startOffset, endOffset) {
  if (!fullText || typeof fullText !== 'string') return "";

  const radius = CONCEPT_CONFIG.PERFORMANCE.SNIPPET_RADIUS_CHARS || 120;
  const start = Math.max(0, startOffset - radius);
  const end = Math.min(fullText.length, endOffset + radius);

  let snippet = fullText.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < fullText.length) snippet = snippet + "...";

  return snippet;
}

module.exports = {
  extractSummaryContext
};
