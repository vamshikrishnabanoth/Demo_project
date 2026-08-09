const { PROMPT_CONFIG } = require('../../config/promptConfig');

/**
 * 3. SENTENCE & NEWLINE-AWARE CONTEXT EXTRACTION
 * Expands evidence bounds by ±150 chars, snaps to sentence/newline boundaries,
 * and clamps to MAX_TOTAL_CHARS (500 chars).
 */
function extractSnappedContext(cleanedContent, evidenceBounds = []) {
  if (!cleanedContent || typeof cleanedContent !== 'string') {
    return "";
  }

  const { BASE_PADDING_CHARS, MAX_TOTAL_CHARS, BOUNDARY_REGEX } = PROMPT_CONFIG.CONTEXT_WINDOW;

  const targetSpan = (Array.isArray(evidenceBounds) && evidenceBounds.length > 0 && evidenceBounds[0])
    ? evidenceBounds[0]
    : [0, Math.min(50, cleanedContent.length)];

  const startOffset = Math.max(0, targetSpan[0]);
  const endOffset = Math.min(cleanedContent.length, targetSpan[1]);

  // Base Window Expansion (±150 chars)
  let rawStart = Math.max(0, startOffset - BASE_PADDING_CHARS);
  let rawEnd = Math.min(cleanedContent.length, endOffset + BASE_PADDING_CHARS);

  // Boundary Snapping Backward
  const prefixText = cleanedContent.slice(0, rawStart);
  let snappedStart = 0;
  const boundaryMatchBack = prefixText.match(new RegExp(BOUNDARY_REGEX.source + '$'));
  if (boundaryMatchBack) {
    snappedStart = boundaryMatchBack.index + boundaryMatchBack[0].length;
  } else {
    // Find last boundary before rawStart
    const allMatches = [...prefixText.matchAll(new RegExp(BOUNDARY_REGEX.source, 'g'))];
    if (allMatches.length > 0) {
      const lastMatch = allMatches[allMatches.length - 1];
      snappedStart = lastMatch.index + lastMatch[0].length;
    }
  }

  // Boundary Snapping Forward
  const suffixText = cleanedContent.slice(rawEnd);
  let snappedEnd = cleanedContent.length;
  const boundaryMatchForward = suffixText.match(BOUNDARY_REGEX);
  if (boundaryMatchForward) {
    snappedEnd = rawEnd + boundaryMatchForward.index + boundaryMatchForward[0].length;
  }

  let finalSnippet = cleanedContent.slice(snappedStart, snappedEnd).trim();

  // Upper Bound Clamp (Max 500 chars)
  if (finalSnippet.length > MAX_TOTAL_CHARS) {
    const center = Math.floor((startOffset + endOffset) / 2);
    let clampStart = Math.max(0, center - Math.floor(MAX_TOTAL_CHARS / 2));
    let clampEnd = Math.min(cleanedContent.length, center + Math.floor(MAX_TOTAL_CHARS / 2));

    // Align to nearest word boundaries
    while (clampStart > 0 && /\S/.test(cleanedContent[clampStart])) clampStart--;
    while (clampEnd < cleanedContent.length && /\S/.test(cleanedContent[clampEnd])) clampEnd++;

    finalSnippet = cleanedContent.slice(clampStart, clampEnd).trim();
  }

  return finalSnippet;
}

module.exports = {
  extractSnappedContext
};
