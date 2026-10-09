import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";

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

export default function TelemetryWidget({ sessionId = "default_session", className = "" }) {
  const navigate = useNavigate();
  const [stageStatuses, setStageStatuses] = useState({});
  const [currentStageNumber, setCurrentStageNumber] = useState(0);
  const [currentStageName, setCurrentStageName] = useState("Waiting for live data...");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let eventSource = null;
    let isSubscribed = true;

    fetch(`/api/pipeline/logs/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isSubscribed) return;
        setIsLoading(false);
        if (data && data.logs && data.logs.length > 0) {
          const map = {};
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

  const getDotColor = (num) => {
    const status = stageStatuses[num];
    if (!status || status === "PENDING") {
      return "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700";
    }
    if (status === "RUNNING") {
      return "bg-blue-600 animate-ping ring-2 ring-blue-500";
    }
    if (status === "PASS" || status === "ACCEPTED" || status === "COMPLETED") {
      return "bg-emerald-500 shadow-sm";
    }
    if (status === "FAIL" || status === "REJECTED") {
      return "bg-rose-500 shadow-sm";
    }
    return "bg-slate-200 dark:bg-slate-800";
  };

  return (
    <div
      onClick={() => navigate(`/telemetry/${sessionId}`)}
      className={`cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Agent Telemetry Stream
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isConnected ? "LIVE" : "READY"}
          </span>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            16 Stages
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 py-2">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => (
          <div
            key={num}
            title={`Stage ${num}: ${STAGE_NAMES[num - 1]}`}
            className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${getDotColor(num)} ${
              currentStageNumber === num ? "ring-2 ring-blue-500 ring-offset-1" : ""
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 truncate">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Waiting for live data...
            </span>
          ) : (
            <span className="text-slate-600 dark:text-slate-400 font-medium truncate">
              {currentStageNumber > 0 ? (
                <>
                  <strong className="text-slate-900 dark:text-white">
                    Stage {currentStageNumber}:
                  </strong>{" "}
                  {currentStageName}
                </>
              ) : (
                "Waiting for live data..."
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium shrink-0 ml-2">
          <span>Inspect Stream</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
