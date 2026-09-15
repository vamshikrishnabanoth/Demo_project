/**
 * server/engine/evidence/evidenceContextSelector.js
 *
 * Deterministically selects the relevant evidence span for a specific target.
 * Instead of blindly falling back to the first 3000 characters, it uses
 * multi-term semantic block scoring across the entire transcript to find
 * the actual region where the target concept was taught.
 */

'use strict';

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

function getTargetEvidenceContext(target = {}, rawContent = '', maxContextChars = 3500) {
  const content = rawContent || '';
  if (content.length === 0) {
    return target.supportingEvidence || target.concept || 'No content provided.';
  }

  // If content is already shorter than window, return it entirely
  if (content.length <= maxContextChars) {
    const parts = [];
    if (target.supportingEvidence) {
      parts.push('[DIRECT TARGET EVIDENCE]\n' + target.supportingEvidence.trim());
    }
    parts.push('[RELEVANT SESSION CONTEXT]\n' + content.trim());
    return parts.join('\n\n');
  }

  const supporting = (target.supportingEvidence || target.evidenceSpan || '').trim();
  const concept = (target.concept || '').trim();
  const subtopic = (target.subtopic || '').trim();
  const instruction = (target.instruction || '').trim();

  let matchIndex = -1;

  // 1. Direct Substring Search for Supporting Evidence
  if (supporting.length > 8) {
    matchIndex = content.indexOf(supporting);
    if (matchIndex === -1) {
      const sub = supporting.substring(0, Math.min(50, supporting.length)).toLowerCase();
      matchIndex = content.toLowerCase().indexOf(sub);
    }
  }

  // 2. Semantic Block Scoring across the entire transcript
  // If direct match failed, scan sliding blocks across the full lecture
  if (matchIndex === -1) {
    const queryTokens = new Set([
      ...tokenize(concept),
      ...tokenize(subtopic),
      ...tokenize(supporting),
      ...tokenize(instruction)
    ]);

    if (queryTokens.size > 0) {
      const blockSize = 600;
      const step = 300;
      let bestScore = -1;
      let bestPos = 0;

      for (let pos = 0; pos < content.length; pos += step) {
        const block = content.substring(pos, pos + blockSize).toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          const occurrences = (block.match(new RegExp('\\b' + token + '\\b', 'g')) || []).length;
          score += occurrences;
        }
        if (score > bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      }

      if (bestScore > 0) {
        matchIndex = bestPos;
      }
    }
  }

  // 3. Extract surrounding window around matchIndex
  let windowText = '';
  if (matchIndex !== -1) {
    const halfWindow = Math.floor(maxContextChars / 2);
    const start = Math.max(0, matchIndex - halfWindow);
    const end = Math.min(content.length, start + maxContextChars);
    const adjustedStart = Math.max(0, end - maxContextChars);
    windowText = content.substring(adjustedStart, end);
  } else {
    windowText = content.substring(0, maxContextChars);
  }

  const parts = [];
  if (supporting) {
    parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
  }
  parts.push('[RELEVANT SESSION CONTEXT]\n' + windowText.trim());

  return parts.join('\n\n');
}

module.exports = {
  getTargetEvidenceContext
};
