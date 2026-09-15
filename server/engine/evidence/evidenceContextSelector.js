/**
 * server/engine/evidence/evidenceContextSelector.js
 *
 * Deterministically selects the relevant evidence span for a specific target.
 * Guarantees that Agent 2 and Agent 3 receive the exact sentence/chunk needed
 * to formulate and ground the question without bloating the prompt token count.
 */

'use strict';

function getTargetEvidenceContext(target = {}, rawContent = '', maxContextChars = 3000) {
  const content = rawContent || '';
  if (content.length === 0) {
    return target.supportingEvidence || target.concept || 'No content provided.';
  }

  const supporting = (target.supportingEvidence || target.evidenceSpan || '').trim();
  const concept = (target.concept || '').trim();

  let matchIndex = -1;

  // 1. Try exact match of supporting evidence
  if (supporting.length > 5) {
    matchIndex = content.indexOf(supporting);
    if (matchIndex === -1) {
      const sub = supporting.substring(0, Math.min(40, supporting.length)).toLowerCase();
      matchIndex = content.toLowerCase().indexOf(sub);
    }
  }

  // 2. Try concept terms if supporting evidence was not matched directly
  if (matchIndex === -1 && concept.length > 3) {
    const terms = concept.split(/\s+/).filter(w => w.length > 4);
    for (const term of terms) {
      const idx = content.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        matchIndex = idx;
        break;
      }
    }
  }

  // 3. Extract surrounding window
  let windowText = '';
  if (matchIndex !== -1) {
    const halfWindow = Math.floor(maxContextChars / 2);
    const start = Math.max(0, matchIndex - halfWindow);
    const end = Math.min(content.length, matchIndex + halfWindow);
    windowText = content.substring(start, end);
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
