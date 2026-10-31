/**
 * server/config/kmitStyleContract.js
 *
 * KMIT KAHOOT ASSESSMENT SIGNATURE STYLE CONTRACT (v1.2)
 *
 * Defines the canonical product voice, pedagogical standards, and cross-subject
 * exemplars for multiple-choice assessment generation across KMIT Kahoot.
 *
 * GOVERNING PHILOSOPHY: "Think, Don't Guess"
 * - The product speaks with the voice of an authoritative, fair university examiner.
 * - Assessment items prioritize clear, problem-first questions grounded strictly in taught evidence.
 * - Style standards govern form, clarity, and conciseness; they NEVER substitute for evidence grounding
 *   or genuine cognitive evaluation.
 *
 * KEY REVISIONS IN v1.2:
 * - Anti-permutation & vocabulary overlap converted to advisory warnings (warnings[]), preventing
 *   false-positive rejection of valid options with similar technical wording.
 * - Removed unrelated fallback in getExemplarForSubject(): returns null for unknown, ambiguous,
 *   or non-technical domains to prevent subject-matter contamination.
 * - Subject-selection precedence: evidencePackage.subject is the authoritative primary signal.
 *   Subtopics/topics cannot override declared subjects (e.g. biology subtopic with "code" never gets CS).
 * - Explicit prompt decoupling: canonical exemplars teach style and tone ONLY; exemplar subject
 *   matter, answer keys, and difficulty tiers must never constrain active generation.
 * - Planner guidance decoupled from difficulty routing: provides quality and clarity reminders
 *   without overriding curriculum intelligence, Bloom mapping, or teacher difficulty allocation.
 * - Heuristic checker returns { passesStyle, issues, warnings, standardsVersion }.
 */

'use strict';

const KMIT_STYLE_CONTRACT = {
  version: '1.3.0',
  name: 'KMIT Kahoot Assessment Signature Style',
  philosophy: "Think, Don't Guess: Problem-first challenge grounded strictly in taught evidence.",

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SPECIFICATION STANDARDS (ADVISORY VS. ENFORCEABLE)
  // ──────────────────────────────────────────────────────────────────────────
  standards: {
    // Advisory targets provided to Planner and Generator prompts
    advisory: {
      stemTargetWords: 25, // Target max for question stem (excluding code snippets or data tables)
      optionLengthTarget: '3 to 12 words per option',
      optionLengthRatioTarget: 2.0, // Longest-to-shortest option length ratio ideally <= 2.0x
      styleTone: 'Crisp, direct, student-accessible phrasing. Pose the technical question immediately. Eliminate academic boilerplate, verbose throat-clearing, and meta-language.'
    },
    // Mechanically enforceable heuristic thresholds checked by checkStyleHeuristics()
    enforceable: {
      stemHardWordLimit: 55, // Generous upper bound to catch runaway paragraphs while allowing technical setup
      optionMinWords: 1,     // Minimum tokens per option
      optionMaxWords: 20,    // Upper boundary before option is flagged as runaway explanatory text
      optionLengthRatioCeiling: 3.5, // Flags obvious giveaway outlier options (e.g., 20 words vs 2 words)
      maxWordJaccardSimilarity: 0.85 // Advisory threshold to flag potential near-duplicate or permuted options
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STEM & META-LANGUAGE RULES
  // ──────────────────────────────────────────────────────────────────────────
  stem: {
    // Prohibited meta-discourse patterns checked anywhere in stem (beginning, middle, or end)
    prohibitedMetaPatterns: [
      /\baccording to the (?:lecture|transcript|speaker|notes|slides|syllabus)\b/i,
      /\bas (?:discussed|taught|covered|stated) in the (?:lecture|session|class|slides|transcript|syllabus)\b/i,
      /\bas explained by the (?:speaker|instructor|professor|teacher)\b/i,
      /\bwhich of the following was (?:mentioned|discussed|covered)\b/i,
      /\bwhich topic (?:was|is) covered\b/i,
      /\b(?:in the context of the|in the|based on the|from the)\s+(?:lecture|transcript)\b(?!\s*[-–—]?\s*(?:hall|room|setting|venue|interval))/i,
      /\b(?:operational mechanics|foundational premise|substantive paradigm|overarching framework)\b/i,
      /\b(?:in order to ascertain|it is imperative to determine|with reference to the aforementioned)\b/i
    ],
    prohibitedMetaPrefixes: [
      /^(?:according to the lecture|as discussed in the lecture|in the lecture|based on the lecture|as taught in the lecture|according to the transcript)[,\s:]*/i,
      /^(?:according to the notes|as explained by the speaker|as stated in the slides|as covered in the syllabus)[,\s:]*/i,
      /^(?:which of the following was mentioned|which of the following was discussed|which topic is covered)[,\s:]*/i
    ],
    // Clarification: Technical reference or legitimate scenario context is permitted.
    // e.g. "Given a 4-stage pipelined processor...", "In a closed economy with floating exchange rates..."
    allowTechnicalContext: true
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. OPTIONAL DISTRACTOR STRATEGIES (NON-MANDATORY PATTERNS)
  // ──────────────────────────────────────────────────────────────────────────
  suggestedDistractorStrategies: [
    {
      code: 'MISCONCEPTION_INVERSION',
      name: 'Conceptual Misconception / Role Inversion',
      description: 'Swaps inverse roles, causal directions, or parameters (e.g., caller vs. callee, producer vs. consumer, fiscal vs. monetary stimulus).'
    },
    {
      code: 'SCOPE_PRECONDITION_ERROR',
      name: 'Scope / Boundary Condition Error',
      description: 'Applies an otherwise valid operational rule outside its boundary conditions (e.g., assuming contiguous allocation in paging, assuming constant returns to scale).'
    },
    {
      code: 'ASYMPTOTIC_BOUNDARY_TRAP',
      name: 'Boundary Condition / Scaling Trap',
      description: 'Tests terminal conditions, off-by-one bounds, or asymptotic scaling differences (e.g., O(n) vs O(1), null-tail dereference).'
    },
    {
      code: 'NEAR_MISS_MECHANISM',
      name: 'Near-Miss / Adjacent Concept',
      description: 'Attributes an observed outcome to an adjacent, real concept from the same curriculum rather than the true causal agent.'
    }
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // 4. VERIFIED CROSS-SUBJECT EXEMPLARS (WITH EXPLICIT MODEL ASSUMPTIONS)
  // ──────────────────────────────────────────────────────────────────────────
  exemplars: [
    {
      id: 'EXEMPLAR_ALGORITHMIC',
      subjectArea: 'Computer Science & Engineering',
      domainKey: 'cs_code',
      subtopic: 'Singly Linked List In-Place Deletion',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE',
      strategyTag: 'ASYMPTOTIC_BOUNDARY_TRAP',
      evidenceBasis: 'Standard in-place singly linked list node deletion by copying successor values when head pointer is unavailable.',
      questionText: 'In a singly linked list, an in-place deletion algorithm copies the successor node\'s data into the target node and unlinks the successor. Under which condition does this technique fail to preserve list integrity?',
      options: [
        'The target node contains duplicate payload data matching its predecessor.',
        'The target node is the terminal node (tail) of the list.',
        'The list contains an odd number of total allocated nodes.',
        'The target node was dynamically allocated on the heap rather than the runtime stack.'
      ],
      correctAnswer: 'The target node is the terminal node (tail) of the list.',
      correctAnswerIndex: 1,
      explanation: 'The O(1) successor-copying deletion copies target->next->data into target and unlinks target->next. If target is the tail node, target->next is null, leaving no successor node to copy and causing an invalid null dereference or leaving a dangling pointer.',
      distractorRationales: {
        'The target node contains duplicate payload data matching its predecessor.': 'Misconception: Confuses value equality with pointer structural identity. Duplicate values do not alter link manipulation.',
        'The list contains an odd number of total allocated nodes.': 'False Boundary Trap: Confuses list parity (used in two-pointer cycle detection) with single-node unlinking preconditions.',
        'The target node was dynamically allocated on the heap rather than the runtime stack.': 'Scope Error: Pointer link semantics operate identically regardless of whether nodes reside in heap or stack memory.'
      }
    },
    {
      id: 'EXEMPLAR_SYSTEMS',
      subjectArea: 'Operating Systems & Concurrency',
      domainKey: 'systems',
      subtopic: 'Counting Semaphores State Transitions',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'TRACE',
      strategyTag: 'MISCONCEPTION_INVERSION',
      evidenceBasis: 'Standard counting semaphore state definition where negative counter values denote the exact count of waiting blocked threads.',
      questionText: 'A counting semaphore initialized to 2 has five threads sequentially call wait() with no signal() calls. If negative values count waiting threads, what is the resulting semaphore state?',
      options: [
        'Semaphore value is 0, and all five threads are placed in the blocked waiting queue.',
        'Semaphore value is -3, and three threads are placed in the blocked waiting queue.',
        'Semaphore value is -5, and two threads continue execution concurrently.',
        'Semaphore value resets to 2 through automatic operating system deadlock recovery.'
      ],
      correctAnswer: 'Semaphore value is -3, and three threads are placed in the blocked waiting queue.',
      correctAnswerIndex: 1,
      explanation: 'The first two wait() operations decrement the semaphore value to 1 and 0, granting immediate access. The remaining three wait() calls decrement the value to -1, -2, and -3, placing each of those three threads into the blocked waiting queue.',
      distractorRationales: {
        'Semaphore value is 0, and all five threads are placed in the blocked waiting queue.': 'Misconception: Assumes semaphore counters clamp at 0 and blocks all calling threads, ignoring the initial positive capacity of 2.',
        'Semaphore value is -5, and two threads continue execution concurrently.': 'Arithmetic Inversion: Applies all 5 decrements below zero while paradoxically claiming the first 2 threads succeeded.',
        'Semaphore value resets to 2 through automatic operating system deadlock recovery.': 'Near-Miss Architecture Error: Confuses low-level synchronization primitives with external deadlock monitoring frameworks; primitive semaphores never auto-reset.'
      }
    },
    {
      id: 'EXEMPLAR_APPLIED_THEORY',
      subjectArea: 'Economics & Financial Systems',
      domainKey: 'applied_theory',
      subtopic: 'Fractional-Reserve Banking & Reserve Ratios',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE',
      strategyTag: 'SCOPE_PRECONDITION_ERROR',
      evidenceBasis: 'Simple money multiplier model (M = 1 / r) with constant base reserves, assuming zero excess reserves and zero public cash drain.',
      questionText: 'Under fractional-reserve banking (M = 1 / r) with constant base reserves, the statutory reserve ratio is raised from 10% to 20%. What is the effect on lending capacity and the maximum theoretical money multiplier?',
      options: [
        'Lending capacity expands because banks hold greater total reserves, doubling the money multiplier to 20.',
        'Lending capacity contracts because mandatory reserves absorb liquidity, halving the maximum money multiplier from 10 to 5.',
        'Lending capacity remains unchanged because the money multiplier depends solely on physical currency circulation velocity.',
        'Lending capacity contracts, but the maximum money multiplier increases to compensate for lower total loan issuance.'
      ],
      correctAnswer: 'Lending capacity contracts because mandatory reserves absorb liquidity, halving the maximum money multiplier from 10 to 5.',
      correctAnswerIndex: 1,
      explanation: 'Under M = 1 / r, increasing r from 0.10 to 0.20 reduces M from 10 to 5. Higher reserve requirements convert previously excess lendable reserves into mandatory immobilized reserves, directly contracting commercial lending capacity.',
      distractorRationales: {
        'Lending capacity expands because banks hold greater total reserves, doubling the money multiplier to 20.': 'Causal Inversion: Confuses mandated reserve immobilizations with discretionary loan capital; higher reserves restrict credit creation rather than expanding it.',
        'Lending capacity remains unchanged because the money multiplier depends solely on physical currency circulation velocity.': 'Scope Error: Confuses the velocity of money (MV = PY) with deposit credit-creation mechanisms determined by reserve fractions.',
        'Lending capacity contracts, but the maximum money multiplier increases to compensate for lower total loan issuance.': 'Contradictory Mechanics: Concedes the directional lending contraction but inverts the mathematical relation between reserve ratios and the multiplier coefficient.'
      }
    }
  ],

  _isCsDomain(str) {
    const csKeywords = [
      'computer science', 'software engineering', 'programming',
      'code', 'c++', 'java', 'python', 'javascript', 'typescript', 'c#', 'rust', 'golang',
      'data structure', 'algorithm', 'pointer', 'recursion', 'binary tree', 'graph',
      'compiler', 'oop', 'object-oriented', 'sql', 'database schema'
    ];
    if (csKeywords.some(kw => str.includes(kw))) return true;
    if (/\b(?:cs|compsci|software|coding)\b/i.test(str)) return true;
    return false;
  },

  _isSystemsDomain(str) {
    const systemsKeywords = [
      'operating system', 'kernel', 'thread', 'process', 'concurren', 'semaphore',
      'mutex', 'deadlock', 'scheduling', 'virtual memory', 'paging', 'cache', 'pipeline',
      'processor', 'architecture', 'assembly', 'mips', 'risc-v'
    ];
    if (systemsKeywords.some(kw => str.includes(kw))) return true;
    if (/\b(?:os|sys|concurrency)\b/i.test(str)) return true;
    return false;
  },

  _isEconDomain(str) {
    const econKeywords = [
      'economics', 'microeconomics', 'macroeconomics', 'finance', 'banking', 'monetary',
      'fiscal', 'inflation', 'gdp', 'money multiplier', 'reserve ratio', 'interest rate',
      'elasticity', 'market equilibrium'
    ];
    return econKeywords.some(kw => str.includes(kw));
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DOMAIN-SELECTIVE EXEMPLAR MATCHING (AUTHORITATIVE PRECEDENCE)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Retrieves at most ONE relevant exemplar matching the subject domain.
   * STRICT PRECEDENCE RULES:
   * 1. Primary Signal: Declared subject (evidencePackage.subject). If declared, it governs exclusively.
   *    If declared subject is unmapped (e.g. Biology, Literature), returns null immediately without
   *    inspecting subtopics, preventing accidental keyword collisions (e.g. "genetic code").
   * 2. Secondary Inference: If subject is missing or 'General', inspects topic/subtopic ONLY if
   *    unambiguous. If ambiguous or unmapped, returns null.
   */
  getExemplarForSubject(subjectOrContext, topic = null, subtopic = null) {
    let declaredSubject = '';
    let fallbackTopic = '';

    if (typeof subjectOrContext === 'object' && subjectOrContext !== null) {
      declaredSubject = String(subjectOrContext.subject || '').trim();
      fallbackTopic = String(subjectOrContext.topic || subjectOrContext.subtopic || '').trim();
    } else if (typeof subjectOrContext === 'string') {
      declaredSubject = subjectOrContext.trim();
      fallbackTopic = String(topic || subtopic || '').trim();
    }

    // 1. Authoritative Subject Precedence
    if (declaredSubject && declaredSubject.toLowerCase() !== 'general' && declaredSubject.toLowerCase() !== 'unknown') {
      const subLower = declaredSubject.toLowerCase();

      // Check if authoritative subject is explicitly an unmapped discipline
      const nonTargetSubjects = [
        'bio', 'biology', 'life science', 'zoology', 'botany', 'genetics',
        'literature', 'english', 'history', 'philosophy', 'art', 'music',
        'medicine', 'nursing', 'pharmacy', 'chemistry', 'psychology', 'sociology'
      ];
      if (nonTargetSubjects.some(nts => subLower.includes(nts))) {
        return null;
      }

      if (this._isCsDomain(subLower)) {
        return this.exemplars.find(e => e.id === 'EXEMPLAR_ALGORITHMIC') || null;
      }
      if (this._isSystemsDomain(subLower)) {
        return this.exemplars.find(e => e.id === 'EXEMPLAR_SYSTEMS') || null;
      }
      if (this._isEconDomain(subLower)) {
        return this.exemplars.find(e => e.id === 'EXEMPLAR_APPLIED_THEORY') || null;
      }

      // Unrecognized declared subject returns null; never falls through to subtopics
      return null;
    }

    // 2. Fallback Topic/Subtopic Inference (Only if declared subject is missing or 'General')
    if (fallbackTopic) {
      const topLower = fallbackTopic.toLowerCase();
      const nonTargetTopics = [
        'bio', 'biology', 'genetics', 'cell', 'literature', 'history', 'chemistry'
      ];
      if (nonTargetTopics.some(ntt => topLower.includes(ntt))) {
        return null;
      }

      const matchesCs = this._isCsDomain(topLower);
      const matchesSys = this._isSystemsDomain(topLower);
      const matchesEcon = this._isEconDomain(topLower);

      // Require unambiguous single-domain match
      const matchCount = (matchesCs ? 1 : 0) + (matchesSys ? 1 : 0) + (matchesEcon ? 1 : 0);
      if (matchCount !== 1) {
        return null;
      }

      if (matchesCs) return this.exemplars.find(e => e.id === 'EXEMPLAR_ALGORITHMIC') || null;
      if (matchesSys) return this.exemplars.find(e => e.id === 'EXEMPLAR_SYSTEMS') || null;
      if (matchesEcon) return this.exemplars.find(e => e.id === 'EXEMPLAR_APPLIED_THEORY') || null;
    }

    return null;
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. PIPELINE GUIDANCE GENERATION (ADVISORY ONLY)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Guides Agent 1 (Planner) in formulating assessable conceptual targets.
   * Supplements planning clarity without overriding curriculum intelligence or teacher difficulty.
   */
  getPlannerGuidance({ requestedDifficulty = 'Medium' } = {}) {
    const tier = String(requestedDifficulty || 'Medium').trim();
    return [
      '[KMIT KAHOOT PEDAGOGICAL PLANNER CONTRACT]',
      '1. EVIDENCE PRIMACY: Every planned assessment target must be anchored directly in verifiable evidence from the source material. Never invent concepts outside the provided content.',
      `2. DIFFICULTY ALIGNMENT: Respect the requested difficulty level (${tier}) as determined by curriculum calibration:`,
      '   - Easy: Foundational comprehension, essential definitions, and core domain terminology taught in the material. Avoid trivial metadata (dates, slide numbers, logistics).',
      '   - Medium: Causal mechanisms, operational relationships, comparative distinctions, or applied principles supported by the lecture.',
      '   - Hard: Multi-variable interactions, subtle boundary conditions, diagnostic analysis, or tracing execution under specific constraints.',
      '   - CRITICAL DIFFICULTY PRINCIPLE: An easy question written in a difficult manner is NOT a hard question! Hard questions require genuine multi-step reasoning, trace analysis, or trade-off evaluation. Never disguise an easy recall item with convoluted vocabulary.',
      '3. TARGET INDEPENDENCE: Each target must test a distinct conceptual mechanism. Do not plan redundant targets that merely rephrase the same factual assertion.',
      '4. NON-INTERFERENCE: This guidance governs assessment clarity and rigor only. It does not replace or override existing evidence extraction, Bloom taxonomy mapping, or teacher-relative difficulty allocation.'
    ].join('\n');
  },

  /**
   * Guides Agent 2 (Generator) in question formulation.
   * Injects at most ONE matching few-shot exemplar if domain cleanly matches,
   * with strict instructions that exemplars teach form/tone ONLY, never facts.
   */
  getGeneratorGuidance({ targetDifficulty = 'Medium', subject, topic, subtopic, includeExemplar = true } = {}) {
    const tier = String(targetDifficulty || 'Medium').trim();
    const lines = [
      '[KMIT KAHOOT QUESTION STYLE CONTRACT: "Think, Don\'t Guess"]',
      '1. STEM: Crisp, direct, problem-first premise (target <= 25 words, maximum 55 words). Eliminate academic boilerplate ("operational mechanics", "foundational premise"), verbose throat-clearing, and meta-language ("According to the lecture").',
      '2. OPTIONS: Exactly 4 mutually exclusive, grammatically parallel choices (typically 3 to 12 words each). All options must present concrete technical alternatives.',
      '3. DISTRACTORS: Must represent authentic student misconceptions or common technical pitfalls from the lecture topic. NEVER use generic abstract boilerplate ("Inverts the operational priority, allowing unconstrained resource preemption without threshold validation"). Every distractor must assert a plausible but incorrect technical mechanism, value, or state.',
      '4. COGNITIVE CALIBRATION: An easy question written in difficult words is NOT a hard question. Hard items must require multi-step reasoning, execution tracing, or trade-off evaluation under constraints. Never pad vocabulary to simulate difficulty.',
      '5. CODE SNIPPETS: If including code, use short, syntactically clean markdown code blocks (<= 6 lines). Test trace output, pointer manipulation, state mutation, or edge-case behavior—never syntax trivia.',
      `6. DIFFICULTY & EVIDENCE: Deliver authentic ${tier} challenge reflecting the teacher's pedagogical intent. Every correct answer and distractor must be grounded in or defensible against the provided lecture material.`
    ];

    if (includeExemplar) {
      const exemplar = this.getExemplarForSubject({ subject, topic, subtopic });
      if (exemplar) {
        lines.push(
          '',
          '[CANONICAL KMIT KAHOOT EXEMPLAR FOR THIS DOMAIN]',
          'IMPORTANT: This exemplar illustrates structural form, option parallelism, and reasoning tone ONLY.',
          'Do NOT adopt its subject matter, concepts, answer key, or difficulty level for your question. Your question must be based entirely on the provided lecture evidence.',
          `Question: ${exemplar.questionText}`,
          `Options:\n${exemplar.options.map((opt, i) => `  ${['A', 'B', 'C', 'D'][i]}. ${opt}`).join('\n')}`,
          `Correct Answer: [${['A', 'B', 'C', 'D'][exemplar.correctAnswerIndex]}] ${exemplar.correctAnswer}`,
          `Pedagogical Rationale: ${exemplar.explanation}`
        );
      } else {
        lines.push(
          '',
          '[STRUCTURAL PATTERN REMINDER]',
          'Ensure options are concise, mutually exclusive, grammatically parallel, and test genuine understanding of concepts taught in the provided lecture evidence without meta-discourse.'
        );
      }
    }

    return lines.join('\n');
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. HEURISTIC STYLE CHECKER (MECHANICALLY ENFORCEABLE CHECKS ONLY)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Evaluates candidate MCQ strictly against mechanical style heuristics.
   * Separates fatal violations (issues) from advisory signals (warnings).
   * NOTE: Passing style heuristics does NOT certify educational or semantic quality!
   */
  checkStyleHeuristics(candidateMCQ) {
    const self = this || KMIT_STYLE_CONTRACT;
    const issues = [];
    const warnings = [];

    if (!candidateMCQ || typeof candidateMCQ !== 'object') {
      return { passesStyle: false, issues: ['EMPTY_CANDIDATE'], warnings: [], standardsVersion: self.version };
    }

    const qText = String(candidateMCQ.questionText || candidateMCQ.question || candidateMCQ.stem || '').trim();
    const options = Array.isArray(candidateMCQ.options) ? candidateMCQ.options : [];
    const { enforceable } = self.standards;

    // 1. Check prohibited meta-openers or embedded meta-discourse anywhere in stem (Fatal)
    const patternsToCheck = self.stem.prohibitedMetaPatterns || self.stem.prohibitedMetaPrefixes;
    for (const pattern of patternsToCheck) {
      if (pattern.test(qText)) {
        issues.push('UNNECESSARY_META_LANGUAGE');
        break;
      }
    }

    // 2. Check stem length runaway boundary (excluding fenced code blocks) (Fatal)
    const proseStem = qText.replace(/```[\s\S]*?```/g, '').trim();
    const stemWords = proseStem.split(/\s+/).filter(Boolean).length;
    if (stemWords > enforceable.stemHardWordLimit) {
      issues.push('STEM_LENGTH_EXCEEDED');
    }

    // 3. Check option count (Fatal)
    if (options.length !== 4) {
      issues.push('INVALID_OPTION_COUNT');
    } else {
      // 4. Check for duplicate options (exact strings) (Fatal)
      const trimmedLowerOptions = options.map(o => String(o).trim().toLowerCase());
      const uniqueOptions = new Set(trimmedLowerOptions);
      if (uniqueOptions.size !== options.length) {
        issues.push('DUPLICATE_OPTIONS');
      }

      // 5. Check option length bounds and outlier asymmetry (Fatal)
      const wordCounts = options.map(o => String(o).trim().split(/\s+/).filter(Boolean).length);
      const minWords = Math.min(...wordCounts);
      const maxWords = Math.max(...wordCounts);

      if (minWords < enforceable.optionMinWords) {
        issues.push('OPTION_EMPTY_OR_TRIVIAL');
      }
      if (maxWords > enforceable.optionMaxWords) {
        issues.push('OPTION_EXCESSIVE_LENGTH');
      }
      if (minWords > 0 && (maxWords / minWords) > enforceable.optionLengthRatioCeiling) {
        issues.push('OPTION_LENGTH_ASYMMETRY');
      }

      // 6. Check for high vocabulary overlap and word-order permutations (Advisory Warnings Only)
      const optionWordBags = options.map(opt => {
        return new Set(
          String(opt)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2)
        );
      });

      let highOverlapDetected = false;
      let wordOrderPermutationDetected = false;

      for (let i = 0; i < optionWordBags.length; i++) {
        for (let j = i + 1; j < optionWordBags.length; j++) {
          const bagA = optionWordBags[i];
          const bagB = optionWordBags[j];
          if (bagA.size > 0 && bagB.size > 0) {
            const intersection = new Set([...bagA].filter(x => bagB.has(x)));
            const union = new Set([...bagA, ...bagB]);
            const jaccard = intersection.size / union.size;

            if (jaccard >= enforceable.maxWordJaccardSimilarity) {
              highOverlapDetected = true;
            }
            if (bagA.size === bagB.size && intersection.size === bagA.size) {
              wordOrderPermutationDetected = true;
            }
          }
        }
      }

      if (highOverlapDetected) {
        warnings.push('HIGH_OPTION_VOCABULARY_SIMILARITY');
      }
      if (wordOrderPermutationDetected) {
        warnings.push('OPTION_WORD_ORDER_PERMUTATION_WARNING');
      }
    }

    return {
      passesStyle: issues.length === 0,
      issues,
      warnings,
      standardsVersion: self.version
    };
  }
};

module.exports = KMIT_STYLE_CONTRACT;
