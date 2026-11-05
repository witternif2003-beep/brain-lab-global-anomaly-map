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
  type AnimationClip,
  type Object3D,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MercatorCoordinate, Popup } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { buildRunners, runnerDistance, RUN_SPEED_MPS, type BorderRunner, type BorderState, type LngLat } from './us-border-paths';

const MODEL_URL = '/models/patrol/cesium-man.glb';
const BORDERS_URL = '/geo/us-50-state-borders.json';
export const US_BORDER_RUNNERS_SOURCE_URL = 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip';
export const US_BORDER_RUNNERS_SOURCE = 'us-border-runners';
export const US_BORDER_RUNNERS_ATTRIBUTION =
  'Border runners: one figure per state on its U.S. Census 2024 cartographic boundary (cb_2024_us_state_500k), 12 km/h, see-through, Georgia excluded (visualization only) · figure: Cesium Man © Cesium, CC BY 4.0 (Khronos glTF Sample Assets)';

// Cesium Man's clip is a walk cycle authored for ~1.4 m/s.
const ANIMATION_TIME_SCALE = RUN_SPEED_MPS / 1.4;
const FIGURE_HEIGHT_M = 1.75;
const MODEL_FORWARD_OFFSET = Math.PI / 2;
const GOLDEN_SEED = 0.6180339887498949;
const MARKER_INTERVAL_MS = 1000;
export const RUNNER_OPACITY = 0.45;
// Tiffany blue tint multiplied over the figure's own texture.
export const RUNNER_TINT = 0x81d8d0;
// Georgia already has its own patrol figure.
export const RUNNER_EXCLUDED_STATES = ['GA'];
export const US_BORDER_RUNNERS_3D_MIN_ZOOM = 15;

let runnersPromise: Promise<BorderRunner[]> | null = null;

function loadRunners(): Promise<BorderRunner[]> {
  runnersPromise ??= fetch(BORDERS_URL)
    .then((r) => r.json())
    .then((j: { states: BorderState[] }) => buildRunners(j.states))
    .catch((err) => {
      runnersPromise = null;
      throw err;
    });
  return runnersPromise;
}

const layerRunners = new WeakMap<MapLibreMap, BorderRunner[]>();

/** Current runner positions on this map (empty until the borders have loaded). */
export function getUsBorderRunnerPositions(map: MapLibreMap, epochMs = Date.now()): Array<{ st: string; lngLat: LngLat }> {
  return (layerRunners.get(map) ?? []).map((r) => ({ st: r.st, lngLat: r.path.at(runnerDistance(r.path, r.fips, epochMs)).lngLat }));
}

function markerData(runners: BorderRunner[], epochMs: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: runners.map((r) => ({
      type: 'Feature',
      properties: { st: r.st, name: r.name, t: epochMs },
      geometry: { type: 'Point', coordinates: r.path.at(runnerDistance(r.path, r.fips, epochMs)).lngLat },
    })),
  };
}

type RunnerAnimate = (dt: number, moving: boolean, speedScale?: number) => void;

interface RunnerFigure {
  wrapper: Group;
  stride: Group;
  mixer: AnimationMixer | null;
}

/**
 * Independent skinned clone per state with its own mixer and a private stride closure.
 * `stride` is in the glTF's native Y-up frame; `upright` turns it into the map's Z-up frame.
 */
function createRunnerFigure(base: Object3D, clip: AnimationClip | undefined, seed: number): RunnerFigure {
  const wrapper = new Group();
  const upright = new Group();
  upright.rotation.x = Math.PI / 2;
  const stride = new Group();
  stride.add(cloneSkinned(base));
  upright.add(stride);
  wrapper.add(upright);
  let phase = 0;
  const animate: RunnerAnimate = (dt, moving, speedScale = 1) => {
    if (moving) {
      const cadence = Math.max(1.2, Math.min(3.4, speedScale * 2.2));
      phase += dt * cadence * Math.PI;
      stride.position.y = Math.abs(Math.sin(phase)) * 0.05;
      stride.rotation.x = -0.12;
      stride.rotation.z = Math.sin(phase) * 0.025;
    } else {
      stride.position.y = 0;
      stride.rotation.x = 0;
      stride.rotation.z = 0;
    }
  };
  stride.userData.animate = animate;
  stride.userData.kind = 'official';
  let mixer: AnimationMixer | null = null;
  if (clip) {
    mixer = new AnimationMixer(stride);
    mixer.timeScale = ANIMATION_TIME_SCALE;
    mixer.clipAction(clip).play();
    mixer.setTime(seed * clip.duration);
  }
  return { wrapper, stride, mixer };
}

/** One human-scale animated figure per state (except Georgia), drawn only for runners inside the view. */
export class UsBorderRunners3DLayer implements CustomLayerInterface {
  readonly id = 'us-border-runners-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private base: Object3D | null = null;
  private clip: AnimationClip | undefined;
  private readonly figures = new Map<string, RunnerFigure>();
  private runners: BorderRunner[] = [];
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

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        const box = new Box3().setFromObject(root);
        const h = box.max.y - box.min.y || 1;
        const k = FIGURE_HEIGHT_M / h;
        root.scale.setScalar(k);
        root.position.y = -box.min.y * k;
        root.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          o.frustumCulled = false;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            m.transparent = true;
            m.opacity = RUNNER_OPACITY;
            m.depthWrite = false;
            if ('color' in m) m.color.set(RUNNER_TINT);
          }
        });
        this.base = root;
        this.clip = gltf.animations[0];
        map.triggerRepaint();
      },
      undefined,
      (err) => console.warn('[UsBorderRunners3D] model load failed:', err),
    );

    loadRunners()
      .then((runners) => {
        if (this.disposed) return;
        this.runners = runners.filter((r) => !RUNNER_EXCLUDED_STATES.includes(r.st));
        layerRunners.set(map, this.runners);
        this.pushMarkers();
        map.triggerRepaint();
      })
      .catch((err) => console.warn('[UsBorderRunners3D] border load failed:', err));

    this.timer = setInterval(() => this.pushMarkers(), MARKER_INTERVAL_MS);
  }

  onRemove(): void {
    this.disposed = true;
    if (this.map) layerRunners.delete(this.map);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const f of this.figures.values()) f.mixer?.stopAllAction();
    this.figures.clear();
    this.base?.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.scene.clear();
    this.map = null;
  }

  /** Figures are cloned lazily the first time a runner comes into view. */
  private figureFor(r: BorderRunner, i: number): RunnerFigure | null {
    const existing = this.figures.get(r.st);
    if (existing) return existing;
    if (!this.base) return null;
    const fig = createRunnerFigure(this.base, this.clip, (i * GOLDEN_SEED) % 1);
    fig.wrapper.visible = false;
    this.scene.add(fig.wrapper);
    this.figures.set(r.st, fig);
    return fig;
  }

  private pushMarkers(): void {
    const src = this.map?.getSource(US_BORDER_RUNNERS_SOURCE) as GeoJSONSource | undefined;
    if (src && this.runners.length) src.setData(markerData(this.runners, Date.now()));
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const renderer = this.renderer;
    const map = this.map;
    if (!renderer || !map || !this.runners.length || !this.base) return;
    if (map.getZoom() < US_BORDER_RUNNERS_3D_MIN_ZOOM) return;

    const now = performance.now();
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 0;
    this.lastFrame = now;

    const bounds = map.getBounds();
    const epoch = Date.now();
    const data = options.defaultProjectionData;
    const mercatorMatrix = data.projectionTransition > 0 && data.fallbackMatrix ? data.fallbackMatrix : data.mainMatrix;
    let drew = false;
    for (let i = 0; i < this.runners.length; i++) {
      const r = this.runners[i];
      const pos = r.path.at(runnerDistance(r.path, r.fips, epoch));
      if (!bounds.contains(pos.lngLat)) continue;
      const fig = this.figureFor(r, i);
      if (!fig) continue;
      fig.mixer?.update(dt);
      (fig.stride.userData.animate as RunnerAnimate)(dt, dt > 0, ANIMATION_TIME_SCALE);
      const elevation = map.getTerrain() ? (map.queryTerrainElevation(pos.lngLat) ?? 0) : 0;
      const origin = MercatorCoordinate.fromLngLat(pos.lngLat, elevation);
      const s = origin.meterInMercatorCoordinateUnits();
      fig.wrapper.rotation.z = pos.heading + MODEL_FORWARD_OFFSET;
      fig.wrapper.visible = true;
      fig.wrapper.updateMatrixWorld(true);
      const model = new Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new Vector3(s, -s, s));
      const mvp = new Matrix4().fromArray(mercatorMatrix).multiply(model);
      this.camera.projectionMatrix.copy(mvp);
      this.camera.projectionMatrixInverse.copy(mvp).invert();
      if (!drew) {
        renderer.resetState();
        renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        drew = true;
      }
      renderer.render(this.scene, this.camera);
      fig.wrapper.visible = false;
    }
    map.triggerRepaint();
  }
}

const clickBound = new WeakSet<MapLibreMap>();

function runnerPopup(stateName: string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'font-family:monospace;padding:6px;background:#0f172a;color:#f8fafc;border-radius:8px;font-size:12px;line-height:1.45';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:13px;color:#81d8d0';
  title.textContent = `${stateName} border runner`;
  const note = document.createElement('div');
  note.textContent = 'Visualization only: runs the state border at 12 km/h; not a tracked person.';
  const link = document.createElement('a');
  link.href = US_BORDER_RUNNERS_SOURCE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.cssText = 'color:#7dd3fc;text-decoration:underline';
  link.textContent = 'Border source: U.S. Census 2024 cartographic boundary';
  box.append(title, note, link);
  return box;
}

/** Adds the runner locator source/dots and the 3D runner layer (idempotent). */
export function addUsBorderRunnerLayers(map: MapLibreMap): void {
  if (!map.getSource(US_BORDER_RUNNERS_SOURCE)) {
    map.addSource(US_BORDER_RUNNERS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: US_BORDER_RUNNERS_ATTRIBUTION,
    });
  }
  if (!map.getLayer('us-border-runner-dot')) {
    map.addLayer({
      id: 'us-border-runner-dot',
      type: 'circle',
      source: US_BORDER_RUNNERS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 8, 5, 14, 7, 17, 0],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#ff4fd8',
        'circle-stroke-width': 2,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15, 1, 17, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 15, 1, 17, 0],
      },
    });
  }
  if (!map.getLayer('us-border-runners-3d')) map.addLayer(new UsBorderRunners3DLayer());
  if (!clickBound.has(map)) {
    clickBound.add(map);
    map.on('click', 'us-border-runner-dot', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const at = f.geometry.coordinates as LngLat;
      new Popup({ offset: 12, closeButton: true, maxWidth: '300px' }).setLngLat(at).setDOMContent(runnerPopup(String(f.properties?.name ?? ''))).addTo(map);
      map.flyTo({ center: at, zoom: 19.5, pitch: Math.min(65, map.getMaxPitch()), speed: 1.6 });
    });
    map.on('mouseenter', 'us-border-runner-dot', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'us-border-runner-dot', () => {
      map.getCanvas().style.cursor = '';
    });
  }
}
