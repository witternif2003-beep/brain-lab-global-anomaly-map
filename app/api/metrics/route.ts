import { type NextRequest } from 'next/server';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { formatPrometheus, liveFeedGauges, type LayerProbe } from '../../../lib/metrics/prometheus';
import { rumWindow } from '../../../lib/metrics/rum';
import { bleGauges, type BleTrafficPayload } from '../../../lib/ble-traffic/aggregate';
import { movingGauges, type MovingTracksPayload } from '../../../lib/moving-tracks/parse';

const tracer = trace.getTracer('brain-lab-metrics');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LAYERS = ['aircraft', 'transit', 'quakes', 'tfr', 'augusta911', 'athens911', 'stations', 'streamgauges', 'micromobility', 'pireps', 'policereports'];

function probe(origin: string, layer: string): Promise<LayerProbe> {
  return tracer.startActiveSpan(`probe ${layer}`, async (span) => {
    const t0 = performance.now();
    span.setAttribute('ga.layer', layer);
    try {
      const r = await fetch(`${origin}/api/ga-live-markers?layer=${layer}`, { signal: AbortSignal.timeout(45_000) });
      const body = r.ok ? ((await r.json()) as LayerProbe['body']) : null;
      span.setAttributes({ 'http.response.status_code': r.status, 'ga.markers': body?.markers?.length ?? 0 });
      if (!body) span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${r.status}` });
      return { layer, durationMs: performance.now() - t0, body };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      return { layer, durationMs: performance.now() - t0, body: null };
    } finally {
      span.end();
    }
  });
}

async function probeBle(origin: string): Promise<BleTrafficPayload | null> {
  try {
    const r = await fetch(`${origin}/api/ble-traffic`, { signal: AbortSignal.timeout(30_000) });
    return r.ok ? ((await r.json()) as BleTrafficPayload) : null;
  } catch {
    return null;
  }
}

async function probeMoving(origin: string): Promise<MovingTracksPayload | null> {
  try {
    const r = await fetch(`${origin}/api/moving-tracks`, { signal: AbortSignal.timeout(30_000) });
    return r.ok ? ((await r.json()) as MovingTracksPayload) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const [probes, ble, moving] = await Promise.all([Promise.all(LAYERS.map((l) => probe(request.nextUrl.origin, l))), probeBle(request.nextUrl.origin), probeMoving(request.nextUrl.origin)]);
  const gauges = liveFeedGauges(probes, Date.now());
  gauges.push(
    {
      name: 'nodejs_heap_used_bytes',
      help: 'V8 heap in use by the server instance that answered this scrape.',
      values: [{ value: process.memoryUsage().heapUsed }],
    },
    ...bleGauges(ble),
    ...movingGauges(moving),
    ...rumWindow.gauges(Date.now()),
  );
  return new Response(formatPrometheus(gauges), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
