/**
 * server/engine/utils/jsonParser.js
 *
 * Robust JSON Extractor & Sanitizer for LLM outputs.
 * Solves:
 * - Markdown commentary before/after JSON (e.g. * **Definition:** ... { ... })
 * - Markdown fences (```json ... ```)
 * - Trailing commas before closing braces/brackets
 * - Raw unescaped newlines/tabs within JSON string literals
 * - Unbalanced or prefixed tokens
 */

'use strict';

/**
 * Safely parse JSON from arbitrary LLM response text.
 * @param {string} rawText - Raw LLM output string
 * @param {object|null} fallback - Optional fallback value if parsing completely fails
 * @returns {object|Array} Parsed JSON object or array
 * @throws {SyntaxError} If parsing fails and no fallback is provided
 */
function safeParseJson(rawText, fallback = undefined) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    if (fallback !== undefined) return fallback;
    throw new SyntaxError('safeParseJson: Input text is empty or not a string.');
  }

  let text = rawText.trim();

  // 1. Direct parse attempt if already pure JSON
  try {
    return JSON.parse(text);
  } catch (_) {
    // Continue to extraction & repair passes
  }

  // 2. Remove markdown code fences
  text = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // 3. Find boundaries of first '{' and last '}' (or '[' and ']')
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  let jsonCandidate = '';

  // Determine whether root is object or array based on first appearance
  const hasBrace = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const hasBracket = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

  if (hasBrace && hasBracket) {
    if (firstBrace < firstBracket) {
      jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    } else {
      jsonCandidate = text.substring(firstBracket, lastBracket + 1);
    }
  } else if (hasBrace) {
    jsonCandidate = text.substring(firstBrace, lastBrace + 1);
  } else if (hasBracket) {
    jsonCandidate = text.substring(firstBracket, lastBracket + 1);
  } else {
    if (fallback !== undefined) return fallback;
    throw new SyntaxError(`safeParseJson: No JSON structure found in response. Preview: "${rawText.substring(0, 100)}"`);
  }

  // 4. Try parsing the extracted candidate
  try {
    return JSON.parse(jsonCandidate);
  } catch (candidateErr) {
    // 5. Apply Repair Pipeline:
    let repaired = jsonCandidate;

    // 5a. Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // 5b. Fix unescaped newlines/tabs inside string literals
    repaired = sanitizeNewlinesInStrings(repaired);

    // 5c. Try parsing repaired JSON
    try {
      return JSON.parse(repaired);
    } catch (_) {
      // 5d. Strip single-line comments if any leaked into output
      repaired = repaired.replace(/(^|[^\\])\/\/[^\n]*/g, '$1');

      try {
        return JSON.parse(repaired);
      } catch (finalErr) {
        if (fallback !== undefined) return fallback;
        throw new SyntaxError(
          `safeParseJson: Failed to parse repaired JSON: ${finalErr.message}. Extracted candidate: "${jsonCandidate.substring(0, 120)}..."`
        );
      }
    }
  }
}

/**
 * Helper to escape unescaped control characters inside JSON string literals.
 */
function sanitizeNewlinesInStrings(str) {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"' && !isEscaped) {
      inString = !inString;
      result += char;
    } else if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }

    if (char === '\\' && !isEscaped) {
      isEscaped = true;
    } else {
      isEscaped = false;
    }
  }

  return result;
}

module.exports = {
  safeParseJson,
  sanitizeNewlinesInStrings
};
