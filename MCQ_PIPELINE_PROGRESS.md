# MCQ Pipeline — Progress Log

Branch: `claude/nifty-hopper-we9e1s` (includes all work from `handoff/complete-implementation-nov-2026`).
Audit and full plan: `TEACHER_ROLE_COMPLETE_IMPLEMENTATION_AUDIT.md`.

## Status (2026-11-11, 14:45 IST)

| Stage | Status |
|---|---|
| 1. Restore delivery | **Done** (`abf84dc`) |
| 2. Any input / live reliability | **Mostly done** — remaining: live verification on real lectures |
| 3–9 | Not started |

## Done

**Stage 1 (`abf84dc`)**
- Fixed `const` reassignment that failed every successful run on the handoff branch.
- Attempt budget scales with the request (now 3x, cap 60) instead of a fixed 12.
- Honest shortfall reasons (cancelled / provider / attempt budget / difficulty / quality / genuinely limited material).
- A broken question is replaced, not the whole quiz failed.
- Removed benchmark-specific production code (MULTI_005 loader, hardcoded misconceptions, Banker's answer override).
- `test/test_pipeline_end_to_end_delivery.js` added to `npm test`.

**Stage 2 so far (`4086630`, `09c7514`, `a65ae94`)**
- LLM router: per-model pacing from rate-limit headers, waits instead of failing (budget `LLM_RATE_LIMIT_WAIT_BUDGET_MS`, default 90 s), `reasoning_effort=low` for gpt-oss, retired models replaced.
- Generator batch prompt: answer derived from evidence first, verbatim key + index, self-contained stems with code, explicit Easy/Medium/Hard definitions, misconception-based distractors.
- Validators: near-miss distractors (step order, operand, boundary, identifier) no longer rejected as synonyms; vocabulary-only overlap is flagged to the semantic evaluator; trace/state-prediction questions recognised as Medium; length rules only fire when the key is the outlier; code lines don't count toward stem length.
- Input routing (`server/utils/inputKind.js`): only a short topic name is a topic; pasted notes/code/SQL/terminal sessions are material. `test/test_input_kind_routing.js` in `npm test`.
- PPTX read slide by slide with notes (`server/utils/pptxSlides.js`); scans/images via OCR instead of base64; `.txt` = document; YouTube without captions fails honestly.

## Live evidence so far (Groq free tier)
- MAT_004 (DS lab manual), 5 Medium: delivered 0–2 per run before the last fixes; delivered questions were correct code traces. Latest fixes not yet verified live.
- **DBMS SQL Joins doc (team dataset), 5 Balanced, after all Stage 2 fixes: 4/5 delivered in 211 s.** Keys correct. Remaining quality issues seen: one stem refers to table rows not shown in the question (not self-contained); one stem slightly inconsistent with its query; some distractors too easy; a trace question labelled Easy. Rejections: AMBIGUOUS_DISTRACTOR x4, TIER_COGNITIVE_MISMATCH x3, option/style checks x4.
- Blockers: Groq free tier = 8k tokens/min per model and a daily token cap (exhausted on 2026-11-11). Gemini fallback key saved but rejected as invalid (check the secret has no "Bearer" prefix).

## Next steps
1. Add a self-containment check (stem must include the data it refers to), review remaining AMBIGUOUS_DISTRACTOR / TIER_COGNITIVE_MISMATCH rejections, then live-verify Stage 2 on more real inputs (DBMS joins doc, MAT_004, a pasted terminal session, a lecture audio) once a provider has quota; fix remaining rejection causes.
2. Stage 3: single lecture model shared by preview, capacity, generation and teaching score; real timestamped segments; slide↔speech alignment.

## Running a live check
```
cd server
GROQ_API_KEY=proxy-injected npm test            # offline suites
```
Live runs need a working Groq (or Gemini) key in the environment's network secrets.
