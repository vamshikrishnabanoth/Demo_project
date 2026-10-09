import { Router, Request, Response } from 'express';
import { telemetryService } from '../services/telemetry.service';

const router = Router();

/**
 * GET /api/pipeline/logs/:sessionId
 * Fetch all persisted pipeline logs from MongoDB (or fallback cache) sorted by timestamp for replay
 */
router.get('/logs/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId parameter is required' });
  }

  try {
    const logs = await telemetryService.getLogs(sessionId);
    res.json({
      success: true,
      sessionId,
      count: logs.length,
      logs
    });
  } catch (err: any) {
    console.error(`Error retrieving pipeline logs for session ${sessionId}:`, err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline logs',
      details: err.message
    });
  }
});

export default router;
