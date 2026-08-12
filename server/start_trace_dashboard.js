/**
 * server/start_trace_dashboard.js
 * 
 * Standalone, zero-dependency server to host the MCQ Pipeline Trace Dashboard & Replay Inspector.
 */

'use strict';

require('dotenv').config();
const express = require('express');
const PipelineTracer = require('./engine/tracing/pipelineTracer');
const { renderTraceDashboard } = require('./engine/tracing/dashboardRenderer');
const { replayPipeline } = require('./engine/tracing/replayEngine');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  const traces = PipelineTracer.listTraces(1);
  if (traces.length > 0) {
    res.redirect(`/admin/trace/${traces[0].requestId}`);
  } else {
    res.redirect('/admin/traces');
  }
});

app.get('/admin/traces', (req, res) => {
  try {
    const traces = PipelineTracer.listTraces(30);
    res.json({ success: true, count: traces.length, traces });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

app.get('/admin/trace/:requestId', (req, res) => {
  try {
    const trace = PipelineTracer.loadTrace(req.params.requestId);
    if (!trace) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; background: #0b0f19; color: #fff; padding: 40px;">
          <h2>⚠️ Trace Not Found</h2>
          <p>No trace file found for request ID: <code>${req.params.requestId}</code></p>
          <p><a href="/admin/traces" style="color: #60a5fa;">View List of Available Traces</a></p>
        </body>
        </html>
      `);
    }
    const html = renderTraceDashboard(trace);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Dashboard Error</h1><p>${err.message}</p>`);
  }
});

app.get('/admin/trace/:requestId/json', (req, res) => {
  try {
    const trace = PipelineTracer.loadTrace(req.params.requestId);
    if (!trace) {
      return res.status(404).json({ success: false, msg: 'Trace not found' });
    }
    res.json(trace);
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

app.post('/admin/trace/:requestId/replay', async (req, res) => {
  try {
    const replayResult = await replayPipeline(req.params.requestId);
    res.json({ success: true, ...replayResult });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n======================================================================`);
  console.log(`  🚀 MCQ PIPELINE TRACE DASHBOARD LIVE ON PORT ${PORT}                  `);
  console.log(`======================================================================`);
  console.log(`  👉 View Dashboard:  http://localhost:${PORT}/admin/trace/req_meta_ref_e2e`);
  console.log(`  👉 List All Traces: http://localhost:${PORT}/admin/traces`);
  console.log(`======================================================================\n`);
});
