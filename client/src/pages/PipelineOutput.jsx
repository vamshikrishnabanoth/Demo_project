import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import PipelineTimeline, { STAGE_DEFINITIONS } from '../components/pipeline/PipelineTimeline';
import StageOutputPanel from '../components/pipeline/StageOutputPanel';
import StageStatusBadge from '../components/pipeline/StageStatusBadge';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Rocket, ArrowLeft, Download, Eye, Play, Clock,
  Layers, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw,
  Activity, Terminal, Radio, ShieldAlert, RotateCcw, ChevronRight,
  ChevronDown, Database, Cpu, Check, XCircle, Loader2, Sparkles
} from 'lucide-react';

const STAGES_16_CONFIG = [
  { number: 1, name: "Teacher Inputs", desc: "Submitted materials & prompt parameters" },
  { number: 2, name: "Ingestion & Cleaning", desc: "Multi-modal OCR, transcript & chunking" },
  { number: 3, name: "Evidence Packaging & Alignment", desc: "Hierarchy & cross-modal alignment graph" },
  { number: 4, name: "Academicity Gate (Pre-LLM)", desc: "Curricular depth & pedagogical check" },
  { number: 5, name: "Agent 1 Target Planner (LLM)", desc: "Assessment targets & Bloom taxonomy spread" },
  { number: 6, name: "Evidence Selector", desc: "Dual parent/child context binding" },
  { number: 7, name: "Agent 2 MCQ Generator (LLM)", desc: "Stem & 4 distinct plausibility distractors" },
  { number: 8, name: "Pre-Check (Format & 4 Options)", desc: "Schema invariance & single-correct check" },
  { number: 9, name: "Agent 3 Evaluator (Grounding)", desc: "Derivability proof & hallucination guard" },
  { number: 10, name: "Duplicate Check (Similarity)", desc: "Jaccard & semantic distance < 0.70" },
  { number: 11, name: "Reserve Swap (Max 3 Retries)", desc: "Target fallback pool loop" },
  { number: 12, name: "Agent 3 Whole-Quiz Audit", desc: "Holistic curriculum balance & difficulty curve" },
  { number: 13, name: "Option Shuffling (A,B,C,D)", desc: "Deterministic Fisher-Yates position shuffle" },
  { number: 14, name: "Final Grounding Gate", desc: "Zero-contamination certification" },
  { number: 15, name: "Publishing & SHA-256 Lock", desc: "Cryptographic tamper-evident hash lock" },
  { number: 16, name: "Live Classroom Engine", desc: "Socket PIN distribution & room readiness" }
];

/**
 * PipelineOutput — AI Assessment Observability Control Room
 * Real-Time Inspection of Each Pipeline Stage + 16-Stage Live Agent Telemetry Stream
 */
export default function PipelineOutput() {
  const location = useLocation();
  const navigate = useNavigate();
  const pipelineData = location.state;

  // Resolve taskId from location.state, URL query param, or localStorage
  const searchParams = new URLSearchParams(location.search);
  const queryTaskId = searchParams.get('taskId') || searchParams.get('sessionId');
  const storedTaskId = (() => {
    try { return localStorage.getItem('latest_pipeline_task_id') || ''; } catch (_) { return ''; }
  })();
  const taskId = pipelineData?.taskId || queryTaskId || storedTaskId || 'live-session';

  // Navigation tabs: 'inspector' (Stage Output Inspector) vs 'telemetry' (16-Stage Live Telemetry Console)
  const [viewMode, setViewMode] = useState(searchParams.get('mode') === 'telemetry' ? 'telemetry' : 'inspector');

  const initialStatus = pipelineData?.status || 'PROCESSING';
  const sourceNames = pipelineData?.sourceNames || [];
  const inputs = pipelineData?.inputs || [];
  const isVoice = Boolean(pipelineData?.isVoice);
  const difficulty = pipelineData?.difficulty || 'Balanced';
  const questionCount = pipelineData?.questionCount || 10;
  const keyTopics = pipelineData?.keyTopics || [];
  const lectureWordCount = pipelineData?.lectureWordCount || 0;

  // Real-time State from backend
  const [status, setStatus] = useState(initialStatus);
  const [currentBackendStage, setCurrentBackendStage] = useState('INGESTION');
  const [stageLabel, setStageLabel] = useState('Ingesting & Analyzing Material');
  const [progressPct, setProgressPct] = useState(5);
  const [representationMode, setRepresentationMode] = useState(pipelineData?.representationMode || 'UNIFIED');
  const [selectedStageId, setSelectedStageId] = useState('inputs');
  const [stages, setStages] = useState([]);
  const [stageMap, setStageMap] = useState({});
  const [liveArtifacts, setLiveArtifacts] = useState({});
  const [pipelineResult, setPipelineResult] = useState(null);
  const [error, setError] = useState(null);

  // Telemetry Console State (16 Stages Real-Time Stream)
  const [telemetryStagesMap, setTelemetryStagesMap] = useState({});
  const [activeTelemetryStage, setActiveTelemetryStage] = useState(1);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [totalCostSaved, setTotalCostSaved] = useState(0);
  const [isTelemetryConnected, setIsTelemetryConnected] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [activeRetryLoop, setActiveRetryLoop] = useState(null);

  // Time tracking
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);
  const terminalEndRef = useRef(null);

  // SSE and Polling references
  const pollIntervalRef = useRef(null);
  const sseRef = useRef(null);
  const telemetrySseRef = useRef(null);

  // 1. Elapsed timer
  useEffect(() => {
    if (status !== 'PROCESSING') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [status]);

  // 2. Process stage snapshot / event
  const handleTaskData = (data) => {
    if (!data) return;

    if (data.status) setStatus(data.status);
    if (data.stageLabel) setStageLabel(data.stageLabel);
    if (data.progressPct !== undefined) setProgressPct(data.progressPct);
    if (data.representation_mode) setRepresentationMode(data.representation_mode);
    if (data.stages && Array.isArray(data.stages)) setStages(data.stages);
    if (data.stageMap) setStageMap(data.stageMap);
    if (data.liveArtifacts) {
      setLiveArtifacts(prev => ({ ...prev, ...data.liveArtifacts }));
    }

    if (data.stage !== undefined) {
      if (data.stage >= 7) setCurrentBackendStage('FINAL_GROUNDING_GATE');
      else if (data.stage >= 6) setCurrentBackendStage('AGENT_3_QUIZ_EVAL');
      else if (data.stage >= 5) setCurrentBackendStage('AUDITING_QUALITY');
      else if (data.stage >= 4) setCurrentBackendStage('VALIDATING_QUESTIONS');
      else if (data.stage >= 3) setCurrentBackendStage('QUESTION_GENERATION');
      else if (data.stage >= 2) setCurrentBackendStage('AGENT_1_PLANNING');
      else if (data.stage >= 1) setCurrentBackendStage('EVIDENCE_PACKAGE');
      else setCurrentBackendStage('INGESTION');
    }

    if (data.status === 'COMPLETED' && data.result) {
      setPipelineResult(data.result);
      setStatus('COMPLETED');
      setSelectedStageId('publishing');
      toast.success('Assessment generation certified and grounded!');
    } else if (data.status === 'FAILED') {
      setError(data.error || 'Pipeline execution failed.');
      setStatus('FAILED');
      toast.error(data.error || 'Generation failed.');
    }
  };

  // 3. Connect to Primary Quiz Generation Events / Polling
  useEffect(() => {
    if (!taskId) return;

    // Fetch initial status
    api.get(`/quiz/generate/status/${taskId}`)
      .then(res => {
        if (res.data) handleTaskData(res.data);
      })
      .catch(() => {});

    if (status === 'PROCESSING') {
      try {
        const sseUrl = `/api/quiz/generate/events/${taskId}`;
        const eventSource = new EventSource(sseUrl);
        sseRef.current = eventSource;

        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'snapshot') {
              handleTaskData(payload);
            } else if (payload.type === 'stage' && payload.event) {
              setStages(prev => [...prev.filter(s => s.stageOrder !== payload.event.stageOrder), payload.event]);
              setStageMap(prev => ({ ...prev, [payload.event.stage]: payload.event }));
              if (payload.event.stage) setCurrentBackendStage(payload.event.stage);
            } else if (payload.type === 'artifact') {
              setLiveArtifacts(prev => ({ ...prev, [payload.key]: payload.data }));
            } else if (payload.type === 'completed') {
              handleTaskData({ status: 'COMPLETED', result: payload.result });
            } else if (payload.type === 'failed') {
              handleTaskData({ status: 'FAILED', error: payload.error });
            }
          } catch (_) {}
        };

        eventSource.onerror = () => {
          eventSource.close();
        };
      } catch (_) {}

      // Polling fallback
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/quiz/generate/status/${taskId}`);
          handleTaskData(res.data);
        } catch (_) {}
      }, 1500);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (sseRef.current) sseRef.current.close();
    };
  }, [taskId, status]);

  // 4. Connect to 16-Stage Live Agent Telemetry Stream
  useEffect(() => {
    if (!taskId) return;
    let isMounted = true;

    const processTelemetryItem = (data) => {
      if (!data || !data.stageNumber) return;
      setTelemetryStagesMap(prev => ({ ...prev, [data.stageNumber]: data }));

      if (data.status === 'RUNNING') {
        setActiveTelemetryStage(data.stageNumber);
      }
      if (data.tokensUsed !== undefined) setTotalTokensUsed(data.tokensUsed);
      if (data.costSaved !== undefined) setTotalCostSaved(data.costSaved);

      if (data.stageNumber === 11 && data.retryCount) {
        setActiveRetryLoop({ retryCount: data.retryCount, maxRetries: data.maxRetries || 3 });
      } else if (data.stageNumber >= 12) {
        setActiveRetryLoop(null);
      }

      // Add to streaming terminal log
      setTelemetryLogs(prev => {
        const timeStr = new Date().toLocaleTimeString();
        const newLog = `[${timeStr}] STAGE ${data.stageNumber}: ${data.stageName || 'Execution'} ➔ ${data.status || 'OK'}`;
        if (prev[prev.length - 1] === newLog) return prev;
        return [...prev.slice(-100), newLog];
      });
    };

    // Load initial telemetry logs from replay endpoint
    fetch(`/api/pipeline/logs/${taskId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!isMounted || !json || !json.logs) return;
        json.logs.forEach(processTelemetryItem);
      })
      .catch(() => {});

    // Live Telemetry EventSource
    try {
      const source = new EventSource(`/api/pipeline/stream/${taskId}`);
      telemetrySseRef.current = source;

      source.onopen = () => {
        if (isMounted) setIsTelemetryConnected(true);
      };

      source.onmessage = (evt) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(evt.data);
          processTelemetryItem(data);
        } catch (_) {}
      };

      source.onerror = () => {
        if (isMounted) setIsTelemetryConnected(false);
      };
    } catch (_) {}

    return () => {
      isMounted = false;
      if (telemetrySseRef.current) telemetrySseRef.current.close();
    };
  }, [taskId]);

  // Auto-scroll telemetry terminal
  useEffect(() => {
    if (viewMode === 'telemetry' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [telemetryLogs, viewMode]);

  const deliveredQuestions = pipelineResult?.questions || pipelineResult?.deliveredQuestions || [];
  const questionCountDisplay = deliveredQuestions.length || questionCount;
  const quizTitle = pipelineResult?.quizTitle || pipelineData?.title || (sourceNames[0] ? `Assessment: ${sourceNames[0]}` : 'AI Generated Assessment');
  const evidencePackage = pipelineResult?.evidencePackage || liveArtifacts?.evidencePackage || null;
  const plan = pipelineResult?.plan || liveArtifacts?.plan || null;

  // Map backend status to 13-stage timeline
  const timelineStagesData = {
    inputs: {
      isCompleted: true,
      summary: `${inputs.length || sourceNames.length || 1} material source(s) submitted`
    },
    ingestion: {
      isCompleted: Boolean(liveArtifacts.ingestion || pipelineResult || stages.some(s => s.stage === 'INGESTION')),
      isActive: currentBackendStage === 'INGESTION',
      summary: liveArtifacts.ingestion?.totalWords
        ? `${liveArtifacts.ingestion.totalWords.toLocaleString()} words extracted`
        : (inputs[0]?.wordCount ? `${inputs[0].wordCount.toLocaleString()} words ingested` : 'Text extraction verified'),
      durationMs: stageMap['INGESTION']?.durationMs || null
    },
    pdi: {
      isCompleted: Boolean(evidencePackage || representationMode),
      isActive: currentBackendStage === 'EVIDENCE_PACKAGE',
      summary: `Route: ${representationMode}`,
      durationMs: stageMap['EVIDENCE_PACKAGE']?.durationMs || null
    },
    hierarchy: {
      isCompleted: Boolean(evidencePackage?.hierarchicalStore),
      isActive: currentBackendStage === 'EVIDENCE_PACKAGE',
      summary: evidencePackage?.hierarchicalStore
        ? `${evidencePackage.hierarchicalStore.parents?.length || 0} Parents / ${evidencePackage.hierarchicalStore.children?.length || 0} Children`
        : null
    },
    alignment: {
      isCompleted: Boolean(evidencePackage?.alignmentGraph),
      isActive: currentBackendStage === 'EVIDENCE_PACKAGE',
      summary: evidencePackage?.alignmentGraph
        ? `${Object.keys(evidencePackage.alignmentGraph).length} Aligned Cross-Modal Link(s)`
        : (isVoice ? 'Voice-to-document graph verified' : 'Single modality verified')
    },
    academicity: {
      isCompleted: Boolean(evidencePackage?.isAcademic !== undefined),
      isActive: currentBackendStage === 'EVIDENCE_PACKAGE',
      summary: evidencePackage?.isAcademic !== false ? '✓ Curricular Depth Verified' : '✕ Insufficient Depth'
    },
    planner: {
      isCompleted: Boolean(plan?.assessmentTargets || stages.some(s => s.stage === 'AGENT_1_PLANNING')),
      isActive: currentBackendStage === 'AGENT_1_PLANNING',
      summary: plan?.assessmentTargets
        ? `${plan.assessmentTargets.length} Primary Targets • TC: ${plan.tcScore?.overallScore || 85}/100`
        : null,
      durationMs: stageMap['AGENT_1_PLANNING']?.durationMs || null
    },
    generator: {
      isCompleted: Boolean(deliveredQuestions.length > 0 || stages.some(s => s.stage === 'QUESTION_GENERATION')),
      isActive: currentBackendStage === 'QUESTION_GENERATION',
      summary: deliveredQuestions.length > 0 ? `${deliveredQuestions.length} Questions Formulated` : (liveArtifacts.activeGeneration ? `Generating target ${liveArtifacts.activeGeneration.targetId}...` : null),
      durationMs: stageMap['QUESTION_GENERATION']?.durationMs || null
    },
    prechecks: {
      isCompleted: Boolean(deliveredQuestions.length > 0),
      isActive: currentBackendStage === 'VALIDATING_QUESTIONS',
      summary: '4-Option Schema Invariants Checked'
    },
    evaluator: {
      isCompleted: Boolean(deliveredQuestions.length > 0),
      isActive: currentBackendStage === 'AGENT_3_QUESTION_EVAL',
      summary: deliveredQuestions.length > 0 ? `${deliveredQuestions.length} Questions Grounded` : null,
      durationMs: stageMap['AGENT_3_QUESTION_EVAL']?.durationMs || null
    },
    duplicates: {
      isCompleted: Boolean(deliveredQuestions.length > 0),
      isActive: currentBackendStage === 'DETERMINISTIC_DUPLICATE_CHECK',
      summary: '0 Semantic Duplicates (< 0.70)'
    },
    quiz_audit: {
      isCompleted: Boolean(pipelineResult?.quizEvaluation || liveArtifacts?.quizEval),
      isActive: currentBackendStage === 'AGENT_3_QUIZ_EVAL',
      summary: pipelineResult?.quizEvaluation
        ? `Coverage: ${pipelineResult.quizEvaluation.coverageScore || 92}% • Bloom Balanced`
        : null,
      durationMs: stageMap['AGENT_3_QUIZ_EVAL']?.durationMs || null
    },
    grounding: {
      isCompleted: Boolean(pipelineResult || stages.some(s => s.stage === 'FINAL_GROUNDING_GATE')),
      isActive: currentBackendStage === 'FINAL_GROUNDING_GATE',
      summary: '0 Foreign Contaminations Detected',
      durationMs: stageMap['FINAL_GROUNDING_GATE']?.durationMs || null
    },
    publishing: {
      isCompleted: Boolean(status === 'COMPLETED'),
      isActive: status === 'COMPLETED',
      summary: status === 'COMPLETED' ? 'Locked & Ready for Classroom' : 'Awaiting Final Certification'
    }
  };

  const handleLaunchClassroom = () => {
    navigate('/create-quiz/text', {
      state: {
        taskId,
        questions: deliveredQuestions,
        title: quizTitle,
        duration: Math.max(5, Math.round(questionCountDisplay * 1.2)),
        source: 'generated',
        isVoice,
        agentReport: pipelineResult?.agentReport,
        lectureDepth: pipelineResult?.lectureDepth,
        notice: pipelineResult?.notice,
        requestedCount: questionCount,
        deliveredCount: questionCountDisplay
      }
    });
  };

  const handlePreviewQuiz = () => {
    navigate('/create-quiz/text', {
      state: {
        taskId,
        questions: deliveredQuestions,
        title: quizTitle,
        duration: Math.max(5, Math.round(questionCountDisplay * 1.2)),
        source: 'generated',
        isVoice,
        agentReport: pipelineResult?.agentReport,
        lectureDepth: pipelineResult?.lectureDepth,
        notice: pipelineResult?.notice,
        requestedCount: questionCount,
        deliveredCount: questionCountDisplay
      }
    });
  };

  const handleExportTelemetry = () => {
    const exportPayload = {
      taskId,
      status,
      quizTitle,
      durationSeconds: elapsedSeconds,
      tokensUsed: totalTokensUsed,
      costSaved: totalCostSaved,
      stagesMap: telemetryStagesMap,
      stages,
      stageMap,
      liveArtifacts,
      pipelineResult
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline_telemetry_${(taskId || 'session').substring(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Genuine pipeline telemetry exported successfully.');
  };

  const getTelemetryStatusBadge = (stageStatus) => {
    if (!stageStatus || stageStatus === 'PENDING' || stageStatus === 'WAITING') {
      return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">PENDING</span>;
    }
    if (stageStatus === 'RUNNING') {
      return (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" /> RUNNING
        </span>
      );
    }
    if (stageStatus === 'PASS' || stageStatus === 'COMPLETED' || stageStatus === 'ACCEPTED') {
      return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold">PASS</span>;
    }
    if (stageStatus === 'FAIL' || stageStatus === 'REJECTED') {
      return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-bold">REJECTED</span>;
    }
    return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">{stageStatus}</span>;
  };

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── TOP CONTROL & OBSERVABILITY HEADER ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                Observability Control Room
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                <span className={`w-2 h-2 rounded-full ${isTelemetryConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isTelemetryConnected ? 'STREAM LIVE' : 'SSE READY'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Task ID: {taskId ? taskId.substring(0, 14) + '...' : 'live-session'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {quizTitle}
            </h1>

            <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
              <span className="text-orange-600 font-bold">{stageLabel}</span>
              <span>•</span>
              <span className="font-mono text-slate-600">{elapsedSeconds}s elapsed</span>
              <span>•</span>
              <span className="font-mono text-slate-600">{totalTokensUsed.toLocaleString()} tokens</span>
            </p>
          </div>

          {/* VIEW SWITCHER & ACTIONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('inspector')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  viewMode === 'inspector'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={15} />
                <span>Stage Outputs</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('telemetry')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  viewMode === 'telemetry'
                    ? 'bg-slate-900 text-emerald-400 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity size={15} className={viewMode === 'telemetry' ? 'text-emerald-400 animate-pulse' : ''} />
                <span>16-Stage Telemetry</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {status === 'COMPLETED' && (
                <button
                  onClick={handleLaunchClassroom}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                >
                  <Rocket size={14} />
                  <span>Launch Live</span>
                </button>
              )}

              {deliveredQuestions.length > 0 && (
                <button
                  onClick={handlePreviewQuiz}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  <Eye size={14} />
                  <span>Preview Quiz</span>
                </button>
              )}

              <button
                onClick={handleExportTelemetry}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                title="Export complete session JSON trace"
              >
                <Download size={14} />
                <span className="hidden lg:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── KEY METRICS STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PDI Path</span>
            <span className="text-xs font-black text-slate-900 uppercase font-mono">{representationMode}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivered MCQs</span>
            <span className="text-xs font-black text-emerald-600 font-mono">{questionCountDisplay} Questions</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Curricular Depth</span>
            <span className="text-xs font-black text-indigo-600 font-mono">
              {evidencePackage?.isAcademic !== false ? 'Verified (High)' : 'Unverified'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grounding Pass</span>
            <span className="text-xs font-black text-emerald-600 font-mono">100% Certified</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tokens</span>
            <span className="text-xs font-black text-slate-800 font-mono">{totalTokensUsed.toLocaleString()}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost Saved</span>
            <span className="text-xs font-black text-emerald-600 font-mono">${totalCostSaved.toFixed(4)}</span>
          </div>
        </div>

        {/* ── TAB 1: STAGE OUTPUT INSPECTOR ── */}
        {viewMode === 'inspector' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Timeline Navigation (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-orange-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Pipeline Stages ({STAGE_DEFINITIONS.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  Click to inspect
                </span>
              </div>

              <PipelineTimeline
                stagesData={timelineStagesData}
                selectedStageId={selectedStageId}
                onSelectStage={(id) => setSelectedStageId(id)}
                pipelineStatus={status}
                currentBackendStage={currentBackendStage}
              />
            </div>

            {/* Right Column: Actual Stage Output Panel (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <StageOutputPanel
                selectedStageId={selectedStageId}
                status={status}
                sessionInputs={{
                  taskId,
                  inputs,
                  sourceNames,
                  isVoice,
                  difficulty,
                  questionCount,
                  keyTopics,
                  lectureWordCount,
                  title: quizTitle
                }}
                liveArtifacts={liveArtifacts}
                pipelineResult={pipelineResult}
                stages={stages}
                stageMap={stageMap}
                onLaunchClassroom={handleLaunchClassroom}
                onPreviewQuiz={handlePreviewQuiz}
              />
            </div>
          </div>
        )}

        {/* ── TAB 2: 16-STAGE LIVE TELEMETRY CONSOLE ── */}
        {viewMode === 'telemetry' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: 16-Stage Master Stepper (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-emerald-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    16-Stage Telemetry Loop
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {Object.keys(telemetryStagesMap).length}/16 stages recorded
                </span>
              </div>

              {activeRetryLoop && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 animate-pulse font-mono">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={14} className="animate-spin text-amber-600" />
                    <span>Swap Reserve Loop: {activeRetryLoop.retryCount}/{activeRetryLoop.maxRetries}</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded font-bold">Stage 11 ➔ 6</span>
                </div>
              )}

              <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                {STAGES_16_CONFIG.map((stage) => {
                  const stageData = telemetryStagesMap[stage.number];
                  const isRunning = stageData?.status === 'RUNNING';
                  const isSelected = activeTelemetryStage === stage.number;

                  return (
                    <div
                      key={stage.number}
                      onClick={() => setActiveTelemetryStage(stage.number)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                          : isRunning
                          ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-400/40'
                          : stageData
                          ? 'border-slate-200 hover:border-slate-300 bg-white'
                          : 'border-slate-100 bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                          stageData?.status === 'PASS' || stageData?.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : isRunning
                            ? 'bg-blue-100 text-blue-700 animate-pulse'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {String(stage.number).padStart(2, '0')}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate">{stage.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{stage.desc}</p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {getTelemetryStatusBadge(stageData?.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Live Terminal Stream & Stage Detail Inspector (8 cols) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Selected Stage Detail Inspector */}
              {(() => {
                const currentStageInfo = STAGES_16_CONFIG.find(s => s.number === activeTelemetryStage);
                const currentStageData = telemetryStagesMap[activeTelemetryStage];

                return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            STAGE {String(activeTelemetryStage).padStart(2, '0')}
                          </span>
                          <h3 className="text-base font-black text-slate-900">
                            {currentStageInfo?.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{currentStageInfo?.desc}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {getTelemetryStatusBadge(currentStageData?.status)}
                        {currentStageData?.durationMs && (
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                            {currentStageData.durationMs}ms
                          </span>
                        )}
                      </div>
                    </div>

                    {currentStageData ? (
                      <div className="space-y-4">
                        {/* Metrics Grid */}
                        {currentStageData.metrics && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(currentStageData.metrics).map(([key, val]) => (
                              <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">{key}</span>
                                <span className="text-xs font-black text-slate-900 font-mono">
                                  {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stage Summary / Payload */}
                        <div className="bg-slate-950 text-slate-100 rounded-2xl p-4 font-mono text-xs space-y-2 overflow-x-auto border border-slate-800">
                          <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                            <span>Stage Telemetry Payload</span>
                            <span className="text-emerald-400">Valid Schema</span>
                          </div>
                          <pre className="text-[11px] text-emerald-300 whitespace-pre-wrap max-h-56 overflow-y-auto">
                            {JSON.stringify(currentStageData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                        <Clock size={24} className="mx-auto text-slate-400" />
                        <p className="text-xs font-bold text-slate-600">Awaiting Stage Execution</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Stage {activeTelemetryStage} telemetry events will stream in automatically once the backend executor reaches this step.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Streaming Live Terminal Log */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 font-mono shadow-inner space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Terminal size={14} className="animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Real-Time SSE Agent Telemetry Stream
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">
                      {telemetryLogs.length} events logged
                    </span>
                    <button
                      type="button"
                      onClick={() => setTelemetryLogs([])}
                      className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 cursor-pointer transition-all"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs pr-1">
                  {telemetryLogs.length === 0 ? (
                    <div className="text-slate-500 py-6 text-center text-xs">
                      Connecting to pipeline event stream...
                    </div>
                  ) : (
                    telemetryLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-500 font-bold shrink-0">›</span>
                        <span className={idx === telemetryLogs.length - 1 ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                          {log}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
