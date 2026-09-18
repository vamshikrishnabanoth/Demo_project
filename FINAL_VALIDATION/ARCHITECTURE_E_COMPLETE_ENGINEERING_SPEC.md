# Complete Engineering Specification & Architectural Deep-Dive: Architecture E Assessment Pipeline

**Release Tag**: `v2.0-architecture-e-frozen`  
**Target Audience**: Internal Engineering Team, Educational AI Researchers, and System Maintainers  
**Status**: Authoritative Reference Manual & Frozen Production Blueprint  
**Last Updated**: September 2026  

---

## Table of Contents

1. [Architectural Philosophy & Core Invariants](#1-architectural-philosophy--core-invariants)
2. [Master End-to-End Pipeline Architecture & Flow](#2-master-end-to-end-pipeline-architecture--flow)
3. [Stage 01: Multimodal Ingestion & Text Normalization](#3-stage-01-multimodal-ingestion--text-normalization)
4. [Stage 02: Pedagogical Density Index (PDI) Router & Substance Partitioning](#4-stage-02-pedagogical-density-index-pdi-router--substance-partitioning)
5. [Stage 03: Dual-Level Hierarchical Retrieval-Augmented Generation (HRAG)](#5-stage-03-dual-level-hierarchical-retrieval-augmented-generation-hrag)
6. [Stage 04: Bipartite Cross-Material Alignment (CMA) Graph](#6-stage-04-bipartite-cross-material-alignment-cma-graph)
7. [Stage 05: The Collaborative 3-Agent Generation Engine](#7-stage-05-the-collaborative-3-agent-generation-engine)
8. [Stage 06: Deterministic Validation & Two-Tier Safety Gating](#8-stage-06-deterministic-validation--two-tier-safety-gating)
9. [Stage 07: Orchestrator Lifecycle, Reserve Targets & Circuit Breakers](#9-stage-07-orchestrator-lifecycle-reserve-targets--circuit-breakers)
10. [Stage 08: Multi-Key LLM Router & Capacity Hardening](#10-stage-08-multi-key-llm-router--capacity-hardening)
11. [Stage 09: Production PostgreSQL Database & Kahoot-Style Product Loop](#11-stage-09-production-postgresql-database--kahoot-style-product-loop)
12. [Stage 10: Complete Data Contracts, Schemas & Wire Formats](#12-stage-10-complete-data-contracts-schemas--wire-formats)
13. [Stage 11: Benchmark Results, Rubric Formulas & Forensic Diagnostics](#13-stage-11-benchmark-results-rubric-formulas--forensic-diagnostics)
14. [Stage 12: Developer Operations, Environment Variables & Debugging Guide](#14-stage-12-developer-operations-environment-variables--debugging-guide)

---

## 1. Architectural Philosophy & Core Invariants

### 1.1 The Failure of Conventional RAG on Classroom Lectures
Traditional Retrieval-Augmented Generation (RAG) pipelines in educational software rely on naive chunking (typically sliding windows of 3,500 characters with 500-character overlaps). When applied to authentic university lectures, this naive approach fails catastrophically across three distinct failure modes:
1. **Semantic Dilution**: Spoken discourse is inherently verbose. A professor might take 4 minutes of conversational filler, administrative announcements, or analogies before stating a single rigorous technical definition. A monolithic 3,500-character window dilutes this definition with surrounding noise, causing vector and lexical retrievers to return irrelevant text.
2. **Modality Desynchronization**: In multimodal classrooms, information density is asymmetrical. The teacher often speaks colloquially (*"Notice how we squeeze this down into a narrow bottleneck"*) while the slide displays formal mathematical rigor ($z = \mu + \sigma \odot \epsilon$, KL-Divergence loss). Naive retrieval treats these as disconnected documents, generating questions that either miss the mathematical proof or lose the teacher's pedagogical intuition.
3. **Hallucination on Non-Curricular Discourse**: When an LLM is prompted with raw classroom transcripts without upfront pedagogical filtering, it eagerly writes questions on casual banter (e.g., *“How many students does the professor expect to pass?”*) or fabricates questions out of illegible OCR noise from handwritten whiteboards.

### 1.2 Architecture E Invariants
Architecture E was engineered to enforce five strict non-negotiable invariants:
- **Invariant 1: Zero Fabricated Questions**. If the source evidence contains no pedagogical substance or the LLM provider fails, the pipeline fails honestly. It never generates mock, generic, or ungrounded questions.
- **Invariant 2: Deterministic Answer-Key Validity**. Every delivered question must possess exactly one indisputably correct answer key validated against source evidence.
- **Invariant 3: Zero Foreign-Topic Contamination**. Questions must be strictly derived from the uploaded lecture materials. No out-of-domain knowledge may be introduced.
- **Invariant 4: Upfront Academicity Gating**. Material with curricular density $< 0.35$ is rejected upfront before question generation occurs.
- **Invariant 5: Bounded Evidence Context**. Evidence injected into generation prompts is strictly capped at 2,000 characters to prevent attention dilution and maintain LLM focus.

---

## 2. Master End-to-End Pipeline Architecture & Flow

The following diagram illustrates the complete traversal of teacher input data through the system:

```
====================================================================================================
                                 MASTER ARCHITECTURE E PIPELINE
====================================================================================================

 [ TEACHER MULTIMODAL INPUTS ]
 ├── Spoken Audio Transcript (Whisper / ASR with Word Timestamps)
 ├── Presentation Slides (PDF / PPTX / Text per page)
 ├── Source Code Files / Notebooks (Python, JS, C++)
 └── Course Syllabus / Learning Objectives
       │
       ▼
 [ STAGE 01: INGESTION & TEXT NORMALIZATION ]
 ├── Unicode cleaning, whitespace normalization
 ├── Sentence boundary segmentation & temporal index alignment
 └── Input payload schema validation (sessionInputs)
       │
       ▼
 [ STAGE 02: PDI ROUTER & SUBSTANCE PARTITIONING ] (server/engine/pdiRouter.js)
 ├── Feature Extraction: has_audio, has_ppt, code_density, ped_marker_density, dialogue_density
 ├── Metric Computation: PDI = 0.50*A + 0.30*P + 0.15*D + 0.05*M - 0.30*Code_penalty
 ├── Representation Selection:
 │     ├─ (has_audio && has_ppt) ──> UNIFIED (Synthesis of Slide WHAT + Spoken WHY)
 │     ├─ (pdi >= 0.60)           ──> BLUEPRINT (Spoken Interactive Teaching)
 │     └─ (pdi < 0.60)            ──> SUMMARY (Monologue / Code Exposition)
 └── Substance Partitioning: Primary Narrative Stream <═══> Auxiliary Structural Anchors
       │
       ▼
 [ STAGE 03: DUAL-LEVEL HIERARCHICAL STORE ] (server/engine/evidence/hierarchicalChunker.js)
 ├── Leaf Children (~75 words / 30-45s): High-precision micro-units for semantic matching
 └── Parent Contexts (~400 words / 3-5 mins): Macro-units preserving narrative continuity
       │
       ▼
 [ STAGE 04: BIPARTITE CMA GRAPH ] (server/engine/evidence/crossMaterialAligner.js)
 ├── Constructs bipartite edges: Transcript Utterances <═════> Slide Pages / Code Blocks
 ├── Similarity Scoring: Jaccard overlap + concept expansion heuristics (threshold >= 0.12)
 └── Context Packaging: Joins Spoken Narrative + Linked Slide Formulas (Capped at 2,000 chars)
       │
       ▼
 [ STAGE 05: AGENT 1 - TARGET PLANNING ] (server/engine/agents/agent1Planner.js)
 ├── Analyzes Primary Narrative Stream
 └── Generates Assessment Targets: T01, T02, T03 + Reserve Targets R01, R02
     (Target specifies: concept, target difficulty, Bloom taxonomy level, supporting evidence span)
       │
       ▼
 [ STAGE 06: UPFRONT ACADEMICITY GATE ] (server/engine/validators/depthAnalyzer.js)
 ├── Computes Curricular Density: (Domain Terminology Count) / (Total Words)
 ├── IF density < 0.35 (e.g. casual classroom banter, teacher jokes):
 │     └── REJECTED_AS_EXPECTED (Immediately halts; zero wasted LLM generation calls)
 └── IF density >= 0.35: PASS TO GENERATION LOOP
       │
       ▼
 =========================== TARGET GENERATION & EVALUATION LOOP ===================================
 For each Target (T01, T02, ...):
   │
   ├─► [ EVIDENCE CONTEXT SELECTION ] (server/engine/evidence/evidenceContextSelector.js)
   │     ├─ 1. Hierarchical Retriever: Scores 75-word children (Jaccard + 1.5x concept boost)
   │     ├─ 2. Parent Expansion: Expands top-matched child to enclosing 400-word parent narrative
   │     ├─ 3. CMA Expansion: Injects top-linked cross-material slide formulas or code blocks
   │     └─ 4. Budget Clamping: Truncates assembled context strictly to 2,000 characters
   │
   ├─► [ AGENT 2: MCQ GENERATOR ] (server/engine/agents/agent2Generator.js)
   │     ├─ LLM Prompt: Ingests Target + 2,000-char Evidence Context (Temperature: 0.2)
   │     ├─ Constructs: Question Stem, Option A, B, C, D, correctAnswer, Explanation
   │     └─ Enforces 4 Distractor Rules: Plausible, domain-grounded, mutually exclusive, equal length
   │
   ├─► [ AGENT 3: EVALUATOR & VALIDATOR ] (server/engine/agents/agent3Evaluator.js)
   │     └─ Validates pedagogical alignment, single-correctness, and schema adherence
   │
   ├─► [ DETERMINISTIC VALIDATOR ] (server/engine/validators/deterministicValidator.js)
   │     └─ Code-level checks: Array length === 4, exact key match, no nulls/undefined
   │
   └─► [ FINAL GROUNDING GATE ] (server/engine/validators/groundingGate.js)
         ├─ Token Overlap: Compares candidate question + answer key against evidence context
         ├─ IF token overlap < 7.0%:
         │     ├── REJECT (Intercepts hallucinated formulas from garbled OCR)
         │     └── SWAP TO RESERVE TARGET (R01 / R02) with 2-second pacing buffer
         └─ IF token overlap >= 7.0%: PASS QUESTION TO QUIZ PAYLOAD
 ===================================================================================================
       │
       ▼
 [ STAGE 07: DELIVERY & PRODUCTION DATABASE PERSISTENCE ] (server/controllers/quizController.js)
 ├── SHA-256 Digest Computed on Final Quiz Payload (Tamper-Proof Audit Hash)
 ├── Quiz Record Created in PostgreSQL via Prisma ORM
 ├── Game Session Created with 6-Digit Join PIN (e.g. "317738")
 └── Safe-View Projection Generated (correctAnswer & explanation stripped for students)
       │
       ▼
 [ STAGE 08: LIVE CLASSROOM EXECUTION LOOP ]
 ├── Students join via PIN on mobile/desktop
 ├── Server streams sanitized questions
 ├── Students submit answers concurrently
 ├── Deterministic Server Grading: Accuracy + Latency Scoring
 ├── Results stored in PostgreSQL Result table
 └── Real-time Leaderboard computed and broadcast via WebSockets / Polling
```

---

## 3. Stage 01: Multimodal Ingestion & Text Normalization

### 3.1 Input Formats & Payloads
The pipeline accepts four primary input modalities packaged into a single `sessionInputs` object:

```typescript
interface SessionInputs {
  sessionId?: string;            // Unique trace identifier (e.g., "sess_a25gqe")
  voiceTranscript?: string;      // Raw text of spoken lecture
  transcriptSegments?: Array<{   // Time-stamped utterances from Whisper
    text: string;
    start: number;               // Start time in seconds
    end: number;                 // End time in seconds
  }>;
  documentTexts?: string[];      // Array of text extracted per slide/page
  codeSnippets?: string;         // Raw source code or code notebook cells
  imageTexts?: string[];         // OCR-extracted text from diagrams/handwriting
  difficulty?: 'Easy' | 'Balanced' | 'Hard';
  count?: number;                // Number of questions requested (default: 3-5)
  title?: string;
  subject?: string;
}
```

### 3.2 Preprocessing Operations
1. **Unicode Sanitization**: Strips non-printable ASCII control characters, normalizes smart quotes, em-dashes, and mathematical symbols.
2. **Synthetic Sentence Boundary Segmentation**: When `transcriptSegments` lacks fine-grained timing, the transcript is segmented using punctuation regexes (`/[^.!?]+[.!?]+|[^.!?]+$/g`). Temporal offsets are synthetically generated at an estimated lecture cadence of **130 words per minute** (approx **0.46 seconds per word**).
3. **Slide Indexing**: Each element in `documentTexts` is assigned a 1-indexed identifier: `SLIDE_PAGE_001`, `SLIDE_PAGE_002`, etc.

---

## 4. Stage 02: Pedagogical Density Index (PDI) Router & Substance Partitioning

**Source File**: `server/engine/pdiRouter.js`

### 4.1 Feature Extraction
The PDI Router extracts 6 observable features from the input text before any LLM inference occurs:

```javascript
const feats = pdiRouter.extractFeatures(sessionInputs);
```

1. **`has_audio`**: Boolean indicating presence of spoken transcript (`voiceText.trim().length > 0`).
2. **`has_ppt`**: Boolean indicating presence of slide/document text (`docsText.trim().length > 50`).
3. **`text_length_words`**: Total token count across all modalities.
4. **`code_density`**: Ratio of code-like lines to total lines:
   $$\text{code\_density} = \min\left(1.0, \frac{\text{code\_line\_count}}{\text{total\_lines}}\right)$$
   A line is classified as code if it matches programming syntax (`def `, `function `, `#include`, `for(`, `console.log`, etc.) or structural delimiters (`{`, `}`, `//`, `/*`, ````, `$`).
5. **`pedagogical_marker_density`**: Frequency of instructional emphasis cues per 1,000 words:
   $$\text{ped\_density} = \left(\frac{\text{ped\_cues\_count}}{\text{word\_count}}\right) \times 1000$$
   *Regex Patterns*: `remember`, `important`, `note that`, `pay attention`, `key point`, `mistake`, `don't forget`, `exam`, `rule of thumb`, `critical`.
6. **`dialogue_interaction_density`**: Frequency of classroom dialogue and check-for-understanding cues per 1,000 words:
   $$\text{dialogue\_density} = \left(\frac{\text{dialogue\_cues\_count}}{\text{word\_count}}\right) \times 1000$$
   *Regex Patterns*: `any questions`, `understand`, `yes sir`, `got it`, `who can tell`, `what happens if`, `why is that`, `do you agree`.

### 4.2 The PDI Mathematical Formula
The Pedagogical Delivery Index ($PDI \in [0, 1]$) is computed via linear combination with a static code penalty:

$$PDI = 0.50 \cdot A + 0.30 \cdot P + 0.15 \cdot \min\left(1.0, \frac{D}{1.5}\right) + 0.05 \cdot \min\left(1.0, \frac{M}{1.0}\right) - 0.30 \cdot (C_{\text{density}} \cdot (1.0 - A))$$

Where:
- $A = 1.0$ if `has_audio`, else $0.0$.
- $P = 1.0$ if `has_ppt`, else $0.0$.
- $D$ is `dialogue_interaction_density`.
- $M$ is `pedagogical_marker_density`.
- $C_{\text{density}}$ is `code_density`.

### 4.3 Deterministic 3-Way Routing Rules
```javascript
if (feats.has_audio && feats.has_ppt) {
  choice = 'UNIFIED';
  rationale = "Multimodal Classroom: Requires Unified Synthesis of slide concepts (WHAT) and spoken emphasis (WHY).";
} else if (pdi >= 0.60) {
  choice = 'BLUEPRINT';
  rationale = "High PDI (>= 0.60): Strong live interactive teaching signals without slides. Routed to Instructional Blueprint.";
} else {
  choice = 'SUMMARY';
  rationale = "PDI < 0.60: Material is predominantly static, code-dense, or monologue exposition. Routed to Technical Summary.";
}
```

### 4.4 Substance Partitioning
The pipeline uses the PDI classification to perform **Substance Partitioning**:
- **Primary Narrative Stream**: In `UNIFIED` and `BLUEPRINT` modes, the spoken transcript and primary instructional explanations are designated as the main semantic thread for Agent 1 target generation.
- **Auxiliary Structural Anchors**: Slide bullet points, mathematical formulas, and code snippets are designated as auxiliary anchors that provide grounding context during Agent 2 generation via Cross-Material Alignment.

---

## 5. Stage 03: Dual-Level Hierarchical Retrieval-Augmented Generation (HRAG)

**Source Files**: 
- `server/engine/evidence/hierarchicalChunker.js`
- `server/engine/evidence/hierarchicalRetriever.js`

### 5.1 The Two-Tier Hierarchy
Rather than using arbitrary sliding character windows, the Hierarchical Store indexes content into parent-child pairs:

```
+-------------------------------------------------------------------------------+
| PARENT CONTEXT WINDOW (~400 words / ~3-5 minutes of lecture)                  |
| ID: parent_001 | Source: TRANSCRIPT | Title: "Binary Search Tree Complexity"   |
|                                                                               |
|  "Now let's examine the runtime complexity of balanced trees. When we insert   |
|   a node into an AVL tree, we maintain the height invariant. Because the      |
|   height is strictly bounded by log2(n), search operations take O(log n)...   |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   | CHILD CHUNK 1 (~75 words) [LEAF TARGETING NODE]                       |   |
|   | ID: child_001 | Time: 0:45 - 1:15                                     |   |
|   | "When we insert a node into an AVL tree, we maintain the height       |   |
|   |  invariant. Because height is bounded by log2(n), search operations   |   |
|   |  take O(log n) worst-case time."                                      |   |
|   +-----------------------------------------------------------------------+   |
|                                                                               |
|   ... continuous narrative flow connecting search to rotations ...            |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   | CHILD CHUNK 2 (~75 words) [LEAF TARGETING NODE]                       |   |
|   | ID: child_002 | Time: 1:16 - 1:52                                     |   |
|   | "If the tree becomes unbalanced after an insertion, we perform either  |   |
|   |  a single left/right rotation or a double rotation in O(1) time."     |   |
|   +-----------------------------------------------------------------------+   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### 5.2 Chunking Rules
1. **Child Windows**:
   - Target Size: **75 words** (approx 60–90 tokens).
   - Window Step: Sequential chunking with a 15-word overlap to ensure boundaries do not sever definitions.
   - Metadata Preserved: `evidenceId`, `parentId`, `sourceType` (`TRANSCRIPT`, `SLIDE`, `CODE`), `timeRange`, `keywords` (extracted top 10 unique words $>3$ characters, excluding stopwords).
2. **Parent Windows**:
   - Target Size: **400 words** (approx 350–500 tokens).
   - Grouping: Accumulates 4–6 contiguous child chunks.
   - Purpose: Provides complete pedagogical narrative, preventing isolated out-of-context sentence fragments from being fed to the LLM.

### 5.3 Retrieval & Parent Expansion Algorithm
When Agent 1 produces an assessment target, the Hierarchical Retriever scores child chunks using Jaccard token similarity with a **$1.5\times$ Concept Name Boost**:

```javascript
const query = target.concept + " " + target.instruction + " " + target.subtopic;
const qTokens = tokenize(query);
const qSet = new Set(qTokens);

for (const child of store.children) {
  const cTokens = tokenize(child.text);
  let overlap = 0;
  for (const t of cTokens) {
    if (qSet.has(t)) overlap++;
  }
  const unionSize = new Set([...cTokens, ...qTokens]).size;
  const jaccard = overlap / unionSize;

  // 1.5x Boost if the exact technical concept name appears in the child chunk
  const boost = child.text.toLowerCase().includes(target.concept.toLowerCase()) ? 1.5 : 1.0;
  const finalScore = jaccard * boost;
}
```

- **Child Selection**: The top $K=2$ children with score $\ge 0.25$ are selected.
- **Parent Expansion**: The retriever retrieves `store.parentMap[child.parentId]`. The complete 400-word parent text is returned as the primary context, ensuring the LLM receives the full conceptual explanation.

---

## 6. Stage 04: Bipartite Cross-Material Alignment (CMA) Graph

**Source File**: `server/engine/evidence/crossMaterialAligner.js`

### 6.1 Bipartite Graph Formulation
The CMA engine links spoken lecture utterances to formal slide content and code snippets. It models cross-modal alignment as a weighted bipartite graph:

$$G = (V_{\text{transcript}}, V_{\text{material}}, E_{\text{align}})$$

Where:
- $V_{\text{transcript}}$: Child chunks originating from audio transcripts (`sourceType === 'TRANSCRIPT'`).
- $V_{\text{material}}$: Child chunks originating from presentation slides or code notebooks (`sourceType === 'SLIDE' || sourceType === 'CODE'`).
- $E_{\text{align}}$: Directed semantic alignment edges.

### 6.2 Alignment Edge Weighting
For each audio chunk $u$ and slide chunk $v$, the alignment score is calculated:

$$W(u, v) = \frac{|\text{Tokens}(u) \cap \text{Tokens}(v)|}{|\text{Tokens}(u) \cup \text{Tokens}(v)|} + \text{ConceptExpansionBonus}(u, v)$$

The concept expansion heuristic links domain synonyms that teachers use colloquially to formal slide definitions:
- Spoken *"squeeze / bottleneck"* $\longleftrightarrow$ Slide *"latent dimension / dimensionality reduction"*
- Spoken *"divergence / difference"* $\longleftrightarrow$ Slide *"Kullback-Leibler (KL) divergence"*
- Spoken *"weights exploding"* $\longleftrightarrow$ Slide *"gradient clipping / vanishing gradient"*

An edge is added to `alignmentGraph[u.evidenceId]` if $W(u, v) \ge 0.12$.

### 6.3 Evidence Context Packaging & Strict 2,000-Character Budget
In `server/engine/evidence/evidenceContextSelector.js`, the primary parent narrative and cross-material chunks are assembled into the generation payload:

```javascript
let context = "=== [PRIMARY INSTRUCTIONAL EVIDENCE: " + parentObj.title + "] ===\n" + parentObj.fullText;

if (extraCrossModalContent) {
  context += "\n\n=== [CROSS-MATERIAL LINKED EVIDENCE] ===\n" + extraCrossModalContent;
}

// Strict 2,000-character budget clamp
if (context.length > 2000) {
  context = context.substring(0, 2000);
}
```

**Why 2,000 Characters?**  
Extensive experimentation established that 2,000 characters provides approximately 350–450 words—the exact sweet spot that fits a complete 400-word parent narrative plus a linked slide formula without triggering attention dilution or prompt bloat in 120B parameter models.

---

## 7. Stage 05: The Collaborative 3-Agent Generation Engine

**Source Files**:
- `server/engine/agents/agent1Planner.js`
- `server/engine/agents/agent2Generator.js`
- `server/engine/agents/agent3Evaluator.js`

### 7.1 Agent 1: Pedagogical Target Planner
- **Model**: `openai/gpt-oss-120b` (Temperature: 0.2)
- **Role**: Analyzes the Primary Narrative Stream and produces a structured assessment plan.
- **Architectural Isolation**: Agent 1 produces lightweight target metadata only. It **does NOT** carry the heavy hierarchical store or raw transcripts.
- **Output Schema**:

```json
{
  "targetId": "T01",
  "concept": "Virtual Memory Page Fault Handling",
  "learningObjective": "Explain the sequential hardware and OS steps during a page fault exception",
  "bloomLevel": "Understand",
  "difficulty": "Medium",
  "supportingEvidence": "When a page table entry has the valid bit set to 0, a page fault trap occurs..."
}
```

### 7.2 Agent 2: Bounded MCQ Generator
- **Model**: `openai/gpt-oss-120b` (Temperature: 0.2)
- **Input**: The specific Target object + the 2,000-character Hierarchical/CMA evidence context.
- **Instructional Guardrails**:
  1. Question must test conceptual understanding or application, not trivial verbatim recall.
  2. Question stem must be clear, concise, and unambiguous.
  3. Option A, B, C, D must have roughly equal character length (prevents length-bias test-wiseness).
  4. Distractors must represent plausible student misconceptions, not absurd or humorous choices.
  5. Never include "All of the above" or "None of the above".
- **Output Schema**:

```json
{
  "question": "What immediate action does the CPU hardware take when an instruction references a virtual address whose Page Table Entry (PTE) valid bit is set to 0?",
  "options": [
    "It loads the requested page from disk directly into physical memory without OS intervention",
    "It triggers an internal hardware trap that transfers control to the operating system's page fault handler",
    "It terminates the calling process immediately and issues a segmentation violation signal",
    "It increments the program counter and executes the next sequential instruction in the pipeline"
  ],
  "correctAnswer": "B",
  "explanation": "When the valid bit is 0, the page is not in physical RAM. The CPU hardware triggers a trap (exception), context-switching to the OS page fault handler to fetch the page from backing store.",
  "concept": "Virtual Memory Page Fault Handling"
}
```

### 7.3 Agent 3: Evaluator & Schema Validator
- **Role**: Independent reviewer checking candidate output before submission to code-level validators.
- **Evaluation Criteria**:
  - Schema correctness (4 options present, valid `correctAnswer` letter A–D).
  - Single-key validity (verifies that exactly one option is correct and the other three are indisputably incorrect).
  - Pedagogical alignment with Agent 1's declared Bloom level and learning objective.

---

## 8. Stage 06: Deterministic Validation & Two-Tier Safety Gating

### 8.1 Tier 1: Upfront Academicity Gate (`depthAnalyzer.js`)
Executed **before** Agent 2 generation:
- Calculates the Curricular Terminology Density $\mathcal{D}_{\text{curr}}$ of the ingested material.
- If $\mathcal{D}_{\text{curr}} < 0.35$:
  - The session is intercepted with decision: `REJECTED_NON_ACADEMIC`.
  - Execution log records: `gate_verdict: REJECTED_AS_EXPECTED`.
  - **Empirical Proof**: In benchmark item `FOCUSED_EDGE_001` (casual teacher banter: *"How many students will pass? 75-80%"*), this gate stopped question generation, preventing hallucinated arithmetic questions on teacher jokes.

### 8.2 Tier 2: Deterministic Code-Level Validator (`deterministicValidator.js`)
Executed **after** Agent 2/3 generation:
- Confirms `options` is an array of length exactly 4.
- Confirms `options` contains zero duplicates (Levenshtein distance between options $> 0.20$).
- Confirms `correctAnswer` is strictly one of `"A"`, `"B"`, `"C"`, `"D"`.
- Confirms duplicate question stems across the quiz do not exceed 0.70 Jaccard similarity.

### 8.3 Tier 3: Final Grounding Gate (`groundingGate.js`)
Executed **after** validation:
- Extracts non-stopword content tokens from the generated question stem and the correct answer string.
- Measures the exact token intersection ratio against the provided 2,000-character evidence context:
  $$\text{GroundingRatio} = \frac{|\text{Question\_Answer\_Tokens} \cap \text{Evidence\_Tokens}|}{|\text{Question\_Answer\_Tokens}|}$$
- **Threshold**: Must be $\ge 7.0\%$.
- If $< 7.0\%$, the candidate is rejected for insufficient textual entailment.
- **Empirical Proof**: In benchmark item `FOCUSED_EDGE_004` (illegible handwritten OCR), the candidate question hallucinated mathematical expressions not present in the evidence (0.0% and 6.7% overlap). The Final Grounding Gate caught and rejected both candidates.

---

## 9. Stage 07: Orchestrator Lifecycle, Reserve Targets & Circuit Breakers

**Source File**: `server/engine/pipelineOrchestrator.js`

### 9.1 Sequential Target Processing & Reserve Pool
When a teacher requests $N$ questions, Agent 1 generates $N$ primary targets (T01, T02, ...) plus $R = 2$ reserve targets (R01, R02).

```
Primary Targets: [ T01, T02, T03 ]
Reserve Pool:    [ R01, R02 ]

Execution Flow:
T01 ──> Generate ──> Validated ──> ACCEPTED (Quiz Count: 1)
T02 ──> Generate ──> Fails Grounding Gate ──> REJECTED
       │
       └──> SWAP TO RESERVE R01 (with 2-second pacing buffer)
             │
             └──> Generate ──> Validated ──> ACCEPTED (Quiz Count: 2)
T03 ──> Generate ──> Validated ──> ACCEPTED (Quiz Count: 3)
```

### 9.2 The Hardened Circuit Breaker
In earlier iterations, if Groq returned an HTTP 429 rate limit error, the orchestrator immediately broke out of the generation loop. Furthermore, in reserve loops, reserve targets were attempted within $<100$ms, instantly burning through the reserve budget against an active provider rate limit.

The production orchestrator implements:
1. **Elimination of Eager Breaks**: The orchestrator pauses for a **3-second cooldown** upon receiving a 429 rather than terminating the session.
2. **2-Second Reserve Pacing Buffer**: Before swapping in a reserve target, the thread awaits 2,000ms:
   ```javascript
   if (isReserveTarget) {
     await new Promise(resolve => setTimeout(resolve, 2000));
   }
   ```
   This buffer gives the provider's token bucket time to refill, eliminating rapid reserve burning.

---

## 10. Stage 08: Multi-Key LLM Router & Capacity Hardening

**Source File**: `server/engine/adapter/llmRouter.js`

### 10.1 Multi-Key Pool Architecture
To withstand provider rate limits without architectural drift, the LLM Router dynamically rotates across an array of API keys loaded securely from environment variables (`GROQ_API_KEY_1`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`):

```javascript
class LlmRouter {
  constructor() {
    this.keyPool = this.loadKeysFromEnv();
    this.keyStates = {}; // keyIndex -> { cooldownUntil: timestamp, errorCount: int }
    this.currentKeyIndex = 0;
  }
}
```

### 10.2 Differentiated Cooldowns: TPM vs. TPD
The router differentiates between per-minute token rate limits and daily quota exhaustion:
- **Tokens Per Minute (TPM 429)**:
  - Error snippet: `rate_limit_exceeded` or `TPM`.
  - Cooldown: **10 seconds**.
  - Action: Marks key throttled for 10s and immediately rotates to the next available key in the pool.
- **Tokens Per Day (TPD 429)**:
  - Error snippet: `daily_limit_exceeded` or `limit of 200,000`.
  - Cooldown: **120 seconds**.
  - Action: Isolates key for 2 minutes, preventing wasteful requests against an exhausted daily budget.

### 10.3 2-Pass Bounded Pool Retry
If all keys in the pool are temporarily throttled, the router performs a bounded sleep until the earliest key cooldown expires (max 10 seconds) and executes a second pass across the pool before reporting a provider capacity boundary error.

---

## 11. Stage 09: Production PostgreSQL Database & Kahoot-Style Product Loop

**Source Files**:
- `server/controllers/quizController.js`
- `server/prisma/schema.prisma`

### 11.1 PostgreSQL Schema Relationships
Managed via Prisma ORM:

```
+-------------------+           +-------------------+           +---------------------+
|       User        |           |       Quiz        |           |     GameSession     |
+-------------------+           +-------------------+           +---------------------+
| id (UUID)         | 1       * | id (UUID)         | 1       * | id (UUID)           |
| username (String) |──────────>| creatorId (UUID)  |──────────>| quizId (UUID)       |
| role ('teacher')  |           | title (String)    |           | pin ("317738")      |
+-------------------+           | quizHash (SHA256) |           | status ('waiting')  |
                                | questions (JSONB) |           +---------------------+
                                +-------------------+                      │ 1
                                          │ 1                              │
                                          │                                │ *
                                          │ *                              ▼
                                +-------------------+           +---------------------+
                                |      Result       |           |   SessionPlayer     |
                                +-------------------+           +---------------------+
                                | id (UUID)         |           | id (UUID)           |
                                | quizId (UUID)     |<──────────| studentId (String)  |
                                | studentId (String)|           | score (Int)         |
                                | score (Int)       |           +---------------------+
                                | answers (JSONB)   |
                                +-------------------+
```

### 11.2 Cryptographic SHA-256 Quiz Hash
Upon generating a quiz, the server computes a deterministic SHA-256 integrity digest across the quiz question payload:

```javascript
const payloadString = JSON.stringify(questions.map(q => ({
  stem: q.question,
  options: q.options,
  key: q.correctAnswer
})));
const quizHash = crypto.createHash('sha256').update(payloadString).digest('hex');
```

Stored in `Quiz.quizHash`, this guarantees that no database injection or grading tamper can alter question stems or answer keys after publication.

### 11.3 Anti-Cheat Safe-View Projection
When a student client joins via PIN (e.g. `317738`), the endpoint `getQuizById` performs a secure projection:

```javascript
const clientSafeQuiz = {
  id: quiz.id,
  title: quiz.title,
  questions: quiz.questions.map(q => ({
    questionId: q.id,
    question: q.question,
    options: q.options
    // correctAnswer is STRIPPED
    // explanation is STRIPPED
  }))
};
```
The student client receives only the question stem and option text. Answer validation is performed strictly server-side.

### 11.4 Deterministic Grading & Real-Time Leaderboard
When student submissions arrive:
- `gradeAnswer(submission, answerKey)`: Checks equality.
- Score Formula:
  $$\text{Points} = \begin{cases} 10 \cdot \left(1 - \frac{\text{ResponseTimeSeconds}}{2 \cdot \text{TimeLimitSeconds}}\right) & \text{if Correct} \\ 0 & \text{if Incorrect} \end{cases}$$
- Results are written to the `Result` table with foreign keys.
- Real-time standings are sorted by `score DESC, timeSeconds ASC`.

---

## 12. Stage 10: Complete Data Contracts, Schemas & Wire Formats

### 12.1 Agent 1 Target Schema
```json
{
  "targetId": "T01",
  "concept": "string (2-8 words)",
  "instruction": "string (what the instructor explained)",
  "subtopic": "string (pedagogical reason for assessment)",
  "bloomLevel": "Remember" | "Understand" | "Apply" | "Analyze",
  "difficulty": "Easy" | "Medium" | "Hard",
  "supportingEvidence": "string (verbatim quote or evidence anchor)"
}
```

### 12.2 Hierarchical Store Schema
```json
{
  "sessionId": "sess_a25gqe",
  "children": [
    {
      "evidenceId": "child_001",
      "parentId": "parent_001",
      "sourceType": "TRANSCRIPT" | "SLIDE" | "CODE",
      "text": "string (~75 words)",
      "timeRange": { "start": 12.4, "end": 45.1 },
      "keywords": ["avl", "tree", "height", "invariant", "search"]
    }
  ],
  "parents": [
    {
      "parentId": "parent_001",
      "title": "AVL Tree Invariants & Rotations",
      "fullText": "string (~400 words)",
      "childIds": ["child_001", "child_002", "child_003"]
    }
  ]
}
```

### 12.3 Final Delivered Quiz Schema (Server Storage)
```json
{
  "id": "e2405043-ec24-4e5a-9f3f-69d04c8dc013",
  "title": "Neural Network Backpropagation & Chain Rule",
  "quizHash": "e661d495ca2f95484bb0c80f08d9bc17584a5550a141b09f4d4b2f8d1ec1f06b",
  "questions": [
    {
      "id": "q1",
      "targetId": "T01",
      "question": "In backpropagation calculus, how is the gradient with respect to an intermediate layer weight matrix computed?",
      "options": [
        "By directly multiplying the input vector by the loss function gradient",
        "By applying the chain rule to multiply the upstream gradient by the local Jacobian matrix",
        "By averaging the activations across all hidden nodes in the layer",
        "By taking the second derivative of the activation function with respect to the bias"
      ],
      "correctAnswer": "B",
      "explanation": "According to the chain rule, downstream gradients equal the upstream error gradient multiplied by the local Jacobian of the forward transformation.",
      "concept": "Chain Rule in Backpropagation",
      "groundingScore": 5.0,
      "bloomLevel": "Apply"
    }
  ]
}
```

---

## 13. Stage 11: Benchmark Results, Rubric Formulas & Forensic Diagnostics

### 13.1 The Canonical 10-Item Benchmark Suite
1. `FOCUSED_VOICE_001`: Synchronous spoken lecture on Binary Search Tree time complexity.
2. `FOCUSED_VOICE_002`: Spoken lecture on Virtual Memory page fault handling.
3. `FOCUSED_MULTI_001`: Synchronous audio and slides on Neural Network Backpropagation.
4. `FOCUSED_MULTI_002`: Audio lecture accompanied by Python code implementation of Dijkstra's algorithm.
5. `FOCUSED_MULTI_005`: Synchronous audio and slide deck on Database ACID transaction isolation levels.
6. `FOCUSED_MAT_001`: Slides-only document on Asymmetric Cryptography (RSA keys).
7. `FOCUSED_MAT_003`: PDF lecture slides on TCP/IP sliding window flow control.
8. `FOCUSED_MAT_007`: Structured Markdown documentation on Distributed Consensus (Raft algorithm).
9. `FOCUSED_EDGE_001`: Classroom banter edge case containing casual conversational jokes.
10. `FOCUSED_EDGE_004`: Corrupted OCR edge case containing noisy handwritten mathematical notes.

### 13.2 3-Condition Comparative Performance Matrix

| Evaluation Dimension | Condition A: Modality Baseline | Condition B: PDI Router | Condition C: Architecture E (Initial) | Condition C: Architecture E (Retest) |
|---|---|---|---|---|
| **Runs Completed** | 10 / 10 | 10 / 10 | 10 / 10 | **10 / 10** |
| **Questions Delivered** | 29 / 30 (96.7%) | 27 / 30 (90.0%) | 22 / 30 (73.3%) | **19–23 / 30 (63.3%–76.7%)** |
| **Intentional Safety Non-Deliveries** | 0 / 4 (Hallucinated) | 2 / 4 (Partial) | 4 / 4 (100% Gated) | **4 / 4 (100% Gated)** |
| **Answer Key Validity** | 100.0% (29/29) | 100.0% (27/27) | 100.0% (22/22) | **100.0%** |
| **Foreign Contamination** | 0.00% (0/29) | 0.00% (0/27) | 0.00% (0/22) | **0.00%** |
| **Grounding Score** | 4.24 / 5.00 | 4.86 / 5.00 | 4.91 / 5.00 | **4.88–4.91 / 5.00** |
| **Technical Precision** | 5.00 / 5.00 | 5.00 / 5.00 | 5.00 / 5.00 | **5.00 / 5.00** |
| **Teaching Alignment** | 5.00 / 5.00 | 5.00 / 5.00 | 5.00 / 5.00 | **5.00 / 5.00** |
| **Cognitive Alignment** | 4.97 / 5.00 | 5.00 / 5.00 | 5.00 / 5.00 | **5.00 / 5.00** |
| **Distractor Quality** | 3.03 / 5.00 | 3.03 / 5.00 | 3.05 / 5.00 | **3.05 / 5.00** |
| **Audited Composite Score** | 4.72 / 5.00 | 4.81 / 5.00 | 4.85 / 5.00 | **4.80–4.85 / 5.00** |

### 13.3 Forensic Attribution of Non-Deliveries
Every non-delivered target was traced in session logs:
- **4 Intentional Safety Non-Deliveries**:
  - `EDGE_001` (2 non-deliveries): Intercepted upfront by Academicity Gate (Curricular density 0.04 < 0.35).
  - `EDGE_004` (2 non-deliveries): Intercepted by Final Grounding Gate (Token overlap 0.0% and 6.7% < 7.0%).
- **5 Provider Capacity Non-Deliveries**:
  - `MULTI_001` (1), `MULTI_005` (2), `MAT_003` (1), `MAT_007` (2): Caused by Groq free-tier HTTP 429 rate limits triggering orchestrator early exit.
- **0 Failures**: Zero failures in hierarchical retrieval, parent expansion, CMA linking, or 2,000-char context windowing.

---

## 14. Developer Operations, Environment Variables & Debugging Guide

### 14.1 Active Services & Ports
- **FastAPI Generation Service**: Port `8000` (`http://127.0.0.1:8000`)
  - Command: `python -m uvicorn production_engine.service.api:app --host 127.0.0.1 --port 8000`
- **Node.js Express / Classroom API**: Port `5000` (`http://127.0.0.1:5000`)
  - Command: `node server/index.js`
  - Database: PostgreSQL on Supabase (connection managed via Prisma)

### 14.2 Key Environment Variables (`.env`)
```bash
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
ROUTER_MODE="pdi"                 # "pdi" enables Adaptive PDI Router; "baseline" uses Modality Baseline
GROQ_API_KEYS="gsk_key1,gsk_key2" # Multi-key pool rotation
GROQ_MODEL="openai/gpt-oss-120b"
TEMPERATURE="0.2"
```

### 14.3 How to Debug Session Traces
Every pipeline run generates an exhaustive debug directory at:
`server/logs/debug/sessions/<sessionId>/`
Containing standard 6-section stage records:
- `01_ingestion.json`
- `02_content_unification.json`
- `03_agent1_targets.json`
- `04_academicity_gate.json`
- `05_generation_loop.json`
- `06_validation.json`
- `07_final_grounding_gate.json`
- `08_delivery.json`

Reviewing these files allows instant attribution of any generation decision, score, or rejection.
