const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');

/**
 * GATE 2: BOUNDED GROUNDING VALIDATOR — HARD GATE
 * Verifies source evidence existence using a 3-step match cascade.
 */
function runGroundingValidation(mcqItem, validationContext = {}) {
  const CODES = validationContext.config?.CODES || VALIDATOR_CONFIG.CODES;
  const THRESHOLDS = validationContext.config?.THRESHOLDS || VALIDATOR_CONFIG.THRESHOLDS;
  const cleanedContent = validationContext.cleanedContent || '';

  const evidenceList = mcqItem?.sourceEvidence;
  if (!Array.isArray(evidenceList) || evidenceList.length === 0 || !evidenceList[0]?.text) {
    return {
      passed: false,
      code: CODES.GROUND_001_MISSING_EVIDENCE.code,
      errorDetail: CODES.GROUND_001_MISSING_EVIDENCE,
      matchType: "NONE"
    };
  }

  const evidenceText = String(evidenceList[0].text).trim();
  if (evidenceText.length < 3) {
    return {
      passed: false,
      code: CODES.GROUND_001_MISSING_EVIDENCE.code,
      errorDetail: CODES.GROUND_001_MISSING_EVIDENCE,
      matchType: "NONE"
    };
  }

  // Step 1: Exact Substring Match
  const exactIndex = cleanedContent.indexOf(evidenceText);
  if (exactIndex !== -1) {
    return {
      passed: true,
      code: "PASS",
      matchType: "Exact Match",
      startOffset: exactIndex,
      endOffset: exactIndex + evidenceText.length
    };
  }

  // Step 2: Normalized Whitespace Match
  const normContent = cleanedContent.replace(/\s+/g, ' ');
  const normEvidence = evidenceText.replace(/\s+/g, ' ');
  const normIndex = normContent.indexOf(normEvidence);
  if (normIndex !== -1) {
    return {
      passed: true,
      code: "PASS",
      matchType: "Bounded Normalized",
      startOffset: normIndex,
      endOffset: normIndex + normEvidence.length
    };
  }

  // Step 3: Bounded Fuzzy Search Window (± GROUNDING_SEARCH_WINDOW_CHARS)
  const windowSize = THRESHOLDS.GROUNDING_SEARCH_WINDOW_CHARS || 2000;
  const targetOffset = evidenceList[0].startOffset || 0;
  const winStart = Math.max(0, targetOffset - Math.floor(windowSize / 2));
  const winEnd = Math.min(cleanedContent.length, targetOffset + Math.floor(windowSize / 2));
  const searchWindow = cleanedContent.slice(winStart, winEnd).replace(/\s+/g, ' ');

  const evTokens = new Set(normEvidence.toLowerCase().split(/\s+/).filter(Boolean));
  const winTokens = new Set(searchWindow.toLowerCase().split(/\s+/).filter(Boolean));
  
  const intersection = new Set([...evTokens].filter(x => winTokens.has(x)));
  const overlapRatio = evTokens.size === 0 ? 0 : intersection.size / evTokens.size;

  if (overlapRatio >= (THRESHOLDS.GROUNDING_FUZZY || 0.85)) {
    return {
      passed: true,
      code: "PASS",
      matchType: "Bounded Fuzzy",
      startOffset: winStart,
      endOffset: winEnd
    };
  }

  // Failed all 3 cascade steps -> Hard Gate Failure
  return {
    passed: false,
    code: CODES.GROUND_001_MISSING_EVIDENCE.code,
    errorDetail: CODES.GROUND_001_MISSING_EVIDENCE,
    matchType: "FAILED_ALL_CASCADE_STEPS"
  };
}

module.exports = {
  runGroundingValidation
};
