# Before the single MCQ pipeline (removed 26 Nov 2026)

This folder keeps the code that was taken out when the MCQ generator became one pipeline
(`server/engine/mcq/lecturePipeline.js`). Nothing here is loaded by the server. It is kept so the paper can show what
the earlier design was, why it changed, and what changed in the results.

## The pipeline now (one path for every input)

| Step | Where | Intention |
|---|---|---|
| 1 Read | `controllers/quizController.js` | Speech → timed transcript (Whisper; code-mixed speech translated); PDFs, slides, photos, handwriting → text (Gemini vision, OCR backup); code and terminal text kept as is |
| 2 Understand | `engine/intelligence/lectureModel.js` | Typed blocks → speech–material linkage (only when both exist; word overlap + meaning) → windows → teaching points with verbatim quotes (quote check) → repeats merged → **lecture-wide calibration** (intent, what Easy/Medium/Hard mean for this class, role of each point) → capacity |
| 3 Plan | `lectureModel.planRequest` | **Lecture first** (material-only points only fill what the lecture cannot), difficulty mix from the calibrated capacity, topics by capacity and teaching time, points by **importance**, question type by teaching style, Hard form per point, reserves |
| 4 Write | `engine/agents/agent2Generator.js` | One question per target, with the teacher's passage for that point, the lecture's intent, what its difficulty means for this class, lecture misconceptions for distractors |
| 5 Check each | `engine/agents/agent3Evaluator.js` | Rule checks; a failing question gets the critic and one repair; still failing → replaced by a reserve |
| 6 Accept | `engine/validators/finalQualityGate.js` + `blindAnswerCheck.js` | 13 criteria with the lecture passage; key-blind solve by another model family; duplicates by meaning |
| 7 Replace | `quizController.js` | Rejected slots refilled from reserves, at most two rounds, each checked again |
| 8 Deliver | `quizController.js` | Questions plus a notice saying what was delivered and why |

## What was removed, and why

| Removed | What it did | Why it went |
|---|---|---|
| `engine/pipelineOrchestrator.js` (2,449 lines) | Ran stages 01–07 for every input: evidence packaging, Agent 1 planning, writing, per-question review, quiz-level review, grounding gate, replenishment | With the lecture model it re-did work already done (capacity, planning, extraction fallback, representation routing) and had its own replacement loop beside the gate's. Replaced by `engine/mcq/lecturePipeline.js` (steps 4–5) |
| `engine/agents/agent1Planner.js` (5,904 lines) | LLM / heuristic assessment planning | The plan comes from the lecture model; Agent 1 only mapped it to targets. That mapping is now `lecturePipeline.toTarget` |
| `engine/evidence/evidencePackager.js`, `hierarchicalChunker.js`, `hierarchicalRetriever.js`, `crossMaterialAligner.js`, `hybridRetriever.js`, `bm25Retriever.js`, `rerankerService.js`, `denseEmbeddingBridge.js`, `structureAwareChunker.js`, `curricularCoverageAnalyzer.js`, old `evidenceContextSelector.js` | Parent/child chunks, a speech↔slide alignment graph, BM25 + TF retrieval and reranking around each target | The lecture model already knows which blocks taught each point. Retrieval searched the raw text again and could give the writer text the checks never saw. The aligner also had hand-written cases for one benchmark lecture. Speech–slide linkage now happens once, inside the lecture model, by word overlap and meaning |
| PDI v1 (`pdiRouter`) as a pipeline input | Chose Summary / Blueprint / Unified from 6 surface features of the upload | It never changed which points were assessed once the lecture model existed; how each part was taught is now the teaching-style profile (PDI v2), per point |
| Extraction fallback (`lectureIntelligence.extractTeachingUnits`) | A second teaching-point reader used when the lecture model was missing | Two readers gave two different understandings. Now a lecture that cannot be read is reported and can be retried |
| `analyzeDepth` heuristic fallback (`analyzeDepth_heuristic_fallback.js.txt`) | A capacity estimate from keyword heuristics when the lecture model failed | The teacher saw a capacity the generator never used |
| "Gate switched off" path (`DISABLE_QUALITY_GATE`, independent check instead) | Let the final gate be disabled by configuration | The gate is not optional |
| 22 unreachable engine files (shadow runner, IRT calibrator, portfolio optimiser, observability helpers, …) | Not loaded by the server at all | Dead code |
| `tests/` | Tests of the removed modules | They test code that no longer runs |

`pdiRouter.js` and `lectureIntelligence.js` remain in the server only for the upload card's file metadata and title
helper; they are not part of the MCQ pipeline.
