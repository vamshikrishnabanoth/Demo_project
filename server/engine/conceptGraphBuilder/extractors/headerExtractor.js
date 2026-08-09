/**
 * Header Extractor: Discovers concepts from Markdown and section headers
 */
function extractHeaders(text) {
  const candidates = [];
  if (!text || typeof text !== 'string') return candidates;

  const lines = text.split('\n');
  let charOffset = 0;

  lines.forEach((line) => {
    const lineTrim = line.trim();
    const headerMatch = lineTrim.match(/^#{1,4}\s+(.+)$/) || lineTrim.match(/^([A-Z0-9\s_\-]{3,50}):$/);

    if (headerMatch) {
      const title = headerMatch[1].trim();
      if (title.length > 2 && title.length < 60) {
        const start = charOffset + line.indexOf(title);
        candidates.push({
          rawTerm: title,
          source: "HEADER",
          startOffset: start,
          endOffset: start + title.length
        });
      }
    }
    charOffset += line.length + 1; // +1 for newline
  });

  return candidates;
}

module.exports = {
  name: "headerExtractor",
  extract: extractHeaders
};
