# Phase 4 Experiment 4.2b — Step 2: C5 Few-Shot Calibrated LLM Behavior Classification Report

**Evaluation Type:** Isolated Phase 4 Empirical Experiment  
**Status:** Frozen / Archived (Experiment 4.2b Step 2 Complete)  
**Baseline Git Commit:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0`  
**Baseline Tag:** `v3.4-frozen`  
**Primary Result Artifact:** `experiments/experiment_4_2b_c5/results_c5_calibration.json`  
**Artifact SHA-256:** `ed6ba174aedda36d9a40da97a0a89313d0b4b8a6376c7ceeaa1907c020ea30e0`  
**Lock Manifest:** `experiments/experiment_4_2b_c5/c5_config_lock.json`  
**Lock Manifest SHA-256:** `6d98c4af9bf46973f9521c1d1e085eb599d97bbc2a07df3d6294818a64ef7601`

---

## 1. Executive Summary & Objective

The objective of **Experiment 4.2b Step 2 (C5 Calibration)** was to test whether augmenting the foundation model (`openai/gpt-oss-120b` via Groq) with **explicit few-shot boundary demonstrations and strict negative constraint rules** could reduce the severe false-positive over-attribution observed in `C4_LLM_ZERO_SHOT` (31 false positives across 17 units, +34.0% label inflation, 0% F1 on `STUDENT_INTERACT`) while preserving its useful semantic recall.

### Summary of Empirical Findings
1. **Calibration Stage (8/8 Exact Matches):**
   - The classifier achieved **8/8 (100.0%) exact label set matches** across all 4 mandatory boundary families on dedicated, non-benchmark calibration examples (`CALIB-A1`..`CALIB-D2`).
   - Zero negative boundary violations occurred during calibration.
2. **False-Positive Reduction Achieved (-51.6%):**
   - Total false positives across the 17 units dropped from **31 in C4 down to 15 in C5** (-51.6% reduction).
   - Positive label inflation was eliminated, but replaced by label-volume contraction of 21.3% (total predicted labels fell from **63 in C4 down to 37 in C5**, swinging from `MULTI_LABEL_OVERPREDICTION` to `MULTI_LABEL_UNDERPREDICTION`).
   - On the continuous monologue benchmark (`BENCH_04`), Micro Precision surged from **56.00% to 75.00%** (+19.00 percentage points), raising Micro F1 from **62.22% to 66.67%**.
   - `STUDENT_INTERACT` false positives in the monologue were completely eliminated (1 $\rightarrow$ 0).
3. **The Precision-Recall Trade-off (Outcome B Observed):**
   - While calibration dramatically curtailed over-attribution, it **simultaneously suppressed true-positive recall**: overall Micro Recall dropped from **68.09% in C4 down to 46.81% in C5**.
   - The negative boundary rules over-constrained the model on complex interactive dialogue (`BENCH_03`):
     - `DEMONSTRATE` recall collapsed from 69.23% (9/13) to 23.08% (3/13), even though precision reached a perfect 100.0%.
     - `PRACTICE` recall fell from 100.0% (2/2) to 0.0% (0/2).
   - Overall combined Micro F1 shifted from **58.18% (C4) to 52.38% (C5)**.
4. **Hard System Isolation Maintained:**
   - Commit `b1b1553` / `v3.4-frozen` remained 100% clean. Zero modifications were made to production code, Agent 1/2/3, PDI calculation, deterministic validators, or Phase 3 benchmark harness.
   - All C4 baseline artifacts remained immutable.

---

## 2. Anti-Leakage & Cryptographic Lock Verification

### Absolute Test Set Barrier
In strict adherence to the anti-leakage protocol:
1. The 17 evaluation units (`GT-G00`–`GT-G09` and `GT-D01`–`GT-D07`) and their academic domains (Git CLI commands, GCD/LCM arithmetic, C++ recursion) were **strictly excluded** from calibration.
2. Calibration examples were authored from independent computer science topics:
   - Loop accumulator initialization in C (`CALIB-A1`)
   - Function return values and student dialogue (`CALIB-A2`)
   - Relational database persistence overview (`CALIB-B1`)
   - E-commerce inventory race condition and locking (`CALIB-B2`)
   - Python file `open()` syntax and parameters (`CALIB-C1`)
   - Terminal execution and console output inspection (`CALIB-C2`)
   - Binary search algorithmic mechanics (`CALIB-D1`)
   - In-class coding lab exercise directive (`CALIB-D2`)

### Cryptographic Configuration Lock
Prior to evaluating the 17 units, the C5 configuration was sealed in `c5_config_lock.json`. The runner cryptographically verified all 4 SHA-256 hashes before proceeding:

| Component | Manifest SHA-256 Hash | Verification Status |
|---|---|:---:|
| **System Prompt + Negative Boundaries** | `0074bdf4ed78821cabb000c1500ba18a0aeccf14658c773c31df9ceed0f53623` | **MATCH (VERIFIED)** |
| **Calibration Dataset** | `5cf545ed2bb7383ad981951de651f64c01e52583a08cfd9fc49f093c378487cb` | **MATCH (VERIFIED)** |
| **Canonical Taxonomy** | `57dba85d3fc92d1e9568e105f342d7ecc686f8cf03b185426dee7145487039e6` | **MATCH (VERIFIED)** |
| **Runner Script** | `224640c560a65dbaf46dac30be04684b25862ac6b6a3d445e7ac2d709d49fb9f` | **MATCH (VERIFIED)** |

---

## 3. Calibration Stage: Exact-Match Performance (8/8 PASS)

In Stage 1, C5 was tested against the 8 calibration examples. Success was defined by the strict exact-match criterion: $\text{Set}(\text{Predicted}) \equiv \text{Set}(\text{Expected})$.

| ID | Boundary Family | Boundary Type | Expected Label Set | C5 Predicted Label Set | Exact Match | Boundary Violation |
|---|---|---|---|---|:---:|:---:|
| `CALIB-A1` | `STUDENT_INTERACT` | Negative Boundary | `["EXPLAIN"]` | `["EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-A2` | `STUDENT_INTERACT` | Positive Boundary | `["EXPLAIN", "STUDENT_INTERACT"]` | `["STUDENT_INTERACT", "EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-B1` | `REAL_WORLD_APP` | Negative Boundary | `["EXPLAIN"]` | `["EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-B2` | `REAL_WORLD_APP` | Positive Boundary | `["EXPLAIN", "REAL_WORLD_APP"]` | `["EXPLAIN", "REAL_WORLD_APP"]` | **PASS** | **NO** |
| `CALIB-C1` | `DEMONSTRATE` | Negative Boundary | `["EXPLAIN"]` | `["EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-C2` | `DEMONSTRATE` | Positive Boundary | `["DEMONSTRATE", "EXPLAIN"]` | `["DEMONSTRATE", "EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-D1` | `PRACTICE` | Negative Boundary | `["EXPLAIN"]` | `["EXPLAIN"]` | **PASS** | **NO** |
| `CALIB-D2` | `PRACTICE` | Positive Boundary | `["PRACTICE"]` | `["PRACTICE"]` | **PASS** | **NO** |

**Result:** **8/8 (100.0%) Exact Set Matches, 0 Boundary Violations.**

---

## 4. BENCH_04 Evaluation Results (Continuous Monologue)

`BENCH_04` consists of 10 transcript segments (20 human label instances) covering Git CLI introduction and basic commands.

### Aggregate Metrics
- **Micro Precision:** **75.00%** (12 TP / 16 Total Predicted) — *vs. C4: 56.00% (+19.00 pp)*
- **Micro Recall:** **60.00%** (12 TP / 20 Total Ground Truth) — *vs. C4: 70.00% (-10.00 pp)*
- **Micro F1:** **66.67%** — *vs. C4: 62.22% (+4.45 pp improvement)*
- **Macro Precision:** 24.17%
- **Macro Recall:** 18.75%
- **Macro F1:** 19.56%
- **Active Classes Count:** 7 / 12
- **Profile Divergence:** TVD = `0.3250`, Cosine Distance = `0.1458`

### Per-Behavior Breakdown (BENCH_04)
| Behavior | Human Support | C5 TP | C5 FP | C5 FN | C5 Precision | C5 Recall | C5 F1 | C4 F1 Baseline |
|---|---|---|---|---|---|---|---|---|
| **EXPLAIN** | 9 | 9 | 1 | 0 | 90.00% | 100.00% | 94.74% | 94.74% |
| **DEMONSTRATE** | 8 | 2 | 0 | 6 | 100.00% | 25.00% | 40.00% | 61.54% |
| **COMPARE** | 1 | 1 | 0 | 0 | 100.00% | 100.00% | **100.00%** | 0.00% |
| **DEBUG** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| **PREDICT_CHANGE**| 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| **ASK_WHY** | 0 | 0 | 1 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| **PRACTICE** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| **REAL_WORLD_APP**| 0 | 0 | 1 | 0 | 0.00% | 0.00% | 0.00% | 0.00% (3 FP in C4) |
| **EDGE_CASE** | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| **CODE_TRACE** | 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | 0.00% |
| **STUDENT_INTERACT**| 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% (1 FP in C4) |
| **REINFORCE** | 1 | 0 | 1 | 1 | 0.00% | 0.00% | 0.00% | 40.00% (3 FP in C4) |

### Key Observations on BENCH_04
1. **Dramatic Over-Attribution Reduction:** False positives in `BENCH_04` dropped from **11 down to 4** (-63.6%).
2. **Elimination of Monologue Conversational Misattribution:** In `GT-G09`, where C4 mislabeled the rhetorical question (*"To do that what we have to do? You have to type git init"*) as `STUDENT_INTERACT`, C5 correctly suppressed this label.
3. **Recovery of `COMPARE`:** In `GT-G07` (comparing `git diff` vs earlier commit state), C5 achieved a perfect exact match (`[EXPLAIN, COMPARE]`, F1 = 100%), whereas C4 completely missed `COMPARE`.
4. **Demonstration Suppression:** In units where the teacher verbally walked through commands without live terminal output, C5 strictly refused to tag `DEMONSTRATE`, reducing recall to 25.0%.

---

## 5. BENCH_03 Evaluation Results (Interactive Dialogue)

`BENCH_03` consists of 7 transcript segments (27 human label instances) covering interactive classroom dialogue on GCD, LCM, and recursion.

### Aggregate Metrics
- **Micro Precision:** **47.62%** (10 TP / 21 Total Predicted) — *vs. C4: 47.37%*
- **Micro Recall:** **37.04%** (10 TP / 27 Total Ground Truth) — *vs. C4: 66.67% (-29.63 pp)*
- **Micro F1:** **41.67%** — *vs. C4: 55.38% (-13.71 pp)*
- **Macro Precision:** 31.85%
- **Macro Recall:** 30.83%
- **Macro F1:** 27.17%
- **Active Classes Count:** 12 / 12
- **Profile Divergence:** TVD = `0.3810`, Cosine Distance = `0.2467`

### Per-Behavior Breakdown (BENCH_03)
| Behavior | Human Support | C5 TP | C5 FP | C5 FN | C5 Precision | C5 Recall | C5 F1 | C4 F1 Baseline |
|---|---|---|---|---|---|---|---|---|
| **EXPLAIN** | 4 | 4 | 3 | 0 | 57.14% | 100.00% | 72.73% | 72.73% |
| **DEMONSTRATE** | 5 | 1 | 0 | 4 | 100.00% | 20.00% | 33.33% | 90.91% |
| **COMPARE** | 3 | 2 | 0 | 1 | 100.00% | 66.67% | **80.00%** | 66.67% |
| **DEBUG** | 3 | 1 | 1 | 2 | 50.00% | 33.33% | 40.00% | 40.00% |
| **PREDICT_CHANGE**| 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | 0.00% |
| **ASK_WHY** | 2 | 0 | 0 | 2 | 0.00% | 0.00% | 0.00% | 0.00% |
| **PRACTICE** | 2 | 0 | 2 | 2 | 0.00% | 0.00% | 0.00% | 57.14% |
| **REAL_WORLD_APP**| 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | 100.00% |
| **EDGE_CASE** | 1 | 1 | 1 | 0 | 50.00% | 100.00% | 66.67% | 100.00% |
| **CODE_TRACE** | 2 | 1 | 3 | 1 | 25.00% | 50.00% | 33.33% | 57.14% |
| **STUDENT_INTERACT**| 2 | 0 | 1 | 2 | 0.00% | 0.00% | 0.00% | 0.00% (4 FP in C4) |
| **REINFORCE** | 1 | 0 | 0 | 1 | 0.00% | 0.00% | 0.00% | 0.00% (3 FP in C4) |

### Key Observations on BENCH_03
1. **Severe False-Positive Suppression:** In `BENCH_03`, predicted labels fell from **38 (C4) down to 21 (C5)**, cutting false positives almost in half (20 down to 11).
2. **False Positive Reduction on Interaction:** `STUDENT_INTERACT` false positives fell from 4 in C4 down to 1 in C5 (`GT-D04`).
3. **Recall Collateral Damage:** The explicit negative boundaries caused the model to become overly cautious when evaluating fast-paced, interactive teaching. The instructor's live code exploration on LCM/Recursion was no longer recognized as `DEMONSTRATE` (recall dropped to 20%), and conversational practice invitations were no longer recognized as `PRACTICE` (recall dropped to 0%).

---

## 6. Combined Results (17-Unit Aggregate)

| Metric | C4 (Zero-Shot) | C5 (Calibrated Few-Shot) | Absolute Change |
|---|:---:|:---:|:---:|
| **Total Human Instances** | 47 | 47 | — |
| **Total Predicted Labels** | 63 (+34.0% inflation) | 37 (-21.3% contraction) | **-26 labels** |
| **True Positives (TP)** | 32 | 22 | -10 TP |
| **False Positives (FP)** | 31 | 15 | **-16 FP (-51.6%)** |
| **False Negatives (FN)** | 15 | 25 | +10 FN |
| **Micro Precision** | 50.79% | **59.46%** | **+8.67 pp** |
| **Micro Recall** | **68.09%** | 46.81% | -21.28 pp |
| **Micro F1** | **58.18%** | 52.38% | -5.80 pp |
| **Macro F1** | 44.01% | 28.76% | -15.25 pp |
| **TVD (Profile Divergence)**| **0.1999** | 0.2772 | +0.0773 |
| **Cosine Distance** | **0.0650** | 0.1677 | +0.1027 |

---

## 7. Comprehensive 5-Way Comparison (C1 vs C2 vs C3 vs C4 vs C5)

### Table 7.1: BENCH_04 (Monologue Lecture — 10 Units)
| Classifier | Micro P | Micro R | Micro F1 | Macro F1 | TVD | Cosine Dist | FP Count |
|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **83.33%** | **75.00%** | **78.95%** | **60.13%** | **0.1667** | **0.0395** | **3** |
| **C2_CONTEXTUAL** | 78.95% | **75.00%** | 76.92% | 51.54% | 0.1842 | 0.0435 | 4 |
| **C3_HYBRID** | 57.69% | **75.00%** | 65.22% | 40.43% | 0.3346 | 0.1819 | 11 |
| **C4_LLM_ZERO_SHOT** | 56.00% | 70.00% | 62.22% | 21.81% | 0.3500 | 0.1095 | 11 |
| **C5_LLM_CALIBRATED** | 75.00% | 60.00% | 66.67% | 19.56% | 0.3250 | 0.1458 | **4** |

### Table 7.2: BENCH_03 (Interactive Dialogue — 7 Units)
| Classifier | Micro P | Micro R | Micro F1 | Macro F1 | TVD | Cosine Dist | FP Count |
|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **56.00%** | 51.85% | 53.85% | 48.97% | 0.2815 | 0.1738 | **11** |
| **C2_CONTEXTUAL** | 51.61% | 59.26% | 55.17% | **53.13%** | 0.2700 | 0.1985 | 15 |
| **C3_HYBRID** | 44.74% | 62.96% | 52.31% | 49.27% | 0.3294 | 0.2617 | 21 |
| **C4_LLM_ZERO_SHOT** | 47.37% | **66.67%** | **55.38%** | 48.72% | **0.2242** | **0.0841** | 20 |
| **C5_LLM_CALIBRATED** | 47.62% | 37.04% | 41.67% | 27.17% | 0.3810 | 0.2467 | **11** |

### Table 7.3: Combined 17-Unit Aggregate
| Classifier | Micro P | Micro R | Micro F1 | Macro F1 | TVD | Cosine Dist | Total FP | Total Pred |
|---|---|---|---|---|---|---|---|---|
| **C1_LEXICAL** | **67.44%** | 61.70% | **64.44%** | 52.54% | **0.1732** | **0.0463** | **14** | 43 |
| **C2_CONTEXTUAL** | 62.00% | 65.96% | 63.92% | **56.24%** | 0.2047 | 0.0839 | 19 | 50 |
| **C3_HYBRID** | 50.00% | **68.09%** | 57.66% | 50.04% | 0.3228 | 0.2048 | 32 | 64 |
| **C4_LLM_ZERO_SHOT** | 50.79% | **68.09%** | 58.18% | 44.01% | 0.1999 | 0.0650 | 31 | 63 |
| **C5_LLM_CALIBRATED** | 59.46% | 46.81% | 52.38% | 28.76% | 0.2772 | 0.1677 | **15** | **37** |

---

## 8. Deep Dive: Precision-Recall Trade-off (Outcome B Analysis)

In Section 12 of the approved calibration protocol, five potential empirical outcomes were predefined. The results empirically exhibit **Outcome B** on the frozen 17-unit evaluation:
> *“Precision ↑, recall ↓ — calibration trades recall for precision; useful finding, but not automatically an improvement.”*

### 1. Where Calibration Succeeded
- **Halving False Positives:** Total false positives fell from 31 to 15. The prompt successfully suppressed generic industry mentions (`REAL_WORLD_APP` FP fell from 3 to 1) and rhetorical questions in monologues (`STUDENT_INTERACT` FP fell from 5 to 1).
- **Precision Gain on Structured Material:** On `BENCH_04`, C5 reached 75.00% precision, demonstrating that explicit negative boundaries are effective when lecture delivery is orderly and sequential.
- **Superior `COMPARE` Classification:** C5 attained **100% precision and 75% recall (F1 = 85.71%)** on `COMPARE`, compared to C4's 57.14%.

### 2. Why Recall Collapsed on Interactive Dialogue
- **Over-Constraining `DEMONSTRATE`:** The boundary rule stated: *"DEMONSTRATE requires active procedural execution, terminal commands being run... Do not classify merely because command syntax is verbally described."*  
  Because the transcript captures spoken words rather than screen video, when the instructor said *"I will check if 16 modulo 12 is equal equal to zero... then I will do eight plus eight plus eight..."*, the model interpreted this as conceptual verbal description rather than live execution, dropping `DEMONSTRATE` recall from 69.2% to 23.1%.
- **Over-Constraining `PRACTICE`:** The calibration example (`CALIB-D2`) demonstrated an explicit, timed command (*"Take the next seven minutes to complete the code individually"*). In real classrooms (`BENCH_03`), practice is often informal and conversational (*"Let's try this with something else also... Four and six LCM... What would you write?"*). C5 refused to label these conversational challenges as `PRACTICE`, dropping recall to 0%.

### 3. The Persistent `STUDENT_INTERACT` Frontier
Even with calibrated few-shot examples:
- C5 failed to identify `STUDENT_INTERACT` on the two ground-truth units (`GT-D02` and `GT-D07`), scoring **0.0% recall**.
- In un-diarized audio transcripts, student interjections are short and interwoven into teacher speech. Without explicit speaker tags (`Teacher:` vs `Student:`) or acoustic turn-taking features, neither evaluated text-only configuration (zero-shot C4 or few-shot C5) reliably distinguished conversational teacher-student feedback from continuous self-explanation.

---

## 9. Unit-Level Error Analysis

Across all 17 units:
- **Exact Matches:** 2 units (`GT-G07` and `GT-G08` in `BENCH_04`).
- **Misclassified Units:** 15 units.
- **Dominant Error Shift:** In C4, the primary error was `MULTI_LABEL_OVERPREDICTION` (53.3%). In C5, the error profile inverted to **`MULTI_LABEL_UNDERPREDICTION` (40.0%)**, confirming that the negative boundaries exerted a strong conservative pull on model behavior.

---

## 10. Profile Divergence & Distribution Shifts

| Behavior | Human Proportion | C4 Proportion | C5 Proportion | C4 Shift | C5 Shift |
|---|:---:|:---:|:---:|:---:|:---:|
| **EXPLAIN** | 27.66% | 26.98% | **45.95%** | -0.68% | **+18.29% (Over-concentrated)** |
| **DEMONSTRATE** | 27.66% | 17.46% | **8.11%** | -10.20% | **-19.55% (Under-concentrated)** |
| **COMPARE** | 8.51% | 4.76% | **8.11%** | -3.75% | **-0.40% (Accurate)** |
| **DEBUG** | 6.38% | 3.17% | 5.41% | -3.21% | -0.97% |
| **PREDICT_CHANGE**| 2.13% | 1.59% | 0.00% | -0.54% | -2.13% |
| **ASK_WHY** | 4.26% | 3.17% | 2.70% | -1.09% | -1.56% |
| **PRACTICE** | 4.26% | 7.94% | 5.41% | +3.68% | +1.15% |
| **REAL_WORLD_APP**| 2.13% | 6.35% | 2.70% | +4.22% | +0.57% (Corrected) |
| **EDGE_CASE** | 2.13% | 1.59% | 5.41% | -0.54% | +3.28% |
| **CODE_TRACE** | 6.38% | 7.94% | 10.81% | +1.56% | +4.43% |
| **STUDENT_INTERACT**| 4.26% | 7.94% | 2.70% | +3.68% | -1.56% (Corrected) |
| **REINFORCE** | 4.26% | 11.11% | 2.70% | +6.85% | -1.56% (Corrected) |

### Key Distribution Insight
C5's profile divergence (TVD = 0.2772) increased relative to C4 (TVD = 0.1999) because probability mass became disproportionately concentrated in `EXPLAIN` (45.95% vs 27.66% human). When negative constraints disqualified secondary behaviors like `DEMONSTRATE` or `PRACTICE`, the model defaulted to labeling the segment as pure `EXPLAIN`.

---

## 11. Infrastructure Reliability

- **Evaluated Units:** 17 / 17 (100.0%)
- **Infrastructure Failures during Valid Run:** 0
- **Total Request Latency:** 280,683 ms (~280.7 s, mean: 16,511 ms/unit)
- **Execution Integrity & Token Handling:** A preliminary run under the default API key was aborted after 10 units upon encountering a transient daily token limit (TPD), and its partial output was discarded in accordance with Amendment 4. In the subsequent valid, complete run executed via the configured backup key (`GROQ_API_KEY_BACKUP`), all 17 units completed in a single pass with 0 retries and valid JSON schema conformance.

---

## 12. Scientific Interpretation

### 1. What Did C5 Demonstrate?
In this experiment, few-shot prompt calibration and explicit negative boundary rules reduced false-positive over-attribution in the frozen evaluation set:
- False positives were halved (31 $\rightarrow$ 15).
- Positive label inflation was eliminated, but replaced by label-volume contraction of 21.3% (swinging from MULTI_LABEL_OVERPREDICTION to MULTI_LABEL_UNDERPREDICTION).
- Monologue precision reached 75.0%.

### 2. Why Did Recall Suffer?
The experiment establishes an **observed precision–recall trade-off under the evaluated C5 calibration configuration (Outcome B)**:
- In text-only transcripts of spoken lectures, the boundaries between verbal demonstration, implicit student practice, and conceptual explanation are fluid.
- Imposing strict negative boundaries substantially reduced unsupported behavior attributions, but also caused the model to reject some valid behavior instances that lack explicit formal keywords (e.g. rejecting unscripted classroom practice that doesn't say *"take seven minutes"*).

### 3. The Ceiling of Text-Only Behavior Classification
Neither lexical matching (C1), context heuristics (C2/C3), zero-shot LLM (C4), nor few-shot calibrated LLM (C5) achieved balanced precision and recall across both lecture styles:
- **C1_LEXICAL** remains the most balanced overall classifier on structured material (Micro F1: 64.44%).
- **C4_LLM_ZERO_SHOT** offers the highest semantic recall (68.09%), but at the expense of high false-positive noise.
- **C5_LLM_CALIBRATED** offers controlled precision (59.46% overall, 75.0% on monologue), but at the expense of recall.
- **`STUDENT_INTERACT` was not reliably resolved under the evaluated text-only conditions.**

---

## 13. Limitations

1. **Text-Only Transcripts:** The absence of audio features (prosody, pauses, speaker diarization) remains the primary bottleneck for interaction detection.
2. **Small Evaluation Dataset:** The 17 frozen units provide rich qualitative insights into failure modes, but low-support categories (N=1–2) remain statistically sensitive.
3. **Prompt Length & Latency:** Ingesting 8 few-shot demonstrations increased inference latency: C5 averaged approximately 16.5 s/unit versus approximately 9.5 s/unit for C4, corresponding to roughly a 1.73× increase in mean per-unit latency.

---

## 14. Strategic Recommendations on Unseen Teachers (Step 3)

### Decision: Should we proceed to evaluate unseen instructors (Tapadia Sir & Asha Mam)?

### Recommendation: **YES — Proceed to Step 3, evaluating C1, C4, and C5 across the unseen instructors, subject to prior frozen ground-truth annotation.**

#### Scientific Rationale & Prerequisites
With both C4 (zero-shot) and C5 (few-shot calibrated) now fully baselined and cryptographically frozen against the 17 units:
1. We now understand the precise behavioral trade-off: **C4 represents the high-recall / loose-boundary regime**, while **C5 represents the high-precision / conservative-boundary regime**.
2. Evaluating unseen instructors (Tapadia Sir and Asha Mam) with **both C1, C4, and C5 side-by-side** will provide evidence about whether these behaviors generalize across novel instructor cadences and academic domains:
   - Does C1's lexical advantage persist on new teaching styles?
   - Does C4's over-attribution occur across all teachers or only on specific subjects?
   - Does C5's conservative boundary hold up on new teaching cadences?
3. **Mandatory Step 3 Prerequisite:** Prior to running any model evaluations on Tapadia Sir or Asha Mam, human ground-truth behavior annotations must be formally completed, peer-reviewed, and cryptographically frozen. Step 3 must test models against locked ground truth, never ground truth against models.
4. This three-way comparison (C1 deterministic vs. C4 high-recall vs. C5 calibrated) provides the exact empirical foundation needed before attempting multimodal audio integration or Phase 4.3 Assessment Blueprint planning.

---

*Report prepared and cryptographically verified under commit `b1b1553` (tag `v3.4-frozen`).*
