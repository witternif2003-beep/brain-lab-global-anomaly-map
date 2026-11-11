import type { Layer } from '@deck.gl/core';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { deckGlobeActive, meshYaw } from './ga-deck-heading';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { GA_MARKER_SCALE, gaGlowMultiplier } from './ga-marker-scale';
import { GA_ICON_CELL_SCALE, gaIconAtlas, gaIconKey, type GaIconAtlas, type GaIconShape } from './ga-marker-icons';
import { gaMeshIfReady, gaLiveryMeshIfReady, gaMeshScale, gaModelReach, isFgKind, type GaModelKind } from './ga-mesh-models';
import { isTouchDevice, LIDAR_POINT_CEILING, markerPixelRatio } from './map/touch-gpu-budget';
import { gpuCrashCount } from './map/crash-guard';
import { declutterMarkers, type DeclutterCandidate, fitsViewport } from './ga-marker-declutter';
import type { CloudPuff } from './ga-clouds/cloud-puffs';
import { puffAtlas } from './ga-clouds/puff-texture';
import { cloudTopMesh, type CloudTopGrid, type CloudTopMesh } from './ga-goes-clouds/cloud-tops';
import { crimeStrobePhase } from './ga-live-markers/strobe';
import { staticRender } from './static-render';

export type RGBA = [number, number, number, number];
export interface GaDeckItem {
  coord: LngLat;
  radiusPx: number;
  fill: RGBA;
  stroke: RGBA;
  strokePx: number;
  glow?: number;
  pulse?: boolean;
  /** While `pulse` is set, the glyph and halo alternate between these two fills in the police light-bar pattern. */
  strobeColors?: [RGBA, RGBA];
  /** Drawn as this glyph (sized `iconPx`) instead of a circle. */
  icon?: GaIconShape;
  iconPx?: number;
  /** Heading in degrees clockwise from north; rotates the glyph on the map. */
  angle?: number;
  /** Short see-through tag drawn under the marker once zoomed in to the group's `labelMinZoom`. */
  label?: string;
  /** 3D model drawn in place of the glyph from `GA_MODEL_MIN_ZOOM`; `elevM` lifts it above the ground point (the glyph stays as its ground marker). */
  model?: { kind: GaModelKind; livery?: string; scale?: [number, number, number]; elevM?: number; msl?: boolean; always?: boolean; trueHeight?: boolean };
  props: Record<string, unknown>;
}
export interface GaDeckGroup {
  items: GaDeckItem[];
  z: number;
  labelMinZoom?: number;
  onClick: (map: MapLibreMap, lngLat: LngLat, props: Record<string, unknown>) => void;
}

type GroupKey = 'bulbs' | 'traffic' | 'gauges' | 'imagery' | 'fires' | 'aircraft' | 'transit' | 'micromobility' | 'stations' | 'streamgauges' | 'quakes' | 'tfr' | 'signals' | 'towers' | 'police' | 'firestations' | 'sirens' | 'speedcams' | 'alpr' | 'augusta911' | 'athens911' | 'gdotcams' | 'ga511events' | 'pireps' | 'equipment' | 'policereports' | 'policetech' | 'webcams' | 'vessels';
type Renderer = 'webgl2' | 'webgpu';
type Point = { x: number; y: number };
type DeckModules = {
  MapLibreOverlay: typeof import('@deck.gl/maplibre').MapLibreOverlay;
  ScatterplotLayer: typeof import('@deck.gl/layers').ScatterplotLayer;
  IconLayer: typeof import('@deck.gl/layers').IconLayer;
  TextLayer: typeof import('@deck.gl/layers').TextLayer;
  LineLayer: typeof import('@deck.gl/layers').LineLayer;
  SimpleMeshLayer: typeof import('@deck.gl/mesh-layers').SimpleMeshLayer;
  CloudSheetLayer: typeof import('@deck.gl/mesh-layers').SimpleMeshLayer;
  CloudSheetGlobeLayer: typeof import('@deck.gl/mesh-layers').SimpleMeshLayer;
};
type BenchData = {
  length: number;
  attributes: { getPosition: { value: Float32Array; size: 2 } };
};
type DeckSnapshot = {
  renderer: Renderer | null;
  fallbackReason: string | null;
  counts: Record<GroupKey, number>;
  labelsShown: number | null;
  /** Marker declutter: markers drawn and hidden in view after the last pass, and how long it took. */
  markers: { shown: number; hidden: number; ms: number } | null;
  pulse: { radiusScale: number; opacity: number };
  ground: { terrain: boolean; version: number; anchored: number };
  clouds: number;
  cloudSheet: { vertices: number; measured: number } | null;
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
  map: MapLibreMap;
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
  lightBar: 0 | 1 | 2;
  pointerFrame: number;
  pointer: Point | null;
  cursorSet: boolean;
  benchStarted: boolean;
  benchData: BenchData | null;
  published: DeckSnapshot | null;
  zoom: number;
  bearing: number;
  /** Whether the last model layers were built for deck.gl's GlobeView. */
  meshGlobe: boolean;
  atlas: GaIconAtlas | null;
  afterRender: Set<(canvas: HTMLCanvasElement) => void>;
  /** Labels kept by the last `declutterLabels` pass; null until the first pass. */
  labelShown: Set<GaDeckItem> | null;
  labelVersion: number;
  /** Markers kept by the last `declutterGroups` pass; null shows every marker (`?declutter=0`). */
  markerShown: Set<GaDeckItem> | null;
  markerVersion: number;
  markerStats: { shown: number; hidden: number; ms: number } | null;
  /** Terrain elevation (m, exaggerated as drawn) per coordinate; cleared when DEM tiles change. */
  ground: Map<string, number>;
  groundVersion: number;
  groundTimer: ReturnType<typeof setTimeout> | null;
  /** Radar cloud puffs; z in metres above sea level before terrain exaggeration. */
  clouds: CloudPuff[];
  /** GOES satellite cloud image on the GOES cloud-top-height mesh. */
  cloudSheet: GaCloudSheet | null;
}

export interface GaCloudSheet {
  grid: CloudTopGrid;
  texture: HTMLCanvasElement;
}
const sheetMeshes = new WeakMap<GaCloudSheet, { exaggeration: number; mesh: CloudTopMesh | null }>();
function sheetMesh(sheet: GaCloudSheet, exaggeration: number): CloudTopMesh | null {
  const hit = sheetMeshes.get(sheet);
  if (hit?.exaggeration === exaggeration) return hit.mesh;
  const mesh = cloudTopMesh(sheet.grid, exaggeration);
  sheetMeshes.set(sheet, { exaggeration, mesh });
  return mesh;
}

const states = new WeakMap<MapLibreMap, DeckState>();
type GroupViews = { glow: GaDeckItem[]; pulse: GaDeckItem[]; lightBar: boolean; dots: GaDeckItem[]; icons: GaDeckItem[]; streetIcons: GaDeckItem[]; labels: GaDeckItem[]; models: Map<string, GaDeckItem[]>; elevated: GaDeckItem[] };
const viewsByGroup = new WeakMap<GaDeckGroup, GroupViews>();
const DEPTH_PARAMETERS = { depthCompare: 'always', depthWriteEnabled: false, cullMode: 'none' } as const;
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
/** Strobe period for new/alerting markers: on for half, off for half (~4 blinks per second). */
const PULSE_BLINK_MS = 240;

/** Ground point, or the model itself for models drawn aloft at every zoom, so glows and strobes flash on the aircraft. */
const markerAt = (state: DeckState, item: GaDeckItem): [number, number, number] =>
  item.model?.always ? modelAt(state, item) : anchored(state, item.coord);
const strobeFill = (state: DeckState, item: GaDeckItem): RGBA =>
  item.pulse && item.strobeColors && state.lightBar ? item.strobeColors[state.lightBar - 1] : item.fill;
const MESH_PARAMETERS = { depthCompare: 'less-equal', depthWriteEnabled: true, cullMode: 'none' } as const;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** Cloud sprites test depth against terrain but don't write it, so overlapping puffs blend instead of clipping. */
const CLOUD_PARAMETERS = { depthCompare: 'less-equal', depthWriteEnabled: false, cullMode: 'none' } as const;
/** Zoom from which live markers with a `model` draw as 3D models. */
export const GA_MODEL_MIN_ZOOM = 15;
/** Models are true scale from zoom 19 and enlarged by up to 16× below it so they stay visible. */
const modelScale = (zoom: number) => (zoom < GA_MODEL_MIN_ZOOM ? 0 : 2 ** Math.min(4, Math.max(0, Math.floor(19 - zoom))));
const metresPerPixel = (lat: number, zoom: number) => (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
/** Models drawn at every zoom (`model.always`) are at least this many CSS pixels across a ~40 m airframe; true size once that is larger. */
export const GA_ALWAYS_MODEL_MIN_PX = 36;
const mapProjection = (map: MapLibreMap): string | undefined => {
  try {
    return (map as unknown as { getProjection?: () => { type?: string } | undefined }).getProjection?.()?.type;
  } catch {
    return undefined;
  }
};
const isDeckGlobe = (map: MapLibreMap): boolean => deckGlobeActive(mapProjection(map), map.getZoom());
export const alwaysModelScale = (lat: number, zoom: number): number => Math.max(1, (GA_ALWAYS_MODEL_MIN_PX * metresPerPixel(lat, zoom)) / 40);

function getState(map: MapLibreMap): DeckState {
  let state = states.get(map);
  if (state) return state;
  state = {
    map,
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
    lightBar: 0,
    pointerFrame: 0,
    pointer: null,
    cursorSet: false,
    benchStarted: false,
    benchData: null,
    published: null,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    meshGlobe: false,
    atlas: null,
    afterRender: new Set(),
    labelShown: null,
    labelVersion: 0,
    markerShown: null,
    markerVersion: 0,
    markerStats: null,
    ground: new Map(),
    groundVersion: 0,
    clouds: [],
    cloudSheet: null,
    groundTimer: null,
  };
  states.set(map, state);
  publishState(map, state);
  map.on('click', (event) => {
    const hit = hitAt(map, state!, event.point);
    if (hit) hit.group.onClick(map, hit.item.coord, hit.item.props);
  });
  const regroundSoon = () => {
    if (state!.groundTimer) return;
    state!.groundTimer = setTimeout(() => {
      state!.groundTimer = null;
      reground(state!);
    }, 300);
  };
  map.on('terrain', regroundSoon);
  map.on('sourcedata', (e) => {
    const terrain = map.getTerrain();
    if (terrain && e.sourceId === terrain.source && e.tile) regroundSoon();
  });
  map.on('zoomend', () => {
    state!.zoom = map.getZoom();
  });
  const reorientIfViewChanged = () => {
    if (isDeckGlobe(map) !== state!.meshGlobe) updateLayers(state!);
  };
  map.on('zoom', reorientIfViewChanged);
  map.on('projectiontransition', reorientIfViewChanged);
  map.on('style.load', reorientIfViewChanged);
  map.on('moveend', () => {
    declutterGroups(state!);
    declutterLabels(state!);
    updateLayers(state!);
  });
  map.on('rotateend', () => {
    const bearing = map.getBearing();
    if (bearing === state!.bearing) return;
    state!.bearing = bearing;
    updateLayers(state!);
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
    if (state!.groundTimer) clearTimeout(state!.groundTimer);
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
    labelsShown: state.labelShown?.size ?? null,
    markers: state.markerStats,
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
      quakes: state.groups.get('quakes')?.items.length ?? 0,
      tfr: state.groups.get('tfr')?.items.length ?? 0,
      signals: state.groups.get('signals')?.items.length ?? 0,
      towers: state.groups.get('towers')?.items.length ?? 0,
      police: state.groups.get('police')?.items.length ?? 0,
      firestations: state.groups.get('firestations')?.items.length ?? 0,
      sirens: state.groups.get('sirens')?.items.length ?? 0,
      speedcams: state.groups.get('speedcams')?.items.length ?? 0,
      alpr: state.groups.get('alpr')?.items.length ?? 0,
      augusta911: state.groups.get('augusta911')?.items.length ?? 0,
      athens911: state.groups.get('athens911')?.items.length ?? 0,
      gdotcams: state.groups.get('gdotcams')?.items.length ?? 0,
      pireps: state.groups.get('pireps')?.items.length ?? 0,
      equipment: state.groups.get('equipment')?.items.length ?? 0,
      ga511events: state.groups.get('ga511events')?.items.length ?? 0,
      policereports: state.groups.get('policereports')?.items.length ?? 0,
      policetech: state.groups.get('policetech')?.items.length ?? 0,
      webcams: state.groups.get('webcams')?.items.length ?? 0,
      vessels: state.groups.get('vessels')?.items.length ?? 0,
    },
    pulse: { radiusScale: state.pulseRadiusScale, opacity: state.pulseOpacity },
    ground: { terrain: !!state.map.getTerrain(), version: state.groundVersion, anchored: state.ground.size },
    clouds: state.clouds.length,
    cloudSheet: state.cloudSheet ? { vertices: state.cloudSheet.grid.cols * state.cloudSheet.grid.rows, measured: state.cloudSheet.grid.heightsM.filter((h) => h !== null).length } : null,
  };
}

/** Elevation of the drawn terrain surface under `coord` (0 without terrain or before its DEM tile loads). */
function groundM(state: DeckState, coord: LngLat): number {
  if (!state.map.getTerrain()) return 0;
  const key = `${coord[0]},${coord[1]}`;
  const cached = state.ground.get(key);
  if (cached !== undefined) return cached;
  const elev = state.map.queryTerrainElevation(coord);
  if (elev === null || !Number.isFinite(elev)) return 0;
  state.ground.set(key, elev);
  return elev;
}

/** Position on the terrain surface, optionally lifted `upM` above it, so markers sit on their exact ground point in 3D. */
const anchored = (state: DeckState, coord: LngLat, upM = 0): [number, number, number] => [coord[0], coord[1], groundM(state, coord) + upM];
/**
 * Model position. `msl` heights are metres above sea level: the true height above the ground is kept and stacked on
 * the (exaggerated) terrain surface, so a plane on final sits just above the runway, not under 1.5× hills.
 */
function modelAt(state: DeckState, item: GaDeckItem): [number, number, number] {
  const m = item.model!;
  if (!m.msl || !m.elevM) return anchored(state, item.coord, m.elevM ?? 0);
  const g = groundM(state, item.coord);
  const ex = (state.map.getTerrain() as { exaggeration?: number } | null)?.exaggeration ?? 1;
  return [item.coord[0], item.coord[1], g + Math.max(0, m.elevM - g / (ex || 1))];
}

/** Where a 3D model is drawn (lng, lat, metres on the map's terrain scale), for cameras that follow it. */
export const gaModelPosition = (map: MapLibreMap, item: Pick<GaDeckItem, 'coord' | 'model'>): [number, number, number] =>
  item.model ? modelAt(getState(map), item as GaDeckItem) : [item.coord[0], item.coord[1], 0];

function reground(state: DeckState): void {
  state.ground.clear();
  state.groundVersion += 1;
  updateLayers(state);
  publishState(state.map, state);
}

function publishState(map: MapLibreMap, state: DeckState): void {
  state.published = snapshot(state);
  if (typeof window !== 'undefined') window.__gaDeck = state.published;
  if (!state.renderer) return;
  const detail = state.renderer === 'webgpu'
    ? 'deck.gl 9.4 · WebGPU (experimental, overlaid)'
    : state.webgpuAdapterFound
      ? 'deck.gl 9.4 · WebGL2 (overlaid) · WebGPU adapter found; overlaid WebGPU is opt-in (?renderer=webgpu) until compositing is verified'
      : 'deck.gl 9.4 · WebGL2 (overlaid)';
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

function pickAlways(state: DeckState, point: Point): { group: GaDeckGroup; item: GaDeckItem } | null {
  let picked: { object?: unknown } | null = null;
  try {
    picked = state.overlay?.pickObject({ x: point.x, y: point.y, radius: HIT_BOX_PX }) ?? null;
  } catch {
    return null;
  }
  const item = picked?.object as GaDeckItem | undefined;
  if (!item?.model?.always) return null;
  for (const group of state.groups.values()) if (group.items.includes(item)) return { group, item };
  return null;
}

function hitAt(map: MapLibreMap, state: DeckState, point: Point): { group: GaDeckGroup; item: GaDeckItem } | null {
  const aloft = pickAlways(state, point);
  if (aloft) return aloft;
  const groups = [...state.groups.values()].sort((a, b) => b.z - a.z);
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
      if (item.model?.always) continue;
      if (state.markerShown && !state.markerShown.has(item)) continue;
      if (bounds && (item.coord[0] < bounds.w || item.coord[0] > bounds.e || item.coord[1] < bounds.s || item.coord[1] > bounds.n)) continue;
      const projected = map.project(item.coord);
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
      const iconReach = item.icon ? (item.iconPx ?? 0) * GA_MARKER_SCALE / 2 : item.radiusPx * GA_MARKER_SCALE + item.strokePx;
      const scale = item.model && !item.model.elevM ? modelScale(state.zoom) : 0;
      const reach = scale
        ? Math.max(iconReach, (gaModelReach(item.model!.kind) * Math.max(...(item.model!.scale ?? [1, 1, 1]).slice(0, 2)) * scale) / metresPerPixel(item.coord[1], state.zoom))
        : iconReach;
      if (distance <= Math.max(reach, 8) && distance < closestDistance) {
        closest = item;
        closestDistance = distance;
      }
    }
    if (closest) return { group, item: closest };
  }
  return null;
}

/** The overlaid deck.gl canvas drawn above the MapLibre canvas, if one is attached. */
export function gaDeckCanvas(map: MapLibreMap): HTMLCanvasElement | null {
  return states.get(map)?.overlay?.getCanvas() ?? null;
}

/** Runs `draw` with the overlaid deck.gl canvas right after its next frame, while its drawing buffer is still valid. */
export function onNextGaDeckFrame(map: MapLibreMap, draw: (canvas: HTMLCanvasElement) => void, timeoutMs: number): Promise<boolean> {
  const state = states.get(map);
  if (!state?.overlay) return Promise.resolve(false);
  return new Promise((resolve) => {
    const run = (canvas: HTMLCanvasElement) => {
      window.clearTimeout(timer);
      draw(canvas);
      resolve(true);
    };
    const timer = window.setTimeout(() => {
      state.afterRender.delete(run);
      resolve(false);
    }, timeoutMs);
    state.afterRender.add(run);
    map.triggerRepaint();
  });
}

/** Default deck.gl drawing-buffer pixel ratio: the device ratio, capped at 3× on touch devices (2× after a recent GPU crash). */
const defaultDevicePixels = (): number | true =>
  isTouchDevice() ? markerPixelRatio(window.devicePixelRatio || 1, true, gpuCrashCount()) : true;

/** Sets the deck.gl drawing-buffer pixel ratio (`true` restores the default ratio). */
export function setGaDeckPixelRatio(map: MapLibreMap, ratio: number | true): void {
  states.get(map)?.overlay?.setProps({ useDevicePixels: ratio === true ? defaultDevicePixels() : ratio });
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
      lightBar: group.items.some((item) => !!item.pulse && !!item.strobeColors),
      dots: group.items.filter((item) => !item.icon),
      icons: group.items.filter((item) => !!item.icon && !item.model?.always),
      streetIcons: group.items.filter((item) => !!item.icon && !item.model?.always && (!item.model || !!item.model.elevM)),
      labels: group.items.filter((item) => !!item.label),
      models: new Map(),
      elevated: group.items.filter((item) => !!item.model?.elevM && !item.model.always),
    };
    for (const item of group.items) {
      if (!item.model) continue;
      const key = item.model.livery ? `${item.model.kind}|${item.model.livery}` : item.model.kind;
      const list = views.models.get(key);
      if (list) list.push(item);
      else views.models.set(key, [item]);
    }
    viewsByGroup.set(group, views);
  }
  return views;
}

const showsLabels = (state: DeckState, group: GaDeckGroup) => group.labelMinZoom !== undefined && state.zoom >= group.labelMinZoom;
const LABEL_CHAR_PX = 6.2;
const LABEL_HEIGHT_PX = 14;
const LABEL_GAP_PX = 2;
const LABEL_CELL_PX = 64;
const labelOffsetPx = (item: GaDeckItem) => Math.round(((item.iconPx ?? item.radiusPx * 2) * GA_MARKER_SCALE) / 2) + 3;

/** Greedy screen-space placement: higher-z groups (then airborne aircraft) claim space first; overlapping lower-priority labels are dropped until the next move. */
function declutterLabels(state: DeckState): void {
  const { map } = state;
  const canvas = map.getCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const b = map.getBounds();
  const padLng = (b.getEast() - b.getWest()) * 0.25;
  const padLat = (b.getNorth() - b.getSouth()) * 0.25;
  const [west, east, south, north] = [b.getWest() - padLng, b.getEast() + padLng, b.getSouth() - padLat, b.getNorth() + padLat];
  const grid = new Map<string, [number, number, number, number][]>();
  const shown = new Set<GaDeckItem>();
  const groups = [...state.groups.values()].filter((g) => showsLabels(state, g)).sort((a, b2) => b2.z - a.z);
  for (const group of groups) {
    const labels = groupViews(group).labels;
    const ordered = labels.some((item) => item.model?.elevM) ? [...labels].sort((a, b2) => (b2.model?.elevM ? 1 : 0) - (a.model?.elevM ? 1 : 0)) : labels;
    for (const item of ordered) {
      if (state.markerShown && !state.markerShown.has(item)) continue;
      const [lng, lat] = item.coord;
      if (lng < west || lng > east || lat < south || lat > north) continue;
      const p = map.project(item.coord);
      const half = (item.label!.length * LABEL_CHAR_PX + 10) / 2 + LABEL_GAP_PX;
      const top = p.y + labelOffsetPx(item) - LABEL_GAP_PX;
      const rect: [number, number, number, number] = [p.x - half, top, p.x + half, top + LABEL_HEIGHT_PX + 2 * LABEL_GAP_PX];
      if (!fitsViewport(rect, w, h)) continue;
      const cells: string[] = [];
      for (let cx = Math.floor(rect[0] / LABEL_CELL_PX); cx <= Math.floor(rect[2] / LABEL_CELL_PX); cx++) {
        for (let cy = Math.floor(rect[1] / LABEL_CELL_PX); cy <= Math.floor(rect[3] / LABEL_CELL_PX); cy++) cells.push(`${cx}:${cy}`);
      }
      const hit = cells.some((c) => grid.get(c)?.some((r) => r[0] < rect[2] && rect[0] < r[2] && r[1] < rect[3] && rect[1] < r[3]));
      if (hit) continue;
      for (const c of cells) {
        const list = grid.get(c);
        if (list) list.push(rect);
        else grid.set(c, [rect]);
      }
      shown.add(item);
    }
  }
  state.labelShown = shown;
  state.labelVersion++;
}

/** Live aircraft are never hidden by the declutter pass; they still hide lower markers under them. */
const DECLUTTER_KEEP: ReadonlySet<GroupKey> = new Set(['aircraft']);
const declutterOff = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('declutter') === '0';

/**
 * Hides markers that sit on top of a higher-priority marker on screen (group `z`, aircraft first), like MapLibre's symbol
 * collision. Markers outside the padded view are kept so they appear while panning; the pass reruns on every `moveend`.
 */
function declutterGroups(state: DeckState): void {
  if (declutterOff()) {
    state.markerShown = null;
    state.markerStats = null;
    state.markerVersion++;
    return;
  }
  const t0 = performance.now();
  const { map } = state;
  const b = map.getBounds();
  const padLng = (b.getEast() - b.getWest()) * 0.1;
  const padLat = (b.getNorth() - b.getSouth()) * 0.1;
  const [west, east, south, north] = [b.getWest() - padLng, b.getEast() + padLng, b.getSouth() - padLat, b.getNorth() + padLat];
  const shown = new Set<GaDeckItem>();
  const candidates: DeclutterCandidate<GaDeckItem>[] = [];
  const entries = [...state.groups.entries()].sort((a, b2) => (DECLUTTER_KEEP.has(b2[0]) ? 1 : 0) - (DECLUTTER_KEEP.has(a[0]) ? 1 : 0) || b2[1].z - a[1].z);
  for (const [key, group] of entries) {
    const keep = DECLUTTER_KEEP.has(key);
    for (const item of group.items) {
      const [lng, lat] = item.coord;
      if (item.model?.always || lng < west || lng > east || lat < south || lat > north) {
        shown.add(item);
        continue;
      }
      const p = map.project(item.coord);
      const half = item.icon ? ((item.iconPx ?? 12) * GA_MARKER_SCALE) / 2 : item.radiusPx * GA_MARKER_SCALE + item.strokePx;
      candidates.push({ item, x: p.x, y: p.y, half, keep });
    }
  }
  const placed = declutterMarkers(candidates);
  for (const item of placed) shown.add(item);
  state.markerShown = shown;
  state.markerStats = { shown: placed.size, hidden: candidates.length - placed.size, ms: Math.round((performance.now() - t0) * 10) / 10 };
  state.markerVersion++;
}

const shownByList = new WeakMap<GaDeckItem[], { version: number; items: GaDeckItem[] }>();
/** `list` without the markers the last declutter pass hid. */
function shownOf(state: DeckState, list: GaDeckItem[]): GaDeckItem[] {
  const shown = state.markerShown;
  if (!shown || !list.length) return list;
  const cached = shownByList.get(list);
  if (cached?.version === state.markerVersion) return cached.items;
  const items = list.filter((item) => shown.has(item));
  shownByList.set(list, { version: state.markerVersion, items });
  return items;
}

const placedByGroup = new WeakMap<GaDeckGroup, { version: number; items: GaDeckItem[] }>();
function placedLabels(state: DeckState, group: GaDeckGroup, labels: GaDeckItem[]): GaDeckItem[] {
  const shown = state.labelShown;
  if (!shown) return labels;
  const cached = placedByGroup.get(group);
  if (cached?.version === state.labelVersion) return cached.items;
  const items = labels.filter((item) => shown.has(item));
  placedByGroup.set(group, { version: state.labelVersion, items });
  return items;
}
const LABEL_FONT = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';

function createLayers(state: DeckState): Layer[] {
  if (!state.modules) return [];
  const { ScatterplotLayer, IconLayer, TextLayer, LineLayer, SimpleMeshLayer, CloudSheetLayer, CloudSheetGlobeLayer } = state.modules;
  const scale = modelScale(state.zoom);
  const layers: Layer[] = [];
  const labelLayers: Layer[] = [];
  const sheet = state.cloudSheet;
  const mesh = sheet && sheetMesh(sheet, state.map.getTerrain()?.exaggeration ?? 1);
  if (sheet && mesh) {
    const globe = isDeckGlobe(state.map);
    const Sheet = globe ? CloudSheetGlobeLayer : CloudSheetLayer;
    layers.push(new Sheet({
      id: globe ? 'ga-deck-cloud-tops-globe' : 'ga-deck-cloud-tops',
      data: [0],
      mesh,
      texture: sheet.texture,
      _instanced: false,
      getPosition: () => [0, 0, 0],
      getColor: [255, 255, 255, 255],
      material: false,
      pickable: false,
      parameters: CLOUD_PARAMETERS,
    }));
  }
  if (state.clouds.length) {
    const exaggeration = state.map.getTerrain()?.exaggeration ?? 1;
    const atlas = puffAtlas();
    layers.push(new IconLayer<CloudPuff>({
      id: 'ga-deck-clouds',
      data: state.clouds,
      iconAtlas: atlas.url,
      iconMapping: atlas.mapping,
      getIcon: (p) => `puff${p.variant}`,
      getPosition: (p) => [p.position[0], p.position[1], p.position[2] * exaggeration],
      getSize: (p) => 2.6 * p.scale[0],
      getAngle: (p) => p.angle,
      getColor: (p) => p.color,
      updateTriggers: { getPosition: exaggeration },
      sizeUnits: 'meters',
      billboard: true,
      alphaCutoff: 0,
      pickable: false,
      parameters: CLOUD_PARAMETERS,
    }));
  }
  for (const [key, group] of [...state.groups.entries()].sort((a, b) => a[1].z - b[1].z)) {
    const views = groupViews(group);
    const { labels } = views;
    const glow = shownOf(state, views.glow);
    const pulse = shownOf(state, views.pulse);
    const dots = shownOf(state, views.dots);
    const icons = shownOf(state, scale && views.models.size ? views.streetIcons : views.icons);
    if (glow.length) {
      layers.push(new ScatterplotLayer({
        id: `ga-deck-${key}-bloom`,
        data: glow,
        getPosition: (item: GaDeckItem) => markerAt(state, item),
        updateTriggers: { getPosition: state.groundVersion },
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
        getPosition: (item: GaDeckItem) => markerAt(state, item),
        updateTriggers: { getPosition: state.groundVersion },
        getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE * gaGlowMultiplier(2),
        getFillColor: (item: GaDeckItem) => [item.stroke[0], item.stroke[1], item.stroke[2], Math.round(255 * 0.45 * Math.max(0, Math.min(1, item.glow ?? 0)))],
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        billboard: true,
        pickable: false,
        parameters: ADDITIVE_PARAMETERS,
      }));
    }
    if (scale && views.elevated.length) {
      layers.push(new LineLayer<GaDeckItem>({
        id: `ga-deck-${key}-drop`,
        data: views.elevated,
        getSourcePosition: (item) => anchored(state, item.coord),
        getTargetPosition: (item) => modelAt(state, item),
        updateTriggers: { getSourcePosition: state.groundVersion, getTargetPosition: state.groundVersion },
        getColor: (item) => [item.fill[0], item.fill[1], item.fill[2], 150],
        getWidth: 1,
        widthUnits: 'pixels',
        pickable: false,
        parameters: DEPTH_PARAMETERS,
      }));
    }
    {
      const aloftScale = alwaysModelScale(state.map.getCenter().lat, state.zoom);
      const globe = isDeckGlobe(state.map);
      state.meshGlobe = globe;
      for (const [modelKey, items] of views.models) {
        const kind = items[0].model!.kind;
        const always = !!items[0]?.model?.always;
        const kindScale = always ? aloftScale : scale;
        if (!kindScale) continue;
        const mesh = gaLiveryMeshIfReady(kind, items[0].model!.livery, () => updateLayers(state));
        if (!mesh) continue;
        layers.push(new SimpleMeshLayer<GaDeckItem>({
          id: `ga-deck-${key}-model-${modelKey}`,
          data: items,
          mesh,
          getPosition: (item) => modelAt(state, item),
          getOrientation: (item) => [0, meshYaw(item.angle, globe), 0],
          getScale: (item) => gaMeshScale(item.model!, kindScale),
          updateTriggers: { getPosition: state.groundVersion, getOrientation: globe, getScale: kindScale },
          // FlightGear meshes carry their paint colours per vertex; deck.gl multiplies them by this colour.
          getColor: isFgKind(kind) ? [255, 255, 255, 255] : (item) => [item.fill[0], item.fill[1], item.fill[2], 255],
          sizeScale: kindScale,
          pickable: always,
          parameters: MESH_PARAMETERS,
        }));
      }
    }
    if (icons.length && state.atlas) {
      layers.push(new IconLayer<GaDeckItem>({
        id: `ga-deck-${key}-icon`,
        data: icons,
        getPosition: (item) => anchored(state, item.coord),
        iconAtlas: state.atlas.url,
        iconMapping: state.atlas.mapping,
        getIcon: (item) => gaIconKey(item.icon!, strobeFill(state, item), item.stroke),
        getSize: (item) => (item.iconPx ?? 12) * GA_MARKER_SCALE * GA_ICON_CELL_SCALE,
        getAngle: (item) => (item.angle === undefined ? 0 : state.bearing - item.angle),
        updateTriggers: { getAngle: state.bearing, getPosition: state.groundVersion, getIcon: views.lightBar ? state.lightBar : 0 },
        sizeUnits: 'pixels',
        billboard: true,
        alphaCutoff: 0.02,
        pickable: false,
        parameters: DEPTH_PARAMETERS,
      }));
    }
    const placed = labels.length && showsLabels(state, group) ? placedLabels(state, group, labels) : [];
    if (placed.length) {
      labelLayers.push(new TextLayer<GaDeckItem>({
        id: `ga-deck-${key}-label`,
        data: placed,
        getPosition: (item) => (item.model?.always ? modelAt(state, item) : anchored(state, item.coord)),
        getText: (item) => item.label!,
        updateTriggers: { getPosition: state.groundVersion },
        getColor: (item) => [Math.min(255, item.fill[0] + 30), Math.min(255, item.fill[1] + 30), Math.min(255, item.fill[2] + 30), 240],
        getSize: 10,
        getPixelOffset: (item) => [0, labelOffsetPx(item)],
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
      getPosition: (item: GaDeckItem) => anchored(state, item.coord),
        updateTriggers: { getPosition: state.groundVersion },
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
        getPosition: (item: GaDeckItem) => markerAt(state, item),
        updateTriggers: { getPosition: state.groundVersion, getFillColor: views.lightBar ? state.lightBar : 0 },
        getRadius: (item: GaDeckItem) => item.radiusPx * GA_MARKER_SCALE,
        getFillColor: (item: GaDeckItem) => { const f = strobeFill(state, item); return [f[0], f[1], f[2], 120]; },
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
  if (!state.overlay || !state.modules) return;
  state.overlay.setProps({ layers: createLayers(state) });
}

function startPulse(map: MapLibreMap, state: DeckState): void {
  if (staticRender()) return;
  const animate = (now: number) => {
    if (state.removed) return;
    state.pulseFrame = requestAnimationFrame(animate);
    if (now - state.lastPulse < 50) return;
    state.lastPulse = now;
    const on = now % PULSE_BLINK_MS < PULSE_BLINK_MS * 0.5;
    state.pulseRadiusScale = 1.9;
    state.pulseOpacity = on ? 0.95 : 0;
    state.lightBar = crimeStrobePhase(now);
    if ([...state.groups.values()].some((group) => group.items.some((item) => item.pulse))) {
      updateLayers(state);
    }
    publishState(map, state);
  };
  state.pulseFrame = requestAnimationFrame(animate);
}

async function loadModules(): Promise<DeckModules> {
  const [maplibre, layers, meshLayers] = await Promise.all([import('@deck.gl/maplibre'), import('@deck.gl/layers'), import('@deck.gl/mesh-layers')]);
  return {
    MapLibreOverlay: maplibre.MapLibreOverlay,
    ScatterplotLayer: layers.ScatterplotLayer,
    IconLayer: layers.IconLayer,
    TextLayer: layers.TextLayer,
    LineLayer: layers.LineLayer,
    SimpleMeshLayer: meshLayers.SimpleMeshLayer,
    CloudSheetLayer: cloudSheetLayer(meshLayers.SimpleMeshLayer) as unknown as typeof meshLayers.SimpleMeshLayer,
    CloudSheetGlobeLayer: cloudSheetLayer(meshLayers.SimpleMeshLayer, true) as unknown as typeof meshLayers.SimpleMeshLayer,
  };
}

/** Cloud-top sheet fades out where the view grazes it (far toward the horizon), so distant cloud dissolves into the sky like the near puffs. */
export const CLOUD_SHEET_GRAZE_FADE = [0.02, 0.25] as const;
/** Steep mesh walls only join neighbouring cloud tops of different height; they are not cloud, so they fade out instead of showing as grey facets. */
export const CLOUD_SHEET_WALL_FADE = [0.25, 0.6] as const;
export function cloudSheetLayer(Base: typeof import('@deck.gl/mesh-layers').SimpleMeshLayer, globe = false) {
  class CloudSheetLayer extends Base {
    static layerName = 'CloudSheetLayer';
    getShaders() {
      const shaders = super.getShaders();
      return {
        ...shaders,
        inject: {
          ...(shaders.inject ?? {}),
          'fs:#main-end': `
vec3 cloudUp = ${globe ? 'normalize(position_commonspace.xyz)' : 'vec3(0.0, 0.0, 1.0)'};
float cloudGraze = abs(dot(normalize(position_commonspace.xyz - cameraPosition), cloudUp));
fragColor.a *= smoothstep(${CLOUD_SHEET_GRAZE_FADE[0].toFixed(3)}, ${CLOUD_SHEET_GRAZE_FADE[1].toFixed(3)}, cloudGraze);
vec3 cloudNormal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
fragColor.a *= smoothstep(${CLOUD_SHEET_WALL_FADE[0].toFixed(3)}, ${CLOUD_SHEET_WALL_FADE[1].toFixed(3)}, abs(dot(cloudNormal, cloudUp)));
`,
        },
      };
    }
  }
  return CloudSheetLayer;
}

async function addRenderer(map: MapLibreMap, state: DeckState, renderer: Renderer, modules: DeckModules, deviceProps?: Record<string, unknown>): Promise<void> {
  const overlay = new modules.MapLibreOverlay({
    interleaved: false,
    layers: [],
    useDevicePixels: defaultDevicePixels(),
    ...(deviceProps ? { deviceProps } : {}),
    _onMetrics: (m: { gpuTimePerFrame: number; cpuTimePerFrame: number }) => {
      if (state.overlay === overlay) window.__gaDeckMetrics = { gpuMsPerFrame: m.gpuTimePerFrame, cpuMsPerFrame: m.cpuTimePerFrame, renderer };
    },
    onAfterRender: () => {
      if (state.overlay === overlay) {
        const container = overlay.getCanvas()?.parentElement;
        const canvasContainer = map.getCanvasContainer();
        if (container && canvasContainer.nextElementSibling !== container) canvasContainer.after(container);
        state.firstRender = true;
        const canvas = overlay.getCanvas();
        if (canvas) {
          for (const draw of state.afterRender) draw(canvas);
        }
        state.afterRender.clear();
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
  return Number.isFinite(count) && count > 0 ? Math.min(count, LIDAR_POINT_CEILING) : 0;
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

/** Replaces the GOES cloud-top sheet (drawn under the radar puffs and every marker group). */
export function setGaDeckCloudSheet(map: MapLibreMap, sheet: GaCloudSheet | null): void {
  const state = getState(map);
  state.cloudSheet = sheet;
  publishState(map, state);
  if (state.overlay) updateLayers(state);
  if (!state.initPromise) state.initPromise = initialize(map, state);
}

/** Replaces the radar cloud puffs (drawn under every marker group). */
export function setGaDeckClouds(map: MapLibreMap, puffs: CloudPuff[]): void {
  const state = getState(map);
  state.clouds = puffs;
  publishState(map, state);
  if (state.overlay) updateLayers(state);
  if (!state.initPromise) state.initPromise = initialize(map, state);
}

export function setGaDeckGroup(map: MapLibreMap, key: GroupKey, group: GaDeckGroup): void {
  const state = getState(map);
  state.groups.set(key, group);
  state.atlas = gaIconAtlas(group.items.flatMap((item) => [item, ...(item.strobeColors ?? []).map((fill) => ({ icon: item.icon, fill, stroke: item.stroke }))]));
  declutterGroups(state);
  if (group.labelMinZoom !== undefined) declutterLabels(state);
  publishState(map, state);
  if (state.overlay) updateLayers(state);
  if (!state.initPromise) state.initPromise = initialize(map, state);
}

declare global {
  interface Window { __gaDeckMetrics?: { gpuMsPerFrame: number; cpuMsPerFrame: number; renderer: Renderer } }
}
