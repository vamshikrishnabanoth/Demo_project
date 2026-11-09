/**
 * server/engine/intelligence/disfluencySanitizer.js
 *
 * Lightweight, zero-dependency transcript disfluency sanitizer and validator.
 * Enforces Objective 1: Grounding and Correctness without corrupting technical meaning.
 *
 * Mandatory Safeguards:
 * 1. Never collapses arbitrary repeated words: only bounded non-technical spoken function words.
 *    Legitimate repetitions like "log log n", "that that condition", "node node" remain strictly intact.
 * 2. Never rewrites phrases into guessed technical terminology (no synthetic guessing).
 * 3. Never mutates already-verified questions post-IAV. All sanitization occurs upstream before validation.
 * 4. Never invents replacement concept labels. Disfluent candidates are rejected cleanly.
 * 5. Deterministic validation fails closed on contaminated questions, triggering the existing retry path.
 */

'use strict';

// Strict bounded list of non-technical spoken function words subject to speech stutter collapsing.
// Technical nouns, verbs, mathematical operators, and identifiers are strictly excluded.
const SPOKEN_FUNCTION_STUTTERS = new Set([
  'the', 'is', 'a', 'an', 'in', 'to', 'of', 'and', 'or', 'we', 'you', 'it', 'at', 'on', 'for', 'with', 'by'
]);

// Conversational filler phrases that serve zero instructional purpose.
const CONVERSATIONAL_FILLERS = [
  /\b(?:um|uh|er|ah|umm|uhh)\b/gi,
  /\b(?:you know|sort of|kind of|i mean|you see)\b/gi,
  /\b(?:or whatever|and stuff like that|something like that)\b/gi
];

// Preambles that reflect lecture delivery chatter rather than curricular facts.
const CONVERSATIONAL_PREAMBLES = [
  /^(?:like I said earlier|as we discussed earlier|now coming to|coming back to|in our previous discussion|let's see)[,\s]+/i,
  /^(?:basically|actually|literally)[,\s]+/i
];

// Patterns for concept entity names that indicate conversational disfluency / ASR fragments.
const INVALID_CONCEPT_PREFIXES = [
  /^(?:whatever|something\s+else|anything\s+else|some\s+other)\b/i,
  /^(?:automatically|eventually|specifically|basically|actually|literally|obviously|clearly|definitely|certainly|surely|frankly|honestly|essentially)\b/i,
  /^(?:create\s+making|play\s+redo|play\s+as|once\s+this|getting\s+the|use\s+the|ll\s+play|we\s+will|you\s+will|i\s+will)\b/i,
  /^(?:after\s+writing|put\s+the\s+dot|just\s+like|kind\s+of|sort\s+of)\b/i,
  /^(?:ll|ve|re|d|s|m|t)\b/i
];

// Relational connectors and dangling prepositions/adverbs that cannot start or end an academic concept entity.
const DANGLING_CONCEPT_TERMINATORS = new Set([
  'the', 'is', 'a', 'an', 'in', 'to', 'of', 'and', 'or', 'we', 'you', 'it', 'at', 'on', 'for', 'with', 'by',
  'equal', 'equals', 'called', 'named', 'known', 'like', 'as', 'than', 'from', 'into'
]);

class DisfluencySanitizer {
  /**
   * Evaluates whether an extracted concept phrase is a valid instructional concept entity
   * or a spoken speech disfluency / conversational fragment.
   * Fails closed: returns false for disfluencies without inventing replacement text.
   */
  isValidConceptPhrase(phrase) {
    if (!phrase || typeof phrase !== 'string') return false;
    const trimmed = phrase.trim();
    if (trimmed.length < 3) return false;

    // Check against conversational / disfluent prefixes
    for (const pat of INVALID_CONCEPT_PREFIXES) {
      if (pat.test(trimmed)) return false;
    }

    // Check for spoken function word stutter in concept name (e.g. "Create Making")
    const words = trimmed.toLowerCase().split(/\s+/);
    if (words.length >= 2 && words[0] === words[1] && SPOKEN_FUNCTION_STUTTERS.has(words[0])) {
      return false;
    }

    // Reject phrases that begin or end with dangling connectors, function words, or relational predicates
    if (DANGLING_CONCEPT_TERMINATORS.has(words[0]) || DANGLING_CONCEPT_TERMINATORS.has(words[words.length - 1])) {
      return false;
    }

    return true;
  }

  /**
   * Cleans spoken conversational fillers, hesitations, and function-word stutters from text.
   * Strictly preserves technical tokens, variable identifiers, Big-O notation, and math formulas.
   */
  cleanSpokenFiller(text) {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;

    // 1. Remove spoken preambles at start of text
    for (const pat of CONVERSATIONAL_PREAMBLES) {
      cleaned = cleaned.replace(pat, '');
    }

    // 2. Remove isolated hesitation markers and fillers
    for (const pat of CONVERSATIONAL_FILLERS) {
      cleaned = cleaned.replace(pat, '');
    }

    // 3. Conservative function-word stutter removal:
    // Only collapses words in SPOKEN_FUNCTION_STUTTERS (e.g. "the the" -> "the", "in in" -> "in").
    // Legitimate repetitions like "log log n", "that that", "node node" are strictly preserved.
    cleaned = cleaned.replace(/\b([a-zA-Z]{1,4})\s+\1\b/gi, (match, word) => {
      const lower = word.toLowerCase();
      if (SPOKEN_FUNCTION_STUTTERS.has(lower)) {
        return word; // Keep single instance
      }
      return match; // Preserve legitimate technical repetition
    });

    // 4. Normalize residual punctuation artifacts and whitespace from stripped fillers/preambles
    const hadInitialCap = /^[A-Z]/.test(text.trim());
    cleaned = cleaned
      .replace(/,\s*,/g, ',')
      .replace(/^[,;\s]+/, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.\?!;])/g, '$1')
      .trim();

    // Restore leading sentence capitalization only if original string was capitalized
    // and the result is not a code identifier / attribute access (e.g. self.fc)
    if (hadInitialCap && cleaned.length > 0 && /^[a-z]/.test(cleaned) && !/^[a-z_][a-zA-Z0-9_]*[\.\[\(]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Audits MCQ stem and options for conversational disfluency contamination.
   * Returns { hasViolation: boolean, reason: string | null }.
   * Used by DeterministicValidator to reject contaminated questions and trigger re-generation.
   */
  detectDisfluencyViolation(stem = '', options = []) {
    const textToCheck = [stem, ...(Array.isArray(options) ? options : [])].join(' ');

    // 1. Check for unmistakable spoken hesitations
    const hesitationMatch = textToCheck.match(/\b(?:um|uh|umm|uhh)\b/i);
    if (hesitationMatch) {
      return {
        hasViolation: true,
        reason: `Contaminated with spoken hesitation marker "${hesitationMatch[0]}"`
      };
    }

    // 2. Check for spoken function word stutters (e.g. "the the", "is is")
    const stutterMatch = textToCheck.match(/\b(the|is|a|an|in|to|of|and|or|we|you|it|at|on|for|with|by)\s+\1\b/i);
    if (stutterMatch) {
      return {
        hasViolation: true,
        reason: `Contaminated with consecutive word stutter "${stutterMatch[0]}"`
      };
    }

    // 3. Check for colloquial trailing filler
    const trailingMatch = textToCheck.match(/\b(?:or whatever|and stuff like that)\b/i);
    if (trailingMatch) {
      return {
        hasViolation: true,
        reason: `Contaminated with conversational filler "${trailingMatch[0]}"`
      };
    }

    // 4. Check for spoken transcript idioms
    const idiomMatch = textToCheck.match(/\b(?:after writing to put the dot in it)\b/i);
    if (idiomMatch) {
      return {
        hasViolation: true,
        reason: `Contaminated with verbatim spoken transcript idiom "${idiomMatch[0]}"`
      };
    }

    return { hasViolation: false, reason: null };
  }
}

module.exports = new DisfluencySanitizer();
