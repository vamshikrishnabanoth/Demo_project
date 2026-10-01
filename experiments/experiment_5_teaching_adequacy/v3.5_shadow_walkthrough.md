# Walkthrough: Live Pipeline Observability Workbench & Shadow-Mode Benchmark

**Release Target:** v3.5-shadow  
**Release Commit:** `d9034c5b9ec9e2adb7bb3b0c5eb273e93e72c351` (`tag: v3.5-shadow`)  
**Baseline Anchor:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (`v3.4-frozen`)  
**Status:** Frozen as a v3.5-shadow engineering milestone.

---

## 1. Evidence-Level Classification of Claims

To preserve scientific rigor, all findings in this milestone report are classified by their evidentiary standing:

| Claim | Current Evidence Level | Scope & Boundary Conditions |
| :--- | :--- | :--- |
| **Trace viewer reads and renders real request traces** | **Demonstrated** for tested request | Verified on real 26-event JSONL trace (`test_v3_e2e_1790862034526.jsonl`). Not yet claimed for all multimodal paths. |
| **P5.3 false-positive warning reduction** | **Development-set result** | $70.0\%$ reduction ($10 \rightarrow 3$ warnings) on the 10 audited development cases. Does NOT establish generalizable diagnostic accuracy. |
| **Speech failover & boundary preservation** | **Passed injected-timeout test** | Primary timeout + fallback verified; $25/25$ boundary words preserved across 2 junctions. $0\text{ ms}$ start latency reflects $1\text{ ms}$ timer resolution. |
| **Frozen regression suite preservation** | **49/49 passed** | Exclusivity (12/12), Grounding (12/12), Answer-key (25/25) pass cleanly on frozen baseline. |
| **Live latency under shadow workload** | **No penalty detected in randomized trial ($N=40$)** | Difference in sample medians $= -6.79\text{ ms}$; difference in sample means $= +117.13\text{ ms}$ with 95% CI $[-143.36\text{ ms}, +377.63\text{ ms}]$ spanning zero ($t = 0.941$, $df = 19$). Mann-Whitney $U = 141$ ($z = -1.596$). Zero live request errors ($0/40$). Does not establish formal equivalence. |
| **Trace-write failure immunity** | **Demonstrated via fault injection** | Live generation delivered 4 MCQs with zero unhandled exceptions when trace disk I/O threw continuous `ENOENT`. |
| **Generalizable P5.3 diagnostic improvement** | **Not established** | Requires held-out evaluation across unseen lecture corpora. |
| **Readiness for broad classroom rollout** | **Not established** | Multi-tenant isolation, keyed HMAC hashing, and live teacher review UI required. |

---

## 2. Git Baseline & Codebase Inventory

Verification performed via `git log -n 1 --decorate` and `git status`:

```
commit d9034c5b9ec9e2adb7bb3b0c5eb273e93e72c351 (HEAD -> main, tag: v3.5-shadow)
Author: Samanvi Chidambaram <samanvi.chidambaram@gmail.com>
Date:   Thu Oct 1 20:16:52 2026 +0530

    docs(v3.5-shadow): finalize release commit hash in repository documentation

Release Package Additions:
  - server/engine/tracing/pipelineTracer.js (Streams structured JSONL events to traceService)
  - server/config/featureFlags.js           (Strict boolean parser & runtime configuration logging)
  - server/engine/shadow/shadowRunner.js    (Bounded queue, concurrency cap, AbortController)
  - server/services/traceService.js         (Asynchronous JSONL trace stream writer & manifest index)
  - server/utils/tracePurge.js              (Automated rolling 7-day trace purge utility)
  - workbench/app.py                        (FastAPI backend with embedded single-page HTML/JS viewer)
  - experiments/                            (Phase 5 empirical research artifacts, raw results & runner suite)
  - docs/walkthrough_v3.5_shadow.md         (Committed repository walkthrough report)

Working Tree Status: Clean (nothing to commit, working tree clean)
```

**Untouched Production Core:**
- `server/engine/agents/agent2Generator.js` $\rightarrow$ **100% UNTOUCHED**
- `server/engine/validators/**` $\rightarrow$ **100% UNTOUCHED**
- `server/controllers/quizController.js` $\rightarrow$ **100% UNTOUCHED**

---

## 3. Observability Workbench Architecture & Privacy Governance

### 3.1 Technology Stack & Serving Method
- **Backend Framework:** FastAPI (`fastapi` 0.141.1) served via Uvicorn.
- **Frontend Architecture:** Embedded native HTML5/CSS/JavaScript single-page application.
- **Host Binding:** Locally accessible on `http://127.0.0.1:8088` (single-tenant local developer tool; remote user authentication is not implemented).
- **Trace Source:** Direct streaming read of real `.jsonl` files from `server/logs/traces/` and `manifest.json`.

### 3.2 Visual Invariant: Truthful Representation
- **Pipeline Execution DAG:** Displays executed stages (`COMPLETED`, `STARTED`, `FALLBACK`, `FAILED`).
- **Absence Reporting:** Unexecuted or uninstrumented stages appear honestly with a dashed border as **`NOT RECORDED`**—zero synthetic concept graphs, placeholder chunks, or estimated costs.

### 3.3 Data Privacy, Access & Retention Policy
1. **Secret Scanning:** Automated regex scan across all 29 trace files verified zero occurrences of Groq API keys (`gsk_...`), Bearer tokens (`Bearer ...`), or password strings.
2. **PII Anonymization:** Plain SHA-256 is recognized as vulnerable to dictionary inversion for predictable student rosters. For live multi-tenant deployment, direct identifiers must be avoided; where linkage is needed, a keyed HMAC (`crypto.createHmac('sha256', secretKey)`) with restricted key storage is required.
3. **Automated Rolling Purge Utility (`server/utils/tracePurge.js`):**
   - **Dry-run Mode:** Verified via unit harness (`scratch/test_trace_purge.js`)—identified expired candidates and accurately estimated reclaimable bytes without mutating any files or the manifest. (A dry run on `server/logs/traces` identified 55 candidate files and 1998.2 KB reclaimable).
   - **Actual Purge Mode:** Verified on test sandbox—successfully unlinked the 2 expired files, preserved recent files, and synchronized `manifest.json` to retain only existing traces.

---

## 4. Empirical 10-Case P5.3 Audit & Development-Set Calibration

### 4.1 Diagnostic Status Rule
In P5.3, coverage status is evaluated strictly against the **normative expected depth from P5.1**, not human rater depth:
$$\text{Status} = \begin{cases} \text{COVERED} & \text{if } \text{ObservedDepth} \ge \text{ExpectedDepth} \\ \text{ACTIONABLE\_COVERAGE\_GAP} & \text{if } \text{ObservedDepth} < \text{ExpectedDepth} \text{ and Tier is REQUIRED} \\ \text{PERMISSIBLE\_SCOPE\_OMISSION} & \text{if } \text{ObservedDepth} < \text{ExpectedDepth} \text{ and Tier is OPTIONAL/PERMISSIBLE} \end{cases}$$

### 4.2 Itemized Audit Table
| # | Package & Dimension | Exp Depth | Exp Tier | Orig Depth | Orig Status | Calib Depth | Calib Status | GT Depth | GT Status | Diagnosis & Evidence Citation |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `pkg_01` (Meaning) | 4 | REQ | 3 | GAP | **5** | **COVERED** | 4 | COVERED | **Category A: Depth Rigidity** (Resolved). Rationale of dignified life exceeds Level 4 expectation. |
| **2** | `pkg_01` (Structure) | 4 | REQ | 0 | GAP | **4** | **COVERED** | 4 | COVERED | **Category C1: Pipeline Handoff Gap** (Resolved). C03 B.N. Rau debate evidence now indexed from P5.2A. |
| **3** | `pkg_01` (Relationships) | 5 | REQ | 0 | GAP | **5** | **COVERED** | 4 | COVERED | **Category C2: Concept Extraction Omission** (Resolved). Golden Triangle dynamics recognized inside Silo Theory. |
| **4** | `pkg_01` (Justification) | 5 | REQ | 0 | GAP | **5** | **COVERED** | 5 | COVERED | **Category B: Holistic Teaching** (Resolved). Natural justice rationale credited within Maneka Gandhi narrative. |
| **5** | `pkg_01` (Application) | 6 | REQ | 5 | GAP | **6** | **COVERED** | 6 | COVERED | **Category A: Proof Bias** (Resolved). Worked comparative analysis of Gopalan vs Maneka Gandhi credited at Level 6. |
| **6** | `pkg_03` (Meaning) | 3 | REQ | 2 | GAP | **3** | **COVERED** | 4 | COVERED | **Category A: Depth Rigidity** (Resolved). Calibrated depth reached 3, which satisfies Expected Depth 3 ($3 \ge 3 \implies \text{COVERED}$). |
| **7** | `pkg_03` (Relationships) | 5 | REQ | 4 | GAP | 3 | GAP | 5 | COVERED | **Category A: Formal-Proof Bias (Unresolved FP)**. Calibrated evaluator still demanded formal inductive proof for Level 5. |
| **8** | `pkg_03` (Justification) | 5 | REQ | 0 | GAP | 4 | GAP | 5 | COVERED | **Category B: Holistic Teaching (Unresolved FP)**. Cycle-prevention rationale scored Level 4; still below Level 5 expectation. |
| **9** | `pkg_04` (Identification) | 2 | REQ | 0 | GAP | **2** | **COVERED** | 2 | COVERED | **Category C3: Semantic Parsing Bias** (Resolved). Algorithm naming alongside queue definition credited at Level 2 ($2 \ge 2$). |
| **10** | `pkg_05` (Application) | 6 | REQ | 1 | GAP | 5 | GAP | 4 | COVERED | **Category A: Depth Rigidity (Unresolved FP)**. VAE image pixel compression scored Level 5 without code trace; below Level 6 expectation. |

**Development-Set Result:** 7 of 10 false-positive warnings resolved ($70.0\%$ reduction on dev-set). Rows 7, 8, and 10 remain **unresolved false positives** where the calibrated prompt remains conservative. The original Phase 5 benchmark outputs remain frozen and unmodified in `p5_3_diagnostic_matrix.json`.

---

## 5. Operational Speech Failover & Boundary Verification

### 5.1 Latency Measurements
- **Primary Timeout Threshold:** $5000\text{ ms}$ (simulated hang).
- **Fallback Start Latency:** $0\text{ ms}$ (Target $< 100\text{ ms}$).  
  *Measurement Note:* Reflects JavaScript `Date.now()` millisecond clock resolution ($\pm 1\text{ ms}$) in a synchronous catch block where fallback dispatch occurs immediately, not literally zero OS/CPU overhead.
- **Fallback Execution Latency:** $451\text{ ms}$ (Target $< 1500\text{ ms}$ $\rightarrow$ **PASS**).
- **Total Recovery Latency:** $5461\text{ ms}$ ($5000\text{ ms timeout} + 0\text{ ms start} + 451\text{ ms exec} + 10\text{ ms overhead}$).

### 5.2 Streaming Boundary Word Preservation
- **Evaluation Denominator:** 3 consecutive audio/transcript windows, 2 boundary overlap junctions, evaluating $N=25$ reference words crossing boundaries.
- **Word Preservation Rate:** $25 / 25 = 100\%$ with zero dropped words and zero duplicate artifacts.

---

## 6. Randomized Interleaved ON/OFF Benchmark ($N=40$) & Fault Injection

To test live-path interference under realistic operating conditions without arbitrary pairing assumptions, we executed an interleaved trial across $N=40$ requests (20 OFF, 20 ON) in pseudo-random order using [`experiments/experiment_5_teaching_adequacy/runner/test_shadow_randomized_benchmark.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/test_shadow_randomized_benchmark.js). Random interleaving helps mitigate systematic time-order effects, though it does not eliminate them entirely. Analyzing the data as two independent groups reflects that runs were independent requests rather than matched pairs.

| Metric | Shadow Mode OFF ($N=20$) | Shadow Mode ON ($N=20$) | Interleaved Group Comparison ($\text{ON} - \text{OFF}$) |
| :--- | :---: | :---: | :---: |
| **Mean Live Latency** | $554.40\text{ ms}$ | $671.53\text{ ms}$ | $+117.13\text{ ms}$ |
| **Median Live Latency** | $553.37\text{ ms}$ | $546.58\text{ ms}$ | **$-6.79\text{ ms}$** |
| **P95 Live Latency** | $568.70\text{ ms}$ | $687.55\text{ ms}$ | $+118.85\text{ ms}$ |
| **Latency Std Dev** | $12.66\text{ ms}$ | $556.46\text{ ms}$ | $\text{SE}_{\text{diff}} = 124.46\text{ ms}$ |
| **Range [Min - Max]** | $[538.75 - 598.21]\text{ ms}$ | $[531.04 - 3035.42]\text{ ms}$ | — |
| **95% Confidence Interval (Means)** | — | — | **$[-143.36\text{ ms}, +377.63\text{ ms}]$ (Spans Zero)** |
| **Welch's $t$-statistic** | — | — | $t = 0.941$ ($df = 19$, $p \approx 0.36$) |
| **Mann-Whitney $U$ Test** | — | — | $U = 141$, $z = -1.596$ ($p \approx 0.11$) |
| **Live Request Errors** | **$0 / 20$** | **$0 / 20$** | **0 / 40 total errors** |
| **Heap Memory Delta** | — | — | $+1.33\text{ MB}$ |

### Rigorous Statistical Interpretation:
In the randomized interleaved trial, median live latency was **$553.37\text{ ms}$** with shadow mode OFF and **$546.58\text{ ms}$** with shadow mode ON (difference in sample medians: **$-6.79\text{ ms}$**). The difference in sample means was **$+117.13\text{ ms}$**, with an exact 95% Welch confidence interval spanning zero ($[-143.36\text{ ms}, +377.63\text{ ms}]$). No live request errors occurred in either condition ($0/40$). 

**Conclusion:** No clear latency penalty was detected in this small trial. However, this finding does not establish formal equivalence or rule out a practically meaningful slowdown under sustained production load.

### Two-Group Methodology, Sequence & Outlier Sensitivity:
1. **Independent Two-Group Design:** Arbitrary sequence pairing ($k$-th OFF with $k$-th ON) was eliminated in favor of an independent two-group comparison appropriate for randomized interleaved trials.
2. **Confidence Interval Arithmetic:** The 95% confidence interval for the difference between population means $(\mu_{\text{ON}} - \mu_{\text{OFF}})$ is computed using Welch's $t$-interval for unequal variances:
   $$\text{SE}_{\text{diff}} = \sqrt{\frac{s_{\text{OFF}}^2}{n_{\text{OFF}}} + \frac{s_{\text{ON}}^2}{n_{\text{ON}}}} = \sqrt{\frac{12.66^2}{20} + \frac{556.46^2}{20}} = \sqrt{8.01 + 15482.49} = 124.46\text{ ms}$$
   $$\text{Welch-Satterthwaite } df = 19, \quad t_{0.025, 19} = 2.093$$
   $$\text{CI}_{95\%} = \Delta\bar{X} \pm (t_{\text{crit}} \times \text{SE}_{\text{diff}}) = +117.13 \pm (2.093 \times 124.46) = +117.13 \pm 260.49 = [-143.36\text{ ms}, +377.63\text{ ms}]$$
3. **Observed Condition Sequence ($N=40$):**
   ```
   [1-10]   ON,  ON,  OFF, ON,  ON,  OFF, ON,  OFF, ON,  ON
   [11-20]  ON,  OFF, OFF, OFF, OFF, OFF, ON,  ON,  ON,  OFF
   [21-30]  OFF, ON,  ON,  OFF, ON,  ON,  OFF, OFF, ON,  OFF
   [31-40]  OFF, ON,  ON,  OFF, OFF, OFF, OFF, OFF, ON,  ON
   ```
4. **Outlier Impact on Mean vs. Median:** Because request #1 happened to be assigned to the ON condition, the cold-start circuit-breaker backoff ($3,035.42\text{ ms}$) fell entirely on the ON group. This startup transient explains the positive mean difference ($+117.13\text{ ms}$) without altering the typical rank or median. The sample median was slightly lower in the ON condition ($546.58\text{ ms}$ vs $553.37\text{ ms}$, $\Delta = -6.79\text{ ms}$).
5. **Mann-Whitney Qualification:** The Mann–Whitney test did not detect a statistically significant rank-based difference between the two groups ($U = 141, z = -1.596, p \approx 0.11$). This finding indicates absence of a strong rank shift, but does not prove that the medians are identical or that the underlying latency distributions are equivalent.
6. **Audit Trail:** All 40 individual request records (sequence order, condition, latency, question counts) are recorded in [`shadow_randomized_benchmark_summary.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/raw_results/shadow_randomized_benchmark_summary.json) under `raw_requests`.

### Fault Injection Verifications:
1. **Trace-Write Disk Failure Immunity:** Deliberately pointed `traceService.tracesDir` to a non-existent drive root (`Z:\non_existent_drive_root\invalid_traces_dir`). Live quiz generation delivered all 4 MCQs and completed all 9 pipeline stages with **zero unhandled exceptions**.
2. **Queue Overflow Drop Policy:** Flooded `ShadowRunner` with 15 rapid requests (exceeding `MAX_QUEUE_SIZE = 10`). Queue strictly capped at 10 items, dropping the 5 oldest tasks with decision `DROPPED_QUEUE_OVERFLOW`.
3. **Downstream Timeout & AbortController:** Injected an 800ms slow task with a 200ms threshold; `AbortController` aborted at 200ms, caught the signal cleanly, and reset `activeTaskCount` to 0 immediately.

---

## 7. Frozen Regression Suite & Reproducibility Package

### Release Commit Anchor:
- **Git Commit:** `d9034c5b9ec9e2adb7bb3b0c5eb273e93e72c351`
- **Git Tag:** `v3.5-shadow`
- **Working Tree:** Clean (all files committed)

### Regression Suites:
- `server/test/test_option_exclusivity_gate.js`: 12 / 12 **PASS**
- `server/test/test_grounding_gate_contract.js`: 12 / 12 **PASS**
- `server/test/test_answer_key_distribution.js`: 25 / 25 **PASS**
- **Total:** 49 / 49 tests passed ($100\%$).

### Reproducibility Inventory:
- **Scripts (Committed in Repository):**
  - Benchmark: [`experiments/experiment_5_teaching_adequacy/runner/test_shadow_randomized_benchmark.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/test_shadow_randomized_benchmark.js)
  - Purge Utility: [`server/utils/tracePurge.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/utils/tracePurge.js) & Test Harness [`experiments/experiment_5_teaching_adequacy/runner/test_trace_purge.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/test_trace_purge.js)
  - P5.3 Audit: [`experiments/experiment_5_teaching_adequacy/runner/audit_p5_3_ten_cases.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/audit_p5_3_ten_cases.js)
  - Speech Failover: [`experiments/experiment_5_teaching_adequacy/runner/test_speech_operational_failover.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/test_speech_operational_failover.js)
- **Raw Results Data:**
  - [`shadow_randomized_benchmark_summary.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/raw_results/shadow_randomized_benchmark_summary.json)
  - [`p5_3_ten_cases_audit_development_set.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/raw_results/p5_3_ten_cases_audit_development_set.json)
  - [`speech_failover_test_summary.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/raw_results/speech_failover_test_summary.json)

---

## 8. Frozen Milestone Conclusion

> **Official Milestone Freezing Statement:**  
> v3.5-shadow is frozen as an engineering and observability milestone. The documented tests demonstrate the shadow runtime’s tested behavior, fault handling, trace visualization, and preservation of the specified regression suites. In a small randomized interleaved benchmark of 40 requests, no clear live-latency penalty was detected. The wide confidence interval means a practically meaningful slowdown remains possible. Generalizable P5.3 diagnostic improvement and readiness for broad classroom rollout remain unestablished.

