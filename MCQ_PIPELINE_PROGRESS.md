# MCQ Pipeline — Progress Log

Branch: `claude/nifty-hopper-we9e1s` (includes all work from `handoff/complete-implementation-nov-2026`).
Audit and full plan: `TEACHER_ROLE_COMPLETE_IMPLEMENTATION_AUDIT.md`.

## Status (2026-11-11, evening — branch `teacher-role/stage3-lecture-model`, not yet committed)

| Stage | Status |
|---|---|
| 1. Restore delivery | **Done** (`abf84dc`) |
| 2. Any input / live reliability | **Done** (Stage 2 commits) + verified live below |
| 3. Shared lecture model, real timestamps, slide↔speech | **Done** (`server/engine/intelligence/lectureModel.js`) |
| 4. Capacity, allocation, 0–30 | **Done** |
| 5. Generation and distractors | **Partly** — angle-specific prompts, lecture misconceptions, no-clue / no-joke / no-repeat rules |
| 6. Validation and difficulty | **Partly** — measured-difficulty relabel (Balanced), self-containment check; independent cross-model answer check not done |
| 7. Teaching score | **Rebuilt** (rubric + verified evidence + confidence); **not yet validated** against faculty ratings |
| 8. Teacher UI | **Done** for panel, score modal, 0–30, shortfall banner; not yet clicked through end-to-end with a login |
| 9. Tests and evaluation | `test_lecture_model.js` added; real-lecture count matrix below; human review not started |

## Stage 3–8 summary

**Shared lecture model** (`server/engine/intelligence/lectureModel.js`)
- Built once in `/analyze-depth`, cached by content hash and version, reused by the panel, capacity, teaching score and generation (`lectureModelId` on `/generate`). Generation no longer re-extracts the lecture.
- Reads the whole input in parallel windows. Model order: Gemini 3.5-flash → 3.6-flash → 3.5-flash-lite → 3.1-flash-lite → Groq. A 429 waits for the retry delay; a 503 skips that model for a minute. A window that still fails is reported to the teacher (`incomplete`) and not cached.
- Blocks: Whisper segments grouped into ~60 s blocks with their real times; slides keep slide numbers; terminal sessions split per command; code split per construct.
- Every unit and teaching observation must quote its blocks; unverified items are dropped. A coverage pass re-reads substantive blocks no unit cites. One consolidation call merges duplicate teaching points (explained, then demonstrated) and variant topic names.
- Segments use real Whisper times. Material never spoken appears as slide-only sections; units are tagged SPOKEN / MATERIAL / BOTH; slide/speech contradictions are listed.
- Capacity = distinct question angles per unit, with rules: trace/output/debug only for code or commands, calculation only with formulas, a merely mentioned point gives one Easy, recall is never Hard.
- Allocation: Balanced follows capacity per difficulty (no fixed thirds); topics weighted half by capacity and half by teaching time; never above a topic's capacity; no two questions on the same teaching point while others remain. Shortfalls say why, e.g. "This input supports 2 distinct hard questions; 5 were requested."
- Teaching score: six rubric dimensions (clarity, explaining why, examples, flow, accuracy, depth for the lecture's aim). Each is rated 1–4 only with cited, verified evidence; overall = mean of judged dimensions × 25, shown only when at least 4 are judged; confidence from dimensions, evidence and length. No score for code/terminal-only input or under 300 words. The keyword score and the UI fallback of 80 are gone from the teacher page.

**Generation and validation**
- Planner `_planFromLectureModel` keeps each target's angle, difficulty and lecture misconceptions (no re-tiering).
- Batch prompt: question type per angle; no giveaway clues; no repeated facts; no arguable or joke distractors.
- Balanced mode: an otherwise valid question that measures as a different tier is relabelled to its measured difficulty instead of discarded.
- New check `STEM_NOT_SELF_CONTAINED` ("as in the example", "in the given HTML" with nothing given) → repair.
- Evidence packaging skips redundant keyword heuristics when a lecture-model plan exists (saved ~8 s of blocking CPU on a 200k-character PDF).

**Balanced difficulty drift (fixed 2026-11-12)**: a 15-question Balanced quiz on the 2 h OS lecture (planned 4 Easy / 8 Medium / 3 Hard) came out 9 / 5 / 1. Causes and fixes:
- Rejected Medium/Hard slots were refilled with the next reserve in list order (all the Easy angles first). Now `takeLectureModelReserve` refills each slot with a reserve of the same planned tier, from a different teaching point where possible, keeping its own angle (all three promotion sites in `pipelineOrchestrator.js`).
- The deterministic Hard rule accepted only DIAGNOSE, so real multi-step traces/calculations were rejected. Now `isGenuineMultiStepHard` (agent3Evaluator) also accepts TRACE/COMPARE/APPLY for multi-step angles when the stem contains concrete data, vectors, code or several conditions; the critic's Hard definition says the same.
- Relabelling capped at ~10% of the quiz.
- Result after fixes: 5 / 8 / 2 delivered (15/15), 0 flagged by the independent check. Cost: 328 s, because rejected Hard candidates are retried one by one under free-tier rate limits.

**Completion round (2026-11-12)**
- Speed: candidates of a batch are evaluated in parallel (OS 15 Balanced: 328 s → 189 s); `denseEmbeddingBridge` no longer spawns a blocking Python process per text pair (opt-in `DENSE_EMBEDDINGS_PYTHON=true`); evidence packaging 12.6 s → 1.2 s; upload metadata runs keyword heuristics on a 20k sample only.
- Hard: per-angle "Hard recipe" (≥2 dependent steps on data in the stem); batches with Hard targets use the Gemini chain; a Hard slot gets 3 attempts, then is filled at Medium (never straight to Easy); notice states planned vs passed per difficulty.
- Stage 8: teacher can untick topics (capacity updates live, plan excludes them); when a request exceeds capacity she chooses "generate N" or "fill with other difficulties" (no longer always FILL_WITH_MEDIUM); review page shows "Why this question" (lecture time/slide, topic, question type, planned vs measured difficulty, why each distractor is wrong).
- Independent check also flags near-duplicate questions and stems that reveal the answer, and works the problem before answering.
- 6.4 "Distractor Discrepancy Index" renamed "Predicted distractor plausibility (pre-test, model-estimated; not a psychometric index)"; 7.1 TC-score text removed from pipeline views.
- 9.4 Quiz analytics returns `itemAnalysis` (p, D upper/lower 27%, distractor efficiency, non-functioning distractors) from real responses, shown on QuizAnalytics with a sample-size reliability note.
- Topic-only input: the system writes reference notes on the topic (labelled general knowledge) and uses the normal lecture-model path; no teaching score.
- Code/terminal inputs: finer code blocks, lab-quiz style extraction guidance, expansion pass when the map is too coarse; generator never shows the output it asks to predict.
- Overview text limit for very long documents raised from 120k to 300k characters.

**Input-type results (real files from `final_tests/`, `audio_test/`)**

| Input | Request | Delivered | Time (analysis / generation) |
|---|---|---|---|
| Git lecture, 13 min audio | 1 / 5 / 15 Balanced | 1 / 5 / 15 | 24 s / 4–70 s |
| OS lecture 2 h 12 min + 47k notes PDF | 10 / 15 / 20 / 30 Balanced | 10 / 15 / 20 / 30 | 40–90 s / 84–222 s |
| DOM programming PDF (200k chars) | 10 Medium | 10 | 111 s / 178 s |
| PowerPoint (DE-31.pptx) | 10 Balanced | 10 | 33 s / 130 s |
| Word doc (Docker) | 8 Medium | 8 (fill chosen) | 18 s / 79 s |
| Java lecture audio, 17 min | 10 Balanced | 10 | 19 s / 107 s |
| Pasted Java program (28 lines) | 5 Balanced | 4 | 15 s / 30 s |
| Pasted SQL (13 lines) | 5 Balanced | 3 | 14 s / 62 s |
| Pasted Linux terminal session | 5 Balanced | 5 | 14 s / 65 s |
| Topic only ("Deadlocks in Operating Systems") | 5 Medium | 5 | 35 s / 49 s |
| Photo of board/notes (JPEG, OCR) | — | text extracted in 4 s | — |
| 24 MB handwritten scanned PDF | — | **OCR did not finish in 10 min** | — |

**Known limits**: free-tier Gemini/Groq quotas dominate latency and often force the lightest model; Hard questions still pass less often than planned; the independent check on the lightest model can miss a wrong key; large scanned PDFs are too slow to OCR; the teaching score is not yet validated against faculty ratings.

**UI**: `LectureUnderstandingPanel.jsx` (overview, timeline, topics with share/depth/source, capacity); rewritten `TeachingScoreModal.jsx` (dimensions, quoted timestamped evidence, specific suggestions, confidence, caveat); audio+slides now sends the slide text for cross-referencing; slider 0–30 (0 = analysis only); results banner shows the real shortfall reason and per-topic allocation.

**Bug fixed**: `analyzeDepth` threw `validCap is not defined` for every academic input on the handoff/claude branches.

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
