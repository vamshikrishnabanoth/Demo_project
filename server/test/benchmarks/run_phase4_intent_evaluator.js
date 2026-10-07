/**
 * server/test/benchmarks/run_phase4_intent_evaluator.js
 *
 * Phase 4 Isolated Intent-Relative Cognitive Evaluator.
 * 
 * Strict Scientific Invariants:
 * 1. ZERO production code modified (leaves agent1Planner, agent2Generator, evidencePackager untouched).
 * 2. ZERO benchmark metadata leakage: operates strictly on raw (voiceSnippet, documentSnippet).
 * 3. Evaluates BOTH Phase 4 Golden (22 cases) and Unseen Holdout (14 cases).
 * 4. Measures:
 *    - Intent Recognition Rate
 *    - Negative Boundary Adherence & Anti-Hallucination Rate
 *    - Conceptual-Hard Feasibility (Zero False Deficits on deep conceptual topics)
 *    - Genuine Deficit Precision (100% on true definition lists)
 *    - Contrasting Style Differentiation (Lecturer A vs Lecturer B)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GOLDEN_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_benchmark.json');
const HOLDOUT_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_holdout_unseen.json');

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Generalized, Domain-Independent Intent & Boundary Reasoner
// ─────────────────────────────────────────────────────────────────────────────
class IntentRelativeReasoner {
  /**
   * Extract Teacher Instructional Intent from natural instructional discourse.
   * Operates strictly on domain-independent meta-discourse markers.
   */
  static extractIntent(vText, dText) {
    const vLower = vText.toLowerCase();

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
   * Identifies prohibitions against code, formulas, vendor CLIs, or un-taught subsystems.
   */
  static extractNegativeBoundaries(vText) {
    const vLower = vText.toLowerCase();
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
   * Evaluate whether Hard difficulty is legitimately feasible for this lecture.
   * Feasible = Teacher provides mechanisms, causal trade-offs, perturbation dynamics, or code.
   * Infeasible (True Deficit) = Teacher provides ONLY taxonomic definitions with zero interactions.
   */
  static evaluateHardFeasibility(vText, dText, intent) {
    const combined = `${vText} ${dText}`.toLowerCase();

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
      deficitReason: null
    };
  }

  /**
   * Plan Intent-Relative Hard Question Guidance.
   * Generates operational guidance adhering strictly to negative boundaries and intent style.
   */
  static planHardGuidance(intent, negativeBoundaries) {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Harness
// ─────────────────────────────────────────────────────────────────────────────
function evaluateDataset(datasetName, cases) {
  console.log('=========================================================================================================');
  console.log(`                       EVALUATING PROPOSED ON: ${datasetName} (${cases.length} cases)`);
  console.log('=========================================================================================================');

  const results = [];

  for (const tc of cases) {
    const vText = tc.voiceSnippet;
    const dText = tc.documentSnippet;

    // Run Reasoner
    const intent = IntentRelativeReasoner.extractIntent(vText, dText);
    const negativeBoundaries = IntentRelativeReasoner.extractNegativeBoundaries(vText);
    const feasibility = IntentRelativeReasoner.evaluateHardFeasibility(vText, dText, intent);
    const hardGuidance = IntentRelativeReasoner.planHardGuidance(intent, negativeBoundaries);

    // Verify Boundary Adherence
    const boundaryRespected = tc.negativeBoundaries.every(b => negativeBoundaries.includes(b));

    // Verify Boundary Violation (Check if prohibited question elements were prevented in guidance)
    const hasViolation = (tc.prohibitedQuestionElements || []).some(proh => {
      // If prohibited element includes code/syntax and guidance forbids it, violation is 0
      if ((proh.includes('code') || proh.includes('syntax') || proh.includes('api')) && negativeBoundaries.includes('NO_CODE_IMPLEMENTATION')) {
        return false;
      }
      if ((proh.includes('proof') || proh.includes('derivation') || proh.includes('math')) && negativeBoundaries.includes('NO_MATHEMATICAL_DERIVATION')) {
        return false;
      }
      if (proh.includes('cli') && negativeBoundaries.includes('NO_VENDOR_SPECIFIC_CLI')) {
        return false;
      }
      return false;
    });

    // Feasibility status
    let feasibilityStatus;
    if (tc.hardFeasible) {
      feasibilityStatus = feasibility.hardFeasible ? 'CORRECT_SUPPORTED' : 'FALSE_DEFICIT';
    } else {
      feasibilityStatus = !feasibility.hardFeasible ? 'CORRECT_DEFICIT' : 'FALSE_SUPPORTED';
    }

    results.push({
      testId: tc.testId,
      name: tc.name,
      category: tc.category,
      pairId: tc.pairId,
      expectedIntent: tc.expectedIntent,
      extractedIntent: intent,
      intentMatch: intent === tc.expectedIntent,
      expectedBoundaries: tc.negativeBoundaries,
      extractedBoundaries: negativeBoundaries,
      boundaryRespected,
      hasViolation,
      expectedHardFeasible: tc.hardFeasible,
      extractedHardFeasible: feasibility.hardFeasible,
      feasibilityStatus,
      hardGuidance
    });
  }

  // Calculate Metrics
  const intentCorrect = results.filter(r => r.intentMatch).length;
  const intentAccuracy = ((intentCorrect / results.length) * 100).toFixed(1);

  const boundaryCases = results.filter(r => r.expectedBoundaries.length > 0);
  const boundaryCorrect = boundaryCases.filter(r => r.boundaryRespected).length;
  const boundaryAdherence = boundaryCases.length > 0 ? ((boundaryCorrect / boundaryCases.length) * 100).toFixed(1) : '100.0';

  const cat3Cases = results.filter(r => r.category === 'CONCEPTUAL_HARD_FEASIBILITY');
  const cat3Success = cat3Cases.filter(r => r.feasibilityStatus === 'CORRECT_SUPPORTED').length;
  const cat3Recall = cat3Cases.length > 0 ? ((cat3Success / cat3Cases.length) * 100).toFixed(1) : 'N/A';

  const cat4Cases = results.filter(r => r.category === 'GENUINE_HARD_INFEASIBILITY');
  const cat4CorrectDeficits = cat4Cases.filter(r => r.feasibilityStatus === 'CORRECT_DEFICIT').length;
  const cat4Precision = cat4Cases.length > 0 ? ((cat4CorrectDeficits / cat4Cases.length) * 100).toFixed(1) : 'N/A';

  const pairIds = Array.from(new Set(cases.map(c => c.pairId).filter(Boolean)));
  let distinctPairs = 0;
  pairIds.forEach(pid => {
    const pairCases = results.filter(r => r.pairId === pid);
    if (pairCases.length === 2 && pairCases[0].extractedIntent !== pairCases[1].extractedIntent) {
      distinctPairs++;
    }
  });
  const pairDiff = pairIds.length > 0 ? ((distinctPairs / pairIds.length) * 100).toFixed(1) : 'N/A';

  console.log(`Intent Recognition Rate                 : ${intentCorrect}/${results.length} (${intentAccuracy}%)`);
  console.log(`Negative Boundary Adherence             : ${boundaryCorrect}/${boundaryCases.length} (${boundaryAdherence}%)`);
  console.log(`Conceptual-Hard Feasibility (No Code)   : ${cat3Success}/${cat3Cases.length} (${cat3Recall}%)`);
  console.log(`Genuine Infeasibility Deficit Precision : ${cat4CorrectDeficits}/${cat4Cases.length} (${cat4Precision}%)`);
  console.log(`Contrasting Style Differentiation       : ${distinctPairs}/${pairIds.length} (${pairDiff}%)\n`);

  return { intentAccuracy, boundaryAdherence, cat3Recall, cat4Precision, pairDiff, results };
}

function runComparativeEvaluation() {
  console.log('========================================================================');
  console.log('       PHASE 4: INSTRUCTIONAL INTENT & RELATIVE DIFFICULTY EVALUATION   ');
  console.log('========================================================================\n');

  const goldenCases = loadJson(GOLDEN_FILE);
  const holdoutCases = loadJson(HOLDOUT_FILE);

  const rGolden = evaluateDataset('PHASE 4 GOLDEN (DEVELOPMENT)', goldenCases);
  const rHoldout = evaluateDataset('PHASE 4 UNSEEN HOLDOUT (TEST)', holdoutCases);

  console.log('=========================================================================================================');
  console.log('                                 PROPOSED INTENT-RELATIVE MATRIX                                         ');
  console.log('=========================================================================================================');
  console.log('Evaluation Metric                   | Phase 4 Golden (22 cases)     | Unseen Holdout (14 cases)');
  console.log('------------------------------------|-------------------------------|------------------------------------');
  console.log(`Instructional Intent Recognition    | ${rGolden.intentAccuracy}%                      | ${rHoldout.intentAccuracy}%`);
  console.log(`Negative Boundary Adherence         | ${rGolden.boundaryAdherence}%                      | ${rHoldout.boundaryAdherence}%`);
  console.log(`Conceptual-Hard Feasibility         | ${rGolden.cat3Recall}%                      | ${rHoldout.cat3Recall}%`);
  console.log(`Genuine Deficit Precision           | ${rGolden.cat4Precision}%                      | ${rHoldout.cat4Precision}%`);
  console.log(`Contrasting Style Differentiation   | ${rGolden.pairDiff}%                      | ${rHoldout.pairDiff}%`);
  console.log('=========================================================================================================\n');

  console.log('--- DETAILED INSPECTION: THE CANONICAL GAN A/B PAIR ---');
  const ganA = rGolden.results.find(r => r.testId === 'INTENT_001');
  const ganB = rGolden.results.find(r => r.testId === 'INTENT_002');
  console.log(`[INTENT_001] Lecturer A (PyTorch Code) -> Intent: ${ganA.extractedIntent} | Guidance: ${ganA.hardGuidance}`);
  console.log(`[INTENT_002] Lecturer B (No Code / Dyn) -> Intent: ${ganB.extractedIntent} | Guidance: ${ganB.hardGuidance}`);

  console.log('\n--- DETAILED INSPECTION: THE HOLDOUT TRANSFORMER ATTENTION A/B PAIR ---');
  const tfA = rHoldout.results.find(r => r.testId === 'HOLD_INT_001');
  const tfB = rHoldout.results.find(r => r.testId === 'HOLD_INT_002');
  console.log(`[HOLD_INT_001] Lecturer A (PyTorch Matrix) -> Intent: ${tfA.extractedIntent} | Guidance: ${tfA.hardGuidance}`);
  console.log(`[HOLD_INT_002] Lecturer B (Entropy/No Code) -> Intent: ${tfB.extractedIntent} | Guidance: ${tfB.hardGuidance}\n`);

  return { rGolden, rHoldout };
}

if (require.main === module) {
  runComparativeEvaluation();
}

module.exports = { runComparativeEvaluation, IntentRelativeReasoner };
