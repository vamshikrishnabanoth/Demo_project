# Phase 4 Experiment 4.2b Step 3 — Unseen-Teacher Generalization Report

**Evaluation Type:** Isolated Phase 4 Empirical Experiment  
**Status:** Frozen  
**Baseline Git Commit:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0`  
**Baseline Tag:** `v3.4-frozen`  
**Primary Result Artifact:** `experiments/experiment_4_2b_step3/results_step3_unseen_teacher.json`  
**Artifact SHA-256:** `0a6a06caf6fd12b6fb1f1756e37587f6daa19e8f1cc6f0e430ddd5d7b856d674`  
**Human Reference Status:** `SINGLE_ANNOTATOR_PROVISIONAL` (Explicit Limitation)  

---

## 1. Executive Summary & Objective

The objective of **Experiment 4.2b Step 3 (Unseen-Teacher Generalization)** was to evaluate whether the frozen teaching-behavior classifiers (**C1 Lexical**, **C4 Zero-Shot LLM**, and **C5 Few-Shot Calibrated LLM**) transfer to previously unseen instructors and novel technical domains without modification or prompt tuning:

- **BENCH_05 (Tapadia Sir):** Computer Science Algorithms & Memory Layout (`GT-T01`).
- **BENCH_06 (Asha Mam):** Deep Learning Theory, Autoencoder Architectures & VAEs (`GT-A01`).

### Core Findings Overview (Sample Size: 2 Scored Units / 4 Human Label Instances)
1. **Classifiers Evaluated:** Exactly frozen C1 (deterministic lexical regexes), C4 (zero-shot gpt-oss-120b), and C5 (few-shot calibrated gpt-oss-120b).
2. **Infrastructure Reliability:** 100% successful inference across all models with 0 retries and valid JSON schema adherence.
3. **Generalization Performance on the 2-Unit Provisional Sample:**
   - **C1_LEXICAL (Baseline Transfer):** C1 produced no true-positive behavior matches on the two scored Step 3 units (0.00% Micro F1), indicating poor transfer on this very small provisional sample. Deterministic keyword regexes matched tangential terms (`DEBUG`, `ASK_WHY` on Asha Mam; `EDGE_CASE` on Tapadia Sir) while failing to match the primary pedagogical behaviors (`EXPLAIN`, `COMPARE`).
   - **C4_LLM_ZERO_SHOT (Broad Recall with Unsupported Over-Attributions):** C4 achieved 100.00% Micro Recall (4/4 human instances detected), but exhibited its characteristic over-attribution tendency (57.14% Micro Precision, 72.73% Micro F1), generating 3 false positives (`DEMONSTRATE` on Tapadia Sir, and `ASK_WHY` and `REAL_WORLD_APP` on Asha Mam).
   - **C5_LLM_CALIBRATED (Conservative Boundary Transfer & Precision/Recall Trade-Off):** C5 transferred the calibrated behavior boundaries to the two evaluated unseen-teacher units with 75.00% micro F1, while performance differed substantially between the two teachers (50.00% F1 on Tapadia Sir vs 100.00% F1 on Asha Mam). C5 remained more conservative than C4 on unseen teachers: it reduced false positives from 3 to 1 and increased precision from 57.14% to 75.00%, while recall decreased from 100.00% to 75.00%.

---

## 2. Important Ground-Truth & Sample Limitations

> [!WARNING]
> **Sample Size & Provisional Status:** The evaluated sample contains exactly 2 pedagogical units (4 human label instances). Two units cannot prove universal generalization success or failure; these results represent an initial empirical signal under a provisional protocol. The reference labels represent **single-annotator provisional reference labels** (`SINGLE_ANNOTATOR_PROVISIONAL`) that have not been validated by a second independent annotator or adjudicated through multi-party consensus.

### The Modality Gap on STUDENT_INTERACT (GT-T01)
On unit `GT-T01` (Tapadia Sir), the human reference label `STUDENT_INTERACT` is supported by in-person **classroom observation** (students physically raising hands and responding in class) rather than audible audio/transcript turns. 

- **C4 matched the human reference on STUDENT_INTERACT**, but the available transcript does not contain the student response that established the human label. Therefore the C4 match cannot be interpreted as evidence that the model detected the actual non-verbal interaction; it inferred interaction from the teacher asking check-in questions.
- **C5 rejected STUDENT_INTERACT** strictly adhering to Boundary A (which demands observable evidence of multi-party conversational interaction). This demonstrates that a transcript-only classifier cannot recover information that exists only in classroom observation unless the teacher's speech provides a sufficiently reliable proxy.

---

## 3. Evaluation Unit Inventory & Reference Labels

| Unit ID | Benchmark / Teacher | Duration | Words | Human Reference Labels | Reference Status | Evidence Modality |
|---|---|:---:|:---:|---|:---:|---|
| `GT-T01` | BENCH_05 / Tapadia Sir | 145.7s | 259 | `["EXPLAIN", "STUDENT_INTERACT"]` | SINGLE_ANNOTATOR_PROVISIONAL | EXPLAIN: Transcript / STUDENT_INTERACT: In-Person Observation |
| `GT-A01` | BENCH_06 / Asha Mam | 147.0s | 374 | `["EXPLAIN", "COMPARE"]` | SINGLE_ANNOTATOR_PROVISIONAL | EXPLAIN: Transcript / COMPARE: Transcript |

---

## 4. Performance Summary Tables

### Table 4.1: Overall Aggregate Performance (Both Unseen Teachers — 2 Units, 4 Human Instances)
| Classifier | Total Pred | TP | FP | FN | Micro Precision | Micro Recall | Micro F1 | Macro F1 | TVD | Cosine Dist |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **C1_LEXICAL** | 3 | 0 | 3 | 4 | 0.00% | 0.00% | 0.00% | 0.00% | 1.0000 | 1.0000 |
| **C4_LLM_ZERO_SHOT** | 7 | 4 | 3 | 0 | 57.14% | 100.00% | 72.73% | 50.00% | 0.4286 | 0.1835 |
| **C5_LLM_CALIBRATED** | 4 | 3 | 1 | 1 | 75.00% | 75.00% | 75.00% | 50.00% | 0.2500 | 0.1667 |

### Table 4.2: BENCH_05 — Tapadia Sir (GT-T01: 2 Human Instances)
| Classifier | Total Pred | TP | FP | FN | Micro Precision | Micro Recall | Micro F1 | Predicted Labels |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **C1_LEXICAL** | 1 | 0 | 1 | 2 | 0.00% | 0.00% | 0.00% | `["EDGE_CASE"]` |
| **C4_LLM_ZERO_SHOT** | 3 | 2 | 1 | 0 | 66.67% | 100.00% | 80.00% | `["EXPLAIN","DEMONSTRATE","STUDENT_INTERACT"]` |
| **C5_LLM_CALIBRATED** | 2 | 1 | 1 | 1 | 50.00% | 50.00% | 50.00% | `["EXPLAIN","EDGE_CASE"]` |

### Table 4.3: BENCH_06 — Asha Mam (GT-A01: 2 Human Instances)
| Classifier | Total Pred | TP | FP | FN | Micro Precision | Micro Recall | Micro F1 | Predicted Labels |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **C1_LEXICAL** | 2 | 0 | 2 | 2 | 0.00% | 0.00% | 0.00% | `["DEBUG","ASK_WHY"]` |
| **C4_LLM_ZERO_SHOT** | 4 | 2 | 2 | 0 | 50.00% | 100.00% | 66.67% | `["EXPLAIN","COMPARE","ASK_WHY","REAL_WORLD_APP"]` |
| **C5_LLM_CALIBRATED** | 2 | 2 | 0 | 0 | 100.00% | 100.00% | 100.00% | `["EXPLAIN","COMPARE"]` |

---

## 5. Detailed Failure Analysis

Across the evaluated units, 12 total failure instances (false positives and false negatives) occurred across all classifiers:

| Unit ID | Teacher | Classifier | Error Type | Behavior | Failure Category | Diagnostic Rationale |
|---|---|---|:---:|---|---|---|
| `GT-T01` | Tapadia Sir | C1_LEXICAL | **FALSE_POSITIVE** | `EDGE_CASE` | unsupported behavior attribution | C1_LEXICAL assigned EDGE_CASE without explicit support in reference. |
| `GT-T01` | Tapadia Sir | C1_LEXICAL | **FALSE_NEGATIVE** | `EXPLAIN` | conservative under-attribution | C1_LEXICAL failed to assign reference label EXPLAIN. |
| `GT-T01` | Tapadia Sir | C1_LEXICAL | **FALSE_NEGATIVE** | `STUDENT_INTERACT` | missing acoustic/turn-taking information | Human reference includes classroom physical hand-raising observation not detectable in transcript text alone. |
| `GT-T01` | Tapadia Sir | C4_LLM_ZERO_SHOT | **FALSE_POSITIVE** | `DEMONSTRATE` | verbal syntax description mistaken for DEMONSTRATE | Model perceived verbal procedural discussion as live demonstration. |
| `GT-T01` | Tapadia Sir | C5_LLM_CALIBRATED | **FALSE_POSITIVE** | `EDGE_CASE` | unsupported behavior attribution | C5_LLM_CALIBRATED assigned EDGE_CASE without explicit support in reference. |
| `GT-T01` | Tapadia Sir | C5_LLM_CALIBRATED | **FALSE_NEGATIVE** | `STUDENT_INTERACT` | missing acoustic/turn-taking information | Human reference includes classroom physical hand-raising observation not detectable in transcript text alone. |
| `GT-A01` | Asha Mam | C1_LEXICAL | **FALSE_POSITIVE** | `DEBUG` | unsupported behavior attribution | C1_LEXICAL assigned DEBUG without explicit support in reference. |
| `GT-A01` | Asha Mam | C1_LEXICAL | **FALSE_POSITIVE** | `ASK_WHY` | unsupported behavior attribution | C1_LEXICAL assigned ASK_WHY without explicit support in reference. |
| `GT-A01` | Asha Mam | C1_LEXICAL | **FALSE_NEGATIVE** | `EXPLAIN` | conservative under-attribution | C1_LEXICAL failed to assign reference label EXPLAIN. |
| `GT-A01` | Asha Mam | C1_LEXICAL | **FALSE_NEGATIVE** | `COMPARE` | comparison missed | Model missed structural contrast between architectural variants. |
| `GT-A01` | Asha Mam | C4_LLM_ZERO_SHOT | **FALSE_POSITIVE** | `ASK_WHY` | unsupported behavior attribution | C4_LLM_ZERO_SHOT assigned ASK_WHY without explicit support in reference. |
| `GT-A01` | Asha Mam | C4_LLM_ZERO_SHOT | **FALSE_POSITIVE** | `REAL_WORLD_APP` | real-world application overprediction | Model attributed real-world application to general technological mention. |

---

## 6. Transcript vs. In-Person Observation Analysis (GT-T01)

On **GT-T01** (Tapadia Sir), the instructor checks student progress:
> *"How many finished both of them using binary search? Nobody... How many of you finished cocoa eating bananas? Okay. How many of you finished longest common prefix using any approach? Okay."*

- **Classroom Reality:** Students raised their hands and nodded in the classroom, answering the teacher's inquiry non-verbally. This was recorded in the human annotation based on in-person classroom observation.
- **Transcript Text Reality:** The transcript contains zero audible student dialogue turns.
- **Classifier Divergence:**
  - **C4_LLM_ZERO_SHOT:** Detected the teacher's interactive prompt to the room and labeled `STUDENT_INTERACT` (quote: *"How many finished both of them using binary search? Nobody."*). However, because the transcript contains no recorded student response, this match cannot be interpreted as evidence that C4 detected the actual non-verbal interaction.
  - **C5_LLM_CALIBRATED:** Strictly enforced Boundary A (*"Do NOT classify STUDENT_INTERACT if the instructor asks a question to the room during a monologue without student response or turn-taking... requires observable evidence of multi-party interaction"*). Because the transcript recorded no audible student speech, C5 conservatively rejected `STUDENT_INTERACT`.
  - **C1_LEXICAL:** Regex patterns found no student interaction markers in the monologue text.
- **Scientific Takeaway:** A transcript-only classifier cannot recover information that exists only in classroom observation unless the teacher's speech provides a sufficiently reliable proxy. Evaluating multimodal behaviors strictly from audio transcripts without acoustic turn-taking or visual gesture signals creates an intrinsic representation ceiling.

---

## 7. Cross-Phase Historical Comparison (Step 2 vs. Step 3)

The table below contrasts the verified historical performance on the frozen 17-unit benchmark (Exp 4.2b Step 2: BENCH_04 Git CLI + BENCH_03 Recursion) with the unseen-teacher evaluation (Exp 4.2b Step 3: BENCH_05 Algorithms + BENCH_06 Deep Learning):

| Metric | Exp 4.2b Step 2 (Frozen 17 Units: 47 Human Instances) | Exp 4.2b Step 3 (Unseen Teachers: 4 Human Instances) |
|---|:---:|:---:|
| **C4 True Positives (TP)** | 32 | 4 |
| **C4 False Positives (FP)** | 31 | 3 |
| **C4 False Negatives (FN)** | 15 | 0 |
| **C4 Micro Precision** | 50.79% | 57.14% |
| **C4 Micro Recall** | 68.09% | 100.00% |
| **C4 Micro F1** | 58.18% | 72.73% |
| **C4 TVD / Cosine Dist** | 0.1999 / 0.0650 | 0.4286 / 0.1835 |
| **C5 True Positives (TP)** | 22 | 3 |
| **C5 False Positives (FP)** | 15 | 1 |
| **C5 False Negatives (FN)** | 25 | 1 |
| **C5 Micro Precision** | 59.46% | 75.00% |
| **C5 Micro Recall** | 46.81% | 75.00% |
| **C5 Micro F1** | 52.38% | 75.00% |
| **C5 TVD / Cosine Dist** | 0.2772 / 0.1677 | 0.2500 / 0.1667 |
| **FP Reduction (C4 → C5)** | **51.61%** (31 FP → 15 FP) | **66.67%** (3 FP → 1 FP) |
| **Precision Shift (C4 → C5)** | **+8.67 pp** (50.79% → 59.46%) | **+17.86 pp** (57.14% → 75.00%) |
| **Recall Shift (C4 → C5)** | **-21.28 pp** (68.09% → 46.81%) | **-25.00 pp** (100.00% → 75.00%) |

---

## 8. Model Generalization Observations & Scientific Synthesis

1. **C1_LEXICAL (Fragile Heuristic Baseline):**
   - C1 produced no true-positive behavior matches on the two scored Step 3 units (0.00% Micro F1), indicating poor transfer on this very small provisional sample.
   - Deterministic keyword regexes constructed for earlier benchmark speaking styles failed when confronted with the colloquial dialogue of Tapadia Sir and the theoretical terminology of Asha Mam.

2. **C4_LLM_ZERO_SHOT (Broad Recall with Inherent Over-Attribution):**
   - C4 maintained broad semantic sensitivity across novel technical domains, capturing all human reference behaviors (`EXPLAIN` and `STUDENT_INTERACT` on Tapadia Sir; `EXPLAIN` and `COMPARE` on Asha Mam) yielding 100% recall.
   - However, it exhibited its characteristic over-attribution failure mode across both unseen teachers:
     - On Tapadia Sir: Over-attributed `DEMONSTRATE` to verbal explanation of worked string examples (*"If you're given data, the output would basically be HL..."*).
     - On Asha Mam: Over-attributed `ASK_WHY` to a rhetorical teacher question (*"why do we use auto encoders?"*) and `REAL_WORLD_APP` to a passing mention of image extraction applications (*"Now, there are applications where I want to extract the images as original images"*).

3. **C5_LLM_CALIBRATED (Conservative Boundary Transfer & Trade-Off Maintained):**
   - C5 transferred the calibrated behavior boundaries to the two evaluated unseen-teacher units with 75.00% micro F1, while performance differed substantially between the two teachers (50.00% F1 on Tapadia Sir vs 100.00% F1 on Asha Mam).
   - On Asha Mam (`GT-A01`), C5 achieved a **perfect exact match** (`["EXPLAIN", "COMPARE"]`, 100.00% F1), demonstrating that negative boundary calibration from disjoint CS domains successfully suppressed spurious `ASK_WHY` and `REAL_WORLD_APP` labels while preserving true behaviors.
   - On Tapadia Sir (`GT-T01`), C5 eliminated C4's false positive on `DEMONSTRATE`, but rejected `STUDENT_INTERACT` because student responses were physical hand-raising not captured in the transcript. Additionally, C5 identified `EDGE_CASE` based on the teacher's discussion of empty string outputs (*"Then obviously the output would be empty string because there is no prefix..."*).
   - Crucially, C5 did not uniformly outperform C4; rather, it demonstrated the exact same trade-off established in Step 2: **C5 trades recall for precision**, cutting false positives from 3 to 1 and elevating precision to 75.00% at the cost of missing one human-labeled behavior.

---

## 9. Latency & Infrastructure Reliability

- **Total Units Evaluated:** 2
- **C1 Mean Latency:** ~0 ms (deterministic regex)
- **C4 Mean Latency:** 2953.0 ms/unit
- **C5 Mean Latency:** 1646.0 ms/unit
- **Infrastructure Failures:** 0 (0 retries required, 100% JSON schema conformance).

---

## 10. Baseline Isolation Verification

- **Git Commit:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0`
- **Git Tag:** `v3.4-frozen`
- **Tracked Working Tree:** 100% clean (zero modifications to `server/engine/**`, Agent 1/2/3, PDI calculation, deterministic validators, or Phase 3 benchmark harness).

*Report compiled and cryptographically verified under commit `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (tag `v3.4-frozen`).*
