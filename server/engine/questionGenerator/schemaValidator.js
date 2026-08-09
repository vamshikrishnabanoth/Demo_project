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

  const cleanAns = String(correctAnswer || '').trim();
  const verbatimMatch = options.some(opt => String(opt).trim() === cleanAns);
  if (!correctAnswer || !verbatimMatch) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Correct answer does not match any of the 4 options verbatim." };
  }

  if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
    return { isValid: false, status: "SCHEMA_MISMATCH", reason: "Explanation text is missing or empty." };
  }

  return {
    isValid: true,
    status: "SUCCESS",
    stem: stem.trim(),
    options: options.map(o => String(o).trim()),
    correctAnswer: cleanAns,
    explanation: explanation.trim()
  };
}

module.exports = {
  validateParsedMCQSchema
};
