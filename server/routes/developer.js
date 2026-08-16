/**
 * server/routes/developer.js
 *
 * Developer Observability & Debug Routes:
 * Allows ANY team member to inspect live/recorded session traces and logs directly
 * from the deployed website without needing Railway account credentials.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DEBUG_SESSIONS_DIR = path.resolve(__dirname, '../logs/debug/sessions');

// Helper to ensure debug sessions dir exists
function getDebugDir() {
  if (!fs.existsSync(DEBUG_SESSIONS_DIR)) {
    fs.mkdirSync(DEBUG_SESSIONS_DIR, { recursive: true });
  }
  return DEBUG_SESSIONS_DIR;
}

// @route   GET /api/developer/sessions
// @desc    List all recorded debug sessions with summary metadata
router.get('/sessions', async (req, res) => {
  try {
    const dir = getDebugDir();
    const sessionDirs = await fs.promises.readdir(dir);

    const summaries = await Promise.all(
      sessionDirs.map(async (sessId) => {
        const sessPath = path.join(dir, sessId);
        const stat = await fs.promises.stat(sessPath);
        if (!stat.isDirectory()) return null;

        const traceFile = path.join(sessPath, 'final_session_trace.json');
        let meta = { sessionId: sessId, createdAt: stat.mtime };

        if (fs.existsSync(traceFile)) {
          try {
            const raw = await fs.promises.readFile(traceFile, 'utf-8');
            const data = JSON.parse(raw);
            meta = {
              ...meta,
              pipelineStatus: 'COMPLETED',
              totalDurationMs: data.totalDurationMs,
              deliveredCount: data.metrics?.deliveredCount,
              acceptanceRate: data.metrics?.acceptanceRatePercent,
              avgGroundingScore: data.metrics?.avgGroundingScore,
              tcScore: data.metrics?.tcScoreBreakdown?.total,
              stageCount: (data.stageExecutionTimeline || []).length
            };
          } catch (e) {
            // fallback
          }
        }
        return meta;
      })
    );

    const validSummaries = summaries.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, count: validSummaries.length, sessions: validSummaries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   GET /api/developer/sessions/:sessionId
// @desc    Get full session trace or list of stage files
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const sessPath = path.join(getDebugDir(), req.params.sessionId);
    if (!fs.existsSync(sessPath)) {
      return res.status(404).json({ success: false, msg: 'Session not found' });
    }

    const files = await fs.promises.readdir(sessPath);
    const traceFile = path.join(sessPath, 'final_session_trace.json');

    if (fs.existsSync(traceFile)) {
      const raw = await fs.promises.readFile(traceFile, 'utf-8');
      return res.json({ success: true, files, trace: JSON.parse(raw) });
    }

    res.json({ success: true, files, msg: 'Session in progress or partial' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   GET /api/developer/sessions/:sessionId/:filename
// @desc    Get specific stage debug snapshot JSON (e.g. 03_agent_1_planning.json)
router.get('/sessions/:sessionId/:filename', async (req, res) => {
  try {
    const filePath = path.join(getDebugDir(), req.params.sessionId, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, msg: 'Stage log file not found' });
    }

    const raw = await fs.promises.readFile(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(raw);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   GET /api/developer/ui
// @desc    Lightweight interactive Developer Debug Dashboard UI (accessible to any teammate!)
router.get('/ui', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>⚡ Pipeline Observability & Session Debugger</title>
  <style>
    :root { --bg: #0f172a; --panel: #1e293b; --text: #f8fafc; --accent: #38bdf8; --border: #334155; --pass: #4ade80; --warn: #fbbf24; --fail: #f87171; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    body { background: var(--bg); color: var(--text); padding: 24px; }
    h1 { color: var(--accent); margin-bottom: 8px; font-size: 22px; display: flex; align-items: center; gap: 10px; }
    .subtitle { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; height: calc(100vh - 100px); }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
    .panel-header { padding: 12px 16px; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border); font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
    .session-list { overflow-y: auto; flex: 1; }
    .session-card { padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
    .session-card:hover { background: #334155; }
    .session-card.active { background: #0369a1; border-left: 4px solid var(--accent); }
    .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #334155; }
    .badge-pass { background: #166534; color: var(--pass); }
    .viewer { padding: 20px; overflow-y: auto; flex: 1; font-size: 13px; line-height: 1.5; }
    pre { background: #0b0f19; padding: 16px; border-radius: 6px; border: 1px solid var(--border); overflow-x: auto; color: #a5f3fc; }
    .stage-pill { display: inline-block; padding: 4px 8px; margin: 4px 4px 4px 0; border-radius: 4px; background: #334155; cursor: pointer; font-size: 12px; }
    .stage-pill:hover { background: var(--accent); color: #000; }
    .refresh-btn { background: var(--accent); color: #0f172a; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>
  <h1>⚡ Architecture Baseline v1.0 — Session Debugger</h1>
  <div class="subtitle">Real-time pipeline observability, TC calculations, Agent decisions, and 7-Point MCQ audit trails.</div>

  <div class="grid">
    <div class="panel">
      <div class="panel-header">
        <span>Recorded Sessions</span>
        <button class="refresh-btn" onclick="loadSessions()">↻ Refresh</button>
      </div>
      <div class="session-list" id="sessionList">Loading sessions...</div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <span id="activeSessionTitle">Select a Session</span>
        <span id="sessionStatus"></span>
      </div>
      <div class="viewer" id="sessionViewer">
        <p style="color: #64748b;">Select a session on the left to inspect its complete execution trace, stage calculations, decisions (WHY), and delivered MCQs.</p>
      </div>
    </div>
  </div>

  <script>
    let activeSession = null;

    async function loadSessions() {
      const listEl = document.getElementById('sessionList');
      listEl.innerHTML = '<div style="padding:16px;color:#94a3b8;">Fetching sessions...</div>';
      try {
        const res = await fetch('/api/developer/sessions');
        const data = await res.json();
        if (!data.sessions || data.sessions.length === 0) {
          listEl.innerHTML = '<div style="padding:16px;color:#94a3b8;">No sessions recorded yet. Generate a quiz on the website to see it appear here!</div>';
          return;
        }
        listEl.innerHTML = data.sessions.map(s => \`
          <div class="session-card \${activeSession === s.sessionId ? 'active' : ''}" onclick="selectSession('\${s.sessionId}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong style="color:var(--accent);">\${s.sessionId}</strong>
              <span class="badge badge-pass">\${s.deliveredCount || 0} MCQs</span>
            </div>
            <div style="font-size:11px; color:#94a3b8;">
              \${new Date(s.createdAt).toLocaleTimeString()} | TC: \${s.tcScore || 'N/A'} | Dur: \${s.totalDurationMs ? s.totalDurationMs + 'ms' : 'active'}
            </div>
          </div>
        \`).join('');
      } catch (err) {
        listEl.innerHTML = '<div style="padding:16px;color:var(--fail);">Failed to load sessions: ' + err.message + '</div>';
      }
    }

    async function selectSession(sessId) {
      activeSession = sessId;
      document.getElementById('activeSessionTitle').innerText = 'Session: ' + sessId;
      const viewerEl = document.getElementById('sessionViewer');
      viewerEl.innerHTML = '<div style="color:#94a3b8;">Loading stage snapshots for ' + sessId + '...</div>';
      loadSessions();

      try {
        const res = await fetch('/api/developer/sessions/' + sessId);
        const data = await res.json();

        let stageFilesHtml = '<div style="margin-bottom:16px;"><strong>Stage Snapshots:</strong><br>';
        (data.files || []).forEach(f => {
          stageFilesHtml += \`<span class="stage-pill" onclick="loadStageFile('\${sessId}', '\${f}')">\${f}</span>\`;
        });
        stageFilesHtml += '</div>';

        viewerEl.innerHTML = stageFilesHtml + '<div id="fileContent"><pre>' + JSON.stringify(data.trace || data, null, 2) + '</pre></div>';
      } catch (err) {
        viewerEl.innerHTML = '<div style="color:var(--fail);">Error loading session: ' + err.message + '</div>';
      }
    }

    async function loadStageFile(sessId, filename) {
      const targetEl = document.getElementById('fileContent');
      targetEl.innerHTML = '<div style="color:#94a3b8;">Loading ' + filename + '...</div>';
      try {
        const res = await fetch('/api/developer/sessions/' + sessId + '/' + filename);
        const json = await res.json();
        targetEl.innerHTML = \`
          <h3 style="color:var(--accent); margin-bottom:10px;">📄 Snapshot: \${filename}</h3>
          <pre>\${JSON.stringify(json, null, 2)}</pre>
        \`;
      } catch (err) {
        targetEl.innerHTML = '<div style="color:var(--fail);">Failed to load file: ' + err.message + '</div>';
      }
    }

    loadSessions();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = router;
