'use strict';

const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../engine/agents/agent2Generator.js');
let raw = fs.readFileSync(targetFile, 'utf8');
const isCRLF = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. Update _enforceBrevity word limits
// Stem word limit: 35 -> 45
code = code.replace(
  '// 1. Stem brevity check: strictly <= 35 words (excluding code blocks)\n    if (typeof stem === \'string\' && stem.length > 0) {\n      const codeBlocks = [];\n      let textWithoutCode = stem.replace(/```[\\s\\S]*?```/g, (match) => {\n        codeBlocks.push(match);\n        return \'\';\n      }).trim();\n\n      const countWords = (txt) => txt.split(/\\s+/).filter(Boolean);\n      let words = countWords(textWithoutCode);\n\n      if (words.length > 35) {',
  '// 1. Stem brevity check: strictly <= 45 words (excluding code blocks)\n    if (typeof stem === \'string\' && stem.length > 0) {\n      const codeBlocks = [];\n      let textWithoutCode = stem.replace(/```[\\s\\S]*?```/g, (match) => {\n        codeBlocks.push(match);\n        return \'\';\n      }).trim();\n\n      const countWords = (txt) => txt.split(/\\s+/).filter(Boolean);\n      let words = countWords(textWithoutCode);\n\n      if (words.length > 45) {'
);

code = code.replace(
  'if (wordsAfterPrefix.length <= 35 && /[?.!]$/.test(trimmed.trim())) {',
  'if (wordsAfterPrefix.length <= 45 && /[?.!]$/.test(trimmed.trim())) {'
);

code = code.replace(
  'if (countWords(questionSentence).length >= 5 && countWords(questionSentence).length <= 35) {',
  'if (countWords(questionSentence).length >= 5 && countWords(questionSentence).length <= 45) {'
);

code = code.replace(
  'if (countWords(capitalized).length >= 5 && countWords(capitalized).length <= 35) {',
  'if (countWords(capitalized).length >= 5 && countWords(capitalized).length <= 45) {'
);

code = code.replace(
  'if (wordsList.length > 35) {\n              const slice = wordsList.slice(0, 35).join(\' \');',
  'if (wordsList.length > 45) {\n              const slice = wordsList.slice(0, 45).join(\' \');'
);

code = code.replace(
  'if (countWords(subClause).length >= 5 && countWords(subClause).length <= 35) {',
  'if (countWords(subClause).length >= 5 && countWords(subClause).length <= 45) {'
);

// Option word limit: 10 -> 15
code = code.replace(
  '// 2. Option brevity check: max 10 words per option\n    if (Array.isArray(parsedMCQ.options)) {\n      parsedMCQ.options = parsedMCQ.options.map(opt => {\n        if (typeof opt !== \'string\') return opt;\n        let cleanOpt = opt.trim();\n        const optWords = cleanOpt.split(/\\s+/).filter(Boolean);\n        if (optWords.length > 10) {\n          // Try safe clause boundaries: semicolon, parenthetical, or non-restrictive relative clause\n          const clauseMatch = cleanOpt.match(/^([^;(]+)[;(]/) ||\n                              cleanOpt.match(/^([^,]+),\\s*(?:which|transferring|where|meaning|resulting|allowing|causing)\\b/i);\n          if (clauseMatch) {\n            const candidate = clauseMatch[1].trim();\n            const candWords = candidate.split(/\\s+/).filter(Boolean);\n            if (candWords.length >= 2 && candWords.length <= 10) {\n              return candidate;\n            }\n          }\n          // Unsafe to trim without risking changing meaning or invalidating answer\n          parsedMCQ._cannotSafelyTrimBrevity = true;\n          return cleanOpt;\n        }',
  '// 2. Option brevity check: max 15 words per option (aligned with prompt 3-15 words)\n    if (Array.isArray(parsedMCQ.options)) {\n      parsedMCQ.options = parsedMCQ.options.map(opt => {\n        if (typeof opt !== \'string\') return opt;\n        let cleanOpt = opt.trim();\n        const optWords = cleanOpt.split(/\\s+/).filter(Boolean);\n        if (optWords.length > 15) {\n          // Try safe clause boundaries: semicolon, parenthetical, or non-restrictive relative clause\n          const clauseMatch = cleanOpt.match(/^([^;(]+)[;(]/) ||\n                              cleanOpt.match(/^([^,]+),\\s*(?:which|transferring|where|meaning|resulting|allowing|causing)\\b/i);\n          if (clauseMatch) {\n            const candidate = clauseMatch[1].trim();\n            const candWords = candidate.split(/\\s+/).filter(Boolean);\n            if (candWords.length >= 2 && candWords.length <= 15) {\n              return candidate;\n            }\n          }\n          // Unsafe to trim without risking changing meaning or invalidating answer\n          parsedMCQ._cannotSafelyTrimBrevity = true;\n          return cleanOpt;\n        }'
);

// Update error message in generateQuestion for brevity
code = code.replace(
  'message: `Model output for target "${target.concept}" exceeded word limits (stem <= 35 words, options <= 10 words) and could not be safely trimmed without altering semantics.`,',
  'message: `Model output for target "${target.concept}" exceeded word limits (stem <= 45 words, options <= 15 words) and could not be safely trimmed without altering semantics.`,'
);

// 2. Update _buildOperationalScaffolding signature & code format decoupling
const oldScaffoldStart = `  _buildOperationalScaffolding(tier, op, concept = '', evidenceContext = '', repairInstruction = null, targetArchetype = null) {`;
const newScaffoldStart = `  _buildOperationalScaffolding(tier, op, concept = '', evidenceContext = '', repairInstruction = null, targetArchetype = null, target = null) {`;

if (!code.includes(oldScaffoldStart)) {
  throw new Error('Could not find _buildOperationalScaffolding signature');
}
code = code.replace(oldScaffoldStart, newScaffoldStart);

// Replace lines 1146-1165 in _buildOperationalScaffolding
const oldAlgoBlock = `    if (isAlgorithm || opUpper === 'CODE_OR_TRACE') {
      systemScaffold += \`
   * ALGORITHMIC & CODE QUESTION SPECIFICATION:
     - Include a clean, concise 3–7 line code snippet (Python, Java, C, or standard pseudocode).
     - Employ varied questioning strategies:
       (1) Output Prediction: Given an input array, predict what the snippet outputs.
       (2) Code Completion: Ask which condition or statement should replace "/* MISSING */" to avoid duplicate recounting or handle boundary conditions.
       (3) State Tracing: Ask for the exact variable value (e.g. count, visited[j]) after a specific loop pass.
       (4) Bug Diagnosis: What defect occurs if a specific line (e.g. visited[j] = true) is omitted?
       (5) Edge Case Analysis: How does the algorithm behave on an array with all identical elements or an empty array?
       (6) Complexity Tradeoff: Compare the time/space complexity of this nested-loop solution against an auxiliary hash map.
     - Keep stems crisp and concise (strictly under 35 words plus code snippet).\`;

      userScaffold += \`
[ALGORITHMIC & CODE STRUCTURAL GUIDANCE]:
- Include a concise 3–7 line code snippet testing the taught algorithmic logic.
- Test concrete execution behavior (output prediction, state tracing, missing condition, or bug diagnosis).
- Stems must be crisp and under 35 words followed by the code snippet.\`;
    }`;

const newAlgoBlock = `    const formatRec = String(target?.formatRecommendation || '').toUpperCase();
    const angleUpper = String(target?.assessmentAngle || '').toUpperCase();

    const wantsCode = formatRec === 'CODE_ANALYSIS' ||
      angleUpper === 'CODE_TRACE' ||
      opUpper === 'CODE_OR_TRACE' ||
      targetArchetype === 'MICRO_TRACE' ||
      targetArchetype === 'DIAGNOSTIC_BUG_HUNT';

    const wantsProse = formatRec === 'PROSE_MULTIPLE_CHOICE' || angleUpper === 'CONCEPTUAL';
    const wantsCalculation = formatRec === 'NUMERICAL_TRACE' || angleUpper === 'CALCULATION';
    const wantsReasoning = formatRec === 'REASONING_CONTRAST' || angleUpper === 'REASONING';
    const wantsScenario = formatRec === 'SCENARIO_APPLICATION' || angleUpper === 'APPLICATION';

    if (wantsCode) {
      systemScaffold += \`
   * CODE ANALYSIS & TRACE QUESTION SPECIFICATION:
     - Include a clean, concise 3–7 line code snippet (Python, Java, C, or standard pseudocode).
     - Employ varied questioning strategies:
       (1) Output Prediction: Given an input, predict what the snippet outputs.
       (2) Code Completion: Ask which condition or statement should replace "/* MISSING */" to handle boundary conditions or state transitions.
       (3) State Tracing: Ask for the exact variable value or call frame state after a specific line or recursive step.
       (4) Bug Diagnosis: What defect occurs if a specific base case or index increment is omitted?
     - Keep stems crisp and concise (strictly under 45 words plus code snippet).\`;

      userScaffold += \`
[CODE ANALYSIS STRUCTURAL GUIDANCE]:
- Include a concise 3–7 line code snippet testing the algorithmic execution logic.
- Test concrete execution behavior (output prediction, state tracing, missing condition, or bug diagnosis).
- Stems must be crisp and under 45 words followed by the code snippet.\`;
    } else if (wantsCalculation) {
      systemScaffold += \`
   * CALCULATION & NUMERICAL TRACE SPECIFICATION:
     - Formulate a concrete manual calculation or parameter trace based on the taught algorithm/formulas (e.g. Euclidean remainder steps, modulo reductions, or recurrence substitutions).
     - STRICT PROHIBITION: Do NOT wrap this in a programming language code block. Pose the calculation directly in words and mathematical expressions.
     - Distractors must represent plausible computational errors (e.g. off-by-one, inverted remainder, missing final reduction).\`;

      userScaffold += \`
[CALCULATION / NUMERICAL TRACE STRUCTURAL GUIDANCE]:
- Present a concrete numerical calculation problem based on the taught rule.
- Do NOT provide a programming code snippet. Test manual calculation of the taught rule.\`;
    } else if (wantsReasoning) {
      systemScaffold += \`
   * REASONING & INVARIANT CONTRAST SPECIFICATION:
     - Formulate a reasoning question explaining WHY a mathematical rule or invariant holds (e.g. why the GCD is preserved when replacing (a, b) with (b, a mod b)), or comparing algorithmic tradeoffs.
     - STRICT PROHIBITION: Do NOT include a code block. Focus entirely on logical reasoning and conceptual cause-and-effect.\`;

      userScaffold += \`
[REASONING / INVARIANT STRUCTURAL GUIDANCE]:
- Focus on the mathematical or conceptual invariant/reasoning behind the algorithm.
- Do NOT provide a programming code snippet.\`;
    } else if (wantsScenario) {
      systemScaffold += \`
   * SCENARIO APPLICATION SPECIFICATION:
     - Present a realistic engineering scenario or practical application of the taught concept.
     - Keep the scenario concise (1 short sentence setting the real-world context).\`;

      userScaffold += \`
[SCENARIO APPLICATION GUIDANCE]:
- Frame as a concise real-world applied scenario without code snippets unless specifically necessary.\`;
    } else if (wantsProse) {
      systemScaffold += \`
   * CONCEPTUAL PROSE SPECIFICATION:
     - Present the question entirely in academic English prose.
     - STRICT PROHIBITION: Do NOT include any code blocks, programming scripts, or syntax-tracing snippets. Focus on foundational understanding and terminology.\`;

      userScaffold += \`
[CONCEPTUAL PROSE GUIDANCE]:
- Frame as conceptual prose. Do NOT include any code snippets.\`;
    }`;

if (!code.includes(oldAlgoBlock)) {
  throw new Error('Could not find oldAlgoBlock');
}
code = code.replace(oldAlgoBlock, newAlgoBlock);

// 3. Update call to _buildOperationalScaffolding in generateQuestion to pass target
const oldCall = `    const { systemScaffold, userScaffold, repairGuardrail, archetypeScaffold } = this._buildOperationalScaffolding(
      tier,
      op,
      target.concept,
      evidenceContext,
      repairInstruction,
      targetArchetype
    );`;

const newCall = `    const { systemScaffold, userScaffold, repairGuardrail, archetypeScaffold } = this._buildOperationalScaffolding(
      tier,
      op,
      target.concept,
      evidenceContext,
      repairInstruction,
      targetArchetype,
      target
    );`;

if (!code.includes(oldCall)) {
  throw new Error('Could not find oldCall to _buildOperationalScaffolding');
}
code = code.replace(oldCall, newCall);

// 4. In generateQuestion, add target.assessmentAngle and target.formatRecommendation to question metadata
const oldMeta = `  "metadata": {
    "dimension": "\${target.dimension || 'Conceptual'}",
    "cognitiveLevel": "\${target.cognitiveLevel || 'Understand'}",
    "targetDifficulty": "\${tier}",
    "intendedCognitiveOperation": "\${op}",
    "questionArchetype": "\${targetArchetype}"
  }`;

const newMeta = `  "metadata": {
    "dimension": "\${target.dimension || 'Conceptual'}",
    "cognitiveLevel": "\${target.cognitiveLevel || 'Understand'}",
    "targetDifficulty": "\${tier}",
    "intendedCognitiveOperation": "\${op}",
    "questionArchetype": "\${targetArchetype}",
    "assessmentAngle": "\${target.assessmentAngle || 'CONCEPTUAL'}",
    "formatRecommendation": "\${target.formatRecommendation || 'PROSE_MULTIPLE_CHOICE'}"
  }`;

if (!code.includes(oldMeta)) {
  throw new Error('Could not find oldMeta block in systemPrompt');
}
code = code.replace(oldMeta, newMeta);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ Phase C successfully applied to agent2Generator.js');
