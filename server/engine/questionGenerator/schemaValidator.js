/**
 * Immediate Schema Validator
 * Verifies structural integrity of model JSON post-parsing.
 * If validation fails, assigns status SCHEMA_MISMATCH instantly.
 */
function validateParsedMCQSchema(parsedObj) {
  if (!parsedObj || typeof parsedObj !== 'object') {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Model output is not a valid JSON object." };
  }

  // Check fallback route status from LLM
  if (parsedObj.status === "INSUFFICIENT_EVIDENCE") {
    return { isValid: false, status: "INSUFFICIENT_EVIDENCE", reason: "Source snippet lacks sufficient evidence for question constraints." };
  }

  const stem = parsedObj.stem || parsedObj.question || parsedObj.questionText;
  const options = parsedObj.options;
  const correctAnswer = parsedObj.correctAnswer || parsedObj.correct_answer;
  const explanation = parsedObj.explanation;

  if (!stem || typeof stem !== 'string' || stem.trim().length === 0) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Question stem is missing or empty." };
  }

  if (!Array.isArray(options) || options.length !== 4 || options.some(o => typeof o !== 'string' || o.trim().length === 0)) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Options array must contain exactly 4 non-empty strings." };
  }

  let resolvedCorrectAnswer = null;
  const cleanAns = String(correctAnswer || '').trim();

  // 1. Verbatim exact match
  if (options.some(opt => String(opt).trim() === cleanAns)) {
    resolvedCorrectAnswer = cleanAns;
  }

  // 2. Letter/Index key: "A", "B", "C", "D", "Option A", "1", "(A)"
  if (!resolvedCorrectAnswer && cleanAns) {
    const letterMatch = cleanAns.match(/^(?:option\s+)?\(?([a-d1-4])\)?(?:\.|\:|\s|\-|\)|$)/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
      const idx = map[char];
      if (idx !== undefined && options[idx]) {
        resolvedCorrectAnswer = String(options[idx]).trim();
      }
    }
  }

  // 3. Case-insensitive or trimmed match
  if (!resolvedCorrectAnswer && cleanAns) {
    const lower = cleanAns.toLowerCase();
    const matched = options.find(opt => String(opt).trim().toLowerCase() === lower);
    if (matched) {
      resolvedCorrectAnswer = String(matched).trim();
    }
  }

  // 4. Substring without letter prefix (e.g., "(A) Quick Sort" -> "Quick Sort")
  if (!resolvedCorrectAnswer && cleanAns) {
    const stripped = cleanAns.replace(/^(?:option\s+[a-d1-4]|(?:\(?[a-d1-4]\)?[\)\.\:\s\-]+))\s*/i, '').trim().toLowerCase();
    if (stripped) {
      const subMatch = options.find(opt => String(opt).trim().toLowerCase() === stripped);
      if (subMatch) {
        resolvedCorrectAnswer = String(subMatch).trim();
      }
    }
  }

  if (!resolvedCorrectAnswer) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Correct answer does not match any of the 4 options verbatim or by index." };
  }

  if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Explanation text is missing or empty." };
  }

  return {
    isValid: true,
    status: "SUCCESS",
    stem: stem.trim(),
    options: options.map(o => String(o).trim()),
    correctAnswer: resolvedCorrectAnswer,
    explanation: explanation.trim()
  };
}

module.exports = {
  validateParsedMCQSchema
};
