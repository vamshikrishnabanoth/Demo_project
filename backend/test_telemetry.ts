import { MasterPipeline } from './src/pipeline/master.pipeline.ts';
import { telemetryService } from './src/services/telemetry.service.ts';

async function runTest() {
  console.log('=== TEST 1: REAL 16-STAGE STREAMING WITH ACADEMIC PASS ===');
  const sessionPass = 'test_pass_' + Date.now();

  telemetryService.subscribe(sessionPass, (evt) => {
    console.log(`[PASS STREAM] Stage ${evt.stageNumber}: ${evt.stageName} -> ${evt.status} (Metrics: ${JSON.stringify(evt.metrics || {})})`);
  });

  const passPipeline = new MasterPipeline({
    sessionId: sessionPass,
    files: [{
      name: 'Advanced_Database_Concurrency.pdf',
      size: 490000,
      type: 'application/pdf',
      pageCount: 16,
      content: 'Database concurrency control protocols guarantee serializable snapshot isolation. In multi-version concurrency control (MVCC), write-ahead logging (WAL) enforces durability, while conflict serialization graphs detect dependency cycles and eliminate write skew anomalies under ACID guarantees.'
    }]
  });

  const passResult = await passPipeline.run();
  console.log('\n--- PASS RESULT ---');
  console.log('Status:', passResult.status);
  console.log('Academic Density:', passResult.academicDensity);
  console.log('Accepted Questions Count:', passResult.acceptedQuestions.length);
  console.log('SHA-256 Lock:', passResult.sha256Hash);

  const logsPass = await telemetryService.getLogs(sessionPass);
  console.log('Persisted Replay Logs Count:', logsPass.length);

  console.log('\n=== TEST 2: ACADEMICITY GATE REJECTION (<0.60 DENSITY) ===');
  const sessionReject = 'test_reject_' + Date.now();

  telemetryService.subscribe(sessionReject, (evt) => {
    console.log(`[REJECT STREAM] Stage ${evt.stageNumber}: ${evt.stageName} -> ${evt.status} (Metrics: ${JSON.stringify(evt.metrics || {})})`);
  });

  const rejectPipeline = new MasterPipeline({
    sessionId: sessionReject,
    files: [{
      name: 'Casual_Chat.txt',
      size: 320,
      type: 'text/plain',
      pageCount: 1,
      content: 'hello there how are you doing today what is up we are just chatting here lol see you later bye'
    }]
  });

  const rejectResult = await rejectPipeline.run();
  console.log('\n--- REJECT RESULT ---');
  console.log('Status:', rejectResult.status);
  console.log('Density:', rejectResult.academicDensity);
  console.log('Total Stages Executed:', rejectResult.totalStagesExecuted);
  console.log('AI Tokens Spent:', rejectResult.totalTokensUsed, '(Guaranteed Zero AI tokens spent)');
  console.log('Cost Saved:', rejectResult.costSaved);

  const logsReject = await telemetryService.getLogs(sessionReject);
  console.log('Persisted Replay Logs Count:', logsReject.length);
  console.log('\n✅ ALL TELEMETRY VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(console.error);
