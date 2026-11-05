import type { Map as MapLibreMap } from 'maplibre-gl';
import { PngStreamWriter, type ByteSink } from './png-stream';

export const EXPORT_32K_WIDTH = 32768;
export const EXPORT_TILE_PX = 2048;
export const EXPORT_HW_LIMIT_S = 180;
export const EXPORT_SW_LIMIT_S = 1200;

/** Software rasterisers (SwiftShader, llvmpipe) report themselves in the WebGL renderer string. */
export const isSoftwareRenderer = (renderer: string) => /swiftshader|llvmpipe|software/i.test(renderer);

/** 32K export speed gate: 180 s on a hardware GPU; software GPUs are allowed 1,200 s with a warning. */
export function exportSpeedGate(renderer: string, seconds: number): { pass: boolean; limitS: number; warning: string | null } {
  const software = isSoftwareRenderer(renderer);
  const limitS = software ? EXPORT_SW_LIMIT_S : EXPORT_HW_LIMIT_S;
  return { pass: seconds <= limitS, limitS, warning: software ? 'WARN: Software GPU detected, bypassing 180s speed gate' : null };
}

export interface TileCamera {
  col: number;
  row: number;
  /** Tile origin in the full image, px. */
  x0: number;
  y0: number;
  /** Valid pixels of this tile (edge tiles are cropped). */
  w: number;
  h: number;
  /** Vertical field of view of the tile frustum, degrees. */
  fovDeg: number;
  /** Where the full image's principal point falls in tile pixels: the off-centre frustum. */
  centerX: number;
  centerY: number;
}

export interface ExportPlan {
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Zoom offset added to the live camera so one CSS px of the live view becomes width / cssWidth image px. */
  zoomOffset: number;
  tiles: TileCamera[];
}

/**
 * Splits a width × height render of the current camera into tile × tile sub-frusta of one frozen camera.
 * Every tile keeps the camera position (same zoom and pixel camera distance) and narrows the field of view
 * to its own slice, with the principal point shifted off-centre, so tilted 3D views line up exactly.
 */
export function planExport(cssWidth: number, cssHeight: number, fovDeg: number, width = EXPORT_32K_WIDTH, tile = EXPORT_TILE_PX): ExportPlan {
  const height = Math.round((width * cssHeight) / cssWidth);
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const fovTile = (2 * Math.atan((tanHalf * tile) / height) * 180) / Math.PI;
  const tiles: TileCamera[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * tile;
      const y0 = row * tile;
      tiles.push({ col, row, x0, y0, w: Math.min(tile, width - x0), h: Math.min(tile, height - y0), fovDeg: fovTile, centerX: width / 2 - x0, centerY: height / 2 - y0 });
    }
  }
  return { width, height, cols, rows, zoomOffset: Math.log2(height / cssHeight), tiles };
}

type Helper = { centerPoint: { x: number; y: number } };
type PointCtor = new (x: number, y: number) => { x: number; y: number };

/**
 * MapLibre's camera helper (shared by the globe and mercator transforms). Found by shape, not by name,
 * because the minified build renames private fields.
 */
function transformHelper(map: MapLibreMap): { helper: Helper; Point: PointCtor } | null {
  type T = Record<string, unknown> & { centerPoint?: { constructor: PointCtor } };
  const m = map as unknown as { transform?: T; _camera?: { transform?: T } };
  const t = m.transform ?? m._camera?.transform;
  const P = t?.centerPoint?.constructor;
  if (!t || !P) return null;
  const hasCenter = (o: unknown) => {
    for (let proto = o && Object.getPrototypeOf(o); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      if (Object.getOwnPropertyDescriptor(proto, 'centerPoint')?.get) return true;
    }
    return false;
  };
  for (const key of Object.keys(t)) {
    const v: unknown = t[key];
    if (v && typeof v === 'object' && v !== t && hasCenter(v) && 'centerOffset' in (v as object)) {
      const inner = Object.values(v as Record<string, unknown>).find((w) => w && typeof w === 'object' && w !== v && hasCenter(w) && 'centerOffset' in (w as object));
      return { helper: (inner ?? v) as Helper, Point: P };
    }
  }
  return null;
}

interface LoadableMap {
  loaded(): boolean;
  isMoving(): boolean;
  once(type: 'idle', listener: () => void): unknown;
  triggerRepaint(): void;
}

/** True when LiDAR points are still being fetched for the current view. */
export const lidarBusy = (): boolean => /^loading/.test((globalThis as { __gaLidar?: { status?: string } }).__gaLidar?.status ?? '');

/** No pixel was drawn (every alpha is 0): the tile captured before anything rendered. */
export function isBlankTile(px: ArrayLike<number>): boolean {
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) return false;
  return true;
}

const pause = (ms: number) => new Promise<void>((r) => globalThis.setTimeout(r, ms));

/**
 * Resolves true once the map is idle (all tiles loaded) and stays idle after a grace period in which lazy layers
 * (LiDAR, building enrichment) start and finish their own loads; false if that doesn't happen within `timeoutMs`.
 */
export async function waitForLoaded(map: LoadableMap, timeoutMs: number, busy: () => boolean = lidarBusy, graceMs = 400): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(map.loaded() && !map.isMoving())) {
      const idle = await Promise.race([
        new Promise<boolean>((r) => {
          map.once('idle', () => r(true));
          map.triggerRepaint();
        }),
        pause(Math.max(0, deadline - Date.now())).then(() => false),
      ]);
      if (!idle) return false;
    }
    await pause(graceMs);
    if (!busy() && map.loaded()) return true;
    await pause(250);
  }
  return false;
}

function drawNextFrame(map: MapLibreMap, draw: () => void): Promise<void> {
  return new Promise((resolve) => {
    map.once('render', () => (draw(), resolve()));
    map.triggerRepaint();
  });
}

export interface Export32kResult {
  width: number;
  height: number;
  tiles: number;
  seconds: number;
}

/**
 * Renders the current view — any pitch, bearing or projection — as one width-px PNG streamed to `sink`.
 * The GPU draws one 2,048 px tile at a time; no full-size canvas exists. Only MapLibre layers are captured.
 */
export async function exportMap32k(
  map: MapLibreMap,
  sink: ByteSink,
  onProgress: (done: number, total: number) => void = () => {},
  width = EXPORT_32K_WIDTH,
  tile = EXPORT_TILE_PX,
  idleMs = 20_000,
): Promise<Export32kResult> {
  const started = performance.now();
  const container = map.getContainer();
  const canvas = map.getCanvas();
  const th = transformHelper(map);
  if (!th) throw new Error('this MapLibre build does not expose its camera transform');
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const camera = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
  const fov = map.getVerticalFieldOfView();
  if (!(cssW > 0 && cssH > 0)) throw new Error(`32K export: map canvas is ${cssW}×${cssH} px; the map must be visible`);
  if (!(fov > 0 && fov < 180)) throw new Error(`32K export: invalid vertical field of view ${fov}°`);
  const plan = planExport(cssW, cssH, fov, width, tile);
  const prev = { pixelRatio: map.getPixelRatio(), style: container.getAttribute('style'), padding: map.getPadding() };
  const desc = Object.getOwnPropertyDescriptor(th.helper, 'centerPoint');
  const writer = new PngStreamWriter(sink, plan.width, plan.height);
  const scratch = document.createElement('canvas');
  scratch.width = tile;
  scratch.height = tile;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  let pt = new th.Point(tile / 2, tile / 2);
  try {
    Object.defineProperty(th.helper, 'centerPoint', { configurable: true, get: () => pt.constructor === th.Point ? new th.Point(pt.x, pt.y) : pt });
    container.style.width = `${tile}px`;
    container.style.height = `${tile}px`;
    map.setPixelRatio(1);
    map.resize();
    map.setVerticalFieldOfView(plan.tiles[0].fovDeg);
    await writer.start();
    const band = new Uint8ClampedArray(plan.width * tile * 4);
    for (let row = 0; row < plan.rows; row++) {
      band.fill(0);
      const rowTiles = plan.tiles.filter((t) => t.row === row);
      for (const t of rowTiles) {
        pt = new th.Point(t.centerX, t.centerY);
        let px: Uint8ClampedArray | null = null;
        for (let attempt = 0; attempt < 2 && !px; attempt++) {
          map.jumpTo({ ...camera, zoom: camera.zoom + plan.zoomOffset });
          const ready = await waitForLoaded(map, idleMs);
          await drawNextFrame(map, () => {
            ctx.clearRect(0, 0, tile, tile);
            ctx.drawImage(canvas, 0, 0, tile, tile);
          });
          const got = ctx.getImageData(0, 0, t.w, t.h).data;
          if (ready && map.loaded() && !lidarBusy() && !isBlankTile(got)) px = got;
        }
        if (!px) throw new Error(`32K export stopped: tile row ${t.row + 1}, column ${t.col + 1} did not finish loading after 2 tries`);
        for (let y = 0; y < t.h; y++) band.set(px.subarray(y * t.w * 4, (y + 1) * t.w * 4), (y * plan.width + t.x0) * 4);
        onProgress(row * plan.cols + t.col + 1, plan.tiles.length);
      }
      const h = rowTiles[0].h;
      for (let y = 0; y < h; y += 64) {
        const n = Math.min(64, h - y);
        await writer.writeRows(band.subarray(y * plan.width * 4, (y + n) * plan.width * 4), n);
      }
    }
    await writer.finish();
  } finally {
    if (desc) Object.defineProperty(th.helper, 'centerPoint', desc);
    else delete (th.helper as Partial<Helper>).centerPoint;
    if (prev.style === null) container.removeAttribute('style');
    else container.setAttribute('style', prev.style);
    map.setVerticalFieldOfView(fov);
    map.setPixelRatio(prev.pixelRatio);
    map.resize();
    map.jumpTo({ ...camera, padding: prev.padding });
  }
  return { width: plan.width, height: plan.height, tiles: plan.tiles.length, seconds: (performance.now() - started) / 1000 };
}

/** Disk sink via the File System Access API (Chrome/Edge), else an in-memory Blob download. */
export async function pickPngSink(name: string): Promise<{ sink: ByteSink; close: () => Promise<void> }> {
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Uint8Array) => Promise<void>; close: () => Promise<void> }> }> };
  if (w.showSaveFilePicker) {
    const handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: 'PNG', accept: { 'image/png': ['.png'] } }] });
    const file = await handle.createWritable();
    return { sink: (b) => file.write(b), close: () => file.close() };
  }
  const parts: Uint8Array[] = [];
  return {
    sink: (b) => void parts.push(b),
    close: async () => {
      const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: 'image/png' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  };
}
