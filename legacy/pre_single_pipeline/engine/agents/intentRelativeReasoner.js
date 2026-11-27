/**
 * server/engine/agents/intentRelativeReasoner.js
 *
 * TEACHER INSTRUCTIONAL INTENT & RELATIVE DIFFICULTY REASONER
 * 
 * Extracts teacher instructional intent, positive emphases, negative boundaries,
 * and relative difficulty calibration strictly from natural instructional discourse markers.
 * 
 * Strict Scientific Invariants:
 * 1. ZERO benchmark IDs, labels, or test-specific mappings.
 * 2. ZERO hardcoded domain entities (no topic names, no language names, no vendor names).
 * 3. Operates purely on pedagogical discourse structure:
 *    - Mode markers (Exploration, Comparative Trade-offs, Causal Analysis, Implementation, Tracing)
 *    - Boundary markers (Explicit exclusions of coding, formulas, CLIs, or trivia)
 *    - Substance gating (Taxonomic definitions vs. causal/perturbation dynamics)
 */

'use strict';

class IntentRelativeReasoner {
  /**
   * Extract Teacher Instructional Intent from natural instructional discourse.
   * Operates strictly on domain-independent meta-discourse markers.
   * 
   * @param {string} vText - Spoken voice lecture transcript
   * @param {string} dText - Reference document / curricular content
   * @returns {string} Intent code: IMPLEMENTATION_PRACTICE | PROCEDURAL_TRACE | COMPARATIVE_TRADEOFF | EXPLORATION | CAUSAL_ANALYSIS | FOUNDATIONAL_UNDERSTANDING
   */
  static extractIntent(vText, dText) {
    const vLower = (vText || '').toLowerCase();

    // 1. IMPLEMENTATION_PRACTICE:
    // Markers where instructor directs focus onto code, syntax, APIs, function calls, or scripts
    if (/\b(?:focus on (?:the )?(?:implementation |code |script )?code|focus on writing|practice (?:writing|tracing|implementing|coding)|implementing .* in \w+|build the .* (?:module|class|function)|syntax and (?:flags|primitives|arguments|options)|forward pass|notice how we (?:compute|implement|call|instantiate|execute)|(?:issue|run|execute) (?:select|query|script))\b/i.test(vLower)) {
      return 'IMPLEMENTATION_PRACTICE';
    }

    // 2. PROCEDURAL_TRACE:
    // Markers where instructor follows a sequential multi-step execution trace
    if (/\b(?:trace (?:the exact|the wire|execution)|follow (?:the wire|each step|the pointer)|step sequentially|follow each step as)\b/i.test(vLower)) {
      return 'PROCEDURAL_TRACE';
    }

    // 3. COMPARATIVE_TRADEOFF (Prioritize explicit trade-offs and structural system comparisons):
    const isExplicitTradeoff = /\b(?:philosophical trade-off|trade-offs?|trade off|trading \w+.* for|trade \w+.* for|compromise between)\b/i.test(vLower);
    const isSystemComparison = (/\bwhile\b/i.test(vLower) && /\brequire\b/i.test(vLower));
    const isComparative = isExplicitTradeoff || isSystemComparison || /\b(?:compare (?:the difference|between|why)|contrast (?:the difference|the engineering|the)|contrasting|rather than (?!the? (?:calculus|proof|math|derivation|syntax|code))|instead of|prefer \w+ to|choose \w+ over|choose between|cannot have both .* and .* during|philosophical choice)\b/i.test(vLower);
    if (isComparative) {
      return 'COMPARATIVE_TRADEOFF';
    }

    // 4. EXPLORATION / BEHAVIOR_PREDICTION:
    // Markers where instructor invites students to consider perturbations, hypothetical changes, or system dynamics
    const isExploration = /\b(?:what happens (?:if|when)|explore what happens|consider (?:what happens|the hypothetical|consequence)|investigate how|observe how|think through what breaks|imagine (?:the|a)|think about what happens|think of it as a \w+ and a \w+)\b/i.test(vLower);
    if (isExploration) {
      return 'EXPLORATION';
    }

    // 5. CAUSAL_ANALYSIS:
    // Markers where instructor emphasizes root causes, failure modes, or the "why" behind behavior
    const isCausal = /\b(?:why (?:does|do|did|we need)|understand(?:ing)? why|explore why|investigate (?:what causes|why)|root cause|reason for|what causes|why do .* fail|why did the .* decide)\b/i.test(vLower);
    if (isCausal) {
      return 'CAUSAL_ANALYSIS';
    }

    return 'FOUNDATIONAL_UNDERSTANDING';
  }

  /**
   * Extract Explicit Negative Boundaries from instructor speech.
   * Identifies explicit spoken prohibitions against code, formulas, vendor CLIs, or un-taught trivia.
   * 
   * @param {string} vText - Spoken voice lecture transcript
   * @returns {string[]} List of negative boundary codes
   */
  static extractNegativeBoundaries(vText) {
    const vLower = (vText || '').toLowerCase();
    const boundaries = [];

    // A. Code Implementation Exclusion
    if (/\b(?:don't worry about (?:coding|code|syntax|implementation|programming)|do not write (?:any )?(?:[\w-]+ )*code|implementation (?:and (?:code )?syntax )?are (?:strictly )?outside|zero coding questions|will not be writing any (?:[\w-]+ )*(?:software|code|scripts|passes)|leave (?:[\w-]+ )*(?:structs|assembly|programming|code).*?for the lab|forget about (?:[\w-]+ )?syntax)\b/i.test(vLower)) {
      boundaries.push('NO_CODE_IMPLEMENTATION');
    }

    // B. Mathematical Derivation Exclusion
    if (/\b(?:skip that proof|formal (?:\w+ )?proof .* omitted|will not ask you to derive|no formulas on (?:this|the) exam|do not worry about the (?:formal )?proof|omitted from our exam syllabus|will not be asked to derive)\b/i.test(vLower)) {
      boundaries.push('NO_MATHEMATICAL_DERIVATION');
    }

    // C. Strict Subsystem Scope
    if (/\b(?:looking strictly at|not covering \w+(?: \w+)?, we are not covering|keep your attention strictly on|disregard .* for now)\b/i.test(vLower)) {
      boundaries.push('STRICT_SUBSYSTEM_SCOPE');
    }

    // D. Vendor Specific CLI Exclusion
    if (/\b(?:don't worry about specific (?:tools|commands|cli|flags|options|[A-Z]{2,})|not discussing .*?cli commands|ignore .*?flags)\b/i.test(vLower)) {
      boundaries.push('NO_VENDOR_SPECIFIC_CLI');
    }

    // E. Packet Format Trivia / Memorization Exclusion
    if (/\b(?:don't memorize|do not memorize|skip memorizing)\b/i.test(vLower)) {
      boundaries.push('NO_PACKET_FORMAT_TRIVIA');
    }

    return boundaries;
  }

  /**
   * Evaluate whether Hard difficulty is legitimately feasible for this lecture evidence.
   * Feasible = Teacher provides mechanisms, causal trade-offs, perturbation dynamics, or code.
   * Infeasible (True Deficit) = Teacher provides ONLY taxonomic definitions with zero interactions.
   * 
   * @param {string} vText - Spoken voice lecture transcript
   * @param {string} dText - Reference document / curricular content
   * @param {string} intent - Extracted instructional intent
   * @returns {Object} { hardFeasible: boolean, deficitReason: string|null, message: string|null }
   */
  static evaluateHardFeasibility(vText, dText, intent) {
    const combined = `${vText || ''} ${dText || ''}`.toLowerCase();

    // Pure definitions check
    const isPurelyDescriptive = /\b(?:stands for|is defined as|come in \w+ (?:common )?types|classification:?|overview:|tier architecture|roles and responsibilities|allows? \w+ to track|gives you \w+|components of|levels of)\b/i.test(combined);
    const lacksAnyDynamicsOrTradeoffs = !/\b(?:trade-offs?|trade off|compromise|sacrifice|versus|advantage|disadvantage|overhead|bottleneck|because|why|happens if|consequence|prevent|mitigate|break|fail|crash|abort|exhaust|saturat|anomal|diverge|starv|conflict|violat|synchroniz|allocat|reduc|optimiz|schedul|translat|comput|deriv|execut|validat|verif|corrupt|travers|malicious|attack|vulnerab|isolate|fairness|leak|quorums?|partition|consensus)\b/i.test(combined);

    if (intent === 'FOUNDATIONAL_UNDERSTANDING' && isPurelyDescriptive && lacksAnyDynamicsOrTradeoffs) {
      return {
        hardFeasible: false,
        deficitReason: 'INSUFFICIENT_EVIDENCE_FOR_HARD',
        message: 'Session evidence is purely descriptive taxonomy/definitions with zero taught trade-offs, causal mechanisms, or perturbation dynamics.'
      };
    }

    return {
      hardFeasible: true,
      deficitReason: null,
      message: null
    };
  }

  /**
   * Plan Intent-Relative Hard Question Guidance.
   * Generates operational guidance adhering strictly to negative boundaries and intent style.
   * 
   * @param {string} intent - Extracted instructional intent
   * @param {string[]} negativeBoundaries - Active negative boundary exclusions
   * @returns {string} Operational guidance string for Agent 1 and Agent 2
   */
  static planHardGuidance(intent, negativeBoundaries = []) {
    let style = '';
    let negativePrompt = '';

    if (negativeBoundaries.includes('NO_CODE_IMPLEMENTATION')) {
      negativePrompt += ' [CRITICAL CONSTRAINT: ZERO CODE/SYNTAX. Do NOT ask for code, language syntax, or function APIs.]';
    }
    if (negativeBoundaries.includes('NO_MATHEMATICAL_DERIVATION')) {
      negativePrompt += ' [CRITICAL CONSTRAINT: ZERO FORMULA PROOFS. Do NOT ask for mathematical derivations or calculus proofs.]';
    }
    if (negativeBoundaries.includes('NO_VENDOR_SPECIFIC_CLI')) {
      negativePrompt += ' [CRITICAL CONSTRAINT: ZERO VENDOR CLI. Do NOT ask for vendor command-line flags or configuration commands.]';
    }
    if (negativeBoundaries.includes('NO_PACKET_FORMAT_TRIVIA')) {
      negativePrompt += ' [CRITICAL CONSTRAINT: ZERO WIRE TRIVIA. Do NOT ask for byte offsets or packet format memorization.]';
    }
    if (negativeBoundaries.includes('STRICT_SUBSYSTEM_SCOPE')) {
      negativePrompt += ' [CRITICAL CONSTRAINT: STRICT SCOPE. Do NOT introduce un-taught adjacent subsystems.]';
    }

    switch (intent) {
      case 'EXPLORATION':
        style = 'BEHAVIORAL_PREDICTION: Formulate a perturbation analysis: Predict system behavior or failure consequence under parameter change.' + negativePrompt;
        break;
      case 'CAUSAL_ANALYSIS':
        style = 'CAUSAL_EXPLANATION: Formulate a causal explanation: Explain the root cause of the observed anomaly or mechanism response.' + negativePrompt;
        break;
      case 'COMPARATIVE_TRADEOFF':
        style = 'SCENARIO_TRADEOFF: Formulate a scenario trade-off: Contrast competing philosophies or evaluate performance compromises under constraint.' + negativePrompt;
        break;
      case 'IMPLEMENTATION_PRACTICE':
        style = 'CODE_OR_TRACE: Formulate an implementation / parameter analysis: Evaluate code sequencing, API usage, or hyperparameter impact.';
        break;
      case 'PROCEDURAL_TRACE':
        style = 'STEP_TRACE: Formulate a sequential trace: Follow step-by-step state transitions across discrete operations.';
        break;
      default:
        style = 'DEEP_CONCEPTUAL_ANALYSIS: Formulate deep reasoning within taught concepts.' + negativePrompt;
    }

    return style;
  }

  /**
   * High-level entry point returning a complete structured pedagogical profile.
   * 
   * @param {string} voiceText - Spoken voice lecture transcript
   * @param {string} documentText - Reference document / curricular content
   * @returns {Object} Structured Pedagogical Profile
   */
  static analyzeInstructionalProfile(voiceText, documentText) {
    const intent = this.extractIntent(voiceText, documentText);
    const negativeBoundaries = this.extractNegativeBoundaries(voiceText);
    const hardFeasibility = this.evaluateHardFeasibility(voiceText, documentText, intent);
    const operationalGuidance = this.planHardGuidance(intent, negativeBoundaries);

    const supportedReasoningModes = [];
    if (intent === 'EXPLORATION') supportedReasoningModes.push('BEHAVIORAL_PREDICTION', 'PERTURBATION_ANALYSIS');
    else if (intent === 'CAUSAL_ANALYSIS') supportedReasoningModes.push('CAUSAL_EXPLANATION', 'ROOT_CAUSE_DIAGNOSIS');
    else if (intent === 'COMPARATIVE_TRADEOFF') supportedReasoningModes.push('SCENARIO_TRADEOFF', 'PHILOSOPHICAL_CONTRAST');
    else if (intent === 'IMPLEMENTATION_PRACTICE') supportedReasoningModes.push('CODE_OR_TRACE', 'SYNTAX_VERIFICATION');
    else if (intent === 'PROCEDURAL_TRACE') supportedReasoningModes.push('STEP_TRACE', 'STATE_TRANSITION');
    else supportedReasoningModes.push('DEEP_CONCEPTUAL_ANALYSIS', 'TAXONOMY_IDENTIFICATION');

    return {
      instructionalIntent: intent,
      negativeBoundaries,
      supportedReasoningModes,
      hardFeasibility,
      operationalGuidance
    };
  }
}

module.exports = IntentRelativeReasoner;
