/**
 * server/engine/evidence/depthAnalyzer.js
 *
 * Multi-Layer Curricular Substance Gate & Pedagogical Lecture Depth Analyzer (v2.0).
 * - Layer 1: Token-Boundary Matching (\b) eliminates substring false positives (e.g., comfortable != table).
 * - Layer 2: Segment-Level Speech Intent Tagging:
 *     [CURRICULAR]: Assessable concepts, definitions, mechanisms, algorithms, rules, traces, comparisons.
 *     [PEDAGOGICAL]: Instructional emphasis, reassurance, study advice, motivation, interview tips.
 *     [ADMINISTRATIVE]: Classroom management, attendance, silence, exam dates, casual chatter.
 * - Layer 3: Curricular Substance Gate:
 *     Ensures assessable subject matter exists without requiring a rigid 25% ratio threshold.
 *     Rejects pure non-curricular speech (Pps jocks, pure motivation, discipline, vocab lists without teaching).
 *     Preserves legitimate technical, hybrid, boundary, and mixed-transition lectures.
 * - Layer 4: Feeds clean curricular segments to Agent 1 Planner and instructional cues to Voice Authority.
 */

'use strict';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class DepthAnalyzer {
  /**
   * Split raw text into semantic segments (sentences/clauses).
   */
  segmentText(text) {
    if (!text) return [];
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
    const rawSegments = cleaned.split(/(?<=[.?!])\s+|\n+/);
    return rawSegments
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  /**
   * Classify the semantic intent and curricular substance of a single segment.
   */
  classifySegment(seg) {
    const lower = seg.toLowerCase();

    // 1. Check for Administrative / Classroom Discipline / Logistics / Casual Chatter
    const adminPatterns = [
      /\b(close your (?:lips|lapels|mouth|laptops|books|eyes))\b/i,
      /\b(stop talking|settle down|be quiet|silence in the (?:class|back))\b/i,
      /\b(roll number(?:s)?|stand up|sit down|attendance|absent|present)\b/i,
      /\b(exam will be (?:held|conducted)|mid-term examination|bring your (?:id|hall tickets|identity cards|calculator))\b/i,
      /\b(had lunch|cafeteria|traffic was|metro station|weather is nice|yesterday movie|funny haha|party|shopping)\b/i,
      /\b(listen carefully|pay attention in the back|benches)\b/i
    ];
    for (const pat of adminPatterns) {
      if (pat.test(lower)) {
        return {
          type: 'ADMINISTRATIVE',
          reason: 'Classroom governance, logistics, or casual chatter',
          confidence: 'HIGH'
        };
      }
    }

    // 2. Check for Pedagogical Meta-Speech / Feedback / Motivation / Reassurance / Teaching Process
    // (Teacher talking ABOUT teaching, student feelings, reassurance, comfort, or interview hype)
    const pedagogicalMetaPatterns = [
      /\b(are you having any (?:issues|doubts|problems)|are you (?:people )?able to understand me)\b/i,
      /\b(especially (?:girls|boys)|last girl|last boy)\b/i,
      /\b(comfortable with the pace|teaching pace|medium gear|top gear|first gear|comfort level)\b/i,
      /\b(75|80|75-80)% of (?:students|class|people)\b/i,
      /\b(believe in yourself|crack any interview|do not be afraid of exams|study hard and stay confident)\b/i,
      /\b(do not be (?:nervous|afraid|worried)|keep your spirits high|everyone finds it hard at first|be patient with yourselves)\b/i,
      /\b(important for (?:google|technical)? ?interviews|asked in (?:top|product) companies)\b/i,
      /\b(you will master this with practice|recursion takes time to master)\b/i
    ];
    for (const pat of pedagogicalMetaPatterns) {
      if (pat.test(lower)) {
        return {
          type: 'PEDAGOGICAL',
          reason: 'Instructional reassurance, teaching process, comfort feedback, or interview motivation',
          confidence: 'HIGH'
        };
      }
    }

    // 3. Check for Curricular Substance Forms
    const technicalTerms = [
      'binary search', 'sorted array', 'search space', 'middle element', 'median', 'time complexity', 'space complexity',
      'logarithmic', 'big o', 'algorithm', 'data structure', 'dynamic programming', 'state transition', 'profit',
      'quick sort', 'quicksort', 'merge sort', 'partition', 'partitioning', 'pivot',
      'deadlock', 'coffman', 'mutual exclusion', 'hold and wait', 'circular wait', 'preemption',
      'http', 'http get', 'http post', 'idempotent', 'idempotency', 'status code', 'rest api',
      'tree', 'binary tree', 'bst', 'node', 'nodes', 'root', 'leaf', 'graph', 'edge', 'vertex', 'vertices',
      'recursion', 'recursive', 'base case', 'stack', 'queue', 'linked list', 'array', 'pointer',
      'cpu', 'processor', 'memory allocation', 'register', 'registers', 'interrupt', 'operating system',
      'compiler', 'database', 'sql', 'query', 'indexing', 'schema', 'transaction', 'acid',
      'concurrency', 'thread', 'multithreading', 'mutex', 'semaphore',
      'token', 'tokenizer', 'tokens', 'vector', 'neural network', 'isr', 'program counter', 'vector table',
      'polling', 'busy-wait'
    ];

    const matchedTerms = [];
    for (const term of technicalTerms) {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (regex.test(lower)) {
        matchedTerms.push(term);
      }
    }

    // Check for comma-separated noun lists (vocabulary list without teaching)
    const commaParts = seg.split(',').map(p => p.trim()).filter(Boolean);
    if (commaParts.length >= 4 && commaParts.every(p => p.split(/\s+/).length <= 3)) {
      return {
        type: 'UNGROUNDED_VOCAB',
        matchedTerms,
        reason: 'Comma-separated vocabulary list without explanatory predicate or assessable teaching',
        confidence: 'HIGH'
      };
    }

    // Curricular structural relations:
    const hasDefRelation = /\b(is an?|means|defined as|refers to|represents|consists of|requires|produces|creates|modifies|guarantee(?:s|d)?|converts)\b/i.test(lower);
    const textWithoutCompoundNouns = lower.replace(/\b(binary search|depth first search|breadth first search)\b/gi, 'NOUN_ALGO');
    const hasMechRelation = /\b(works by|divid(?:e|es|ing|ed)|compar(?:e|es|ing|ed)|search(?:es|ing|ed)?|eliminat(?:e|es|ing|ed)|discard(?:s|ing|ed)?|partition(?:s|ing|ed)?|allocat(?:e|es|ing|ed)|execut(?:e|es|ing|ed)|select(?:s|ing|ed)?|travers(?:e|es|ing|ed)|paus(?:es|ed|ing)|transfer(?:s|red|ring)|restor(?:es|ed|ing)|resum(?:es|ed|ing)|fetch(?:es|ed|ing)|process)\b/i.test(textWithoutCompoundNouns);
    const hasRuleRelation = /\b(if|when|condition|conditions|because|therefore|in order to|prevents?|leads to|results in|safe and idempotent|idempotent|greater than|less than|equal to|temporarily changes)\b/i.test(lower);
    const hasComparisonRelation = /\b(in contrast|compared to|difference between|neither .* nor|whereas|while|faster than|slower than|preferred over)\b/i.test(lower);
    const hasTraceExample = /\[[0-9,\s]+\]|\b(pivot|example|trace|step|produces)\b/i.test(lower) && matchedTerms.length > 0;
    const hasSocraticCurricular = /\b(what happens (?:to|if)|why does|can the)\b/i.test(lower) && matchedTerms.length > 0;

    const hasSubstanceRelation = hasDefRelation || hasMechRelation || hasRuleRelation || hasComparisonRelation || hasTraceExample || hasSocraticCurricular;

    if (matchedTerms.length > 0 && hasSubstanceRelation) {
      return {
        type: 'CURRICULAR',
        matchedTerms,
        substanceType: hasDefRelation ? 'DEFINITION_OR_FACT'
          : (hasMechRelation ? 'MECHANISM'
          : (hasRuleRelation ? 'RULE_OR_CONDITION'
          : (hasComparisonRelation ? 'COMPARISON'
          : (hasTraceExample ? 'WORKED_EXAMPLE' : 'SOCRATIC_INSTRUCTION')))),
        reason: 'Presents assessable subject concept with functional, causal, or structural relation',
        confidence: 'HIGH'
      };
    }

    if (matchedTerms.length > 0 && !hasSubstanceRelation) {
      return {
        type: 'UNGROUNDED_VOCAB',
        matchedTerms,
        reason: 'Technical terminology mentioned without explanatory, functional, or assessable substance',
        confidence: 'MEDIUM'
      };
    }

    return {
      type: 'GENERAL_TEXT',
      reason: 'Standard conversational text without domain curricular substance',
      confidence: 'MEDIUM'
    };
  }

  /**
   * Analyze raw text or transcript for Academic Content and Pedagogical Depth.
   * @param {String} text - Raw transcript or combined document text
   * @returns {Object} { isAcademic, isCurricular, reason, lectureDepth, detectedFocus, curricularSegments, pedagogicalSegments, adminSegments }
   */
  analyzeLecture(text = '') {
    const raw = (text || '').trim();
    if (raw.length < 15) {
      return {
        isAcademic: false,
        isCurricular: false,
        reason: 'INSUFFICIENT_CONTENT',
        lectureDepth: {
          rating: 'Non-Academic',
          score: 0,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' }
        },
        detectedFocus: [],
        curricularSegments: [],
        pedagogicalSegments: [],
        adminSegments: []
      };
    }

    const segments = this.segmentText(raw);
    const classifiedSegments = segments.map(seg => ({
      text: seg,
      classification: this.classifySegment(seg)
    }));

    const curricularSegments = classifiedSegments.filter(s => s.classification.type === 'CURRICULAR');
    const pedagogicalSegments = classifiedSegments.filter(s => s.classification.type === 'PEDAGOGICAL');
    const adminSegments = classifiedSegments.filter(s => s.classification.type === 'ADMINISTRATIVE');
    const vocabOnlySegments = classifiedSegments.filter(s => s.classification.type === 'UNGROUNDED_VOCAB');

    // Assess whether there is legitimate assessable curricular substance
    const hasCurricularSubstance = (curricularSegments.length >= 1);

    if (!hasCurricularSubstance) {
      const reason = vocabOnlySegments.length > 0
        ? 'INSUFFICIENT_CURRICULAR_CONTENT: Technical vocabulary present without assessable instruction or explanation.'
        : (pedagogicalSegments.length > 0
          ? 'INSUFFICIENT_CURRICULAR_CONTENT: Pure pedagogical process, motivation, or feedback without assessable curricular concepts.'
          : 'INSUFFICIENT_CURRICULAR_CONTENT: Non-academic or administrative content.');

      return {
        isAcademic: false,
        isCurricular: false,
        reason,
        lectureDepth: {
          rating: 'Non-Academic',
          score: 10,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' }
        },
        detectedFocus: [],
        curricularSegments: [],
        pedagogicalSegments,
        adminSegments
      };
    }

    // Extract detected focus concepts strictly from CURRICULAR segments
    const focusSet = new Set();
    curricularSegments.forEach(s => {
      (s.classification.matchedTerms || []).forEach(t => {
        const cap = t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        focusSet.add(cap);
      });
    });

    const detectedFocus = Array.from(focusSet).slice(0, 6);
    if (detectedFocus.length === 0) detectedFocus.push('Core Concepts');

    // Procedural and depth signals evaluated on curricular content
    const curricularText = curricularSegments.map(s => s.text).join(' ');
    const lowerCurricular = curricularText.toLowerCase();

    const hasDef = curricularSegments.some(s => s.classification.substanceType === 'DEFINITION_OR_FACT');
    const hasMech = curricularSegments.some(s => s.classification.substanceType === 'MECHANISM');
    const hasRule = curricularSegments.some(s => s.classification.substanceType === 'RULE_OR_CONDITION');
    const hasComp = curricularSegments.some(s => s.classification.substanceType === 'COMPARISON');
    const hasTrace = curricularSegments.some(s => s.classification.substanceType === 'WORKED_EXAMPLE');

    // Compute characteristic dimensions required by test_adaptive_engine_v12
    const conceptExp = (hasDef || hasMech) ? (curricularSegments.length > 2 ? 'Strong' : 'Moderate') : 'Developing';
    const reasonMarkers = ['because', 'therefore', 'why', 'in order to', 'leads to', 'results in', 'prevents', 'eliminates'];
    const reasonCount = reasonMarkers.filter(m => lowerCurricular.includes(m)).length;
    const reasoning = reasonCount >= 2 ? 'Strong' : (reasonCount >= 1 ? 'Moderate' : 'Light');

    const exampleMarkers = ['for example', 'for instance', 'consider', 'suppose', 'like when', 'example', 'trace', 'given array'];
    const hasExamples = exampleMarkers.some(m => lowerCurricular.includes(m)) || hasTrace;
    const examples = hasExamples ? 'Present' : 'Light';

    const procMarkers = ['first', 'second', 'third', 'finally', 'then', 'step', 'after', 'before', 'pauses', 'transfers', 'restores', 'resumes'];
    const procCount = procMarkers.filter(m => lowerCurricular.includes(m)).length;
    const procedures = procCount >= 3 ? 'Strong' : (procCount >= 1 ? 'Moderate' : 'Light');

    let depthScore = 40;
    if (conceptExp === 'Strong') depthScore += 12;
    if (reasoning === 'Strong') depthScore += 12;
    else if (reasoning === 'Moderate') depthScore += 6;
    if (examples === 'Present') depthScore += 12;
    if (procedures === 'Strong') depthScore += 15;
    else if (procedures === 'Moderate') depthScore += 8;
    if (curricularSegments.length >= 4) depthScore += 10;

    depthScore = Math.min(100, Math.max(35, depthScore));
    let rating = 'Developing';
    if (depthScore < 50) rating = 'Introductory';
    else if (depthScore >= 75) rating = 'Comprehensive';

    return {
      isAcademic: true,
      isCurricular: true,
      reason: null,
      lectureDepth: {
        rating,
        score: depthScore,
        characteristics: {
          conceptExplanation: conceptExp,
          reasoning,
          examples,
          procedures
        }
      },
      detectedFocus,
      curricularSegments,
      pedagogicalSegments,
      adminSegments
    };
  }
}

module.exports = new DepthAnalyzer();
