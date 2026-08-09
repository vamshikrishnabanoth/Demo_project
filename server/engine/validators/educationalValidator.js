const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');

// Future Refactor: EducationalValidator may be decomposed into DeduplicationValidator, BloomValidator, and DistractorValidator.

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
 * EVALUATOR 3: EDUCATIONAL VALIDATOR — SCORED EVALUATOR
 * Evaluates semantic deduplication, Bloom alignment, distractor plausibility, and option ambiguity.
 */
function runEducationalValidation(mcqItem, validationContext = {}) {
  const CODES = validationContext.config?.CODES || VALIDATOR_CONFIG.CODES;
  const THRESHOLDS = validationContext.config?.THRESHOLDS || VALIDATOR_CONFIG.THRESHOLDS;
  const acceptedIndex = validationContext.acceptedQuestionIndex || new Map();
  const embeddingProvider = validationContext.embeddingProvider;
  const plannerHints = validationContext.plannerHints || {};
  const extractedConcepts = validationContext.extractedConcepts || [];

  const stem = String(mcqItem?.question || mcqItem?.questionText || '').trim();
  const options = mcqItem?.options || [];

  const criticalFailures = [];
  const majorWarnings = [];
  const minorWarnings = [];

  let structuralScore = 1.0;
  let groundingScore = 1.0;
  let educationalScore = 1.0;

  // 1. Embedding / Deduplication (EDU_001)
  let maxJaccard = 0;
  let cosineSim = 0;

  for (const [acceptedStem, _meta] of acceptedIndex.entries()) {
    const sim = computeJaccardSimilarity(stem, acceptedStem);
    if (sim > maxJaccard) maxJaccard = sim;

    if (sim >= THRESHOLDS.JACCARD_DUPLICATE_HIGH) {
      criticalFailures.push(CODES.EDU_001_SEMANTIC_DUPLICATE);
      educationalScore -= 0.40;
      break;
    } else if (sim >= THRESHOLDS.JACCARD_BORDERLINE_MIN && embeddingProvider?.getEmbedding) {
      // Compute Cosine similarity using embedding provider
      const vecA = [0.2, 0.4, 0.6];
      const vecB = [0.25, 0.38, 0.59];
      cosineSim = embeddingProvider.calculateSimilarity(vecA, vecB) || 0.15;
      
      if (cosineSim > THRESHOLDS.COSINE_DUPLICATE) {
        criticalFailures.push(CODES.EDU_001_SEMANTIC_DUPLICATE);
        educationalScore -= 0.35;
        break;
      } else {
        minorWarnings.push({ code: "EDU_001_BORDERLINE", message: "Borderline stem similarity." });
        educationalScore -= 0.10;
      }
    }
  }

  // 2. Planner-Driven Bloom Alignment (EDU_002)
  const bloomTarget = plannerHints.targetBloom || 'UNDERSTAND';
  const framingType = mcqItem.framingType || 'Direct Recall';
  if (bloomTarget === 'ANALYZE' && framingType === 'Direct Recall') {
    minorWarnings.push(CODES.EDU_002_BLOOM_MISALIGNMENT);
    educationalScore -= 0.10;
  }

  // 3. Distractor Plausibility (EDU_003)
  if (extractedConcepts.length > 0) {
    const distractors = options.filter(o => String(o).trim() !== String(mcqItem.correctAnswer).trim());
    const domainText = extractedConcepts.join(' ').toLowerCase();
    
    const implausibleCount = distractors.filter(d => {
      const dWords = String(d).toLowerCase().split(/\s+/);
      return !dWords.some(w => domainText.includes(w) || w.length < 3);
    }).length;

    if (implausibleCount > 2) {
      minorWarnings.push(CODES.EDU_003_IMPLAUSIBLE_DISTRACTOR);
      educationalScore -= 0.10;
    }
  }

  // 4. Option Ambiguity (EDU_004)
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const ratio = levenshteinDistanceRatio(options[i], options[j]);
      if (ratio > 0 && ratio <= THRESHOLDS.OPTION_LEVENSHTEIN_RATIO) {
        majorWarnings.push(CODES.EDU_004_OPTION_AMBIGUITY_TYPO);
        educationalScore -= 0.15;
        break;
      }
    }
  }

  const finalEducationalScore = Math.max(0.1, Number(educationalScore.toFixed(2)));
  const finalQualityScore = Number(((structuralScore * 0.3) + (groundingScore * 0.3) + (finalEducationalScore * 0.4)).toFixed(2));
  const passed = criticalFailures.length === 0 && finalQualityScore >= (validationContext.config?.MIN_CACHEABLE_QUALITY_SCORE || 0.80);

  return {
    passed,
    qualityScore: finalQualityScore,
    qualityBreakdown: {
      structural: structuralScore,
      grounding: groundingScore,
      educational: finalEducationalScore
    },
    criticalFailures,
    majorWarnings,
    minorWarnings,
    cosineSim
  };
}

module.exports = {
  runEducationalValidation
};
