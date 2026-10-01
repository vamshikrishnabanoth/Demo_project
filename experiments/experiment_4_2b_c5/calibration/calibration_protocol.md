# Experiment 4.2b — Step 2: C5 Calibration Protocol

**Version:** 1.0.0  
**Baseline Git State:** `b1b1553` (tag `v3.4-frozen`)  
**Status:** Frozen & Approved Protocol

---

## 1. Purpose & Objective
This protocol governs the formulation, calibration, cryptographic locking, and evaluation of **C5** (`C5_LLM_CALIBRATED`), an open-weight foundation model classifier (`openai/gpt-oss-120b` via Groq) augmented with few-shot non-benchmark boundary demonstrations and explicit negative constraint rules.

The objective is to determine whether few-shot boundary calibration mitigates the substantial false-positive over-attribution observed in `C4_LLM_ZERO_SHOT` (31 false positives across 17 units, 0% F1 on `STUDENT_INTERACT`) while preserving its strong semantic recall on complex teaching behaviors.

---

## 2. Hard Anti-Leakage & Isolation Constraints
1. **Isolation of Phase 3.4 Production Pipeline:**
   - No modifications to `server/engine/**`, `Agent 1/2/3`, `PDI`, validators, grounding gates, or Phase 3 benchmark harness.
   - Commit `b1b1553` / `v3.4-frozen` remains 100% untouched.
2. **Immutability of Prior Phase 4 Benchmarks:**
   - `experiments/experiment_4_2/` and `experiments/experiment_4_2b/` artifacts are immutable baselines.
   - Frozen ground-truth file `experiments/experiment_4_2/ground_truth/behavior_annotations.json` remains untouched.
3. **Absolute Test Set Barrier:**
   - The 17 evaluation units (`GT-G00` to `GT-G09` from `BENCH_04` and `GT-D01` to `GT-D07` from `BENCH_03`) must NEVER appear in the calibration dataset.
   - No quotes, paraphrases, or domain-specific concepts (Git CLI commands, GCD/LCM/Recursion) from the evaluation units are permitted in the calibration dataset.
   - The frozen 17 units must NOT be executed, evaluated, or inspected during calibration prompt iteration.

---

## 3. Four Mandatory Negative Boundary Families
The calibration dataset (`calibration_examples.json`) defines 8 dedicated examples (2 per family) covering:
1. **Boundary A: `STUDENT_INTERACT`**
   - *Negative Boundary (A1):* Rhetorical questioning and self-answered instructor questions must NOT be labeled `STUDENT_INTERACT`.
   - *Positive Boundary (A2):* Observable multi-party turn-taking, student dialogue, and explicit instructor acknowledgment must be labeled `STUDENT_INTERACT`.
2. **Boundary B: `REAL_WORLD_APP`**
   - *Negative Boundary (B1):* Passing conceptual mentions of software engineers, developers, or industry tools must NOT be labeled `REAL_WORLD_APP`.
   - *Positive Boundary (B2):* Concrete operational scenarios, industrial workflows, or practical failure modes must be labeled `REAL_WORLD_APP`.
3. **Boundary C: `DEMONSTRATE`**
   - *Negative Boundary (C1):* Verbal explanations of syntax, functions, or parameter definitions must NOT be labeled `DEMONSTRATE`.
   - *Positive Boundary (C2):* Active terminal command execution, code manipulation, and direct observation of outputs must be labeled `DEMONSTRATE`.
4. **Boundary D: `PRACTICE`**
   - *Negative Boundary (D1):* Explaining an algorithmic concept or discussing code mechanics must NOT be labeled `PRACTICE`.
   - *Positive Boundary (D2):* Explicitly giving students an exercise, challenge, or lab task to complete must be labeled `PRACTICE`.

---

## 4. Exact-Match Calibration Criterion
Calibration success is strictly defined as:
$$\text{Set}(\text{Predicted Labels}_i) \equiv \text{Set}(\text{Expected Labels}_i) \quad \forall i \in \{1 \dots 8\}$$
Both positive and negative boundaries must be satisfied simultaneously for all 8 calibration examples.

---

## 5. Phased Scientific Workflow
1. **Calibration Iteration Loop:**
   - Execute C5 against the 8 calibration examples.
   - If any example fails exact set match, refine prompt instructions and negative boundaries within the calibration harness.
   - Repeat until 8/8 exact matches are achieved.
2. **Cryptographic Configuration Lock:**
   - Compute SHA-256 hashes of system prompt, calibration dataset, canonical taxonomy, and runner script.
   - Write lock manifest `c5_config_lock.json`.
   - Once locked, NO further prompt adjustments are permitted.
3. **Single-Pass Evaluation:**
   - Execute locked C5 ONCE across the frozen 17 evaluation units.
   - Save raw responses to `experiments/experiment_4_2b_c5/raw_outputs/evaluation/`.
4. **Infrastructure Abort Rule:**
   - 17/17 completed + 0 infrastructure failures $\longrightarrow$ Valid evaluation.
   - Any API failure, timeout, or missing unit $\longrightarrow$ Abort run, investigate infrastructure, and rerun locked configuration. Do NOT alter prompt.
5. **Comparative Multi-Dimensional Analysis:**
   - Compare C1, C2, C3, C4, and C5 on Micro/Macro P/R/F1, TVD, Cosine Distance, class-specific metrics, and false-positive inflation ratio.
