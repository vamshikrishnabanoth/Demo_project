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
   * Uses domain-agnostic signals/features rather than a fixed technical keyword whitelist.
   */
  classifySegment(seg, prevSeg = null) {
    if (!seg) return { type: 'GENERAL_TEXT', reason: 'Empty segment', confidence: 'LOW' };
    const lower = seg.toLowerCase().trim();

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
      /\b(you will master this with practice|takes time to master)\b/i
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

    // 3. Check for comma-separated noun lists without explanatory predicate (ungrounded vocab list)
    const commaParts = seg.split(',').map(p => p.trim()).filter(Boolean);
    if (commaParts.length >= 4 && commaParts.every(p => p.split(/\s+/).length <= 3)) {
      return {
        type: 'UNGROUNDED_VOCAB',
        reason: 'Comma-separated vocabulary list without explanatory predicate or assessable teaching',
        confidence: 'HIGH'
      };
    }

    // 4. Instructional / Content-Bearing Feature Evaluation (Domain-Agnostic across CS, Math, English, Science, etc.)
    // Feature A: Definitional / Ontological predicates
    const hasDefRelation = /\b(is an?|are(?: words)?|means|defined as|refers to|represents|stands for|consists of|composed of|characterized by|types of|known as|named as|classified into|provides an?|acts as|serves as|used (?:to|as|in))\b/i.test(lower);

    // Feature B: Operational / Functional / Mechanistic verbs
    const hasMechRelation = /\b(works by|applies|extract(?:s|ed|ing)?|transform(?:s|ed|ing)?|comput(?:es|ed|ing)?|divid(?:es|ed|ing)?|multiplie(?:s|d)?|calculat(?:es|ed|ing)?|connect(?:s|ed|ing)?|execut(?:es|ed|ing)?|process(?:es|ed|ing)?|generat(?:es|ed|ing)?|allocat(?:es|ed|ing)?|modifie(?:s|d|ying)?|conduc(?:ts|ted|ting)?|converts?|eliminat(?:es|ed|ing)?|reduc(?:es|ed|ing)?|increas(?:es|ed|ing)?|decreas(?:es|ed|ing)?|stores?|retrieves?|passes?|takes?|outputs?|returns?|handles?|implements?|travers(?:es|ed|ing)?|select(?:s|ed|ing)?|partition(?:s|ed|ing)?|discard(?:s|ed|ing)?)\b/i.test(lower);

    // Feature C: Causal / Rule / Invariant / Conditional connectors
    const hasRuleRelation = /\b(if|when|whenever|because|therefore|in order to|leads to|results in|prevents|causes|so that|guarantees?|ensures?|requires?|depends on|condition|conditions|properties|invariants?|safe and idempotent|idempotent|greater than|less than|equal to|temporarily changes)\b/i.test(lower);

    // Feature D: Comparative / Contrastive relations
    const hasComparisonRelation = /\b(in contrast|compared to|difference between|neither .* nor|whereas|while|faster than|slower than|preferred over|differs? from|unlike|similar to)\b/i.test(lower);

    // Feature E: Observational / Demonstrative / Deictic Teaching cues
    const hasDemonstrative = /\b(look at|notice (?:what happens|that|how)|observe (?:that|how)|see (?:what happens|that|how)|here we (?:see|have|notice)|consider (?:this|the|an?)|suppose (?:we|that)|let us (?:see|examine|trace|look)|trace (?:through|the)|given (?:an?|the)|for example|for instance)\b/i.test(lower);

    // Feature F: Worked Trace / Example markers
    const hasTraceExample = /\[[0-9,\s]+\]|\b(pivot|example|trace|step|produces)\b/i.test(lower);

    // Feature G: Socratic Instructional Questions
    const hasSocraticCurricular = /\b(what happens (?:to|if|when)|why does|why do we|how does|can the|what is the effect of)\b/i.test(lower);

    // Check sentence length and substance (avoid 1-2 word conversational fillers)
    const words = seg.split(/\s+/).filter(Boolean);
    const hasSubstantiveLength = words.length >= 4;

    const hasInstructionalSignal = hasDefRelation || hasMechRelation || hasRuleRelation || hasComparisonRelation || hasDemonstrative || hasTraceExample || hasSocraticCurricular;

    if (hasInstructionalSignal && hasSubstantiveLength) {
      const substanceType = hasDefRelation ? 'DEFINITION_OR_FACT'
        : (hasMechRelation ? 'MECHANISM'
        : (hasRuleRelation ? 'RULE_OR_CONDITION'
        : (hasComparisonRelation ? 'COMPARISON'
        : (hasDemonstrative ? 'OBSERVATION_DEMONSTRATION'
        : (hasTraceExample ? 'WORKED_EXAMPLE' : 'SOCRATIC_INSTRUCTION')))));

      const extractedConcepts = this._extractConceptsFromSegment(seg);

      return {
        type: 'CURRICULAR',
        substanceType,
        matchedTerms: extractedConcepts,
        reason: 'Presents assessable instructional content with substantive conceptual or operational predicate',
        confidence: 'HIGH'
      };
    }

    // Contextual continuity: If previous segment was a demonstrative cue ("Look at this graph"), and this segment describes the behavior ("Notice what happens when we increase the input"), it is curricular.
    if (prevSeg && (prevSeg.toLowerCase().includes('look at') || prevSeg.toLowerCase().includes('notice') || prevSeg.toLowerCase().includes('observe')) && hasSubstantiveLength) {
      const extractedConcepts = this._extractConceptsFromSegment(seg);
      return {
        type: 'CURRICULAR',
        substanceType: 'OBSERVATION_DEMONSTRATION',
        matchedTerms: extractedConcepts,
        reason: 'Instructional continuity following demonstrative guidance',
        confidence: 'MEDIUM'
      };
    }

    return {
      type: 'GENERAL_TEXT',
      reason: 'Standard conversational text without instructional substance',
      confidence: 'MEDIUM'
    };
  }

  /**
   * Extract key subject nouns or domain concept entities from an instructional segment.
   * Works across CS, Mathematics, English Grammar, Sciences, and emerging topics.
   */
  _extractConceptsFromSegment(seg) {
    if (!seg) return [];
    const concepts = [];

    // 1. Prominent Acronyms (e.g., MCP, CNN, HTTP, LLM, API, CPU, DNA, RNA)
    const acronyms = seg.match(/\b[A-Z]{2,}\b/g) || [];
    acronyms.forEach(a => {
      if (!['THE', 'FOR', 'AND', 'ARE', 'THIS', 'THAT', 'WITH', 'NOT', 'BUT', 'FROM'].includes(a)) {
        concepts.push(a);
      }
    });

    // 2. Definitional Subject: "X is a Y", "X means Y", "A pronoun is used...", "MCP provides..."
    const defMatch = seg.match(/(?:^|\b(?:a|an|the)\s+)([A-Za-z0-9\s\-]+?)\s+(?:is an?|are(?: words)?|means|refers to|stands for|provides|applies|consists of|differs from)/i);
    if (defMatch && defMatch[1]) {
      const rawSubject = defMatch[1].trim();
      if (rawSubject.length > 2 && rawSubject.length < 40) {
        const cleaned = rawSubject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        concepts.push(cleaned);
      }
    }

    // 3. Technical / Subject compound noun phrases
    const nounPhraseRegex = /\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(?:algorithm|layers?|filters?|protocols?|numbers?|words?|spaces?|functions?|methods?|structures?|models?|elements?|inputs?|outputs?|vectors?|graphs?|nodes?|trees?)/gi;
    let npMatch;
    while ((npMatch = nounPhraseRegex.exec(seg)) !== null) {
      if (npMatch[0] && npMatch[0].length > 3 && npMatch[0].length < 40) {
        const cleaned = npMatch[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        concepts.push(cleaned);
      }
    }

    // 4. Prominent Capitalized Words / Quoted Terms
    const quoted = seg.match(/['"`](.*?)['"`]/g) || [];
    quoted.forEach(q => {
      const strip = q.replace(/['"`]/g, '').trim();
      if (strip.length > 2 && strip.length < 30) {
        concepts.push(strip);
      }
    });

    // Deduplicate and filter generic filler words
    const stopWords = new Set(['today', 'we', 'you', 'let', 'now', 'here', 'first', 'second', 'example', 'step', 'sentence']);
    const deduped = [];
    for (const c of concepts) {
      const lower = c.toLowerCase();
      if (!stopWords.has(lower) && !deduped.some(d => d.toLowerCase() === lower)) {
        deduped.push(c);
      }
    }

    if (deduped.length === 0) {
      // Fallback: take first 2 salient content words of the sentence
      const words = seg.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
      if (words.length > 0) {
        deduped.push(words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));
      }
    }

    return deduped.slice(0, 4);
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
    let prevSeg = null;
    const classifiedSegments = segments.map(seg => {
      const res = {
        text: seg,
        classification: this.classifySegment(seg, prevSeg)
      };
      prevSeg = seg;
      return res;
    });

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
          : (adminSegments.length > 0
            ? 'INSUFFICIENT_CURRICULAR_CONTENT: Non-academic administrative content or casual chatter.'
            : 'INSUFFICIENT_CURRICULAR_CONTENT: Standard conversational speech without domain instructional substance.'));

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
        focusSet.add(t);
      });
    });

    const detectedFocus = Array.from(focusSet).slice(0, 6);
    if (detectedFocus.length === 0) detectedFocus.push('Instructional Content');

    // Procedural and depth signals evaluated on curricular content
    const curricularText = curricularSegments.map(s => s.text).join(' ');
    const lowerCurricular = curricularText.toLowerCase();

    const hasDef = curricularSegments.some(s => s.classification.substanceType === 'DEFINITION_OR_FACT');
    const hasMech = curricularSegments.some(s => s.classification.substanceType === 'MECHANISM');
    const hasRule = curricularSegments.some(s => s.classification.substanceType === 'RULE_OR_CONDITION');
    const hasComp = curricularSegments.some(s => s.classification.substanceType === 'COMPARISON');
    const hasTrace = curricularSegments.some(s => s.classification.substanceType === 'WORKED_EXAMPLE' || s.classification.substanceType === 'OBSERVATION_DEMONSTRATION');

    // Compute characteristic dimensions
    const conceptExp = (hasDef || hasMech) ? (curricularSegments.length > 2 ? 'Strong' : 'Moderate') : 'Developing';
    const reasonMarkers = ['because', 'therefore', 'why', 'in order to', 'leads to', 'results in', 'prevents', 'eliminates', 'so that'];
    const reasonCount = reasonMarkers.filter(m => lowerCurricular.includes(m)).length;
    const reasoning = reasonCount >= 2 ? 'Strong' : (reasonCount >= 1 ? 'Moderate' : 'Light');

    const exampleMarkers = ['for example', 'for instance', 'consider', 'suppose', 'like when', 'example', 'trace', 'given array', 'notice', 'look at'];
    const hasExamples = exampleMarkers.some(m => lowerCurricular.includes(m)) || hasTrace;
    const examples = hasExamples ? 'Present' : 'Light';

    const procMarkers = ['first', 'second', 'third', 'finally', 'then', 'step', 'after', 'before', 'pauses', 'transfers', 'restores', 'resumes', 'next'];
    const procCount = procMarkers.filter(m => lowerCurricular.includes(m)).length;
    const procedures = procCount >= 3 ? 'Strong' : (procCount >= 1 ? 'Moderate' : 'Light');

    let depthScore = 45;
    if (conceptExp === 'Strong') depthScore += 12;
    if (reasoning === 'Strong') depthScore += 12;
    else if (reasoning === 'Moderate') depthScore += 6;
    if (examples === 'Present') depthScore += 12;
    if (procedures === 'Strong') depthScore += 15;
    else if (procedures === 'Moderate') depthScore += 8;
    if (curricularSegments.length >= 4) depthScore += 10;

    depthScore = Math.min(100, Math.max(40, depthScore));
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
