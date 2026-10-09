import express from 'express';
import cors from 'cors';
import telemetryRoute from './routes/telemetry.route';
import pipelineLogsRoute from './routes/pipeline.logs.route';
import { MasterPipeline } from './pipeline/master.pipeline';

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mount telemetry routes
app.use('/api/pipeline', telemetryRoute);
app.use('/api/pipeline', pipelineLogsRoute);

// Endpoint to trigger pipeline execution
app.post('/api/pipeline/run', async (req, res) => {
  const { sessionId, files, targetQuestionCount, difficulty, strictAcademicityThreshold } = req.body;
  const sid = sessionId || `session_${Date.now()}`;

  // Run pipeline asynchronously
  const pipeline = new MasterPipeline({
    sessionId: sid,
    files: files || [],
    targetQuestionCount: targetQuestionCount || 5,
    difficulty: difficulty || 'Balanced',
    strictAcademicityThreshold: strictAcademicityThreshold || 0.60
  });

  // Start in background so stream can be observed live
  pipeline.run().catch(err => {
    console.error(`Pipeline run error for ${sid}:`, err);
  });

  res.json({
    success: true,
    message: 'Pipeline started',
    sessionId: sid
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'HalluciGuard Backend' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 HalluciGuard Telemetry Backend listening on port ${port}`);
  });
}

export default app;
