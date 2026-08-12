const { VALIDATOR_CONFIG, ValidationAbortedError } = require('../../config/validatorConfig');

function safeScore(val) {
  const num = Number(val);
  const clamped = Number.isFinite(num) ? Math.max(0.0, Math.min(1.0, num)) : 0.0;
  return Number(clamped.toFixed(2));
}

function computeJaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const setA = new Set(String(str1).toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(String(str2).toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function levenshteinDistanceRatio(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = String(s1).toLowerCase();
  const b = String(s2).toLowerCase();
  const costs = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : costs[b.length] / maxLen;
}

/**
 * EVALUATOR 3: SAFE EDUCATIONAL VALIDATOR
 */
async function runEducationalValidation(mcqItem, validationContext = {}, signal) {
  if (signal?.aborted) throw new ValidationAbortedError();

  const services = validationContext.services || {};
  const stem = String(mcqItem?.stem || mcqItem?.question || mcqItem?.questionText || '').trim();
  const options = mcqItem?.options || [];
  const targetBloom = mcqItem?.targetBloom || validationContext.plannerHints?.targetBloom || 'UNDERSTAND';

  const scores = { bloom: 1.0, distractors: 1.0, duplication: 1.0, ambiguity: 1.0 };
  const rawRepairHints = [];
  const findings = { criticalFailures: [], majorWarnings: [], minorWarnings: [] };

  // 1. Safe Asynchronous Duplication Check
  let nearDupes = [];
  if (typeof validationContext.acceptedIndex?.findNearDuplicates === 'function') {
    nearDupes = await validationContext.acceptedIndex.findNearDuplicates(
      stem,
      validationContext.config?.THRESHOLDS?.JACCARD_BORDERLINE_MIN ?? VALIDATOR_CONFIG.THRESHOLDS.JACCARD_BORDERLINE_MIN
    );
  } else if (validationContext.acceptedQuestionIndex instanceof Map) {
    for (const [acceptedStem] of validationContext.acceptedQuestionIndex.entries()) {
      const sim = computeJaccardSimilarity(stem, acceptedStem);
      if (sim >= (VALIDATOR_CONFIG.THRESHOLDS.JACCARD_BORDERLINE_MIN || 0.40)) {
        nearDupes.push({ stem: acceptedStem, similarity: sim });
      }
    }
    nearDupes.sort((a, b) => b.similarity - a.similarity);
  }

  if (signal?.aborted) throw new ValidationAbortedError();

  if (nearDupes.length > 0) {
    scores.duplication = safeScore(1.0 - nearDupes[0].similarity);
    if (scores.duplication < 0.30) {
      rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REWRITE_DUPLICATE_STEM);
      const codeStr = VALIDATOR_CONFIG.CODES.EDU_001_SEMANTIC_DUPLICATE?.code || "EDU_001";
      findings.majorWarnings.push(codeStr);
    }
  }

  // 2. Type-Guarded Bloom Alignment Service
  const bloomService = (typeof services.bloomMatcher === 'function')
    ? services.bloomMatcher
    : async (stemText, target) => {
        const framing = mcqItem?.expectedFraming || mcqItem?.framingType || 'Direct Recall';
        if (target === 'ANALYZE' && framing === 'Direct Recall') return false;
        return true;
      };

  const bloomPassed = await bloomService(stem, targetBloom);
  if (signal?.aborted) throw new ValidationAbortedError();

  if (targetBloom && !bloomPassed) {
    scores.bloom = 0.60;
    rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.IMPROVE_BLOOM_ALIGNMENT);
    const codeStr = VALIDATOR_CONFIG.CODES.EDU_002_BLOOM_MISALIGNMENT?.code || "EDU_002";
    findings.minorWarnings.push(codeStr);
  }

  // 3. Type-Guarded Distractor Plausibility Service
  const distractorService = (typeof services.distractorAnalyzer === 'function')
    ? services.distractorAnalyzer
    : async (optsList, graph) => {
        const extracted = validationContext.extractedConcepts || [];
        if (extracted.length === 0) return 0.85;
        const distractors = optsList.filter(o => String(o).trim() !== String(mcqItem.correctAnswer).trim());
        const domainText = extracted.join(' ').toLowerCase();
        const implausible = distractors.filter(d => {
          const dWords = String(d).toLowerCase().split(/\s+/);
          return !dWords.some(w => domainText.includes(w) || w.length < 3);
        }).length;
        return implausible > 2 ? 0.60 : 0.85;
      };

  const rawDistractor = await distractorService(options, validationContext.conceptGraph);
  if (signal?.aborted) throw new ValidationAbortedError();

  scores.distractors = safeScore(rawDistractor);
  if (scores.distractors < (VALIDATOR_CONFIG.THRESHOLDS.DISTRACTOR_MIN_SCORE || 0.70)) {
    rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REGENERATE_DISTRACTORS);
    const codeStr = VALIDATOR_CONFIG.CODES.EDU_003_IMPLAUSIBLE_DISTRACTOR?.code || "EDU_003";
    findings.majorWarnings.push(codeStr);
  }

  // 4. Type-Guarded Option Ambiguity / Typo Service
  const ambiguityService = (typeof services.ambiguityAnalyzer === 'function')
    ? services.ambiguityAnalyzer
    : async (optsList) => {
        let minRatio = 1.0;
        for (let i = 0; i < optsList.length; i++) {
          for (let j = i + 1; j < optsList.length; j++) {
            const ratio = levenshteinDistanceRatio(optsList[i], optsList[j]);
            if (ratio > 0 && ratio < minRatio) minRatio = ratio;
          }
        }
        return minRatio;
      };

  const rawAmbiguity = await ambiguityService(options);
  if (signal?.aborted) throw new ValidationAbortedError();

  const minLevenshtein = safeScore(rawAmbiguity);
  if (minLevenshtein < (VALIDATOR_CONFIG.THRESHOLDS.AMBIGUITY_LEVENSHTEIN_MIN || 0.15)) {
    scores.ambiguity = 0.50;
    rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REDUCE_OPTION_AMBIGUITY);
    const codeStr = VALIDATOR_CONFIG.CODES.EDU_004_OPTION_AMBIGUITY_TYPO?.code || "EDU_004";
    findings.majorWarnings.push(codeStr);
  }

  // 5. Meta-Reference Filter (Meta-Label / Structural Referencing Detection)
  const META_REF_REGEX = /\b(scenario\s*\d+|paragraph\s*\d+|section\s*\d+|exercise\s*\d+|task\s*\d+|assignment\s*\d+|in\s+(this|the)\s+(document|pdf|docx|file|assignment|section|text))\b/i;
  const isMetaRef = META_REF_REGEX.test(stem);
  if (isMetaRef) {
    scores.metaReference = 0.0;
    rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REWRITE_SELF_CONTAINED_QUESTION || "REWRITE_SELF_CONTAINED_QUESTION");
    const codeStr = VALIDATOR_CONFIG.CODES.EDU_005_META_REFERENCE?.code || "EDU_005";
    findings.majorWarnings.push(codeStr);
  }

  // 6. Boilerplate Distractor Filter (EDU_006_BOILERPLATE_LEAK)
  const BOILERPLATE_PATTERNS = [
    /core mechanism governing/i,
    /secondary protocol configuration/i,
    /legacy database schema/i,
    /unrelated background process/i
  ];
  const hasBoilerplateLeak = options.some(opt => 
    BOILERPLATE_PATTERNS.some(pat => pat.test(String(opt)))
  );
  if (hasBoilerplateLeak) {
    scores.distractors = 0.20;
    rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REWRITE_DOMAIN_SPECIFIC_DISTRACTORS || "REWRITE_DOMAIN_SPECIFIC_DISTRACTORS");
    const codeStr = VALIDATOR_CONFIG.CODES.EDU_006_BOILERPLATE_LEAK?.code || "EDU_006";
    findings.criticalFailures.push(codeStr);
  }

  // 7. Stem Monotony Guard (EDU_007_STEM_MONOTONY)
  const LEADIN_PHRASE_REGEX = /^(which of the following best describes|which of the following|what is the primary|what is the key|how does the)/i;
  const currentLeadInMatch = stem.match(LEADIN_PHRASE_REGEX);
  if (currentLeadInMatch && Array.isArray(validationContext.acceptedStems)) {
    const leadInStr = currentLeadInMatch[0].toLowerCase();
    const matchingCount = validationContext.acceptedStems.filter(prevStem => 
      String(prevStem).toLowerCase().startsWith(leadInStr)
    ).length;
    if (matchingCount >= 2) {
      scores.duplication = 0.30;
      rawRepairHints.push(VALIDATOR_CONFIG.REPAIR_HINTS.REWRITE_ROTATED_FRAMING || "REWRITE_ROTATED_FRAMING");
      const codeStr = VALIDATOR_CONFIG.CODES.EDU_007_STEM_MONOTONY?.code || "EDU_007";
      findings.majorWarnings.push(codeStr);
    }
  }

  const w = VALIDATOR_CONFIG.QUALITY_WEIGHTS;
  let rawQuality = (
    w.BLOOM * scores.bloom +
    w.DISTRACTORS * scores.distractors +
    w.DUPLICATION * scores.duplication +
    w.AMBIGUITY * scores.ambiguity
  );

  // Severe Quality Penalty for Meta-Reference or Boilerplate Violations
  if (isMetaRef || hasBoilerplateLeak) {
    rawQuality = Math.min(rawQuality, 0.20);
  }

  const qualityScore = safeScore(rawQuality);
  const repairHints = [...new Set(rawRepairHints)];
  const minRequired = validationContext.config?.THRESHOLDS?.MIN_QUALITY_SCORE ?? VALIDATOR_CONFIG.THRESHOLDS.MIN_QUALITY_SCORE;

  return {
    passed: qualityScore >= minRequired,
    scores,
    qualityScore,
    qualityBreakdown: {
      structural: 1.0,
      grounding: 1.0,
      educational: qualityScore
    },
    repairHints,
    findings,
    // Standardized Telemetry Schema (MODULE 6 & MODULE 10)
    telemetry: {
      stage: "EDUCATIONAL",
      validator: "EducationalValidator",
      code: qualityScore >= minRequired ? "EDU_PASS" : "EDU_WARN",
      severity: qualityScore >= minRequired ? "INFO" : "WARNING",
      status: qualityScore >= minRequired ? "PASS" : "FAIL",
      confidence: qualityScore,
      duration_ms: 0
    }
  };
}

module.exports = {
  runEducationalValidation
};
