import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  Camera,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

const MODEL_URL = '/models/patrol/cesium-man.glb';
const WALL_URL = '/geo/ga-wall.geojson';
const ROADS_URL = '/geo/ga-roads.json';
export const GA_PATROL_SOURCE = 'ga-patrol';
export const GA_PATROL_ATTRIBUTION =
  'Patrol: simulated chase of the abstract markers inside the GA wall at 2x walking speed (visualization only; roads: U.S. Census TIGER/Line 2024) · figure: Cesium Man © Cesium, CC BY 4.0 (Khronos glTF Sample Assets)';

export const WALK_SPEED_MPS = 1.4;
export const CHASE_SPEED_MPS = 2 * WALK_SPEED_MPS;
// Cesium Man's clip is a walk cycle authored for ~1.4 m/s; speed it up so stride matches ground speed.
const ANIMATION_TIME_SCALE = CHASE_SPEED_MPS / 1.4;
const CATCH_RADIUS_M = 10;
// Beyond this the patrol prefers roads (greedy: each junction step must get closer to the target).
const ROAD_CHASE_MIN_M = 2000;
const JOIN_RADIUS_M = 1000;
const JOIN_CHECK_S = 60;
// Each new target is picked at random among the nearest CHASE_POOL markers.
const CHASE_POOL = 3;
const SUBSTEP_S = 2;
const GRID_DEG = 0.02;
const FIGURE_HEIGHT_M = 1.75;
// Wall half-thickness (0.15 m) + concertina base coil (1.38 m offset + 0.38 m radius) + body clearance.
const WALL_CLEARANCE_M = 2.5;
const MIN_LEG_M = 25;
const HEADING_TRIES = 64;
const M_PER_DEG_LAT = 111_320;
const MARKER_INTERVAL_MS = 500;
const MAX_CATCHUP_S = 3600;
export const GA_PATROL_3D_MIN_ZOOM = 15;
const MODEL_FORWARD_OFFSET = Math.PI / 2;

export type LngLat = [number, number];
type Leg = { from: LngLat; to: LngLat; length: number; heading: number; travelled: number; road?: boolean };

export interface PatrolMover {
  start(now: number): boolean;
  position(): { lngLat: LngLat; heading: number } | null;
  tick(now: number): void;
}

function mPerDegLon(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function insideRing(ring: LngLat[], p: LngLat): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Distance in metres from `from` along `heading` (radians, 0 = east, CCW) that stays WALL_CLEARANCE_M
 * short of the first wall segment the ray hits; null when the ray hits nothing (point outside the ring).
 */
export function wallDistance(ring: LngLat[], from: LngLat, heading: number): number | null {
  const kx = mPerDegLon(from[1]);
  const ky = M_PER_DEG_LAT;
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  let bestT = Infinity;
  let bestSin = 1;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - from[0]) * kx;
    const ay = (ring[i][1] - from[1]) * ky;
    const ex = (ring[i + 1][0] - ring[i][0]) * kx;
    const ey = (ring[i + 1][1] - ring[i][1]) * ky;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const t = (ax * ey - ay * ex) / denom;
    const u = (ax * dy - ay * dx) / denom;
    if (t <= 0 || u < 0 || u > 1 || t >= bestT) continue;
    bestT = t;
    bestSin = Math.abs(denom) / Math.hypot(ex, ey);
  }
  if (!Number.isFinite(bestT)) return null;
  return Math.max(0, bestT - WALL_CLEARANCE_M / Math.max(bestSin, 0.2));
}

/** Point `dist` metres from `from` along `heading` (local equirectangular step). */
export function offset(from: LngLat, heading: number, dist: number): LngLat {
  return [from[0] + (Math.cos(heading) * dist) / mPerDegLon(from[1]), from[1] + (Math.sin(heading) * dist) / M_PER_DEG_LAT];
}

/** Metres between two points and the heading from a to b. */
export function vector(a: LngLat, b: LngLat): { dist: number; heading: number } {
  const x = (b[0] - a[0]) * mPerDegLon((a[1] + b[1]) / 2);
  const y = (b[1] - a[1]) * M_PER_DEG_LAT;
  return { dist: Math.hypot(x, y), heading: Math.atan2(y, x) };
}

type RoadGraph = { nodes: LngLat[]; adj: number[][]; grid: Map<string, number[]> };

/** Markers the patrol can chase on a map; `caught` must move marker `i` elsewhere. */
export interface GaPatrolQuarry {
  positions(): LngLat[];
  caught(i: number, patrol: LngLat): void;
}

const quarries = new WeakMap<MapLibreMap, GaPatrolQuarry>();

export function setGaPatrolQuarry(map: MapLibreMap, quarry: GaPatrolQuarry): void {
  quarries.set(map, quarry);
}

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / GRID_DEG)},${Math.floor(y / GRID_DEG)}`;
}

/** Random point strictly inside the ring, optionally at least `minFrom.dist` metres from `minFrom.p`. */
export function randomInteriorPoint(ring: LngLat[], minFrom?: { p: LngLat; dist: number }): LngLat | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  for (let i = 0; i < 1000; i++) {
    const p: LngLat = [minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY)];
    if (!insideRing(ring, p)) continue;
    if (minFrom && vector(minFrom.p, p).dist < minFrom.dist) continue;
    return p;
  }
  return null;
}

/**
 * Chases the registered quarry at CHASE_SPEED_MPS: picks a random marker among the nearest
 * CHASE_POOL, follows the Census road graph greedily while it is farther than ROAD_CHASE_MIN_M,
 * then runs straight at it (sliding along the wall when blocked). Within CATCH_RADIUS_M the marker
 * is reported caught and a new target is picked. Every off-road step is capped by wallDistance and
 * road nodes are pre-clipped inside the wall, so the patrol cannot cross the wall.
 */
export class GaChasePatrol implements PatrolMover {
  private pos: LngLat = [0, 0];
  private heading = 0;
  private started = false;
  private lastTick = 0;
  private leg: Leg | null = null;
  private legNode = -1;
  private atNode = -1;
  private prevNode = -1;
  private target: number | null = null;
  private sinceJoinCheck = Infinity;
  catches = 0;

  constructor(
    private readonly ring: LngLat[],
    private readonly quarry: () => GaPatrolQuarry | undefined,
    private readonly graph: RoadGraph | null,
  ) {}

  get targetIndex(): number | null {
    return this.target;
  }

  start(now: number): boolean {
    const g = this.graph;
    if (g) {
      for (let i = 0; i < 200 && !this.started; i++) {
        const k = Math.floor(Math.random() * g.nodes.length);
        if (!g.adj[k].length) continue;
        this.pos = g.nodes[k];
        this.atNode = k;
        this.started = true;
      }
    }
    if (!this.started) {
      const p = randomInteriorPoint(this.ring);
      if (!p) return false;
      this.pos = p;
      this.started = true;
    }
    this.lastTick = now;
    return true;
  }

  position(): { lngLat: LngLat; heading: number } | null {
    return this.started ? { lngLat: this.pos, heading: this.heading } : null;
  }

  tick(now: number): void {
    if (!this.started) return;
    let left = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S);
    this.lastTick = now;
    while (left > 0) {
      const dt = Math.min(left, SUBSTEP_S);
      left -= dt;
      this.sinceJoinCheck += dt;
      this.step(dt * CHASE_SPEED_MPS);
    }
  }

  private step(dist: number): void {
    const q = this.quarry();
    const pts = q?.positions() ?? [];
    if (!q || !pts.length) {
      this.wander(dist);
      return;
    }
    if (this.target === null || !pts[this.target]) this.target = this.pickTarget(pts);
    const t = pts[this.target];
    const d = vector(this.pos, t).dist;
    if (d <= CATCH_RADIUS_M) {
      q.caught(this.target, this.pos);
      this.catches++;
      this.target = null;
      return;
    }
    if (this.leg && !this.leg.road && this.legNode < 0) this.leg = null;
    if (this.leg?.road && d <= ROAD_CHASE_MIN_M) {
      this.leg = null;
      this.atNode = -1;
    }
    if (!this.leg && this.graph && d > ROAD_CHASE_MIN_M) this.planRoad(t, d);
    if (this.leg) {
      this.advance(dist);
      return;
    }
    this.atNode = -1;
    this.pursue(dist, t, d);
  }

  private advance(dist: number): void {
    const leg = this.leg;
    if (!leg) return;
    leg.travelled = Math.min(leg.length, leg.travelled + dist);
    const f = leg.length > 0 ? leg.travelled / leg.length : 1;
    this.pos = [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f];
    this.heading = leg.heading;
    if (leg.travelled < leg.length) return;
    this.atNode = this.legNode;
    this.leg = null;
  }

  private planRoad(t: LngLat, d: number): void {
    const g = this.graph;
    if (!g) return;
    if (this.atNode >= 0) {
      const here = this.atNode;
      let best = -1;
      let bestD = vector(g.nodes[here], t).dist - 1;
      for (const m of g.adj[here]) {
        if (m === this.prevNode) continue;
        const dm = vector(g.nodes[m], t).dist;
        if (dm < bestD) {
          bestD = dm;
          best = m;
        }
      }
      if (best < 0) return;
      const { dist, heading } = vector(g.nodes[here], g.nodes[best]);
      this.leg = { from: g.nodes[here], to: g.nodes[best], length: dist, heading, travelled: 0, road: true };
      this.legNode = best;
      this.prevNode = here;
      return;
    }
    if (this.sinceJoinCheck < JOIN_CHECK_S) return;
    this.sinceJoinCheck = 0;
    const n = this.joinNode(t, d);
    if (n < 0) return;
    const { dist, heading } = vector(this.pos, g.nodes[n]);
    this.leg = { from: this.pos, to: g.nodes[n], length: dist, heading, travelled: 0 };
    this.legNode = n;
    this.prevNode = -1;
  }

  /** Nearby connected road node that is closer to the target, reachable in a straight line. */
  private joinNode(t: LngLat, d: number): number {
    const g = this.graph;
    if (!g) return -1;
    const [x, y] = this.pos;
    const rx = Math.ceil(JOIN_RADIUS_M / (GRID_DEG * mPerDegLon(y)));
    const ry = Math.ceil(JOIN_RADIUS_M / (GRID_DEG * M_PER_DEG_LAT));
    const cx = Math.floor(x / GRID_DEG);
    const cy = Math.floor(y / GRID_DEG);
    let best = -1;
    let bestScore = Infinity;
    for (let i = cx - rx; i <= cx + rx; i++) {
      for (let j = cy - ry; j <= cy + ry; j++) {
        for (const n of g.grid.get(`${i},${j}`) ?? []) {
          if (!g.adj[n].length) continue;
          const v = vector(this.pos, g.nodes[n]).dist;
          if (v > JOIN_RADIUS_M) continue;
          const dn = vector(g.nodes[n], t).dist;
          if (dn >= d) continue;
          if (v + dn < bestScore) {
            bestScore = v + dn;
            best = n;
          }
        }
      }
    }
    if (best < 0) return -1;
    const v = vector(this.pos, g.nodes[best]);
    const room = wallDistance(this.ring, this.pos, v.heading);
    return room !== null && room >= v.dist ? best : -1;
  }

  /** Straight at the target; when the wall blocks, fan out up to ±165° to slide along it. */
  private pursue(dist: number, t: LngLat, d: number): void {
    const want = vector(this.pos, t).heading;
    for (let k = 0; k <= 11; k++) {
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const heading = want + sign * k * (Math.PI / 12);
        const room = wallDistance(this.ring, this.pos, heading);
        if (room === null || room < 0.5) continue;
        this.pos = offset(this.pos, heading, Math.min(dist, d, room));
        this.heading = heading;
        return;
      }
    }
  }

  private wander(dist: number): void {
    if (!this.leg) {
      for (let attempt = 0; attempt < HEADING_TRIES && !this.leg; attempt++) {
        const heading = Math.random() * Math.PI * 2;
        const length = wallDistance(this.ring, this.pos, heading);
        if (length === null || length < MIN_LEG_M) continue;
        this.leg = { from: this.pos, to: offset(this.pos, heading, length), length, heading, travelled: 0 };
        this.legNode = -1;
      }
    }
    this.advance(dist);
    this.atNode = -1;
  }

  private pickTarget(pts: LngLat[]): number {
    const ranked = pts.map((p, i) => ({ i, d: vector(this.pos, p).dist })).sort((a, b) => a.d - b.d);
    const pool = ranked.slice(0, CHASE_POOL);
    return pool[Math.floor(Math.random() * pool.length)].i;
  }
}

export async function loadGaRoadGraph(): Promise<RoadGraph> {
  const raw: { nodes: number[]; edges: number[] } = await fetch(ROADS_URL).then((r) => r.json());
  const nodes: LngLat[] = [];
  for (let i = 0; i < raw.nodes.length; i += 2) nodes.push([raw.nodes[i], raw.nodes[i + 1]]);
  const adj: number[][] = nodes.map(() => []);
  for (let i = 0; i < raw.edges.length; i += 2) {
    adj[raw.edges[i]].push(raw.edges[i + 1]);
    adj[raw.edges[i + 1]].push(raw.edges[i]);
  }
  const grid = new Map<string, number[]>();
  nodes.forEach(([x, y], i) => {
    const key = cellKey(x, y);
    const cell = grid.get(key);
    if (cell) cell.push(i);
    else grid.set(key, [i]);
  });
  return { nodes, adj, grid };
}

let ringPromise: Promise<LngLat[]> | null = null;

export function loadGaWallRing(): Promise<LngLat[]> {
  ringPromise ??= fetch(WALL_URL)
    .then((r) => r.json())
    .then((fc: { features: Array<{ properties: { part: string }; geometry: { coordinates: LngLat[] } }> }) => {
      const path = fc.features.find((f) => f.properties.part === 'path');
      return path ? path.geometry.coordinates : [];
    })
    .catch((err) => {
      ringPromise = null;
      throw err;
    });
  return ringPromise;
}

const patrols = new WeakMap<MapLibreMap, GaChasePatrol>();

/** Current patrol position on this map, if its patrol layer has started. */
export function getGaPatrolPosition(map: MapLibreMap): LngLat | null {
  return patrols.get(map)?.position()?.lngLat ?? null;
}

/** Index (into the registered quarry) of the marker the patrol is currently chasing. */
export function getGaPatrolTarget(map: MapLibreMap): number | null {
  return patrols.get(map)?.targetIndex ?? null;
}

function markerData(walker: PatrolMover | null): GeoJSON.FeatureCollection {
  const pos = walker?.position();
  return {
    type: 'FeatureCollection',
    features: pos
      ? [{ type: 'Feature', properties: { label: 'PATROL' }, geometry: { type: 'Point', coordinates: pos.lngLat } }]
      : [],
  };
}

/**
 * Human-scale animated walker (three.js) driven by GaChasePatrol. Also feeds the GA_PATROL_SOURCE
 * point source so the patrol stays findable at zooms where a 1.75 m figure is sub-pixel.
 */
export class GaPatrol3DLayer implements CustomLayerInterface {
  readonly id = 'ga-patrol-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly figure = new Group();
  private mixer: AnimationMixer | null = null;
  private walker: GaChasePatrol | null = null;
  private lastFrame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    this.scene.add(new HemisphereLight(0xdde9ff, 0x4b3f2f, 1.1));
    const sun = new DirectionalLight(0xfff3df, 1.8);
    sun.position.set(-0.45, -0.8, 1.25);
    this.scene.add(sun);
    this.scene.add(this.figure);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        const root = gltf.scene;
        root.rotation.x = Math.PI / 2;
        root.updateMatrixWorld(true);
        const box = new Box3().setFromObject(root);
        const h = box.max.z - box.min.z || 1;
        const k = FIGURE_HEIGHT_M / h;
        root.scale.setScalar(k);
        root.position.z = -box.min.z * k;
        root.traverse((o) => {
          if (o instanceof Mesh) o.frustumCulled = false;
        });
        this.figure.add(root);
        if (gltf.animations.length) {
          this.mixer = new AnimationMixer(root);
          this.mixer.timeScale = ANIMATION_TIME_SCALE;
          this.mixer.clipAction(gltf.animations[0]).play();
        }
        map.triggerRepaint();
      },
      undefined,
      (err) => console.warn('[GaPatrol3D] model load failed:', err),
    );

    loadGaWallRing()
      .then(async (ring) => {
        if (this.disposed || ring.length < 4) return;
        let graph: RoadGraph | null = null;
        try {
          graph = await loadGaRoadGraph();
        } catch (err) {
          console.warn('[GaPatrol3D] road graph load failed, chasing off-road only:', err);
        }
        const walker = new GaChasePatrol(ring, () => quarries.get(map), graph);
        if (this.disposed || !walker.start(performance.now())) return;
        this.walker = walker;
        patrols.set(map, walker);
        this.pushMarker();
        map.triggerRepaint();
      })
      .catch((err) => console.warn('[GaPatrol3D] wall path load failed:', err));

    this.timer = setInterval(() => {
      this.walker?.tick(performance.now());
      this.pushMarker();
    }, MARKER_INTERVAL_MS);
  }

  onRemove(): void {
    this.disposed = true;
    if (this.map) patrols.delete(this.map);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.mixer?.stopAllAction();
    this.figure.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.scene.clear();
    this.map = null;
  }

  private pushMarker(): void {
    const src = this.map?.getSource(GA_PATROL_SOURCE) as GeoJSONSource | undefined;
    src?.setData(markerData(this.walker));
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const renderer = this.renderer;
    const map = this.map;
    const walker = this.walker;
    if (!renderer || !map || !walker || !this.figure.children.length) return;
    if (map.getZoom() < GA_PATROL_3D_MIN_ZOOM) return;

    const now = performance.now();
    walker.tick(now);
    const pos = walker.position();
    if (!pos) return;
    if (this.mixer) this.mixer.update(this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 0);
    this.lastFrame = now;

    const elevation = map.getTerrain() ? (map.queryTerrainElevation(pos.lngLat) ?? 0) : 0;
    const origin = MercatorCoordinate.fromLngLat(pos.lngLat, elevation);
    const s = origin.meterInMercatorCoordinateUnits();
    this.figure.rotation.z = pos.heading + MODEL_FORWARD_OFFSET;
    this.figure.updateMatrixWorld(true);

    const model = new Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new Vector3(s, -s, s));
    const data = options.defaultProjectionData;
    const mercatorMatrix = data.projectionTransition > 0 && data.fallbackMatrix ? data.fallbackMatrix : data.mainMatrix;
    const mvp = new Matrix4().fromArray(mercatorMatrix).multiply(model);
    this.camera.projectionMatrix.copy(mvp);
    this.camera.projectionMatrixInverse.copy(mvp).invert();

    renderer.resetState();
    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.render(this.scene, this.camera);
    map.triggerRepaint();
  }
}

const clickBound = new WeakSet<MapLibreMap>();

/** Adds the patrol point source, its locator layers, and the 3D walker layer (idempotent). */
export function addGaPatrolLayers(map: MapLibreMap): void {
  if (!map.getSource(GA_PATROL_SOURCE)) {
    map.addSource(GA_PATROL_SOURCE, {
      type: 'geojson',
      data: markerData(null),
      attribution: GA_PATROL_ATTRIBUTION,
    });
  }
  if (!map.getLayer('ga-patrol-dot')) {
    map.addLayer({
      id: 'ga-patrol-dot',
      type: 'circle',
      source: GA_PATROL_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 12, 6, 17, 8, 18, 0],
        'circle-color': '#facc15',
        'circle-stroke-color': '#111827',
        'circle-stroke-width': 2,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 16, 1, 18, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 16, 1, 18, 0],
      },
    });
  }
  if (!map.getLayer('ga-patrol-3d')) map.addLayer(new GaPatrol3DLayer());
  if (!clickBound.has(map)) {
    clickBound.add(map);
    map.on('click', 'ga-patrol-dot', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      map.flyTo({ center: f.geometry.coordinates as LngLat, zoom: 19.5, pitch: Math.min(65, map.getMaxPitch()), speed: 1.6 });
    });
    map.on('mouseenter', 'ga-patrol-dot', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'ga-patrol-dot', () => {
      map.getCanvas().style.cursor = '';
    });
  }
}
