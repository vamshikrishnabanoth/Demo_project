# Phase 4 Experiment 4.2b: Frozen 17-Unit Zero-Shot LLM Behavior Classification

**Evaluation Type:** Isolated Phase 4 Empirical Experiment  
**Status:** Complete (Step 1 Finished)  
**Baseline Git Commit:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0`  
**Baseline Tag:** `v3.4-frozen`  
**Timestamp:** 2026-09-29T18:15:36Z  
**Primary Artifact:** `experiments/experiment_4_2b/results_experiment_4_2b.json`  
**Artifact SHA-256:** `a2d3b90da4028cfb8fcd537db139cf0c96adfa4909ef14cac948b2cbe69dba37`

---

## 1. Objective

The objective of **Experiment 4.2b (Step 1)** is to evaluate whether a zero-shot Large Language Model (LLM) classifier (`C4_LLM_ZERO_SHOT`, powered by `openai/gpt-oss-120b` via Groq) can classify observable teaching behaviors across the 17 frozen evaluation units established in Experiment 4.2 more accurately and robustly than the frozen deterministic baseline classifiers (`C1_LEXICAL`, `C2_CONTEXTUAL`, `C3_HYBRID`).

### Strict Scientific Boundary
In strict accordance with the scientific framing established in Experiment 4.2:
1. **Observable Behavior vs. Latent Intent:** This experiment measures the classification of *observable surface teaching behaviors* (e.g., explaining, tracing code, comparing methods, asking questions) from lecture transcripts. It does **not** evaluate latent psychological intent, teacher motivation, or downstream question generation strategies.
2. **Evaluation Scope:** The evaluation is strictly restricted to the 17 frozen units across two distinct lecture styles (`BENCH_04` Monologue and `BENCH_03` Interactive Dialogue). It does not represent proof of generalizability to unseen instructors or across arbitrary academic domains.
3. **Hard System Isolation:** Phase 3.4 code remains completely frozen at `b1b1553` (`v3.4-frozen`). No production files, agents (`Agent 1/2/3`), PDI metrics, deterministic validators, grounding gates, or Phase 3 benchmark harness components were altered. All experiment code and data reside exclusively under `experiments/experiment_4_2b/`.

---

## 2. Frozen Dataset

The evaluation dataset is identical to the human-annotated ground truth used in Experiment 4.2 (`experiments/experiment_4_2/ground_truth/behavior_annotations.json`).

### Dataset Summary
- **Total Evaluation Units:** 17 units (1,745.2 seconds / 29.1 minutes of lecture transcript)
- **Total Ground Truth Behavioral Labels:** 47 label instances across 12 canonical behaviors
- **Benchmark Breakdown:**
  - **BENCH_04 (Git Lecture - Monologue):** 10 units (`GT-G00` to `GT-G09`), 657.2 seconds total duration. Represents structured, continuous monologue presentation with slide progression and command-line terminal demonstrations. Contains 20 human label instances (mean: 2.0 labels/unit).
  - **BENCH_03 (GCD/LCM & Recursion Lecture - Deepa Madam):** 7 units (`GT-D01` to `GT-D07`), 1,088.0 seconds total duration. Represents interactive classroom dialogue characterized by student questioning, code tracing, live debugging, and conversational cadence. Contains 27 human label instances (mean: 3.86 labels/unit).

### Canonical 12-Behavior Taxonomy
The 12 canonical observable teaching behaviors defined and evaluated are:
1. `EXPLAIN`: Teacher explains, defines, introduces, or clarifies a concept.
2. `DEMONSTRATE`: Teacher demonstrates a procedure, command, syntax, execution, or concrete steps.
3. `COMPARE`: Teacher explicitly compares or contrasts two or more concepts, techniques, or algorithms.
4. `DEBUG`: Teacher identifies, diagnoses, or fixes an error, misconception, bug, or incorrect attempt.
5. `PREDICT_CHANGE`: Teacher asks or explains what happens if a parameter, condition, input, or code changes.
6. `ASK_WHY`: Teacher asks a 'why' question, demands conceptual justification, or explains underlying reasons.
7. `PRACTICE`: Teacher gives a task, exercise, prompt, or challenge for students to try.
8. `REAL_WORLD_APP`: Teacher explicitly connects the taught concept to a real-world or practical application.
9. `EDGE_CASE`: Teacher explicitly examines a boundary condition, exceptional case, limiting case, or unusual input.
10. `CODE_TRACE`: Teacher explicitly traces program execution, variable/state changes, control flow, recursion, or stack behavior.
11. `STUDENT_INTERACT`: Observable interaction with students (responding to student questions, eliciting responses, dialogue).
12. `REINFORCE`: Teacher explicitly reiterates, emphasizes, summarizes, or reinforces an important prior point.

---

## 3. Classifier Definition

### C4_LLM_ZERO_SHOT Specification
The candidate classifier `C4_LLM_ZERO_SHOT` evaluates each lecture unit individually using a structured zero-shot prompt.

- **Model:** `openai/gpt-oss-120b`
- **Mode:** Zero-shot multi-label classification via Groq chat completion API with structured JSON schema (`response_format: { type: 'json_object' }`).
- **Prompt Constraints:**
  - Explicit canonical definitions for all 12 behaviors provided in system prompt.
  - Strict negative constraints:
    - *"Classify observable teaching behavior only."*
    - *"Do not infer hidden psychological intent."*
    - *"Do not infer question-generation strategy."*
    - *"Do not add labels merely because a behavior is plausible from the subject matter."*
    - *"Be conservative: absence of evidence means absence of the label."*
  - Requires supporting textual evidence: for every predicted label, the model must extract an exact substring quote from the transcript segment.
- **Zero Few-Shot Leakage:** No examples from the 17 evaluation units were provided as few-shot demonstrations, ensuring zero test-set contamination.

---

## 4. Runtime Configuration

| Parameter | Configuration Value |
|---|---|
| **API Provider** | Groq |
| **Model ID** | `openai/gpt-oss-120b` |
| **Sampling Temperature** | `0.0` (Strict Determinism) |
| **Response Format** | `json_object` |
| **Execution Environment** | Node.js v24.10.0 |
| **Units Attempted** | 17 / 17 (100%) |
| **Units Successfully Classified** | 17 / 17 (100%) |
| **Infrastructure Failures** | 0 |
| **HTTP Retries Required** | 0 |
| **Total API Wall-Clock Time** | 162,129 ms (~162.1 s) |
| **Mean Request Latency** | 9,537 ms / unit |
| **Median Request Latency** | 6,848 ms / unit |
| **Min / Max Latency** | 758 ms / 25,219 ms |

---

## 5. BENCH_04 Results (Git Monologue)

`BENCH_04` consists of 10 transcript units of continuous technical monologue.

### Aggregate Performance
- **Micro Precision:** 56.00% (14 TP / 25 Total Predicted)
- **Micro Recall:** 70.00% (14 TP / 20 Total Ground Truth)
- **Micro F1:** 62.22%
- **Macro Precision:** 21.67%
- **Macro Recall:** 27.78%
- **Macro F1:** 21.81%
- **Active Predicted Classes:** 9 / 12

### Per-Behavior Breakdown
| Behavior | Human Support | TP | FP | FN | Precision | Recall | F1 Score | Low-Support Note |
|---|---|---|---|---|---|---|---|---|
| **EXPLAIN** | 9 | 9 | 1 | 0 | 90.00% | 100.00% | 94.74% | High Support |
| **DEMONSTRATE** | 8 | 4 | 1 | 4 | 80.00% | 50.00% | 61.54% | High Support |
| **COMPARE** | 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | Low Support (N=1) |
| **DEBUG** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | Zero Support |
| **PREDICT_CHANGE** | 0 | 0 | 1 | 0 | 0.00% | 0.00% | 0.00% | Zero Support (1 FP) |
| **ASK_WHY** | 0 | 0 | 1 | 0 | 0.00% | 0.00% | 0.00% | Zero Support (1 FP) |
| **PRACTICE** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | Zero Support |
| **REAL_WORLD_APP** | 0 | 0 | 3 | 0 | 0.00% | 0.00% | 0.00% | Zero Support (3 FP) |
| **EDGE_CASE** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | Zero Support |
| **CODE_TRACE** | 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | Low Support (N=1) |
| **STUDENT_INTERACT** | 0 | 0 | 1 | 0 | 0.00% | 0.00% | 0.00% | Zero Support (1 FP) |
| **REINFORCE** | 1 | 1 | 3 | 0 | 25.00% | 100.00% | 40.00% | Low Support (N=1, 3 FP) |

### Profile Divergence
- **Total Variation Distance (TVD):** `0.3500`
- **Cosine Distance:** `0.1095`

### Key Observations on BENCH_04
1. **High Explain Recognition:** `EXPLAIN` was captured with 100% recall (9/9) and 90% precision.
2. **Demonstrate Under-Detection:** `DEMONSTRATE` suffered 4 false negatives (50% recall). In units `GT-G01`, `GT-G03`, `GT-G04`, and `GT-G06`, the instructor described running terminal commands (`git version`, `git init`, `git status`, `git commit`), but C4 labeled them purely as `EXPLAIN`, missing the demonstration aspect.
3. **Severe Multi-Label Overprediction:** C4 hallucinated pedagogical behaviors that were absent in the pure monologue:
   - `REAL_WORLD_APP` (3 FP): C4 repeatedly labeled general remarks about software developers using Git as real-world applications.
   - `REINFORCE` (3 FP): C4 labeled routine transitions as explicit reinforcements.
   - `STUDENT_INTERACT` (1 FP): In `GT-G09`, C4 mistook a rhetorical monologue question (*"To do that what we have to do? You have to type git init"*) for genuine student interaction.

---

## 6. BENCH_03 Results (Interactive Dialogue)

`BENCH_03` consists of 7 transcript units of dynamic classroom dialogue covering GCD, LCM, and recursive palindrome checking.

### Aggregate Performance
- **Micro Precision:** 47.37% (18 TP / 38 Total Predicted)
- **Micro Recall:** 66.67% (18 TP / 27 Total Ground Truth)
- **Micro F1:** 55.38%
- **Macro Precision:** 44.76%
- **Macro Recall:** 58.33%
- **Macro F1:** 48.72%
- **Active Predicted Classes:** 12 / 12

### Per-Behavior Breakdown
| Behavior | Human Support | TP | FP | FN | Precision | Recall | F1 Score | Low-Support Note |
|---|---|---|---|---|---|---|---|---|
| **EXPLAIN** | 4 | 4 | 3 | 0 | 57.14% | 100.00% | 72.73% | Moderate Support |
| **DEMONSTRATE** | 5 | 5 | 1 | 0 | 83.33% | 100.00% | 90.91% | Moderate Support |
| **COMPARE** | 3 | 2 | 1 | 1 | 66.67% | 66.67% | 66.67% | Moderate Support |
| **DEBUG** | 3 | 1 | 1 | 2 | 50.00% | 33.33% | 40.00% | Moderate Support |
| **PREDICT_CHANGE** | 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | Low Support (N=1) |
| **ASK_WHY** | 2 | 0 | 1 | 2 | 0.00% | 0.00% | 0.00% | Low Support (N=2) |
| **PRACTICE** | 2 | 2 | 3 | 0 | 40.00% | 100.00% | 57.14% | Low Support (N=2, 3 FP) |
| **REAL_WORLD_APP** | 1 | 1 | 0 | 0 | 100.00% | 100.00% | 100.00% | Low Support (N=1) |
| **EDGE_CASE** | 1 | 1 | 0 | 0 | 100.00% | 100.00% | 100.00% | Low Support (N=1) |
| **CODE_TRACE** | 2 | 2 | 3 | 0 | 40.00% | 100.00% | 57.14% | Low Support (N=2, 3 FP) |
| **STUDENT_INTERACT** | 2 | 0 | 4 | 2 | 0.00% | 0.00% | 0.00% | Low Support (N=2, 4 FP) |
| **REINFORCE** | 1 | 0 | 3 | 1 | 0.00% | 0.00% | 0.00% | Low Support (N=1, 3 FP) |

### Profile Divergence
- **Total Variation Distance (TVD):** `0.2242`
- **Cosine Distance:** `0.0841`

### Key Observations on BENCH_03
1. **High Semantic Recall:** C4 achieved 100% recall on `EXPLAIN`, `DEMONSTRATE`, `PRACTICE`, `REAL_WORLD_APP`, `EDGE_CASE`, and `CODE_TRACE`.
2. **Edge Case Resolution:** C4 perfectly identified the recursive base-case boundary analysis in `GT-D07` (*"When you have only one always... what is the extreme case? I having only one character..."*) with 0 false positives.
3. **Conversational Act Misclassification:** C4 failed completely on `STUDENT_INTERACT` (F1 = 0.0%), producing 4 false positives and 2 false negatives (detailed in Section 9).
4. **Substantial Over-Attribution:** C4 predicted 38 behavioral labels across 7 units (5.43 labels/unit), compared to 27 human labels (3.86 labels/unit), degrading precision to 47.37%.

---

## 7. Combined Results (17-Unit Aggregate)

Aggregating all 17 units across both lectures yields the overall zero-shot performance of `C4_LLM_ZERO_SHOT`.

### Aggregate Performance
- **Total Ground Truth Instances:** 47
- **Total C4 Predicted Instances:** 63 (34.0% inflation in label volume)
- **True Positives (TP):** 32
- **False Positives (FP):** 31
- **False Negatives (FN):** 15
- **Micro Precision:** **50.79%** (32 / 63)
- **Micro Recall:** **68.09%** (32 / 47)
- **Micro F1:** **58.18%**
- **Macro Precision:** **41.19%**
- **Macro Recall:** **55.77%**
- **Macro F1:** **44.01%**
- **Active Predicted Classes:** 12 / 12

### Per-Behavior Combined Summary
| Behavior | Human Support | TP | FP | FN | Precision | Recall | F1 Score |
|---|---|---|---|---|---|---|---|
| **EXPLAIN** | 13 | 13 | 4 | 0 | 76.47% | 100.00% | 86.67% |
| **DEMONSTRATE** | 13 | 9 | 2 | 4 | 81.82% | 69.23% | 75.00% |
| **COMPARE** | 4 | 2 | 1 | 2 | 66.67% | 50.00% | 57.14% |
| **DEBUG** | 3 | 1 | 1 | 2 | 50.00% | 33.33% | 40.00% |
| **PREDICT_CHANGE** | 1 | 0 | 1 | 1 | 0.00% | 0.00% | 0.00% |
| **ASK_WHY** | 2 | 0 | 2 | 2 | 0.00% | 0.00% | 0.00% |
| **PRACTICE** | 2 | 2 | 3 | 0 | 40.00% | 100.00% | 57.14% |
| **REAL_WORLD_APP** | 1 | 1 | 3 | 0 | 25.00% | 100.00% | 40.00% |
| **EDGE_CASE** | 1 | 1 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| **CODE_TRACE** | 3 | 2 | 3 | 1 | 40.00% | 66.67% | 50.00% |
| **STUDENT_INTERACT** | 2 | 0 | 5 | 2 | 0.00% | 0.00% | 0.00% |
| **REINFORCE** | 2 | 1 | 6 | 1 | 14.29% | 50.00% | 22.22% |

### Combined Profile Divergence
- **Combined Total Variation Distance (TVD):** `0.1999`
- **Combined Cosine Distance:** `0.0650`

---

## 8. C1/C2/C3/C4 Comprehensive Comparison

Direct comparison between the frozen deterministic classifiers from Experiment 4.2 (`C1_LEXICAL`, `C2_CONTEXTUAL`, `C3_HYBRID`) and the zero-shot LLM classifier (`C4_LLM_ZERO_SHOT`).

### Table 8.1: BENCH_04 (Monologue Lecture)
| Classifier | Micro P | Micro R | Micro F1 | Macro P | Macro R | Macro F1 | TVD | Cosine Dist |
|---|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **83.33%** | **75.00%** | **78.95%** | **62.04%** | **59.26%** | **60.13%** | **0.1667** | **0.0395** |
| **C2_CONTEXTUAL** | 78.95% | **75.00%** | 76.92% | 53.17% | 50.79% | 51.54% | 0.1842 | 0.0435 |
| **C3_HYBRID** | 57.69% | **75.00%** | 65.22% | 40.67% | 50.79% | 40.43% | 0.3346 | 0.1819 |
| **C4_LLM_ZERO_SHOT** | 56.00% | 70.00% | 62.22% | 21.67% | 27.78% | 21.81% | 0.3500 | 0.1095 |

### Table 8.2: BENCH_03 (Interactive Dialogue)
| Classifier | Micro P | Micro R | Micro F1 | Macro P | Macro R | Macro F1 | TVD | Cosine Dist |
|---|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **56.00%** | 51.85% | 53.85% | 50.00% | 56.11% | 48.97% | 0.2815 | 0.1738 |
| **C2_CONTEXTUAL** | 51.61% | 59.26% | 55.17% | **52.78%** | 64.44% | **53.13%** | 0.2700 | 0.1985 |
| **C3_HYBRID** | 44.74% | 62.96% | 52.31% | 48.61% | **67.22%** | 49.27% | 0.3294 | 0.2617 |
| **C4_LLM_ZERO_SHOT** | 47.37% | **66.67%** | **55.38%** | 44.76% | 58.33% | 48.72% | **0.2242** | **0.0841** |

### Table 8.3: Combined 17-Unit Aggregate
| Classifier | Micro P | Micro R | Micro F1 | Macro P | Macro R | Macro F1 | TVD | Cosine Dist |
|---|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **67.44%** | 61.70% | **64.44%** | 49.73% | 60.20% | 52.54% | **0.1732** | **0.0463** |
| **C2_CONTEXTUAL** | 62.00% | 65.96% | 63.92% | **52.11%** | 68.54% | **56.24%** | 0.2047 | 0.0839 |
| **C3_HYBRID** | 50.00% | **68.09%** | 57.66% | 45.70% | **71.31%** | 50.04% | 0.3228 | 0.2048 |
| **C4_LLM_ZERO_SHOT** | 50.79% | **68.09%** | 58.18% | 41.19% | 55.77% | 44.01% | 0.1999 | 0.0650 |

### Factual Comparative Findings
1. **On Continuous Monologue (`BENCH_04`):** Deterministic lexical rules (`C1_LEXICAL`) outperformed the zero-shot LLM (`C4`) on BENCH_04 across the reported metrics (Micro F1: **78.95% vs. 62.22%**; Macro F1: **60.13% vs. 21.81%**; TVD: **0.1667 vs. 0.3500**). In structured monologue, instructor phrasing is predictable and concise; the LLM exhibits unwarranted over-interpretation, generating false positives for conversational and contextual behaviors.
2. **On Interactive Dialogue (`BENCH_03`):** The zero-shot LLM (`C4`) achieves the highest Micro Recall (**66.67%** vs. 51.85% for C1 and 59.26% for C2) and lowest profile divergence (**TVD = 0.2242, Cosine Dist = 0.0841**). It ties C2 for the highest Micro F1 (**55.38% vs. 55.17%**). However, precision remains low (**47.37%**) due to indiscriminate multi-label assignment.
3. **Across the Aggregate 17 Units:** Deterministic classifiers retain superior overall precision and macro-averaged balance. `C1_LEXICAL` achieves the highest Micro F1 (**64.44%**), and `C2_CONTEXTUAL` achieves the highest Macro F1 (**56.24%**). `C4` achieves identical recall to `C3_HYBRID` (68.09%), but produces 31 false positives across 17 units.

---

## 9. Conversational Behavior Error Analysis

### Inspection of Problematic Behaviors from Experiment 4.2
In Experiment 4.2, five behaviors exhibited acute failure modes or extreme volatility across deterministic classifiers: `STUDENT_INTERACT`, `PRACTICE`, `DEBUG`, `CODE_TRACE`, and `EDGE_CASE`.

| Behavior | Human Support | C1 F1 | C2 F1 | C3 F1 | C4 Precision | C4 Recall | C4 F1 |
|---|---|---|---|---|---|---|---|
| **STUDENT_INTERACT** (BENCH_03) | 2 | 0.00% | 40.00% | 40.00% | 0.00% (0/4) | 0.00% (0/2) | **0.00%** |
| **PRACTICE** (BENCH_03) | 2 | 40.00% | 50.00% | 50.00% | 40.00% (2/5) | 100.00% (2/2) | **57.14%** |
| **DEBUG** (BENCH_03) | 3 | 57.14% | 57.14% | **75.00%** | 50.00% (1/2) | 33.33% (1/3) | **40.00%** |
| **CODE_TRACE** (BENCH_03) | 2 | **66.67%** | **66.67%** | 57.14% | 40.00% (2/5) | 100.00% (2/2) | **57.14%** |
| **EDGE_CASE** (BENCH_03) | 1 | 66.67% | 66.67% | 28.57% | 100.00% (1/1) | 100.00% (1/1) | **100.00%** |

### Deep Dive: The STUDENT_INTERACT Paradox
A critical finding of Experiment 4.2b is that **C4 scored 0.0% F1 on `STUDENT_INTERACT`** across the benchmark, matching the failure of `C1_LEXICAL` and underperforming the contextual window heuristic of `C2` and `C3` (40.0% F1).

#### Why C4 Failed on True Positive Units (GT-D02, GT-D07)
In the ground truth, `GT-D02` and `GT-D07` contain genuine classroom interaction where the teacher responds to student answers and pauses for student verification:
- In `GT-D02`: *"What other way do you think it can be? Eight, twelve, or 24. So what will I do? Computers. Is there any shorter way? For loops, you will get it... Eight and twelve. Sorry. Eight plus eight or eight?"*
- In `GT-D07`: *"While going or while coming? While coming back. While returning, not while going... Understood? Okay. Let's try to code this."*

In both units, student responses are faintly heard or echoed by the instructor. Because the transcript is un-diarized text, C4 interpreted the entire text as a continuous monologue of self-explanation and code execution, classifying them as `EXPLAIN`, `DEMONSTRATE`, `PRACTICE`, `CODE_TRACE`, and omitting `STUDENT_INTERACT`.

#### Why C4 Over-Predicted on Non-Interaction Units (5 False Positives)
Conversely, C4 predicted `STUDENT_INTERACT` on 5 units where human annotators found no pedagogical student interaction:
1. `GT-D01` (FP): Model quoted *"Is 24 modulo eight equal equal to zero? Yes"* (Teacher asking and immediately answering a rhetorical check).
2. `GT-D03` (FP): Model quoted *"Which one do you want to implement first?"* (Conversational transition).
3. `GT-D04` (FP): Model quoted *"What would you write in the for loop to get the JCD?"* (Posing an algorithmic question before immediately answering).
4. `GT-D06` (FP): Model quoted *"Is this understood?"* (Discourse filler).
5. `GT-G09` (BENCH_04 FP - Pure Monologue): Model quoted *"To do that what we have to do? You have to type git init."*

**Scientific Insight:** Without acoustic turn-taking, pause cues, or speaker diarization, the LLM relies solely on interrogative syntax (*"?"*). It cannot distinguish between rhetorical monologue questions and interactive classroom elicitation, resulting in 0% precision and 0% recall on ground-truth interactive acts.

### Unit-Level Error Distribution
Across all 17 units, 2 units were classified perfectly (GT-G05 and GT-G08 in BENCH_04), while 15 units had label discrepancies:

| Error Category | Count | Percentage | Primary Symptom |
|---|---|---|---|
| **MULTI_LABEL_OVERPREDICTION** | 8 | 53.3% | Predicting 2 to 4 extra behaviors beyond ground truth (e.g. `PRACTICE`, `CODE_TRACE`, `REINFORCE`) |
| **MULTI_LABEL_UNDERPREDICTION** | 3 | 20.0% | Omitting secondary behaviors (e.g. omitting `DEMONSTRATE` in terminal command descriptions) |
| **BEHAVIOR_OVERPREDICTION** | 2 | 13.3% | Adding 1-2 extraneous labels to an otherwise correct primary label |
| **CONVERSATIONAL_ACT_MISSED** | 2 | 13.3% | Omitting `STUDENT_INTERACT` in dynamic classroom turn-taking (`GT-D02`, `GT-D07`) |
| **Total Misclassified Units** | **15** | **100.0%** | |

---

## 10. Profile Divergence

Profile divergence measures how closely the predicted behavior distribution $\mathbf{Q}$ matches the human annotation distribution $\mathbf{P}$ across the 12 taxonomy dimensions.

$$\text{TVD}(\mathbf{P}, \mathbf{Q}) = \frac{1}{2} \sum_{i=1}^{12} |P_i - Q_i| \qquad \text{CosineDist}(\mathbf{P}, \mathbf{Q}) = 1 - \frac{\mathbf{P} \cdot \mathbf{Q}}{\|\mathbf{P}\| \|\mathbf{Q}\|}$$

### Table 10.1: Comparative Distribution Vectors (Combined 17 Units)
| Behavior | Human Proportion | C1 Lexical | C2 Contextual | C3 Hybrid | C4 LLM Zero-Shot | C4 Shift |
|---|---|---|---|---|---|---|
| **EXPLAIN** | 27.66% | 20.93% | 20.00% | 15.63% | 26.98% | -0.68% (Accurate) |
| **DEMONSTRATE** | 27.66% | 34.88% | 32.00% | 25.00% | 17.46% | -10.20% (Under-estimated) |
| **COMPARE** | 8.51% | 6.98% | 6.00% | 4.69% | 4.76% | -3.75% |
| **DEBUG** | 6.38% | 6.98% | 6.00% | 7.81% | 3.17% | -3.21% |
| **PREDICT_CHANGE**| 2.13% | 0.00% | 0.00% | 0.00% | 1.59% | -0.54% |
| **ASK_WHY** | 4.26% | 4.65% | 4.00% | 3.13% | 3.17% | -1.09% |
| **PRACTICE** | 4.26% | 6.98% | 8.00% | 6.25% | 7.94% | +3.68% (Over-estimated) |
| **REAL_WORLD_APP**| 2.13% | 0.00% | 0.00% | 0.00% | 6.35% | +4.22% (Over-estimated) |
| **EDGE_CASE** | 2.13% | 4.65% | 4.00% | 9.38% | 1.59% | -0.54% |
| **CODE_TRACE** | 6.38% | 6.98% | 12.00% | 18.75% | 7.94% | +1.56% |
| **STUDENT_INTERACT**| 4.26% | 0.00% | 4.00% | 4.69% | 7.94% | +3.68% (Over-estimated) |
| **REINFORCE** | 4.26% | 6.98% | 4.00% | 4.69% | 11.11% | +6.85% (Over-estimated) |

### Summary of Profile Distortions
- **Demonstration Suppression:** C4 depresses `DEMONSTRATE` by 10.20 percentage points relative to human annotations because it categorizes verbal walkthroughs of commands or algorithms as `EXPLAIN` or `CODE_TRACE` rather than concrete demonstration.
- **Pedagogical Inflation:** C4 inflates `REINFORCE` (11.11% vs. 4.26%), `REAL_WORLD_APP` (6.35% vs. 2.13%), and `STUDENT_INTERACT` (7.94% vs. 4.26%), attributing high-level teaching constructs to casual conversational asides.
- **Overall Alignment:** Despite individual shifts, C4 achieves a combined TVD of **0.1999** and Cosine Distance of **0.0650**, outperforming `C3_HYBRID` (TVD = 0.3228) and tracking closely with `C1_LEXICAL` (TVD = 0.1732).

---

## 11. Infrastructure Reliability

The experiment utilized Groq's cloud inference endpoint hosting `openai/gpt-oss-120b`.

### Reliability Statistics
- **Total Requests Attempted:** 17
- **Successful Completions:** 17 (100.0%)
- **Failed Requests / HTTP 5xx / 429:** 0 (0.0%)
- **Retries Triggered:** 0
- **JSON Parsing Success:** 17 / 17 (100.0%)
- **JSON Schema Conformance:** 100.0% (all responses contained valid `labels` array and `evidence` objects matching canonical taxonomy names).

### Latency Distribution
- **Total Latency:** 162.1 seconds
- **Mean Latency:** 9,537 ms
- **Median Latency:** 6,848 ms
- **Minimum Latency:** 758 ms (`GT-G04`)
- **Maximum Latency:** 25,219 ms (`GT-D04`)

*Note:* Latency correlates directly with prompt token count and segment complexity. Units in `BENCH_03` with dense conversational dialogue required 15–25 seconds per inference. C4 introduced substantially higher inference latency than deterministic classification; the exact multiplier should be reported only using directly measured latency for both systems.

---

## 12. Scientific Interpretation

### 1. Does a Large Language Model Solve Teaching-Behavior Classification?
**No.** The empirical data demonstrates that applying an advanced open-weight foundation model (`gpt-oss-120b`) zero-shot does **not** provide a universal improvement over simpler deterministic methods:
- On structured monologue (`BENCH_04`), simple lexical matching (`C1`) outperforms the LLM by **+16.73% Micro F1** and **+38.32% Macro F1**.
- Across all 17 units, `C1_LEXICAL` delivers superior overall precision (67.44% vs. 50.79%) and higher Micro F1 (64.44% vs. 58.18%).

### 2. What Is the True Comparative Value of the LLM?
The primary value of the LLM lies in **semantic recall on multi-faceted concepts**:
- On interactive dialogue (`BENCH_03`), C4 recovered complex teaching acts that lexical rules missed, including nuanced base-case boundary analysis (`EDGE_CASE` F1 = 100%), full recall on `PRACTICE` (100%), and full recall on `CODE_TRACE` (100%).
- In contrast to regex rules which fail when phrasing varies, the LLM accurately captures varied expressions of algorithmic tracing and student exercises.

### 3. The Boundary Problem: Syntactic Form vs. Pragmatic Function
The most critical scientific finding is the **failure of zero-shot text LLMs on conversational acts**:
- The model treats interrogative punctuation and conversational questions as `STUDENT_INTERACT`, even when spoken in complete isolation during a recorded monologue (`GT-G09`).
- Conversely, when teacher speech seamlessly incorporates student input without clear diarization tags (`GT-D02`, `GT-D07`), the model fails to detect the interaction.
- These results indicate that raw transcript text alone is insufficient for reliable classification of conversational acts in this pilot. Acoustic turn-taking, pause structure, and speaker diarization are promising additional signals that should be evaluated in a subsequent experiment.

---

## 13. Limitations

1. **Small Evaluation Pilot (N=17 Units):** The dataset comprises 17 units across two instructors. While sufficient for pilot error characterization, low-support behaviors (e.g. `EDGE_CASE` N=1, `PREDICT_CHANGE` N=1, `REAL_WORLD_APP` N=1) cannot be generalized statistically.
2. **Text-Only Modality:** Audio features (pitch variation, pause length, student audio volume) were absent from the classification prompt.
3. **Absence of Calibration Demonstrations:** To preserve test integrity and eliminate data leakage, zero few-shot examples were provided. A calibrated few-shot prompt with explicit negative examples of rhetorical questions would likely suppress over-prediction.
4. **Subject Matter Confounding:** The two benchmarks differ both in pedagogical style (monologue vs. interactive) and subject matter (Git CLI vs. C++ Recursion/Algorithms).

---

## 14. Decision on Step 2

### Question: Should we proceed immediately to Step 2 (Testing Unseen Teachers: Tapadia Sir & Asha Mam)?

### Recommendation: **DEFER Step 2 until prompt calibration and few-shot negative boundary rules are established.**

#### Scientific Rationale
Evaluating unseen instructors remains an essential scientific milestone because it can reveal whether C4's error patterns are:
1. General LLM behavior-classification challenges,
2. Idiosyncratic to these specific two lecture recordings,
3. Subject/domain-dependent (e.g., Git CLI vs. algorithmic recursion),
4. Teacher-style-dependent (monologue vs. classroom dialogue), or
5. Caused by transcript acoustic quality and lack of diarization.

However, calibration should take precedence over testing unseen instructors because `C4_LLM_ZERO_SHOT` has a demonstrated precision and over-attribution deficit (31 false positives across 17 units, and a 0.0% F1 score on `STUDENT_INTERACT`). Running Step 2 prior to calibration would confound prompt-engineering limitations with true instructor and domain generalization effects.

#### Recommended Next Sequence
Rather than relying on an arbitrary single-metric gate (such as a 70% precision threshold), C5 should be developed and evaluated through a phased scientific methodology:

```text
Dedicated Non-Benchmark Calibration Examples
                   ↓
Tune C5 (Few-Shot Prompts + Negative Boundaries)
                   ↓
               LOCK C5
                   ↓
Evaluate on Frozen 17 Units (C1 vs C2 vs C3 vs C4 vs C5)
                   ↓
Evaluate on Unseen Instructors (Tapadia Sir & Asha Mam)
```

1. **Develop an Isolated Calibration Set:** Author 3–5 dedicated synthetic or non-benchmark calibration examples explicitly demonstrating the boundary between:
   - Rhetorical self-questioning vs. genuine student interaction.
   - Conceptual mention of developers/industry vs. concrete real-world application.
   - Descriptive verbal walkthrough of terminal commands vs. live demonstration.
2. **Formulate and Lock C5:** Tune C5 using only the calibration set, then freeze C5 configuration prior to evaluation.
3. **Multi-Dimensional Evaluation on Frozen 17 Units:** Assess whether C5 resolves the observed failure modes without degrading recall, tracking:
   - Micro Precision, Micro Recall, Micro F1
   - Macro Precision, Macro Recall, Macro F1
   - Profile Divergence (TVD and Cosine Distance)
   - `STUDENT_INTERACT` Precision and Recall
   - Overall false-positive inflation ratio
4. **Proceed to Step 2 Unseen Instructors:** Once C5 demonstrates balanced precision and controlled label inflation on the locked evaluation set, evaluate generalization across Tapadia Sir and Asha Mam.
5. **Maintain Production Freeze:** Do not modify Phase 3.4 production code, Agent 1/2/3, or Assessment Blueprint logic.

---

*Report prepared and verified under commit `b1b1553` (tag `v3.4-frozen`).*
