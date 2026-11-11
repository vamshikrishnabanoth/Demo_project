# Architecture E Specification (Frozen Production Baseline)
## Pedagogical Multi-Agent MCQ Generation & Multimodal Routing Engine

### 1. Executive Summary & Freeze Status
- **Status**: **FROZEN 🔒** (Production Validated)
- **Pipeline Architecture**: 3-Agent Collaborative Engine (Agent 1 Planner, Agent 2 Generator, Agent 3 Evaluator)
- **Serving Model**: `openai/gpt-oss-120b` via multi-key Groq Cloud rotation pool with automatic rate-limit smoothing
- **Validation Scope**: Focused 10-run representative validation suite across Voice-Only, Multimodal, Material-Only, and Edge Cases
- **Validation Result**: **29 / 30 MCQs delivered (96.7% fulfillment)**, **0.00% foreign contamination**, **100% answer key validity**, and **4.72 / 5.00 corrected composite quality score**.

---

### 2. Canonical Modal Representation Definitions
In alignment with the production implementation in `pipelineOrchestrator.js` (lines 86–92), the canonical representation paths for Architecture E are defined as follows:

| Representation Path | Modal Trigger | Authority Division & Description |
|---|---|---|
| **`SUMMARY`** | **Voice-Only** (`hasVoice && !hasDocs && !hasCode`) | **Narrative Content Representation**: Content representation primarily derived from the spoken lecture narrative, pedagogical cadence, and verbal emphasis cues of the instructor. |
| **`BLUEPRINT`** | **Material-Only** (`!hasVoice && (hasDocs \|\| hasCode)`) | **Structural Blueprint Representation**: Structured representation of concepts, formal definitions, relationships, syllabus hierarchy, and exact artifacts (formulas, tables, code snippets, handwritten circuit diagrams). |
| **`UNIFIED`** | **Voice + Supporting Material** (`hasVoice && (hasDocs \|\| hasCode)`) | **Multimodal Dual-Source Fusion**: Spoken voice guides instructional intent, emphasis, and topic priority, while official slides and documents supply formal precision and exact artifacts. |

---

### 3. Audited 10-Point MCQ Quality Rubric

| Rubric Dimension | Audited Score | Evaluation Standard & Operational Status |
|---|---|---|
| **1. Correctness** | **5.00 / 5.00** | Exactly one unambiguous correct answer matching `correctAnswer` verbatim. |
| **2. Grounding** | **4.24 / 5.00** | Strict adherence to session evidence; 0.00% foreign contamination. |
| **3. Answer Uniqueness** | **5.00 / 5.00** | All 4 options are distinct, defensible, and non-overlapping. |
| **4. Information Sufficiency** | **5.00 / 5.00** | Self-contained, complete question stems (>35 characters). |
| **5. Technical Precision** | **5.00 / 5.00** | Rigorous CS terminology, exact formula syntax, and proper formatting. |
| **6. Teaching Alignment** | **5.00 / 5.00** | Focuses on what was actually taught in the session. |
| **7. Cognitive Alignment** | **4.97 / 5.00** | Multi-dimensional Bloom alignment (Conceptual, Trace, Tradeoff, Scenario, Application). |
| **8. Question Diversity** | **5.00 / 5.00** | Non-generic question stems; 0 semantic duplicates. |
| **9. Naturalness** | **5.00 / 5.00** | Professional instructor-style phrasing without template artifacts. |
| **10. Distractor Quality** | **3.03 / 5.00** | **Documented Limitation**: Option length asymmetry (correct answers more descriptive than distractors). |

**Composite Quality Rating**: **4.72 / 5.00 (EXCELLENT)**

---

### 4. Documented Research Findings & Operational Boundaries

1. **Distractor Construction as a Measurable Improvement Area (3.03 / 5.00)**:
   - Evaluated via the option length balance heuristic (`minOptionLength / maxOptionLength`).
   - The primary LLM (`openai/gpt-oss-120b`) naturally produces thorough, highly descriptive correct answers (often 90–140 characters) while generating more concise distractors (25–45 characters).
   - This represents an authentic, measurable area for future tuning (e.g. adding distractor character-length balance constraints into Agent 2's prompt in future iterations).

2. **Partial-Delivery Safety Mechanism**:
   - When input evidence is sparse (such as conversational banter or low-density recordings), the engine strictly adheres to evidence boundaries, delivering only validated questions and issuing a transparent partial delivery notice rather than hallucinating unsupported questions.

3. **Multi-Key Rate-Limit Resilience**:
   - To operate within Groq Cloud on-demand limits (8,000 Tokens-Per-Minute and 200,000 Tokens-Per-Day), the engine features right-sized prompt contexts (6,000 chars for Agent 1; 2,000 chars for Agents 2 & 3), multi-key pool rotation, and bounded exponential backoff.
