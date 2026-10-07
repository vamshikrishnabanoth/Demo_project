import React from 'react';
import PipelineStage from './PipelineStage';
import {
  FileText, ScanText, GitBranch, Network, Link2, GraduationCap,
  Target, Bot, Filter, ShieldCheck, CopyCheck, RefreshCw,
  Scale, Shuffle, Rocket, PackageCheck
} from 'lucide-react';

export const STAGE_DEFINITIONS = [
  {
    id: 'inputs',
    order: '01',
    name: 'Teacher Inputs',
    subtitle: 'Uploaded materials & parameters',
    icon: FileText,
    backendStage: 'INPUTS'
  },
  {
    id: 'ingestion',
    order: '02',
    name: 'Ingestion & Extraction',
    subtitle: 'OCR, text, speech transcription',
    icon: ScanText,
    backendStage: 'INGESTION'
  },
  {
    id: 'pdi',
    order: '02B',
    name: 'PDI Representation Router',
    subtitle: 'SUMMARY / BLUEPRINT / UNIFIED',
    icon: GitBranch,
    backendStage: 'EVIDENCE_PACKAGE'
  },
  {
    id: 'hierarchy',
    order: '02C',
    name: 'Hierarchical Evidence Store',
    subtitle: 'Parent (400w) & Child (75w) windows',
    icon: Network,
    backendStage: 'EVIDENCE_PACKAGE'
  },
  {
    id: 'alignment',
    order: '02D',
    name: 'Cross-Material Alignment',
    subtitle: 'Voice-to-document semantic graph',
    icon: Link2,
    backendStage: 'EVIDENCE_PACKAGE'
  },
  {
    id: 'academicity',
    order: '03',
    name: 'Academicity Gate',
    subtitle: 'Curricular depth & syllabus verify',
    icon: GraduationCap,
    backendStage: 'EVIDENCE_PACKAGE'
  },
  {
    id: 'planner',
    order: '04',
    name: 'Agent 1: Target Planner',
    subtitle: 'Primary targets & TC coverage score',
    icon: Target,
    backendStage: 'AGENT_1_PLANNING'
  },
  {
    id: 'generator',
    order: '05',
    name: 'Agent 2: MCQ Generator',
    subtitle: 'Draft questions & tiered distractors',
    icon: Bot,
    backendStage: 'QUESTION_GENERATION'
  },
  {
    id: 'prechecks',
    order: '06',
    name: 'Deterministic Pre-Checks',
    subtitle: 'Option cardinality & schema rules',
    icon: Filter,
    backendStage: 'VALIDATING_QUESTIONS'
  },
  {
    id: 'evaluator',
    order: '07',
    name: 'Agent 3: Question Evaluator',
    subtitle: 'Derivability & student answerability',
    icon: ShieldCheck,
    backendStage: 'AGENT_3_QUESTION_EVAL'
  },
  {
    id: 'duplicates',
    order: '08',
    name: 'Duplicate Check & Reserve Swaps',
    subtitle: 'Jaccard deduplication & backup pool',
    icon: CopyCheck,
    backendStage: 'DETERMINISTIC_DUPLICATE_CHECK'
  },
  {
    id: 'quiz_audit',
    order: '09',
    name: 'Agent 3: Whole-Quiz Audit',
    subtitle: 'Bloom diversity & curriculum balance',
    icon: Scale,
    backendStage: 'AGENT_3_QUIZ_EVAL'
  },
  {
    id: 'grounding',
    order: '10',
    name: 'Final Grounding Gate',
    subtitle: 'Foreign contamination barrier',
    icon: ShieldCheck,
    backendStage: 'FINAL_GROUNDING_GATE'
  },
  {
    id: 'publishing',
    order: '11',
    name: 'Publishing & Live Classroom',
    subtitle: 'SHA-256 seal & live broadcast',
    icon: PackageCheck,
    backendStage: 'COMPLETED'
  }
];

export default function PipelineTimeline({
  stagesData = {},
  selectedStageId = 'inputs',
  onSelectStage = () => {},
  pipelineStatus = 'PROCESSING',
  currentBackendStage = 'INGESTION',
  className = ''
}) {
  /**
   * Determine status of each stage in the timeline:
   * WAITING | PROCESSING | COMPLETED | FAILED
   */
  const getStageStatus = (stage) => {
    if (pipelineStatus === 'COMPLETED') return 'COMPLETED';
    if (pipelineStatus === 'FAILED') {
      if (stagesData[stage.id]?.error) return 'FAILED';
    }

    // Check if stage has data recorded
    const stageRecord = stagesData[stage.id];
    if (stageRecord?.isCompleted || stageRecord?.status === 'PASS' || stageRecord?.status === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (stageRecord?.isActive || stageRecord?.status === 'PROCESSING') {
      return 'PROCESSING';
    }

    // Map backend stage progression
    const orderIndex = STAGE_DEFINITIONS.findIndex(s => s.id === stage.id);
    const activeStageIndex = STAGE_DEFINITIONS.findIndex(s => s.backendStage === currentBackendStage);

    if (activeStageIndex === -1) {
      return orderIndex === 0 ? 'PROCESSING' : 'WAITING';
    }

    if (orderIndex < activeStageIndex) return 'COMPLETED';
    if (orderIndex === activeStageIndex) return 'PROCESSING';
    return 'WAITING';
  };

  return (
    <div className={`space-y-2 relative ${className}`}>
      {STAGE_DEFINITIONS.map((stage, idx) => {
        const stageStatus = getStageStatus(stage);
        const isSelected = selectedStageId === stage.id;
        const stageRecord = stagesData[stage.id];

        return (
          <div key={stage.id} className="relative">
            {/* Connecting line */}
            {idx < STAGE_DEFINITIONS.length - 1 && (
              <div
                className={`absolute left-7 top-10 bottom-[-8px] w-0.5 z-0 transition-colors ${
                  stageStatus === 'COMPLETED' ? 'bg-emerald-300' : 'bg-slate-200'
                }`}
              />
            )}

            <div className="relative z-10">
              <PipelineStage
                order={stage.order}
                name={stage.name}
                subtitle={stage.subtitle}
                status={stageStatus}
                summary={stageRecord?.summary || null}
                durationMs={stageRecord?.durationMs || null}
                icon={stage.icon}
                isSelected={isSelected}
                onClick={() => onSelectStage(stage.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
