import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrometheus } from '../../lib/metrics/prometheus';
import { RumWindow, parseRumSample } from '../../lib/metrics/rum';

const base = { page: '/godseye-telemetry', fps: 58, frameMsP95: 21, heapBytes: 2e8, netMbps: 12, lidarPoints: null, lidarGpuMsP95: null, splats: null, splatRenderer: null, webglContextLosses: null, lcpMs: 900, inpMs: 80, cls: 0.01, touch: true };

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

test('webgl_context_losses sums per-report losses and is absent without a map', () => {
  const now = Date.now();
  const w = new RumWindow();
  w.add(parseRumSample({ ...base, webglContextLosses: 1 })!, now);
  w.add(parseRumSample({ ...base, webglContextLosses: 2 })!, now);
  w.add(parseRumSample({ ...base, page: '/lidar-splat' })!, now);
  const text = formatPrometheus(w.gauges(now));
  assert.match(text, /webgl_context_losses\{page="\/godseye-telemetry",device="touch"\} 3/);
  assert.doesNotMatch(text, /webgl_context_losses\{page="\/lidar-splat"/);
  assert.equal(parseRumSample({ ...base, webglContextLosses: -1 })?.webglContextLosses, null);
});

test("RUM counts page crashes and safe-mode devices", () => {
  const w = new RumWindow();
  const now = 1_000_000;
  w.add(parseRumSample({ ...base, pageCrashes: 1, gpuSafeMode: true })!, now);
  w.add(parseRumSample({ ...base, pageCrashes: 0, gpuSafeMode: false })!, now);
  const g = w.gauges(now);
  assert.equal(g.find((x) => x.name === "map_page_crashes")?.values[0].value, 1);
  assert.equal(g.find((x) => x.name === "map_gpu_safe_mode_ratio")?.values[0].value, 0.5);
  assert.equal(parseRumSample({ ...base, pageCrashes: -2 })?.pageCrashes, null);
});

test('main-thread blocking and deck.gl frame-time fields: range checks, Safari nulls and gauges', () => {
  const now = 1_000_000;
  const w = new RumWindow();
  w.add(parseRumSample({ ...base, touch: false, blockingMs: 120, longTasks: 3, deckGpuMsPerFrame: 2.5, deckCpuMsPerFrame: 1.25 })!, now);
  w.add(parseRumSample({ ...base, touch: false, blockingMs: 0, longTasks: 0, deckGpuMsPerFrame: 0, deckCpuMsPerFrame: 0.5 })!, now);
  w.add(parseRumSample({ ...base, touch: false, blockingMs: null, longTasks: null })!, now);
  const g = w.gauges(now);
  const v = (name: string) => g.find((x) => x.name === name)?.values[0]?.value;
  assert.equal(v('main_thread_blocking_ms_p95'), 120);
  assert.equal(v('main_thread_long_tasks'), 3);
  assert.equal(v('deck_gpu_ms_per_frame_p95'), 2.5);
  assert.equal(v('deck_cpu_ms_per_frame_p95'), 1.25);
  assert.equal(parseRumSample({ ...base, blockingMs: -1 })?.blockingMs, null);
  assert.equal(parseRumSample({ ...base, blockingMs: 31_000 })?.blockingMs, null);
  assert.equal(parseRumSample({ ...base, deckGpuMsPerFrame: Number.NaN })?.deckGpuMsPerFrame, null);
  const safari = new RumWindow();
  safari.add(parseRumSample({ ...base, blockingMs: null, longTasks: null })!, now);
  const sg = safari.gauges(now);
  assert.equal(sg.find((x) => x.name === 'main_thread_blocking_ms_p95')?.values[0]?.value, null);
  assert.equal(sg.find((x) => x.name === 'main_thread_long_tasks')?.values[0]?.value, null);
});
