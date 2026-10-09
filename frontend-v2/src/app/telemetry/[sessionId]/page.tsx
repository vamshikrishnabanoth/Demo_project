"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Radio,
  Terminal,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Lock,
  Flame,
  Layers,
  FileText,
  AlertTriangle,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StageUpdatePayload {
  stageNumber: number;
  stageName: string;
  status: "PENDING" | "RUNNING" | "PASS" | "FAIL" | "REJECTED" | "ACCEPTED" | "COMPLETED";
  metrics?: Record<string, any>;
  sampleOutput?: Record<string, any>;
  logs: string[];
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
  loopBackToStage?: number;
  tokensUsed?: number;
  costSaved?: number;
}

const STAGES_CONFIG = [
  { number: 1, name: "Teacher Inputs", short: "Inputs" },
  { number: 2, name: "Ingestion & Cleaning", short: "Ingestion" },
  { number: 3, name: "Evidence Packaging & Alignment", short: "Packaging" },
  { number: 4, name: "Academicity Gate (Pre-LLM)", short: "Academicity" },
  { number: 5, name: "Agent 1 Target Planner (LLM)", short: "Planner" },
  { number: 6, name: "Evidence Selector", short: "Evidence" },
  { number: 7, name: "Agent 2 MCQ Generator (LLM)", short: "Generator" },
  { number: 8, name: "Pre-Check (Format & 4 options)", short: "Pre-Check" },
  { number: 9, name: "Agent 3 Evaluator (Grounding)", short: "Evaluator" },
  { number: 10, name: "Duplicate Check (Similarity)", short: "Duplicates" },
  { number: 11, name: "Reserve Swap (Max 3 retries)", short: "Reserve Swap" },
  { number: 12, name: "Agent 3 Whole-Quiz Audit", short: "Quiz Audit" },
  { number: 13, name: "Option Shuffling (A,B,C,D)", short: "Shuffling" },
  { number: 14, name: "Final Grounding Gate", short: "Grounding Gate" },
  { number: 15, name: "Publishing & SHA-256 Lock", short: "SHA Lock" },
  { number: 16, name: "Live Classroom Engine", short: "Live Engine" }
];

export default function TelemetryStreamPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.sessionId as string) || "session_default";

  const [stagesMap, setStagesMap] = useState<Record<number, StageUpdatePayload>>({});
  const [activeStageNumber, setActiveStageNumber] = useState<number>(1);
  const [pipelineOverallStatus, setPipelineOverallStatus] = useState<"RUNNING" | "PASS" | "REJECTED" | "COMPLETED">("RUNNING");
  const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
  const [totalCostSaved, setTotalCostSaved] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasReceivedData, setHasReceivedData] = useState<boolean>(false);
  const [expandedJson, setExpandedJson] = useState<Record<number, boolean>>({});
  const [activeLoop, setActiveLoop] = useState<{ retryCount: number; maxRetries: number } | null>(null);

  const stepperRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial replay fetch + SSE connection with automatic 2s reconnection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const processStageData = (data: StageUpdatePayload) => {
      if (!data || !data.stageNumber) return;
      setHasReceivedData(true);
      setStagesMap((prev) => ({
        ...prev,
        [data.stageNumber]: data,
      }));

      if (data.status === "RUNNING") {
        setActiveStageNumber(data.stageNumber);
      }

      if (data.tokensUsed !== undefined) {
        setTotalTokensUsed(data.tokensUsed);
      }
      if (data.costSaved !== undefined) {
        setTotalCostSaved(data.costSaved);
      }

      // Check loop condition
      if (data.stageNumber === 11 && data.retryCount) {
        setActiveLoop({
          retryCount: data.retryCount,
          maxRetries: data.maxRetries || 3,
        });
      } else if (data.stageNumber >= 12) {
        setActiveLoop(null);
      }

      // Overall terminal status
      if (data.status === "REJECTED") {
        setPipelineOverallStatus("REJECTED");
      } else if (data.stageNumber === 16 && (data.status === "PASS" || data.status === "COMPLETED")) {
        setPipelineOverallStatus("COMPLETED");
      } else if (data.status === "PASS" || data.status === "ACCEPTED") {
        setPipelineOverallStatus("RUNNING");
      }
    };

    // Step 1: Fetch historical logs for replay
    const fetchReplay = async () => {
      try {
        const res = await fetch(`/api/pipeline/logs/${sessionId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.logs && Array.isArray(json.logs)) {
            for (const item of json.logs) {
              processStageData(item);
            }
          }
        }
      } catch (err) {
        console.warn("Replay fetch error:", err);
      }
    };

    // Step 2: Connect SSE Stream
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
            const parsed = JSON.parse(evt.data);
            processStageData(parsed);
          } catch (_) {}
        };

        eventSource.onerror = () => {
          if (isMounted) {
            setIsConnected(false);
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            // Reconnect after 2 seconds
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

  // Auto-scroll active stepper item into view
  useEffect(() => {
    if (activeStageNumber && stepperRefs.current[activeStageNumber]) {
      stepperRefs.current[activeStageNumber]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeStageNumber]);

  // Trigger demo/live pipeline execution if needed
  const handleTriggerPipeline = async (rejectScenario: boolean = false) => {
    try {
      setPipelineOverallStatus("RUNNING");
      await fetch(`/api/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          strictAcademicityThreshold: 0.60,
          files: [
            {
              name: rejectScenario ? "Casual_Chat_Transcript.txt" : "Distributed_Systems_Curriculum_2026.pdf",
              size: rejectScenario ? 1204 : 854000,
              type: rejectScenario ? "text/plain" : "application/pdf",
              pageCount: rejectScenario ? 1 : 24,
              content: rejectScenario
                ? "Hey guys how are you doing today what is up lol see you soon thanks bye"
                : "Database concurrency control protocols guarantee serializable snapshot isolation. In multi-version concurrency control (MVCC), write-ahead logging (WAL) enforces durability, while conflict serialization graphs detect dependency cycles and eliminate write skew anomalies under ACID guarantees."
            }
          ]
        })
      });
    } catch (err) {
      console.error("Trigger error:", err);
    }
  };

  const toggleJson = (stageNum: number) => {
    setExpandedJson((prev) => ({ ...prev, [stageNum]: !prev[stageNum] }));
  };

  const getStatusIcon = (status?: StageUpdatePayload["status"]) => {
    switch (status) {
      case "RUNNING":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "PASS":
      case "ACCEPTED":
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "FAIL":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "REJECTED":
        return <Ban className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: StageUpdatePayload["status"]) => {
    switch (status) {
      case "RUNNING":
        return <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">RUNNING</Badge>;
      case "PASS":
        return <Badge variant="success">PASS</Badge>;
      case "ACCEPTED":
        return <Badge variant="success">ACCEPTED</Badge>;
      case "COMPLETED":
        return <Badge variant="success">COMPLETED</Badge>;
      case "FAIL":
        return <Badge variant="destructive">FAIL</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">REJECTED</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">WAITING</Badge>;
    }
  };

  const isRejected = pipelineOverallStatus === "REJECTED" || stagesMap[4]?.status === "REJECTED";

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* ── TOP BAR CARD ──────────────────────────────────────────────────────── */}
      <Card className="border border-border bg-card text-card-foreground shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-accent border border-border"
                title="Go Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Telemetry Console
                  </h2>
                  <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                      )}
                    />
                    {isConnected ? "LIVE STREAM" : "RECONNECTING"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  SESSION: <span className="text-foreground font-medium">{sessionId}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
              {/* Overall Status Badge */}
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Status</span>
                <div className="mt-0.5">
                  {pipelineOverallStatus === "REJECTED" ? (
                    <Badge variant="destructive" className="font-mono tracking-wider font-semibold">REJECTED</Badge>
                  ) : pipelineOverallStatus === "COMPLETED" ? (
                    <Badge variant="success" className="font-mono tracking-wider font-semibold">PASS (COMPLETED)</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 font-mono tracking-wider font-semibold">
                      RUNNING
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tokens Used Counter */}
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Tokens Used</span>
                <span className="text-sm font-semibold font-mono text-foreground mt-0.5">
                  {totalTokensUsed.toLocaleString()}
                </span>
              </div>

              {/* Cost Saved Counter */}
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Cost Saved</span>
                <span className="text-sm font-semibold font-mono text-emerald-500 mt-0.5">
                  ${totalCostSaved.toFixed(4)}
                </span>
              </div>

              {/* Quick Actions (Run Real Pipeline) */}
              {!hasReceivedData && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTriggerPipeline(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Start Live Run
                  </button>
                  <button
                    onClick={() => handleTriggerPipeline(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
                  >
                    Test Reject Gate
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TWO-COLUMN WORKSPACE: LEFT STEPPER (35%) | RIGHT VIEWER (65%) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN (35% -> lg:col-span-4 or 5) ─────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="p-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Master Pipeline (16 Stages)
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Real-time
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Sequential gate verification & loopback telemetry
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              <div className="relative space-y-1">
                {/* Visual Dotted Line Loop Animation (RULE 5) */}
                {activeLoop && (
                  <div className="my-2 p-2.5 rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <RotateCcw className="h-4 w-4 animate-spin text-amber-500" />
                      <span>Swap Reserve (Retry {activeLoop.retryCount}/{activeLoop.maxRetries})</span>
                    </div>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">
                      Stage 11 ➔ Stage 6
                    </span>
                  </div>
                )}

                {STAGES_CONFIG.map((stage, idx) => {
                  const stageData = stagesMap[stage.number];
                  const isRunning = stageData?.status === "RUNNING";
                  const isCurrent = activeStageNumber === stage.number;
                  const metricValue =
                    stage.number === 4 && stageData?.metrics?.density !== undefined
                      ? `d=${stageData.metrics.density}`
                      : stage.number === 9 && stageData?.metrics?.groundingScore !== undefined
                      ? `g=${stageData.metrics.groundingScore}`
                      : stage.number === 10 && stageData?.metrics?.similarity !== undefined
                      ? `s=${stageData.metrics.similarity}`
                      : stage.number === 11 && stageData?.metrics?.retryCount !== undefined
                      ? `R${stageData.metrics.retryCount}/${stageData.metrics.maxRetries || 3}`
                      : null;

                  return (
                    <div
                      key={stage.number}
                      ref={(el) => {
                        stepperRefs.current[stage.number] = el;
                      }}
                      className={cn(
                        "relative flex items-center justify-between p-2 rounded-md transition-all text-xs border border-transparent",
                        isRunning && "ring-2 ring-primary bg-primary/10 border-primary/20",
                        !isRunning && stageData && "bg-muted/40",
                        !stageData && "opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted border border-border">
                          {getStatusIcon(stageData?.status)}
                        </div>
                        <div className="truncate">
                          <p className={cn("font-medium truncate", isRunning ? "text-primary font-bold" : "text-foreground")}>
                            <span className="font-mono text-muted-foreground mr-1">
                              {String(stage.number).padStart(2, "0")}.
                            </span>
                            {stage.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {metricValue && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {metricValue}
                          </span>
                        )}
                        {getStatusBadge(stageData?.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN (65% -> lg:col-span-8) ─────────────────────────── */}
        <div className="lg:col-span-8 space-y-4" ref={viewerScrollRef}>
          {/* Skeleton Loaders if waiting for live data (RULE 1) */}
          {!hasReceivedData && (
            <Card className="border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h3 className="text-base font-semibold text-foreground">
                  Waiting for live data...
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  The telemetry stream is ready and listening on SSE channel. Upload material or click "Start Live Run" above to stream execution.
                </p>
                <div className="w-full max-w-md pt-4 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4 mx-auto" />
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2 mx-auto" />
                </div>
              </div>
            </Card>
          )}

          {/* CRITICAL REJECTION CARD (Stage 4 Academicity < 0.60) */}
          {isRejected && (
            <Card className="border-2 border-destructive bg-destructive/10 text-card-foreground shadow-md animate-in fade-in duration-300">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
                  <div>
                    <CardTitle className="text-lg font-bold text-destructive">
                      Session Rejected - Zero AI tokens spent
                    </CardTitle>
                    <CardDescription className="text-xs text-destructive-foreground/80 mt-1">
                      Academicity density evaluated below minimum curricular threshold (0.60). Pipeline halted immediately to prevent LLM hallucination and wasteful token spend.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-card border border-destructive/30">
                    <span className="text-muted-foreground block text-[10px]">DENSITY</span>
                    <span className="text-destructive font-bold text-sm">
                      {stagesMap[4]?.metrics?.density ?? "0.00"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-muted-foreground block text-[10px]">THRESHOLD</span>
                    <span className="text-foreground font-semibold text-sm">0.60</span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-muted-foreground block text-[10px]">ACADEMIC TOKENS</span>
                    <span className="text-foreground font-semibold text-sm">
                      {stagesMap[4]?.metrics?.academicTokens ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-muted-foreground block text-[10px]">AI TOKENS SPENT</span>
                    <span className="text-emerald-500 font-bold text-sm">0</span>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 border border-border text-xs font-mono text-muted-foreground">
                  <span className="text-destructive font-semibold mr-1">[REJECTED]</span>
                  {stagesMap[4]?.sampleOutput?.reason || "Input does not meet academic rigor standards. Zero LLM calls initiated."}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Stage Output Cards */}
          {Object.keys(stagesMap)
            .map(Number)
            .sort((a, b) => a - b)
            .map((stageNum) => {
              const stage = stagesMap[stageNum];
              if (!stage) return null;

              return (
                <Card
                  key={stageNum}
                  className={cn(
                    "border border-border bg-card text-card-foreground shadow-sm transition-all duration-200",
                    stage.status === "RUNNING" && "border-primary/50 shadow-md",
                    stage.status === "REJECTED" && "border-destructive/60",
                    stage.status === "FAIL" && "border-destructive/40"
                  )}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-xs">
                          {stageNum}
                        </span>
                        <div>
                          <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                            {stage.stageName}
                          </CardTitle>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {new Date(stage.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(stage.status)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
                    {/* ── STAGE 4: Density Gauge + Token Comparison ──────────── */}
                    {stageNum === 4 && stage.metrics && (
                      <div className="space-y-3 p-3.5 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-foreground font-semibold">Academicity Density Gauge</span>
                          <span className="text-muted-foreground">
                            Score: <strong className={cn(stage.metrics.density >= 0.6 ? "text-emerald-500" : "text-destructive")}>{stage.metrics.density}</strong> / Min 0.60
                          </span>
                        </div>
                        <div className="relative pt-1">
                          <Progress
                            value={Math.min(100, (stage.metrics.density || 0) * 100)}
                            className="h-3"
                          />
                          {/* 60% Threshold Marker */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
                            style={{ left: "60%" }}
                            title="Minimum Pass Threshold (0.60)"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1">
                          <span>Academic Tokens: <strong className="text-foreground">{stage.metrics.academicTokens}</strong></span>
                          <span>Total Tokens: <strong className="text-foreground">{stage.metrics.totalTokens}</strong></span>
                          <span>Ratio: <strong className="text-foreground">{((stage.metrics.academicTokens / (stage.metrics.totalTokens || 1)) * 100).toFixed(1)}%</strong></span>
                        </div>
                      </div>
                    )}

                    {/* ── STAGE 9: Grounding Score Gauge + Reasoning ────────── */}
                    {stageNum === 9 && stage.metrics && (
                      <div className="space-y-3 p-3.5 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-foreground font-semibold">Factual Grounding Gate</span>
                          <span className="text-muted-foreground">
                            Grounding: <strong className={cn(stage.metrics.groundingScore >= 0.85 ? "text-emerald-500" : "text-destructive")}>{stage.metrics.groundingScore}</strong> / Min 0.85
                          </span>
                        </div>
                        <div className="relative pt-1">
                          <Progress
                            value={Math.min(100, (stage.metrics.groundingScore || 0) * 100)}
                            className="h-3"
                          />
                          {/* 85% Threshold Marker */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
                            style={{ left: "85%" }}
                            title="Required Grounding Threshold (0.85)"
                          />
                        </div>
                        {stage.sampleOutput?.reasoning && (
                          <div className="mt-2 text-xs font-mono p-2.5 rounded bg-muted border border-border text-foreground">
                            <span className="text-primary font-semibold block mb-1">Evaluator Reasoning:</span>
                            {stage.sampleOutput.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── STAGE 10: Embedding Similarity Progress Bar ──────── */}
                    {stageNum === 10 && stage.metrics && (
                      <div className="space-y-3 p-3.5 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-foreground font-semibold">Duplicate Similarity Check</span>
                          <span className="text-muted-foreground">
                            Similarity: <strong className={cn(stage.metrics.similarity < 0.70 ? "text-emerald-500" : "text-destructive")}>{stage.metrics.similarity}</strong> / Max 0.70
                          </span>
                        </div>
                        <div className="relative pt-1">
                          <Progress
                            value={Math.min(100, (stage.metrics.similarity || 0) * 100)}
                            className="h-3"
                          />
                          {/* 70% Cutoff Marker */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                            style={{ left: "70%" }}
                            title="Duplicate Cutoff (0.70)"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── STAGE 11: Reserve Swap Retry Badge & Swapped IDs ─── */}
                    {stageNum === 11 && stage.metrics && (
                      <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-foreground space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="border-amber-500 text-amber-500 font-mono">
                            Retry {stage.metrics.retryCount}/{stage.metrics.maxRetries || 3}
                          </Badge>
                          <span className="text-xs font-mono text-amber-500">
                            Looping back to Stage {stage.metrics.loopBackToStage || 6}
                          </span>
                        </div>
                        {stage.sampleOutput?.reason && (
                          <p className="text-xs text-muted-foreground">
                            {stage.sampleOutput.reason}
                          </p>
                        )}
                        {stage.metrics.swappedIds && (
                          <div className="text-xs font-mono flex items-center gap-2 pt-1">
                            <span className="text-muted-foreground">Swapped Evidence:</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                              {stage.metrics.swappedIds.join(" ➔ ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── STAGE 15: SHA-256 Seal Display ───────────────────── */}
                    {stageNum === 15 && stage.metrics?.sha256 && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border font-mono text-xs text-foreground overflow-x-auto">
                        <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-muted-foreground shrink-0">SHA-256 Lock:</span>
                        <span className="text-foreground font-semibold select-all break-all">
                          {stage.metrics.sha256}
                        </span>
                      </div>
                    )}

                    {/* ── STAGE 16: Live Classroom PIN ─────────────────────── */}
                    {stageNum === 16 && stage.metrics?.pin && (
                      <div className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-3">
                          <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
                          <div>
                            <span className="text-xs text-muted-foreground font-mono">CLASSROOM JOIN PIN</span>
                            <div className="text-2xl font-bold font-mono tracking-widest text-emerald-500">
                              {stage.metrics.pin}
                            </div>
                          </div>
                        </div>
                        <Badge variant="success" className="font-mono">
                          {stage.metrics.publishStatus || "PUBLISHED"}
                        </Badge>
                      </div>
                    )}

                    {/* Terminal-style Logs Array */}
                    {stage.logs && stage.logs.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                          <Terminal className="h-3 w-3" />
                          <span>Execution Logs</span>
                        </div>
                        <div className="rounded-md bg-muted p-3 font-mono text-xs text-foreground border border-border space-y-1 max-h-48 overflow-y-auto">
                          {stage.logs.map((logLine, lIdx) => (
                            <div key={lIdx} className="leading-relaxed flex items-start gap-2">
                              <span className="text-muted-foreground select-none">&gt;</span>
                              <span className="break-words">{logLine}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Collapsible JSON Viewer for sampleOutput */}
                    {stage.sampleOutput && Object.keys(stage.sampleOutput).length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => toggleJson(stageNum)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
                        >
                          {expandedJson[stageNum] ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {expandedJson[stageNum] ? "Hide Sample Payload" : "View Sample Payload (JSON)"}
                          </span>
                        </button>

                        {expandedJson[stageNum] && (
                          <pre className="mt-2 rounded-md bg-muted p-3 text-xs font-mono text-foreground border border-border overflow-x-auto max-h-60">
                            {JSON.stringify(stage.sampleOutput, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
