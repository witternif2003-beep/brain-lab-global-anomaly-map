import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrometheus } from '../../lib/metrics/prometheus';
import { RumWindow, parseRumSample } from '../../lib/metrics/rum';

const base = { page: '/godseye-telemetry', fps: 58, frameMsP95: 21, heapBytes: 2e8, netMbps: 12, lidarPoints: null, lidarGpuMsP95: null, splats: null, splatRenderer: null, lcpMs: 900, inpMs: 80, cls: 0.01, touch: true };

test('parseRumSample rejects missing or out-of-range frame data and buckets unknown pages', () => {
  assert.equal(parseRumSample({ ...base, fps: -1 }), null);
  assert.equal(parseRumSample({ page: '/x' }), null);
  assert.equal(parseRumSample({ ...base, page: '/secret/path' })?.page, '/other');
  assert.equal(parseRumSample({ ...base, heapBytes: 'big' })?.heapBytes, null);
});

test('RumWindow reports medians per page/device and drops samples older than 5 min', () => {
  const w = new RumWindow();
  const now = 10_000_000;
  w.add({ ...base, fps: 30 }, now - 6 * 60_000);
  for (const fps of [50, 55, 60]) w.add({ ...base, fps }, now);
  const text = formatPrometheus(w.gauges(now));
  assert.match(text, /map_render_fps\{page="\/godseye-telemetry",device="touch"\} 55/);
  assert.match(text, /rum_reports\{page="\/godseye-telemetry",device="touch"\} 3/);
  assert.doesNotMatch(text, /lidar_points_drawn\{/);
});

test('lidar_gpu_ms_p95 is reported only from samples that carry a GPU timer value', () => {
  const w = new RumWindow();
  const now = 10_000_000;
  w.add({ ...base, touch: false }, now);
  w.add({ ...base, touch: false, lidarGpuMsP95: 4.2 }, now);
  const text = formatPrometheus(w.gauges(now));
  assert.match(text, /lidar_gpu_ms_p95\{page="\/godseye-telemetry",device="desktop"\} 4.2/);
  assert.equal(parseRumSample({ ...base, lidarGpuMsP95: -3 })?.lidarGpuMsP95, null);
});

test('splat viewer fields: renderer whitelist and WebGPU share', () => {
  const now = Date.now();
  const w = new RumWindow();
  const splat = { ...base, page: '/lidar-splat', touch: false, splats: 900_000 };
  w.add(parseRumSample({ ...splat, splatRenderer: 'webgpu' })!, now);
  w.add(parseRumSample({ ...splat, splatRenderer: 'webgl2' })!, now);
  assert.equal(parseRumSample({ ...splat, splatRenderer: 'metal' })?.splatRenderer, null);
  const g = w.gauges(now);
  const ratio = g.find((x) => x.name === 'gaussian_splat_webgpu_ratio')!.values[0];
  assert.deepEqual(ratio.labels, { page: '/lidar-splat', device: 'desktop' });
  assert.equal(ratio.value, 0.5);
  assert.equal(g.find((x) => x.name === 'gaussian_splats_drawn')!.values[0].value, 900_000);
});
