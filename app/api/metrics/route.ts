import { type NextRequest } from 'next/server';
import { formatPrometheus, liveFeedGauges, type LayerProbe } from '../../../lib/metrics/prometheus';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LAYERS = ['aircraft', 'transit', 'quakes', 'tfr', 'augusta911', 'athens911', 'stations', 'streamgauges', 'micromobility'];

async function probe(origin: string, layer: string): Promise<LayerProbe> {
  const t0 = performance.now();
  try {
    const r = await fetch(`${origin}/api/ga-live-markers?layer=${layer}`, { signal: AbortSignal.timeout(45_000) });
    const body = r.ok ? ((await r.json()) as LayerProbe['body']) : null;
    return { layer, durationMs: performance.now() - t0, body };
  } catch {
    return { layer, durationMs: performance.now() - t0, body: null };
  }
}

export async function GET(request: NextRequest) {
  const probes = await Promise.all(LAYERS.map((l) => probe(request.nextUrl.origin, l)));
  const gauges = liveFeedGauges(probes, Date.now());
  gauges.push({
    name: 'nodejs_heap_used_bytes',
    help: 'V8 heap in use by the serverless instance that answered this scrape.',
    values: [{ value: process.memoryUsage().heapUsed }],
  });
  return new Response(formatPrometheus(gauges), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
