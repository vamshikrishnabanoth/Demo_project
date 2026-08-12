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
 * GATE 2: SAFE GROUNDING VALIDATOR — HARD GATE (MODULE 7 TELEMETRY FIX)
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

  const missingCode = VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE?.code || "GROUND_001";
  const passCode = VALIDATOR_CONFIG.PASS_CODES?.GROUNDING || "GROUND_PASS";

  if (!evidenceText || !cleanedContent) {
    return {
      passed: false,
      matchType: "None",
      repairedOffsets: null,
      code: missingCode,
      errorDetail: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE,
      telemetry: {
        stage: "GROUNDING",
        validator: "GroundingValidator",
        code: missingCode,
        severity: "CRITICAL",
        status: "FAIL",
        confidence: 0.0,
        duration_ms: 0
      }
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
      const matchType = `PrimaryWindow_${primaryResult.matchType}`;
      return {
        passed: true,
        matchType,
        repairedOffsets: primaryResult.offsets,
        code: passCode,
        telemetry: {
          stage: "GROUNDING",
          validator: "GroundingValidator",
          code: passCode,
          severity: "INFO",
          status: "PASS",
          confidence: 1.0,
          duration_ms: 0
        }
      };
    }

    // Tier 2: Expanded Window Search (±4000 chars)
    const eStart = Math.max(0, expectedOffset - (baseWindow * 2));
    const eEnd = Math.min(cleanedContent.length, expectedOffset + evidenceText.length + (baseWindow * 2));
    const expandedSlice = cleanedContent.substring(eStart, eEnd);

    const expandedResult = searchText(expandedSlice, evidenceText, eStart);
    if (expandedResult.matched) {
      const matchType = `ExpandedWindow_${expandedResult.matchType}`;
      return {
        passed: true,
        matchType,
        repairedOffsets: expandedResult.offsets,
        code: passCode,
        telemetry: {
          stage: "GROUNDING",
          validator: "GroundingValidator",
          code: passCode,
          severity: "INFO",
          status: "PASS",
          confidence: 0.9,
          duration_ms: 0
        }
      };
    }
  }

  // Tier 3: Global Document Fallback
  const globalResult = searchText(cleanedContent, evidenceText, 0);
  if (globalResult.matched) {
    const matchType = `Global_${globalResult.matchType}`;
    return {
      passed: true,
      matchType,
      repairedOffsets: globalResult.offsets,
      code: passCode,
      telemetry: {
        stage: "GROUNDING",
        validator: "GroundingValidator",
        code: passCode,
        severity: "INFO",
        status: "PASS",
        confidence: 0.8,
        duration_ms: 0
      }
    };
  }

  return {
    passed: false,
    matchType: "None",
    repairedOffsets: null,
    code: missingCode,
    errorDetail: VALIDATOR_CONFIG.CODES.GROUND_001_MISSING_EVIDENCE,
    telemetry: {
      stage: "GROUNDING",
      validator: "GroundingValidator",
      code: missingCode,
      severity: "CRITICAL",
      status: "FAIL",
      confidence: 0.0,
      duration_ms: 0
    }
  };
}

module.exports = {
  runGroundingValidation
};
