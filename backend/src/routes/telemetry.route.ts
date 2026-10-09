import { Router, Request, Response } from 'express';
import { telemetryService } from '../services/telemetry.service';

const router = Router();

/**
 * GET /api/pipeline/stream/:sessionId
 * Server-Sent Events (SSE) live stream for pipeline stage updates
 */
router.get('/stream/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId parameter is required' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send historical logs replay first
  try {
    const historicalLogs = await telemetryService.getLogs(sessionId);
    for (const log of historicalLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  } catch (err: any) {
    console.error(`Error sending historical logs for ${sessionId}:`, err.message);
  }

  // Subscribe to live telemetry updates
  const unsubscribe = telemetryService.subscribe(sessionId, (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (payload.status === 'COMPLETED' || payload.status === 'REJECTED') {
        // Pipeline reached terminal state
        setTimeout(() => {
          unsubscribe();
          res.end();
        }, 1000);
      }
    } catch (err: any) {
      console.error(`Error writing SSE to client for session ${sessionId}:`, err.message);
      unsubscribe();
    }
  });

  // Keep-alive heartbeat every 15 seconds
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
  });
});

export default router;
