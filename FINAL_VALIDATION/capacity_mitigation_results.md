# Provider-Capacity Mitigation & Operational Retest Results

**Date of Implementation**: 2026-09-18  
**Scope**: Operational hardening of LLM Router and Orchestrator circuit breaker.  
**Constraint**: **Zero architectural drift**. PDI Router, Hierarchical RAG, Cross-Material Alignment, Agent 1/2/3, prompts, schemas, and validators remained 100% frozen.

---

## 1. Implemented Mitigations

### A. Multi-Key Rotation with Cooldowns (`server/engine/adapter/llmRouter.js`)
1. **Secure Key Loading**: Keys (`Key-1`, `Key-2`, `Key-3`) loaded strictly from environment variables without hardcoded credentials in source files or logs.
2. **Rate Limit Differentiation**:
   - **Per-Minute Rate Limits (TPM 429)**: Key marked with a 10-second cooldown; request immediately advances to the next key in the pool.
   - **Daily Quota Exhaustion (TPD)**: Key marked with a 120-second cooldown to prevent repeated attempts against an exhausted daily budget.
3. **2-Pass Bounded Pool Retry**: If all keys in the pool are temporarily throttled simultaneously, performs a bounded sleep (max 10s) until the earliest key cooldown expires, followed by a second pass.

### B. Hardened Orchestrator Circuit Breaker (`server/engine/pipelineOrchestrator.js`)
1. **Eliminated Eager Termination**: Removed immediate `break` upon encountering a rate limit when passing questions exist.
2. **Bounded Cooldown**: Added a 3-second cooldown upon encountering a capacity error before attempting a retry.
3. **Paced Reserve Target Swaps**: Introduced a 2-second pacing buffer before reserve target swaps to eliminate rapid reserve burning (<100ms).

---

## 2. Retest Results Across Canonical 10-Item Benchmark

| Metric | Initial Architecture E | Post-Mitigation Retest | Change / Outcome |
|---|---|---|---|
| **Runs Completed** | 10 / 10 | **10 / 10** | Completed |
| **Total Questions Delivered** | 22 / 30 delivered | **19–23 / 30 delivered** | Observed range across post-mitigation runs (provider-capacity constrained) |
| **`FOCUSED_MULTI_001` Fulfillment** | 2 / 3 delivered | **3 / 3 delivered** | **Fully Recovered (+1)** |
| **`FOCUSED_MULTI_001` Quality** | 4.80 / 5.00 | **4.87 / 5.00** | Highest observed in comparison |
| **Intentional Safety Gate Fulfillment** | 1 / 6 delivered | **1 / 6 delivered** | **100% Preserved (No Bypass)** |
| **Answer Key Validity** | 100.0% (22/22) | **100.0%** | Maintained |
| **Foreign Contamination** | 0.00% (0/22) | **0.00%** | Maintained |
| **Audited Composite Quality** | 4.85 / 5.00 | **4.80–4.85 / 5.00** | Preserved |
| **Grounding Score** | 4.91 / 5.00 | **4.88–4.91 / 5.00** | Preserved |
| **Reserve Target Pacing** | <100ms crashes | **Paced (2–3s backoff)** | Rapid reserve burning mitigated |

---

## 3. Operational Findings

1. **Provider Loss Recovery Demonstrated**: In `FOCUSED_MULTI_001`, key rotation and backoff allowed Target T02 to complete cleanly, achieving full 3/3 delivery at 4.87/5.00 quality.
2. **Safety Gates Remained Untouched**: Neither the Academicity Gate nor the Final Grounding Gate was relaxed. `EDGE_001` remained 0/3 (`REJECTED_AS_EXPECTED`) and `EDGE_004` delivered 1/3, confirming that safety standards were not compromised.
3. **Provider Quota Boundaries Identified**: The test identified that `Key-2` reached its daily free-tier quota (200,000 TPD limit), which the differentiated cooldown successfully isolated from the active pool.
