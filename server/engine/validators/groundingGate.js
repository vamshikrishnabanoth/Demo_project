/**
 * server/engine/validators/groundingGate.js
 *
 * FINAL GROUNDING GATE:
 * Verification run immediately before final quiz delivery.
 * Verifies that every question's options and correct answer can be justified
 * strictly from session evidence without relying on hallucinated facts or foreign topic contamination.
 */

'use strict';

// Single-digit numbers to English word map for speech transcript normalization
const DIGIT_WORD_MAP = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine'
};

/**
 * Generates guarded inflectional variant candidates for a substantive token.
 * Never mutates original tokens destructively; returns candidate forms to test against evidence.
 */
function getMorphologicalVariants(token) {
  const variants = new Set([token]);
  const len = token.length;

  // Floor constraint: short words (< 4 chars) are never stemmed
  if (len < 4) return variants;

  // Guard against protected endings: -ss, -us, -is, -eed (e.g. process, address, status, basis, speed)
  const isProtectedEnding = /([sui]s|eed)$/.test(token);

  // 1. Participle / Gerund: -ing (e.g., 'converting' -> 'convert', 'pipelining' -> 'pipeline')
  if (token.endsWith('ing') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base);
    variants.add(base + 'e');
  }

  // 2. Adjective / Noun Invariance: -ive <-> -ion (e.g., 'recursive' <-> 'recursion')
  if (token.endsWith('ive') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base + 'ion');
    variants.add(base);
    variants.add(base + 'e');
  }
  if (token.endsWith('ion') && len >= 6) {
    const base = token.slice(0, -3);
    variants.add(base + 'ive');
    variants.add(base);
    variants.add(base + 'e');
  }

  // 3. Past tense / Participle: -ed (e.g., 'executed' -> 'execute')
  if (token.endsWith('ed') && len >= 5 && !isProtectedEnding) {
    variants.add(token.slice(0, -1));
    variants.add(token.slice(0, -2));
  }

  // 4. Plurals: -s / -es (e.g., 'nodes' -> 'node', 'reaches' -> 'reach')
  if (token.endsWith('s') && len >= 4 && !isProtectedEnding) {
    if (token.endsWith('es') && len >= 5) {
      variants.add(token.slice(0, -2));
    }
    variants.add(token.slice(0, -1));
  }

  return variants;
}

/**
 * Checks if a token (alphabetic or numeric) is supported by verifiable evidence.
 */
function isTokenSupported(token, rawLower) {
  if (/^\d+$/.test(token)) {
    // Exact numeric match with word boundaries
    const numRegex = new RegExp(`\\b${token}\\b`);
    if (numRegex.test(rawLower)) return true;
    // Check digit word equivalent (e.g. '8' -> 'eight', '0' -> 'zero')
    if (DIGIT_WORD_MAP[token]) {
      const wordRegex = new RegExp(`\\b${DIGIT_WORD_MAP[token]}\\b`);
      if (wordRegex.test(rawLower)) return true;
    }
    return false;
  }

  // Alphabetic token: check exact token and guarded morphological variants
  const variants = getMorphologicalVariants(token);
  for (const v of variants) {
    if (rawLower.includes(v)) return true;
  }
  return false;
}

// Canonical predicate semantic families for relational entailment verification
const PREDICATE_FAMILIES = {
  PRODUCE: {
    stems: ['synthesiz', 'generat', 'produc', 'creat', 'yield', 'emit', 'secret', 'build', 'form', 'manufactur']
  },
  CAUSE: {
    stems: ['caus', 'accelerat', 'trigger', 'induc', 'stimulat', 'catalyz', 'prompt', 'result', 'lead']
  },
  INHIBIT: {
    stems: ['inhibit', 'prevent', 'block', 'halt', 'stop', 'suppress', 'restrict', 'limit']
  },
  EXECUTE: {
    stems: ['execut', 'process', 'comput', 'calculat', 'schedul', 'allocat', 'run']
  },
  CONTAIN: {
    stems: ['stor', 'contain', 'hold', 'hous', 'enclos']
  },
  TRANSFORM: {
    stems: ['condens', 'fold', 'compress', 'divid', 'separat', 'split', 'dissolv', 'replicat', 'transcrib', 'translat']
  }
};

const DISCOURSE_CONNECTORS = new Set([
  'meanwhile', 'however', 'furthermore', 'moreover', 'likewise', 'consequently',
  'similarly', 'whereas', 'separately', 'instead', 'therefore', 'nevertheless',
  'nonetheless', 'contrast', 'otherwise', 'accordingly'
]);

const DISJUNCTIVE_MARKERS = /\b(meanwhile|in contrast|separately|on the other hand|elsewhere|whereas|unlike)\b/i;

const MUTUALLY_EXCLUSIVE_PAIRS = [
  ['fifo', 'lifo'],
  ['first-in first-out', 'last-in first-out'],
  ['preemptive', 'non-preemptive'],
  ['contiguous', 'non-contiguous'],
  ['synchronous', 'asynchronous'],
  ['deterministic', 'non-deterministic'],
  ['static', 'dynamic'],
  ['linear', 'non-linear'],
  ['mutable', 'immutable'],
  ['0-indexed', '1-indexed'],
  ['zero-indexed', 'one-indexed']
];

function matchPredicateStem(word) {
  const w = word.toLowerCase().trim();
  if (w.length < 4) return null;
  for (const [family, def] of Object.entries(PREDICATE_FAMILIES)) {
    for (const stem of def.stems) {
      if (w === stem || w.startsWith(stem)) {
        return { family, stem, word: w };
      }
    }
  }
  return null;
}

function parseClauses(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?\n;])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

function cleanTokens(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function buildEvidenceGraph(rawContent, stopwords) {
  const clauses = parseClauses(rawContent);
  const evidenceRecords = [];

  for (let idx = 0; idx < clauses.length; idx++) {
    const clause = clauses[idx];
    const words = cleanTokens(clause);
    const isDisjunctive = DISJUNCTIVE_MARKERS.test(clause);

    const tokens = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (DISCOURSE_CONNECTORS.has(w) || (stopwords && stopwords.has(w))) continue;
      const pred = matchPredicateStem(w);
      tokens.push({
        word: w,
        index: i,
        isPred: Boolean(pred),
        predInfo: pred
      });
    }

    const substantiveWords = tokens.filter(t => !t.isPred && t.word.length >= 3);
    const predsInClause = tokens.filter(t => t.isPred);

    const relations = [];
    for (const p of predsInClause) {
      const agents = substantiveWords.filter(s => s.index < p.index && s.index >= p.index - 4).map(s => s.word);
      const targets = substantiveWords.filter(s => s.index > p.index && s.index <= p.index + 6).map(s => s.word);

      if (agents.length > 0 || targets.length > 0) {
        relations.push({
          predicate: p.predInfo,
          agents,
          targets
        });
      }
    }

    evidenceRecords.push({
      clauseIndex: idx,
      clauseText: clause,
      isDisjunctive,
      substantiveWords: substantiveWords.map(s => s.word),
      predicates: predsInClause.map(p => p.predInfo),
      relations
    });
  }

  return evidenceRecords;
}

function verifyRelationalGrounding(qText, ansText, evidenceRecords, rawEvidence = '', stopwords = null) {
  const candFull = `${qText} ${ansText}`.toLowerCase();

  // 0. Mutual Exclusion / Factual Contradiction Check
  for (const [termA, termB] of MUTUALLY_EXCLUSIVE_PAIRS) {
    if (candFull.includes(termA) || candFull.includes(termB)) {
      const assertedTerm = candFull.includes(termA) ? termA : termB;
      const oppositeTerm = assertedTerm === termA ? termB : termA;

      const candRegex = new RegExp(`(\\b[a-z0-9_-]+\\b)(?:\\s+(?:is|operates|defined|considered|acts as a|as a)){1,3}\\s+\\b${assertedTerm}\\b`, 'i');
      const mCand = candFull.match(candRegex);
      if (mCand) {
        const subject = mCand[1];
        if ((!stopwords || !stopwords.has(subject)) && subject.length >= 3) {
          const evidRegex = new RegExp(`\\b${subject}\\b[^.!?\\n]*\\b${oppositeTerm}\\b`, 'i');
          if (evidRegex.test(rawEvidence.toLowerCase())) {
            return {
              isJustified: false,
              reason: `FACTUAL_CONTRADICTION: Candidate asserts "${subject}" is "${assertedTerm}", but evidence explicitly states "${subject}" is "${oppositeTerm}"`
            };
          }
        }
      }
    }
  }

  const candidateSentences = parseClauses(`${qText}. ${ansText}`);

  for (const candSent of candidateSentences) {
    const words = cleanTokens(candSent);
    const tokens = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (DISCOURSE_CONNECTORS.has(w) || (stopwords && stopwords.has(w))) continue;
      const pred = matchPredicateStem(w);
      tokens.push({
        word: w,
        index: i,
        isPred: Boolean(pred),
        predInfo: pred
      });
    }

    const candSubstantive = tokens.filter(t => !t.isPred && t.word.length >= 3);
    const candPreds = tokens.filter(t => t.isPred);

    for (const cp of candPreds) {
      const agentsAsserted = candSubstantive.filter(s => s.index < cp.index && s.index >= cp.index - 5).map(s => s.word);
      const targetsAsserted = candSubstantive.filter(s => s.index > cp.index && s.index <= cp.index + 6).map(s => s.word);

      if (agentsAsserted.length === 0 || targetsAsserted.length === 0) continue;

      // 1. Check Misattribution for each target
      for (const target of targetsAsserted) {
        const clausesWithTarget = evidenceRecords.filter(r => r.substantiveWords.includes(target));
        if (clausesWithTarget.length === 0) continue;

        for (const er of clausesWithTarget) {
          const matchingRel = er.relations.find(rel => rel.predicate.family === cp.predInfo.family && rel.targets.includes(target));
          if (matchingRel && matchingRel.agents.length > 0) {
            const evidenceAgents = matchingRel.agents;
            const agentMatched = agentsAsserted.some(a => evidenceAgents.includes(a));
            if (!agentMatched) {
              const agentInClause = agentsAsserted.some(a => er.substantiveWords.includes(a));
              if (!agentInClause) {
                return {
                  isJustified: false,
                  reason: `UNGROUNDED_RELATIONAL_CLAIM: Candidate asserts "${agentsAsserted.join(' ')}" ${cp.predInfo.word} "${target}", but evidence attributes this to "${evidenceAgents.join(' ')}"`
                };
              }
            }
          }
        }
      }

      // 2. Check Un-taught Causal Linking across independent/disjunctive clauses
      if (cp.predInfo.family === 'CAUSE') {
        for (const agent of agentsAsserted) {
          for (const target of targetsAsserted) {
            const clauseWithAgent = evidenceRecords.find(r => r.substantiveWords.includes(agent));
            const clauseWithTarget = evidenceRecords.find(r => r.substantiveWords.includes(target));

            if (clauseWithAgent && clauseWithTarget && clauseWithAgent.clauseIndex !== clauseWithTarget.clauseIndex) {
              if (clauseWithTarget.isDisjunctive || clauseWithAgent.isDisjunctive) {
                const hasDirectCausal = evidenceRecords.some(r =>
                  r.substantiveWords.includes(agent) &&
                  r.substantiveWords.includes(target) &&
                  r.predicates.some(p => p.family === 'CAUSE')
                );
                if (!hasDirectCausal) {
                  return {
                    isJustified: false,
                    reason: `UNGROUNDED_RELATIONAL_CLAIM: Causal link between "${agent}" and "${target}" is absent from lecture evidence (source clauses are independent or disjunctive)`
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  return { isJustified: true };
}

class GroundingGate {
  /**
   * Run Final Grounding Gate on passing quiz questions.
   * @param {Array} quizQuestions - Validated quiz questions
   * @param {Object} evidencePackage - Session evidence package
   * @returns {Object} { status: 'PASSED'|'FAILED', validatedQuestions: [], rejectedCount: 0 }
   */
  verifyQuizGrounding(quizQuestions = [], evidencePackage = {}) {
    const rawContent = (typeof evidencePackage === 'string'
      ? evidencePackage
      : [
          evidencePackage?.unifiedRawContent,
          evidencePackage?.curricularContent,
          ...(Array.isArray(evidencePackage?.documentTexts) ? evidencePackage.documentTexts : []),
          evidencePackage?.voiceTranscript,
          evidencePackage?.topic
        ].filter(Boolean).join('\n')
    ).toLowerCase();
    const pkgObj = typeof evidencePackage === 'string' ? { unifiedRawContent: evidencePackage } : evidencePackage;
    const validated = [];
    let rejectedCount = 0;
    let failureReasons = [];

    // Extract table and visual contents from multimodalStore or commonDocumentModel if present
    let tableText = '';
    let visualText = '';
    if (pkgObj?.commonDocumentModel) {
      const blocks = pkgObj.commonDocumentModel.getAllBlocks?.() || [];
      for (const b of blocks) {
        if (b.type === 'table') tableText += ' ' + b.content.toLowerCase();
        if (b.type === 'chart' || b.type === 'diagram' || b.type === 'image') visualText += ' ' + b.content.toLowerCase();
      }
    }

    const fullVerifiableContent = `${rawContent} ${tableText} ${visualText}`.trim();

    for (const q of quizQuestions) {
      const qText = (q.questionText || q.question || '').toLowerCase();
      const ansText = (q.correctAnswer || '').toLowerCase();

      // Semantic keywords overlap verification against verifiable session content
      const { isJustified, reason } = this._checkJustification(qText, ansText, fullVerifiableContent, q, pkgObj);

      if (isJustified) {
        validated.push(q);
      } else {
        console.warn(`⚠️ [Grounding Gate] REJECTED question due to: ${reason} | Question: "${q.questionText}"`);
        rejectedCount++;
        failureReasons.push(reason);
      }
    }

    const passed = validated.length > 0;
    return {
      status: passed ? 'PASSED' : 'FAILED',
      failureCode: passed ? null : 'INSUFFICIENT_READABLE_EVIDENCE',
      validatedQuestions: validated,
      rejectedCount: rejectedCount,
      totalVerified: validated.length,
      reasons: failureReasons
    };
  }

  validateJustification(quizQuestions = [], rawContent = '', evidencePackage = {}) {
    const pkg = typeof rawContent === 'object' && rawContent !== null
      ? rawContent
      : { ...(evidencePackage || {}), unifiedRawContent: String(rawContent || '') };
    const res = this.verifyQuizGrounding(quizQuestions, pkg);
    return {
      status: res.status,
      justifiedQuestions: res.validatedQuestions,
      rejectedQuestions: (res.reasons || []).map((reason, idx) => ({ reason, question: quizQuestions[idx] })),
      ...res
    };
  }

  _checkJustification(qText, ansText, rawContent, q = null, evidencePackage = {}) {
    const isTopicMode = evidencePackage?.inputModality === 'TOPIC_SYNTHESIS' ||
      evidencePackage?.representationMode === 'TOPIC_BLUEPRINT';
    if (isTopicMode) {
      return { isJustified: true, reason: 'Topic curriculum mode: canonical subject verification' };
    }

    if (q?.metadata?.isSynthesizedGrounded || (Array.isArray(q?.usedArchetypes) && q.usedArchetypes.includes('EVIDENCE_PROPOSITION_EXTRACTION'))) {
      return { isJustified: true, reason: 'Verifiable evidence proposition synthesis' };
    }

    if (!rawContent || rawContent.length < 50) {
      return { isJustified: false, reason: 'INSUFFICIENT_READABLE_EVIDENCE: Session content too sparse to verify grounding' };
    }

    // Check explicit teacher negative boundaries (e.g. NO_CODE, NO_MATH)
    const boundaries = evidencePackage?.negativeBoundaries || evidencePackage?.instructionalProfile?.negativeBoundaries || [];
    const hasNoCodeBoundary = boundaries.some(b => /no_code/i.test(b));
    if (hasNoCodeBoundary) {
      const codeRegex = /\b(def\s+|class\s+|int\s+|void\s+|public\s+|private\s+|malloc\s*\(|free\s*\(|printf\s*\(|cout\s*<<|cin\s*>>|std::|#include\s*<|import\s+)\b/;
      let hasProhibitedCode = codeRegex.test(qText) || codeRegex.test(ansText);
      if (!hasProhibitedCode && q && Array.isArray(q.options)) {
        hasProhibitedCode = q.options.some(opt => codeRegex.test(opt));
      }
      if (!hasProhibitedCode && q) {
        try {
          const { validateQuestionCodeArtifacts } = require('./astParser');
          const codeAudit = validateQuestionCodeArtifacts(q);
          if (codeAudit.hasCode) hasProhibitedCode = true;
        } catch (_) {}
      }
      if (hasProhibitedCode) {
        return { isJustified: false, reason: 'TEACHER_BOUNDARY_VIOLATION: Code syntax generated despite explicit NO_CODE instruction' };
      }
    }

    // Stopwords list: common grammatical, question scaffolding, and domain-neutral scenario reasoning words
    const stopwords = new Set([
      'which', 'what', 'where', 'when', 'after', 'before', 'during', 'should',
      'between', 'their', 'there', 'about', 'using', 'would', 'could', 'because',
      'primary', 'following', 'statement', 'correct', 'accurately', 'context',
      'inside', 'outside', 'placed', 'allows', 'allowed', 'given', 'gives',
      'the', 'and', 'for', 'are', 'all', 'not', 'but', 'into', 'than', 'then',
      'also', 'each', 'can', 'will', 'just', 'such', 'only', 'more', 'some',
      'any', 'been', 'has', 'had', 'does', 'did', 'doing', 'our', 'you',
      'your', 'they', 'them', 'who', 'how', 'why', 'with', 'from', 'that',
      'this', 'these', 'those', 'have', 'were', 'being', 'other', 'most',
      'both', 'through', 'under', 'over', 'while', 'well', 'here', 'first',
      'affect', 'currently',

      // Question-framing metadata & prompt scaffolding tokens
      'according', 'evidence', 'result', 'expression', 'determine', 'determines',
      'calculated', 'calculate', 'identify', 'identifies', 'specific', 'specified',
      'established', 'represents', 'described', 'describes', 'indicated', 'indicates',
      'mentioned', 'discusses', 'discussed', 'value', 'values', 'difference',
      'example', 'examples', 'variable', 'variables',

      // Domain-neutral scenario, application & reasoning terms (never treated as foreign topics)
      'same', 'size', 'initial', 'initialize', 'initialized', 'initializes', 'initializing',
      'element', 'elements', 'contain', 'contains', 'contained', 'containing',
      'item', 'items', 'entry', 'entries', 'case', 'cases', 'instance', 'instances',
      'assume', 'assumes', 'assumed', 'assuming', 'given', 'suppose', 'supposes', 'supposed', 'supposing',
      'program', 'programs', 'execution', 'executions', 'start', 'starts', 'started', 'starting',
      'end', 'ends', 'ended', 'ending', 'type', 'types', 'store', 'stores', 'stored', 'storing',
      'behavior', 'behaviors', 'scenario', 'scenarios', 'state', 'states', 'structure', 'structures',
      'data', 'operation', 'operations', 'operational', 'outcome', 'outcomes',
      'perform', 'performs', 'performed', 'performing', 'performance', 'respect',
      'condition', 'conditions', 'input', 'inputs', 'output', 'outputs', 'order', 'ordered', 'ordering',
      'occur', 'occurs', 'occurred', 'occurring', 'raise', 'raises', 'raised', 'raising',
      'exception', 'exceptions', 'error', 'errors', 'valid', 'invalid', 'locate', 'locates', 'located', 'locating',
      'access', 'accesses', 'accessed', 'accessing', 'compare', 'compares', 'compared', 'comparing',
      'contrast', 'contrasts', 'divergence', 'diverges', 'characteristic', 'characteristics',
      'consequence', 'consequences', 'add', 'adds', 'added', 'adding', 'append', 'appends', 'appended', 'appending',
      'remove', 'removes', 'removed', 'removing', 'find', 'finds', 'found', 'finding',
      'return', 'returns', 'returned', 'returning', 'hold', 'holds', 'held', 'holding',
      'true', 'false', 'none', 'null', 'yes', 'number', 'numbers', 'equal', 'equals',
      'smaller', 'greater', 'larger', 'highest', 'lowest', 'minimum', 'maximum'
    ]);

    // Extract all alphanumeric tokens
    const rawTokens = `${qText} ${ansText}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const numericTokens = rawTokens.filter(w => /^\d+$/.test(w));
    const substantiveTokens = rawTokens.filter(w => !/^\d+$/.test(w) && w.length > 2 && !stopwords.has(w));
    const totalTokens = substantiveTokens.length + numericTokens.length;

    if (totalTokens === 0) {
      return { isJustified: true, reason: 'No significant keywords to constrain' };
    }

    const rawLower = rawContent.toLowerCase();

    const matchedSubstantive = substantiveTokens.filter(t => isTokenSupported(t, rawLower));
    const unsupportedSubstantive = substantiveTokens.filter(t => !isTokenSupported(t, rawLower));

    const matchedNumeric = numericTokens.filter(t => isTokenSupported(t, rawLower));
    const unsupportedNumeric = numericTokens.filter(t => !isTokenSupported(t, rawLower));

    const matchedCount = matchedSubstantive.length + matchedNumeric.length;
    const matchRatio = totalTokens > 0 ? matchedCount / totalTokens : 0;

    // 1. Total absence of evidence support
    if (matchedCount === 0) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio 0.0% (found 0/${totalTokens} terms in evidence)`
      };
    }

    // 2. Anti-bypass guard: numbers alone never establish grounding
    if (matchedSubstantive.length === 0 && substantiveTokens.length >= 2) {
      return {
        isJustified: false,
        reason: 'ZERO_SUBSTANTIVE_OVERLAP: No substantive domain concepts found in session evidence despite numeric presence'
      };
    }

    // 3. Evidence-based foreign domain contamination:
    // Multiple substantive unsupported anchors (>=3) with weak evidence support (<2 matches or <25% overlap)
    if (unsupportedSubstantive.length >= 3 && (matchedSubstantive.length < 2 || matchRatio < 0.25)) {
      const sampleUnsupported = Array.from(new Set(unsupportedSubstantive)).slice(0, 4).join(', ');
      return {
        isJustified: false,
        reason: `FOREIGN_TOPIC_CONTAMINATION: Multiple unsupported domain anchors (${sampleUnsupported}) absent from lecture evidence`
      };
    }

    // 4. Severe under-grounding (< 15% overlap)
    if (matchRatio < 0.15) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matchedCount}/${totalTokens} terms in evidence)`
      };
    }

    // 5. Sparse match floor: only 1 substantive keyword matched out of 5+ substantive terms with < 20% overlap
    if (matchedSubstantive.length < 2 && matchRatio < 0.20 && substantiveTokens.length >= 5) {
      return {
        isJustified: false,
        reason: `ZERO_SESSION_OVERLAP: Match ratio ${(matchRatio * 100).toFixed(1)}% (found ${matchedCount}/${totalTokens} terms in evidence)`
      };
    }

    // 6. Relational Grounding & Entailment Verification
    let evidenceRecords = evidencePackage?._evidenceGraph;
    if (!evidenceRecords) {
      evidenceRecords = buildEvidenceGraph(rawContent, stopwords);
      if (evidencePackage && typeof evidencePackage === 'object') {
        try { evidencePackage._evidenceGraph = evidenceRecords; } catch (_) {}
      }
    }

    const relationalAudit = verifyRelationalGrounding(qText, ansText, evidenceRecords, rawContent, stopwords);
    if (!relationalAudit.isJustified) {
      return {
        isJustified: false,
        reason: relationalAudit.reason,
        matchedDomainAnchors: matchedSubstantive,
        verifiedNumericalFacts: matchedNumeric
      };
    }

    return {
      isJustified: true,
      reason: `Grounded: ${(matchRatio * 100).toFixed(1)}% overlap`,
      matchedDomainAnchors: matchedSubstantive,
      verifiedNumericalFacts: matchedNumeric
    };
  }
}

const instance = new GroundingGate();
instance.GroundingGate = GroundingGate;
module.exports = instance;
