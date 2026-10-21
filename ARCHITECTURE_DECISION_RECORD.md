# Architecture Decision Record (ADR-009): Production Model Routing & Benchmark Rationale

For the full detailed engineering decision record, benchmark tables, and architecture diagrams, please refer to:
[MODEL_ARCHITECTURE_AND_BENCHMARK_RATIONALE.md](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/docs/MODEL_ARCHITECTURE_AND_BENCHMARK_RATIONALE.md)

### Quick Summary
- **Speech-to-Text (STT):**
  - **Primary:** `whisper-large-v3-turbo` (via Groq Cloud, ~12s turnaround for 1-hr lecture, millisecond timestamps)
  - **Fallback:** `gemini-2.5-flash` (via Google GenAI, cloud failover when Groq is throttled)
  - **Retired:** Local FastWhisper (15-20 min CPU execution), Whisper Large-v3 (redundant 3x slower duplicate), Deepgram Nova-2 (translated Hindi conversational cues to English).
- **LLM Reasoning & Generation:**
  - **Primary:** Groq High-Capability (`openai/gpt-oss-120b` or `llama-3.3-70b-versatile`, 0.0% grounding violation rate in Experiment 8)
  - **Fallback:** `gemini-2.5-flash` (via Google GenAI, high concurrency quota ceiling)
  - **Retired:** `openai/gpt-oss-20b` (50% grounding violation rate in Exp 8), `qwen/qwen3.6-27b` (147s latency in Exp 8), Local Ollama/vLLM (too slow on CPU).
- **Agent Fallbacks:**
  - Agent 1 Planner: Grounded transcript term extraction (no invented labels).
  - Agent 2 Generator: Deterministic slot fallback; honest partial delivery if offline (zero canned questions in production).
  - Agent 3 Critic: Fast deterministic pre-filter + truthful LLM verification reporting (never disguising regex checks as LLM audits).
