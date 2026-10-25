'use strict';

const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../engine/agents/agent1Planner.js');
let raw = fs.readFileSync(targetFile, 'utf8');
const isCRLF = raw.includes('\r\n');
// Normalize to LF for easy manipulation, then restore CRLF if needed
let code = raw.replace(/\r\n/g, '\n');

// 1. Version and constants
const oldVerPattern = "const PLANNER_SCHEMA_VERSION = 'v2_archetype_aware';";
const newVerBlock = `const PLANNER_SCHEMA_VERSION = 'v3_task_aware';

const ASSESSMENT_ANGLES = Object.freeze({
  CONCEPTUAL: 'CONCEPTUAL',
  CALCULATION: 'CALCULATION',
  REASONING: 'REASONING',
  CODE_TRACE: 'CODE_TRACE',
  EDGE_CASE: 'EDGE_CASE',
  APPLICATION: 'APPLICATION'
});

const FORMAT_RECOMMENDATIONS = Object.freeze({
  PROSE_MULTIPLE_CHOICE: 'PROSE_MULTIPLE_CHOICE',
  NUMERICAL_TRACE: 'NUMERICAL_TRACE',
  REASONING_CONTRAST: 'REASONING_CONTRAST',
  CODE_ANALYSIS: 'CODE_ANALYSIS',
  SCENARIO_APPLICATION: 'SCENARIO_APPLICATION'
});`;

if (!code.includes(oldVerPattern)) {
  throw new Error('Could not find old schema version pattern');
}
code = code.replace(oldVerPattern, newVerBlock);

// 2. Add helper methods to Agent1Planner
const classStartPattern = 'class Agent1Planner {';
const helperMethods = `class Agent1Planner {
  /**
   * Derives or validates the assessment angle for a planning target.
   * Valid angles: CONCEPTUAL, CALCULATION, REASONING, CODE_TRACE, EDGE_CASE, APPLICATION.
   */
  _deriveAssessmentAngle(t = {}) {
    if (t.assessmentAngle && ASSESSMENT_ANGLES[String(t.assessmentAngle).toUpperCase()]) {
      return ASSESSMENT_ANGLES[String(t.assessmentAngle).toUpperCase()];
    }
    const dim = String(t.dimension || '').toUpperCase();
    const op = String(t.intendedCognitiveOperation || t.operation || '').toUpperCase();
    const concept = String(t.concept || '').toLowerCase();

    if (dim.includes('CALCULATION') || op.includes('CALCULAT') || op === 'CALCULATION' || concept.includes('calculate') || concept.includes('remainder trace')) {
      return ASSESSMENT_ANGLES.CALCULATION;
    }
    if (dim.includes('FLOW') || op === 'TRACE' || op === 'CODE_OR_TRACE' || concept.includes('code trace') || concept.includes('execution trace')) {
      return ASSESSMENT_ANGLES.CODE_TRACE;
    }
    if (dim.includes('TRADEOFF') || dim.includes('COMPARISON') || op === 'COMPARE' || concept.includes('tradeoff') || concept.includes('invariance') || concept.includes('reasoning')) {
      return ASSESSMENT_ANGLES.REASONING;
    }
    if (dim.includes('SCENARIO') || dim.includes('APPLICATION') || op === 'APPLY' || concept.includes('application') || concept.includes('practical')) {
      return ASSESSMENT_ANGLES.APPLICATION;
    }
    if (op === 'DIAGNOSE' || concept.includes('edge case') || concept.includes('boundary') || concept.includes('defect') || concept.includes('violation')) {
      return ASSESSMENT_ANGLES.EDGE_CASE;
    }
    return ASSESSMENT_ANGLES.CONCEPTUAL;
  }

  /**
   * Derives or validates the format recommendation for a planning target.
   * Valid formats: PROSE_MULTIPLE_CHOICE, NUMERICAL_TRACE, REASONING_CONTRAST, CODE_ANALYSIS, SCENARIO_APPLICATION.
   */
  _deriveFormatRecommendation(t = {}) {
    if (t.formatRecommendation && FORMAT_RECOMMENDATIONS[String(t.formatRecommendation).toUpperCase()]) {
      return FORMAT_RECOMMENDATIONS[String(t.formatRecommendation).toUpperCase()];
    }
    const angle = this._deriveAssessmentAngle(t);
    switch (angle) {
      case ASSESSMENT_ANGLES.CALCULATION:
        return FORMAT_RECOMMENDATIONS.NUMERICAL_TRACE;
      case ASSESSMENT_ANGLES.CODE_TRACE:
        return FORMAT_RECOMMENDATIONS.CODE_ANALYSIS;
      case ASSESSMENT_ANGLES.REASONING:
        return FORMAT_RECOMMENDATIONS.REASONING_CONTRAST;
      case ASSESSMENT_ANGLES.APPLICATION:
        return FORMAT_RECOMMENDATIONS.SCENARIO_APPLICATION;
      case ASSESSMENT_ANGLES.EDGE_CASE:
        return FORMAT_RECOMMENDATIONS.REASONING_CONTRAST;
      case ASSESSMENT_ANGLES.CONCEPTUAL:
      default:
        return FORMAT_RECOMMENDATIONS.PROSE_MULTIPLE_CHOICE;
    }
  }`;

if (!code.includes(classStartPattern)) {
  throw new Error('Could not find class Agent1Planner {');
}
code = code.replace(classStartPattern, helperMethods);

// 3. Update filterGrounded mapping in generatePlan
const filterGroundedOld = `            return {
              targetId: t.targetId || \`\${prefix}0\${idx + 1}\`,
              subtopic: t.subtopic || (parsed.subtopics && parsed.subtopics[idx % (parsed.subtopics.length || 1)]) || 'General Concept',
              concept: t.concept,
              trajectoryPhase,
              timestamp: (rawTs && !isSyntheticTs) ? rawTs : prov.timestamp,
              tier: t.tier || (prefix === 'T' ? 'Core' : (idx === 0 ? 'Core' : 'Secondary')),
              dimension: t.dimension || 'Conceptual',
              cognitiveLevel: t.cognitiveLevel || 'Understand',
              targetDifficulty: t.targetDifficulty || requestedDifficulty,
              targetArchetype: t.targetArchetype || undefined,
              evidenceType: prov.evidenceType,
              supportingEvidence: t.supportingEvidence || t.evidenceSpan || '',
              confidence: t.confidence || 'HIGH',
              sourceChunks: (Array.isArray(t.sourceChunks) && t.sourceChunks.length > 0 && t.sourceChunks.every(cid => Boolean(evidencePackage?.hierarchicalStore?.childMap?.[cid] || evidencePackage?.multimodalStore?.childMap?.[cid]))) ? t.sourceChunks : prov.sourceChunks,
              requiresExactArtifact: Boolean(t.requiresExactArtifact),
              instruction: t.instruction || \`Test understanding of \${t.concept}.\`
            };`;

const filterGroundedNew = `            const angle = this._deriveAssessmentAngle(t);
            const format = this._deriveFormatRecommendation(t);
            const macroTopic = t.macroTopic || t.subtopic || (parsed.subtopics && parsed.subtopics[idx % (parsed.subtopics.length || 1)]) || t.concept || 'General Concept';
            const learningObj = t.learningObjective || t.instruction || \`Test understanding of \${t.concept}.\`;
            const reasoningTask = t.specificReasoningTask || t.operationalGuidance || t.instruction || \`Analyze mechanism of \${t.concept}.\`;

            return {
              targetId: t.targetId || \`\${prefix}0\${idx + 1}\`,
              macroTopic: macroTopic,
              subtopic: t.subtopic || macroTopic,
              concept: t.concept,
              assessmentAngle: angle,
              learningObjective: learningObj,
              specificReasoningTask: reasoningTask,
              formatRecommendation: format,
              trajectoryPhase,
              timestamp: (rawTs && !isSyntheticTs) ? rawTs : prov.timestamp,
              tier: t.tier || (prefix === 'T' ? 'Core' : (idx === 0 ? 'Core' : 'Secondary')),
              dimension: t.dimension || 'Conceptual',
              cognitiveLevel: t.cognitiveLevel || 'Understand',
              targetDifficulty: t.targetDifficulty || requestedDifficulty,
              targetArchetype: t.targetArchetype || undefined,
              intendedCognitiveOperation: t.intendedCognitiveOperation || undefined,
              operationalGuidance: t.operationalGuidance || undefined,
              evidenceType: prov.evidenceType,
              supportingEvidence: t.supportingEvidence || t.evidenceSpan || '',
              confidence: t.confidence || 'HIGH',
              sourceChunks: (Array.isArray(t.sourceChunks) && t.sourceChunks.length > 0 && t.sourceChunks.every(cid => Boolean(evidencePackage?.hierarchicalStore?.childMap?.[cid] || evidencePackage?.multimodalStore?.childMap?.[cid]))) ? t.sourceChunks : prov.sourceChunks,
              requiresExactArtifact: Boolean(t.requiresExactArtifact),
              instruction: t.instruction || learningObj
            };`;

if (!code.includes(filterGroundedOld)) {
  throw new Error('Could not find filterGrounded return block');
}
code = code.replace(filterGroundedOld, filterGroundedNew);

// 4. Update deficit & reserve promotion handling in generatePlan
const deficitOld = `      } else if (!isTopicMode && genuineCount < requestedCount) {
        const deficitCount = requestedCount - genuineCount;
        const deficitReason = \`Lecture evidence contains only \${genuineCount} distinct assessable concept(s); requested \${requestedCount}. Remaining \${deficitCount} slot(s) withheld as capacity deficits to prevent hallucination.\`;
        for (let i = 0; i < deficitCount; i++) {
          const slotNum = genuineCount + i + 1;
          const targetId = \`T\${String(slotNum).padStart(2, '0')}\`;
          auditedTargets.push({
            targetId,
            concept: \`Curricular Capacity Deficit Slot \${slotNum}\`,
            subtopic: 'Curricular Capacity Limit',
            trajectoryPhase: 'LATE',
            timestamp: 'End of Lecture',
            tier: 'Peripheral',
            dimension: 'Conceptual',
            cognitiveLevel: 'Remember',
            targetDifficulty: requestedDifficulty === 'Balanced' ? 'Medium' : requestedDifficulty,
            intendedCognitiveOperation: 'UNFULFILLED_CAPACITY_DEFICIT',
            isCapacityLimited: true,
            capacityLimitation: {
              status: 'INSUFFICIENT_CURRICULAR_EVIDENCE',
              reason: deficitReason,
              availableCount: genuineCount,
              requestedCount
            },
            supportingEvidence: '',
            instruction: deficitReason
          });
        }
      }`;

const deficitNew = `      } else if (!isTopicMode && genuineCount < requestedCount) {
        // Promote clean reserves if available to fulfill requested count before declaring deficit
        while (auditedReserve.length > 0 && auditedTargets.length < requestedCount) {
          const promoted = auditedReserve.shift();
          promoted.targetId = \`T\${String(auditedTargets.length + 1).padStart(2, '0')}\`;
          auditedTargets.push(promoted);
          auditLog.promotedFromReserve = (auditLog.promotedFromReserve || 0) + 1;
        }

        const remainingDeficit = requestedCount - auditedTargets.length;
        if (remainingDeficit > 0) {
          const deficitReason = \`Lecture evidence contains only \${auditedTargets.length} distinct assessable concept(s); requested \${requestedCount}. Remaining \${remainingDeficit} slot(s) withheld as capacity deficits to prevent hallucination.\`;
          for (let i = 0; i < remainingDeficit; i++) {
            const slotNum = auditedTargets.length + 1;
            const targetId = \`T\${String(slotNum).padStart(2, '0')}\`;
            auditedTargets.push({
              targetId,
              macroTopic: 'Curricular Capacity Limit',
              assessmentAngle: 'CONCEPTUAL',
              learningObjective: deficitReason,
              specificReasoningTask: deficitReason,
              formatRecommendation: 'PROSE_MULTIPLE_CHOICE',
              concept: \`Curricular Capacity Deficit Slot \${slotNum}\`,
              subtopic: 'Curricular Capacity Limit',
              trajectoryPhase: 'LATE',
              timestamp: 'End of Lecture',
              tier: 'Peripheral',
              dimension: 'Conceptual',
              cognitiveLevel: 'Remember',
              targetDifficulty: requestedDifficulty === 'Balanced' ? 'Medium' : requestedDifficulty,
              intendedCognitiveOperation: 'UNFULFILLED_CAPACITY_DEFICIT',
              isCapacityLimited: true,
              capacityLimitation: {
                status: 'INSUFFICIENT_CURRICULAR_EVIDENCE',
                reason: deficitReason,
                availableCount: auditedTargets.length,
                requestedCount
              },
              supportingEvidence: '',
              instruction: deficitReason
            });
          }
        }
      }`;

if (!code.includes(deficitOld)) {
  throw new Error('Could not find deficit handling block in generatePlan');
}
code = code.replace(deficitOld, deficitNew);

// 5. Update _auditAssessmentTargets deduplication
const seenFocusOld = `    const seenFocus = new Set();
    const isFocusDuplicate = (target) => {
      if (focusList.length === 0) return false;
      const text = \`\${target.concept || ''} \${target.subtopic || ''}\`.toLowerCase();
      const op = target.intendedCognitiveOperation || null;
      for (const focus of focusList) {
        const fWords = focus.split(/\\s+/).filter(w => w.length > 3);
        const matchesFocus = text.includes(focus) || (fWords.length > 0 && fWords.every(w => text.includes(w)));
        if (matchesFocus) {
          const focusKey = op ? \`\${focus}::\${op}\` : focus;
          if (seenFocus.has(focusKey)) {
            return focus;
          }
          seenFocus.add(focusKey);
          return false;
        }
      }
      return false;
    };`;

const seenFocusNew = `    const seenFocus = new Set();
    const isFocusDuplicate = (target) => {
      if (focusList.length === 0) return false;
      const text = \`\${target.concept || ''} \${target.subtopic || ''} \${target.macroTopic || ''}\`.toLowerCase();
      const angle = (target.assessmentAngle || target.dimension || 'CONCEPTUAL').toUpperCase();
      const taskSnippet = (target.specificReasoningTask || target.learningObjective || target.concept || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      for (const focus of focusList) {
        const fWords = focus.split(/\\s+/).filter(w => w.length > 3);
        const matchesFocus = text.includes(focus) || (fWords.length > 0 && fWords.every(w => text.includes(w)));
        if (matchesFocus) {
          const focusKey = \`\${focus}::\${angle}::\${taskSnippet}\`;
          if (seenFocus.has(focusKey)) {
            return focus;
          }
          seenFocus.add(focusKey);
          return false;
        }
      }
      return false;
    };`;

if (!code.includes(seenFocusOld)) {
  throw new Error('Could not find seenFocus / isFocusDuplicate block');
}
code = code.replace(seenFocusOld, seenFocusNew);

// 6. Update conceptFingerprint in _auditAssessmentTargets
const conceptFpOld = `      const normConcept = (t.concept || '').toLowerCase().trim().replace(/^(the|a|an)\\s+/i, '');
      const op = t.intendedCognitiveOperation || t.dimension || null;
      const conceptFingerprint = op ? \`\${normConcept}::\${op}\` : normConcept;`;

const conceptFpNew = `      const normConcept = (t.concept || '').toLowerCase().trim().replace(/^(the|a|an)\\s+/i, '');
      const angle = (t.assessmentAngle || t.dimension || 'CONCEPTUAL').toUpperCase();
      const taskSnippet = (t.specificReasoningTask || t.learningObjective || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
      const op = t.intendedCognitiveOperation || t.dimension || null;
      const conceptFingerprint = \`\${normConcept}::\${angle}\${taskSnippet ? '::' + taskSnippet : (op ? '::' + op : '')}\`;`;

if (!code.includes(conceptFpOld)) {
  throw new Error('Could not find conceptFingerprint in _auditAssessmentTargets');
}
code = code.replaceAll(conceptFpOld, conceptFpNew);

// 7. Update maxDefensibleCapacity fallback in _auditAssessmentTargets
const maxCapOld = `    const liCap = evidencePackage?.lectureIntelligence?.evidenceCapacity || evidencePackage?.lectureIntelligence;
    const maxDefensibleCapacity = isTopicMode
      ? Math.max(requestedCount || 10, 30)
      : (liCap?.totalDefensibleCapacity || (focusList.length > 0 ? focusList.length : requestedCount));`;

const maxCapNew = `    const liCap = evidencePackage?.lectureIntelligence?.evidenceCapacity || evidencePackage?.lectureIntelligence;
    const maxDefensibleCapacity = isTopicMode
      ? Math.max(requestedCount || 10, 30)
      : (liCap?.totalDefensibleCapacity || (focusList.length > 0 ? focusList.length * 4 : requestedCount));`;

if (!code.includes(maxCapOld)) {
  throw new Error('Could not find maxDefensibleCapacity block');
}
code = code.replace(maxCapOld, maxCapNew);

// 8. Update _expandTargetsWithConceptFacets to assign angles and formats
const expandPushOld = `        expanded.push({
          targetId: \`T\${String(expanded.length + 1).padStart(2, '0')}\`,
          subtopic: facet.subtopic,
          concept: cand.name,
          trajectoryPhase: facet.phase,
          timestamp: prov.timestamp,
          tier: facet.tier,
          dimension: facet.dimension,
          cognitiveLevel: facet.cognitiveLevel,
          targetDifficulty: facet.targetDifficulty,
          intendedCognitiveOperation: facet.op,
          bloomLevel: facet.bloomLevel,
          operationalGuidance: facet.guidance,
          evidenceType: prov.evidenceType,
          sourceChunks: prov.sourceChunks,
          requiresExactArtifact: false,
          instruction: facet.instruction,
          supportingEvidence: cand.evidence || facet.instruction,
          evidenceSpan: cand.evidence || facet.instruction,
          confidence: 'HIGH',
          negativeBoundaries: negBoundaries
        });`;

const expandPushNew = `        const facetAngle = facet.angle || this._deriveAssessmentAngle(facet);
        const facetFormat = facet.format || this._deriveFormatRecommendation(facet);
        expanded.push({
          targetId: \`T\${String(expanded.length + 1).padStart(2, '0')}\`,
          macroTopic: cand.name,
          subtopic: facet.subtopic,
          concept: \`\${cand.name} (\${facet.op})\`,
          assessmentAngle: facetAngle,
          learningObjective: facet.instruction,
          specificReasoningTask: facet.guidance,
          formatRecommendation: facetFormat,
          trajectoryPhase: facet.phase,
          timestamp: prov.timestamp,
          tier: facet.tier,
          dimension: facet.dimension,
          cognitiveLevel: facet.cognitiveLevel,
          targetDifficulty: facet.targetDifficulty,
          intendedCognitiveOperation: facet.op,
          bloomLevel: facet.bloomLevel,
          operationalGuidance: facet.guidance,
          evidenceType: prov.evidenceType,
          sourceChunks: prov.sourceChunks,
          requiresExactArtifact: false,
          instruction: facet.instruction,
          supportingEvidence: cand.evidence || facet.instruction,
          evidenceSpan: cand.evidence || facet.instruction,
          confidence: 'HIGH',
          negativeBoundaries: negBoundaries
        });`;

if (!code.includes(expandPushOld)) {
  throw new Error('Could not find expanded.push block in _expandTargetsWithConceptFacets');
}
code = code.replace(expandPushOld, expandPushNew);

// 9. Update prompt instructions in systemPrompt
const promptP8Old = `8. PROGRAMMING & ALGORITHMIC INTENT UNDERSTANDING:
   - When the lecture covers programming, algorithms, data structures, or code mechanics (e.g., loops, nested iterations, arrays, frequency counts, pointers, sorting, searching, recursion):
     * Grounding means capturing the teacher's algorithmic logic and instructional goals.
     * Tag relevant targets with "dimension": "Application" or "Flow / Trace", and "intendedCognitiveOperation": "TRACE", "DIAGNOSE", or "CODE_OR_TRACE".
     * In "operationalGuidance", explicitly instruct Agent 2: "Assess through a concise 3–7 line code snippet (Python, Java, or C) demonstrating this algorithm—test loop iteration tracking, condition completion, output prediction, or duplicate handling."
     * Do NOT require a pre-uploaded code file to plan code-based questions if the lecture teaches programming concepts! Spoken programming lectures teach algorithms that are directly testable via concise code snippets.

9. CANONICAL DOMAIN TRUTH INSTRUCTION:
   - Assessment targets must reflect canonical academic truth of the taught subject. If the speaker made an inadvertent verbal slip, plan the target around the true canonical concept, not the misstatement.

10. DIVERSE CONCEPT DISPERSION (ANTI-REPETITION MANDATE):
   - Every planned target MUST test a distinctly DIFFERENT subtopic or mechanism from the lecture.
   - For an N-question quiz, you must NEVER plan more than 1 target on the basic definition of the overarching subject (e.g. at most ONE target defining "What is IPC?").
   - The remaining targets MUST explore distinct sub-mechanisms (e.g. Target 2: Shared memory vs message passing tradeoffs; Target 3: Semaphore synchronization operations; Target 4: FIFO / named pipe filesystem persistence; Target 5: Deadlock prevention vs avoidance; Target 6: Banker's algorithm safe sequence constraints).
   - Reject redundant concept targets—explore the full breadth of the lecture materials!`;

const promptP8New = `8. NATURAL FORMAT SELECTION & MULTI-ANGLE VARIETY:
   - When the lecture covers programming, algorithms, data structures, or code mechanics (e.g., Euclidean algorithm, recursion, arrays, sorting, searching):
     * Grounding means capturing the teacher's mathematical, conceptual, and algorithmic logic.
     * Do NOT force all algorithm questions to have code snippets! Code is only one assessment format among many.
     * Select the appropriate "assessmentAngle" and "formatRecommendation" matching the educational objective:
       - CONCEPTUAL / PROSE_MULTIPLE_CHOICE: Core definitions, axiomatic properties, and why the algorithm works.
       - CALCULATION / NUMERICAL_TRACE: Step-by-step remainder reductions, recurrence values, or manual parameter evaluations (e.g. calculating GCD steps).
       - REASONING / REASONING_CONTRAST: Invariants (e.g. why GCD is preserved under modulo), time/space complexity tradeoffs, or comparative analysis.
       - CODE_TRACE / CODE_ANALYSIS: Use concise 3–7 line code snippets ONLY when specifically evaluating code execution, missing loop logic, return values, or bug diagnosis.
       - EDGE_CASE / SCENARIO_APPLICATION: Boundary conditions (e.g. zero, negative, empty cases) or realistic engineering applications.

9. CANONICAL DOMAIN TRUTH INSTRUCTION:
   - Assessment targets must reflect canonical academic truth of the taught subject. If the speaker made an inadvertent verbal slip, plan the target around the true canonical concept, not the misstatement.

10. MULTI-ANGLE TOPIC DECOMPOSITION (GROUNDED VARIETY):
   - A single rich topic (e.g. "Euclidean Algorithm", "Virtual Memory") is a source of multiple questions, not a limit of one question!
   - Decompose rich topics into distinct assessment angles: Conceptual understanding, Numerical calculation, Invariant reasoning, Edge cases, and Code tracing.
   - Every planned target MUST test a distinctly DIFFERENT learning objective and reasoning task.
   - Distinct assessment angles on the same core topic are strongly encouraged when supported by the evidence!`;

if (!code.includes(promptP8Old)) {
  throw new Error('Could not find prompt principles 8-10 block');
}
code = code.replace(promptP8Old, promptP8New);

// Restore original line endings (CRLF if original had CRLF)
if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ Phase B successfully applied to agent1Planner.js');
