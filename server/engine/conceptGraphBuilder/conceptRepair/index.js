/**
 * server/engine/conceptGraphBuilder/conceptRepair/index.js
 * 
 * PLUGGABLE CONCEPT REPAIR RULE ENGINE
 * Runs registered heuristic rules against candidate concepts and selects the highest confidence repair.
 * 
 * Thresholds:
 * - confidence >= 0.90 -> Auto-accept repair
 * - 0.60 <= confidence < 0.90 -> Accept repair with telemetry warning log
 * - confidence < 0.60 -> Reject repair, retain original candidate
 */

'use strict';

const verbPhraseRule = require('./rules/verbPhraseRule');
const stopWordRule = require('./rules/stopWordRule');
const markdownRule = require('./rules/markdownRule');
const acronymRule = require('./rules/acronymRule');
const ocrNoiseRule = require('./rules/ocrNoiseRule');
const pluralNormalizationRule = require('./rules/pluralNormalizationRule');
const { sanitizeConcept } = require('../utils/conceptSanitizer');

const REPAIR_RULES = [
  acronymRule,
  verbPhraseRule,
  stopWordRule,
  markdownRule,
  ocrNoiseRule,
  pluralNormalizationRule
];

/**
 * Repair a candidate concept using pluggable rule evaluation
 * 
 * @param {string} rawCandidate - The original concept string
 * @returns {{ original: string, repaired: string, confidence: number, strategy: string, accepted: boolean }}
 */
function repairConcept(rawCandidate) {
  if (!rawCandidate || typeof rawCandidate !== 'string') {
    return {
      original: '',
      repaired: '',
      confidence: 1.0,
      strategy: 'empty_input',
      accepted: false
    };
  }

  const original = rawCandidate.trim();
  let bestResult = null;

  // Run candidate through each registered rule
  for (const rule of REPAIR_RULES) {
    try {
      const res = rule.apply(original);
      if (res && res.repaired && res.confidence) {
        if (!bestResult || res.confidence > bestResult.confidence) {
          bestResult = {
            original,
            repaired: res.repaired,
            confidence: res.confidence,
            strategy: res.strategy
          };
        }
      }
    } catch (err) {
      console.warn(`[CONCEPT_REPAIR] Error applying rule ${rule.name}:`, err.message);
    }
  }

  // Fallback to pure sanitizer if no specific rule triggered
  if (!bestResult) {
    const sanitized = sanitizeConcept(original);
    bestResult = {
      original,
      repaired: sanitized,
      confidence: 0.85,
      strategy: 'pure_sanitizer'
    };
  }

  // Final check: sanitize output of best repair
  bestResult.repaired = sanitizeConcept(bestResult.repaired);

  // Evaluate threshold decision
  if (bestResult.confidence >= 0.90) {
    bestResult.accepted = true;
    if (bestResult.original !== bestResult.repaired) {
      console.log(`[CONCEPT_REPAIR] [AUTO_ACCEPT] "${bestResult.original}" -> "${bestResult.repaired}" (Conf: ${bestResult.confidence} | Strategy: ${bestResult.strategy})`);
    }
  } else if (bestResult.confidence >= 0.60) {
    bestResult.accepted = true;
    console.warn(`[CONCEPT_REPAIR] [ACCEPT_LOGGED] "${bestResult.original}" -> "${bestResult.repaired}" (Conf: ${bestResult.confidence} | Strategy: ${bestResult.strategy})`);
  } else {
    bestResult.accepted = false;
    bestResult.repaired = original;
    console.warn(`[CONCEPT_REPAIR] [REJECTED_LOW_CONF] Retaining original "${bestResult.original}" (Conf: ${bestResult.confidence})`);
  }

  return bestResult;
}

module.exports = {
  repairConcept,
  REPAIR_RULES
};
