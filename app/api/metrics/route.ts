import { type NextRequest } from 'next/server';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { formatPrometheus, liveFeedGauges, type LayerProbe } from '../../../lib/metrics/prometheus';
import { rumWindow } from '../../../lib/metrics/rum';

const tracer = trace.getTracer('brain-lab-metrics');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LAYERS = ['aircraft', 'transit', 'quakes', 'tfr', 'augusta911', 'athens911', 'stations', 'streamgauges', 'micromobility', 'pireps'];

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

export async function GET(request: NextRequest) {
  const probes = await Promise.all(LAYERS.map((l) => probe(request.nextUrl.origin, l)));
  const gauges = liveFeedGauges(probes, Date.now());
  gauges.push(
    {
      name: 'nodejs_heap_used_bytes',
      help: 'V8 heap in use by the server instance that answered this scrape.',
      values: [{ value: process.memoryUsage().heapUsed }],
    },
    ...rumWindow.gauges(Date.now()),
  );
  return new Response(formatPrometheus(gauges), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
