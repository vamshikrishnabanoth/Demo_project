/**
 * Centralized Prompt Builder Engine Configuration & Fallback Contracts
 * Version: 1.2.0
 */

const PROMPT_CONFIG = {
  VERSION: "1.2.0",
  LLM_PARAMS: {
    TEMPERATURE: 0.35,
    TOP_P: 0.9,
    MAX_TOKENS: 700
  },
  CONTEXT_WINDOW: {
    BASE_PADDING_CHARS: 150,
    MAX_TOTAL_CHARS: 500,
    BOUNDARY_REGEX: /[.!?]\s+|\n{1,2}/
  },
  SYSTEM_PROMPT: `You are an expert academic assessment specialist. Generate a precise, grounded multiple-choice question (MCQ) based EXCLUSIVELY on the provided source text snippet. Do NOT use outside knowledge, speculate, or introduce concepts not explicitly present in the source snippet.`,
  GENERATION_RULES: [
    "1. Grounding: The correct answer and explanation MUST be explicitly supported by the source snippet.",
    "2. Fallback Route: If the source snippet lacks sufficient information to build a valid question under these constraints, set 'status' to 'INSUFFICIENT_EVIDENCE' and leave question fields empty.",
    "3. Distractors: Distractor choices MUST be plausible domain concepts derived from the specified distractorStyle.",
    "4. No Meta-Choices: NEVER use meta-options like 'All of the above', 'None of the above', or 'Both A and B'.",
    "5. Sentence Length: Keep stem character length strictly under maxStemLength.",
    "6. Explanation Citation: The explanation MUST directly quote or reference verbatim source evidence.",
    "7. Do NOT generate character offsets or byte ranges. The system will attach evidence bounds automatically.",
    "8. Multiline & Code Formatting: When generating code snippets, SQL, formulas, or multi-line questions, preserve explicit newlines (\\n) and indentation. Never flatten code or multi-line stems into a single line.",
    "9. Self-Contained Stems & Anti-Meta-Reference: Stems MUST NEVER reference document structure, layout, or meta-labels (e.g. 'Scenario 1', 'Scenario 2', 'In this document', 'In paragraph X', 'Assignment 1'). Write ONLY fully self-contained domain questions (e.g. 'In a product management database, which query displays products with stock less than 20?').",
    "10. Stem Opening Diversity: Vary stem phrasing dynamically. Avoid repetitive openings like 'Which of the following...' or 'What is...'. Use diverse problem-based, diagnostic, scenario, and conceptual phrasing tailored to the target framing style."
  ]
};

module.exports = {
  PROMPT_CONFIG
};
