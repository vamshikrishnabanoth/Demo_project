/**
 * Compact Exemplars: Token-efficient formatting guidance for LLM prompts
 */

const COMPACT_EXEMPLARS = {
  DEFINITION: `
[FORMAT EXAMPLE - DEFINITION]
Stem: Which of the following best defines the primary purpose of [Concept]?
Options: ["A [category] mechanism that [verbatim function].", "A [peer category] protocol used for [alternative].", "A [related term] algorithm for [different role].", "A [component] used to [unrelated action]."]
Correct Answer: "A [category] mechanism that [verbatim function]."
Explanation: The text defines [Concept] as a [category] mechanism for [verbatim function].
`,
  SCENARIO: `
[FORMAT EXAMPLE - SCENARIO]
Stem: An engineer observes [Specific Operational Condition]. Which mechanism is directly regulating this behavior?
Options: ["Primary Protocol Mechanism", "Unrelated Network Protocol", "Secondary Interface Command", "Database Table Operation"]
Correct Answer: "Primary Protocol Mechanism"
Explanation: The observed condition describes [behavior], which directly corresponds to [Primary Protocol Mechanism].
`,
  COMPARATIVE: `
[FORMAT EXAMPLE - COMPARATIVE]
Stem: How does [Concept A] differ from [Concept B] regarding [Feature]?
Options: ["[Concept A] permits [X], whereas [Concept B] restricts to [Y].", "[Concept A] operates at [Layer 1], whereas [Concept B] operates at [Layer 2].", "[Concept A] disables error checking, whereas [Concept B] enforces CRC.", "[Concept A] requires encryption, whereas [Concept B] uses raw sockets."]
Correct Answer: "[Concept A] permits [X], whereas [Concept B] restricts to [Y]."
Explanation: Per the source snippet, [Concept A] permits [X] while [Concept B] limits behavior to [Y].
`,
  CALCULATION: `
[FORMAT EXAMPLE - CALCULATION]
Stem: Given [Variable A = Value A] and [Variable B = Value B], what is the resulting [Target Metric]?
Options: ["[Computed Value]", "[Error Variant 1]", "[Error Variant 2]", "[Raw Input Value]"]
Correct Answer: "[Computed Value]"
Explanation: Formula: Target Metric = Value A - Value B = [Computed Value].
`,
  TROUBLESHOOTING: `
[FORMAT EXAMPLE - TROUBLESHOOTING]
Stem: A system experiences [Diagnostic Failure / Bottleneck]. Which adjustment is most likely to resolve this issue?
Options: ["Adjusting [Primary Parameter] to prevent [Failure Cause].", "Modifying [Unrelated Configuration].", "Disabling [Core Feature] tracking.", "Replacing [Protocol A] with [Protocol B]."]
Correct Answer: "Adjusting [Primary Parameter] to prevent [Failure Cause]."
Explanation: The text notes that insufficient [Primary Parameter] causes [Failure Cause], resolved by adjusting parameter settings.
`
};

module.exports = {
  COMPACT_EXEMPLARS
};
