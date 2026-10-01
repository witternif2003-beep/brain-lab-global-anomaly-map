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
  'Patrol: simulated run on GA roads inside the GA wall (visualization only; roads: U.S. Census TIGER/Line 2024) · figure: Cesium Man © Cesium, CC BY 4.0 (Khronos glTF Sample Assets)';

export const RUN_SPEED_MPS = 3.0;
// Cesium Man's clip is a walk cycle authored for ~1.4 m/s; speed it up so stride matches ground speed.
const ANIMATION_TIME_SCALE = RUN_SPEED_MPS / 1.4;
const OFFROAD_SHARE = 0.1;
const ROAD_STINT_S: [number, number] = [9 * 60, 27 * 60];
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

/**
 * Random wall-to-wall walk confined to the Georgia wall ring. Each leg starts at the current
 * position, picks a random heading, and ends WALL_CLEARANCE_M short of the first wall segment
 * the ray hits, so the walker can never cross the wall line.
 */
export class GaPatrolWalker implements PatrolMover {
  private leg: Leg | null = null;
  private lastTick = 0;

  constructor(private readonly ring: LngLat[]) {}

  get ready(): boolean {
    return this.leg !== null;
  }

  start(now: number): boolean {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of this.ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    for (let i = 0; i < 500; i++) {
      const p: LngLat = [minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY)];
      if (!insideRing(this.ring, p)) continue;
      const leg = this.planLeg(p);
      if (!leg) continue;
      this.leg = leg;
      this.lastTick = now;
      return true;
    }
    return false;
  }

  position(): { lngLat: LngLat; heading: number } | null {
    const leg = this.leg;
    if (!leg) return null;
    const f = leg.length > 0 ? leg.travelled / leg.length : 0;
    return {
      lngLat: [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f],
      heading: leg.heading,
    };
  }

  tick(now: number): void {
    if (!this.leg) return;
    let dist = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S) * RUN_SPEED_MPS;
    this.lastTick = now;
    while (dist > 0 && this.leg) {
      const remaining = this.leg.length - this.leg.travelled;
      if (dist < remaining) {
        this.leg.travelled += dist;
        return;
      }
      dist -= remaining;
      const next = this.planLeg(this.leg.to);
      if (!next) {
        this.leg.travelled = this.leg.length;
        return;
      }
      this.leg = next;
    }
  }

  private planLeg(from: LngLat): Leg | null {
    for (let attempt = 0; attempt < HEADING_TRIES; attempt++) {
      const heading = Math.random() * Math.PI * 2;
      const length = wallDistance(this.ring, from, heading);
      if (length === null || length < MIN_LEG_M) continue;
      return { from, to: offset(from, heading, length), length, heading, travelled: 0 };
    }
    return null;
  }
}

type RoadGraph = { nodes: LngLat[]; adj: number[][] };

/**
 * Runs the Census primary/secondary road graph (already clipped inside the wall), turning at random
 * at each junction. After every road stint it makes an off-road out-and-back excursion lasting
 * OFFROAD_SHARE of the total, so ~90% of the time is on roads. Excursion legs are capped by
 * wallDistance, so they cannot reach the wall either.
 */
export class GaRoadPatrol implements PatrolMover {
  private queue: Leg[] = [];
  private leg: Leg | null = null;
  private node = 0;
  private prevNode = -1;
  private roadS = 0;
  private stintS = 0;
  private lastTick = 0;
  readonly totals = { roadS: 0, offroadS: 0 };

  constructor(
    private readonly graph: RoadGraph,
    private readonly ring: LngLat[],
  ) {}

  start(now: number): boolean {
    const n = this.graph.nodes.length;
    for (let i = 0; i < 200; i++) {
      const k = Math.floor(Math.random() * n);
      if (this.graph.adj[k].length === 0) continue;
      this.node = k;
      this.stintS = this.randomStint();
      this.lastTick = now;
      this.leg = this.nextRoadLeg();
      return this.leg !== null;
    }
    return false;
  }

  position(): { lngLat: LngLat; heading: number } | null {
    const leg = this.leg;
    if (!leg) return null;
    const f = leg.length > 0 ? leg.travelled / leg.length : 0;
    return {
      lngLat: [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f],
      heading: leg.heading,
    };
  }

  get onRoad(): boolean {
    return this.leg?.road === true;
  }

  tick(now: number): void {
    if (!this.leg) return;
    let dist = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S) * RUN_SPEED_MPS;
    this.lastTick = now;
    while (dist > 0 && this.leg) {
      const onRoad = this.leg.road === true;
      const step = Math.min(dist, this.leg.length - this.leg.travelled);
      this.leg.travelled += step;
      dist -= step;
      const s = step / RUN_SPEED_MPS;
      if (onRoad) {
        this.roadS += s;
        this.totals.roadS += s;
      } else this.totals.offroadS += s;
      if (this.leg.travelled < this.leg.length) return;
      this.leg = this.advance();
    }
  }

  private advance(): Leg | null {
    const queued = this.queue.shift();
    if (queued) return queued;
    if (this.roadS >= this.stintS) {
      const excursion = this.planExcursion((this.roadS * OFFROAD_SHARE) / (1 - OFFROAD_SHARE));
      this.roadS = 0;
      this.stintS = this.randomStint();
      if (excursion) {
        this.queue = [excursion[1]];
        return excursion[0];
      }
    }
    return this.nextRoadLeg();
  }

  private planExcursion(seconds: number): [Leg, Leg] | null {
    const base = this.graph.nodes[this.node];
    const want = (seconds * RUN_SPEED_MPS) / 2;
    for (let attempt = 0; attempt < HEADING_TRIES; attempt++) {
      const heading = Math.random() * Math.PI * 2;
      const room = wallDistance(this.ring, base, heading);
      if (room === null || room < want) continue;
      const out = offset(base, heading, want);
      const back = heading + Math.PI;
      return [
        { from: base, to: out, length: want, heading, travelled: 0 },
        { from: out, to: base, length: want, heading: back, travelled: 0 },
      ];
    }
    return null;
  }

  private nextRoadLeg(): Leg | null {
    const { nodes, adj } = this.graph;
    const options = adj[this.node].filter((m) => m !== this.prevNode);
    const choices = options.length ? options : adj[this.node];
    if (!choices.length) return null;
    const next = choices[Math.floor(Math.random() * choices.length)];
    const from = nodes[this.node];
    const to = nodes[next];
    const { dist, heading } = vector(from, to);
    this.prevNode = this.node;
    this.node = next;
    return { from, to, length: dist, heading, travelled: 0, road: true };
  }

  private randomStint(): number {
    return ROAD_STINT_S[0] + Math.random() * (ROAD_STINT_S[1] - ROAD_STINT_S[0]);
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
  return { nodes, adj };
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

const patrols = new WeakMap<MapLibreMap, PatrolMover>();

/** Current patrol position on this map, if its patrol layer has started. */
export function getGaPatrolPosition(map: MapLibreMap): LngLat | null {
  return patrols.get(map)?.position()?.lngLat ?? null;
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
 * Human-scale animated walker (three.js) driven by GaPatrolWalker. Also feeds the GA_PATROL_SOURCE
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
  private walker: PatrolMover | null = null;
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
        let walker: PatrolMover;
        try {
          walker = new GaRoadPatrol(await loadGaRoadGraph(), ring);
        } catch (err) {
          console.warn('[GaPatrol3D] road graph load failed, falling back to off-road patrol:', err);
          walker = new GaPatrolWalker(ring);
        }
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
