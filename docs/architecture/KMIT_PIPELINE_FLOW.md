# KMIT Kahoot — Pipeline Visual Execution Flow

This document provides a concise, high-visibility visual reference for the end-to-end execution lifecycle of KMIT Kahoot.

---

## 1. End-to-End Visual Execution Flowchart

```mermaid
flowchart TD
    %% Styling
    classDef teacher fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef engine fill:#ede7f6,stroke:#512da8,stroke-width:2px;
    classDef agent fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef gate fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef student fill:#fce4ec,stroke:#c2185b,stroke-width:2px;
    classDef db fill:#f5f5f5,stroke:#424242,stroke-width:2px;

    %% Ingestion
    subgraph S1["Phase 1: Multi-Modal Ingestion"]
        T1["Teacher Submits Audio & Slides"]:::teacher --> I1["sourceService.extractTextFromFile()"]:::engine
        I1 --> I2["evidencePackager.packageSessionEvidence()"]:::engine
        I2 --> I3["Hierarchical Chunking (75w / 400w)"]:::engine
        I2 --> I4["Bidirectional Semantic Alignment Graph"]:::engine
        I2 --> I5["depthAnalyzer (CEP 2.0.0 Gates)"]:::gate
        I2 --> I6["lectureIntelligence.extractTeachingUnits()"]:::engine
    end

    %% Planning
    subgraph S2["Phase 2: Planning & Blueprinting"]
        I5 & I6 --> P1["agent1Planner.planAssessment()"]:::agent
        P1 --> P2["2D LCACM Capacity Audit"]:::gate
        P2 --> P3["Blueprint: Primary N Targets + Reserve M Pool"]:::agent
    end

    %% Question Generation & Evaluation Loop
    subgraph S3["Phase 3: Generation & Bounded Repair"]
        P3 --> G1["agent2Generator.generateQuestionForTarget()"]:::agent
        G1 --> E1{"agent3Evaluator.evaluateSingleQuestion()"}:::gate
        E1 -- "REJECT (Attempt 1)" --> R1["agent2Generator.repairQuestion()"]:::agent
        R1 --> E2{"Re-Evaluation"}:::gate
        E2 -- "FAIL" --> FB["Promote Reserve Target (R01..RM)"]:::agent
        FB --> G1
        E1 -- "PASS" --> D1["Deduplication Audit (Jaccard < 0.70)"]:::gate
        E2 -- "PASS" --> D1
    end

    %% Final Release Gates
    subgraph S4["Phase 4: Integrity & Grounding Gates"]
        D1 --> V1["deterministicValidator (4 distinct options, valid key)"]:::gate
        V1 --> G2["groundingGate (Strict token overlap & anchor verification)"]:::gate
        G2 --> PO["pipelineOrchestrator compiles final payload"]:::engine
    end

    %% Publishing & Student Exam
    subgraph S5["Phase 5: Publishing & Student Execution"]
        PO --> DB1[("PostgreSQL Quiz Record (isLocked, PIN, Hash)")]:::db
        DB1 --> ST1["Student Enters 6-Digit PIN (/api/quiz/join)"]:::student
        ST1 --> ST2["Question Delivery (/api/quiz/:id - Redacted Keys)"]:::student
        ST2 --> ST3["Student Submits Answers (/api/quiz/submit)"]:::student
        ST3 --> GR["Server-Side grading.gradeAnswer()"]:::engine
        GR --> DB2[("PostgreSQL Result Record (Score, Graded Answers)")]:::db
        DB2 --> ST4["Student Review & Real-Time Leaderboard"]:::student
    end
```

---

## 2. Detailed Multi-Agent Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher
    participant Controller as quizController
    participant Orch as pipelineOrchestrator
    participant EvPack as evidencePackager / depthAnalyzer
    participant A1 as Agent 1 (Planner)
    participant A2 as Agent 2 (Generator)
    participant A3 as Agent 3 (Evaluator)
    participant Gates as Grounding & Quality Gates
    participant DB as Supabase PostgreSQL
    actor Student as Student

    %% Ingestion
    Teacher->>Controller: POST /api/quiz/generate-voice (Audio + PDF)
    Controller->>Orch: runPipeline(sessionInputs)
    Orch->>EvPack: packageSessionEvidence() + evaluateLectureDepth()
    EvPack-->>Orch: evidencePackage + CurricularEvidenceProfile (CEP 2.0.0)

    %% Planning
    Orch->>A1: planAssessment(evidencePackage, requestedDifficulty, N)
    Note over A1: 2D LCACM Capacity Audit<br/>Reallocates ungrounded Hard slots to Medium
    A1-->>Orch: AssessmentPlan (N Primary Targets + M Reserve Pool)

    %% Generation Loop
    loop For Each Target
        Orch->>A2: generateQuestionForTarget(target, evidence)
        A2-->>Orch: candidateMCQ (stem, 4 options, key)
        Orch->>A3: evaluateSingleQuestion(candidateMCQ, target)
        alt Passed Quality Check
            A3-->>Orch: PASS (Question accepted)
        else Ambiguous or Distractor Defect (Bounded 1-Repair)
            A3-->>Orch: REJECT + specific repair feedback
            Orch->>A2: repairQuestion(candidateMCQ, feedback)
            A2-->>Orch: repairedCandidate
            Orch->>A3: evaluateSingleQuestion(repairedCandidate)
            alt Repaired Question Passes
                A3-->>Orch: PASS
            else Repaired Question Fails
                A3-->>Orch: REJECT
                Note over Orch: Promote next target from Reserve Pool (R01..RM)
            end
        end
    end

    %% Verification & Delivery
    Orch->>Gates: validateFinalQuestions() & verifyFinalQuestions()
    Gates-->>Orch: Grounded & Validated Set (N Questions)
    Orch-->>Controller: PipelineResult (questions, telemetry, CEP)

    %% Publishing
    Controller->>DB: prisma.quiz.create({ joinCode: "849201", questions, isLocked: true })
    DB-->>Controller: Quiz Created (b37c14a6...)
    Controller-->>Teacher: Quiz Ready & Live PIN (849201)

    %% Student Workflow
    Student->>Controller: POST /api/quiz/join { code: "849201" }
    Controller->>DB: Verify code, active status & targeting
    Controller-->>Student: 200 OK (quizId)

    Student->>Controller: GET /api/quiz/b37c14a6...
    Note over Controller: Anti-Cheat: Redacts correctAnswer & explanation
    Controller-->>Student: 6 Questions (safe options only)

    Student->>Controller: POST /api/quiz/submit { answers }
    Note over Controller: Server-Side Grading via gradeAnswer()
    Controller->>DB: prisma.result.upsert({ score: 50, answers: gradedDetails })
    DB-->>Controller: Persisted Result (f7e01dd9...)
    Controller-->>Student: 200 OK (Score: 50/60, Breakdown)
```

---

## 3. Data Transformations Between Stages

| Transition Point | Producer | Consumer | Data Payload Structure |
|:---|:---|:---|:---|
| **Stage 01 $\rightarrow$ 02** | `sourceService` | `evidencePackager` | `{ voiceTranscript: string, documentTexts: string[], codeSnippets: string }` |
| **Stage 02 $\rightarrow$ 05** | `depthAnalyzer` | `pipelineOrchestrator` | `curricularEvidenceProfile` (prerequisiteGates, observableEvidence, assessmentCapacity) |
| **Stage 05 $\rightarrow$ 06** | `pipelineOrchestrator` | `agent1Planner` | `evidencePackage` + `{ requestedCount: 6, requestedDifficulty: "Balanced" }` |
| **Stage 06 $\rightarrow$ 08** | `agent1Planner` | `agent2Generator` | `target` (`targetId`, `concept`, `intendedCognitiveOperation`, `targetDifficulty`, `evidenceAnchor`) |
| **Stage 08 $\rightarrow$ 09** | `agent2Generator` | `agent3Evaluator` | `candidate` (`questionText`, `options[4]`, `correctAnswer`, `explanation`, `metadata`) |
| **Stage 09 $\rightarrow$ 11** | `agent3Evaluator` | `groundingGate` | `passingQuestions[]` (verified MCQs + target linkages) |
| **Stage 11 $\rightarrow$ 12** | `pipelineOrchestrator` | `quizController` | `pipelineResult` (`questions[]`, `difficultyReport`, `capacityDeficitReport`, `trace`) |
| **Stage 12 $\rightarrow$ 15** | `quizController` | `prisma.result` | `Result` record (`score`, `totalQuestions`, `answers[]`, `status: "completed"`) |
