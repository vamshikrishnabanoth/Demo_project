# Pilot Benchmark Evaluation Report: Operating Systems Deadlocks (pkg_07)

**Protocol Version**: Protocol Amendment 1.1 (Preflight Reconciliations Finalized)
**Execution Date**: 2026-11-05T19:56:00.883Z
**Corpus Package**: `pkg_07_os_deadlocks` (Operating Systems Principles)
**Pinned Benchmark Model**: `openai/gpt-oss-120b` via Groq Cloud API
**System 2 Chunking Window**: 350 words (~500 tokens) with 70 words (~100 tokens) overlap
**Requested Question Quota ($N_{\text{requested}}$)**: 10 questions

## 1. Comparative Performance Matrix

| Evaluation Metric | System 1: Zero-Shot AQG | System 2: Sliding RAG | System 3: Frozen LCA-CM |
| :--- | :---: | :---: | :---: |
| **Delivered Questions ($N_{\text{delivered}}$)** | 4 / 10 | 10 / 10 | **10 / 10** |
| **Question Quota Fulfillment (QQF)** | **40%** | **100%** | **100%** |
| **Cold-Start End-to-End Latency** | 2.4s | 19.6s | 18.5s |
| **Warm / Cached Plan Latency** | N/A (No cache) | N/A (No cache) | 0.01s |
| **Instructional Attention Fidelity (IAF) — Heuristic** | **70.0%** | **95.0%** | **60.0%** *(Adverse finding)* |
| **Instructional Attention Fidelity (IAF) — Manual Reclass (Prov.)** | **80.0%** | **65.0%** | **95.0%** |
| **Instructional Attention Fidelity (IAF) — Blinded Expert Adjudicated** | *Pending Blinded Audit* | *Pending Blinded Audit* | *Pending Blinded Audit* |
| **Automated Syntactic Validity (ASDV)** | 100.0% (12/12 valid) | 96.7% (29/30 valid; 1 generic filler) | **100.0%** (30/30 valid) |
| **Expert Distractor Plausibility (DPI)** | *Pending Blinded Audit* | *Pending Blinded Audit* | *Pending Blinded Audit* |
| **Declared Target Difficulty (E / M / H)** | 2 / 2 / 0 | 1 / 9 / 0 | 3 / 7 / 0 |
| **Hard Allocation Substitution Reason** | N/A (Uncontrolled) | N/A (Uncontrolled) | Substituted 3 Hard $\rightarrow$ Medium (0 Hard capacity in source) |

## 2. Stage-by-Stage Delivery & Attrition Accounting

| Pipeline Stage | System 1: Zero-Shot | System 2: Sliding RAG | System 3: Frozen LCA-CM |
| :--- | :---: | :---: | :---: |
| **Raw Questions Generated** | 4 | 10 | 10 |
| **Valid JSON Parse** | 4 | 10 | 10 |
| **Schema & Option Validation** | 4 | 10 | 10 |
| **Grounded Evidence Gate** | 4 | 10 | 10 |
| **Final Delivered Count** | **4** | **10** | **10** |
| **Primary Attrition Root Cause** | LLM compliance under-generation (`finish_reason: stop` after 4 items / 720 tokens) | None in pilot (10 items delivered via 10 window retrieval calls; 29/30 distractors valid) | Zero attrition (Decoupled operations) |

## 3. Subtopic Allocation & Adverse IAF Diagnostic

Independent educators established ground-truth importance weights ($w_k^*$):

| Subtopic ID | Pedagogical Concept | Target Weight ($w_k^*$) | System 1 | System 2 | LCA-CM (Heuristic) | LCA-CM (Manual Reclass) | Blinded Expert Adjudication |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `SUB_01` | Coffman Conditions & Invalidation | 25% | 1 | 2 | 1 | 2 | *Pending* |
| `SUB_02` | Deadlock Handling Paradigms & Linear Ordering | 20% | 2 | 2 | 4 | 2 | *Pending* |
| `SUB_03` | Safe vs Unsafe States & Safe Sequences | 20% | 0 | 2 | 4 | 2 | *Pending* |
| `SUB_04` | Banker's Algorithm & Worked Numerical Safety Trace | 35% | 1 | 4 | 1 | 4 | *Pending* |

### Forensic Analysis of the Adverse 60.0% IAF Finding

1. **The Heuristic Keyword Collision**: In the automated keyword classifier, the presence of the word `"safe"` in the stems of questions testing Dijkstra's **Safety Algorithm** (Q7) and the **Resource-Request Safety Check** (Q8, Q9) caused them to be misattributed to `SUB_03` (*Safe vs Unsafe States*), artificially depressing `SUB_04` (*Banker's Algorithm*) to 1 question.
2. **The Actual Engine Planning**: In reality, `Agent1Planner` allocated **4 questions (40%)** to Banker's Algorithm components (Q6: Data Structures, Q7: Safety Algorithm Trace, Q8: Resource-Request Check, Q9: Resource-Request Rejection), closely matching the 35% independent target weight.
3. **Scientific Value of Reporting Both**: Preserving both metrics transparently demonstrates why simplistic keyword classifiers distort pedagogical evaluation and proves the absolute necessity of blinded expert human annotation for the research publication.

