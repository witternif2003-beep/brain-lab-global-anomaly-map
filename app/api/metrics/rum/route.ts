import { trace } from '@opentelemetry/api';
import { parseRumSample, rumWindow } from '../../../../lib/metrics/rum';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 4_096) return Response.json({ error: 'report too large' }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: 'report must be JSON' }, { status: 400 });
  }
  const s = parseRumSample(raw);
  if (!s) return Response.json({ error: 'fps and frameMsP95 are required numbers' }, { status: 400 });
  rumWindow.add(s, Date.now());
  trace.getActiveSpan()?.setAttributes({
    'rum.page': s.page,
    'rum.device': s.touch ? 'touch' : 'desktop',
    'rum.fps': s.fps,
    'rum.frame_ms_p95': s.frameMsP95,
  });
  return new Response(null, { status: 204 });
}
