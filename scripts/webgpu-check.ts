/// <reference types="@webgpu/types" />
// WebGPU rasterizer correctness checks against a CPU reference.
// Usage: WEBGPU_NODE=/path/to/node_modules/webgpu/index.js npx tsx scripts/webgpu-check.ts
// Needs Dawn's Node bindings (npm `webgpu`) and a Vulkan driver. Exit 0 = all pass, 1 = fail, 2 = no GPU.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createPointRasterizer, packPoints } from '../lib/webgpu/point-raster';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
// Dawn frees the device when its GPU instance is garbage-collected, so keep a reference.
let gpuInstance: GPU | undefined;
const checks: [string, (gpu: GPUDevice) => Promise<void>][] = [];
const check = (name: string, fn: (gpu: GPUDevice) => Promise<void>) => { checks.push([name, fn]); };

check('GPU output matches a CPU reference for 1M points on one 256x256 frame', async (gpu) => {
  const W = 256, H = 256, N = 1_000_000;
  let s = 7;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const xyz = new Float32Array(N * 3);
  const rgba = new Uint32Array(N);
  const ref = new Uint32Array(W * H);
  const refDepth = new Float64Array(W * H).fill(Infinity);
  for (let i = 0; i < N; i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const z = Math.floor(rnd() * 1024) / 1024;
    xyz.set([((px + 0.5) / W) * 2 - 1, ((py + 0.5) / H) * 2 - 1, z], i * 3);
    rgba[i] = (Math.floor(rnd() * 2 ** 32) | 1) >>> 0;
    const pix = (H - 1 - py) * W + px;
    if (z < refDepth[pix] || (z === refDepth[pix] && rgba[i] > ref[pix])) {
      refDepth[pix] = z;
      ref[pix] = rgba[i];
    }
  }
  const r = createPointRasterizer(gpu, W, H);
  const out = await r.render(packPoints(xyz, rgba), IDENTITY);
  r.destroy();
  let mismatches = 0;
  for (let i = 0; i < ref.length; i++) if (out[i] !== ref[i]) mismatches++;
  assert.equal(mismatches, 0);
});

check('nearest point wins regardless of order; behind-camera points are dropped', async (gpu) => {
  const n = 200_001;
  const xyz = new Float32Array(n * 3);
  const rgba = new Uint32Array(n).fill(0xff0000ff);
  for (let i = 0; i < n; i++) xyz.set([0, 0, 0.9], i * 3);
  xyz.set([0, 0, 0.1], 100_000 * 3);
  rgba[100_000] = 0xff00ff00;
  const r = createPointRasterizer(gpu, 4, 4);
  const out = await r.render(packPoints(xyz, rgba), IDENTITY);
  assert.equal(out[1 * 4 + 2], 0xff00ff00);
  // w = -1 for every point: all behind the camera.
  const flip = IDENTITY.slice(); flip[15] = -1;
  const none = await r.render(packPoints(xyz, rgba), flip);
  r.destroy();
  assert.ok(none.every((v) => v === 0));
});

async function main(): Promise<number> {
  const entry = process.env.WEBGPU_NODE;
  if (!entry) { console.error('WEBGPU_NODE not set'); return 2; }
  const { create, globals } = await import(pathToFileURL(entry).href);
  Object.assign(globalThis, globals);
  gpuInstance = create([]) as GPU;
  const adapter = await gpuInstance.requestAdapter();
  if (!adapter) { console.error('no WebGPU adapter'); return 2; }
  const gpu: GPUDevice = await adapter.requestDevice();
  let failed = 0;
  for (const [name, fn] of checks) {
    const t0 = performance.now();
    try { await fn(gpu); console.log(`ok   ${name} (${Math.round(performance.now() - t0)} ms)`); }
    catch (e) { failed++; console.log(`FAIL ${name}\n${e}`); }
  }
  gpu.destroy();
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
