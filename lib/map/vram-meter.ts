/**
 * Live WebGL GPU-memory meter: wraps the allocation calls of WebGL contexts created on this page and keeps a running
 * byte count per buffer, texture and renderbuffer (freed on delete). Browsers expose no GPU memory API, so this
 * counts what the page asked the driver to allocate; drivers may pad or compress, so it is an estimate.
 */
type GL = WebGLRenderingContext | WebGL2RenderingContext;
type Res = WebGLBuffer | WebGLTexture | WebGLRenderbuffer;

export interface VramSnapshot {
  bytes: number;
  peakBytes: number;
  buffers: number;
  textures: number;
  renderbuffers: number;
  /** Bytes per canvas label, largest first. */
  byCanvas: [string, number][];
}

const BPP: Record<number, number> = {
  0x1908: 4, 0x8058: 4, 0x8c43: 4, 0x1907: 4, 0x8051: 4, 0x8c41: 4, // RGBA, RGBA8, SRGB8_ALPHA8, RGB, RGB8, SRGB8
  0x1909: 1, 0x1906: 1, 0x190a: 2, 0x8229: 1, 0x822b: 2, 0x8d62: 2, 0x8056: 2, 0x8057: 2, // LUMINANCE, ALPHA, LUMINANCE_ALPHA, R8, RG8, RGB565, RGBA4, RGB5_A1
  0x881a: 8, 0x881b: 6, 0x8814: 16, 0x8815: 12, 0x822d: 2, 0x822e: 4, 0x822f: 4, 0x8230: 8, // RGBA16F, RGB16F, RGBA32F, RGB32F, R16F, R32F, RG16F, RG32F
  0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8cad: 8, 0x84f9: 4, 0x8d48: 1, 0x1902: 4, // DEPTH16, DEPTH24, DEPTH32F, DEPTH24_STENCIL8, DEPTH32F_STENCIL8, DEPTH_STENCIL, STENCIL8, DEPTH_COMPONENT
};
export const bytesPerPixel = (internalFormat: number): number => BPP[internalFormat] ?? 4;

const sizes = new Map<Res, Map<string, number>>();
const dims = new Map<Res, string>();
const owner = new WeakMap<Res, string>();
const byCanvas = new Map<string, number>();
const canvasIds = new WeakMap<object, string>();
let canvasSeq = 0;
/** Short label for the canvas behind a context (its id, class or parent id), so the snapshot can split usage per canvas. */
function canvasLabel(gl: GL): string {
  const c = gl.canvas as HTMLCanvasElement | OffscreenCanvas;
  let id = canvasIds.get(c);
  if (!id) {
    const el = c as HTMLCanvasElement;
    id = `${el.id || el.className || el.parentElement?.id || el.parentElement?.className || 'canvas'}#${++canvasSeq}`.slice(0, 60);
    canvasIds.set(c, id);
  }
  return id;
}
const kind = new WeakMap<Res, 'buffer' | 'texture' | 'renderbuffer'>();
const bound = new WeakMap<GL, Map<string, Res | null>>();
const counts = { buffer: 0, texture: 0, renderbuffer: 0 };
let total = 0;
let peak = 0;
let installed = false;

function set(gl: GL, res: Res | null | undefined, slot: string, bytes: number, k: 'buffer' | 'texture' | 'renderbuffer'): void {
  if (!res) return;
  let m = sizes.get(res);
  if (!m) {
    m = new Map();
    sizes.set(res, m);
    kind.set(res, k);
    owner.set(res, canvasLabel(gl));
    counts[k]++;
  }
  const delta = bytes - (m.get(slot) ?? 0);
  const o = owner.get(res) as string;
  byCanvas.set(o, (byCanvas.get(o) ?? 0) + delta);
  total += delta;
  m.set(slot, bytes);
  peak = Math.max(peak, total);
}

function free(res: Res | null): void {
  const m = res && sizes.get(res);
  if (!res || !m) return;
  let b = 0;
  for (const v of m.values()) b += v;
  total -= b;
  const o = owner.get(res);
  if (o) byCanvas.set(o, (byCanvas.get(o) ?? 0) - b);
  sizes.delete(res);
  dims.delete(res);
  const k = kind.get(res);
  if (k) counts[k]--;
}

const binding = (gl: GL) => {
  let m = bound.get(gl);
  if (!m) bound.set(gl, (m = new Map()));
  return m;
};
const unitKey = (gl: GL, target: number) => `t${target}:${binding(gl).get('unit') ?? 0}`;
const TEXTURE_CUBE_MAP = 0x8513;
const cubeFace = (target: number) => (target >= 0x8515 && target <= 0x851a ? TEXTURE_CUBE_MAP : target);
const imageSize = (src: unknown): [number, number] => {
  const s = src as { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null;
  return [s?.videoWidth || s?.naturalWidth || s?.width || 0, s?.videoHeight || s?.naturalHeight || s?.height || 0];
};

function wrap<T extends object>(proto: T, name: string, after: (gl: GL, args: unknown[]) => void): void {
  const desc = Object.getOwnPropertyDescriptor(proto, name);
  const orig = desc?.value as ((...a: unknown[]) => unknown) | undefined;
  if (typeof orig !== 'function') return;
  Object.defineProperty(proto, name, {
    ...desc,
    value: function (this: GL, ...args: unknown[]) {
      const out = orig.apply(this, args);
      try { after(this, args); } catch { /* metering never breaks rendering */ }
      return out;
    },
  });
}

function patch(proto: object): void {
  wrap(proto, 'bindBuffer', (gl, [t, b]) => binding(gl).set(`b${t}`, b as WebGLBuffer | null));
  wrap(proto, 'bufferData', (gl, [t, data]) => {
    const bytes = typeof data === 'number' ? data : (data as ArrayBufferView | ArrayBuffer | null)?.byteLength ?? 0;
    set(gl, binding(gl).get(`b${t}`), 'data', bytes, 'buffer');
  });
  wrap(proto, 'deleteBuffer', (_gl, [b]) => free(b as WebGLBuffer));
  wrap(proto, 'activeTexture', (gl, [u]) => binding(gl).set('unit', u as unknown as Res));
  wrap(proto, 'bindTexture', (gl, [t, tex]) => binding(gl).set(unitKey(gl, t as number), tex as WebGLTexture | null));
  wrap(proto, 'texImage2D', (gl, a) => {
    const target = a[0] as number;
    const [w, h] = a.length >= 8 ? [a[3] as number, a[4] as number] : imageSize(a[5]);
    const tex = binding(gl).get(unitKey(gl, cubeFace(target)));
    if (tex && a[1] === 0) dims.set(tex, `${w}x${h}:${(a[2] as number).toString(16)}`);
    set(gl, binding(gl).get(unitKey(gl, cubeFace(target))), `${target}:${a[1]}`, w * h * bytesPerPixel(a[2] as number), 'texture');
  });
  wrap(proto, 'texImage3D', (gl, a) => set(gl, binding(gl).get(unitKey(gl, a[0] as number)), `3d:${a[1]}`, (a[3] as number) * (a[4] as number) * (a[5] as number) * bytesPerPixel(a[2] as number), 'texture'));
  wrap(proto, 'texStorage2D', (gl, [t, levels, fmt, w, h]) => {
    let bytes = 0;
    for (let l = 0, lw = w as number, lh = h as number; l < (levels as number); l++, lw = Math.max(1, lw >> 1), lh = Math.max(1, lh >> 1)) bytes += lw * lh * bytesPerPixel(fmt as number);
    const tex = binding(gl).get(unitKey(gl, t as number));
    if (tex) dims.set(tex, `storage ${w}x${h}x${levels}:${(fmt as number).toString(16)}`);
    set(gl, tex, 'storage', bytes * ((t as number) === TEXTURE_CUBE_MAP ? 6 : 1), 'texture');
  });
  wrap(proto, 'deleteTexture', (_gl, [t]) => free(t as WebGLTexture));
  wrap(proto, 'bindRenderbuffer', (gl, [, r]) => binding(gl).set('rb', r as WebGLRenderbuffer | null));
  wrap(proto, 'renderbufferStorage', (gl, [, fmt, w, h]) => set(gl, binding(gl).get('rb'), 'rb', (w as number) * (h as number) * bytesPerPixel(fmt as number), 'renderbuffer'));
  wrap(proto, 'renderbufferStorageMultisample', (gl, [, samples, fmt, w, h]) => set(gl, binding(gl).get('rb'), 'rb', (w as number) * (h as number) * bytesPerPixel(fmt as number) * Math.max(1, samples as number), 'renderbuffer'));
  wrap(proto, 'deleteRenderbuffer', (_gl, [r]) => free(r as WebGLRenderbuffer));
}

/** Installs the meter once per page; contexts created afterwards are counted. Safe to call repeatedly or during SSR. */
export function installVramMeter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  if (typeof WebGLRenderingContext !== 'undefined') patch(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== 'undefined') patch(WebGL2RenderingContext.prototype);
  window.__gaVram = vramSnapshot;
  window.__gaVramTextures = vramTextureGroups;
}

export function vramSnapshot(): VramSnapshot {
  return { bytes: Math.max(0, total), peakBytes: peak, buffers: counts.buffer, textures: counts.texture, renderbuffers: counts.renderbuffer, byCanvas: [...byCanvas.entries()].filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]) };
}

/** Texture memory grouped by base-level size and format, largest groups first (for diagnosing what fills GPU memory). */
export function vramTextureGroups(top = 8): [string, number, number][] {
  const g = new Map<string, [number, number]>();
  for (const [res, m] of sizes) {
    if (kind.get(res) !== 'texture') continue;
    const key = `${owner.get(res)} ${dims.get(res) ?? 'storage'}`;
    let b = 0;
    for (const v of m.values()) b += v;
    const cur = g.get(key) ?? [0, 0];
    g.set(key, [cur[0] + 1, cur[1] + b]);
  }
  return [...g.entries()].map(([k, [n, b]]) => [k, n, b] as [string, number, number]).sort((a, b) => b[2] - a[2]).slice(0, top);
}

export const vramMeterInstalled = (): boolean => installed;

declare global {
  interface Window { __gaVram?: () => VramSnapshot; __gaVramTextures?: (top?: number) => [string, number, number][] }
}
