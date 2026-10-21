# Architecture Decision Record (ADR-009): Production Model Routing & Benchmark Rationale

**Status:** APPROVED & IMPLEMENTED  
**Date:** October 2026  
**Audience:** KMIT AI Quiz Engineering Team, ML Engineers, Backend Developers  
**Scope:** Speech-to-Text (STT) Routing, LLM Generation Engines, Agent Fallbacks, and Telemetry

---

## 1. Executive Summary

During early hackathon and prototype phases, the quiz generation pipeline accumulated multiple models and cascading emergency fallbacks across both Speech-to-Text (STT) and Large Language Model (LLM) layers:
* **STT Stack (4 models):** Local FastWhisper (:8000), Groq Whisper Large-v3-Turbo, Groq Whisper Large-v3, and Google Gemini Multimodal Flash.
* **LLM Stack (6 failovers):** Groq 120B, Groq 20B, Qwen 27B, Gemini 2.5 Flash, Local Ollama (`quiz-expert`), and Local vLLM.

While these fallback layers were introduced to prevent job failures during free-tier API rate limits, empirical testing and production operations revealed that cascading through low-capability or slow models degraded quiz quality (e.g. 50% grounding violation rate on 20B models) and caused unacceptable user delays (15–20 minutes on local CPU Whisper, 147s on Qwen).

This document establishes the official **1-Primary + 1-Fallback Production Architecture**:
* **Speech-to-Text:** **Groq Whisper Large-v3-Turbo** (Primary) with **Google Gemini 2.5 Flash** (Cloud Fallback).
* **Reasoning & Generation:** **Groq High-Capability (Llama-3.3-70B / 120B)** (Primary) with **Google Gemini 2.5 Flash** (Cloud Fallback).
* **Agent Fallbacks:** Strict domain-grounded fallbacks with **truthful observability**—never fabricating fake timestamps, never substituting canned questions in production, and never claiming deterministic regex passes as LLM-verified audits.

---

## 2. What Is Running in Production Right Now?

The table below details the active production engine components running on the server:

| Stage | Primary Engine | Fallback Engine | Fallback Trigger Condition | Current Behavior & Observability |
| :--- | :--- | :--- | :--- | :--- |
| **Audio Ingestion (STT)** | **Groq Whisper Large-v3-Turbo** | **Google Gemini 2.5 Flash** | Groq 429 rate limit or network outage | Full 1-hour lecture transcribed in ~12s with millisecond sentence timestamps (`provenance: 'GENUINE'`). If Gemini fallback is used, flat audio is transcribed and timestamps are marked `provenance: 'UNAVAILABLE'`. |
| **Document / Slide Parsing** | **Dual PDF/PPT Extractor** | **Tesseract OCR Engine** | Unextractable slide text / scanned diagrams | Extracts slide text and visual formulas, normalizing text chunks into 75-word child and 400-word parent windows for Hierarchical RAG. |
| **Agent 1: Curriculum Planning** | **Groq 120B / Llama 3.3 70B** | **Adaptive Transcript Term Extractor** | Corrupted JSON or LLM API timeout | Allocates 12 cognitive facets across Bloom's taxonomy. If planner LLM fails, falls back to high-frequency domain terms extracted from lecture evidence (no invented labels). |
| **Agent 2: Question Generation** | **Groq 120B / Llama 3.3 70B** | **Deterministic Slot Fallback** | Individual question timeout / 3 retries | Generates 4 distinct options with plausible distractors grounded in evidence. If an individual slot fails, delivers an honest partial quiz or unfulfilled record (no canned mock questions in prod). |
| **Agent 3: Evaluation & Repair** | **Deterministic Pre-Filter + LLM Critic** | **Deterministic Safety Filter Only** | LLM critic rate-limited / offline | Regex and equality checks filter out circular distractors and syntax errors. LLM critic evaluates deep pedagogical alignment. If LLM is unreachable, status logs `LLM_EVALUATION_UNAVAILABLE` truthfully. |
| **Storage & Caching** | **SHA-256 Multi-Tier Cache** | **SQLite / PostgreSQL dual-store** | Cache miss / cold run | Caches raw transcript, evidence packages, and plans. Re-generating the same lecture runs in < 15 seconds. |

---

## 3. Empirical Benchmark Evidence (Why Models Were Chosen)

Our model selection is governed by real benchmark experiments preserved in `Speech_To_Text/results/` and `Demo_project/production_engine/outputs/`.

### 3.1 Speech-to-Text Benchmark (*"Deepa Madam"* Bilingual Hinglish & *"Tapadia Sir"* English)

Tested on full classroom recordings:
* *Deepa Madam:* 46-minute bilingual Hinglish lecture on Greatest Common Divisor (GCD), LCM, and recursion.
* *Tapadia Sir:* Studio-quality English lecture on Operating Systems and Computer Architecture.

| Evaluated STT Model | Latency (1-Hr Audio) | Real-Time Factor (RTF) | Cost / Hr | Word Timestamps? | Bilingual / Indian Accent Fidelity | Decision & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Groq Whisper Large-v3-Turbo** | **12–15s** | **0.003 (250x RT)** | **~$0.02** | **Yes (Millisecond precision)** | **0.0% WER on English; 100% Technical Term Accuracy (TTA) on Hinglish.** | **KEEP AS PRIMARY**. Fastest, cheapest, and provides genuine timestamps for quiz evidence linking. |
| **Google Gemini 2.5 Flash** | 59.7s | 0.0158 (63x RT) | ~$0.07 | No (`segments: []`) | Unmatched phonetic capture of Hindi conversational phrases (*"Achcha agar tumko aata hai..."*). | **KEEP AS FALLBACK**. Reliable cloud backup if Groq is throttled, but cannot provide word-level timestamps. |
| **Deepgram Nova-2** | 37.85s | 0.0100 (99x RT) | $0.258 | Yes | **Severe English translation bias** (71.96% WER on Deepa Madam; forced Hindi cues into English words). | **REMOVED**. Alters spoken teacher phrasing. |
| **Local FastWhisper (:8000)** | 15–20 minutes | > 0.250 | $0.00 (CPU heavy) | Yes | High accuracy on GPU, but consumes 100% CPU and takes 20 minutes on standard host. | **REMOVED FROM PROD**. Directly violates the classroom 2-minute latency requirement. Retained for offline dev only. |

---

### 3.2 LLM Reasoning & Question Generation (Experiment 8 Specialization Benchmark)

Tested in `Demo_project/production_engine/outputs/experiment8_llm_benchmark_results.json` across 3 core non-generation tasks (N=3 repeated trials):
1. **Task 1:** Pedagogical Representation Extraction (Summary / Blueprint)
2. **Task 2:** Adaptive Assessment Planning (12 Cognitive Facets)
3. **Task 3:** Closed-Loop Critic & Surgical Patch Repair

| Model Candidate | Parameter Class | Planning Latency | Grounding Violation Rate | Defect Recovery | Verdict & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High-Capability (Groq 120B / Llama 3.3 70B)** | 70B–120B | **18.57s** | **0.0% (Passed Gate)** | **100% (9/9 fixed)** | **KEEP AS PRIMARY**. Zero grounding violations; deep Bloom cognitive reasoning; code syntax awareness. |
| **Google Gemini 2.5 Flash** | Cloud Hosted | **3–4s / call** | **< 5.0%** | **High** | **KEEP AS FALLBACK**. 1M token context; independent cloud provider infrastructure; prevents Groq 429 downtime. |
| **Efficiency Candidate (GPT-OSS 20B)** | 20B | 26.49s | **50.0% (FAILED Gate)** | 100% | **REMOVED**. 1 out of 2 generated concepts invented facts not in the lecture; distractors were trivial. |
| **Baseline Candidate (Qwen 3.6 27B)** | 27B | 59.60s (147s on Task 1) | **33.3% (FAILED Gate)** | 100% | **REMOVED**. Very slow response time (>2 minutes total); 33% grounding violation rate. |
| **Local Ollama (`quiz-expert`)** | 8B Local | 45–90s | High variance | Inconsistent | **DEV ONLY**. Too slow on consumer hardware without dedicated A100/H100 GPUs; schema errors. |

---

## 4. Architecture Diagrams

### 4.1 Previous Architecture: "Prototype Sprawl" (Decommissioned)

```mermaid
flowchart TD
    subgraph LEGACY["Legacy Prototype (Unstable Multi-Tier Cascades)"]
        Audio[Audio Input] --> STT0[Local FastWhisper :8000\n15-20 min CPU Timeout]
        STT0 -- "Timeout / Fail" --> STT1[Groq Whisper Large-v3-Turbo]
        STT1 -- "429 Limit" --> STT2[Groq Whisper Large-v3\n(Redundant 3x slower)]
        STT2 -- "429 Limit" --> STT3[Gemini Flash\n(Lost Timestamps)]
        
        STT3 --> LLM1[Groq 120B]
        LLM1 -- "Failover" --> LLM2[Groq 20B\n50% Hallucination Rate]
        LLM2 -- "Failover" --> LLM3[Qwen 27B\n147s Latency]
        LLM3 -- "Failover" --> LLM4[Gemini Flash]
        LLM4 -- "Failover" --> LLM5[Local Ollama]
        LLM5 -- "Failover" --> Mock[Canned Mock MCQs\n(Fake questions delivered)]
    end
```

### 4.2 Modern Production Architecture: Clean 1-Primary + 1-Fallback

```mermaid
flowchart TD
    subgraph PRODUCTION["Standard Production Pipeline (1-Primary + 1-Fallback)"]
        direction TB
        Input[Audio / Lecture Material] --> STT_Router{STT Router}
        
        STT_Router -- "Primary (12s, Word Timestamps)" --> Groq_STT["Groq Whisper Large-v3-Turbo"]
        STT_Router -. "Circuit Breaker (Outage / 429)" .-> Gemini_STT["Google Gemini 2.5 Flash\n(Honest Unavailable Timestamps)"]
        
        Groq_STT --> Evidence[Hierarchical Evidence Package\nDual Child/Parent Windows]
        Gemini_STT --> Evidence
        
        Evidence --> Agent1[Agent 1: Curriculum Planner]
        Agent1 -- "Primary LLM" --> Groq_LLM["Groq Llama-3.3-70B / 120B"]
        Agent1 -. "Quota Failover" .-> Gemini_LLM["Gemini 2.5 Flash"]
        
        Groq_LLM --> Agent2[Agent 2: Item Generator]
        Gemini_LLM --> Agent2
        
        Agent2 --> Agent3[Agent 3: Deterministic Pre-Check + Critic]
        Agent3 --> Verification{Audited & Grounded?}
        
        Verification -- "Yes" --> Output[Delivered Live Quiz]
        Verification -- "No (Provider Outage)" --> HonestFail[Honest Partial Result / Status = FAILED\n(Zero Canned Questions)]
    end
```

---

## 5. Clarification of the 3 Agent Fallbacks

Teammates frequently ask about the three agent fallback terms in logs:

### 1. `Build fallback plan` (Agent 1 Planner)
* **What it does:** If the planner LLM call times out or returns malformed JSON, this routine constructs the curriculum blueprint without an LLM.
* **How it was hardened:** Previously, it invented placeholder names like `"Mechanism Sequence - Aspect 2"`. It now scans the transcript for actual high-frequency technical keywords (e.g., `Recursion`, `Base Condition`, `Modulo`, `Page Table`), keeping questions rooted in the lecture.

### 2. `Generate question fallback` (Agent 2 Generator)
* **What it does:** If an individual question slot exceeds its retry budget or the model times out, this generates a deterministic definition question directly from the cited text chunk.
* **Production safeguard:** If all AI providers fail, it returns an explicit `UNFULFILLED_PROVIDER_FAILURE` record and partial count. It **never** injects unrelated canned questions into a teacher's quiz.

### 3. `Rejects heuristic` (Agent 3 Critic)
* **What it does:** Runs deterministic regex and mathematical checks (e.g. verifying 4 distinct non-empty options, checking for question marks, catching circular hints).
* **Truthfulness rule:** Heuristic checks act as a fast pre-filter. If the LLM critic is bypassed or offline, the quiz reports `LLM_EVALUATION_UNAVAILABLE`. A deterministic regex pass is **never** disguised as an LLM evaluation.

---

## 6. Configuration & Environment Variables Guide

To run the pipeline in production or local development, use the following configuration in `.env`:

```env
# ----------------------------------------------------------------------
# 1. SPEECH-TO-TEXT (STT) CONFIGURATION
# ----------------------------------------------------------------------
# Primary STT: Groq Whisper Turbo (12s turnaround for 1-hr audio)
GROQ_API_KEY=gsk_your_groq_api_key_here
STT_PROVIDER=groq
STT_MODEL=whisper-large-v3-turbo

# Fallback STT: Google Gemini (Active when Groq is throttled)
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
STT_FALLBACK_PROVIDER=gemini
STT_FALLBACK_MODEL=gemini-2.5-flash

# Set to true ONLY if developing locally without internet and running Python faster-whisper on :8000
ENABLE_LOCAL_STT=false

# ----------------------------------------------------------------------
# 2. LLM REASONING & GENERATION CONFIGURATION
# ----------------------------------------------------------------------
# Primary LLM: Groq Hosted High-Capability
GROQ_MODEL=openai/gpt-oss-120b
# Or llama-3.3-70b-versatile

# Fallback LLM: Gemini 2.5 Flash (Cloud high-throughput backup)
GROQ_FALLBACK_MODEL=gemini-2.5-flash

# Set to true ONLY for local unit tests; strictly blocked in production and staging
ALLOW_MOCK_FALLBACK=false

# ----------------------------------------------------------------------
# 3. ENVIRONMENT MODE
# ----------------------------------------------------------------------
NODE_ENV=production
APP_ENV=production
```

---

## 7. Summary for Teammates

1. **Do not re-add 20B or Qwen models** to the Groq failover chain; benchmarks show they degrade quiz quality and exceed latency limits.
2. **Do not re-enable local FastWhisper by default**; it takes 15–20 minutes on CPU and stalls the pipeline.
3. **Always report real model provenance**; if Gemini Flash is used for audio fallback, do not claim Whisper Turbo generated the timestamps.
4. **All 45 production integrity test suites** in `server/test/` verify these contracts and must pass before deploying to main.
