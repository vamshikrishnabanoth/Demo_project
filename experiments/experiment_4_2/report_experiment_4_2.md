# Phase 4 Experiment 4.2: Instructional Intent & Teaching-Behavior Classification
## Final Exploratory Pilot Report (Permanently Archived Edition)

**Experiment Status**: Exploratory Pilot Validated — Permanently Archived. Not production-integrated.  
**Production Baseline Status**: Complete hard freeze preserved at `b1b1553` (`v3.4-frozen`). Zero modifications to `server/engine/**`, Agent 1/2/3, PDI calculation, validators, grounding gate, or Phase 3 benchmark harness.  
**Machine-Readable Artifact**: `experiments/experiment_4_2/results_experiment_4_2.json`  
**Ground Truth Source**: `experiments/experiment_4_2/ground_truth/behavior_annotations.json`  
**Artifact Checksum**: `f3491f87442c8e084d908a67f7726d60aa14d22bb71986b28ea4cee796accadb` (SHA-256)

---

### 1. Research Scope & Primary Hypothesis

Experiment 4.2 investigates:
> *Whether observable teaching behaviors provide measurable signals of instructional intent and whether contextual features improve classification of those behaviors.*

The experiment tests three deterministic candidate classifiers across 17 human-audited evaluation units (10 in `BENCH_04`, 7 in `BENCH_03`) over a 12-class canonical behavior taxonomy:
1. **Classifier 1 (C1_LEXICAL)**: Deterministic regex and pedagogical phrase pattern matching.
2. **Classifier 2 (C2_CONTEXTUAL)**: C1 + question density, interaction turn-taking, and acoustic pause dwell rate.
3. **Classifier 3 (C3_HYBRID)**: C2 + sequential dwell and algorithmic transformation patterns.

The results provide preliminary evidence that teaching behavior can serve as an observable signal for downstream instructional-intent modeling, but broader validation across teachers and domains is required.

---

### 2. Conceptual Architecture: The Candidate Inference Chain

To prevent conflation between surface speech, inferred pedagogy, and test items, Phase 4 maintains a strict conceptual separation:

$$\text{Teacher Speech} \xrightarrow[\text{Classified in Exp 4.2}]{\text{Observable Signal}} \text{Teaching Behavior} \xrightarrow[\text{Hypothesized Interpretation}]{\text{Pedagogical Intent}} \text{Instructional Intent} \xrightarrow[\text{Candidate Affinity Linkage}]{\text{Blueprint Allocation}} \text{Question Recipe}$$

* **Teaching Behavior**: Observable actions in the lecture (e.g. `EXPLAIN`, `DEMONSTRATE`, `DEBUG`, `COMPARE`). Measured directly in Experiment 4.2.
* **Instructional Intent**: The pedagogical goal behind the behavior (e.g., conceptual grounding vs. error-diagnosis vs. tradeoff-reasoning). A hypothesized interpretation requiring downstream evaluation.
* **Question Recipe**: The assessment generation strategy (e.g., `COUNTERFACTUAL_MODIFICATION`, `TRADEOFF_EVALUATION`). Candidate affinity linkages, not rigid 1-to-1 deterministic rules.

---

### 3. Core Scientific Findings

#### Finding 1: Observed Modality Dictates Behavior Distribution
The two evaluated lectures exhibit substantially different instructional-behavior distributions, supporting the use of an explicit behavior profile rather than assuming a single fixed assessment style for every lecturer:
* **Monologue Exposition (`BENCH_04` — Git Commands)**:
  * Human ground truth is heavily concentrated in direct instruction: **`EXPLAIN` ($45.0\%$) and `DEMONSTRATE` ($40.0\%$)**, with $0.0\%$ student interaction.
* **Interactive Classroom (`BENCH_03` — Deepa Madam)**:
  * Human ground truth spreads across interactive, investigative, and debugging acts: **`DEMONSTRATE` ($18.5\%$), `EXPLAIN` ($14.8\%$), `COMPARE` ($11.1\%$), `DEBUG` ($11.1\%$), `CODE_TRACE` ($7.4\%$), `PRACTICE` ($7.4\%$), `STUDENT_INTERACT` ($7.4\%$), `ASK_WHY` ($7.4\%$)**.

*(Note: Behavior-profile percentages represent the proportion of assigned multi-label behavior occurrences, not mutually exclusive time proportions).*

#### Finding 2: Contextual Signals Improve Interactive Classification
* In structured monologue (`BENCH_04`), explicit lexical/pedagogical cues are highly effective: **C1 achieved Micro $F_1 = 79.0\%$, Macro $F_1 = 60.1\%$, Total Variation Distance (TVD) = $0.1667$**.
* In interactive classroom dialogue (`BENCH_03`), C1 missed conversational turn-taking completely (`STUDENT_INTERACT` Recall = $0.0\%$).
* **C2 Contextual Framing** contributed information that lexical pattern matching alone did not capture, recovering `STUDENT_INTERACT` ($F_1 = 40.0\%$) and `PRACTICE` ($F_1 = 50.0\%$, Recall = $100.0\%$), improving overall Micro $F_1$ to **$55.2\%$**, Macro Recall to **$64.4\%$**, and reducing TVD to **$0.2700$**.
* *(Note on Divergence Metrics: In `BENCH_03`, C2 reduced TVD relative to C1 ($0.2700$ vs $0.2815$), while cosine distance slightly increased ($0.1985$ vs $0.1738$); the two divergence measures provide different geometric perspectives on profile similarity).*

#### Finding 3: Rule Cross-Talk in the Tested Hybrid Implementation
* The tested C3 rule composition introduced substantial rule cross-talk and did not improve classification on these benchmarks (Micro Precision degraded to $57.7\%$ in `BENCH_04` and $44.7\%$ in `BENCH_03`; TVD degraded to $\approx 0.33$).
* In `BENCH_04`, broad sequential rules produced 7 false positives on `CODE_TRACE` (`CODE_TRACE` Precision dropped from $100\%$ in C1 to $12.5\%$ in C3).
* In `BENCH_03`, broad boundary cues over-triggered `EDGE_CASE` (FP=5, Precision = $16.7\%$).
* Further expansion of the same hardcoded heuristic strategy should therefore be treated cautiously.

---

### 4. Benchmark 04: Software Tools — Git Commands (`BENCH_04`)
* **Modality**: `VOICE_ONLY` (Expository Monologue) | **Units**: 10 (GT-G00 to GT-G09) | **Duration**: $767.81\text{s}$

#### A. Per-Behavior Performance Table
> *Note on Low-Support Classes: Per-behavior precision/recall/F1 values for low-support classes (such as `COMPARE`, `CODE_TRACE`, `REINFORCE` with $N \le 1$) should be interpreted descriptively because several behaviors have only one human-labeled unit.*

| Canonical Behavior | Human Count | C1 (P / R / $F_1$) | C2 (P / R / $F_1$) | C3 (P / R / $F_1$) |
| :--- | :---: | :---: | :---: | :---: |
| **`EXPLAIN`** | 9 | 83.3% / 55.6% / **66.7%** | 83.3% / 55.6% / **66.7%** | 83.3% / 55.6% / **66.7%** |
| **`DEMONSTRATE`** | 8 | 88.9% / 100.0% / **94.1%** | 88.9% / 100.0% / **94.1%** | 88.9% / 100.0% / **94.1%** |
| **`COMPARE`** | 1 | 100.0% / 100.0% / **100.0%** | 100.0% / 100.0% / **100.0%** | 100.0% / 100.0% / **100.0%** |
| **`DEBUG`** | 0 | — / — / — | — / — / — | — / — / — |
| **`PREDICT_CHANGE`** | 0 | — / — / — | — / — / — | — / — / — |
| **`ASK_WHY`** | 0 | 0.0% / — / **0.0%** (FP=1) | 0.0% / — / **0.0%** (FP=1) | 0.0% / — / **0.0%** (FP=1) |
| **`PRACTICE`** | 0 | — / — / — | 0.0% / — / **0.0%** (FP=1) | 0.0% / — / **0.0%** (FP=1) |
| **`REAL_WORLD_APP`** | 0 | — / — / — | — / — / — | — / — / — |
| **`EDGE_CASE`** | 0 | — / — / — | — / — / — | — / — / — |
| **`CODE_TRACE`** | 1 | 100.0% / 100.0% / **100.0%** | 100.0% / 100.0% / **100.0%** | 12.5% / 100.0% / **22.2%** (FP=7) |
| **`STUDENT_INTERACT`**| 0 | — / — / — | — / — / — | — / — / — |
| **`REINFORCE`** | 1 | — / 0.0% / **0.0%** (FN=1) | — / 0.0% / **0.0%** (FN=1) | — / 0.0% / **0.0%** (FN=1) |

#### B. Aggregate Multi-Label Classification Performance

| Classifier | Micro Precision | Micro Recall | Micro $F_1$ | Macro Precision | Macro Recall | Macro $F_1$ | Active Classes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **C1_LEXICAL** | **83.3%** | **75.0%** | **79.0%** | **62.0%** | **59.3%** | **60.1%** | 6 |
| **C2_CONTEXTUAL**| 79.0% | 75.0% | 76.9% | 53.2% | 50.8% | 51.5% | 7 |
| **C3_HYBRID** | 57.7% | 75.0% | 65.2% | 40.7% | 50.8% | 40.4% | 7 |

#### C. Instructional Profile & Profile Divergence

| Canonical Behavior | Human Ground Truth | C1_LEXICAL | C2_CONTEXTUAL | C3_HYBRID |
| :--- | :---: | :---: | :---: | :---: |
| **`EXPLAIN`** | **45.0%** | 33.3% | 31.6% | 23.1% |
| **`DEMONSTRATE`** | **40.0%** | 50.0% | 47.4% | 34.6% |
| **`COMPARE`** | 5.0% | 5.6% | 5.3% | 3.9% |
| **`ASK_WHY`** | 0.0% | 5.6% | 5.3% | 3.9% |
| **`PRACTICE`** | 0.0% | 0.0% | 5.3% | 3.9% |
| **`CODE_TRACE`** | 5.0% | 5.6% | 5.3% | 30.8% |
| **`REINFORCE`** | 5.0% | 0.0% | 0.0% | 0.0% |
| **Others (5 classes)**| 0.0% | 0.0% | 0.0% | 0.0% |
| **Divergence Metrics** | — | **TVD = 0.1667**<br>Cosine Dist = 0.0395 | **TVD = 0.1842**<br>Cosine Dist = 0.0435 | **TVD = 0.3346**<br>Cosine Dist = 0.1819 |

---

### 5. Benchmark 03: Deepa Madam — Voice-Only Interactive Problem-Solving Lecture (`BENCH_03`)
*(Originally cataloged as Data Structures / Binary Trees in benchmark inventory; audited lecture content covers mathematical logic, modular arithmetic, iterative/recursive LCM/GCD, and recursive string/palindrome processing).*
* **Modality**: `VOICE_ONLY` (Interactive Socratic Classroom) | **Units**: 7 (GT-D01 to GT-D07) | **Duration**: $3,771.32\text{s}$

#### A. Per-Behavior Performance Table
> *Note on Low-Support Classes: Per-behavior precision/recall/F1 values for low-support classes (such as `PREDICT_CHANGE`, `REAL_WORLD_APP`, `EDGE_CASE`, `REINFORCE` with $N=1$, or `ASK_WHY`, `STUDENT_INTERACT` with $N=2$) should be interpreted descriptively.*

| Canonical Behavior | Human Count | C1 (P / R / $F_1$) | C2 (P / R / $F_1$) | C3 (P / R / $F_1$) |
| :--- | :---: | :---: | :---: | :---: |
| **`EXPLAIN`** | 4 | 100.0% / 50.0% / **66.7%** | 100.0% / 50.0% / **66.7%** | 100.0% / 50.0% / **66.7%** |
| **`DEMONSTRATE`** | 5 | 100.0% / 40.0% / **57.1%** | 100.0% / 40.0% / **57.1%** | 100.0% / 40.0% / **57.1%** |
| **`COMPARE`** | 3 | 66.7% / 66.7% / **66.7%** | 66.7% / 66.7% / **66.7%** | 66.7% / 66.7% / **66.7%** |
| **`DEBUG`** | 3 | 50.0% / 66.7% / **57.1%** | 50.0% / 66.7% / **57.1%** | 60.0% / 100.0% / **75.0%** |
| **`PREDICT_CHANGE`** | 1 | 50.0% / 100.0% / **66.7%** | 50.0% / 100.0% / **66.7%** | 33.3% / 100.0% / **50.0%** |
| **`ASK_WHY`** | 2 | 0.0% / 0.0% / **0.0%** | 0.0% / 0.0% / **0.0%** | 0.0% / 0.0% / **0.0%** |
| **`PRACTICE`** | 2 | 33.3% / 50.0% / **40.0%** | 33.3% / 100.0% / **50.0%** | 33.3% / 100.0% / **50.0%** |
| **`REAL_WORLD_APP`** | 1 | 100.0% / 100.0% / **100.0%**| 100.0% / 100.0% / **100.0%**| 100.0% / 100.0% / **100.0%**|
| **`EDGE_CASE`** | 1 | 50.0% / 100.0% / **66.7%** | 50.0% / 100.0% / **66.7%** | 16.7% / 100.0% / **28.6%** |
| **`CODE_TRACE`** | 2 | 50.0% / 100.0% / **66.7%** | 50.0% / 100.0% / **66.7%** | 40.0% / 100.0% / **57.1%** |
| **`STUDENT_INTERACT`**| 2 | — / 0.0% / **0.0%** (FN=2) | 33.3% / 50.0% / **40.0%** | 33.3% / 50.0% / **40.0%** |
| **`REINFORCE`** | 1 | 0.0% / 0.0% / **0.0%** | 0.0% / 0.0% / **0.0%** | 0.0% / 0.0% / **0.0%** |

#### B. Aggregate Multi-Label Classification Performance

| Classifier | Micro Precision | Micro Recall | Micro $F_1$ | Macro Precision | Macro Recall | Macro $F_1$ | Active Classes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **C1_LEXICAL** | **56.0%** | 51.8% | 53.8% | 50.0% | 56.1% | 49.0% | 12 |
| **C2_CONTEXTUAL**| 51.6% | **59.3%** | **55.2%** | **52.8%** | **64.4%** | **53.1%** | 12 |
| **C3_HYBRID** | 44.7% | **63.0%** | 52.3% | 48.6% | **67.2%** | 49.3% | 12 |

#### C. Instructional Profile & Profile Divergence

| Canonical Behavior | Human Ground Truth | C1_LEXICAL | C2_CONTEXTUAL | C3_HYBRID |
| :--- | :---: | :---: | :---: | :---: |
| **`EXPLAIN`** | 14.8% | 8.0% | 6.5% | 5.3% |
| **`DEMONSTRATE`** | **18.5%** | 8.0% | 6.5% | 5.3% |
| **`COMPARE`** | 11.1% | 12.0% | 9.7% | 7.9% |
| **`DEBUG`** | 11.1% | 16.0% | 12.9% | 13.2% |
| **`PREDICT_CHANGE`** | 3.7% | 8.0% | 6.5% | 7.9% |
| **`ASK_WHY`** | 7.4% | 4.0% | 3.2% | 2.6% |
| **`PRACTICE`** | 7.4% | 12.0% | 19.4% | 15.8% |
| **`REAL_WORLD_APP`** | 3.7% | 4.0% | 3.2% | 2.6% |
| **`EDGE_CASE`** | 3.7% | 8.0% | 6.5% | 15.8% |
| **`CODE_TRACE`** | 7.4% | 16.0% | 12.9% | 13.2% |
| **`STUDENT_INTERACT`**| 7.4% | 0.0% | 9.7% | 7.9% |
| **`REINFORCE`** | 3.7% | 4.0% | 3.2% | 2.6% |
| **Divergence Metrics** | — | **TVD = 0.2815**<br>Cosine Dist = 0.1738 | **TVD = 0.2700**<br>Cosine Dist = 0.1985 | **TVD = 0.3294**<br>Cosine Dist = 0.2617 |

---

### 6. Mathematical Definition of Divergence Metrics

1. **Total Variation Distance (TVD)**:
   $$\text{TVD}(P, Q) = \frac{1}{2} \sum_{i=1}^{12} |P_i - Q_i|$$
   - Bounds: $\text{TVD} \in [0.0, 1.0]$.
   - Interpretation: Half the $L_1$ norm between the human probability distribution $P$ and classifier distribution $Q$.
2. **Cosine Distance**:
   $$\text{CosineDist}(P, Q) = 1.0 - \frac{P \cdot Q}{\|P\| \|Q\|}$$
   - Bounds: $\in [0.0, 1.0]$ for non-negative vectors.

---

### 7. Candidate Question Recipe Affinities (Hypothesized Linkage)

Teaching behavior classification links to the downstream Assessment Blueprint via **candidate affinity distributions** (probabilistic preference weights), not hardcoded 1-to-1 deterministic rules:

```json
{
  "PREDICT_CHANGE": [
    { "recipe": "COUNTERFACTUAL_MODIFICATION", "affinity": "PRIMARY" },
    { "recipe": "CODE_EXECUTION_TRACE", "affinity": "SECONDARY" },
    { "recipe": "EDGE_CASE_PROBING", "affinity": "TERTIARY" }
  ],
  "DEBUG": [
    { "recipe": "MISCONCEPTION_DIAGNOSIS", "affinity": "PRIMARY" },
    { "recipe": "COUNTERFACTUAL_MODIFICATION", "affinity": "SECONDARY" },
    { "recipe": "EDGE_CASE_PROBING", "affinity": "TERTIARY" }
  ],
  "COMPARE": [
    { "recipe": "TRADEOFF_EVALUATION", "affinity": "PRIMARY" }
  ],
  "CODE_TRACE": [
    { "recipe": "CODE_EXECUTION_TRACE", "affinity": "PRIMARY" }
  ],
  "REAL_WORLD_APP": [
    { "recipe": "NOVEL_SCENARIO", "affinity": "PRIMARY" }
  ],
  "EXPLAIN": [
    { "recipe": "MECHANISTIC_DISCRIMINATION", "affinity": "PRIMARY" }
  ],
  "PRACTICE": [
    { "recipe": "ANALOGOUS_CALCULATION", "affinity": "PRIMARY" },
    { "recipe": "CODE_EXECUTION_TRACE", "affinity": "SECONDARY" }
  ],
  "EDGE_CASE": [
    { "recipe": "EDGE_CASE_PROBING", "affinity": "PRIMARY" }
  ],
  "REINFORCE": [
    { "recipe": "DIRECT", "affinity": "PRIMARY" },
    { "recipe": "MECHANISTIC_DISCRIMINATION", "affinity": "SECONDARY" }
  ],
  "STUDENT_INTERACT": [
    { "recipe": "MISCONCEPTION_DIAGNOSIS", "affinity": "PRIMARY" }
  ]
}
```

This mapping represents a candidate design hypothesis to be tested downstream in Experiment 4.3; it is not yet an empirically validated causal rule.

---

### 8. Rigorous Limitations & Scientific Constraints

1. **Behavior Classification $\ne$ Latent Instructional Intent**:
   - Experiment 4.2 evaluates classification of observable teaching behaviors against human annotations. It does not independently validate latent instructional intent; the behavior-to-intent interpretation remains a hypothesis to be evaluated in downstream experiments.
2. **Teacher, Subject, and Modality Confounding**:
   - Because the pilot contains two lectures from different instructional contexts (`BENCH_04` by one instructor on software tools vs. `BENCH_03` by Deepa Madam on mathematical algorithms), teacher identity, subject matter, and interaction style are partially confounded; the experiment therefore does not isolate the independent effect of lecture modality.
3. **Dataset Scope (Pilot Dataset)**:
   - The current ground truth consists of 17 units across two lectures (10 in `BENCH_04`, 7 in `BENCH_03`).
   - While sufficient for establishing that behavior profiles diverge between monologue and interactive styles, it is not sufficient to claim cross-institutional predictive validity.
   - Future validation requires expanding the ground-truth corpus across multiple instructors, courses, and modalities (expository, mathematical, live programming).
4. **Next Experimental Step (Experiment 4.2b)**:
   - These results motivate evaluating a learned or LLM-based classifier as the next experimental candidate, particularly for conversational behaviors that were poorly captured by deterministic rules.
   - Experiment 4.2b should evaluate whether a zero-shot or few-shot LLM classifier achieves higher precision and lower profile divergence against this same frozen 17-unit ground truth before expanding the corpus to unseen instructors.
5. **Phase 4 Research Progression**:
   - Experiment 4.1: *Where does teaching behavior change?* (Completed)
   - Experiment 4.2: *Can observable behavior be classified deterministically?* (Completed pilot)
   - Experiment 4.2b: *Can a learned/LLM classifier classify it with higher precision on conversational acts?* (Next)
   - Experiment 4.3: *Does inferred instructional intent improve Assessment Blueprint quality over fixed difficulty?*
   - Only after Experiment 4.3 validation should any changes be integrated into Agent 1 / Agent 2.
