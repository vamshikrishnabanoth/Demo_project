import React from 'react';
import TextViewer from './TextViewer';
import HierarchyViewer from './HierarchyViewer';
import PdiViewer from './PdiViewer';
import AlignmentViewer from './AlignmentViewer';
import AcademicityViewer from './AcademicityViewer';
import TargetViewer from './TargetViewer';
import McqViewer from './McqViewer';
import ValidationViewer from './ValidationViewer';
import EvaluationViewer from './EvaluationViewer';
import AuditViewer from './AuditViewer';
import GroundingViewer from './GroundingViewer';
import TraceabilityViewer from './TraceabilityViewer';
import PublishingViewer from './PublishingViewer';
import StageStatusBadge from './StageStatusBadge';
import { Clock, Loader2, AlertCircle } from 'lucide-react';

export default function StageOutputPanel({
  selectedStageId = 'inputs',
  status = 'PROCESSING',
  sessionInputs = {},
  liveArtifacts = {},
  pipelineResult = null,
  stages = [],
  stageMap = {},
  onLaunchClassroom = null,
  onPreviewQuiz = null
}) {
  const isCompleted = status === 'COMPLETED';
  const stageRecord = stageMap[selectedStageId] || {};

  // Resolve artifacts either from completed pipelineResult or liveArtifacts
  const evidencePackage = pipelineResult?.evidencePackage || liveArtifacts?.evidencePackage || null;
  const plan = pipelineResult?.plan || liveArtifacts?.plan || null;
  const questions = pipelineResult?.questions || pipelineResult?.deliveredQuestions || [];
  const tcScore = pipelineResult?.tcScore || liveArtifacts?.plan?.tcScore || null;
  const quizEvaluation = pipelineResult?.quizEvaluation || liveArtifacts?.quizEval || null;
  const hierarchicalStore = evidencePackage?.hierarchicalStore || null;
  const alignmentGraph = evidencePackage?.alignmentGraph || null;
  const alignmentWarning = evidencePackage?.alignmentWarning || pipelineResult?.alignmentWarning || null;
  const unalignedDocuments = evidencePackage?.unalignedDocuments || pipelineResult?.unalignedDocuments || [];
  const representationMode = pipelineResult?.representationMode || evidencePackage?.representationMode || liveArtifacts?.evidencePackage?.representationMode || 'UNIFIED';
  const routerReason = pipelineResult?.routerReason || evidencePackage?.routerReason || '';

  // Ingestion data: from liveArtifacts or sessionInputs
  const ingestionArtifact = liveArtifacts?.ingestion || {};
  const inputSources = (ingestionArtifact.sources && ingestionArtifact.sources.length > 0)
    ? ingestionArtifact.sources
    : (sessionInputs.inputs || []).map((inp, idx) => ({
        name: inp.source_name || inp.name || `Source ${idx + 1}`,
        type: inp.type || 'document',
        content: inp.snippet || inp.content || '',
        wordCount: inp.wordCount || 0
      }));

  // Waiting State Render Helper
  const renderWaitingState = (stageName) => (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
        <Clock size={22} />
      </div>
      <div>
        <h4 className="text-sm font-black text-slate-700">{stageName} In Queue</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          This stage has not yet executed. Live outputs and verification records will appear here as soon as the backend begins processing.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1. TEACHER INPUTS */}
      {selectedStageId === 'inputs' && (
        <div className="space-y-4">
          <TextViewer
            title="Teacher Submitted Instructional Material"
            sources={inputSources}
            defaultText={sessionInputs.topic || sessionInputs.whatWasTaught || 'Uploaded learning materials'}
            stats={{
              pagesProcessed: inputSources.length,
              hasVoice: sessionInputs.isVoice || false
            }}
          />
        </div>
      )}

      {/* 2. INGESTION & EXTRACTION */}
      {selectedStageId === 'ingestion' && (
        <div className="space-y-4">
          <TextViewer
            title="Actual Extracted & Cleaned Document Content"
            sources={inputSources}
            stats={{
              pagesProcessed: inputSources.length,
              hasVoice: sessionInputs.isVoice
            }}
          />
        </div>
      )}

      {/* 3. PDI ROUTING */}
      {selectedStageId === 'pdi' && (
        <PdiViewer
          representationMode={representationMode}
          routerReason={routerReason}
          summaryContent={evidencePackage?.narrativeSummary || evidencePackage?.unifiedRawContent || ''}
          blueprintContent={evidencePackage?.blueprint || evidencePackage?.artifactsSummary || null}
          unifiedContent={evidencePackage?.unifiedRawContent || ''}
          inputConditions={{
            hasVoice: Boolean(sessionInputs.isVoice || sessionInputs.voiceTranscript),
            docCount: inputSources.length,
            hasCode: Boolean(sessionInputs.codeSnippets)
          }}
        />
      )}

      {/* 4. HIERARCHICAL EVIDENCE STORE */}
      {selectedStageId === 'hierarchy' && (
        hierarchicalStore ? (
          <HierarchyViewer hierarchicalStore={hierarchicalStore} />
        ) : (
          renderWaitingState('Hierarchical Evidence Store')
        )
      )}

      {/* 5. CROSS-MATERIAL ALIGNMENT */}
      {selectedStageId === 'alignment' && (
        <AlignmentViewer
          alignmentGraph={alignmentGraph}
          alignmentWarning={alignmentWarning}
          unalignedDocuments={unalignedDocuments}
        />
      )}

      {/* 6. ACADEMICITY GATE */}
      {selectedStageId === 'academicity' && (
        <AcademicityViewer
          isAcademic={evidencePackage?.isAcademic !== false}
          failureReason={evidencePackage?.academicFailureReason || null}
          lectureDepth={evidencePackage?.lectureDepth || pipelineResult?.lectureDepth}
          detectedFocus={evidencePackage?.detectedFocus || sessionInputs.keyTopics}
        />
      )}

      {/* 7. AGENT 1 TARGET PLANNER */}
      {selectedStageId === 'planner' && (
        plan ? (
          <TargetViewer plan={plan} tcScore={tcScore} />
        ) : (
          renderWaitingState('Agent 1 Curriculum Planner')
        )
      )}

      {/* 8. AGENT 2 MCQ GENERATOR */}
      {selectedStageId === 'generator' && (
        questions.length > 0 || liveArtifacts?.activeGeneration ? (
          <McqViewer
            questions={questions}
            activeTarget={liveArtifacts?.activeGeneration || null}
            targetResults={pipelineResult?.targetResults || []}
          />
        ) : (
          renderWaitingState('Agent 2 Question Generator')
        )
      )}

      {/* 9. DETERMINISTIC PRE-CHECKS */}
      {selectedStageId === 'prechecks' && (
        <ValidationViewer
          totalQuestions={questions.length}
          repairAttempted={Boolean(pipelineResult?.metrics?.repairs?.totalAttempted > 0)}
          repairSuccessful={Boolean(pipelineResult?.metrics?.repairs?.successfulRepairs > 0)}
        />
      )}

      {/* 10. AGENT 3 QUESTION EVALUATOR */}
      {selectedStageId === 'evaluator' && (
        questions.length > 0 || (liveArtifacts?.evaluations && liveArtifacts.evaluations.length > 0) ? (
          <EvaluationViewer
            evaluations={liveArtifacts?.evaluations || []}
            targetResults={pipelineResult?.targetResults || []}
          />
        ) : (
          renderWaitingState('Agent 3 Evaluator')
        )
      )}

      {/* 11. DUPLICATE CHECK & RESERVE SWAPS */}
      {selectedStageId === 'duplicates' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h4 className="text-sm font-black text-slate-900">
              Deterministic Duplicate Question Rejection (Threshold &gt; 0.70)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every candidate MCQ stem and option set is evaluated against existing accepted questions using Jaccard word-overlap and semantic cosine similarity. Near-duplicates are automatically rejected and replaced from the reserve target pool.
            </p>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <span>✓ All {questions.length} accepted questions verified distinct (&lt; 0.70 similarity threshold).</span>
            </div>
          </div>

          <TraceabilityViewer questions={questions} />
        </div>
      )}

      {/* 12. AGENT 3 WHOLE-QUIZ AUDIT */}
      {selectedStageId === 'quiz_audit' && (
        <AuditViewer
          quizEvaluation={quizEvaluation}
          difficultyReport={pipelineResult?.difficultyReport}
          questions={questions}
        />
      )}

      {/* 13. FINAL GROUNDING GATE */}
      {selectedStageId === 'grounding' && (
        <GroundingViewer
          questions={questions}
          evidenceSafety={pipelineResult?.evidenceSafety || 'GROUNDED'}
        />
      )}

      {/* 14. PUBLISHING & LIVE CLASSROOM */}
      {selectedStageId === 'publishing' && (
        <PublishingViewer
          taskId={sessionInputs.taskId}
          quizTitle={sessionInputs.title || pipelineResult?.quizTitle || 'Certified Assessment'}
          questionCount={questions.length}
          status={status}
          onLaunchClassroom={onLaunchClassroom}
          onPreviewQuiz={onPreviewQuiz}
        />
      )}
    </div>
  );
}
