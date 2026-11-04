import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  Matrix4,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import {
  EPT_ROOT,
  GA_LIDAR_SOURCE_URL,
  IMAGERY_TILE_URL,
  IMAGERY_ZOOM,
  decodeNode,
  imageryPixel,
  heightRampColor,
  lngLatFrom3857,
  lngLatTo3857,
  pickProject,
  planNodes,
  targetDepthFor,
} from './ga-lidar/ept';
import type { EptProject, Hierarchy, LidarNodeData } from './ga-lidar/ept';
import { quantizeUint16 } from './ga-lidar/gpu-upload';
import { EDL_RADIUS_CSS_PX, EdlPass } from './ga-lidar/edl';
import { lidarVramStats, type LidarVramStats } from './map/vram-budget';
import { nodeSpacings } from './ga-lidar/ept';
import { cachedFetch } from './ga-lidar/disk-cache';
import { fullArray, releaseAfterUpload } from './ga-lidar/gpu-upload';
import { GpuPassTimer } from './ga-lidar/gpu-timer';
import { isTouchDevice, lidarBudget } from './map/touch-gpu-budget';
import { gpuCrashCount, gpuSafeMode } from './map/crash-guard';
import { drawingBufferBytes, LIDAR_BYTES_PER_POINT, LIDAR_MIN_POINTS, lidarBytesPerPoint, lidarPointBudget, vramTargetBytes } from './map/vram-budget';
import { vramMeterInstalled, vramSnapshot } from './map/vram-meter';
import { reportGaFeed } from './ga-live-status';
import { raiseGaRoadOverlay } from './ga-roads-overlay';
import { raiseGaTrafficCountLayers } from './ga-traffic-counts-layer';
import { GA_ROAD_LAYERS } from './ga-roads-overlay';

export const GA_LIDAR_MIN_ZOOM = 10;
const VIEW_TILES = 3.5;
/** Fixed point diameter (CSS px) at every zoom and distance: sharp micro-dots, the imagery shows between them. */
export const POINT_CSS_PX = 0.08;
/**
 * Points whose ground patch is squashed on screen below this fraction (about 80° from straight down) are
 * dropped: at the horizon the patch shrinks to a sliver, so the points only sparkle as a grainy line.
 */
const HORIZON_MIN_FORESHORTENING = 0.17;
/** Extra octree levels so the points still close up at street zoom. */
const EXTRA_DEPTH = 1;
/** Desktop GPUs fetch two more octree levels (dot size unchanged), so the nodes around the camera reach full survey density. */
const EXTRA_DEPTH_DESKTOP = 3;
/** Deepest octree level requested; USGS EPT leaves end where the survey density runs out. */
const MAX_EPT_DEPTH = 18;
const TERRAIN_GRID = 8;
const SURFACE_LIFT_M = 0.25;
const ORIGIN_RESET_M = 15_000;
const WORLD_3857 = 2 * Math.PI * 6378137;

export interface GaLidarStats {
  /** Measured GPU memory gate: LiDAR bytes held vs this device's target. */
  stats: () => LidarVramStats;
  project: string | null;
  year: number | null;
  ql: string | null;
  targetDepth: number;
  nodesPlanned: number;
  nodesDrawn: number;
  pointsDrawn: number;
  /** Nodes whose points carry true colour sampled from the imagery under them. */
  nodesTrueColor: number;
  loading: number;
  errors: number;
  /** Hierarchy/node responses served from the on-device disk cache vs fetched from the network this session. */
  diskHits: number;
  diskMisses: number;
  status: string;
  /** p95 GPU time of the LiDAR draw (ms); null when EXT_disjoint_timer_query_webgl2 is unavailable. */
  gpuMsP95: number | null;
  gpuTimer: 'unsupported' | 'active';
  /** Measured GPU memory held by this page's WebGL allocations (MB), its peak, and the working target. */
  vramMB: number | null;
  vramPeakMB: number | null;
  vramTargetMB: number;
  /** Points the layer may hold after the GPU-memory budget (≤ the 20,000,000 ceiling). */
  pointBudget: number;
  /** True when loading stopped early because measured GPU memory reached the target. */
  vramLimited: boolean;
}

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  uniform float uSpacing;
  uniform float uSpacingOwn;
  uniform vec2 uCentre;
  uniform float uHalf;
  uniform float uSpacingCentre;
  uniform vec2 uViewport;
  uniform float uPointPx;
  uniform float uHorizon;
  uniform vec3 uQOffset;
  uniform vec3 uQScale;
  varying vec3 vColor;
  void main() {
    mat4 mvp = projectionMatrix * modelViewMatrix;
    // Positions are stored as 16-bit integers per node (6 bytes instead of 12) and expanded here.
    vec3 P = uQOffset + position * uQScale;
    vec4 p0 = mvp * vec4(P, 1.0);
    // Planned detail falls off one level per doubling of distance past half the view radius, so the spacing
    // grows with distance from the view centre: between the node's finest-below and own spacing.
    float falloff = max(1.0, 2.0 * length(P.xy - uCentre) / uHalf);
    float spacing = clamp(uSpacingCentre * falloff, uSpacing, uSpacingOwn);
    vec4 px = mvp * vec4(P + vec3(spacing, 0.0, 0.0), 1.0);
    vec4 py = mvp * vec4(P + vec3(0.0, spacing, 0.0), 1.0);
    vec2 s0 = p0.xy / p0.w;
    vec2 ex = (px.xy / px.w - s0) * uViewport;
    vec2 ey = (py.xy / py.w - s0) * uViewport;
    float spacingPx = max(length(ex), length(ey));
    // Screen area of the point's ground patch over its square: 1 looking straight down, 0 edge-on.
    float foreshortening = abs(ex.x * ey.y - ex.y * ey.x) / max(spacingPx * spacingPx, 1e-12);
    // Fixed size: no distance attenuation and no growth with point spacing.
    gl_PointSize = uPointPx;
    // Outside the clip volume, so the GPU skips it.
    gl_Position = foreshortening < uHorizon ? vec4(2.0, 2.0, 2.0, 1.0) : p0;
    vColor = aColor;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

interface DrawnNode {
  points: Points;
  data: LidarNodeData;
  terrainStale: boolean;
  trueColor: boolean;
}

/**
 * Street-zoom USGS 3DEP LiDAR: classified airborne laser returns streamed from the Entwine Point Tile
 * octrees on AWS Open Data (decoded by /api/ga-lidar), drawn as a Three.js point cloud inside MapLibre.
 * Points sit at their height above ground on top of the map surface, so they line up with the imagery
 * with or without 3D terrain.
 */
const liveLayers = new WeakMap<MapLibreMap, GaLidar3DLayer>();

/** Decoded 3DEP nodes currently drawn on `map` (empty when LiDAR is not showing). */
export function gaLidarNodes(map: MapLibreMap): LidarNodeData[] {
  return liveLayers.get(map)?.nodeData() ?? [];
}

export class GaLidar3DLayer implements CustomLayerInterface {
  readonly id = 'ga-lidar-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uSpacing: { value: 1 },
      uSpacingOwn: { value: 1 },
      uCentre: { value: new Vector2(0, 0) },
      uHalf: { value: 1 },
      uSpacingCentre: { value: 1 },
      uViewport: { value: new Vector2(1, 1) },
      uPointPx: { value: POINT_CSS_PX },
      uQOffset: { value: new Vector3() },
      uQScale: { value: new Vector3(1, 1, 1) },
      uHorizon: { value: HORIZON_MIN_FORESHORTENING },
    },
  });
  private origin: MercatorCoordinate | null = null;
  private readonly edl = new EdlPass();
  private originXY: [number, number] = [0, 0];
  private project: EptProject | null = null;
  private readonly hierarchies = new Map<string, Hierarchy>();
  private readonly loadedHierarchyFiles = new Set<string>();
  private readonly drawn = new Map<string, DrawnNode>();
  private readonly inflight = new Set<string>();
  private generation = 0;
  private readonly imagery = new Map<string, Promise<Uint8ClampedArray | null>>();
  private imageryCanvas: HTMLCanvasElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly stats: GaLidarStats = {
    stats: () => lidarVramStats(this.stats.pointsDrawn, this.vramTarget(), lidarBytesPerPoint(isTouchDevice())),
    project: null,
    year: null,
    ql: null,
    targetDepth: 0,
    nodesPlanned: 0,
    nodesDrawn: 0,
    pointsDrawn: 0,
    nodesTrueColor: 0,
    loading: 0,
    errors: 0,
    diskHits: 0,
    diskMisses: 0,
    status: 'idle',
    gpuMsP95: null,
    gpuTimer: 'unsupported',
    vramMB: null,
    vramPeakMB: null,
    vramTargetMB: 0,
    pointBudget: 0,
    vramLimited: false,
  };
  private vramTimer: ReturnType<typeof setInterval> | null = null;
  private gpuTimer: GpuPassTimer | null = null;
  private readonly onMoveEnd = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.update(), 150);
  };
  private readonly onIdle = () => {
    let changed = false;
    for (const n of this.drawn.values()) {
      if (n.terrainStale) changed = this.applySurface(n) || changed;
    }
    if (changed) this.map?.triggerRepaint();
  };

  nodeData(): LidarNodeData[] {
    return [...this.drawn.values()].map((n) => n.data);
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    liveLayers.set(map, this);
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.gpuTimer = GpuPassTimer.create(gl);
    this.stats.gpuTimer = this.gpuTimer ? 'active' : 'unsupported';
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    map.on('moveend', this.onMoveEnd);
    map.on('idle', this.onIdle);
    this.vramTimer = setInterval(() => this.reportVram(), VRAM_REPORT_MS);
    if (typeof window !== 'undefined') {
      (window as unknown as { __gaLidar?: GaLidarStats }).__gaLidar = this.stats;
    }
    void this.update();
  }

  onRemove(map: MapLibreMap): void {
    if (liveLayers.get(map) === this) liveLayers.delete(map);
    map.off('moveend', this.onMoveEnd);
    map.off('idle', this.onIdle);
    if (this.timer) clearTimeout(this.timer);
    if (this.vramTimer) clearInterval(this.vramTimer);
    this.generation++;
    for (const key of [...this.drawn.keys()]) this.dropNode(key);
    this.material.dispose();
    this.edl.dispose();
    this.map = null;
    this.renderer = null;
  }

  private setStatus(status: string): void {
    this.stats.status = status;
    this.stats.nodesDrawn = this.drawn.size;
    this.stats.pointsDrawn = [...this.drawn.values()].reduce((s, n) => s + n.data.count, 0);
    this.stats.loading = this.inflight.size;
    this.stats.nodesTrueColor = [...this.drawn.values()].filter((n) => n.trueColor).length;
  }

  private async hierarchy(project: EptProject, file: string): Promise<void> {
    const id = `${project.name}/${file}`;
    if (this.loadedHierarchyFiles.has(id)) return;
    this.loadedHierarchyFiles.add(id);
    try {
      const r = await cachedFetch(`${EPT_ROOT}/${project.name}/ept-hierarchy/${file}.json`, this.stats);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const part = (await r.json()) as Hierarchy;
      const merged = this.hierarchies.get(project.name) ?? {};
      Object.assign(merged, part);
      this.hierarchies.set(project.name, merged);
    } catch (err) {
      this.loadedHierarchyFiles.delete(id);
      this.stats.errors++;
      console.warn('[GaLidar3D] hierarchy load failed:', file, err);
    }
  }

  private async update(): Promise<void> {
    const map = this.map;
    if (!map) return;
    const gen = ++this.generation;
    const zoom = map.getZoom();
    const c = map.getCenter();
    const [cx, cy] = lngLatTo3857(c.lng, c.lat);
    const project = zoom >= GA_LIDAR_MIN_ZOOM ? pickProject(cx, cy) : null;
    this.stats.project = project?.name ?? null;
    this.stats.year = project?.year ?? null;
    this.stats.ql = project?.ql ?? null;
    if (!project) {
      for (const key of [...this.drawn.keys()]) this.dropNode(key);
      this.setStatus(zoom >= GA_LIDAR_MIN_ZOOM ? 'no USGS 3DEP LiDAR at this location' : `zoom to ${GA_LIDAR_MIN_ZOOM}+ for LiDAR`);
      map.triggerRepaint();
      return;
    }
    if (this.project?.name !== project.name) {
      for (const key of [...this.drawn.keys()]) this.dropNode(key);
      this.project = project;
    }
    if (!this.origin || Math.hypot(cx - this.originXY[0], cy - this.originXY[1]) > ORIGIN_RESET_M) {
      for (const key of [...this.drawn.keys()]) this.dropNode(key);
      this.origin = MercatorCoordinate.fromLngLat([c.lng, c.lat], 0);
      this.originXY = [cx, cy];
    }

    const half = (VIEW_TILES * WORLD_3857) / 2 ** zoom;
    const targetDepth = Math.min(MAX_EPT_DEPTH, targetDepthFor(project, half, MAX_EPT_DEPTH) + (isTouchDevice() ? EXTRA_DEPTH : EXTRA_DEPTH_DESKTOP));
    const view = { cx, cy, half, targetDepth, pointBudget: this.pointBudget() };
    this.stats.targetDepth = targetDepth;
    this.setStatus('loading hierarchy');

    await this.hierarchy(project, '0-0-0-0');
    let plan = planNodes(project, this.hierarchies.get(project.name) ?? {}, view);
    for (let round = 0; round < 8 && plan.pendingHierarchy.length; round++) {
      await Promise.all(plan.pendingHierarchy.map((k) => this.hierarchy(project, k)));
      if (gen !== this.generation) return;
      const merged = this.hierarchies.get(project.name) ?? {};
      plan = planNodes(project, merged, view);
      if (plan.pendingHierarchy.every((k) => this.loadedHierarchyFiles.has(`${project.name}/${k}`))) break;
    }
    if (gen !== this.generation) return;

    const cube = project.bounds[3] - project.bounds[0];
    const spacing = nodeSpacings(project, plan.nodes);
    const k = this.metresPer3857();
    const fallback = cube / 2 ** targetDepth / project.span;
    this.spacingFor = (key) => {
      const s = spacing.get(key);
      return { own: (s?.own ?? fallback) * k, fine: (s?.fine ?? fallback) * k };
    };
    const centre = plan.nodes.filter((n) => n.dist === 0).sort((a, b) => b.depth - a.depth)[0];
    const u = this.material.uniforms;
    u.uSpacingCentre.value = (centre ? spacing.get(centre.key)!.own : fallback) * k;
    u.uCentre.value.set((cx - this.originXY[0]) * k, (cy - this.originXY[1]) * k);
    u.uHalf.value = half * k;
    const wanted = new Set(plan.nodes.map((n) => n.key));
    for (const key of [...this.drawn.keys()]) if (!wanted.has(key)) this.dropNode(key);
    for (const [key, n] of this.drawn) {
      const { uniforms } = n.points.material as ShaderMaterial;
      const s = this.spacingFor(key);
      uniforms.uSpacing.value = s.fine;
      uniforms.uSpacingOwn.value = s.own;
    }
    this.stats.nodesPlanned = plan.nodes.length;
    const queue = plan.nodes.filter((n) => !this.drawn.has(n.key) && !this.inflight.has(n.key));
    this.setStatus(queue.length ? 'loading points' : 'ready');
    map.triggerRepaint();

    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        if (gen !== this.generation) return;
        if (this.stats.pointsDrawn >= LIDAR_MIN_POINTS && this.overVramTarget()) {
          this.stats.vramLimited = true;
          queue.length = 0;
          return;
        }
        const key = next.key;
        this.inflight.add(key);
        this.setStatus('loading points');
        try {
          const r = await cachedFetch(`/api/ga-lidar?project=${encodeURIComponent(project.name)}&node=${key}`, this.stats);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = decodeNode(await r.arrayBuffer());
          if (gen === this.generation && this.project?.name === project.name) this.addNode(key, data);
        } catch (err) {
          this.stats.errors++;
          console.warn('[GaLidar3D] node load failed:', key, err);
        } finally {
          this.inflight.delete(key);
        }
      }
    };
    await Promise.all(Array.from({ length: lidarBudget(isTouchDevice(), gpuCrashCount()).fetchParallel }, worker));
    if (gen === this.generation) this.setStatus('ready');
  }

  /** GPU bytes of the LiDAR points currently uploaded. */
  private lidarBytes(): number {
    let b = 0;
    for (const n of this.drawn.values()) b += n.data.count * LIDAR_BYTES_PER_POINT;
    return b;
  }

  /** Measured page GPU bytes plus the map's own drawing buffer (not visible to the allocation meter). */
  private measuredVram(): number | null {
    if (!vramMeterInstalled() || !this.map) return null;
    const c = this.map.getCanvas();
    return vramSnapshot().bytes + drawingBufferBytes(c.width, c.height, isTouchDevice() ? 1 : 4);
  }

  private vramTarget(): number {
    return vramTargetBytes(isTouchDevice(), gpuSafeMode());
  }

  /** LiDAR point budget: the 20,000,000 ceiling, lowered to what fits in the GPU-memory target next to everything else on the map. */
  private pointBudget(): number {
    const ceiling = lidarBudget(isTouchDevice(), gpuCrashCount()).points;
    const used = this.measuredVram();
    const budget = used === null ? ceiling : lidarPointBudget({ ceiling, targetBytes: this.vramTarget(), otherBytes: used - this.lidarBytes(), bytesPerPoint: lidarBytesPerPoint(isTouchDevice()) });
    this.stats.pointBudget = budget;
    this.stats.vramLimited = budget < ceiling;
    return budget;
  }

  private overVramTarget(): boolean {
    const used = this.measuredVram();
    return used !== null && used >= this.vramTarget();
  }

  private reportVram(): void {
    const map = this.map;
    const used = this.measuredVram();
    const MB = 1024 * 1024;
    this.stats.vramTargetMB = Math.round(this.vramTarget() / MB);
    if (!map || used === null) return;
    this.stats.vramMB = Math.round(used / MB);
    this.stats.vramPeakMB = Math.round(vramSnapshot().peakBytes / MB);
    const lidarMB = Math.round(this.lidarBytes() / MB);
    reportGaFeed(map, {
      id: 'gpu-memory', label: 'GPU memory (measured)', color: this.stats.vramLimited ? '#f43f5e' : '#22d3ee', count: this.stats.vramMB,
      detail: `${this.stats.project ? `survey ${this.stats.project} (${this.stats.year}, USGS ${this.stats.ql === 'other' ? 'pre-standard' : this.stats.ql}) · ` : ''}${this.stats.vramMB} MB of ${this.stats.vramTargetMB} MB target · peak ${this.stats.vramPeakMB} MB · LiDAR ${lidarMB} MB, ${this.stats.pointsDrawn.toLocaleString()} of ${this.stats.pointBudget.toLocaleString()} allowed points${this.stats.vramLimited ? ' · LiDAR capped to fit' : ''}${gpuSafeMode() ? ' · safe mode after a recent crash' : ''} · counted from WebGL allocations (estimate)`,
      updatedAt: new Date().toISOString(), sourceUrl: '',
    });
  }

  /** Ground spacing (metres) of a node's points where nothing finer is planned (own) and under its finest planned descendant (fine). */
  private spacingFor: (key: string) => { own: number; fine: number } = () => ({ own: 1, fine: 1 });

  /** Real-world metres per EPSG:3857 metre at the layer origin. */
  private metresPer3857(): number {
    const s = this.origin?.meterInMercatorCoordinateUnits() ?? 1;
    return 1 / (WORLD_3857 * s);
  }

  private addNode(key: string, data: LidarNodeData): void {
    const n = data.count;
    const geometry = new BufferGeometry();
    // WebGL keeps its own copy of each buffer, so the JavaScript arrays are freed after upload and rebuilt from `data` on change.
    geometry.setAttribute('position', releaseAfterUpload(new BufferAttribute(new Uint16Array(n * 3), 3)));
    geometry.setAttribute('aColor', releaseAfterUpload(new BufferAttribute(classColors(data), 3, true)));
    // Own material per node (same compiled shader) so each node's point size follows its own detail level.
    const material = this.material.clone();
    const s = this.spacingFor(key);
    material.uniforms = { ...this.material.uniforms, uSpacing: { value: s.fine }, uSpacingOwn: { value: s.own }, uQOffset: { value: new Vector3() }, uQScale: { value: new Vector3(1, 1, 1) } };
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    const node: DrawnNode = { points, data, terrainStale: false, trueColor: false };
    this.applySurface(node);
    this.scene.add(points);
    this.drawn.set(key, node);
    this.setStatus(this.inflight.size > 1 ? 'loading points' : 'ready');
    this.map?.triggerRepaint();
    void this.colorFromImagery(key, node);
  }

  /** Esri World Imagery tile as RGBA pixels, or null where the tile is missing or unreadable. */
  private imageryTile(z: number, tx: number, ty: number): Promise<Uint8ClampedArray | null> {
    const id = `${z}/${tx}/${ty}`;
    const cached = this.imagery.get(id);
    if (cached) return cached;
    const load = (async () => {
      try {
        const r = await fetch(`${IMAGERY_TILE_URL}/${z}/${ty}/${tx}?blankTile=false`);
        if (!r.ok) return null;
        const bitmap = await createImageBitmap(await r.blob());
        const canvas = (this.imageryCanvas ??= document.createElement('canvas'));
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, 256, 256);
        bitmap.close();
        return ctx.getImageData(0, 0, 256, 256).data;
      } catch {
        return null;
      }
    })();
    this.imagery.set(id, load);
    if (this.imagery.size > lidarBudget(isTouchDevice(), gpuCrashCount()).imageryTiles) this.imagery.delete(this.imagery.keys().next().value as string);
    return load;
  }

  /** Recolours a node with the aerial-photo colour under each return (classification colours stay where imagery is missing). */
  private async colorFromImagery(key: string, node: DrawnNode): Promise<void> {
    const { data } = node;
    const z = Math.min(IMAGERY_ZOOM, Math.floor(Math.log2(WORLD_3857 / data.width)) + 1);
    const a = imageryPixel(data.minX, data.minY + data.width, z);
    const b = imageryPixel(data.minX + data.width, data.minY, z);
    const tiles = new Map<string, Uint8ClampedArray | null>();
    await Promise.all(
      Array.from({ length: (b.tx - a.tx + 1) * (b.ty - a.ty + 1) }, async (_, i) => {
        const tx = a.tx + (i % (b.tx - a.tx + 1));
        const ty = a.ty + Math.floor(i / (b.tx - a.tx + 1));
        tiles.set(`${tx}/${ty}`, await this.imageryTile(z, tx, ty));
      }),
    );
    if (this.drawn.get(key) !== node) return;
    const attr = node.points.geometry.getAttribute('aColor') as BufferAttribute;
    const col = attr.array.length === data.count * 3 ? (attr.array as Uint8Array) : classColors(data);
    let hits = 0;
    for (let i = 0; i < data.count; i++) {
      const p = imageryPixel(data.minX + data.x[i], data.minY + data.y[i], z);
      const px = tiles.get(`${p.tx}/${p.ty}`);
      if (!px) continue;
      const o = (p.py * 256 + p.px) * 4;
      col[i * 3] = px[o];
      col[i * 3 + 1] = px[o + 1];
      col[i * 3 + 2] = px[o + 2];
      hits++;
    }
    if (!hits) return;
    attr.array = col;
    attr.needsUpdate = true;
    node.trueColor = true;
    this.setStatus(this.stats.status);
    this.map?.triggerRepaint();
  }

  /** z = map surface (3D terrain, already exaggerated, or 0) + measured height above ground. */
  private applySurface(node: DrawnNode): boolean {
    const map = this.map;
    if (!map) return false;
    const { data } = node;
    const terrain = map.getTerrain() !== null;
    const g = TERRAIN_GRID;
    const surface = new Float32Array((g + 1) * (g + 1));
    let missing = false;
    if (terrain) {
      for (let j = 0; j <= g; j++) {
        for (let i = 0; i <= g; i++) {
          const [lng, lat] = lngLatFrom3857(data.minX + (i / g) * data.width, data.minY + (j / g) * data.width);
          const e = map.queryTerrainElevation([lng, lat]);
          if (e === null) missing = true;
          surface[j * (g + 1) + i] = e ?? 0;
        }
      }
    }
    const pos = node.points.geometry.getAttribute('position') as BufferAttribute;
    const arr = fullArray<Uint16Array>(pos);
    const xyz = new Float32Array(data.count * 3);
    const k = this.metresPer3857();
    const dx = data.minX - this.originXY[0];
    const dy = data.minY - this.originXY[1];
    for (let p = 0; p < data.count; p++) {
      xyz[p * 3] = (dx + data.x[p]) * k;
      xyz[p * 3 + 1] = (dy + data.y[p]) * k;
      let z = data.hag[p] + SURFACE_LIFT_M;
      if (terrain) {
        const fx = (data.x[p] / data.width) * g;
        const fy = (data.y[p] / data.width) * g;
        const i0 = Math.min(g - 1, Math.floor(fx));
        const j0 = Math.min(g - 1, Math.floor(fy));
        const tx = fx - i0;
        const ty = fy - j0;
        const a = surface[j0 * (g + 1) + i0];
        const b = surface[j0 * (g + 1) + i0 + 1];
        const c = surface[(j0 + 1) * (g + 1) + i0];
        const d = surface[(j0 + 1) * (g + 1) + i0 + 1];
        z += (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      }
      xyz[p * 3 + 2] = z;
    }
    const { offset, scale } = quantizeUint16(xyz, arr);
    const u = (node.points.material as ShaderMaterial).uniforms;
    u.uQOffset.value.set(offset[0], offset[1], offset[2]);
    u.uQScale.value.set(scale[0], scale[1], scale[2]);
    pos.array = arr;
    pos.needsUpdate = true;
    node.terrainStale = missing;
    return true;
  }

  private dropNode(key: string): void {
    const node = this.drawn.get(key);
    if (!node) return;
    this.scene.remove(node.points);
    node.points.geometry.dispose();
    (node.points.material as ShaderMaterial).dispose();
    this.drawn.delete(key);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const renderer = this.renderer;
    const map = this.map;
    if (!renderer || !map || !this.origin || !this.drawn.size || map.getZoom() < GA_LIDAR_MIN_ZOOM) return;
    const s = this.origin.meterInMercatorCoordinateUnits();
    const model = new Matrix4().makeTranslation(this.origin.x, this.origin.y, 0).scale(new Vector3(s, -s, s));
    const data = options.defaultProjectionData;
    const mercatorMatrix = data.projectionTransition > 0 && data.fallbackMatrix ? data.fallbackMatrix : data.mainMatrix;
    const mvp = new Matrix4().fromArray(mercatorMatrix).multiply(model);
    this.camera.projectionMatrix.copy(mvp);
    this.camera.projectionMatrixInverse.copy(mvp).invert();
    this.material.uniforms.uViewport.value.set(gl.drawingBufferWidth, gl.drawingBufferHeight);
    const dpr = Math.min(3, this.map?.getPixelRatio() ?? (window.devicePixelRatio || 1));
    this.material.uniforms.uPointPx.value = POINT_CSS_PX * dpr;
    renderer.resetState();
    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.gpuTimer?.begin();
    if (gpuSafeMode() || !this.edl.render(renderer, gl, this.scene, this.camera, mvp.elements, EDL_RADIUS_CSS_PX * dpr)) renderer.render(this.scene, this.camera);
    this.gpuTimer?.end();
    if (this.gpuTimer) this.stats.gpuMsP95 = this.gpuTimer.poll();
  }
}

/** Classification/height colours for every return (RGB, 3 bytes each). */
function classColors(data: LidarNodeData): Uint8Array {
  const col = new Uint8Array(data.count * 3);
  for (let i = 0; i < data.count; i++) {
    const [r, g, b] = heightRampColor(data.hag[i]);
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  return col;
}

const ATTRIBUTION_SOURCE = 'ga-lidar-attribution';
const VRAM_REPORT_MS = 5_000;
/** MapLibre cannot restore custom layers after WebGL context loss, so they are re-created on restore. */
const restoreHooked = new WeakSet<MapLibreMap>();

/** Adds the street-zoom LiDAR point cloud plus its source credit (shown in the attribution line from z15). */
export function addGaLidarLayers(map: MapLibreMap): void {
  if (!map.getSource(ATTRIBUTION_SOURCE)) {
    map.addSource(ATTRIBUTION_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: `LiDAR: <a href="${GA_LIDAR_SOURCE_URL}" target="_blank" rel="noopener">USGS 3DEP point clouds</a> (GA 2009–2018 surveys, Entwine/AWS Open Data) — returns at measured height above ground, coloured from Esri World Imagery`,
    });
  }
  if (!map.getLayer(ATTRIBUTION_SOURCE)) {
    map.addLayer({ id: ATTRIBUTION_SOURCE, type: 'circle', source: ATTRIBUTION_SOURCE, minzoom: GA_LIDAR_MIN_ZOOM });
  }
  if (!map.getLayer('ga-lidar-3d')) map.addLayer(new GaLidar3DLayer(), GA_ROAD_LAYERS.find((id) => map.getLayer(id)));
  if (!restoreHooked.has(map)) {
    restoreHooked.add(map);
    map.on('webglcontextrestored', () => {
      map.once('style.load', () => {
        if (!map.getLayer('ga-lidar-3d')) map.addLayer(new GaLidar3DLayer(), GA_ROAD_LAYERS.find((id) => map.getLayer(id)));
        raiseGaRoadOverlay(map);
        raiseGaTrafficCountLayers(map);
      });
    });
  }
}
