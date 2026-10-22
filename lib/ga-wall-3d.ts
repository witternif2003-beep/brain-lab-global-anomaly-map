import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  Camera,
  Curve,
  DirectionalLight,
  Float32BufferAttribute,
  FrontSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';

// Geometry constants match scripts/build-ga-wall.py (the fill-extrusion version used below this zoom).
const WALL_HEIGHT_M = 3.048;
const WALL_THICKNESS_M = 0.3;
const CAP_HEIGHT_M = 0.08;
const CAP_THICKNESS_M = 0.36;
const COIL_RADIUS_M = 0.38;
const COIL_PITCH_M = 0.3;
const WIRE_RADIUS_M = 0.011;
const BASE_COIL_OFFSET_M = 1.0 + COIL_RADIUS_M;
const POST_SPACING_M = 3.0;
const POST_SIZE_M = 0.15;
const FOOTING_WIDTH_M = 1.2;
const FOOTING_HEIGHT_M = 0.06;
const TERRAIN_STEP_M = 4;
const TERRAIN_SINK_M = 0.6;
const TEXTURE_TILE_M = 1.5;
const BARB_SPACING_M = 0.1;
const BARB_RADIUS_M = 150;
const TEX_BASE = '/textures/ga-wall/';

export const GA_WALL_3D_MIN_ZOOM = 17;

type RunPoint = { x: number; y: number; z: number; d: number };
type LocalVertex = { x: number; y: number; mx: number; my: number };

function buildRadiusForZoom(zoom: number): number {
  return zoom >= 19 ? 220 : 420;
}

class HelixCurve extends Curve<Vector3> {
  constructor(
    private readonly run: RunPoint[],
    private readonly side: number,
    private readonly lateral: number,
    private readonly zCenter: number,
    private readonly handed: number,
    private readonly phase: number,
  ) {
    super();
  }

  get length(): number {
    return this.run[this.run.length - 1].d;
  }

  getPoint(t: number, target = new Vector3()): Vector3 {
    const run = this.run;
    const s = Math.min(Math.max(t, 0), 1) * this.length;
    let lo = 0;
    let hi = run.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (run[mid].d <= s) lo = mid;
      else hi = mid;
    }
    const a = run[lo];
    const b = run[hi];
    const segLen = b.d - a.d || 1;
    const f = (s - a.d) / segLen;
    const dx = (b.x - a.x) / segLen;
    const dy = (b.y - a.y) / segLen;
    const nx = -dy * this.side;
    const ny = dx * this.side;
    const th = (this.handed * 2 * Math.PI * s) / COIL_PITCH_M + this.phase;
    const lat = this.lateral + COIL_RADIUS_M * Math.cos(th);
    return target.set(
      a.x + (b.x - a.x) * f + nx * lat,
      a.y + (b.y - a.y) * f + ny * lat,
      a.z + (b.z - a.z) * f + this.zCenter + COIL_RADIUS_M * Math.sin(th),
    );
  }
}

class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];

  quad(corners: Vector3[], normal: Vector3, uv: Array<[number, number]>): void {
    const e1 = new Vector3().subVectors(corners[1], corners[0]);
    const e2 = new Vector3().subVectors(corners[2], corners[0]);
    const order = e1.cross(e2).dot(normal) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of order) {
      this.positions.push(corners[i].x, corners[i].y, corners[i].z);
      this.normals.push(normal.x, normal.y, normal.z);
      this.uvs.push(uv[i][0], uv[i][1]);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    return g;
  }
}

/** Mitred band of `thickness` centred on the run, from z0 to z0 + height above each run point. */
function addBand(mb: MeshBuilder, run: RunPoint[], thickness: number, z0: number, height: number): void {
  const n = run.length;
  const h = thickness / 2;
  const offsets: Array<[number, number]> = [];
  const segNormals: Array<[number, number]> = [];
  for (let i = 0; i < n - 1; i++) {
    const len = run[i + 1].d - run[i].d || 1;
    segNormals.push([-(run[i + 1].y - run[i].y) / len, (run[i + 1].x - run[i].x) / len]);
  }
  for (let i = 0; i < n; i++) {
    const prev = segNormals[Math.max(0, i - 1)];
    const next = segNormals[Math.min(n - 2, i)];
    let mx = prev[0] + next[0];
    let my = prev[1] + next[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const scale = 1 / Math.max(0.35, mx * next[0] + my * next[1]);
    offsets.push([mx * scale * h, my * scale * h]);
  }
  const v = (i: number, sgn: number, top: boolean) =>
    new Vector3(run[i].x + sgn * offsets[i][0], run[i].y + sgn * offsets[i][1], run[i].z + z0 + (top ? height : 0));
  const vTop = height / TEXTURE_TILE_M;
  for (let i = 0; i < n - 1; i++) {
    const u0 = run[i].d / TEXTURE_TILE_M;
    const u1 = run[i + 1].d / TEXTURE_TILE_M;
    const [nx, ny] = segNormals[i];
    for (const sgn of [1, -1]) {
      mb.quad(
        [v(i, sgn, false), v(i + 1, sgn, false), v(i + 1, sgn, true), v(i, sgn, true)],
        new Vector3(nx * sgn, ny * sgn, 0),
        [[u0, 0], [u1, 0], [u1, vTop], [u0, vTop]],
      );
    }
    mb.quad(
      [v(i, 1, true), v(i + 1, 1, true), v(i + 1, -1, true), v(i, -1, true)],
      new Vector3(0, 0, 1),
      [[u0, 0], [u1, 0], [u1, thickness / TEXTURE_TILE_M], [u0, thickness / TEXTURE_TILE_M]],
    );
  }
  const capUv: Array<[number, number]> = [[0, 0], [thickness / TEXTURE_TILE_M, 0], [thickness / TEXTURE_TILE_M, vTop], [0, vTop]];
  for (const [i, j] of [[0, 1], [n - 1, n - 2]]) {
    const dir = new Vector3(run[i].x - run[j].x, run[i].y - run[j].y, 0).normalize();
    mb.quad([v(i, 1, false), v(i, -1, false), v(i, -1, true), v(i, 1, true)], dir, capUv);
  }
}

function densify(pts: Array<{ x: number; y: number }>, step: number): Array<{ x: number; y: number }> {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step);
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

function loadTexture(loader: TextureLoader, file: string, srgb: boolean, onLoad: () => void): Texture {
  const tex = loader.load(TEX_BASE + file, onLoad);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Close-range three.js rendering of the Georgia wall design visualization:
 * PBR galvanized corrugated steel (ambientCG CorrugatedSteel005, CC0), steel posts,
 * and real helical concertina coils with razor barbs, rebuilt around the camera.
 */
export class GaWall3DLayer implements CustomLayerInterface {
  readonly id = 'ga-wall-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private group: Group | null = null;
  private pendingDispose: Group[] = [];
  private envReady = false;
  private path: Array<[number, number]> = [];
  private side = 1;
  private origin: MercatorCoordinate | null = null;
  private builtRadius = 0;
  private steel: MeshStandardMaterial | null = null;
  private dark: MeshStandardMaterial | null = null;
  private wire: MeshStandardMaterial | null = null;
  private footing: MeshStandardMaterial | null = null;
  private terrainStale = false;
  private readonly onMoveEnd = () => this.rebuild(false);
  private readonly onIdle = () => {
    if (!this.terrainStale) return;
    this.terrainStale = false;
    this.rebuild(true);
  };

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;

    const repaint = () => map.triggerRepaint();
    const loader = new TextureLoader();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const color = loadTexture(loader, 'steel-color.jpg', true, repaint);
    const normal = loadTexture(loader, 'steel-normalgl.jpg', false, repaint);
    const rough = loadTexture(loader, 'steel-roughness.jpg', false, repaint);
    const ao = loadTexture(loader, 'steel-ambientocclusion.jpg', false, repaint);
    for (const t of [color, normal, rough, ao]) t.anisotropy = aniso;
    this.steel = new MeshStandardMaterial({
      map: color,
      normalMap: normal,
      roughnessMap: rough,
      aoMap: ao,
      color: 0xb4bac2,
      metalness: 0.8,
      roughness: 1,
      side: FrontSide,
    });
    this.dark = new MeshStandardMaterial({ map: color, color: 0x6e757e, metalness: 0.8, roughness: 0.6 });
    this.footing = new MeshStandardMaterial({ color: 0x5c0d12, emissive: 0x2a0306, metalness: 0.1, roughness: 0.85 });
    this.wire = new MeshStandardMaterial({ color: 0xdfe5ec, metalness: 1, roughness: 0.22 });

    this.scene.add(new HemisphereLight(0xdde9ff, 0x4b3f2f, 0.6));
    const sun = new DirectionalLight(0xfff3df, 1.7);
    sun.position.set(-0.45, -0.8, 1.25);
    this.scene.add(sun);
    this.scene.environmentRotation.x = Math.PI / 2;
    this.scene.environmentIntensity = 0.45;

    map.on('moveend', this.onMoveEnd);
    map.on('idle', this.onIdle);
    fetch('/geo/ga-wall.geojson')
      .then((r) => r.json())
      .then((fc: { features: Array<{ properties: { part: string }; geometry: { coordinates: Array<[number, number]> } }> }) => {
        const pathFeature = fc.features.find((f) => f.properties.part === 'path');
        if (!pathFeature) return;
        this.path = pathFeature.geometry.coordinates;
        let area = 0;
        for (let i = 0; i < this.path.length - 1; i++) {
          area += this.path[i][0] * this.path[i + 1][1] - this.path[i + 1][0] * this.path[i][1];
        }
        this.side = area > 0 ? -1 : 1;
        this.rebuild(false);
      })
      .catch((err) => console.warn('[GaWall3D] path load failed:', err));
  }

  onRemove(map: MapLibreMap): void {
    map.off('moveend', this.onMoveEnd);
    map.off('idle', this.onIdle);
    if (this.group) this.pendingDispose.push(this.group);
    this.disposePending();
    for (const m of [this.steel, this.dark, this.wire, this.footing]) {
      if (m) {
        m.map?.dispose();
        m.normalMap?.dispose();
        m.roughnessMap?.dispose();
        m.aoMap?.dispose();
        m.dispose();
      }
    }
    this.scene.environment?.dispose();
    this.map = null;
  }

  private disposePending(): void {
    for (const g of this.pendingDispose) {
      g.traverse((o) => {
        if (o instanceof Mesh || o instanceof InstancedMesh) o.geometry.dispose();
      });
      this.scene.remove(g);
    }
    this.pendingDispose = [];
  }

  private retire(): void {
    if (this.group) this.pendingDispose.push(this.group);
    this.group = null;
    this.origin = null;
  }

  private rebuild(force: boolean): void {
    const map = this.map;
    if (!map || this.path.length < 2 || !this.steel || !this.dark || !this.wire || !this.footing) return;
    const zoom = map.getZoom();
    if (zoom < GA_WALL_3D_MIN_ZOOM) {
      if (this.group) {
        this.retire();
        map.triggerRepaint();
      }
      return;
    }
    const center = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    const radius = buildRadiusForZoom(zoom);
    if (!force && this.origin && radius === this.builtRadius) {
      const moved = Math.hypot(center.x - this.origin.x, center.y - this.origin.y) / this.origin.meterInMercatorCoordinateUnits();
      if (moved < radius * 0.35) return;
    }
    const s = center.meterInMercatorCoordinateUnits();
    const verts: LocalVertex[] = this.path.map(([lng, lat]) => {
      const m = MercatorCoordinate.fromLngLat([lng, lat], 0);
      return { x: (m.x - center.x) / s, y: -(m.y - center.y) / s, mx: m.x, my: m.y };
    });

    const runs: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    const close = () => {
      if (current.length >= 2) runs.push(current);
      current = [];
    };
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i];
      const b = verts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const qa = dx * dx + dy * dy;
      const qb = 2 * (a.x * dx + a.y * dy);
      const qc = a.x * a.x + a.y * a.y - radius * radius;
      const disc = qb * qb - 4 * qa * qc;
      if (qa === 0 || disc <= 0) {
        close();
        continue;
      }
      const sq = Math.sqrt(disc);
      const t0 = Math.max(0, (-qb - sq) / (2 * qa));
      const t1 = Math.min(1, (-qb + sq) / (2 * qa));
      if (t0 >= t1) {
        close();
        continue;
      }
      if (current.length === 0 || t0 > 0) {
        close();
        current.push({ x: a.x + dx * t0, y: a.y + dy * t0 });
      }
      current.push({ x: a.x + dx * t1, y: a.y + dy * t1 });
      if (t1 < 1) close();
    }
    close();

    const useTerrain = !!map.getTerrain();
    this.terrainStale = useTerrain && !force;
    const lift = useTerrain ? TERRAIN_SINK_M : 0;
    const group = new Group();
    const wallMb = new MeshBuilder();
    const capMb = new MeshBuilder();
    const footMb = new MeshBuilder();
    const postMatrices: Matrix4[] = [];
    const barbMatrices: Matrix4[] = [];
    const tmpP = new Vector3();
    const tmpT = new Vector3();
    const tmpN = new Vector3();
    const tmpB = new Vector3();

    for (const rawPts of runs) {
      const pts = useTerrain ? densify(rawPts, TERRAIN_STEP_M) : rawPts;
      let d = 0;
      const run: RunPoint[] = pts.map((p, i) => {
        if (i > 0) d += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
        let z = 0;
        if (useTerrain) {
          const ll = new MercatorCoordinate(center.x + p.x * s, center.y - p.y * s, 0).toLngLat();
          z = (map.queryTerrainElevation(ll) ?? 0) - TERRAIN_SINK_M;
        }
        return { x: p.x, y: p.y, z, d };
      });
      const total = run[run.length - 1].d;
      if (total < 0.5) continue;

      addBand(wallMb, run, WALL_THICKNESS_M, 0, WALL_HEIGHT_M + lift);
      addBand(capMb, run, CAP_THICKNESS_M, WALL_HEIGHT_M + lift, CAP_HEIGHT_M);
      addBand(footMb, run, FOOTING_WIDTH_M, 0, FOOTING_HEIGHT_M + lift);

      let seg = 0;
      for (let pd = POST_SPACING_M / 2; pd < total; pd += POST_SPACING_M) {
        while (seg < run.length - 2 && run[seg + 1].d < pd) seg++;
        const a = run[seg];
        const b = run[seg + 1];
        const f = (pd - a.d) / (b.d - a.d || 1);
        const heading = Math.atan2(b.y - a.y, b.x - a.x);
        const len = b.d - a.d || 1;
        const off = WALL_THICKNESS_M / 2 + POST_SIZE_M / 2;
        const nx = (-(b.y - a.y) / len) * this.side * off;
        const ny = ((b.x - a.x) / len) * this.side * off;
        const postH = WALL_HEIGHT_M + CAP_HEIGHT_M;
        postMatrices.push(
          new Matrix4()
            .makeTranslation(a.x + (b.x - a.x) * f + nx, a.y + (b.y - a.y) * f + ny, a.z + (b.z - a.z) * f + lift + postH / 2)
            .multiply(new Matrix4().makeRotationZ(heading)),
        );
      }

      const coils: Array<[number, number]> = [
        [0, lift + WALL_HEIGHT_M + CAP_HEIGHT_M + COIL_RADIUS_M],
        [BASE_COIL_OFFSET_M, lift + COIL_RADIUS_M],
      ];
      for (const [lateral, zc] of coils) {
        for (const [handed, phase] of [[1, 0], [-1, Math.PI]]) {
          const curve = new HelixCurve(run, this.side, lateral, zc, handed, phase);
          const loops = total / COIL_PITCH_M;
          const tube = new TubeGeometry(curve, Math.max(8, Math.ceil(loops * 12)), WIRE_RADIUS_M, 4, false);
          const mesh = new Mesh(tube, this.wire);
          mesh.frustumCulled = false;
          group.add(mesh);

          const wireLen = total * Math.hypot((2 * Math.PI * COIL_RADIUS_M) / COIL_PITCH_M, 1);
          const barbs = Math.floor(wireLen / BARB_SPACING_M);
          for (let k = 0; k < barbs; k++) {
            const t = (k + 0.5) / barbs;
            curve.getPoint(t, tmpP);
            if (tmpP.x * tmpP.x + tmpP.y * tmpP.y > BARB_RADIUS_M * BARB_RADIUS_M) continue;
            curve.getPoint(Math.min(1, t + 0.0005 / Math.max(total, 1)), tmpT).sub(tmpP).normalize();
            tmpN.set(0, 0, 1).cross(tmpT).normalize();
            tmpB.crossVectors(tmpT, tmpN);
            barbMatrices.push(new Matrix4().makeBasis(tmpT, tmpN, tmpB).setPosition(tmpP));
          }
        }
      }
    }

    if (wallMb.positions.length) {
      const wallMesh = new Mesh(wallMb.build(), this.steel);
      wallMesh.frustumCulled = false;
      group.add(wallMesh);
      const capMesh = new Mesh(capMb.build(), this.dark);
      capMesh.frustumCulled = false;
      group.add(capMesh);
      const footMesh = new Mesh(footMb.build(), this.footing);
      footMesh.frustumCulled = false;
      group.add(footMesh);
    }
    const addInstances = (geometry: BufferGeometry, material: Material, matrices: Matrix4[]) => {
      if (!matrices.length) {
        geometry.dispose();
        return;
      }
      const inst = new InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      group.add(inst);
    };
    addInstances(new BoxGeometry(POST_SIZE_M, POST_SIZE_M, WALL_HEIGHT_M + CAP_HEIGHT_M), this.dark, postMatrices);
    addInstances(new BoxGeometry(0.034, 0.03, 0.0016), this.wire, barbMatrices);

    this.retire();
    this.group = group;
    this.origin = center;
    this.builtRadius = radius;
    this.scene.add(group);
    map.triggerRepaint();
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const renderer = this.renderer;
    const map = this.map;
    if (!renderer || !map) return;
    if (this.pendingDispose.length) this.disposePending();
    if (!this.group || !this.origin || map.getZoom() < GA_WALL_3D_MIN_ZOOM) return;

    if (!this.envReady) {
      const pmrem = new PMREMGenerator(renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.envReady = true;
    }

    const s = this.origin.meterInMercatorCoordinateUnits();
    const model = new Matrix4().makeTranslation(this.origin.x, this.origin.y, 0).scale(new Vector3(s, -s, s));
    const data = options.defaultProjectionData;
    const mercatorMatrix = data.projectionTransition > 0 && data.fallbackMatrix ? data.fallbackMatrix : data.mainMatrix;
    const mvp = new Matrix4().fromArray(mercatorMatrix).multiply(model);
    this.camera.projectionMatrix.copy(mvp);
    this.camera.projectionMatrixInverse.copy(mvp).invert();

    renderer.resetState();
    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.render(this.scene, this.camera);
  }
}
