const { VALIDATOR_CONFIG, ValidationAbortedError } = require('../../config/validatorConfig');

function escapeRegexToken(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchText(sourceText, evidenceText, baseOffset = 0) {
  const exactIndex = sourceText.indexOf(evidenceText);
  if (exactIndex !== -1) {
    const realStart = baseOffset + exactIndex;
    return {
      matched: true,
      matchType: "Exact",
      offsets: [[realStart, realStart + evidenceText.length]]
    };
  }

  if (evidenceText.length <= (VALIDATOR_CONFIG.MAX_REGEX_EVIDENCE_CHARS || 1000)) {
    const tokens = evidenceText.split(/\s+/).map(escapeRegexToken).filter(Boolean);
    if (tokens.length > 0) {
      const flexibleRegexPattern = tokens.join('\\s+');
      const flexibleRegex = new RegExp(flexibleRegexPattern, 'g');

      const match = flexibleRegex.exec(sourceText);
      if (match) {
        const realStart = baseOffset + match.index;
        const realEnd = realStart + match[0].length;
        return {
          matched: true,
          matchType: "Normalized_Realigned",
          offsets: [[realStart, realEnd]]
        };
      }
    }
  }

  return { matched: false };
}

/**
 * GATE 2: SAFE GROUNDING VALIDATOR — HARD GATE
 */
function runGroundingValidation(mcqItem, validationContext = {}, signal) {
  if (signal?.aborted) throw new ValidationAbortedError();

  const cleanedContent = typeof validationContext?.cleanedContent === 'string'
    ? validationContext.cleanedContent
    : "";

  let evidenceText = "";
  if (Array.isArray(mcqItem?.sourceEvidence) && mcqItem.sourceEvidence.length > 0 && mcqItem.sourceEvidence[0]?.text) {
    evidenceText = String(mcqItem.sourceEvidence[0].text).trim();
  } else if (typeof mcqItem?.sourceEvidence?.text === 'string') {
    evidenceText = mcqItem.sourceEvidence.text.trim();
  } else if (typeof mcqItem?.evidence === 'string') {
    evidenceText = mcqItem.evidence.trim();
  }

  if (!evidenceText || !cleanedContent) {
    return {
      passed: false,
      matchType: "None",
      repairedOffsets: null,
      code: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE.code,
      errorDetail: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE
    };
  }

  const baseWindow = VALIDATOR_CONFIG.THRESHOLDS.GROUNDING_SEARCH_WINDOW_CHARS || 2000;
  
  let expectedOffset = null;
  const rawBounds = mcqItem?.sourceEvidence?.evidenceBounds || mcqItem?.sourceEvidence?.[0]?.evidenceBounds;
  if (Array.isArray(rawBounds) && rawBounds.length > 0 && typeof rawBounds[0]?.[0] === 'number') {
    expectedOffset = rawBounds[0][0];
  }

  if (expectedOffset !== null) {
    // Tier 1: Primary Window Search (±2000 chars)
    const pStart = Math.max(0, expectedOffset - baseWindow);
    const pEnd = Math.min(cleanedContent.length, expectedOffset + evidenceText.length + baseWindow);
    const primarySlice = cleanedContent.substring(pStart, pEnd);

    const primaryResult = searchText(primarySlice, evidenceText, pStart);
    if (primaryResult.matched) {
      return {
        passed: true,
        matchType: `PrimaryWindow_${primaryResult.matchType}`,
        repairedOffsets: primaryResult.offsets,
        code: VALIDATOR_CONFIG.PASS_CODES.GROUNDING
      };
    }

    // Tier 2: Expanded Window Search (±4000 chars)
    const eStart = Math.max(0, expectedOffset - (baseWindow * 2));
    const eEnd = Math.min(cleanedContent.length, expectedOffset + evidenceText.length + (baseWindow * 2));
    const expandedSlice = cleanedContent.substring(eStart, eEnd);

    const expandedResult = searchText(expandedSlice, evidenceText, eStart);
    if (expandedResult.matched) {
      return {
        passed: true,
        matchType: `ExpandedWindow_${expandedResult.matchType}`,
        repairedOffsets: expandedResult.offsets,
        code: VALIDATOR_CONFIG.PASS_CODES.GROUNDING
      };
    }
  }

  // Tier 3: Global Document Fallback
  const globalResult = searchText(cleanedContent, evidenceText, 0);
  if (globalResult.matched) {
    return {
      passed: true,
      matchType: `Global_${globalResult.matchType}`,
      repairedOffsets: globalResult.offsets,
      code: VALIDATOR_CONFIG.PASS_CODES.GROUNDING
    };
  }

  return {
    passed: false,
    matchType: "None",
    repairedOffsets: null,
    code: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE.code,
    errorDetail: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE
  };
}

module.exports = {
  runGroundingValidation
};
