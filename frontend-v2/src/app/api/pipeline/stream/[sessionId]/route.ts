import { NextRequest } from 'next/navigation';
import { telemetryService, StageUpdatePayload } from '../../../../../../../backend/src/services/telemetry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Send historical replay logs first
      try {
        const historicalLogs = await telemetryService.getLogs(sessionId);
        for (const log of historicalLogs) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`));
        }
      } catch (err: any) {
        console.error(`Error loading replay logs for session ${sessionId}:`, err.message);
      }

      // 2. Subscribe to live telemetry updates
      let isClosed = false;
      let unsubscribe: (() => void) | null = null;

      const handleUpdate = (payload: StageUpdatePayload) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          if (payload.status === 'COMPLETED' || payload.status === 'REJECTED') {
            setTimeout(() => {
              if (!isClosed) {
                isClosed = true;
                if (unsubscribe) unsubscribe();
                controller.close();
              }
            }, 1000);
          }
        } catch (err) {
          isClosed = true;
          if (unsubscribe) unsubscribe();
        }
      };

      unsubscribe = telemetryService.subscribe(sessionId, handleUpdate);

      // Heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch (_) {
          clearInterval(heartbeatInterval);
          isClosed = true;
          if (unsubscribe) unsubscribe();
        }
      }, 15000);
    },
    cancel() {
      // Clean up when client disconnects
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
