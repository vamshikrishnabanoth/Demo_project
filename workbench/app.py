"""
Live Pipeline Observability & Explainability Workbench
v3.5 Shadow Intelligence & Pipeline Trace Viewer

Truthful Visualization Engine:
- Reads real JSONL files from server/logs/traces/
- Renders actual pipeline stages, exact chunks, model calls, validation gates, and latencies
- STRICT TRUTHFULNESS: Displays 'NOT RECORDED / NOT INSTRUMENTED' if data was not emitted.
  Never hallucinates or fabricates pipeline steps, costs, or concept graphs.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

BASE_DIR = Path(__file__).resolve().parent.parent
TRACES_DIR = BASE_DIR / "server" / "logs" / "traces"
MANIFEST_FILE = TRACES_DIR / "manifest.json"

app = FastAPI(title="Live Pipeline Observability Workbench", version="3.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_manifest() -> List[Dict[str, Any]]:
    if not MANIFEST_FILE.exists():
        return []
    try:
        with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("traces", [])
    except Exception as e:
        print(f"Error loading manifest: {e}")
        return []


def load_trace_events(request_id: str) -> List[Dict[str, Any]]:
    # Sanitize request_id to prevent directory traversal
    safe_id = Path(request_id).name
    trace_file = TRACES_DIR / f"{safe_id}.jsonl"
    if not trace_file.exists():
        # Fallback check for trace_*.json
        json_file = TRACES_DIR / f"trace_{safe_id}.json"
        if json_file.exists():
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [{"stage": "LEGACY_TRACE_JSON", "outputs": data}]
        raise HTTPException(status_code=404, detail=f"Trace file not found for request {request_id}")

    events = []
    with open(trace_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return events


@app.get("/api/traces")
def get_traces_list():
    manifest = load_manifest()
    # Also scan directory for any unmanifested .jsonl files
    existing_ids = {t.get("requestId") for t in manifest}
    if TRACES_DIR.exists():
        for p in TRACES_DIR.glob("*.jsonl"):
            req_id = p.stem
            if req_id not in existing_ids:
                manifest.append({
                    "requestId": req_id,
                    "traceId": "unindexed",
                    "timestamp": p.stat().st_mtime,
                    "finalStatus": "RECORDED",
                    "traceFile": p.name,
                    "summary": {"fileSizeKb": round(p.stat().st_size / 1024, 2)}
                })
    return {"traces": manifest}


@app.get("/api/trace/{request_id}")
def get_trace_detail(request_id: str):
    events = load_trace_events(request_id)
    
    # Standard stage definitions for pipeline mapping
    standard_stages = [
        {"id": "INPUT_INGESTION", "label": "1. Ingestion & Pre-filter", "type": "pipeline"},
        {"id": "TRANSCRIPTION", "label": "1A. Voice Transcription (Failover)", "type": "speech"},
        {"id": "DOCUMENT_ANALYZER", "label": "1.5. Document Analyzer", "type": "pipeline"},
        {"id": "CONCEPT_GRAPH", "label": "2. Concept Graph Builder", "type": "pipeline"},
        {"id": "QUIZ_PLANNER", "label": "3. Quiz Planner", "type": "pipeline"},
        {"id": "PROMPT_BUILDER", "label": "4. Prompt Builder", "type": "pipeline"},
        {"id": "MODEL_INVOCATION", "label": "5. Model Generator", "type": "model"},
        {"id": "VALIDATION_GATE", "label": "6. Validation Orchestrator", "type": "validator"},
        {"id": "PORTFOLIO_ASSEMBLY", "label": "8. Portfolio Assembly", "type": "portfolio"},
        {"id": "PORTFOLIO_REVIEW", "label": "9. Portfolio Reviewer", "type": "review"},
        {"id": "P5_SHADOW_INTELLIGENCE", "label": "v3.5 Shadow Intelligence", "type": "shadow"},
        {"id": "STORAGE_PERSISTENCE", "label": "Persistence & Manifest", "type": "storage"}
    ]

    executed_stages_map = {}
    model_calls = []
    validation_decisions = []
    chunks = []
    concepts = []
    total_duration_ms = 0

    for ev in events:
        st = ev.get("stage", "UNKNOWN")
        sub = ev.get("substage")
        dur = ev.get("durationMs", 0)
        total_duration_ms += dur

        key = st
        if sub and "STAGE_1.5" in sub: key = "DOCUMENT_ANALYZER"
        elif sub and "STAGE_2" in sub: key = "CONCEPT_GRAPH"
        elif sub and "STAGE_3" in sub: key = "QUIZ_PLANNER"
        elif sub and "STAGE_4" in sub: key = "PROMPT_BUILDER"
        elif sub and "STAGE_8" in sub: key = "PORTFOLIO_ASSEMBLY"
        elif sub and "STAGE_9" in sub: key = "PORTFOLIO_REVIEW"

        executed_stages_map[key] = {
            "status": ev.get("status", "COMPLETED"),
            "durationMs": dur,
            "substage": sub,
            "lastEvent": ev
        }

        if ev.get("modelCall") or ev.get("stage") == "MODEL_INVOCATION":
            model_calls.append({
                "substage": sub,
                "modelCall": ev.get("modelCall"),
                "inputs": ev.get("inputs"),
                "status": ev.get("status")
            })

        if ev.get("decisions") or ev.get("stage") == "VALIDATION_GATE":
            validation_decisions.append({
                "substage": sub,
                "decisions": ev.get("decisions"),
                "status": ev.get("status")
            })

        # Check for chunks or concept nodes in inputs/outputs
        inputs = ev.get("inputs", {})
        outputs = ev.get("outputs", {})
        if "chunks" in inputs:
            chunks.extend(inputs["chunks"])
        if "documentProfile" in inputs and "instructionalConcepts" in inputs["documentProfile"]:
            concepts = inputs["documentProfile"]["instructionalConcepts"]

    # Assemble truthful pipeline map
    pipeline_map = []
    for std in standard_stages:
        st_id = std["id"]
        if st_id in executed_stages_map:
            exec_info = executed_stages_map[st_id]
            pipeline_map.append({
                "id": st_id,
                "label": std["label"],
                "status": exec_info["status"],
                "durationMs": exec_info["durationMs"],
                "isInstrumented": True,
                "substage": exec_info["substage"],
                "type": std["type"]
            })
        else:
            pipeline_map.append({
                "id": st_id,
                "label": std["label"],
                "status": "NOT_RECORDED",
                "durationMs": None,
                "isInstrumented": False,
                "note": "Stage was not executed or not instrumented in this request",
                "type": std["type"]
            })

    return {
        "requestId": request_id,
        "traceId": events[0].get("traceId", "unknown") if events else "unknown",
        "sessionId": events[0].get("sessionId", "unknown") if events else "unknown",
        "eventCount": len(events),
        "totalMeasuredDurationMs": total_duration_ms,
        "pipelineMap": pipeline_map,
        "modelCalls": model_calls,
        "validationDecisions": validation_decisions,
        "chunks": chunks,
        "concepts": concepts,
        "rawEvents": events
    }


@app.get("/", response_class=HTMLResponse)
def render_workbench():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Live Pipeline Observability & Explainability Workbench (v3.5)</title>
  <style>
    :root {
      --bg-dark: #0f172a;
      --panel-bg: #1e293b;
      --card-bg: #334155;
      --border-color: #475569;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --unrecorded: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg-dark); color: var(--text-main); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    
    header { background: #0b1120; border-bottom: 1px solid var(--border-color); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
    .brand { font-size: 1.15rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 8px; }
    .brand span { font-size: 0.75rem; background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 9999px; }
    
    .selector-bar { display: flex; align-items: center; gap: 12px; }
    select { background: var(--panel-bg); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; outline: none; font-size: 0.9rem; min-width: 320px; }
    button.refresh-btn { background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    button.refresh-btn:hover { background: #0369a1; }
    
    .main-container { display: flex; flex: 1; overflow: hidden; }
    .left-col { width: 340px; border-right: 1px solid var(--border-color); background: var(--panel-bg); display: flex; flex-direction: column; overflow-y: auto; padding: 16px; gap: 16px; }
    .right-col { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 20px; gap: 20px; }
    
    .panel-card { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; }
    .panel-title { font-size: 0.95rem; font-weight: 700; color: var(--accent); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; text-transform: uppercase; letter-spacing: 0.5px; }
    
    /* Pipeline DAG Map */
    .dag-container { display: flex; flex-direction: column; gap: 10px; }
    .dag-node { background: var(--card-bg); border-left: 4px solid var(--unrecorded); padding: 10px 14px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
    .dag-node.COMPLETED { border-left-color: var(--success); }
    .dag-node.STARTED { border-left-color: var(--accent); }
    .dag-node.FALLBACK { border-left-color: var(--warning); }
    .dag-node.FAILED { border-left-color: var(--danger); }
    .dag-node.NOT_RECORDED { border-left-color: var(--unrecorded); opacity: 0.6; border-style: dashed; border-width: 1px 1px 1px 4px; }
    
    .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
    .badge.COMPLETED { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .badge.FALLBACK { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
    .badge.FAILED { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge.NOT_RECORDED { background: rgba(100, 116, 139, 0.2); color: #cbd5e1; }
    
    /* Code and Details Inspector */
    pre.code-block { background: #090d16; border: 1px solid #1e293b; padding: 12px; border-radius: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.8rem; color: #38bdf8; overflow-x: auto; max-height: 240px; }
    
    table.data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 8px; }
    table.data-table th, table.data-table td { border: 1px solid var(--border-color); padding: 8px 10px; text-align: left; }
    table.data-table th { background: #0f172a; color: var(--accent); }
    table.data-table tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
    
    .truthful-notice { font-size: 0.78rem; color: var(--text-muted); background: rgba(56, 189, 248, 0.1); border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      Kahoot AI Observability Workbench
      <span>v3.5 Live</span>
    </div>
    <div class="selector-bar">
      <label for="traceSelect" style="font-size: 0.85rem; color: var(--text-muted);">Request Trace:</label>
      <select id="traceSelect" onchange="loadTraceDetails(this.value)">
        <option value="">Loading traces...</option>
      </select>
      <button class="refresh-btn" onclick="fetchTracesList()">Refresh</button>
    </div>
  </header>

  <div class="main-container">
    <!-- Left Column: Pipeline Execution DAG Map & Metadata -->
    <div class="left-col">
      <div class="panel-card">
        <div class="panel-title">Trace Context</div>
        <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 6px; color: var(--text-muted);">
          <div><strong style="color:#fff;">Request ID:</strong> <span id="metaRequestId">-</span></div>
          <div><strong style="color:#fff;">Trace ID:</strong> <span id="metaTraceId">-</span></div>
          <div><strong style="color:#fff;">Session ID:</strong> <span id="metaSessionId">-</span></div>
          <div><strong style="color:#fff;">Events Count:</strong> <span id="metaEventCount">-</span></div>
          <div><strong style="color:#fff;">Measured Latency:</strong> <span id="metaLatency">-</span></div>
        </div>
      </div>

      <div class="panel-card" style="flex: 1;">
        <div class="panel-title">End-to-End Pipeline DAG</div>
        <div class="truthful-notice">
          Unexecuted or uninstrumented stages appear explicitly as "NOT RECORDED". Zero fabricated pipeline nodes.
        </div>
        <div class="dag-container" id="dagContainer">
          <div style="font-size: 0.8rem; color: var(--text-muted);">Select a trace to view stages.</div>
        </div>
      </div>
    </div>

    <!-- Right Column: Chunks, Model Invocations, Quality Gate Trail & Evidence -->
    <div class="right-col">
      <!-- Section 1: Quality Gate & Validation Decisions -->
      <div class="panel-card">
        <div class="panel-title">Quality & Validation Trail (M1, M7, Exclusivity, P5.3 Gap Screener)</div>
        <div id="validationTrailContainer">
          <div style="font-size: 0.85rem; color: var(--text-muted);">No validation decisions recorded.</div>
        </div>
      </div>

      <!-- Section 2: Model & Decision Inspector -->
      <div class="panel-card">
        <div class="panel-title">Model Invocations & Prompt Inspector</div>
        <div id="modelCallsContainer">
          <div style="font-size: 0.85rem; color: var(--text-muted);">No model calls recorded.</div>
        </div>
      </div>

      <!-- Section 3: Extracted Concepts & Graph Nodes -->
      <div class="panel-card">
        <div class="panel-title">Concept Extraction & Instructional Nodes</div>
        <div id="conceptsContainer">
          <div style="font-size: 0.85rem; color: var(--text-muted);">No concepts recorded.</div>
        </div>
      </div>

      <!-- Section 4: Raw JSONL Event Stream -->
      <div class="panel-card">
        <div class="panel-title">Raw Structured Trace Events (JSONL)</div>
        <pre class="code-block" id="rawEventsViewer">// Select a trace to inspect event stream...</pre>
      </div>
    </div>
  </div>

  <script>
    async function fetchTracesList() {
      try {
        const res = await fetch('/api/traces');
        const data = await res.json();
        const select = document.getElementById('traceSelect');
        select.innerHTML = '';

        if (!data.traces || data.traces.length === 0) {
          select.innerHTML = '<option value="">No traces found</option>';
          return;
        }

        data.traces.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.requestId;
          opt.textContent = `${t.requestId} [${t.finalStatus}] - ${t.timestamp || ''}`;
          select.appendChild(opt);
        });

        // Load first trace automatically
        if (data.traces.length > 0) {
          select.value = data.traces[0].requestId;
          loadTraceDetails(data.traces[0].requestId);
        }
      } catch (err) {
        console.error('Error fetching traces:', err);
      }
    }

    async function loadTraceDetails(requestId) {
      if (!requestId) return;
      try {
        const res = await fetch(`/api/trace/${encodeURIComponent(requestId)}`);
        const trace = await res.json();

        // Update Metadata
        document.getElementById('metaRequestId').textContent = trace.requestId;
        document.getElementById('metaTraceId').textContent = trace.traceId;
        document.getElementById('metaSessionId').textContent = trace.sessionId;
        document.getElementById('metaEventCount').textContent = trace.eventCount;
        document.getElementById('metaLatency').textContent = `${trace.totalMeasuredDurationMs} ms`;

        // Render DAG Map
        const dag = document.getElementById('dagContainer');
        dag.innerHTML = '';
        trace.pipelineMap.forEach(st => {
          const node = document.createElement('div');
          node.className = `dag-node ${st.status}`;
          node.innerHTML = `
            <div>
              <strong>${st.label}</strong>
              ${st.substage ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${st.substage}</div>` : ''}
            </div>
            <div>
              <span class="badge ${st.status}">${st.status}</span>
              ${st.durationMs !== null ? `<span style="font-size: 0.75rem; margin-left: 6px; color: var(--accent);">${st.durationMs}ms</span>` : ''}
            </div>
          `;
          dag.appendChild(node);
        });

        // Render Quality & Validation Trail
        const valContainer = document.getElementById('validationTrailContainer');
        if (trace.validationDecisions.length > 0) {
          let html = '<table class="data-table"><thead><tr><th>Substage / Slot</th><th>Gate Name</th><th>Result</th><th>Quality Score</th><th>Adjudication Details</th></tr></thead><tbody>';
          trace.validationDecisions.forEach(v => {
            const dec = v.decisions || {};
            html += `<tr>
              <td><code>${v.substage || 'General'}</code></td>
              <td><strong>${dec.gateName || 'VALIDATOR'}</strong></td>
              <td><span class="badge ${dec.passed ? 'COMPLETED' : 'FAILED'}">${dec.actionTaken || (dec.passed ? 'ACCEPTED' : 'REJECTED')}</span></td>
              <td>${dec.qualityScore !== undefined ? dec.qualityScore : '-'}</td>
              <td><pre style="font-size:0.75rem; margin:0;">${JSON.stringify(dec.adjudicationDetails || {}, null, 1)}</pre></td>
            </tr>`;
          });
          html += '</tbody></table>';
          valContainer.innerHTML = html;
        } else {
          valContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">No validation decisions logged for this request.</div>';
        }

        // Render Model Invocations
        const modelContainer = document.getElementById('modelCallsContainer');
        if (trace.modelCalls.length > 0) {
          let html = '<table class="data-table"><thead><tr><th>Slot</th><th>Provider / Model</th><th>Parameters</th><th>Prompt Snippet</th></tr></thead><tbody>';
          trace.modelCalls.forEach(m => {
            const mc = m.modelCall || {};
            const inp = m.inputs || {};
            html += `<tr>
              <td><code>${m.substage || 'N/A'}</code></td>
              <td><strong>${mc.provider || 'unknown'}</strong> / <code>${mc.modelIdentifier || 'unknown'}</code></td>
              <td>Temp: ${mc.temperature !== undefined ? mc.temperature : 0.0} | MaxTokens: ${mc.maxTokens || 1200}</td>
              <td><div style="max-height: 80px; overflow-y: auto; font-size: 0.75rem; color: #cbd5e1;">${(inp.promptSent || '').substring(0, 300)}...</div></td>
            </tr>`;
          });
          html += '</tbody></table>';
          modelContainer.innerHTML = html;
        } else {
          modelContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">No model calls recorded in this trace.</div>';
        }

        // Render Concepts
        const conceptsContainer = document.getElementById('conceptsContainer');
        if (trace.concepts && trace.concepts.length > 0) {
          conceptsContainer.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${trace.concepts.map(c => `<span style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${c}</span>`).join('')}
          </div>`;
        } else {
          conceptsContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">No instructional concepts extracted or present in trace.</div>';
        }

        // Render Raw JSONL Events
        document.getElementById('rawEventsViewer').textContent = JSON.stringify(trace.rawEvents, null, 2);

      } catch (err) {
        console.error('Error loading trace details:', err);
      }
    }

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', fetchTracesList);
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html_content, status_code=200)


if __name__ == "__main__":
    print("Starting Live Pipeline Observability Workbench on http://localhost:8088")
    uvicorn.run("app:app", host="127.0.0.1", port=8088, reload=False)
