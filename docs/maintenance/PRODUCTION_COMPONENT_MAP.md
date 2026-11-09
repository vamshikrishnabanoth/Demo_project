# KMIT Kahoot — Production Component Map

This document maps all essential production modules, their responsibilities, caller/callee relationships, and architectural boundaries.

---

## 1. Engine & Orchestration Tier (`server/engine/`)

| Module Path | Primary Responsibility | Direct Callers | Downstream Dependencies | Architectural Invariant |
|:---|:---|:---|:---|:---|
| [`server/engine/pipelineOrchestrator.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/pipelineOrchestrator.js) | Linear execution coordinator for Stages 01 to 07b. Manages fallback reserve promotions, bounded repairs, and audit records. | `quizController.js` (line 1123) | `sourceService`, `evidencePackager`, `depthAnalyzer`, `agent1Planner`, `agent2Generator`, `agent3Evaluator`, `groundingGate` | Frozen. Coordinates stages without hardcoding domain-specific concepts or counts. |
| [`server/engine/adapter/llmRouter.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/adapter/llmRouter.js) | Intelligent LLM provider abstraction with exponential backoff, rate limit handling, and automatic Groq $\rightarrow$ Gemini failover. | `agent1Planner`, `agent2Generator`, `agent3Evaluator`, `lectureIntelligence` | Groq SDK (`groq-sdk`), Gemini API (`@google/generative-ai`), OpenAI SDK | Never exposes API keys or internal endpoints in exceptions or logs. |
| [`server/engine/agents/agent1Planner.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/agents/agent1Planner.js) | Assessment planning, topic hierarchy mapping, 2D LCACM matrix capacity evaluation, and target blueprinting ($N$ primary + $M$ reserve). | `pipelineOrchestrator.js` (line 471) | `depthAnalyzer.js`, `llmRouter.js` | Topic distribution is strictly independent of difficulty allocation. Never manufactures ungrounded Hard targets. |
| [`server/engine/agents/agent2Generator.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/agents/agent2Generator.js) | Generates self-contained 4-option MCQs grounded in micro-citations with authentic student misconception distractors. Performs bounded repairs. | `pipelineOrchestrator.js` (lines 620, 890) | `llmRouter.js`, `astParser.js` | Enforces stem brevity; strips throat-clearing preambles; balances option lengths. |
| [`server/engine/agents/agent3Evaluator.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/agents/agent3Evaluator.js) | Independent quality gatekeeper. Audits single unambiguous key, distractor discrimination, evidence support, and length parity. | `pipelineOrchestrator.js` (lines 670, 930) | `llmRouter.js`, `difficultyAwareDistractorValidator.js` | Rejects ambiguous keys and length giveaways; limits repair feedback to 1 bounded attempt. |

---

## 2. Evidence & Intelligence Tier (`server/engine/evidence/` & `intelligence/`)

| Module Path | Primary Responsibility | Direct Callers | Downstream Dependencies | Architectural Invariant |
|:---|:---|:---|:---|:---|
| [`server/engine/evidence/depthAnalyzer.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/evidence/depthAnalyzer.js) | Evaluates Curricular Evidence Profile (CEP 2.0.0), Academic Content Gate, and Evidence Sufficiency Gate. Detects algorithmic and comparative modalities. | `pipelineOrchestrator.js` (line 201), `agent1Planner.js` | Built-in regex lexicons, token sets | 100-point composite score retired. Emits disclaimed, metric-independent signals only. |
| [`server/engine/evidence/evidencePackager.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/evidence/evidencePackager.js) | Implements Dual-Source Authority Division (Voice = intent/emphasis; Slides/Code = artifacts/equations). Applies PDI routing. | `pipelineOrchestrator.js` (line 201) | `hierarchicalChunker.js`, `crossMaterialAligner.js` | Preserves source provenance without mixing contradictory claims. |
| [`server/engine/evidence/hierarchicalChunker.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/evidence/hierarchicalChunker.js) | Creates dual-level RAG nodes: 75-word child chunks for precision micro-citation and 400-word parent windows for macro-narrative context. | `evidencePackager.js` | Native string tokenizer | Guarantees deterministic chunk bounds with metadata offsets. |
| [`server/engine/evidence/crossMaterialAligner.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/evidence/crossMaterialAligner.js) | Constructs bidirectional semantic graph linking spoken lecture timestamps to specific slide page numbers and code functions. | `evidencePackager.js` | Native token intersection graph | Detects unused slides and distinguishes real spoken citations from slide keyword overlap. |
| [`server/engine/intelligence/lectureIntelligence.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/intelligence/lectureIntelligence.js) | Extracts structured pedagogical teaching units across 10-minute overlapping temporal windows; quarantines casual conversational banter. | `pipelineOrchestrator.js` (line 346) | `llmRouter.js`, hierarchical evidence store | Non-degradation gate: halts honestly if generic extraction yields zero verified teaching units. |

---

## 3. Validation & Quality Gates Tier (`server/engine/validators/`)

| Module Path | Primary Responsibility | Direct Callers | Downstream Dependencies | Architectural Invariant |
|:---|:---|:---|:---|:---|
| [`server/engine/validators/deterministicValidator.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/validators/deterministicValidator.js) | Deterministic pre/post verification: enforces exactly 4 distinct options, verifies key presence, rejects "All/None of the above". | `pipelineOrchestrator.js` (line 1258) | None (pure deterministic rules) | Zero LLM calls. Fails fast on malformed option arrays or missing keys. |
| [`server/engine/validators/groundingGate.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/validators/groundingGate.js) | Final Grounding Gate (Stage 07). Evaluates keyword overlap and factual justification against cited session text. Prunes hallucinations. | `pipelineOrchestrator.js` (line 1310) | Native lexical matcher | Rejects questions referencing foreign domain terms not taught in the session. |
| [`server/engine/validators/difficultyAwareDistractorValidator.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/validators/difficultyAwareDistractorValidator.js) | Validates distractor plausibility and ensures distractors match the target cognitive level (e.g., recall vs. synthesis). | `agent3Evaluator.js` | None | Flags obvious distractor opposites, grammatical giveaways, or absurd choices. |
| [`server/engine/validators/astParser.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/engine/validators/astParser.js) | Robust JSON parsing and repair engine for LLM outputs; recovers markdown-wrapped code blocks and escaped quotes. | `agent2Generator.js`, `agent3Evaluator.js`, `lectureIntelligence.js` | Native JSON parser | Safely cleans LLM conversational wrappers before schema validation. |

---

## 4. API, Controllers & Services Tier (`server/`)

| Module Path | Primary Responsibility | Direct Callers | Downstream Dependencies | Architectural Invariant |
|:---|:---|:---|:---|:---|
| [`server/controllers/quizController.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/controllers/quizController.js) | HTTP controller for quiz management, PIN joins, question delivery, answer submission, leaderboard computation, and template cloning. | `server/routes/quiz.js` | `pipelineOrchestrator`, `prisma`, `grading.js`, `sourceService` | Redacts correct answers and explanations for student roles. Enforces immutability hashes. |
| [`server/routes/quiz.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/routes/quiz.js) | Express route definitions, rate limiters, file upload middleware (`multer`), and role-based authorization guards. | `server/index.js` | `quizController.js`, `authMiddleware.js` | Protects generation and admin routes with `teacherOrAdmin` guard; applies join rate limits. |
| [`server/services/sourceService.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/services/sourceService.js) | Multi-modal file extraction service. Parses PDFs (`pdf-parse`), PPTX slides (`pptx-parser`), and audio transcription (`fast whisper` / Google). | `quizController.js`, `pipelineOrchestrator.js` | File system, caching layer | Caches extracted text to spare redundant disk/audio I/O on retries. |
| [`server/utils/grading.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/utils/grading.js) | Shared server-side grading utility. Grades student answers by exact text, option letter ($A, B, C, D$), or option index. | `quizController.js` (line 2238) | None | Pure deterministic grading function used consistently across all quiz submission modes. |
| [`server/middleware/authMiddleware.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/middleware/authMiddleware.js) | JWT verification middleware with sliding refresh cookies, progressive account lockout, and suspension enforcement. | All protected Express routes | `jsonwebtoken`, `prisma` | Validates `tokenVersion` to immediately revoke compromised sessions. |
| [`server/lib/prisma.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/lib/prisma.js) | Singleton Prisma client configured with PostgreSQL connection pooling (`limit=20, pool_timeout=20s`). | All database-backed controllers | `@prisma/client`, Supabase PostgreSQL | Reuses single pool instance across all requests to prevent pool exhaustion. |

---

## 5. Client Integration Tier (`client/src/`)

| Module Path | Primary Responsibility | Caller Component | User Role |
|:---|:---|:---|:---:|
| `client/src/pages/CreateQuizText.jsx` & `CreateQuizTopic.jsx` | Teacher multi-modal upload interface. Submits audio, slides, and syllabus configurations to `/api/quiz/generate`. | Navigation Router | Teacher / Admin |
| `client/src/components/pipeline/PublishingViewer.jsx` | Displays pipeline execution status, neutral Session Modality (audio/document), and final question publication. | `PipelineOutput.jsx` | Teacher |
| `client/src/components/pipeline/McqViewer.jsx` | Teacher review of generated questions, cognitive tier badges (`Easy`, `Medium`, `Hard`), and cited evidence quotes. | `PipelineOutput.jsx` | Teacher |
| `client/src/pages/StudentDashboard.jsx` | Student PIN entry keypad (`handleJoin`). Dispatches `POST /api/quiz/join` with 6-digit code. | Navigation Router | Student |
| `client/src/pages/AttemptQuiz.jsx` | Secure student test-taking interface. Renders redacted questions, timer countdowns, and submits answers to `/api/quiz/submit`. | Navigation Router | Student |
| `client/src/pages/QuizAnalytics.jsx` | Real-time leaderboard and student performance breakdown with pedagogical explanations post-completion. | Navigation Router | Student / Teacher |
