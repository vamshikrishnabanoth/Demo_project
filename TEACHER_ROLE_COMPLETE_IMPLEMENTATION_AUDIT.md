# Teacher Role — Complete Implementation Audit, Gap Analysis & Remediation Plan

**Audit date:** 2026-11-11
**Audit type:** Read-only. No source code, prompts, schemas, APIs or UI were changed.
**Branches audited:** all 13 remote branches. Detailed audit target: `handoff/complete-implementation-nov-2026` @ `06b7409` (latest work, 14 commits ahead of `main` @ `df5625d`). `main` was used as a comparison baseline.
**Method:** full read of the MCQ pipeline path (route → controller → orchestrator → agents → validators → UI), execution of the repository's own tests, and deterministic probes that run the **real** orchestrator / scoring code with only the LLM calls stubbed. No LLM API keys exist in the audit sandbox, so no new live generations were run; real-world behaviour is taken from the team's own saved real-lecture runs in `evaluation_dataset/benchmark_results/` (handoff branch).

> All file references below are to the handoff branch unless stated otherwise. Line numbers are approximate anchors.

---

## 0. Executive summary

**How ready is the MCQ pipeline? About 30–35% of the way to the acceptance standard in this prompt** (judgement explained in Section G). There is a large amount of real engineering: multi-window lecture extraction, a planner/generator/evaluator pipeline, fail-closed evaluation, provenance tracing, and many validators. But the five pillars are not yet delivered, and the newest branch cannot currently deliver a quiz at all.

The five findings that matter most:

1. **The handoff branch cannot deliver any quiz (verified).** Commit `06b7409` reassigns two `const` variables at the end of every successful run (`pipelineOrchestrator.js:1458/1973`, `:1646/1981`). A run where all 5 questions were generated and passed ends as `FAILED — "Assignment to constant variable."` and is reported to the teacher as `MATERIAL_EXHAUSTED`.
2. **Count satisfaction regressed and is reported dishonestly (verified).** The same commit lowered the attempt ceiling from 60 to 12 (`:33-38`). With perfect generation and ample targets, requests for 20 or 30 cap at 15; the shortfall is labelled `MATERIAL_EXHAUSTED` with the notice "withheld to ensure strict factual grounding". `main` delivers 30/30 under the identical stubbed probe.
3. **Real-lecture fulfilment is ~30%.** Across the team's 28 saved academic runs (Nov 9–10): 73 of 245 requested questions were delivered, 5/28 runs were fully satisfied, every Hard request delivered 0, runs took up to ~18 minutes, and the staging canary used ~40k tokens per delivered question.
4. **The teaching score is not a measurement of teaching (verified).** There are three unconnected scorers. The one shown before generation is `40 + points for words like "because / then / first / step"`. Adding only those words to a real segment raised it **70 → 100**. The one shown after generation (`_computeTCScore`) ignores the lecture text entirely: it returned **81** for a real lecture, empty text and "lorem ipsum". The UI shows **80** when no score exists.
5. **Pasted code / terminal output / notes are not treated as teaching material.** The main teacher page sends every text-only input as `TOPIC_SYNTHESIS`. That skips lecture extraction, fabricates capacity (25, with 4 Hard, for a 570-character terminal session), hardcodes depth score 90, and plans "curriculum" questions about the topic instead of the pasted material.

---

## Section A — Existing implementation

### A.1 Branch landscape

| Branch | Status vs `main` | Relevance |
|---|---|---|
| `handoff/complete-implementation-nov-2026` | +14 commits (Nov 9–11) | **Latest work.** Capacity reconciliation, disfluency sanitizer, learning-objective dedup, batch generation, payload integrity, provider failover. Contains the two fatal regressions above. |
| `main` = `release/v1.0.0-rc1` = `claude/nifty-hopper-we9e1s` | — | Current baseline (`df5625d`). Plumbing works; real-run quality as above. |
| `fix/core-quality-remediation` | ancestor of `main` (0 ahead) | Fully merged. |
| `feature/code-sql-text-input`, `feature/code-sql-text-generation`, `hotfix/assignment-routes`, `feature/decoupled-pedagogical-scoring`, `milestone-v3.6-phase8`, `feature/notebooklm-kahoot-hybrid`, `feature/postgres-migration`, `vercel/...` | ~450–1,100 commits "ahead" but 56 behind; history was rewritten on `main` | Superseded. Files they have that `main` lacks are the old Mongo models and the old `CreateQuizPDF/Voice` pages, which `main` deliberately consolidated into `CreateQuizTopic`. Nothing teacher-pipeline-critical is stranded there. |

### A.2 Architecture (as implemented)

```
Client  CreateQuizTopic.jsx (main teacher page; /create-quiz/pdf and /voice redirect here)
   │  /api/quiz/transcribe ─► Groq Whisper (+chunking)            → transcript + segments
   │  /api/quiz/analyze-depth ─► depthAnalyzer + lectureIntelligence.analyze  → "teaching score", overview, capacity preview
   │  /api/quiz/generate (multipart) ─► async task (taskManager), poll /generate/status
   ▼
quizController.generateQuizQuestions → generateQuestions()
   input normalisation, code-regex routing, topic-mode decision
   ▼
pipelineOrchestrator.runPipeline
   01 Ingestion
   02 evidencePackager (alignment, hierarchical store, topic-mode shortcut)
      + lectureIntelligence.buildPartialFallback (deterministic capacity)
      + lectureIntelligence.extractTeachingUnits (LLM, windowed, verbatim-quote verified)
   03 agent1Planner.planAssessment → _planFromTeachingUnits → LCACM difficulty blueprint → _computeTCScore
   04 agent2Generator.generateQuestionBatch (batches of 5)  → agent3Evaluator.evaluateAndRepairQuestion
      (independentAnswerVerifier + deterministic audit + LLM option audit, 1 bounded repair)
      reserve promotion / replenishment
   04b dedup   05 quiz-level eval   06 key integrity   07 groundingGate (lexical overlap)   07b replenishment
   ▼
task result → PipelineOutput.jsx (questions, notices, tcScore, teacherAnalysis)
```

Providers: Groq (default `qwen/qwen3.8-27b` for generation and evaluation, `openai/gpt-oss-120b` for planning/extraction), Gemini fallback, optional Ollama. Whisper on Groq for STT.

### A.3 Teacher workflow (actual)

1. Add inputs on `CreateQuizTopic`: audio (transcribed immediately via `/transcribe`), documents, or text boxes.
2. `/analyze-depth` returns overview, key topics, chapter list (audio only), capacity per difficulty and a "Teaching Score".
3. Teacher chooses difficulty (Balanced/Easy/Medium/Hard) and count (slider 1–30; the backend accepts 1–50; 0 is not supported).
4. `/generate` always sends `deficitPolicy=FILL_WITH_MEDIUM` (`CreateQuizTopic.jsx:1388`).
5. `PipelineOutput` shows questions, notice text and the post-generation `tcScore`.

### A.4 Input handling (summary; details in Section C)

`quizController.js:3130-3470` normalises uploads. Audio → Whisper. `.txt` → treated as **voice** (`:3375-3384`). PDF/DOCX → `DocumentRouter`, falling back to `pdf-parse`/`mammoth`. PPTX → `officeParser` text only, with slide ranges approximated as 15 lines per slide (`:722-734`). Legacy `.ppt` → raw byte-string scrape (`:636-658`). Images and low-text PDFs → a `"base64:…"` string that is passed downstream **as lecture text** (`:3387-3403`); nothing in the 3-agent path decodes it. YouTube → transcript/metadata, then an LLM is asked to *invent* "likely" content from the URL when no transcript exists (`:3692-3762`).

### A.5 Lecture understanding

* **Generation path (good foundation):** `lectureIntelligence.extractTeachingUnits` (`:1484-2060`) windows the *whole* transcript (7.5 KB windows, overlap, coverage assertion) and quarantines units whose quotes are not found verbatim. This is the strongest component in the system.
* **Preview path (what the teacher verifies):** `lectureIntelligence.analyze` sends only **three 2,500-character samples** for inputs over 9,000 characters (`:1323-1330`), i.e. about 15% of a one-hour lecture. Chapter timestamps are then **evenly re-spaced** across the duration (`:1392-1410`), not derived from content.
* **Audio + material:** extraction keeps only transcript chunks (`:1520-1525`) and gives each document its **first 500 characters** per window (`:1587-1590`). Slide-to-speech alignment is lexical (`crossMaterialAligner.js`); "dense embeddings" spawn a synchronous Python process per pair and fall back to bag-of-words cosine (`denseEmbeddingBridge.js`). There is contradiction detection for numeric/negation conflicts, and whole documents judged "unaligned" are dropped.
* Preview and generation therefore use **different representations** of the same lecture.

### A.6 Generation pipeline

* **Planner:** for lecture inputs, `_planFromTeachingUnits` (`agent1Planner.js:5639-5910`) maps **one teaching unit to one target**, allocates per topic with Hamilton/Hare proportional to *unit counts* (not time or depth), and sets every target to Medium for Balanced before the blueprint. Misconceptions for distractors come from `_deriveTeachingUnitMisconceptions` (`:5500-5637`), which is hardcoded for three benchmark lectures (stock trading, minimum-product subset, Prim's MST); every other lecture gets three generic templates.
* **Topic mode:** LLM plan from the topic string, padded with templated "engineering facets" when short (`:1132-1173`).
* **Generator:** batch path (`agent2Generator.js:1649-1882`), now the default, uses a short generic prompt that **omits** the planner's misconceptions, archetype scaffolding and the KMIT style contract. These exist only on the single-target path (`:1385-1645`). Canned question banks (paging, Git, pipelining, trees, DP…) are disabled for lecture inputs in production but **still served in topic mode** on LLM failure (`:478-497`). A Banker's-algorithm special case exists (`:1895`).
* **Evaluator:** `agent3Evaluator.evaluateQuestion` (`:84-486`) runs a deterministic audit, an "independent answer verifier" (whose blind LLM solver is skipped for all non-math/non-algorithm questions, `:177-184`), and then an LLM option-by-option audit with the **same model family** as the generator. If the provider fails it **fails closed** for Medium/Hard and unverified Easy questions (good).
* **Orchestrator:** see the defects in Section D (attempt ceiling, `const` crash, reserve tier bug, fabricated 0.95 grounding score defaults, misleading shortfall categories).

### A.7 Validation pipeline

* Structural: 4 options, a key present in the options, key-slot repair (`pipelineOrchestrator.js:1406-1420`; a violation **throws and fails the whole quiz** rather than dropping one item).
* Duplicates: token similarity ≥ 0.70, or ≥ 0.45 for comparative frames (`deterministicValidator.js:770-830`), plus learning-objective dedup.
* Grounding gate: lexical token overlap ≥ 15–25% (`groundingGate.js:622-830`).
* Distractor checks: lexical synonymy, absolute words, length giveaway, and a "Pre-Test Distractor Discrepancy Index" = 0.7 × heuristic quality + 0.3 × lexical diversity (`difficultyAwareDistractorValidator.js:797-903`). That index is an in-house construct, not an established psychometric measure.
* Post-test psychometrics: `distractorDiscriminationAnalyzer.js` correctly implements p-value, upper/lower-27% D, distractor selection frequency and efficiency, but **nothing calls it**. Teacher analytics show only % correct and option counts.

### A.8 Teaching score implementation

Three independent scorers, none validated:

| Where shown | Code | What it actually computes |
|---|---|---|
| Before generation (`CreateQuizTopic`, `TeachingScoreModal`) | `depthAnalyzer.js:1616-1683` | 40 baseline + 0/8/15 for each of concept, reasoning, examples and procedure. Each is set by marker-word counts ("because", "therefore", "first", "then", "step", "push", "swap"…) and regexes. |
| After generation (`PipelineOutput`, `teacherAnalysis`) | `agent1Planner._computeTCScore` `:1788-1954` | A function of the **number of targets and subtopics only**; `rawContent` is unused. Bounded 76–94. Strengths and suggestions are templates; "High Instructional Coherence (94%)" is a hardcoded string. |
| Overview feedback | `lectureIntelligence._deriveWhatWentWell/_deriveGrowthOpportunities` | Derived from the same keyword-based depth analysis. |
| UI fallback | `CreateQuizTopic.jsx:209-222` | Returns **80** when no score exists, or 88/76/64/82 from the rating label. |

A separate, rigorous research track (`experiments/experiment_5_teaching_adequacy`, with gold annotations, pre-declared gates and a sealed challenge set) **failed its release gate on 2026-10-03** and is not wired into production.

### A.9 Capacity and difficulty

* Capacity: `lectureIntelligence.deriveSemanticCapacity` (`:160-579`) allows at most 1 Easy and 1 Medium per concept. Hard comes from regex keyword lists, some benchmark-specific ("adversarial|generator|discriminator|attention mechanism", "staging|commit|detached"). **Recommended count is chosen by duration brackets** (`:463-480`), the approach this brief rules out. Preview (`analyzeDepth`) adds further multipliers (`quizController.js:5448-5492`). Topic inputs get hardcoded capacity 30 and depth score 100 (`:5254-5285`).
* Difficulty: three selectable blueprint engines (`v1_bloom_quota`, `v2_intent_relative`, default LCACM). `providerConfig` declares `v2_intent_relative` as the default, but `_applyDifficultyBlueprint` reads only the environment variable, so LCACM actually runs (`agent1Planner.js:3117-3136`). Balanced is capacity-aware when Hard capacity is known, otherwise floor(N/3). The **delivered difficulty label is the planned label** (`metadata.targetDifficulty`), not a measured property; the only per-item check is the same LLM evaluator's `TIER_COGNITIVE_MISMATCH` verdict.

### A.10 Frontend

`CreateQuizTopic.jsx` (2,568 lines) shows the overview, key topics, chapters (audio only), recommended counts per difficulty, the teaching score modal, difficulty buttons and a 1–30 slider. It does **not** render the backend's capacity-action options (`ACCEPT_FEASIBLE_COUNT`, `ADD_MATERIALS`, …), always forces `FILL_WITH_MEDIUM`, and states "Questions will be grounded in both" for audio+docs regardless of the alignment result. `PipelineOutput.jsx` shows requested vs delivered and the notice.

### A.11 Test coverage

* 119 `server/test/test_*.js` files plus ~60 root-level `server/test_*.js` scripts. They are mostly unit/contract tests with mocked LLMs and hand-built fixtures.
* Results on the handoff branch: see Section A.12 (57 pass, ~19 deterministic assertion failures, the rest environment/fixture related).
* Tests check shape and contract, not educational quality. For example, the teaching-score test passes because the label and field names are right, while the score itself is input-independent. One test prints "5 / 6 TESTS PASSED CLEANLY (100%)".
* No test exercises the end-to-end path with a real lecture plus a real LLM in CI.

### A.12 Test execution on handoff branch

All 97 `server/test/test_*.js` files were run with a 60 s timeout each, without a database or LLM keys:

| Result | Count | Notes |
|---|---|---|
| Exit 0 | 57 | Includes suites that print a failure but still exit 0 (e.g. capacity suite printing "5 / 6 … (100%)") |
| Failed — environment | ~17 | No Postgres (`ECONNREFUSED 5432`, Prisma datasource undefined) or no LLM provider (`NO_LLM_PROVIDER_AVAILABLE`) |
| Failed — fixture files not in git | 3 | `ENOENT` on dataset files (`objective3_*`, `objective4_*`) |
| **Failed — deterministic assertions** | **~19** | Mostly capacity/difficulty heuristics whose earlier-phase expectations now contradict later tuning, e.g. intro capacity expected 12 → got 16; "repetitive long lecture" recommendation expected ≤ 10 → got 18; causal-chain Hard capacity expected 1 → got 0; descriptive lecture expected 0 Hard; stem-alignment and answer-normalisation cases; batch generation returns ≠ 4 options offline (`test_teacher_role_comprehensive` 5.1) |
| Timeout | 1 | `test_runner_safeguards_mocked.js` |

Interpretation: the heuristics have been tuned back and forth against individual fixtures, and the suite no longer encodes one consistent specification. No test runs `runPipeline` end-to-end with a successful outcome, which is why D1 (the `const` crash) shipped.

---

## Section B — Five-pillar gap analysis

| Pillar | Expected behaviour | Existing implementation | Actual verified result | Gap | Priority |
|---|---|---|---|---|---|
| **1. Question quality** | Correct, unambiguous, concise, varied, grounded in the actual input | Teaching-unit plan → batch generation → deterministic + LLM option audit → lexical grounding gate → dedup | Saved real runs: Easy questions are generally correct and clear (e.g. binary-tree definitions). Near-duplicates delivered (two "complete binary tree" definition questions in R1). Staging canary delivered a question **with no stem**. Variety is recall-heavy. Batch prompt drops misconception and archetype guidance. Pasted code/terminal output is ignored in favour of topic synthesis. Evaluator is same-model self-review; no human-rated quality data. | No measured correctness rate; variety not driven by content type; code/CLI inputs not used; judge not independent | P1 (P0 for the topic-mode routing) |
| **2. Count satisfaction** | Defensible capacity per topic; satisfy requests when capacity exists; honest, specific shortfall | Duration-bracket recommendation + 1-unit-1-target planning + reserves + replenishment; shortfall notice | **Handoff: 0 delivered on any successful run (crash).** Ceiling caps 20/30 → 15 even when capacity exists, mislabelled `MATERIAL_EXHAUSTED`. Real runs: 73/245 (30%); 5/28 fully satisfied; capacity for the same lecture reported as 21 and then 8. Controller notice hardcodes "One additional question could not be validated" for any shortfall size. | Capacity is not a defensible estimate; ceiling; misleading attribution; no multi-angle expansion of rich units | **P0** |
| **3. Difficulty calibration** | Lecture-relative Easy/Medium/Hard by real cognitive demand | Keyword-based Hard capacity; LCACM blueprint; LLM `TIER_COGNITIVE_MISMATCH` check; labels taken from plan | Real runs: **every Hard request delivered 0** (3/3). Balanced canary distribution reported "Unknown". Reserve promotion builds instructions for the wrong tier (`:878`). Delivered label = planned label. Three blueprint engines with config/env mismatch. | No measured difficulty; Hard feasibility decided by regexes; no lecture-relative scale | P1 |
| **4. Teaching score** | Evidence-based, dimensioned, fair, consistent, with confidence | Three heuristic scorers; templated feedback | Discourse words alone: **70 → 100**. `_computeTCScore` = 81 for real / empty / lorem text. Spearman 0.59 vs team's own gold depth (n=16) with inversions. Same lecture scored 87 and 94 across runs. Research evaluator failed its gate and is unintegrated. | Needs to be rebuilt on the teaching-unit representation, with evidence citations and validation against human raters | P3 (but **P0 to stop displaying the current number as a teaching score**) |
| **5. Distractor quality** | Three plausible, misconception-based, lecture-grounded distractors scaled by difficulty; empirical discrimination later | Prompt guidance; hardcoded misconception catalogue (3 lectures) + generic templates; lexical checks; in-house DDI; CTT analyzer exists but unwired | Saved samples show mostly plausible distractors for definition items. Misconception grounding is generic for any non-benchmark lecture. Batch path never sees the misconceptions. No post-test discrimination available to teachers. | Misconceptions must come from the lecture (and later from student data); wire CTT; replace "DDI" with standard terms | P2 |

---

## Section C — Input coverage

| Input type | Supported currently? | Actual processing flow | Verified limitations | Required work |
|---|---|---|---|---|
| Audio-only (upload / recorded) | Yes | `/transcribe` → Groq Whisper (chunked) → transcript + segments → teaching-unit extraction | Not re-verified (no audio in repo; no keys). Overview uses ~15% sample on long lectures; chapter times are evenly spaced. `.txt` uploads are also treated as voice. | Build overview and chapters from the full extraction with real segment times |
| Live recording | Yes (`LiveRecordPanel` → `/generate-voice`) | Separate legacy path `generateQuizFromVoice` | Different code path from `/generate` | Converge onto one path |
| PDF-only | Yes | `DocumentRouter`/`pdfMultimodalExtractor` (+vision via Groq `llama-3.2-11b-vision-preview`, OCR fallback) | Low-text PDFs (<100 chars, or filename contains "scan") are replaced with **base64 text** fed to the LLM as lecture content. Vision model name should be verified as still served. | Route scans through OCR/vision; never pass base64 as text |
| PPT/PPTX-only | Partial | `officeParser` flat text; slide range ≈ 15 lines/slide | No slide boundaries, images, diagrams or speaker notes; `.ppt` is a byte scrape | Slide-aware PPTX parser (per-slide text, notes, images) |
| Docs with images/tables/code/diagrams | Partial | PDF: vision for images when available; DOCX: `docxMultimodalExtractor` | Not verified with live vision; PPTX images dropped | Verify on dataset docs |
| Audio + PDF/PPT | Partial | Lexical alignment → whole-document keep/drop → extraction with transcript chunks + **first 500 chars per document** | Slide content mostly invisible to planning; no slide↔timestamp mapping | Slide-level alignment; give aligned slide text to extraction windows |
| Topic-only | Yes | `TOPIC_SYNTHESIS` → curriculum plan from model knowledge | Capacity hardcoded (30 in preview, ≥25 in generation), depth 90/100, canned fallback bank allowed on LLM failure | Clearly label as "not from your lecture"; no teaching score; no fabricated capacity |
| Topic + subtopic | Yes (same path) | Planner decomposes comma/"and"-separated subtopics | Same as above | Same |
| Descriptive text (notes pasted) | **Misrouted** | Client sends `TOPIC_SYNTHESIS` for any text-only input | Full notes treated as a "topic"; no teaching-unit extraction | Route pasted material as a document |
| Source code (Java, C, Python) | **Misrouted from UI** | Server regex can route to `codeSnippets`, but the client's `TOPIC_SYNTHESIS` flag overrides | Questions are planned from the topic, not the code | Code-aware path (trace, output prediction, bug-finding) grounded in the pasted code |
| SQL / Mongo queries | Same as code | Regex detection | Same | Same |
| Terminal / command-line output | **Not supported** | No shell-output detection in the controller; treated as topic | Probe: 570-char `ps/kill/nice/jobs` session → `TOPIC_SYNTHESIS`, capacity 25, depth 90 | Terminal-session parser (commands, flags, outputs, state changes) |
| Mixed code + text + explanation | Partial | All-or-nothing regex: one `class X` or `import y` sends the **whole** text to code | Prose explanations lost or mis-typed | Segment mixed inputs into blocks |
| Images / photos of board | Weak | Base64 string as text in `/generate` | See PDF row | OCR/vision ingestion |
| YouTube | Yes | Transcript → metadata → **LLM invents content from URL** | Ungrounded questions possible | Remove invention fallback; fail honestly |

---

## Section D — Critical defects (ranked by impact on the teacher role)

| # | Defect | Evidence | Impact |
|---|---|---|---|
| D1 | `const` reassignment crashes every successful run | `pipelineOrchestrator.js:1458→1973`, `:1646→1981`; probe: 5/5 passed → `FAILED`, `MATERIAL_EXHAUSTED` | Handoff branch delivers nothing. Undetected by tests because unit tests stub around `runPipeline`. |
| D2 | Attempt ceiling hard-capped at 12 (was 60) | `:33-38`, introduced in `06b7409`; probe: 20→15, 30→15 under perfect generation | Requests above ~12–15 cannot be met. With any rejection, effective capacity is lower. |
| D3 | Shortfall attribution is misleading | `:1759-1769` defaults to `MATERIAL_EXHAUSTED`; notice "withheld to ensure strict factual grounding"; controller `:3983` hardcodes "One additional question…" | Teacher is told the lecture was insufficient when the system capped itself or crashed. Contradicts the honesty requirement. |
| D4 | Text-only inputs (code, terminal, notes) forced into topic synthesis | `CreateQuizTopic.jsx:1381-1383`; `quizController.js:3870-3872`; `evidencePackager.js:219-266`; probe | Core requirement (paste terminal output / code) not met. Fabricated capacity and depth. |
| D5 | Teaching score is keyword/count based and partly input-independent | `depthAnalyzer.js:1616-1683`; `_computeTCScore`; UI fallback 80; probes (70→100; 81 for empty text) | Displayed number is not defensible; risk to teacher trust and to research claims. |
| D6 | Real-lecture fulfilment ~30%, Hard = 0, latency to ~18 min, ~40k tokens/question | `benchmark_results/eval_cohort_*`, `master_product_evaluation_final_summary.json`, `staging_canary_result.json` | Not usable for daily classroom quizzes yet. |
| D7 | Benchmark-specific logic in production | `pipelineOrchestrator.js:225-232` loads `MULTI_005` gold reconstruction when the session ID matches; `_deriveTeachingUnitMisconceptions` hardcodes 3 lectures; keyword lists include benchmark terms; Banker's special case | Evaluation leakage. Benchmark results over-estimate real performance. |
| D8 | Preview and generation use different lecture representations | `analyzeDepth` (sampled text, its own capacity) vs orchestrator (full extraction, its own capacity) | Teacher verifies an overview that the generator does not use. Recommended counts disagree with what generation can do (same lecture: 21 vs 8). |
| D9 | Audio+slides: documents contribute 500 chars per window | `lectureIntelligence.js:1520-1525`, `:1587-1590` | Slides largely ignored in combined mode. |
| D10 | Long-lecture overview sees ~15% of text; chapter times evenly spaced | `lectureIntelligence.js:1323-1330`, `:1392-1410` | Timestamped segments are not real. |
| D11 | Images/scans passed as base64 "text" | `quizController.js:3387-3403`, `:4757-4770` | Garbage-in for handwritten notes and board photos. |
| D12 | Batch generator ignores planner misconceptions, archetypes and style contract | `agent2Generator.js:1724-1753` vs `:1533-1543` | Distractor and variety design is lost on the default path. |
| D13 | Reserve promotion uses the wrong tier's cognitive blueprint | `pipelineOrchestrator.js:876-882` (`tier` instead of `allocatedTier`) | Difficulty drift on substitutes. |
| D14 | Fabricated default scores | grounding score defaults to `0.95` (`:933`, `:964`, `:1004`); `0.85` in evaluator fallback | Provenance metadata overstates verification. |
| D15 | Single integrity violation fails the whole quiz | `:1406-1412` throws | One bad item discards all good items. |
| D16 | Legacy fallback code after the 3-agent path | `quizController.js:1180-1251` (AI service / Groq fallback, reachable only when `runPipeline` returns null) | Dead or ambiguous paths; maintenance risk. |
| D17 | YouTube LLM content invention | `quizController.js:3692-3762` | Ungrounded questions presented as from the video. |
| D18 | Topic-mode canned question bank still served in production | `agent2Generator.js:478-497` | Hardcoded questions can appear for topic inputs. |
| D19 | Synchronous Python spawn per text pair | `denseEmbeddingBridge.js` | Blocks the Node event loop for all users when Python is present; silently lexical otherwise. |
| D20 | Operational/privacy | Full `req.body` (whole transcripts) logged per request (`quizController.js:3245-3248`); `/analyze-depth`, `/analyze-sources`, `/transcribe` lack the teacher role guard (`routes/quiz.js:283-295`); content moderation skipped on the main multi-input path (`:3809`); `analyzeDepth` disk cache never expires across code versions | Cost exposure, PII in logs, stale previews |
| D21 | Count 0 unsupported | slider min 1; `parseInt(...) || 5` turns 0 into 5; server `min:1` | Spec asks 0–30 |
| D22 | Config inconsistency | difficulty mode default in `providerConfig` not used | Silent behaviour differences between environments |

---

## Section E — Prioritised remediation plan

Ordering follows dependencies: nothing downstream can be evaluated until the pipeline delivers, and the pillars all depend on one lecture representation.

### P0 — Critical foundational defects

| Task | Files / functions | Existing → Problem | Proposed correction | Why necessary | Deps | Risks | Verification (real inputs) | Acceptance |
|---|---|---|---|---|---|---|---|---|
| P0.1 Fix `const` crash | `pipelineOrchestrator.js` (`validatedQuestions`, `deliveredCount`) | Reassigning `const` → every run FAILS | Declare with `let`, or compute the pruned list into a new variable | Nothing works on handoff | — | None | Orchestrator probe with stubbed LLM (5/10/15/20/30); 1 real lecture at N=5 | Successful runs return COMPLETED with all passing items |
| P0.2 Restore attempt budget | `calculateAttemptCeiling`, `MAX_DYNAMIC_RESERVES` | Ceiling 12; 1 dynamic reserve | Budget derived from requested count and available targets (e.g. ≥ 2× requested, hard cap ~60, as on `main`), plus a separate token/time budget | Count pillar impossible above ~12–15 | P0.1 | Higher cost per request | Probe 20/30 → full delivery under perfect stubs; real run at 15 and 20 | No self-imposed cap below capacity |
| P0.3 Honest shortfall attribution | orchestrator `shortfallCategory`/notice; controller `:3983` | Defaults to `MATERIAL_EXHAUSTED`; hardcoded text | Record the actual stop reason per slot (budget, provider, rejected-by-gate X, capacity) and render it verbatim | Honesty requirement | P0.1 | — | Inject each failure type in probe | Every shortfall reason matches its cause |
| P0.4 Stop presenting heuristic scores as teaching quality | `CreateQuizTopic.jsx` (fallback 80), `TeachingScoreModal`, `PipelineOutput`, `_computeTCScore` | Keyword/count scores shown as "Teaching Score" | Hide the number or relabel it "material depth indicator (experimental)" until P3; remove the 80 fallback | Prevents misleading teachers and research claims | — | Teachers lose a feature temporarily | UI review | No unvalidated teaching score displayed |
| P0.5 Route pasted text/code/terminal as material | `CreateQuizTopic.jsx:1381`; controller `isTopicModeRequest`; `evidencePackager` topic shortcut | Text-only → `TOPIC_SYNTHESIS` | Topic mode only for short topic strings (explicit "Topic" input type). Pasted content → document path → teaching-unit extraction | Core requirement | — | Short inputs may yield fewer questions (honest) | Real pasted Java program, SQL, `git`/Linux terminal session from dataset | Questions reference the pasted code/output |
| P0.6 Remove benchmark leakage | `pipelineOrchestrator.js:225-232`; `_deriveTeachingUnitMisconceptions`; benchmark keyword lists; Banker's special case | Gold data and hardcoded topics in production | Delete or move behind a test-only flag | Valid evaluation | — | Benchmark scores will drop (that is the point) | Re-run the benchmark cohorts | No dataset paths or topic-specific branches in `server/engine` |
| P0.7 Add a real end-to-end regression test | new test using a stubbed LLM through `runPipeline` | Unit tests miss integration crashes | Pipeline smoke test in `npm test` | Would have caught D1/D2 | P0.1–0.2 | — | CI | Test fails on D1/D2 regressions |

### P1 — Core intelligence: one lecture representation

| Task | Files | Problem | Correction | Verification | Acceptance |
|---|---|---|---|---|---|
| P1.1 Single Lecture Model | `lectureIntelligence`, `analyzeDepth`, orchestrator Stage 02 | Preview and generation diverge | Run teaching-unit extraction **once** at analysis time; persist it (keyed by content hash and code version); generation reuses it; overview, chapters, capacity and teaching evidence all derive from it | Same lecture → identical capacity in preview and generation | Preview counts = generation plan inputs |
| P1.2 Real timestamped segments | `extractTeachingUnits` (units already carry chunk IDs) + Whisper segments | Chapters evenly spaced | Map units → child chunks → segment times; group into segments with 1-line descriptions | Spot-check 3 real lectures against audio | Every segment time traceable to Whisper segments |
| P1.3 Audio+slides cross-reference | `crossMaterialAligner`, extraction windows | 500 chars per doc; whole-doc drop | Per-slide blocks; align slides to transcript windows; include aligned slide text in that window; mark "slide-only" and "spoken-only" units; surface conflicts | Dataset MULTI_001–005 | Units cite both slide and speech where applicable |
| P1.4 Input parsers | PPTX (per-slide + notes + images), scans/images (OCR/vision), terminal-session parser, mixed-block segmentation | See Section C | As listed | Dataset MAT_* (PPTX, scanned), EDGE_002–006 | No base64-as-text; slide numbers preserved |
| P1.5 Remove YouTube invention fallback | controller | LLM invents content | Fail honestly when there is no transcript | Private/no-caption video | Clear error, no questions |

### P2 — Question generation, count satisfaction and validation

| Task | Problem | Correction | Verification | Acceptance |
|---|---|---|---|---|
| P2.1 Defensible capacity from units | Duration brackets, 1 unit = 1 question, keyword Hard | For each unit, enumerate distinct assessment opportunities (definition, mechanism, trace, calculation, comparison, edge case, application) **only where the unit's evidence supports them** (LLM-proposed, rule-checked against unit fields such as `hasCode`, `hasFormula`, category). Capacity = sum of distinct opportunities; per-difficulty capacity from opportunity type | Intro vs deep lecture from dataset; human check of 50 opportunities | Capacity differs sensibly by lecture; humans agree ≥ 80% that the opportunities are distinct and supported |
| P2.2 Budget allocation | Proportional to unit counts | Allocate requested N across topics by opportunity capacity and emphasis (time share from segment durations); never exceed a topic's capacity; explain allocation | Requests 1/5/10/15/20/30 on 3 lectures | Allocation table shown; no topic over capacity |
| P2.3 Batch prompt parity | Batch omits misconceptions/archetypes | Pass per-target opportunity type, evidence and misconceptions into the batch prompt | A/B on 3 lectures | No quality drop vs single-target path |
| P2.4 Independent verification | Same-model self-audit; blind solver mostly skipped | Blind solve of every item by a different model/provider (answer without the key) and require agreement; keep deterministic checks | Measure disagreement on 100 items with human adjudication | Measured precision of "verified" items reported |
| P2.5 Difficulty as a measured property | Label = plan | Post-generation rating of cognitive operation and steps required (rubric), lecture-relative anchoring using the lecture's own opportunity distribution; mismatches relabelled or rejected | Human difficulty ratings on 100 items; later student p-values | Agreement reported; Hard only where evidence exists |
| P2.6 Item-level failure isolation | One bad item fails quiz | Drop and replace the bad item | Injected malformed item | Quiz still delivered |
| P2.7 Fix reserve tier bug and fabricated defaults | `:878`, 0.95/0.85 defaults | Use `allocatedTier`; `null` when not measured | Unit test | No synthetic scores in metadata |
| P2.8 Cost/latency budget | ~40k tokens/question, minutes | Reuse P1.1 extraction; cache plans; batch evaluation; target < 2 min for 10 questions | Timed runs | Documented p50/p90 latency and tokens/question |

### P3 — Teaching score and teacher-facing feedback

| Task | Correction | Verification | Acceptance |
|---|---|---|---|
| P3.1 Define the construct | Written rubric (e.g. clarity of explanation, reasoning/"why", examples/demonstration, progression, accuracy, coverage relative to the **stated intent** of the lecture). Each dimension can return "insufficient evidence" | Review by 2–3 senior faculty | Signed-off rubric |
| P3.2 Evidence-cited scoring | Score each dimension from the Lecture Model units with quoted evidence (timestamp/slide); overall score only when enough dimensions are assessable; confidence shown | Re-run the same lecture 3× | Same lecture within ±5 points; every claim has a citation |
| P3.3 Reuse the research assets | `experiment_5_teaching_adequacy` gold data and gates | Use as the development set; keep `dev_3b` sealed for final test | Spearman/ICC vs gold reported |
| P3.4 Actionable feedback | Feedback generated from specific units lacking a dimension ("explained X but not why Y") | Faculty rating of usefulness | ≥ 80% rated specific and accurate |
| P3.5 Fairness checks | No speech-rate, accent or recording-quality features; test intro vs advanced lectures for bias toward jargon | Paired intro/advanced lectures | No systematic penalty for introductory intent |

### P4 — UI completion, integration and final verification

| Task | Correction | Acceptance |
|---|---|---|
| P4.1 Understanding panel | Overview, real timestamped segments, topics/subtopics with "taught / slide-only / spoken-only" flags; teacher can untick topics | Teacher can verify and correct before generation |
| P4.2 Capacity panel | Easy/Medium/Hard/Balanced capacity and recommended counts from P2.1; per-topic allocation preview | Numbers equal those used by generation |
| P4.3 Shortfall UX | Render backend capacity options; stop forcing `FILL_WITH_MEDIUM`; specific reasons | Teacher can choose how to handle a deficit |
| P4.4 Count 0–30 | 0 = analysis only (no generation) | Matches spec |
| P4.5 Analytics | Wire `distractorDiscriminationAnalyzer` into quiz analytics (p, D, point-biserial, distractor frequency, non-functioning distractors) | Available after ≥ ~30 responses, labelled with sample size |
| P4.6 Security/ops | Role guards, log redaction, moderation on all paths, cache versioning | Checklist passed |

---

## Section F — Research readiness

**Can be claimed now (with evidence in the repo):**
* An engineering architecture for lecture-grounded MCQ generation with verbatim-quote-verified teaching-unit extraction, fail-closed evaluation and full provenance traces.
* A documented, honest negative result on automated teaching-adequacy evaluation (`experiment_5`, Gate 6 failed) — useful as a methods lesson, not as a validated instrument.

**Must not be claimed yet:**
* That the system "measures teaching quality", or any validity of the teaching score.
* That question counts are "defensible" or "evidence-based capacity".
* Difficulty calibration, distractor "discrimination", or any psychometric property (no student data has been analysed).
* Any comparison to baselines, novelty, patentability, or Q1 readiness.
* Any benchmark number produced while D7 (benchmark leakage) is present.

**Requires implementation:** P0–P2 above; P3 for the teaching score.

**Requires experiments (on the real dataset, with the dataset location you will provide):**
* Count satisfaction: requested {0,1,5,10,15,20,30} × ≥ 6 lectures (intro/deep, theory/programming, audio/doc/combined, code-only, terminal). Report requested, recommended, capacity, delivered, reason per missing slot, latency and tokens.
* Ablations: with/without slide alignment; single vs batch generation; self-judge vs independent verifier.
* Stability: 3 repeated runs per condition (capacity, teaching score, question overlap).

**Requires human evaluation:**
* Item rating by ≥ 2 subject experts per domain on correctness, clarity, grounding, difficulty and distractor plausibility (report inter-rater agreement, e.g. Cohen's/Fleiss' κ or Krippendorff's α).
* Teaching-score validity: correlation with independent expert ratings of the same lectures (Spearman ρ, ICC), plus faculty judgement of feedback usefulness.

**Metrics to use (standard terminology for the mentor's "discrimination/discrepancy coefficient"):**
* Item difficulty index *p* (proportion correct).
* Item discrimination index *D* (upper vs lower 27%) and corrected **point-biserial correlation** (item vs rest-of-test score).
* **Distractor selection frequency** and **distractor efficiency** (share of distractors chosen by ≥ 5% of examinees; non-functioning distractor count).
* Distractor discrimination (distractor point-biserial should be negative).
* For automatic generation quality: expert-rated acceptability rate; answerability by a blind solver; duplicate rate.
The in-house "Pre-Test Distractor Discrepancy Index" should be renamed (e.g. "predicted distractor plausibility score") and not presented as a psychometric coefficient.

**Baselines needed:** (a) a single-prompt LLM given the full transcript; (b) the same with slides; (c) human-written quiz for the same lecture where available; (d) for the teaching score, expert rubric ratings.

---

## Section G — Completion estimate

### How ready is the MCQ pipeline?

Judgement against the acceptance standard in this brief (not against "does it run"):

| Area | Readiness | Basis |
|---|---|---|
| Engineering scaffolding (pipeline, tracing, fail-closed evaluation, extraction) | ~70% | Extensive, mostly sound components; `main` plumbing delivers 30/30 under stubbed probes |
| Pillar 1 Question quality | ~45% | Saved Easy items look correct; no measured correctness; code/terminal inputs misrouted; batch path loses guidance |
| Pillar 2 Count satisfaction | ~20% | Handoff 0%; real runs 30% fulfilment; capacity not defensible |
| Pillar 3 Difficulty | ~20% | Hard never delivered on real runs; labels not measured |
| Pillar 4 Teaching score | ~10% | Heuristic, partly input-independent; research track failed gate |
| Pillar 5 Distractors | ~30% | Prompt/audit exist; misconceptions generic or hardcoded; no empirical analysis wired |
| **Overall MCQ pipeline vs acceptance standard** | **~30–35%** | Weighted toward the pillars, which are the stated definition of done |

**Status by branch:** `handoff` is **not deployable** (D1). `main` runs but should not be used for a college-wide rollout or research claims until P0 and the P1 Lecture Model are done.

### Work breakdown

* **Can be done immediately (small, low-risk):** P0.1, P0.2, P0.3, P0.4, P0.6 (partly), P0.7, P2.6, P2.7, D20 items, D21. Expect a few days of engineering, plus re-running existing real-lecture cohorts.
* **Requires architectural change:** P0.5 input routing; P1.1 single Lecture Model shared by preview, capacity, generation and scoring; P1.3 slide alignment; P2.1–2.2 opportunity-based capacity and allocation; P2.5 measured difficulty; P3 teaching score rebuild.
* **Requires additional data:** the real audio files and transcript caches (not in git); code-only and terminal-output samples (none in the dataset catalogue); paired intro/advanced lectures on the same topic; student response data for psychometrics.
* **Requires human evaluation:** item quality ratings, difficulty ratings, teaching-score validation, feedback usefulness.
* **Blocked or constrained by external providers:** Groq rate limits and daily token quotas (the team's own evaluations repeatedly hit budget exhaustion); model availability (verify that `qwen/qwen3.8-27b` and `llama-3.2-11b-vision-preview` are currently served); cost per question at current design (~40k tokens).

---

## Approval gate

Per the brief, **no implementation has been started.** Recommended first approval: **P0.1–P0.3 + P0.7** (restore delivery, budget and honest reporting, with a regression test), then P0.4–P0.6, then the P1 Lecture Model design for review before any architectural change.

---

## Appendix — Probes and evidence (reproducible)

The probe scripts were run from a scratch checkout and were deliberately **not** committed, to keep this audit read-only. They stub only the LLM-backed functions and call the real engine code; they can be added under `server/test/` as part of P0.7 on approval.

* `orchestrator_probe.js`: runs the real `pipelineOrchestrator.runPipeline` with planner/generator/evaluator/grounding stubbed to always succeed.
  * handoff N=5 → `FAILED`, `PIPELINE_ERROR: Assignment to constant variable.`, `MATERIAL_EXHAUSTED`.
  * handoff with D1 neutralised: N=5/10/12/15 → full; N=20 → 15; N=30 → 15 (`MATERIAL_EXHAUSTED`).
  * `main`: N=5/15/30 → 5/15/30.
* `teaching_score_probe.js` on `experiment_5_teaching_adequacy/dev_3a` (16 segments, gold `ref_depth`):
  * UI score vs gold: Spearman ρ = 0.59 (n=16). Inversions, e.g. 2C (gold 4) = 93 vs 2B/2D (gold 5) = 71.
  * Segment 1A: 70 → **100** after inserting only discourse words.
  * `_computeTCScore`: real text = 81, empty text = 81, "lorem ipsum" = 81, one character with 12 targets = 94.
* `terminal_probe.js`: 570-char Linux process-management session sent as the UI sends it → `TOPIC_SYNTHESIS`, capacity 25 (Hard 4), depth score 90.
* Saved real runs (handoff `evaluation_dataset/benchmark_results/`): 28 academic runs, 73/245 delivered; Hard 0/3 runs; max duration ~1,099 s; canary 40 outbound calls, 119,431 tokens for 3 questions, one question with a null stem; MULTI_004 capacity 21 vs 8 and tcScore 87 vs 94 across runs.
