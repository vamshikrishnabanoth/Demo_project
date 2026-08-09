const { GENERATOR_CONFIG } = require('../../config/generatorConfig');

/**
 * 5. UNICODE SANITIZATION
 * Sanitizes smart quotes, smart apostrophes, and em-dashes prior to JSON parsing.
 */
function normalizeUnicodeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return "";

  const { SMART_QUOTES_REGEX, SMART_APOSTROPHE_REGEX, EM_DASH_REGEX } = GENERATOR_CONFIG.UNICODE_NORMALIZE;

  return rawText
    .replace(SMART_QUOTES_REGEX, '"')
    .replace(SMART_APOSTROPHE_REGEX, "'")
    .replace(EM_DASH_REGEX, "-");
}

module.exports = {
  normalizeUnicodeText
};
