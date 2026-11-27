/**
 * server/engine/evidence/evidenceContextSelector.js
 *
 * The evidence a question is written and checked against.
 *
 * In the MCQ pipeline every target is planned from the lecture model, so it carries the teacher's passage for its
 * point: the cited speech with small gaps filled, the slides or code cited with it, and for a "combine two taught
 * ideas" Hard question the related point. That passage IS the evidence, for the writer and for every check alike,
 * so the question can only use what the teacher actually said or showed for that point.
 *
 * A target without a passage (not produced by the pipeline) gets its supporting text, or failing that the most
 * relevant window of the raw input by shared words.
 *
 * The earlier retrieval stack (hierarchical parent/child chunks, cross-material alignment graph, BM25 + TF hybrid
 * retrieval, reranking) is kept in legacy/pre_single_pipeline/: it searched the raw text around a target although
 * the lecture model already knows which blocks taught each point, and it could hand the writer text the checks did
 * not see.
 */

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
}

/**
 * @param {Object} target            a writing target (lectureUnitId + supportingEvidence for pipeline targets)
 * @param {Object|string} evidence   the session context (unifiedRawContent) or raw text
 * @param {number} maxContextChars   size limit for the returned evidence
 * @returns {string}
 */
function getTargetEvidenceContext(target = {}, evidence = '', maxContextChars = 4000) {
  const limit = Math.max(200, maxContextChars);
  const supporting = String(target.supportingEvidence || target.evidenceSpan || '').trim();
  if (supporting && (target.lectureUnitId || supporting.length >= 40)) {
    return supporting.length > limit ? supporting.slice(0, limit) : supporting;
  }
  const raw = typeof evidence === 'string' ? evidence : String((evidence && evidence.unifiedRawContent) || '');
  if (!raw) return supporting || target.concept || '';
  if (raw.length <= limit) return raw;
  // Most relevant window of the raw input: the paragraph run sharing the most words with the target.
  const want = new Set(tokenize(`${target.concept || ''} ${target.subtopic || ''} ${target.statement || ''}`));
  const paras = raw.split(/\n\s*\n/);
  let best = 0, bestScore = -1;
  paras.forEach((p, i) => { const s = tokenize(p).filter(w => want.has(w)).length; if (s > bestScore) { bestScore = s; best = i; } });
  let out = '';
  for (let i = best; i < paras.length && out.length < limit; i++) out += (out ? '\n\n' : '') + paras[i];
  return (supporting ? `${supporting}\n\n` : '') + out.slice(0, limit);
}

module.exports = { getTargetEvidenceContext };
