import { NextRequest } from 'next/navigation';
import { telemetryService } from '../../../../../../../backend/src/services/telemetry.service';

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

  try {
    const logs = await telemetryService.getLogs(sessionId);
    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        count: logs.length,
        logs,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve logs',
        details: err.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
