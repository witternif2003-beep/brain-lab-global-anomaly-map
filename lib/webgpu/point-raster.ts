/// <reference types="@webgpu/types" />
/**
 * Two-pass WebGPU compute point rasterizer (pattern from Schütz et al., "Software Rasterization of
 * 2 Billion Points in Real Time", arXiv:2204.01287).
 * Pass 1 keeps the nearest depth per pixel with atomicMin on a u32 storage buffer. Pass 2 re-projects
 * every point and writes its colour only where its depth equals the stored winner; equal-depth ties
 * resolve with atomicMax so the output is deterministic regardless of thread order.
 * Storage buffers are used instead of read_write storage textures, so no optional WGSL extension is needed.
 */

const COMMON = /* wgsl */ `
struct Params { viewProj: mat4x4f, size: vec2u, count: u32, _pad: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> points: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> depth: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> color: array<atomic<u32>>;

const WG: u32 = 256u;

fn pointIndex(gid: vec3u, nwg: vec3u) -> u32 { return gid.x + gid.y * nwg.x * WG; }

// Returns (pixel, depth) or pixel = 0xffffffff when the point is off-screen or behind the camera.
fn project(p: vec4f) -> vec2u {
  let clip = params.viewProj * vec4f(p.xyz, 1.0);
  if (clip.w <= 0.0) { return vec2u(0xffffffffu, 0u); }
  let ndc = clip.xyz / clip.w;
  if (any(abs(ndc.xy) > vec2f(1.0)) || ndc.z < 0.0 || ndc.z > 1.0) { return vec2u(0xffffffffu, 0u); }
  let fsize = vec2f(params.size);
  let px = min(vec2u((ndc.xy * 0.5 + 0.5) * fsize), params.size - 1u);
  let row = params.size.y - 1u - px.y;
  return vec2u(row * params.size.x + px.x, u32(ndc.z * 16777215.0));
}
`;

export const DEPTH_PASS_WGSL = COMMON + /* wgsl */ `
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nwg: vec3u) {
  let i = pointIndex(gid, nwg);
  if (i >= params.count) { return; }
  let hit = project(points[i]);
  if (hit.x == 0xffffffffu) { return; }
  atomicMin(&depth[hit.x], hit.y);
}
`;

export const COLOR_PASS_WGSL = COMMON + /* wgsl */ `
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nwg: vec3u) {
  let i = pointIndex(gid, nwg);
  if (i >= params.count) { return; }
  let hit = project(points[i]);
  if (hit.x == 0xffffffffu) { return; }
  if (atomicLoad(&depth[hit.x]) == hit.y) {
    atomicMax(&color[hit.x], bitcast<u32>(points[i].w));
  }
}
`;

const WG = 256;
const MAX_GROUPS_X = 65535;
export const EMPTY_DEPTH = 0xffffffff;

/** Point layout: xyz position, w = RGBA8 packed as u32 and bit-cast to f32. */
export function packPoints(xyz: ArrayLike<number>, rgba: ArrayLike<number>): Float32Array {
  const n = xyz.length / 3;
  const buf = new ArrayBuffer(n * 16);
  const f = new Float32Array(buf);
  const u = new Uint32Array(buf);
  for (let i = 0; i < n; i++) {
    f[i * 4] = xyz[i * 3];
    f[i * 4 + 1] = xyz[i * 3 + 1];
    f[i * 4 + 2] = xyz[i * 3 + 2];
    u[i * 4 + 3] = rgba[i] >>> 0;
  }
  return f;
}

export function dispatchSize(count: number): [number, number] {
  const groups = Math.ceil(count / WG);
  const x = Math.min(groups, MAX_GROUPS_X);
  return [Math.max(x, 1), Math.max(Math.ceil(groups / x), 1)];
}

export interface PointRasterizer {
  /** Rasterizes and reads back one RGBA8 value per pixel (0 = empty), top row first. */
  render(points: Float32Array, viewProj: Float32Array): Promise<Uint32Array>;
  destroy(): void;
}

export function createPointRasterizer(device: GPUDevice, width: number, height: number): PointRasterizer {
  const pixels = width * height;
  const S = GPUBufferUsage;
  const params = device.createBuffer({ size: 80, usage: S.UNIFORM | S.COPY_DST });
  const depth = device.createBuffer({ size: pixels * 4, usage: S.STORAGE | S.COPY_DST });
  const color = device.createBuffer({ size: pixels * 4, usage: S.STORAGE | S.COPY_DST | S.COPY_SRC });
  const readback = device.createBuffer({ size: pixels * 4, usage: S.MAP_READ | S.COPY_DST });
  const clearDepth = new Uint32Array(pixels).fill(EMPTY_DEPTH);
  const C = GPUShaderStage.COMPUTE;
  // Explicit layout: 'auto' would drop the colour binding from the depth pass, which never reads it.
  const bindLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: 'uniform' } },
      { binding: 1, visibility: C, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: C, buffer: { type: 'storage' } },
      { binding: 3, visibility: C, buffer: { type: 'storage' } },
    ],
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });
  const pipe = (code: string) =>
    device.createComputePipeline({ layout, compute: { module: device.createShaderModule({ code }), entryPoint: 'main' } });
  const depthPipe = pipe(DEPTH_PASS_WGSL);
  const colorPipe = pipe(COLOR_PASS_WGSL);
  let pointBuf: GPUBuffer | null = null;

  return {
    async render(points, viewProj) {
      const count = points.length / 4;
      if (!pointBuf || pointBuf.size < points.byteLength) {
        pointBuf?.destroy();
        pointBuf = device.createBuffer({ size: Math.max(points.byteLength, 16), usage: S.STORAGE | S.COPY_DST });
      }
      device.queue.writeBuffer(pointBuf, 0, points as Float32Array<ArrayBuffer>);
      const p = new ArrayBuffer(80);
      new Float32Array(p, 0, 16).set(viewProj);
      new Uint32Array(p, 64, 3).set([width, height, count]);
      device.queue.writeBuffer(params, 0, p);
      device.queue.writeBuffer(depth, 0, clearDepth);
      const enc = device.createCommandEncoder();
      enc.clearBuffer(color);
      const [gx, gy] = dispatchSize(count);
      const group = device.createBindGroup({
        layout: bindLayout,
        entries: [params, pointBuf, depth, color].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      for (const pl of [depthPipe, colorPipe]) {
        const pass = enc.beginComputePass();
        pass.setPipeline(pl);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(gx, gy);
        pass.end();
      }
      enc.copyBufferToBuffer(color, 0, readback, 0, pixels * 4);
      device.queue.submit([enc.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const out = new Uint32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      return out;
    },
    destroy() {
      for (const b of [params, depth, color, readback, pointBuf]) b?.destroy();
    },
  };
}
