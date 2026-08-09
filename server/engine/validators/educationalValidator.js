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
      findings.majorWarnings.push(VALIDATOR_CONFIG.CODES.EDU_001_SEMANTIC_DUPLICATE);
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
    findings.minorWarnings.push(VALIDATOR_CONFIG.CODES.EDU_002_BLOOM_MISALIGNMENT);
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
    findings.majorWarnings.push(VALIDATOR_CONFIG.CODES.EDU_003_IMPLAUSIBLE_DISTRACTOR);
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
    findings.majorWarnings.push(VALIDATOR_CONFIG.CODES.EDU_004_OPTION_AMBIGUITY_TYPO);
  }

  const w = VALIDATOR_CONFIG.QUALITY_WEIGHTS;
  const rawQuality = (
    w.BLOOM * scores.bloom +
    w.DISTRACTORS * scores.distractors +
    w.DUPLICATION * scores.duplication +
    w.AMBIGUITY * scores.ambiguity
  );

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
    findings
  };
}

module.exports = {
  runEducationalValidation
};
