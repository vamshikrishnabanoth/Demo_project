const express = require('express');
const router = express.Router();
const telemetryService = require('../services/telemetryService');

// SSE stream for pipeline updates
router.get('/stream/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Send historical logs replay
  try {
    const historicalLogs = await telemetryService.getLogs(sessionId);
    for (const log of historicalLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  } catch (err) {
    console.error(`Historical log replay error for ${sessionId}:`, err.message);
  }

  // Subscribe
  const unsubscribe = telemetryService.subscribe(sessionId, (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (payload.status === 'COMPLETED' || payload.status === 'REJECTED') {
        setTimeout(() => {
          unsubscribe();
          res.end();
        }, 1000);
      }
    } catch (err) {
      unsubscribe();
    }
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Logs endpoint
router.get('/logs/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const logs = await telemetryService.getLogs(sessionId);
    res.json({
      success: true,
      sessionId,
      count: logs.length,
      logs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
