import {
  BufferGeometry,
  Camera,
  Float32BufferAttribute,
  Matrix4,
  Points,
  Scene,
  ShaderMaterial,
  Uint8BufferAttribute,
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
  lidarColor,
  lngLatFrom3857,
  lngLatTo3857,
  pickProject,
  planNodes,
  targetDepthFor,
} from './ga-lidar/ept';
import type { EptProject, Hierarchy, LidarNodeData } from './ga-lidar/ept';

export const GA_LIDAR_MIN_ZOOM = 15;
const VIEW_TILES = 3.5;
const POINT_BUDGET_TOUCH = 2_500_000;
const POINT_BUDGET_DESKTOP = 5_000_000;
const IMAGERY_CACHE_TILES = 96;
const FETCH_PARALLEL = 6;
const TERRAIN_GRID = 8;
const SURFACE_LIFT_M = 0.25;
const ORIGIN_RESET_M = 15_000;
const WORLD_3857 = 2 * Math.PI * 6378137;

export interface GaLidarStats {
  project: string | null;
  year: number | null;
  targetDepth: number;
  nodesPlanned: number;
  nodesDrawn: number;
  pointsDrawn: number;
  /** Nodes whose points carry true colour sampled from the imagery under them. */
  nodesTrueColor: number;
  loading: number;
  errors: number;
  status: string;
}

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  uniform float uSpacing;
  uniform vec2 uViewport;
  uniform float uMaxPx;
  varying vec3 vColor;
  void main() {
    mat4 mvp = projectionMatrix * modelViewMatrix;
    vec4 p0 = mvp * vec4(position, 1.0);
    vec4 px = mvp * vec4(position + vec3(uSpacing, 0.0, 0.0), 1.0);
    vec4 py = mvp * vec4(position + vec3(0.0, uSpacing, 0.0), 1.0);
    vec2 s0 = p0.xy / p0.w;
    float size = max(length((px.xy / px.w - s0) * uViewport), length((py.xy / py.w - s0) * uViewport)) * 0.5;
    gl_PointSize = clamp(size * 1.4, 1.5, uMaxPx);
    gl_Position = p0;
    vColor = aColor;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = dot(c, c);
    if (r > 1.0) discard;
    float dome = sqrt(1.0 - r);
    gl_FragColor = vec4(vColor * (0.5 + 0.5 * dome), 1.0);
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
      uViewport: { value: new Vector2(1, 1) },
      uMaxPx: { value: 10 },
    },
  });
  private origin: MercatorCoordinate | null = null;
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
    project: null,
    year: null,
    targetDepth: 0,
    nodesPlanned: 0,
    nodesDrawn: 0,
    pointsDrawn: 0,
    nodesTrueColor: 0,
    loading: 0,
    errors: 0,
    status: 'idle',
  };
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

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    map.on('moveend', this.onMoveEnd);
    map.on('idle', this.onIdle);
    if (typeof window !== 'undefined') {
      (window as unknown as { __gaLidar?: GaLidarStats }).__gaLidar = this.stats;
    }
    void this.update();
  }

  onRemove(map: MapLibreMap): void {
    map.off('moveend', this.onMoveEnd);
    map.off('idle', this.onIdle);
    if (this.timer) clearTimeout(this.timer);
    this.generation++;
    for (const key of [...this.drawn.keys()]) this.dropNode(key);
    this.material.dispose();
    this.setOsmBuildings(true);
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

  /** OSM extruded footprints would hide the measured roofs, so they step aside while LiDAR is drawn. */
  private setOsmBuildings(visible: boolean): void {
    const map = this.map;
    if (!map?.getLayer('buildings-3d')) return;
    const want = visible ? 'visible' : 'none';
    if (map.getLayoutProperty('buildings-3d', 'visibility') !== want) map.setLayoutProperty('buildings-3d', 'visibility', want);
  }

  private async hierarchy(project: EptProject, file: string): Promise<void> {
    const id = `${project.name}/${file}`;
    if (this.loadedHierarchyFiles.has(id)) return;
    this.loadedHierarchyFiles.add(id);
    try {
      const r = await fetch(`${EPT_ROOT}/${project.name}/ept-hierarchy/${file}.json`);
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
    if (!project) {
      for (const key of [...this.drawn.keys()]) this.dropNode(key);
      this.setOsmBuildings(true);
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
    const targetDepth = targetDepthFor(project, half);
    const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    const view = { cx, cy, half, targetDepth, pointBudget: touch ? POINT_BUDGET_TOUCH : POINT_BUDGET_DESKTOP };
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
    const nodeWidth = cube / 2 ** targetDepth;
    this.material.uniforms.uSpacing.value = (nodeWidth / project.span) * this.metresPer3857();
    const wanted = new Set(plan.nodes.map((n) => n.key));
    for (const key of [...this.drawn.keys()]) if (!wanted.has(key)) this.dropNode(key);
    this.stats.nodesPlanned = plan.nodes.length;
    const queue = plan.nodes.filter((n) => !this.drawn.has(n.key) && !this.inflight.has(n.key));
    this.setStatus(queue.length ? 'loading points' : 'ready');
    this.setOsmBuildings(false);
    map.triggerRepaint();

    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        if (gen !== this.generation) return;
        const key = next.key;
        this.inflight.add(key);
        this.setStatus('loading points');
        try {
          const r = await fetch(`/api/ga-lidar?project=${encodeURIComponent(project.name)}&node=${key}`);
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
    await Promise.all(Array.from({ length: FETCH_PARALLEL }, worker));
    if (gen === this.generation) this.setStatus('ready');
  }

  /** Real-world metres per EPSG:3857 metre at the layer origin. */
  private metresPer3857(): number {
    const s = this.origin?.meterInMercatorCoordinateUnits() ?? 1;
    return 1 / (WORLD_3857 * s);
  }

  private addNode(key: string, data: LidarNodeData): void {
    const n = data.count;
    const k = this.metresPer3857();
    const pos = new Float32Array(n * 3);
    const col = new Uint8Array(n * 3);
    const dx = data.minX - this.originXY[0];
    const dy = data.minY - this.originXY[1];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (dx + data.x[i]) * k;
      pos[i * 3 + 1] = (dy + data.y[i]) * k;
      const [r, g, b] = lidarColor(data.cls[i], data.hag[i], data.intensity[i]);
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geometry.setAttribute('aColor', new Uint8BufferAttribute(col, 3, true));
    const points = new Points(geometry, this.material);
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
    if (this.imagery.size > IMAGERY_CACHE_TILES) this.imagery.delete(this.imagery.keys().next().value as string);
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
    const attr = node.points.geometry.getAttribute('aColor');
    const col = attr.array as Uint8Array;
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
    const pos = node.points.geometry.getAttribute('position');
    const arr = pos.array as Float32Array;
    for (let p = 0; p < data.count; p++) {
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
      arr[p * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    node.terrainStale = missing;
    return true;
  }

  private dropNode(key: string): void {
    const node = this.drawn.get(key);
    if (!node) return;
    this.scene.remove(node.points);
    node.points.geometry.dispose();
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
    this.material.uniforms.uMaxPx.value = 10 * Math.min(3, window.devicePixelRatio || 1);
    renderer.resetState();
    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.render(this.scene, this.camera);
  }
}

const ATTRIBUTION_SOURCE = 'ga-lidar-attribution';

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
  if (!map.getLayer('ga-lidar-3d')) map.addLayer(new GaLidar3DLayer());
}
