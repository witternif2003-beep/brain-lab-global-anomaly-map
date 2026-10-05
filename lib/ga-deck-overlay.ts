import type { Layer } from '@deck.gl/core';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { GA_MARKER_SCALE, gaGlowMultiplier } from './ga-marker-scale';
import { gaMarkerIcon, type GaIconShape } from './ga-marker-icons';

export type RGBA = [number, number, number, number];
export interface GaDeckItem {
  coord: LngLat;
  radiusPx: number;
  fill: RGBA;
  stroke: RGBA;
  strokePx: number;
  glow?: number;
  pulse?: boolean;
  /** Drawn as this glyph (sized `iconPx`) instead of a circle. */
  icon?: GaIconShape;
  iconPx?: number;
  /** Heading in degrees clockwise from north; rotates the glyph on the map. */
  angle?: number;
  /** Short see-through tag drawn under the marker once zoomed in to the group's `labelMinZoom`. */
  label?: string;
  props: Record<string, unknown>;
}
export interface GaDeckGroup {
  items: GaDeckItem[];
  z: number;
  labelMinZoom?: number;
  onClick: (map: MapLibreMap, lngLat: LngLat, props: Record<string, unknown>) => void;
}

export type GroupKey = 'bulbs' | 'traffic' | 'gauges' | 'imagery' | 'fires' | 'aircraft' | 'transit' | 'micromobility' | 'stations' | 'streamgauges';
type Renderer = 'webgl2' | 'webgpu';
type Point = { x: number; y: number };
type DeckModules = {
  MapLibreOverlay: typeof import('@deck.gl/maplibre').MapLibreOverlay;
  ScatterplotLayer: typeof import('@deck.gl/layers').ScatterplotLayer;
  IconLayer: typeof import('@deck.gl/layers').IconLayer;
  TextLayer: typeof import('@deck.gl/layers').TextLayer;
};
type BenchData = {
  length: number;
  attributes: { getPosition: { value: Float32Array; size: 2 } };
};
type DeckSnapshot = {
  renderer: Renderer | null;
  fallbackReason: string | null;
  counts: Record<GroupKey, number>;
  pulse: { radiusScale: number; opacity: number };
};

declare global {
  interface Window {
    __gaDeck?: DeckSnapshot;
    __gaBench?: {
      points: number;
      renderer: Renderer;
      p50FPS: number;
      p95FPS: number;
      p99FPS: number;
    };
  }
}

interface DeckState {
  groups: Map<GroupKey, GaDeckGroup>;
  overlay: MapLibreOverlay | null;
  modules: DeckModules | null;
  renderer: Renderer | null;
  fallbackReason: string | null;
  webgpuAdapterFound: boolean;
  firstRender: boolean;
  initPromise: Promise<void> | null;
  fallbackPromise: Promise<void> | null;
  removed: boolean;
  pulseFrame: number;
  lastPulse: number;
  pulseRadiusScale: number;
  pulseOpacity: number;
  pointerFrame: number;
  pointer: Point | null;
  cursorSet: boolean;
  benchStarted: boolean;
  benchData: BenchData | null;
  published: DeckSnapshot | null;
  zoom: number;
  focus: ReadonlySet<GroupKey> | null;
}

const states = new WeakMap<MapLibreMap, DeckState>();
type GroupViews = { glow: GaDeckItem[]; pulse: GaDeckItem[]; dots: GaDeckItem[]; icons: GaDeckItem[]; labels: GaDeckItem[] };
const viewsByGroup = new WeakMap<GaDeckGroup, GroupViews>();
const DEPTH_PARAMETERS = { depthCompare: 'always', depthWriteEnabled: false } as const;
const ADDITIVE_PARAMETERS = {
  ...DEPTH_PARAMETERS,
  blend: true,
  blendColorOperation: 'add',
  blendColorSrcFactor: 'src-alpha',
  blendColorDstFactor: 'one',
  blendAlphaOperation: 'add',
  blendAlphaSrcFactor: 'one',
  blendAlphaDstFactor: 'one',
} as const;
const BENCH_COLOR: RGBA = [0, 255, 255, 153];
const SOURCE_URL = 'https://deck.gl/docs/developer-guide/webgpu';
const HIT_BOX_PX = 24;

function getState(map: MapLibreMap): DeckState {
  let state = states.get(map);
  if (state) return state;
  state = {
    groups: new Map(),
    overlay: null,
    modules: null,
    renderer: null,
    fallbackReason: null,
    webgpuAdapterFound: false,
    firstRender: false,
    initPromise: null,
    fallbackPromise: null,
    removed: false,
    pulseFrame: 0,
    lastPulse: 0,
    pulseRadiusScale: 1.2,
    pulseOpacity: 0.9,
    pointerFrame: 0,
    pointer: null,
    cursorSet: false,
    benchStarted: false,
    benchData: null,
    published: null,
    zoom: map.getZoom(),
    focus: null,
  };
  states.set(map, state);
  publishState(map, state);
  map.on('click', (event) => {
    const hit = hitAt(map, state!, event.point);
    if (hit) hit.group.onClick(map, hit.item.coord, hit.item.props);
  });
  map.on('zoomend', () => {
    const before = labelKeys(state!);
    state!.zoom = map.getZoom();
    if (labelKeys(state!) !== before) updateLayers(state!);
  });
  map.on('mousemove', (event) => {
    state!.pointer = event.point;
    if (state!.pointerFrame) return;
    state!.pointerFrame = requestAnimationFrame(() => {
      state!.pointerFrame = 0;
      if (!state!.pointer) return;
      const isHit = hitAt(map, state!, state!.pointer) !== null;
      const canvas = map.getCanvas();
      if (isHit) {
        canvas.style.cursor = 'pointer';
        state!.cursorSet = true;
      } else if (state!.cursorSet) {
        if (canvas.style.cursor === 'pointer') canvas.style.cursor = '';
        state!.cursorSet = false;
      }
    });
  });
  map.once('remove', () => {
    state!.removed = true;
    cancelAnimationFrame(state!.pulseFrame);
    cancelAnimationFrame(state!.pointerFrame);
    if (state!.cursorSet && map.getCanvas().style.cursor === 'pointer') map.getCanvas().style.cursor = '';
    if (typeof window !== 'undefined' && window.__gaDeck === state!.published) {
      delete window.__gaDeck;
      delete window.__gaBench;
    }
    states.delete(map);
  });
  return state;
}

function snapshot(state: DeckState): DeckSnapshot {
  return {
    renderer: state.renderer,
    fallbackReason: state.fallbackReason,
    counts: {
      bulbs: state.groups.get('bulbs')?.items.length ?? 0,
      traffic: state.groups.get('traffic')?.items.length ?? 0,
      gauges: state.groups.get('gauges')?.items.length ?? 0,
      imagery: state.groups.get('imagery')?.items.length ?? 0,
      fires: state.groups.get('fires')?.items.length ?? 0,
      aircraft: state.groups.get('aircraft')?.items.length ?? 0,
      transit: state.groups.get('transit')?.items.length ?? 0,
      micromobility: state.groups.get('micromobility')?.items.length ?? 0,
      stations: state.groups.get('stations')?.items.length ?? 0,
      streamgauges: state.groups.get('streamgauges')?.items.length ?? 0,
    },
    pulse: { radiusScale: state.pulseRadiusScale, opacity: state.pulseOpacity },
  };
}

function publishState(map: MapLibreMap, state: DeckState): void {
  state.published = snapshot(state);
  if (typeof window !== 'undefined') window.__gaDeck = state.published;
  if (!state.renderer) return;
  const detail = state.renderer === 'webgpu'
    ? 'deck.gl 9.4 · WebGPU (experimental, overlaid)'
    : state.webgpuAdapterFound
      ? 'deck.gl 9.4 · WebGL2 (interleaved) · WebGPU adapter found; overlaid WebGPU is opt-in (?renderer=webgpu) until compositing is verified'
      : 'deck.gl 9.4 · WebGL2 (interleaved)';
  reportGaFeed(map, {
    id: 'renderer',
    label: 'Map renderer',
    color: '#a78bfa',
    count: [...state.groups.values()].reduce((n, group) => n + group.items.length, 0),
    detail: state.fallbackReason ? `${detail} · fallback: ${state.fallbackReason}` : detail,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
  });
}

function hitAt(map: MapLibreMap, state: DeckState, point: Point): { group: GaDeckGroup; item: GaDeckItem } | null {
  const groups = [...state.groups.entries()].filter(([key]) => shown(state, key)).map(([, group]) => group).sort((a, b) => b.z - a.z);
  const corners = [[-HIT_BOX_PX, -HIT_BOX_PX], [HIT_BOX_PX, -HIT_BOX_PX], [HIT_BOX_PX, HIT_BOX_PX], [-HIT_BOX_PX, HIT_BOX_PX]].map(([dx, dy]) =>
    map.unproject([point.x + dx, point.y + dy]),
  );
  const lngs = corners.map((c) => c.lng);
  const lats = corners.map((c) => c.lat);
  const bounds = corners.every((c) => Number.isFinite(c.lng) && Number.isFinite(c.lat))
    ? { w: Math.min(...lngs), e: Math.max(...lngs), s: Math.min(...lats), n: Math.max(...lats) }
    : null;
  for (const group of groups) {
    let closest: GaDeckItem | null = null;
    let closestDistance = Infinity;
    for (const item of group.items) {
      if (bounds && (item.coord[0] < bounds.w || item.coord[0] > bounds.e || item.coord[1] < bounds.s || item.coord[1] > bounds.n)) continue;
      const projected = map.project(item.coord);
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
      const reach = item.icon ? (item.iconPx ?? 0) * GA_MARKER_SCALE / 2 : item.radiusPx * GA_MARKER_SCALE + item.strokePx;
      if (distance <= Math.max(reach, 8) && distance < closestDistance) {
        closest = item;
        closestDistance = distance;
      }
    }
    if (closest) return { group, item: closest };
  }
  return null;
}

export function hitsGaDeck(map: MapLibreMap, point: { x: number; y: number }): boolean {
  const state = states.get(map);
  return !!state && !!hitAt(map, state, point);
}

function groupViews(group: GaDeckGroup): GroupViews {
  let views = viewsByGroup.get(group);
  if (!views) {
    views = {
      glow: group.items.filter((item) => (item.glow ?? 0) > 0),
      pulse: group.items.filter((item) => !!item.pulse),
      dots: group.items.filter((item) => !item.icon),
      icons: group.items.filter((item) => !!item.icon),
      labels: group.items.filter((item) => !!item.label),
    };
    viewsByGroup.set(group, views);
  }
  return views;
}

const shown = (state: DeckState, key: GroupKey) => !state.focus || state.focus.has(key);
const showsLabels = (state: DeckState, group: GaDeckGroup) => group.labelMinZoom !== undefined && state.zoom >= group.labelMinZoom;
const labelKeys = (state: DeckState) => [...state.groups.entries()].filter(([, g]) => showsLabels(state, g)).map(([k]) => k).join(',');
const LABEL_FONT = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';

function createLayers(state: DeckState): Layer[] {
  if (!state.modules) return [];
  const { ScatterplotLayer, IconLayer, TextLayer } = state.modules;
  const layers: Layer[] = [];
  const labelLayers: Layer[] = [];
  for (const [key, group] of [...state.groups.entries()].filter(([k]) => shown(state, k)).sort((a, b) => a[1].z - b[1].z)) {
    const { glow, pulse, dots, icons, labels } = groupViews(group);
    if (glow.length) {
      layers.push(new ScatterplotLayer({
        id: `ga-deck-${key}-bloom`,
        data: glow,
        getPosition: (item: GaDeckItem) => item.coord,
        getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE * gaGlowMultiplier(3.2),
        getFillColor: (item: GaDeckItem) => [item.stroke[0], item.stroke[1], item.stroke[2], Math.round(255 * 0.18 * Math.max(0, Math.min(1, item.glow ?? 0)))],
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        billboard: true,
        pickable: false,
        parameters: ADDITIVE_PARAMETERS,
      }));
      layers.push(new ScatterplotLayer({
        id: `ga-deck-${key}-halo`,
        data: glow,
        getPosition: (item: GaDeckItem) => item.coord,
        getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE * gaGlowMultiplier(2),
        getFillColor: (item: GaDeckItem) => [item.stroke[0], item.stroke[1], item.stroke[2], Math.round(255 * 0.45 * Math.max(0, Math.min(1, item.glow ?? 0)))],
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        billboard: true,
        pickable: false,
        parameters: ADDITIVE_PARAMETERS,
      }));
    }
    if (icons.length) {
      layers.push(new IconLayer<GaDeckItem>({
        id: `ga-deck-${key}-icon`,
        data: icons,
        getPosition: (item) => item.coord,
        getIcon: (item) => gaMarkerIcon(item.icon!, item.fill, item.stroke),
        getSize: (item) => (item.iconPx ?? 12) * GA_MARKER_SCALE,
        getAngle: (item) => -(item.angle ?? 0),
        sizeUnits: 'pixels',
        billboard: false,
        alphaCutoff: 0.02,
        pickable: false,
        parameters: DEPTH_PARAMETERS,
      }));
    }
    if (labels.length && showsLabels(state, group)) {
      labelLayers.push(new TextLayer<GaDeckItem>({
        id: `ga-deck-${key}-label`,
        data: labels,
        getPosition: (item) => item.coord,
        getText: (item) => item.label!,
        getColor: (item) => [Math.min(255, item.fill[0] + 30), Math.min(255, item.fill[1] + 30), Math.min(255, item.fill[2] + 30), 240],
        getSize: 10,
        getPixelOffset: (item) => [0, Math.round(((item.iconPx ?? item.radiusPx * 2) * GA_MARKER_SCALE) / 2) + 3],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        fontFamily: LABEL_FONT,
        fontWeight: 600,
        characterSet: 'auto',
        background: true,
        getBackgroundColor: [2, 6, 23, 120],
        getBorderColor: (item) => [item.fill[0], item.fill[1], item.fill[2], 110],
        getBorderWidth: 1,
        backgroundPadding: [4, 1, 4, 1],
        backgroundBorderRadius: 3,
        billboard: true,
        pickable: false,
        parameters: DEPTH_PARAMETERS,
      }));
    }
    if (dots.length) layers.push(new ScatterplotLayer({
      id: `ga-deck-${key}-core`,
      data: dots,
      getPosition: (item: GaDeckItem) => item.coord,
      getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE,
      getFillColor: (item: GaDeckItem) => item.fill,
      getLineColor: (item: GaDeckItem) => item.stroke,
      getLineWidth: (item: GaDeckItem) => item.strokePx,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      billboard: true,
      stroked: true,
      pickable: false,
      parameters: DEPTH_PARAMETERS,
    }));
    if (pulse.length) {
      layers.push(new ScatterplotLayer({
        id: `ga-deck-${key}-pulse`,
        data: pulse,
        getPosition: (item: GaDeckItem) => item.coord,
        getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE,
        getFillColor: [0, 0, 0, 0],
        getLineColor: (item: GaDeckItem) => item.stroke,
        getLineWidth: (item: GaDeckItem) => item.strokePx,
        radiusScale: gaGlowMultiplier(state.pulseRadiusScale),
        opacity: state.pulseOpacity,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        billboard: true,
        filled: true,
        stroked: true,
        pickable: false,
        parameters: DEPTH_PARAMETERS,
      }));
    }
  }
  layers.push(...labelLayers);
  if (state.benchData) {
    layers.push(new ScatterplotLayer({
      id: 'ga-deck-bench',
      data: state.benchData,
      getRadius: 1.5,
      getFillColor: BENCH_COLOR,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      billboard: true,
      pickable: false,
      parameters: DEPTH_PARAMETERS,
    }));
  }
  return layers;
}

function updateLayers(state: DeckState): void {
  if (state.overlay && state.modules) state.overlay.setProps({ layers: createLayers(state) });
}

function startPulse(map: MapLibreMap, state: DeckState): void {
  const animate = (now: number) => {
    if (state.removed) return;
    state.pulseFrame = requestAnimationFrame(animate);
    if (now - state.lastPulse < 50) return;
    state.lastPulse = now;
    const phase = (now / 1000) * Math.PI;
    const s = (1 - Math.cos(phase)) / 2;
    state.pulseRadiusScale = 1.2 + 1.6 * s;
    state.pulseOpacity = 0.9 * (1 - s);
    if ([...state.groups.values()].some((group) => group.items.some((item) => item.pulse))) {
      updateLayers(state);
    }
    publishState(map, state);
  };
  state.pulseFrame = requestAnimationFrame(animate);
}

async function loadModules(): Promise<DeckModules> {
  const [maplibre, layers] = await Promise.all([import('@deck.gl/maplibre'), import('@deck.gl/layers')]);
  return { MapLibreOverlay: maplibre.MapLibreOverlay, ScatterplotLayer: layers.ScatterplotLayer, IconLayer: layers.IconLayer, TextLayer: layers.TextLayer };
}

async function addRenderer(map: MapLibreMap, state: DeckState, renderer: Renderer, modules: DeckModules, deviceProps?: Record<string, unknown>): Promise<void> {
  const overlay = new modules.MapLibreOverlay({
    interleaved: renderer === 'webgl2',
    layers: [],
    ...(deviceProps ? { deviceProps } : {}),
    onAfterRender: () => {
      if (state.overlay === overlay) {
        state.firstRender = true;
        publishState(map, state);
      }
    },
    onError: (error: Error) => {
      if (renderer === 'webgpu' && state.overlay === overlay && !state.firstRender) {
        void fallbackToWebGL(map, state, `WebGPU initialization failed: ${error.message}`);
      } else {
        console.error('[GaDeck] rendering error:', error);
      }
    },
  });
  state.renderer = renderer;
  state.modules = modules;
  state.overlay = overlay;
  state.firstRender = false;
  try {
    map.addControl(overlay);
    updateLayers(state);
    publishState(map, state);
  } catch (error) {
    if (state.overlay === overlay) state.overlay = null;
    try {
      overlay.finalize();
    } catch {}
    throw error;
  }
}

async function fallbackToWebGL(map: MapLibreMap, state: DeckState, reason: string): Promise<void> {
  if (state.fallbackPromise || state.removed) return state.fallbackPromise ?? Promise.resolve();
  state.fallbackReason = reason;
  state.firstRender = false;
  const previous = state.overlay;
  state.overlay = null;
  if (previous) {
    try {
      map.removeControl(previous);
    } catch {
      try {
        previous.finalize();
      } catch {}
    }
  }
  state.fallbackPromise = (async () => {
    try {
      const modules = state.modules ?? await loadModules();
      await addRenderer(map, state, 'webgl2', modules);
      publishState(map, state);
      if (!state.pulseFrame) startPulse(map, state);
      void runBenchmark(map, state);
    } catch (error) {
      console.error('[GaDeck] WebGL2 fallback failed:', error);
      publishState(map, state);
    } finally {
      state.fallbackPromise = null;
    }
  })();
  return state.fallbackPromise;
}

function benchmarkCount(): number {
  const value = new URLSearchParams(window.location.search).get('bench');
  if (!value) return 0;
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? Math.min(count, 2_000_000) : 0;
}

async function makeBenchData(count: number): Promise<BenchData> {
  const ring = await loadGaWallRing();
  if (ring.length < 3) throw new Error('Georgia wall ring unavailable');
  const longitudes = ring.map(([lng]) => lng);
  const latitudes = ring.map(([, lat]) => lat);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const divisions = 256;
  const inside = new Uint8Array(divisions * divisions);
  const cells: number[] = [];
  for (let y = 0; y < divisions; y++) {
    for (let x = 0; x < divisions; x++) {
      const coord: LngLat = [
        minLng + ((x + 0.5) / divisions) * (maxLng - minLng),
        minLat + ((y + 0.5) / divisions) * (maxLat - minLat),
      ];
      const index = y * divisions + x;
      if (insideRing(ring, coord)) {
        inside[index] = 1;
        cells.push(index);
      }
    }
  }
  if (!cells.length) throw new Error('Georgia wall mask has no interior cells');
  const positions = new Float32Array(count * 2);
  let filled = 0;
  while (filled < count) {
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const x = Math.min(divisions - 1, Math.floor(((lng - minLng) / (maxLng - minLng)) * divisions));
    const y = Math.min(divisions - 1, Math.floor(((lat - minLat) / (maxLat - minLat)) * divisions));
    if (!inside[y * divisions + x]) continue;
    positions[filled * 2] = lng;
    positions[filled * 2 + 1] = lat;
    filled++;
  }
  return { length: count, attributes: { getPosition: { value: positions, size: 2 } } };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

async function runBenchmark(map: MapLibreMap, state: DeckState): Promise<void> {
  const count = benchmarkCount();
  if (!count || state.benchStarted) return;
  state.benchStarted = true;
  try {
    state.benchData = await makeBenchData(count);
    updateLayers(state);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const times: number[] = [];
    const startedAt = performance.now();
    let previous = 0;
    const sample = (now: number) => {
      if (previous) times.push(now - previous);
      previous = now;
      if (now - startedAt < 10_000) {
        requestAnimationFrame(sample);
        return;
      }
      times.sort((a, b) => a - b);
      const p50FPS = Math.round((1000 / percentile(times, 0.5)) * 10) / 10;
      const p95FPS = Math.round((1000 / percentile(times, 0.95)) * 10) / 10;
      const p99FPS = Math.round((1000 / percentile(times, 0.99)) * 10) / 10;
      const renderer = state.renderer ?? 'webgl2';
      const detail = `${count.toLocaleString()} pts · p50 ${p50FPS} fps · p95 ${p95FPS} · p99 ${p99FPS} · ${renderer === 'webgpu' ? 'WebGPU' : 'WebGL2'}`;
      window.__gaBench = { points: count, renderer, p50FPS, p95FPS, p99FPS };
      console.info('[GaDeck benchmark]', window.__gaBench);
      reportGaFeed(map, {
        id: 'bench',
        label: 'Renderer benchmark (synthetic points)',
        color: '#22d3ee',
        count,
        detail,
        updatedAt: new Date().toISOString(),
        sourceUrl: 'https://deck.gl',
      });
    };
    requestAnimationFrame(sample);
  } catch (error) {
    console.warn('[GaDeck] benchmark unavailable:', error);
  }
}

async function initialize(map: MapLibreMap, state: DeckState): Promise<void> {
  try {
    const modules = await loadModules();
    const requested = new URLSearchParams(window.location.search).get('renderer');
    if (requested !== 'webgpu') {
      if (requested !== 'webgl') {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown | null> } }).gpu;
        if (gpu) {
          try {
            state.webgpuAdapterFound = !!(await gpu.requestAdapter());
          } catch {}
        }
      }
      await addRenderer(map, state, 'webgl2', modules);
    } else {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown | null> } }).gpu;
      if (!gpu) {
        await fallbackToWebGL(map, state, 'navigator.gpu is unavailable');
      } else {
        let adapter: unknown | null = null;
        try {
          adapter = await gpu.requestAdapter();
        } catch (error) {
          state.fallbackReason = `requestAdapter failed: ${error instanceof Error ? error.message : String(error)}`;
        }
        if (!adapter) {
          await fallbackToWebGL(map, state, state.fallbackReason ?? 'requestAdapter() returned null');
        } else {
          try {
            const { webgpuAdapter } = await import('@luma.gl/webgpu');
            await addRenderer(map, state, 'webgpu', modules, {
              type: 'webgpu',
              adapters: [webgpuAdapter],
              createCanvasContext: { alphaMode: 'premultiplied' },
            });
          } catch (error) {
            await fallbackToWebGL(map, state, `WebGPU initialization failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
    if (state.overlay && !state.removed) {
      updateLayers(state);
      publishState(map, state);
      if (!state.pulseFrame) startPulse(map, state);
      void runBenchmark(map, state);
    }
  } catch (error) {
    console.error('[GaDeck] overlay initialization failed:', error);
    if (!state.renderer && !state.removed) await fallbackToWebGL(map, state, `WebGPU initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function setGaDeckGroup(map: MapLibreMap, key: GroupKey, group: GaDeckGroup): void {
  const state = getState(map);
  state.groups.set(key, group);
  publishState(map, state);
  if (state.overlay) updateLayers(state);
  if (!state.initPromise) state.initPromise = initialize(map, state);
}

/** Draws only the given groups (all groups when `keys` is null). */
export function setGaDeckFocus(map: MapLibreMap, keys: readonly GroupKey[] | null): void {
  const state = getState(map);
  state.focus = keys ? new Set(keys) : null;
  updateLayers(state);
}
