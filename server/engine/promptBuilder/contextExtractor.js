const { PROMPT_CONFIG } = require('../../config/promptConfig');

// Known technical abbreviations that should NOT trigger sentence boundary splits
const ABBREVIATIONS = ['e.g.', 'i.e.', 'mr.', 'mrs.', 'dr.', 'prof.', 'fig.', 'no.', 'v1.2', 'o(1)', 'o(log n)', 'vs.', 'etc.'];

/**
 * Check if match at index in text is a false sentence boundary due to abbreviation
 */
function isAbbreviationBoundary(text, index) {
  const prefix = text.slice(Math.max(0, index - 10), index + 1).toLowerCase();
  return ABBREVIATIONS.some(abbr => prefix.endsWith(abbr));
}

/**
 * MODULE 3 — ABBREVIATION-AWARE CONTEXT & SENTENCE CHUNKING
 * Expands evidence bounds, snaps to complete sentence/paragraph boundaries,
 * handles technical abbreviations safely, and prevents mid-sentence truncation.
 */
function extractSnappedContext(cleanedContent, evidenceBounds = []) {
  if (!cleanedContent || typeof cleanedContent !== 'string') {
    return "";
  }

  const { BASE_PADDING_CHARS, MAX_TOTAL_CHARS } = PROMPT_CONFIG.CONTEXT_WINDOW;

  const targetSpan = (Array.isArray(evidenceBounds) && evidenceBounds.length > 0 && evidenceBounds[0])
    ? evidenceBounds[0]
    : [0, Math.min(50, cleanedContent.length)];

  const startOffset = Math.max(0, targetSpan[0]);
  const endOffset = Math.min(cleanedContent.length, targetSpan[1]);

  // Base Window Expansion (±200 chars for semantic context)
  const padding = BASE_PADDING_CHARS || 200;
  let rawStart = Math.max(0, startOffset - padding);
  let rawEnd = Math.min(cleanedContent.length, endOffset + padding);

  // Boundary Snapping Backward (Find start of sentence or paragraph)
  let snappedStart = 0;
  for (let i = rawStart; i > 0; i--) {
    if (cleanedContent[i] === '\n' || (/[.!?]/.test(cleanedContent[i]) && /\s/.test(cleanedContent[i + 1] || ''))) {
      if (!isAbbreviationBoundary(cleanedContent, i)) {
        snappedStart = i + 1;
        break;
      }
    }
  }

  // Boundary Snapping Forward (Find end of sentence or paragraph)
  let snappedEnd = cleanedContent.length;
  for (let i = rawEnd; i < cleanedContent.length; i++) {
    if (cleanedContent[i] === '\n' || (/[.!?]/.test(cleanedContent[i]) && (i === cleanedContent.length - 1 || /\s/.test(cleanedContent[i + 1])))) {
      if (!isAbbreviationBoundary(cleanedContent, i)) {
        snappedEnd = i + 1;
        break;
      }
    }
  }

  let finalSnippet = cleanedContent.slice(snappedStart, snappedEnd).trim();

  // If snippet exceeds MAX_TOTAL_CHARS, snap to sentence boundary instead of word chopping
  const maxChars = MAX_TOTAL_CHARS || 750;
  if (finalSnippet.length > maxChars) {
    // Locate the first sentence end before maxChars limit
    let safeEnd = maxChars;
    for (let i = maxChars; i > 100; i--) {
      if (/[.!?]/.test(finalSnippet[i]) && (!finalSnippet[i + 1] || /\s/.test(finalSnippet[i + 1]))) {
        if (!isAbbreviationBoundary(finalSnippet, i)) {
          safeEnd = i + 1;
          break;
        }
      }
    }
    finalSnippet = finalSnippet.slice(0, safeEnd).trim();
  }

  return finalSnippet;
}

module.exports = {
  extractSnappedContext
};
