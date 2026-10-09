import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock, Loader2, CheckCircle2, XCircle, Ban, ArrowLeft,
  RotateCcw, Lock, Radio, Terminal, ChevronDown, ChevronRight,
  ShieldAlert, Play, Layers
} from "lucide-react";

const STAGES_CONFIG = [
  { number: 1, name: "Teacher Inputs" },
  { number: 2, name: "Ingestion & Cleaning" },
  { number: 3, name: "Evidence Packaging & Alignment" },
  { number: 4, name: "Academicity Gate (Pre-LLM)" },
  { number: 5, name: "Agent 1 Target Planner (LLM)" },
  { number: 6, name: "Evidence Selector" },
  { number: 7, name: "Agent 2 MCQ Generator (LLM)" },
  { number: 8, name: "Pre-Check (Format & 4 options)" },
  { number: 9, name: "Agent 3 Evaluator (Grounding)" },
  { number: 10, name: "Duplicate Check (Similarity)" },
  { number: 11, name: "Reserve Swap (Max 3 retries)" },
  { number: 12, name: "Agent 3 Whole-Quiz Audit" },
  { number: 13, name: "Option Shuffling (A,B,C,D)" },
  { number: 14, name: "Final Grounding Gate" },
  { number: 15, name: "Publishing & SHA-256 Lock" },
  { number: 16, name: "Live Classroom Engine" }
];

export default function TelemetryPage() {
  const { sessionId = "default_session" } = useParams();
  const navigate = useNavigate();

  const [stagesMap, setStagesMap] = useState({});
  const [activeStageNumber, setActiveStageNumber] = useState(1);
  const [pipelineOverallStatus, setPipelineOverallStatus] = useState("RUNNING");
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [totalCostSaved, setTotalCostSaved] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [expandedJson, setExpandedJson] = useState({});
  const [activeLoop, setActiveLoop] = useState(null);

  const stepperRefs = useRef({});

  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;
    let isMounted = true;

    const processStageData = (data) => {
      if (!data || !data.stageNumber) return;
      setHasReceivedData(true);
      setStagesMap((prev) => ({ ...prev, [data.stageNumber]: data }));

      if (data.status === "RUNNING") {
        setActiveStageNumber(data.stageNumber);
      }
      if (data.tokensUsed !== undefined) setTotalTokensUsed(data.tokensUsed);
      if (data.costSaved !== undefined) setTotalCostSaved(data.costSaved);

      if (data.stageNumber === 11 && data.retryCount) {
        setActiveLoop({ retryCount: data.retryCount, maxRetries: data.maxRetries || 3 });
      } else if (data.stageNumber >= 12) {
        setActiveLoop(null);
      }

      if (data.status === "REJECTED") {
        setPipelineOverallStatus("REJECTED");
      } else if (data.stageNumber === 16 && (data.status === "PASS" || data.status === "COMPLETED")) {
        setPipelineOverallStatus("COMPLETED");
      }
    };

    const fetchReplay = async () => {
      try {
        const res = await fetch(`/api/pipeline/logs/${sessionId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.logs && Array.isArray(json.logs)) {
            for (const item of json.logs) processStageData(item);
          }
        }
      } catch (err) {}
    };

    const connectSSE = () => {
      if (!isMounted) return;
      try {
        eventSource = new EventSource(`/api/pipeline/stream/${sessionId}`);
        eventSource.onopen = () => {
          if (isMounted) setIsConnected(true);
        };
        eventSource.onmessage = (evt) => {
          if (!isMounted) return;
          try {
            processStageData(JSON.parse(evt.data));
          } catch (_) {}
        };
        eventSource.onerror = () => {
          if (isMounted) {
            setIsConnected(false);
            if (eventSource) eventSource.close();
            reconnectTimeout = setTimeout(connectSSE, 2000);
          }
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectSSE, 2000);
      }
    };

    fetchReplay().then(() => {
      if (isMounted) connectSSE();
    });

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [sessionId]);

  const toggleJson = (num) => {
    setExpandedJson((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "RUNNING":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "PASS":
      case "ACCEPTED":
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "FAIL":
      case "REJECTED":
        return <Ban className="h-4 w-4 text-rose-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const isRejected = pipelineOverallStatus === "REJECTED" || stagesMap[4]?.status === "REJECTED";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Bar Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold">Telemetry Console</h1>
                  <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                    {isConnected ? "LIVE STREAM" : "RECONNECTING"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono">SESSION: {sessionId}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Status</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded font-mono ${
                  isRejected ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                  pipelineOverallStatus === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                  "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                }`}>
                  {pipelineOverallStatus}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Tokens Used</span>
                <span className="text-sm font-semibold font-mono">{totalTokensUsed.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Cost Saved</span>
                <span className="text-sm font-semibold font-mono text-emerald-500">${totalCostSaved.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (35%) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Master Pipeline (16 Stages)
              </h2>

              {activeLoop && (
                <div className="my-2 p-2.5 rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 text-amber-500 flex items-center justify-between animate-pulse text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 animate-spin text-amber-500" />
                    <span>Swap Reserve (Retry {activeLoop.retryCount}/{activeLoop.maxRetries})</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">Stage 11 ➔ 6</span>
                </div>
              )}

              <div className="space-y-1">
                {STAGES_CONFIG.map((stage) => {
                  const stageData = stagesMap[stage.number];
                  const isRunning = stageData?.status === "RUNNING";

                  return (
                    <div
                      key={stage.number}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs transition border ${
                        isRunning ? "ring-2 ring-blue-500 bg-blue-500/10 border-blue-500/20 font-bold" :
                        stageData ? "bg-slate-50 dark:bg-slate-800/40 border-transparent" :
                        "opacity-60 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                          {getStatusIcon(stageData?.status)}
                        </div>
                        <span className="truncate">
                          <span className="font-mono text-slate-400 mr-1">{String(stage.number).padStart(2, "0")}.</span>
                          {stage.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        {stageData?.status || "WAITING"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (65%) */}
          <div className="lg:col-span-8 space-y-4">
            {!hasReceivedData && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold">Waiting for live data...</h3>
                <p className="text-xs text-slate-500 mt-1">Listening on live SSE stream for session updates.</p>
              </div>
            )}

            {isRejected && (
              <div className="rounded-xl border-2 border-rose-500 bg-rose-500/10 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-rose-500">Session Rejected - Zero AI tokens spent</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Curricular density scored below minimum academic threshold (0.60). Pipeline halted.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2">
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-rose-500/30">
                    <span className="text-slate-500 block text-[10px]">DENSITY</span>
                    <span className="text-rose-500 font-bold text-sm">{stagesMap[4]?.metrics?.density ?? "0.00"}</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[10px]">THRESHOLD</span>
                    <span className="font-semibold text-sm">0.60</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[10px]">ACADEMIC TOKENS</span>
                    <span className="font-semibold text-sm">{stagesMap[4]?.metrics?.academicTokens ?? 0}</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[10px]">AI TOKENS SPENT</span>
                    <span className="text-emerald-500 font-bold text-sm">0</span>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(stagesMap)
              .map(Number)
              .sort((a, b) => a - b)
              .map((num) => {
                const stage = stagesMap[num];
                if (!stage) return null;

                return (
                  <div
                    key={num}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white font-mono font-bold text-xs">
                          {num}
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold">{stage.stageName}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(stage.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {stage.status}
                      </span>
                    </div>

                    {/* Stage 4 Gauge */}
                    {num === 4 && stage.metrics && (
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span>Academicity Density</span>
                          <strong className={stage.metrics.density >= 0.6 ? "text-emerald-500" : "text-rose-500"}>
                            {stage.metrics.density} / Min 0.60
                          </strong>
                        </div>
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (stage.metrics.density || 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stage 9 Grounding */}
                    {num === 9 && stage.metrics && (
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span>Grounding Score</span>
                          <strong className={stage.metrics.groundingScore >= 0.85 ? "text-emerald-500" : "text-rose-500"}>
                            {stage.metrics.groundingScore} / Min 0.85
                          </strong>
                        </div>
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (stage.metrics.groundingScore || 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stage 11 Reserve Swap */}
                    {num === 11 && stage.metrics && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono space-y-1">
                        <div className="flex justify-between text-amber-500 font-bold">
                          <span>Retry {stage.metrics.retryCount}/{stage.metrics.maxRetries || 3}</span>
                          <span>Loop back to Stage {stage.metrics.loopBackToStage || 6}</span>
                        </div>
                        {stage.metrics.swappedIds && (
                          <div className="text-slate-600 dark:text-slate-400">
                            Swapped Evidence: {stage.metrics.swappedIds.join(" ➔ ")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stage 15 SHA-256 Lock */}
                    {num === 15 && stage.metrics?.sha256 && (
                      <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs flex items-center gap-2 overflow-x-auto">
                        <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-slate-500 shrink-0">SHA-256:</span>
                        <span className="font-semibold select-all break-all">{stage.metrics.sha256}</span>
                      </div>
                    )}

                    {/* Stage 16 PIN */}
                    {num === 16 && stage.metrics?.pin && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
                          <span className="text-xs font-mono text-slate-500">ROOM PIN:</span>
                          <span className="text-xl font-bold font-mono text-emerald-500">{stage.metrics.pin}</span>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                          PUBLISHED
                        </span>
                      </div>
                    )}

                    {/* Logs */}
                    {stage.logs && stage.logs.length > 0 && (
                      <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                        {stage.logs.map((log, lIdx) => (
                          <div key={lIdx} className="leading-relaxed flex items-start gap-2">
                            <span className="text-slate-600 select-none">&gt;</span>
                            <span className="break-words">{log}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Collapsible JSON */}
                    {stage.sampleOutput && Object.keys(stage.sampleOutput).length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleJson(num)}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-mono"
                        >
                          {expandedJson[num] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span>{expandedJson[num] ? "Hide JSON" : "View JSON Payload"}</span>
                        </button>
                        {expandedJson[num] && (
                          <pre className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs font-mono overflow-x-auto max-h-60">
                            {JSON.stringify(stage.sampleOutput, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
