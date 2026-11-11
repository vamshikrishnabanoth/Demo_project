# Engineering Implementation Roadmap v1.0 (Frozen Architecture)
## Enterprise AI Multiple-Choice Question (MCQ) Generation & Assessment Platform

---

## Executive Overview & Engineering Guidelines

This document translates **Architecture v1.0 (Frozen)** into an enterprise-grade execution blueprint. It outlines a 4-phase delivery plan designed for modular implementation, high system reliability, and seamless scalability using **Node.js/Express/Socket.io** (App Server), **FastAPI** (AI Engine & Optimization Services), **PostgreSQL + pgvector** (Database & Storage), **Prisma** (ORM), and **Redis + BullMQ** (Asynchronous Job Distribution).

```
                      4-PHASE DEVELOPMENT ROADMAP

 Phase 1: CORE GROUNDED ENGINE (MVP)
 ├── Multi-Format Ingestion & Parent-Child RAG
 ├── Concept Graph & Academic Planner
 ├── Capability Question Generator & Dynamic Exemplars (Basic)
 └── Deterministic Validation Tools (AST, Sandbox, Math, Schema)
                               │
                               ▼
 Phase 2: ADAPTIVE PEDAGOGICAL ENGINE
 ├── Persona Adapter & Misconception Modeling
 ├── Independent Critique Agent & Multi-Agent Refinement
 └── Configurable Pre-Test IQS & Dynamic Exemplar Library
                               │
                               ▼
 Phase 3: FEEDBACK & GOVERNANCE
 ├── Teacher Review Dashboard & Instructor Feedback
 ├── Student Analytics & Real-Time Socket Telemetry
 └── Item Versioning (Lineage) & Audit Logging
                               │
                               ▼
 Phase 4: CONTINUOUS OPTIMIZATION
 ├── IRT 2PL Statistical Calibration & Distractor Analysis
 ├── MILP Portfolio Optimizer (OR-Tools)
 └── Automatic Gold-Exemplar Promotion Loops
```

---

# PHASE 1 — CORE GROUNDED ENGINE (MVP)

### 1. Objectives
Deliver a production-ready, grounded MCQ generation pipeline that converts uploaded course materials into valid, structurally verified, un-hallucinated multiple-choice questions with explicit source citations and execution sandboxing.

### 2. Deliverables
* Asynchronous ingestion service for PDFs, DOCX, PPTX, OCR Scans, Audio Transcripts, and Prompts.
* Parent-Child vector store utilizing `pgvector` and `sentence-transformers`.
* Concept Graph DAG extractor and Academic Planner.
* Capability Question Generator with basic Dynamic Exemplar injection.
* Deterministic Multi-Tool Validator (AST JavaScript/Python parser, Isolated Code Sandbox, SymPy LaTeX solver, JSON Schema Validator).
* Single-pass deterministic repair pipeline.
* Explainability Payload attached to every generated question.
* OpenTelemetry tracing for pipeline timing and LLM token usage.

### 3. Folder Structure
```
server/
├── config/
│   ├── env.js
│   └── generatorConfig.js
├── src/
│   ├── controllers/
│   │   ├── ingestionController.js
│   │   └── quizController.js
│   ├── engine/
│   │   ├── ingestion/
│   │   │   ├── documentParser.js
│   │   │   ├── ocrService.js
│   │   │   └── chunker.js
│   │   ├── rag/
│   │   │   ├── vectorStore.js
│   │   │   └── parentChildRetriever.js
│   │   ├── conceptGraph/
│   │   │   ├── dagBuilder.js
│   │   │   └── conceptSanitizer.js
│   │   ├── planner/
│   │   │   └── academicPlanner.js
│   │   ├── generator/
│   │   │   ├── promptBuilder.js
│   │   │   └── llmClient.js
│   │   ├── validator/
│   │   │   ├── astValidator.js
│   │   │   ├── codeSandbox.js
│   │   │   ├── mathValidator.js
│   │   │   └── schemaValidator.js
│   │   └── repair/
│   │       └── singlePassRepair.js
│   ├── jobs/
│   │   ├── ingestionWorker.js
│   │   └── generationWorker.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── fileUpload.js
│   └── routes/
│       ├── ingestion.js
│       └── quiz.js
prisma/
└── schema.prisma
ai_service/ (FastAPI)
├── main.py
├── routers/
│   ├── embeddings.py
│   ├── ocr.py
│   └── sandbox.py
└── services/
    ├── ast_parser.py
    └── sympy_solver.py
```

### 4. Backend Components
* **Ingestion Worker (`ingestionWorker.js`)**: Processes uploaded files, strips syllabus administrative noise, extracts text, calls FastAPI embedding endpoint, and writes parent-child chunks to PostgreSQL `pgvector`.
* **Concept DAG Extractor (`dagBuilder.js`)**: Identifies technical terms, extracts prerequisite relationships ($A \rightarrow B$), and produces a topological ordering.
* **Academic Planner (`academicPlanner.js`)**: Accepts topic/document ID and question count; outputs a list of lightweight `AssessmentPlan` briefs (Target Concept, Bloom Target, Evidence Bounds).
* **Generation Engine (`llmClient.js`)**: Calls LLM provider using structured prompt with injected parent chunks and 2 basic exemplars.
* **Deterministic Validator (`validator/`)**:
  * `astValidator.js`: Ensures code blocks in stems/options parse without syntax errors.
  * `codeSandbox.js`: Executes JavaScript/Python in an isolated VM container to verify output.
  * `mathValidator.js`: Sends LaTeX formulas to FastAPI SymPy service for verification.
  * `schemaValidator.js`: Enforces strict JSON return schema.
* **Single-Pass Repair (`singlePassRepair.js`)**: If validation fails, triggers a single targeted repair call passing the failure error message back to the LLM.

### 5. Frontend Components
* **Material Upload Component (`UploadArea.jsx`)**: Supports drag-and-drop PDF, DOCX, PPTX, OCR Images, and Audio files with page/slide range controls.
* **Generation Progress Bar (`PipelineLoader.jsx`)**: Real-time Socket.io listener displaying active stage status (`Ingest`, `Graph`, `Plan`, `Generate`, `Validate`).
* **Quiz Review Page (`QuizPreview.jsx`)**: Displays generated MCQs with options, correct answer badge, code syntax highlighting, LaTeX equations, and the **Explainability Meta-Payload** (Target Concept, Evidence Citation, Bloom Target).

### 6. Database Schema (Prisma)
```prisma
model SourceMaterial {
  id           String          @id @default(uuid())
  title        String
  fileType     String
  filePath     String
  extractedText String?       @db.Text
  createdAt    DateTime        @default(now())
  chunks       DocumentChunk[]
  concepts     ConceptNode[]
}

model DocumentChunk {
  id               String         @id @default(uuid())
  materialId       String
  material         SourceMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)
  isParent         Boolean        @default(false)
  parentId         String?
  content          String         @db.Text
  embedding        Unsupported("vector(384)")?
  metadata         Json?
}

model ConceptNode {
  id               String         @id @default(uuid())
  materialId       String
  material         SourceMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)
  name             String
  prerequisites    String[]
  bloomDepth       String         @default("REMEMBER")
}

model Question {
  id               String   @id @default(uuid())
  quizId           String
  conceptName      String
  bloomLevel       String
  stem             String   @db.Text
  options          Json
  correctAnswer    String
  explanation      String   @db.Text
  explainability   Json
  isValidated      Boolean  @default(false)
  createdAt        DateTime @default(now())
}
```

### 7. API Endpoints
* `POST /api/v1/materials/upload`: Upload material file (multipart/form-data).
* `POST /api/v1/quiz/generate`: Initiate async MCQ generation job. Returns `{ taskId }`.
* `GET /api/v1/quiz/status/:taskId`: Poll status or listen via Socket.io `quiz:status:${taskId}`.
* `GET /api/v1/quiz/:quizId`: Fetch completed quiz payload with explainability metadata.

### 8. Background Jobs
* **`process-material`**: Asynchronous file text extraction, OCR processing, and pgvector embedding indexing.
* **`generate-mcq-batch`**: Asynchronous execution of Concept DAG $\rightarrow$ Academic Planning $\rightarrow$ Generation $\rightarrow$ Deterministic Tool Validation $\rightarrow$ Portfolio Assembly.

### 9. Queues (BullMQ + Redis)
* `ingestion-queue`: Priority 1 job queue for document processing.
* `generation-queue`: Priority 2 job queue for LLM batch question generation.

### 10. Models Used
* **OCR**: Tesseract OCR engine (via FastAPI wrapper).
* **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384-dim, dense vector index).
* **LLM Engine**: Groq Cloud `llama-3.1-8b-instant` / `llama-3.3-70B-versatile` (configurable via `env.js`).

### 11. Data Flow
1. User uploads file $\rightarrow$ `ingestionController` enqueues job to `ingestion-queue`.
2. Worker parses document, generates parent-child chunks, computes vectors via FastAPI, and writes to `pgvector`.
3. User requests quiz generation $\rightarrow$ `quizController` enqueues `generate-mcq-batch`.
4. Worker builds Concept DAG, constructs Academic Assessment Briefs, retrieves parent chunks, calls LLM.
5. Generated questions pass through `validator/` (AST, Sandbox, SymPy, Schema).
6. Failed questions attempt 1 targeted repair; passed questions are assembled into the quiz portfolio with explainability payloads attached.

### 12. Failure Recovery
* **Ingestion Failure**: If text extraction fails, system falls back to Tesseract OCR.
* **LLM Call Failure / Timeout**: Retries with exponential backoff (max 3 retries). If provider is down, circuit breaker switches to backup model configuration.
* **Validation Failure**: Triggers single-pass repair. If repair still fails, slot is regenerated with an alternative evidence chunk.

### 13. Observability
* **Tracing**: OpenTelemetry trace spans around Vector Search, LLM latency, and Validation duration.
* **Logging**: Structured JSON logs (`Winston` logger) containing `reqId`, `taskId`, `materialId`, and token usage statistics.

### 14. Testing Strategy
* **Unit Tests**: Jest unit tests for `chunker.js`, `dagBuilder.js`, `astValidator.js`, and `schemaValidator.js`.
* **Integration Tests**: Supertest suite testing `/materials/upload` and `/quiz/generate` endpoints with mock LLM responses.

### 15. Deployment Strategy
* **App Server**: Node.js Docker container on container hosting platform.
* **AI Service**: FastAPI Python Docker container equipped with `tesseract-ocr` binaries.
* **Database**: PostgreSQL 16 instance with `pgvector` extension enabled.

### 16. Scalability Considerations
* Horizontal scaling of Node.js workers consuming from Redis BullMQ queues.
* pgvector HNSW index enabled on embedding columns for sub-20ms similarity search over 50,000+ chunks.

### 17. Future Extension Points
* Abstract LLM provider interface allowing zero-downtime hot-swapping between Groq, OpenAI, Anthropic, and local Ollama/vLLM endpoints.

---

# PHASE 2 — ADAPTIVE PEDAGOGICAL ENGINE

### 1. Objectives
Extend the generation engine with cohort-adapted student persona modeling, targeted misconception distractor framing, dynamic exemplar retrieval from a indexed exemplar library, an independent critique agent, multi-agent refinement, and pre-test IQS quality scoring.

### 2. Deliverables
* **Persona Adapter Engine**: Transforms `AssessmentPlan` into `FinalAssessmentBrief` using target learner profiles.
* **Misconception Catalog**: Pre-indexed database of common domain misconceptions.
* **Dynamic Exemplar Library**: Indexed repository of high-performing gold-standard MCQs.
* **Independent Critique Agent**: Decoupled LLM reviewer evaluating factual correctness, Bloom alignment, and distractor plausibility.
* **Multi-Agent Refinement Protocol**: Automated single-field repair loop between Generator and Critique Agent.
* **Pre-Test IQS Evaluator**: Computes initial quality score based on Reviewer confidence and structural metrics.

### 3. Folder Structure
```
server/src/engine/
├── adapter/
│   ├── personaAdapter.js
│   └── misconceptionCatalog.js
├── exemplars/
│   └── exemplarRetriever.js
├── agents/
│   ├── critiqueAgent.js
│   └── multiAgentRefiner.js
└── quality/
    └── preTestIqsCalculator.js
```

### 4. Backend Components
* **Persona Adapter (`personaAdapter.js`)**: Accepts `AssessmentPlan` + `LearnerProfile` (e.g. 2nd-year Engineering, weak in timeouts). Injects target difficulty (`Medium+`) and specific misconception targets.
* **Exemplar Retriever (`exemplarRetriever.js`)**: Performs vector cosine similarity search over `ExemplarLibrary` to fetch 2 domain-matched gold questions.
* **Critique Agent (`critiqueAgent.js`)**: Separate LLM prompt evaluation pass checking:
  1. Is the correct answer factually backed by `evidence_bounds`?
  2. Is the stem appropriate for the target Bloom level?
  3. Are distractors plausible domain misconceptions?
* **Multi-Agent Refiner (`multiAgentRefiner.js`)**: Manages 2-pass feedback loop between Critique Agent and Generator for targeted single-field repairs.
* **Pre-Test IQS Calculator (`preTestIqsCalculator.js`)**: Computes initial score:
  $$\text{IQS}_{\text{pre}} = 0.50(R_{\text{critique\_score}}) + 0.30(V_{\text{tool\_score}}) + 0.20(E_{\text{entropy\_score}})$$

### 5. Frontend Components
* **Persona Configurator (`LearnerPersonaModal.jsx`)**: UI control allowing teachers to select target student level (Introductory, Intermediate, Advanced), target weakness areas, and custom misconception targets.
* **Critique Audit Panel (`CritiqueReportDrawer.jsx`)**: Inspectable drawer showing the Independent Critique Agent's score, factual validation notes, and distractor health checks.

### 6. Database Schema Additions (Prisma)
```prisma
model LearnerProfile {
  id              String   @id @default(uuid())
  name            String
  targetYear      String
  weaknessAreas   String[]
  customPrompt    String?
}

model ExemplarQuestion {
  id               String   @id @default(uuid())
  domain           String
  concept          String
  bloomLevel       String
  stem             String   @db.Text
  options          Json
  correctAnswer    String
  explanation      String   @db.Text
  embedding        Unsupported("vector(384)")?
  preTestIqs       Float    @default(0.85)
  isGoldStandard   Boolean  @default(true)
}

model CritiqueReport {
  id               String   @id @default(uuid())
  questionId       String
  factualScore     Float
  bloomScore       Float
  distractorScore  Float
  overallConfidence Float
  feedbackNotes    String   @db.Text
}
```

### 7. API Endpoints
* `POST /api/v1/personas`: Create/update a learner profile.
* `GET /api/v1/exemplars/search`: Query exemplar library by domain and concept vector.
* `POST /api/v1/quiz/critique-item`: Run standalone Independent Critique Agent evaluation on a draft item.

### 8. Background Jobs
* **`index-exemplars`**: Vectorizes and stores new gold-standard questions into the Exemplar Library.
* **`multi-agent-refine`**: Orchestrates Critique Agent review and targeted single-field repair cycles.

### 9. Queues
* `critique-queue`: Handles asynchronous multi-agent critique and refinement jobs.

### 10. Models Used
* **Planner & Persona Adapter**: `Claude-3.5-Haiku` / `GPT-4o-mini`.
* **Generator**: `Claude 3.5 Sonnet` / `llama-3.3-70b-versatile`.
* **Critique Agent**: `OpenAI o3-mini` / `DeepSeek-R1` (High-reasoning model).

### 11. Data Flow
1. Planner outputs `AssessmentPlan`.
2. `personaAdapter.js` combines `AssessmentPlan` + selected `LearnerProfile` $\rightarrow$ outputs `FinalAssessmentBrief`.
3. `exemplarRetriever.js` fetches 2 matching gold exemplars.
4. Generator creates candidate question $\rightarrow$ Passes AST/Sandbox validation.
5. `critiqueAgent.js` performs independent audit. If confidence $< 0.80$, `multiAgentRefiner.js` sends targeted repair prompt back to Generator (max 1 retry).
6. `preTestIqsCalculator.js` attaches initial IQS score to approved item.

### 12. Failure Recovery
* If Critique Agent fails or times out, item falls back to Pre-Test IQS calculated strictly from deterministic tool validation scores.

### 13. Observability
* Multi-agent latency tracing: Tracks time spent in Planning, Adaptation, Generation, Validation, and Critique.

### 14. Testing Strategy
* Evaluation benchmark suite comparing questions generated *with* vs *without* Persona Adaptation using automated LLM-as-a-Judge quality rubrics.

### 15. Deployment Strategy
* Deploy updated backend workers; run database migration for `LearnerProfile` and `ExemplarQuestion` tables.

### 16. Scalability Considerations
* Async execution of Critique Agent allows non-blocking queue streaming for long multi-question quizzes.

### 17. Future Extension Points
* Automated misconception extraction directly from student homework error logs.

---

# PHASE 3 — FEEDBACK & GOVERNANCE

### 1. Objectives
Implement complete administrative governance, student exam delivery, telemetry collection, teacher review interface, instructor feedback capture, post-test IQS calculation, and question versioning/lineage tracking.

### 2. Deliverables
* **Teacher Review Dashboard**: Interface for approving, editing, and rating generated questions.
* **Student Exam Delivery Engine**: Socket.io real-time quiz engine with per-question timers.
* **Telemetry Collector**: Records student option selection, time-spent-per-item, and completion rates.
* **Instructor Feedback Engine**: Captures structured teacher ratings (`"Excellent Distractors"`, `"Too Easy"`, `"Unrealistic Scenario"`, `"Bloom Incorrect"`).
* **Item Version Manager**: Tracks version history ($v1 \rightarrow v2 \rightarrow v3$) and change diffs.
* **Audit Logger**: Immutable log of all administrative and AI actions.

### 3. Folder Structure
```
server/src/
├── controllers/
│   ├── reviewController.js
│   ├── studentController.js
│   └── feedbackController.js
├── engine/
│   ├── telemetry/
│   │   └── responseCollector.js
│   ├── versioning/
│   │   └── itemVersionManager.js
│   └── audit/
│       └── auditLogger.js
client/src/pages/
├── TeacherReviewDashboard.jsx
└── StudentQuizRunner.jsx
```

### 4. Backend Components
* **Review Controller (`reviewController.js`)**: Manages teacher edits, approvals, and quality ratings.
* **Response Collector (`responseCollector.js`)**: Receives real-time student telemetry over WebSockets; aggregates choice distributions.
* **Item Version Manager (`itemVersionManager.js`)**: Creates a new immutable version record whenever a teacher edits a question stem or distractor.
* **Post-Test IQS Calculator**: Combines pre-test IQS with instructor feedback rating ($T_i$) and student completion rate ($C_i$).

### 5. Frontend Components
* **Teacher Review Dashboard (`TeacherReviewDashboard.jsx`)**: Interactive board showing questions, explainability badges, version history, and quick feedback action buttons (`Thumbs Up`, `Fix Distractor`, `Too Easy`).
* **Student Quiz Interface (`StudentQuizRunner.jsx`)**: High-performance test runner with Socket.io sync, LaTeX equation rendering (KaTeX), syntax highlighting (PrismJS), and automatic response logging.

### 6. Database Schema Additions (Prisma)
```prisma
model ItemVersion {
  id              String   @id @default(uuid())
  questionId      String
  versionNumber   Int
  stem            String   @db.Text
  options         Json
  correctAnswer   String
  explanation     String   @db.Text
  changeReason    String
  iqsScore        Float    @default(0.0)
  createdAt       DateTime @default(now())
}

model StudentResponse {
  id              String   @id @default(uuid())
  attemptId       String
  questionId      String
  selectedOption  String
  isCorrect       Boolean
  timeSpentMs     Int
  createdAt       DateTime @default(now())
}

model InstructorFeedback {
  id              String   @id @default(uuid())
  questionId      String
  teacherId       String
  ratingType      String   // "EXCELLENT_DISTRACTORS", "TOO_EASY", "UNREALISTIC", "BLOOM_INCORRECT"
  ratingValue     Int      // +1 or -1
  comments        String?
  createdAt       DateTime @default(now())
}

model AuditLog {
  id              String   @id @default(uuid())
  actorId         String
  action          String
  resourceType    String
  resourceId      String
  payload         Json?
  timestamp       DateTime @default(now())
}
```

### 7. API Endpoints
* `POST /api/v1/review/approve`: Approve question item.
* `POST /api/v1/review/edit`: Edit question stem/options (creates new `ItemVersion`).
* `POST /api/v1/feedback/rate`: Submit structured instructor feedback signal.
* `POST /api/v1/student/submit-response`: Log real-time student item answer.
* `GET /api/v1/questions/:id/versions`: Fetch complete lineage history of an item.

### 8. Background Jobs
* **`aggregate-telemetry`**: Batch job running every 15 minutes to calculate item completion rates and student accuracy distributions.

### 9. Queues
* `telemetry-queue`: High-throughput queue consuming real-time student response events.

### 10. Models Used
* Deterministic statistical analytics engine (Node.js native math operations).

### 11. Data Flow
1. Teacher reviews generated quiz on `TeacherReviewDashboard.jsx`.
2. Teacher edits Option B $\rightarrow$ `itemVersionManager.js` writes `v2` record to `ItemVersion` table and logs entry in `AuditLog`.
3. Teacher submits rating (`"Excellent Distractors"`) $\rightarrow$ updates `InstructorFeedback` table.
4. Students complete test via `StudentQuizRunner.jsx` $\rightarrow$ WebSockets push event payload to `telemetry-queue`.
5. Background worker aggregates response data and updates item completion rates.

### 12. Failure Recovery
* WebSockets auto-reconnect with local buffer storage on student client to prevent response data loss during intermittent network drops.

### 13. Observability
* Real-time metrics dashboard tracking active exam sessions, WebSocket connections, and submission throughput.

### 14. Testing Strategy
* E2E Cypress tests simulating student test execution and real-time response submission under concurrent load.

### 15. Deployment Strategy
* Deploy Socket.io sticky sessions on load balancer; apply database migration for telemetry and versioning tables.

### 16. Scalability Considerations
* Redis Pub/Sub backplane for scaling Socket.io servers across multiple instances.

### 17. Future Extension Points
* Automated Slack/Teams webhook notifications for instructors when quiz batches finish generating.

---

# PHASE 4 — CONTINUOUS OPTIMIZATION

### 1. Objectives
Close the learning loop completely by implementing Item Response Theory (2PL IRT) statistical calibration, empirical Distractor Efficiency analysis, automated Gold-Exemplar promotion, and Mixed-Integer Linear Programming (MILP) portfolio optimization via Google OR-Tools.

### 2. Deliverables
* **IRT Calibration Engine**: 2-Parameter Logistic (2PL) statistical fitting estimating latent item difficulty ($b_i$) and discrimination ($a_i$).
* **Distractor Efficiency Analyzer**: Identifies non-functional distractors (chosen by $< 5\%$ of low-performing students).
* **Automated Gold-Exemplar Promoter**: Automatically promotes questions with $\text{IQS} \ge 0.85$ to the `ExemplarLibrary`.
* **MILP Portfolio Optimizer**: Solves global portfolio utility optimization subject to concept coverage, Bloom balance, and timing constraints.

### 3. Folder Structure
```
ai_service/ (FastAPI)
├── services/
│   ├── irt_calibrator.py
│   ├── distractor_analyzer.py
│   └── portfolio_optimizer.py
server/src/engine/optimization/
└── continuousImprovement.js
```

### 4. Backend Components
* **IRT Calibrator (`irt_calibrator.py`)**: Uses Python `scikit-irt` or `PyMC3` MCMC estimation to compute item discrimination ($a_i$) and difficulty ($b_i$) from student response matrix.
* **Distractor Analyzer (`distractor_analyzer.py`)**: Computes Distractor Efficiency Index ($DE_j$) for each option. Flagged non-functional options trigger automated repair jobs.
* **Portfolio Optimizer (`portfolio_optimizer.py`)**: Solves global MILP problem using Google OR-Tools:
  $$\text{Maximize } U(P) = w_1 C(P) + w_2 B(P) + w_3 N(P) + w_4 H_L(P) + w_5 H_A(P)$$
* **Continuous Improvement Worker (`continuousImprovement.js`)**: Orchestrates item promotion, retirement of low-IQS items ($\text{IQS} < 0.50$), and exemplar library updates.

### 5. Frontend Components
* **Analytics & Calibration Hub (`ItemAnalyticsDashboard.jsx`)**: Visualizes Item Characteristic Curves (ICC), discrimination slopes ($a_i$), empirical difficulty ($b_i$), and distractor selection heatmaps.
* **Portfolio Optimization Configurator (`OptimizationSettings.jsx`)**: Allows head teachers to set optimization weights ($w_1 \dots w_5$) and maximum target test duration.

### 6. Database Schema Additions (Prisma)
```prisma
model IRTCandidateMetrics {
  id                   String   @id @default(uuid())
  questionId           String   @unique
  discriminationA      Float    @default(1.0)
  difficultyB          Float    @default(0.0)
  distractorEfficiency Float    @default(0.0)
  finalIqs             Float    @default(0.0)
  sampleSize           Int      @default(0)
  lastCalibratedAt     DateTime @default(now())
}

model PortfolioProfile {
  id                   String   @id @default(uuid())
  name                 String
  weightCoverage       Float    @default(0.25)
  weightBloom          Float    @default(0.20)
  weightNarrative      Float    @default(0.20)
  weightLexical        Float    @default(0.18)
  weightEntropy        Float    @default(0.17)
}
```

### 7. API Endpoints
* `POST /api/v1/calibration/run`: Trigger asynchronous 2PL IRT calibration batch.
* `POST /api/v1/portfolio/optimize`: Run MILP portfolio solver over candidate question pool.
* `GET /api/v1/analytics/item-icc/:questionId`: Fetch Item Characteristic Curve plotting coordinates.

### 8. Background Jobs
* **`nightly-irt-calibration`**: Cron job running every midnight to recalibrate item parameter estimates using newly accumulated student response telemetry.
* **`exemplar-promotion-audit`**: Scans calibrated items, promotes $\text{IQS} \ge 0.85$ items to `ExemplarLibrary`, and flags $\text{IQS} < 0.50$ items for automated distractor repair.

### 9. Queues
* `irt-calibration-queue`: Dedicated background processing queue for matrix statistical computations.
* `portfolio-optimization-queue`: Queue for Google OR-Tools MILP solver executions.

### 10. Models / Analytics Engines Used
* **Statistical Calibration**: Python `scikit-irt` / `scipy.optimize`.
* **Portfolio Solver**: Google OR-Tools (CBC Mixed-Integer Linear Programming solver).

### 11. Data Flow
1. Nightly cron triggers `nightly-irt-calibration` job.
2. FastAPI `irt_calibrator.py` reads student response matrix from PostgreSQL $\rightarrow$ computes $a_i$ and $b_i$.
3. `distractor_analyzer.py` calculates Distractor Efficiency scores for all choices.
4. Unified IQS score is computed and saved to `IRTCandidateMetrics`.
5. Items with $\text{IQS} \ge 0.85$ are vectorized and promoted to `ExemplarQuestion` table.
6. Future quiz generation requests in Phase 1/2 automatically retrieve these high-performing real-world exemplars.

### 12. Failure Recovery
* If numerical convergence fails during IRT MCMC fitting due to small sample size ($N < 30$), the system defaults to Classical Test Theory (CTT) item difficulty estimates ($P = N_{\text{correct}} / N_{\text{total}}$).

### 13. Observability
* System-wide Item Health Monitor tracking the distribution of IQS scores across the entire question bank.

### 14. Testing Strategy
* Synthetic student response simulation test suite verifying that IRT calibrator correctly recovers true difficulty ($b_i$) and discrimination ($a_i$) parameters from simulated 1,000-student response matrices.

### 15. Deployment Strategy
* Deploy updated FastAPI container with Google OR-Tools binaries; initialize nightly Redis cron triggers.

### 16. Scalability Considerations
* Matrix operations offloaded to FastAPI Python worker process; results cached in Redis for fast read access by the portfolio assembler.

### 17. Future Extension Points
* Adaptive Computerized Testing (CAT): Real-time selection of next question during exam based on live estimate of student ability $\hat{\theta}$.

---

## Unified System Technology Stack

| Layer | Technology Selected | Purpose / Function |
| :--- | :--- | :--- |
| **App Backend** | Node.js / Express | REST API, Job Dispatching, System Orchestration |
| **Real-Time Engine** | Socket.io | Live Quiz Sync, Real-Time Student Telemetry |
| **AI & Analytics Services** | FastAPI (Python 3.11) | Embeddings, AST Parsing, SymPy, IRT, MILP Solver |
| **Primary Database** | PostgreSQL 16 | Relational Storage + Vector Indexing |
| **Vector Extension** | pgvector | Dense Vector HNSW Cosine Similarity Indexing |
| **ORM** | Prisma | Type-Safe Database Schema & Migrations |
| **Job Queue & Cache** | Redis 7 + BullMQ | Asynchronous Distributed Queue Processing |
| **OCR Engine** | Tesseract OCR | Image / Handwritten Scan Document Parsing |
| **Embeddings** | `sentence-transformers` | 384-dimensional Dense Vector Generation |
| **Optimization Solver** | Google OR-Tools | Mixed-Integer Linear Programming (MILP) |
| **Statistical Engine** | `scikit-irt` / `scipy` | 2-Parameter Logistic (2PL) IRT Parameter Estimation |
