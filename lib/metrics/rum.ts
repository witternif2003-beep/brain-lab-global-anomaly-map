import type { Gauge } from './prometheus';

/** One browser report, sent every RUM_INTERVAL_MS by components/RenderMetricsProbe.tsx. */
export interface RumSample {
  page: string;
  fps: number;
  frameMsP95: number;
  heapBytes: number | null;
  netMbps: number | null;
  lidarPoints: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  touch: boolean;
}

export const RUM_INTERVAL_MS = 30_000;
const PAGES = new Set(['/godseye-telemetry', '/threat-globe', '/other']);
const WINDOW_MS = 5 * 60_000;
const MAX_SAMPLES = 2_000;

const num = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;

/** Validates an untrusted report; returns null when required fields are missing or out of range. */
export function parseRumSample(raw: unknown): RumSample | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fps = num(r.fps, 1_000);
  const frameMsP95 = num(r.frameMsP95, 60_000);
  if (fps === null || frameMsP95 === null) return null;
  const page = typeof r.page === 'string' && PAGES.has(r.page) ? r.page : '/other';
  return {
    page,
    fps,
    frameMsP95,
    heapBytes: num(r.heapBytes, 64 * 2 ** 30),
    netMbps: num(r.netMbps, 100_000),
    lidarPoints: num(r.lidarPoints, 1e9),
    lcpMs: num(r.lcpMs, 600_000),
    inpMs: num(r.inpMs, 600_000),
    cls: num(r.cls, 100),
    touch: r.touch === true,
  };
}

/** Rolling window of browser samples held by one server instance (not shared across serverless instances). */
export class RumWindow {
  private samples: { at: number; s: RumSample }[] = [];

  add(s: RumSample, now: number): void {
    this.samples.push({ at: now, s });
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
  }

  gauges(now: number): Gauge[] {
    this.samples = this.samples.filter((x) => now - x.at <= WINDOW_MS);
    const groups = new Map<string, RumSample[]>();
    for (const { s } of this.samples) {
      const k = `${s.page}|${s.touch ? 'touch' : 'desktop'}`;
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const series = (f: (xs: RumSample[]) => number | null) =>
      [...groups].map(([k, xs]) => {
        const [page, device] = k.split('|');
        return { labels: { page, device }, value: f(xs) };
      });
    const pct = (pick: (s: RumSample) => number | null, p: number) => (xs: RumSample[]) => {
      const v = xs.map(pick).filter((x): x is number => x !== null).sort((a, b) => a - b);
      return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
    };
    return [
      { name: 'map_render_fps', help: 'Median browser frame rate over the last 5 min (requestAnimationFrame, page visible).', values: series(pct((s) => s.fps, 0.5)) },
      { name: 'map_render_frame_ms_p95', help: 'p95 of per-report p95 frame time over the last 5 min.', values: series(pct((s) => s.frameMsP95, 0.95)) },
      { name: 'memory_heap_usage_bytes', help: 'Median browser JS heap (performance.memory, Chromium only) over the last 5 min.', values: series(pct((s) => s.heapBytes, 0.5)) },
      { name: 'network_io_throughput_mbps', help: 'Median browser download throughput from Resource Timing over the last 5 min.', values: series(pct((s) => s.netMbps, 0.5)) },
      { name: 'lidar_points_drawn', help: 'Median LiDAR points on screen when the layer is active.', values: series(pct((s) => s.lidarPoints, 0.5)) },
      { name: 'web_vitals_lcp_ms_p75', help: 'p75 Largest Contentful Paint.', values: series(pct((s) => s.lcpMs, 0.75)) },
      { name: 'web_vitals_inp_ms_p75', help: 'p75 Interaction to Next Paint.', values: series(pct((s) => s.inpMs, 0.75)) },
      { name: 'web_vitals_cls_p75', help: 'p75 Cumulative Layout Shift.', values: series(pct((s) => s.cls, 0.75)) },
      { name: 'rum_reports', help: 'Browser reports in the last 5 min held by this instance.', values: series((xs) => xs.length) },
    ];
  }
}

export const rumWindow = new RumWindow();
