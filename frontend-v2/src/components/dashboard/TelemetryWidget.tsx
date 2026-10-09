"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Radio, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelemetryWidgetProps {
  sessionId?: string;
  className?: string;
}

interface StageSnapshot {
  stageNumber: number;
  stageName: string;
  status: "PENDING" | "RUNNING" | "PASS" | "FAIL" | "REJECTED" | "ACCEPTED" | "COMPLETED";
}

const STAGE_NAMES = [
  "Teacher Inputs",
  "Ingestion & Cleaning",
  "Evidence Packaging",
  "Academicity Gate",
  "Agent 1 Planner",
  "Evidence Selector",
  "Agent 2 MCQ Generator",
  "Pre-Check (Format)",
  "Agent 3 Evaluator",
  "Duplicate Check",
  "Reserve Swap",
  "Whole-Quiz Audit",
  "Option Shuffling",
  "Final Grounding Gate",
  "Publishing & SHA Lock",
  "Live Classroom Engine"
];

export function TelemetryWidget({ sessionId = "active-session", className }: TelemetryWidgetProps) {
  const router = useRouter();
  const [stageStatuses, setStageStatuses] = useState<Record<number, StageSnapshot["status"]>>({});
  const [currentStageNumber, setCurrentStageNumber] = useState<number>(0);
  const [currentStageName, setCurrentStageName] = useState<string>("Waiting for live data...");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!sessionId) return;

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // 1. Initial replay fetch
    fetch(`/api/pipeline/logs/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isSubscribed) return;
        setIsLoading(false);
        if (data && data.logs && data.logs.length > 0) {
          const map: Record<number, StageSnapshot["status"]> = {};
          let lastStage = 0;
          let lastName = "Waiting for live data...";
          for (const item of data.logs) {
            map[item.stageNumber] = item.status;
            lastStage = item.stageNumber;
            lastName = item.stageName;
          }
          setStageStatuses(map);
          setCurrentStageNumber(lastStage);
          setCurrentStageName(lastName);
        }
      })
      .catch(() => {
        if (isSubscribed) setIsLoading(false);
      });

    // 2. Real-time SSE stream
    try {
      eventSource = new EventSource(`/api/pipeline/stream/${sessionId}`);
      eventSource.onopen = () => {
        if (isSubscribed) setIsConnected(true);
      };
      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data && data.stageNumber) {
            setStageStatuses((prev) => ({
              ...prev,
              [data.stageNumber]: data.status,
            }));
            setCurrentStageNumber(data.stageNumber);
            setCurrentStageName(data.stageName);
            setIsLoading(false);
          }
        } catch (_) {}
      };
      eventSource.onerror = () => {
        if (isSubscribed) setIsConnected(false);
      };
    } catch (_) {}

    return () => {
      isSubscribed = false;
      if (eventSource) eventSource.close();
    };
  }, [sessionId]);

  const getDotColor = (num: number) => {
    const status = stageStatuses[num];
    if (!status || status === "PENDING") {
      return "bg-muted border-border";
    }
    if (status === "RUNNING") {
      return "bg-primary animate-ping ring-2 ring-primary";
    }
    if (status === "PASS" || status === "ACCEPTED" || status === "COMPLETED") {
      return "bg-emerald-500 shadow-sm shadow-emerald-500/50";
    }
    if (status === "FAIL" || status === "REJECTED") {
      return "bg-destructive shadow-sm shadow-destructive/50";
    }
    return "bg-muted";
  };

  return (
    <Card
      onClick={() => router.push(`/telemetry/${sessionId}`)}
      className={cn(
        "cursor-pointer border border-border bg-card text-card-foreground transition-all duration-200 hover:border-primary/50 hover:bg-accent/40 shadow-sm",
        className
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-foreground">
              Agent Telemetry Stream
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                )}
              />
              {isConnected ? "LIVE" : "READY"}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              16 Stages
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {/* 16-Dot Mini Timeline */}
        <div className="flex items-center justify-between gap-1 py-1">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => (
            <div
              key={num}
              title={`Stage ${num}: ${STAGE_NAMES[num - 1]}`}
              className={cn(
                "h-2.5 w-2.5 rounded-full border transition-all duration-300",
                getDotColor(num),
                currentStageNumber === num && "ring-2 ring-primary ring-offset-1"
              )}
            />
          ))}
        </div>

        {/* Current Stage Status */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
          <div className="flex items-center gap-2 overflow-hidden">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for live data...
              </span>
            ) : (
              <span className="text-muted-foreground font-medium truncate">
                {currentStageNumber > 0 ? (
                  <>
                    <span className="text-foreground font-semibold">
                      Stage {currentStageNumber}:
                    </span>{" "}
                    {currentStageName}
                  </>
                ) : (
                  "Waiting for live data..."
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-primary text-xs font-medium shrink-0">
            <span>Inspect Stream</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TelemetryWidget;
