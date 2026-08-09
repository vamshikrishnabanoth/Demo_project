/**
 * Helper to strip markdown JSON code fences and isolate root JSON object
 */
function repairJsonFence(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

module.exports = {
  repairJsonFence
};
