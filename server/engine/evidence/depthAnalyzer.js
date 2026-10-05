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

    // Feature H: Procedural / Sequencing / State Execution relations
    const hasProcRelation = /\b(first(?:ly)?,|second(?:ly)?,|third(?:ly)?,|finally,|next,|step \d+|in the (?:first|next|final) step|pauses?|saves?|transfers?|restor(?:es|ed|ing)?|resum(?:es|ed|ing)?|fetch(?:es|ed|ing)?)\b/i.test(lower);

    // Check sentence length and substance (avoid 1-2 word conversational fillers)
    const words = seg.split(/\s+/).filter(Boolean);
    const hasSubstantiveLength = words.length >= 4;

    const hasInstructionalSignal = hasDefRelation || hasMechRelation || hasRuleRelation || hasComparisonRelation || hasDemonstrative || hasTraceExample || hasSocraticCurricular || hasProcRelation;

    if (hasInstructionalSignal && hasSubstantiveLength) {
      const substanceType = hasDefRelation ? 'DEFINITION_OR_FACT'
        : (hasMechRelation ? 'MECHANISM'
        : (hasRuleRelation ? 'RULE_OR_CONDITION'
        : (hasComparisonRelation ? 'COMPARISON'
        : (hasProcRelation ? 'PROCEDURAL_STEP'
        : (hasDemonstrative ? 'OBSERVATION_DEMONSTRATION'
        : (hasTraceExample ? 'WORKED_EXAMPLE' : 'SOCRATIC_INSTRUCTION'))))));

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
   * Helper to clean, strip leading prepositions/articles, and validate that a phrase
   * is a genuine academic/curricular concept rather than conversational clutter.
   */
  _cleanConceptPhrase(raw) {
    if (!raw) return '';
    const conversationalStopwords = new Set([
      'today', 'tomorrow', 'yesterday', 'quickly', 'through', 'understand', 'understanding',
      'know', 'knowing', 'let', 'lets', 'now', 'here', 'there', 'first', 'second', 'third',
      'step', 'sentence', 'example', 'look', 'looks', 'looking', 'going', 'talk', 'talking',
      'about', 'discuss', 'discussing', 'thing', 'things', 'stuff', 'really', 'actually',
      'basically', 'simply', 'maybe', 'probably', 'class', 'lecture', 'sir', 'maam', 'okay',
      'alright', 'everyone', 'everybody', 'student', 'students', 'teacher', 'we', 'you',
      'they', 'this', 'that', 'these', 'those', 'what', 'which', 'where', 'when', 'why',
      'how', 'come', 'coming', 'came', 'take', 'taking', 'took', 'give', 'giving', 'gave',
      'tell', 'telling', 'told', 'write', 'writing', 'wrote', 'make', 'making', 'made',
      'want', 'wanting', 'need', 'needing', 'feel', 'feeling', 'think', 'thinking', 'thought',
      'show', 'showing', 'seen', 'mean', 'means', 'meaning', 'case', 'cases', 'part', 'parts',
      'well', 'just', 'also', 'even', 'much', 'more', 'most', 'very', 'like', 'good', 'way',
      'yes', 'yeah', 'no', 'so', 'into', 'onto', 'from', 'with', 'by', 'some', 'our', 'your'
    ]);

    const genericSingleWords = new Set([
      'model', 'models', 'element', 'elements', 'input', 'inputs', 'output', 'outputs',
      'number', 'numbers', 'word', 'words', 'structure', 'structures', 'method', 'methods',
      'thing', 'things', 'way', 'ways', 'case', 'cases', 'part', 'parts', 'step', 'steps',
      'example', 'examples', 'time', 'times', 'type', 'types', 'item', 'items', 'value', 'values',
      'image', 'images', 'data', 'code'
    ]);

    const weakModifiers = new Set([
      'smaller', 'larger', 'bigger', 'exact', 'same', 'different', 'original', 'entire', 'whole',
      'actual', 'given', 'certain', 'particular', 'single', 'multiple', 'final', 'initial'
    ]);

    let phrase = raw.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    
    // Strip conversational, prepositional, and auxiliary prefixes iteratively
    const prefixRegex = /^(?:the|a|an|about|to|in|for|of|and|or|but|if|then|so|yes|yeah|no|into|onto|from|with|by|some|our|your|let|lets|we|you|now|just|well|look|looks|see|what|which|when|where|why|how|this|that|these|those|there|here|i\s+think|you\s+know|is|are|was|were|be|been|being|have|has|had)\s+/i;
    while (prefixRegex.test(phrase)) {
      phrase = phrase.replace(prefixRegex, '').trim();
    }
    phrase = phrase.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
    if (phrase.length < 3) return '';

    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) return '';

    // Reject if single generic word or single conversational stop word
    if (words.length === 1 && (genericSingleWords.has(words[0].toLowerCase()) || conversationalStopwords.has(words[0].toLowerCase()))) {
      return '';
    }

    // Reject combinations like "smaller elements", "exact input" where modifier is weak adjective and head is generic noun
    if (words.length === 2 && weakModifiers.has(words[0].toLowerCase()) && genericSingleWords.has(words[1].toLowerCase())) {
      return '';
    }

    // Reject if all words are conversational stop words
    if (words.every(w => conversationalStopwords.has(w.toLowerCase()))) return '';

    // Reject if first word is a conversational filler verb or adverb
    if (conversationalStopwords.has(words[0].toLowerCase())) return '';

    // Reject if last word is a conversational stop word
    if (conversationalStopwords.has(words[words.length - 1].toLowerCase())) return '';

    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Extract key subject nouns or domain concept entities from an instructional segment.
   * Works across CS, Mathematics, English Grammar, Sciences, and emerging topics.
   */
  _extractConceptsFromSegment(seg) {
    if (!seg) return [];
    const concepts = [];

    // 1. Prominent Acronyms (e.g., DAA, BST, AVL, ACID, TCP, IP, CPU, API, SQL)
    const acronyms = seg.match(/\b[A-Z]{2,}\b/g) || [];
    acronyms.forEach(a => {
      if (!['THE', 'FOR', 'AND', 'ARE', 'THIS', 'THAT', 'WITH', 'NOT', 'BUT', 'FROM', 'CAN', 'ALL', 'OUT', 'HOW', 'WHY', 'YES', 'NOW'].includes(a)) {
        concepts.push(a);
      }
    });

    // 2. Definitional Subject: "X is a Y", "X means Y", "A spanning tree is..."
    const defMatch = seg.match(/(?:^|\b(?:a|an|the)\s+)([A-Za-z0-9\s\-]+?)\s+(?:is an?|are(?: words)?|means|refers to|stands for|provides|applies|consists of|differs from)/i);
    if (defMatch && defMatch[1]) {
      const cleaned = this._cleanConceptPhrase(defMatch[1]);
      if (cleaned) concepts.push(cleaned);
    }

    // 3. Technical / Subject compound noun phrases
    const nounPhraseRegex = /\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(?:algorithm|layers?|filters?|protocols?|numbers?|words?|spaces?|functions?|methods?|structures?|models?|elements?|inputs?|outputs?|vectors?|graphs?|nodes?|trees?|complexity|matrices|arrays?)/gi;
    let npMatch;
    while ((npMatch = nounPhraseRegex.exec(seg)) !== null) {
      if (npMatch[0] && npMatch[0].length > 3 && npMatch[0].length < 40) {
        const cleaned = this._cleanConceptPhrase(npMatch[0]);
        if (cleaned) concepts.push(cleaned);
      }
    }

    // 4. Prominent Capitalized Words / Quoted Terms
    const quoted = seg.match(/['"`](.*?)['"`]/g) || [];
    quoted.forEach(q => {
      const strip = q.replace(/['"`]/g, '').trim();
      const cleaned = this._cleanConceptPhrase(strip);
      if (cleaned) concepts.push(cleaned);
    });

    // 5. High-Value Academic Bigrams & Domain Terms
    const academicBigramRegex = /\b(auto\s*encoders?|convolutional\s+auto\s*encoders?|latent\s+space|reconstruction\s+loss|dense\s+layers?|max\s+pooling|up\s*sampling|down\s*sampling|activation\s+function|mean\s+squared\s+error|loss\s+function|feature\s+extraction|spatial\s+patterns?|greedy\s+\w+|spanning\s+trees?|minimum\s+cost|dynamic\s+programming|binary\s+search|page\s+fault|virtual\s+memory|acid\s+properties|transaction\s+isolation|sliding\s+window|depth\s+first|breadth\s+first|time\s+complexity|space\s+complexity)\b/gi;
    let abMatch;
    while ((abMatch = academicBigramRegex.exec(seg)) !== null) {
      const cleaned = this._cleanConceptPhrase(abMatch[0]);
      if (cleaned) concepts.push(cleaned);
    }

    // Deduplicate and filter generic filler words with stem normalization
    const deduped = [];
    const seenStems = new Set();
    for (const c of concepts) {
      const stem = c.toLowerCase().replace(/s$/, '');
      if (!seenStems.has(stem)) {
        seenStems.add(stem);
        deduped.push(c);
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
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' },
          breakdown: {
            earnedRubric: [
              { category: 'Baseline Curricular Substance', earned: 10, max: 40, status: 'Failed', description: 'No assessable instructional curriculum detected.' },
              { category: 'Concept Definition & Explanation', earned: 0, max: 15, status: 'None', description: 'No concepts defined.' },
              { category: 'Causal Reasoning & Invariants', earned: 0, max: 15, status: 'None', description: 'No reasoning detected.' },
              { category: 'Concrete Examples & Traces', earned: 0, max: 15, status: 'None', description: 'No examples detected.' },
              { category: 'Procedural Sequencing', earned: 0, max: 15, status: 'None', description: 'No procedures detected.' }
            ],
            deductions: [
              {
                factor: 'Non-Curricular Content',
                lostPoints: 90,
                maxPoints: 100,
                earnedPoints: 10,
                reason: reason,
                actionableTip: 'Ensure the speech or document contains assessable engineering curriculum, definitions, or algorithms.'
              }
            ],
            totalLostPoints: 90,
            coveredAspects: [],
            missingAspects: ['Assessable subject matter curriculum', 'Definitions', 'Reasoning', 'Examples'],
            actionableTips: ['Teach specific academic subject matter rather than classroom administration or general conversation.'],
            recommendedQuestionCount: 0,
            recommendedQuestionsRationale: 'Cannot generate questions: No curricular substance detected.'
          }
        },
        detectedFocus: [],
        curricularSegments: [],
        pedagogicalSegments,
        adminSegments
      };
    }

    // Extract detected focus concepts strictly from CURRICULAR segments ranked by occurrence frequency
    const termFreq = new Map();
    curricularSegments.forEach(s => {
      (s.classification.matchedTerms || []).forEach(t => {
        const normKey = t.toLowerCase().replace(/\s+/g, ' ').replace(/s$/, '');
        const current = termFreq.get(normKey) || { term: t, count: 0 };
        current.count += 1;
        if (t.length > current.term.length) current.term = t;
        termFreq.set(normKey, current);
      });
    });

    const sortedTerms = Array.from(termFreq.values())
      .sort((a, b) => b.count - a.count)
      .map(entry => entry.term);

    const detectedFocus = sortedTerms.slice(0, 6);
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

    const basePoints = 40;
    const conceptPoints = conceptExp === 'Strong' ? 15 : (conceptExp === 'Moderate' ? 8 : 0);
    const reasoningPoints = reasoning === 'Strong' ? 15 : (reasoning === 'Moderate' ? 8 : 0);
    const examplePoints = examples === 'Present' ? 15 : 0;
    const procedurePoints = procedures === 'Strong' ? 15 : (procedures === 'Moderate' ? 8 : 0);

    let depthScore = basePoints + conceptPoints + reasoningPoints + examplePoints + procedurePoints;
    depthScore = Math.min(100, Math.max(40, depthScore));

    const deductions = [];

    if (conceptPoints < 15) {
      deductions.push({
        factor: 'Concept Definition & Mechanistic Depth',
        lostPoints: 15 - conceptPoints,
        maxPoints: 15,
        earnedPoints: conceptPoints,
        reason: conceptExp === 'Moderate'
          ? 'Foundational definitions were introduced, but deeper operational mechanics and transformations were not elaborated.'
          : 'Explicit ontological definitions (e.g. "X is a...", "X refers to...") or operational verbs were minimal.',
        actionableTip: 'Provide formal textbook definitions for all key terms and describe the exact mechanistic operations they perform.'
      });
    }

    if (reasoningPoints < 15) {
      deductions.push({
        factor: 'Causal Reasoning & Invariants',
        lostPoints: 15 - reasoningPoints,
        maxPoints: 15,
        earnedPoints: reasoningPoints,
        reason: reasoning === 'Moderate'
          ? 'Causal justification was brief. Only 1 causal connector ("because", "so that", "in order to") was detected.'
          : 'Zero causal reasoning links were detected. Explanations described what happens rather than why it happens or what invariants are maintained.',
        actionableTip: 'Use explicit causal connectors ("because", "therefore", "so that", "prevents") to explain why algorithms or design choices exist.'
      });
    }

    if (examplePoints < 15) {
      deductions.push({
        factor: 'Concrete Examples & Worked Traces',
        lostPoints: 15 - examplePoints,
        maxPoints: 15,
        earnedPoints: examplePoints,
        reason: 'Concrete examples, sample inputs/outputs, worked traces, or illustrative demonstrations were missing.',
        actionableTip: 'Include at least one concrete worked example, sample dataset walkthrough, or code trace to ground abstract principles.'
      });
    }

    if (procedurePoints < 15) {
      deductions.push({
        factor: 'Procedural Execution & Algorithmic Sequencing',
        lostPoints: 15 - procedurePoints,
        maxPoints: 15,
        earnedPoints: procedurePoints,
        reason: procedures === 'Moderate'
          ? 'Procedural progression was partial. Only limited chronological execution markers were found.'
          : 'Sequential execution stages or algorithmic transitions were not explicitly sequenced.',
        actionableTip: 'Structure procedures with clear chronological steps (e.g., "First, ..., Then, ..., Next, ..., Finally, ...").'
      });
    }

    const totalLostPoints = deductions.reduce((sum, d) => sum + d.lostPoints, 0);

    const coveredAspects = [];
    if (detectedFocus.length > 0) {
      coveredAspects.push(`Core topics covered: ${detectedFocus.join(', ')}`);
    }
    if (hasDef) {
      coveredAspects.push('Explicit concept definitions and ontological characterizations');
    }
    if (hasMech) {
      coveredAspects.push('Operational mechanisms and functional transformation processes');
    }
    if (hasRule) {
      coveredAspects.push('Invariants, conditional boundaries, and operational rules');
    }
    if (hasComp) {
      coveredAspects.push('Comparative contrasts and structural distinctions');
    }
    if (examples === 'Present') {
      coveredAspects.push('Concrete examples, observational walkthroughs, or worked traces');
    }
    if (procedures === 'Strong') {
      coveredAspects.push('Step-by-step procedural workflow and algorithmic sequencing');
    } else if (procedures === 'Moderate') {
      coveredAspects.push('Introductory procedural progression');
    }
    if (reasoning === 'Strong') {
      coveredAspects.push('Deep causal reasoning with explicit explanations of why rules apply');
    } else if (reasoning === 'Moderate') {
      coveredAspects.push('Foundational causal explanations');
    }

    const missingAspects = [];
    if (reasoningPoints < 15) {
      missingAspects.push('Causal depth: deeper explanation of why mechanisms behave as they do');
    }
    if (examplePoints < 15) {
      missingAspects.push('Concrete worked traces, sample code, or practical illustrative examples');
    }
    if (procedurePoints < 15) {
      missingAspects.push('Explicit multi-step procedural progression (first, then, step-by-step lifecycle)');
    }
    if (conceptPoints < 15) {
      missingAspects.push('Formal textbook definitions and complete operational mechanisms');
    }

    const actionableTips = deductions.map(d => d.actionableTip);
    if (actionableTips.length === 0) {
      actionableTips.push('Outstanding pedagogical delivery! All core rubric dimensions (definitions, causal reasoning, worked examples, procedural sequencing) are thoroughly demonstrated.');
    }

    // Recommended Question Count calculation
    const wordCount = curricularText.split(/\s+/).filter(Boolean).length;
    let recCount = 5;
    let rationale = '';

    if (curricularSegments.length <= 2 || wordCount < 150) {
      recCount = 3;
      rationale = '3 Questions: Compact curricular substance. Best for a quick conceptual check without redundant targets.';
    } else if (curricularSegments.length <= 5 || wordCount < 500) {
      recCount = 5;
      rationale = '5 Questions: Covers core definitions and primary mechanisms with balanced cognitive depth.';
    } else if (curricularSegments.length <= 9 || wordCount < 1200) {
      recCount = 8;
      rationale = '8 Questions: Optimal for this substantive lecture. Thoroughly assesses concepts, procedural traces, and causal reasoning.';
    } else {
      recCount = 10;
      rationale = '10 Questions: Rich multi-topic lecture. Enables broad coverage across foundational concepts, application, and edge cases.';
    }

    let rating = 'Developing';
    if (depthScore < 60 || curricularSegments.length <= 2) rating = 'Introductory';
    else if (depthScore >= 75) rating = 'Comprehensive';
    else rating = 'Developing';

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
        },
        breakdown: {
          earnedRubric: [
            { category: 'Baseline Curricular Substance', earned: basePoints, max: 40, status: 'Earned', description: 'Verified assessable curriculum concepts with substantive instructional predicate.' },
            { category: 'Concept Definition & Explanation', earned: conceptPoints, max: 15, status: conceptExp, description: conceptExp === 'Strong' ? 'Comprehensive conceptual definitions and operational mechanisms.' : (conceptExp === 'Moderate' ? 'Introductory definitions present; could use deeper formal elaboration.' : 'Limited or missing definitions.') },
            { category: 'Causal Reasoning & Invariants', earned: reasoningPoints, max: 15, status: reasoning, description: reasoning === 'Strong' ? 'Explicit causal justifications and operational rationale (answering why).' : (reasoning === 'Moderate' ? 'Basic causal reasoning detected.' : 'No causal links detected.') },
            { category: 'Concrete Examples & Traces', earned: examplePoints, max: 15, status: examples, description: examples === 'Present' ? 'Practical examples, worked traces, or demonstrations.' : 'Missing concrete sample traces or demonstrations.' },
            { category: 'Procedural Sequencing', earned: procedurePoints, max: 15, status: procedures, description: procedures === 'Strong' ? 'Detailed multi-step algorithmic or procedural progression.' : (procedures === 'Moderate' ? 'Basic procedural steps present.' : 'Sequential procedural steps missing.') }
          ],
          deductions,
          totalLostPoints,
          coveredAspects,
          missingAspects,
          actionableTips,
          recommendedQuestionCount: recCount,
          recommendedQuestionsRationale: rationale
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
