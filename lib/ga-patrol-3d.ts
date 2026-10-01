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
export const GA_PATROL_SOURCE = 'ga-patrol';
export const GA_PATROL_ATTRIBUTION =
  'Patrol: simulated random walk inside the GA wall (visualization only) · figure: Cesium Man © Cesium, CC BY 4.0 (Khronos glTF Sample Assets)';

const WALK_SPEED_MPS = 1.4;
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

type LngLat = [number, number];
type Leg = { from: LngLat; to: LngLat; length: number; heading: number; travelled: number };

function mPerDegLon(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function insideRing(ring: LngLat[], p: LngLat): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Random wall-to-wall walk confined to the Georgia wall ring. Each leg starts at the current
 * position, picks a random heading, and ends WALL_CLEARANCE_M short of the first wall segment
 * the ray hits, so the walker can never cross the wall line.
 */
export class GaPatrolWalker {
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
    let dist = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S) * WALK_SPEED_MPS;
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
    const kx = mPerDegLon(from[1]);
    const ky = M_PER_DEG_LAT;
    const ring = this.ring;
    for (let attempt = 0; attempt < HEADING_TRIES; attempt++) {
      const heading = Math.random() * Math.PI * 2;
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
      if (!Number.isFinite(bestT)) continue;
      const length = bestT - WALL_CLEARANCE_M / Math.max(bestSin, 0.2);
      if (length < MIN_LEG_M) continue;
      const to: LngLat = [from[0] + (dx * length) / kx, from[1] + (dy * length) / ky];
      return { from, to, length, heading, travelled: 0 };
    }
    return null;
  }
}

export async function loadGaWallRing(): Promise<LngLat[]> {
  const fc: { features: Array<{ properties: { part: string }; geometry: { coordinates: LngLat[] } }> } = await fetch(
    WALL_URL,
  ).then((r) => r.json());
  const path = fc.features.find((f) => f.properties.part === 'path');
  return path ? path.geometry.coordinates : [];
}

function markerData(walker: GaPatrolWalker | null): GeoJSON.FeatureCollection {
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
  private walker: GaPatrolWalker | null = null;
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
          this.mixer.clipAction(gltf.animations[0]).play();
        }
        map.triggerRepaint();
      },
      undefined,
      (err) => console.warn('[GaPatrol3D] model load failed:', err),
    );

    loadGaWallRing()
      .then((ring) => {
        if (this.disposed || ring.length < 4) return;
        const walker = new GaPatrolWalker(ring);
        if (!walker.start(performance.now())) return;
        this.walker = walker;
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
