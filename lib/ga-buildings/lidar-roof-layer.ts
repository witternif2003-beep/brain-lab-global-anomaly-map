import {
  BufferGeometry,
  Camera,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Scene,
  Uint32BufferAttribute,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import { GA_LIDAR_SOURCE_URL, lngLatFrom3857 } from '../ga-lidar/ept';
import type { RoofModel } from './lidar-roofs';
import { NAIP_IMAGE_SERVER, NAIP_SOURCE_URL } from './roof-imagery';
import { NAIP_LATEST_LABEL, NAIP_LATEST_SOURCE_URL, naipLatestTile, photoBlock } from './naip-latest';

export const LIDAR_ROOF_LAYER = 'buildings-lidar-roofs';
/** Roofs are fitted from street zoom; once fitted they draw wherever the 3D buildings draw. */
export const ROOF_MESH_MIN_ZOOM = 16;
export const ROOF_DRAW_MIN_ZOOM = 14;

/** Phone vs desktop caps: roofs held, photo blocks held (each 512² RGBA ≈ 1.3 MB with mips) and photo tile zoom. */
export const ROOF_LIMITS = {
  touch: { roofs: 120, blocks: 12, tileZoom: 18 },
  desktop: { roofs: 600, blocks: 48, tileZoom: 19 },
} as const;
export type RoofLimits = (typeof ROOF_LIMITS)[keyof typeof ROOF_LIMITS];

interface Block {
  texture: Promise<CanvasTexture | null>;
  users: number;
  source: 'naip-2025' | 'naip-2023' | 'none';
}

interface Roof {
  mesh: Mesh;
  cx: number;
  cy: number;
  lngLat: [number, number];
  block: string | null;
  elev: number | null;
}

export interface RoofLayerStats {
  roofs: number;
  blocks: number;
  latestPhotoBlocks: number;
  fallbackPhotoBlocks: number;
}

const layers = new WeakMap<MapLibreMap, LidarRoofLayer>();
export const lidarRoofLayer = (map: MapLibreMap): LidarRoofLayer | null => layers.get(map) ?? null;

async function composeBlock(z: number, tx: number, ty: number, bounds: readonly number[]): Promise<{ canvas: OffscreenCanvas; source: Block['source'] } | null> {
  const canvas = new OffscreenCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const tiles = await Promise.all([0, 1, 2, 3].map((i) => naipLatestTile(z, tx + (i % 2), ty + (i >> 1))));
  if (tiles.every(Boolean)) {
    tiles.forEach((t, i) => ctx.drawImage(t!, (i % 2) * 256, (i >> 1) * 256, 256, 256));
    return { canvas, source: 'naip-2025' };
  }
  const r = await fetch(`${NAIP_IMAGE_SERVER}?bbox=${bounds.join(',')}&bboxSR=3857&imageSR=3857&size=512,512&format=jpgpng&f=image`).catch(() => null);
  if (!r?.ok) return null;
  const bmp = await createImageBitmap(await r.blob());
  ctx.drawImage(bmp, 0, 0, 512, 512);
  bmp.close();
  return { canvas, source: 'naip-2023' };
}

/**
 * Three.js layer for LiDAR-reconstructed roofs, textured with the newest NAIP aerial photo of the roof (0.3 m 2025 where
 * flown, else 0.6 m 2023). Walls stay the Overture extrusion, cut at the measured eave via feature-state `lidarEave`.
 */
export class LidarRoofLayer implements CustomLayerInterface {
  readonly id = LIDAR_ROOF_LAYER;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map: MapLibreMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly roofs = new Map<string, Roof>();
  private readonly blocks = new Map<string, Block>();
  private origin: MercatorCoordinate | null = null;
  private originX = 0;
  private originY = 0;
  private k = 1;
  constructor(readonly limits: RoofLimits) {}

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    layers.set(map, this);
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    this.scene.add(new HemisphereLight(0xeef3ff, 0x5b5146, 1.1));
    const sun = new DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-0.4, -0.7, 1.2);
    this.scene.add(sun);
  }

  onRemove(map: MapLibreMap): void {
    for (const id of [...this.roofs.keys()]) this.remove(id);
    for (const b of this.blocks.values()) void b.texture.then((t) => t?.dispose());
    this.blocks.clear();
    layers.delete(map);
    this.map = null;
  }

  has(id: string): boolean {
    return this.roofs.has(id);
  }

  get size(): number {
    return this.roofs.size;
  }

  stats(): RoofLayerStats {
    let latest = 0, fallback = 0;
    for (const b of this.blocks.values()) {
      if (b.source === 'naip-2025') latest++;
      else if (b.source === 'naip-2023') fallback++;
    }
    return { roofs: this.roofs.size, blocks: this.blocks.size, latestPhotoBlocks: latest, fallbackPhotoBlocks: fallback };
  }

  /** Adds one fitted roof centred on (cx, cy) EPSG:3857, footprint bbox in EPSG:3857, fallback colour from NAIP or Overture. */
  add(id: string, model: RoofModel, cx: number, cy: number, bbox: [number, number, number, number], color: string): boolean {
    const map = this.map;
    if (!map || this.roofs.has(id) || this.roofs.size >= this.limits.roofs) return false;
    if (!this.origin) {
      const ll = lngLatFrom3857(cx, cy);
      this.origin = MercatorCoordinate.fromLngLat(ll, 0);
      this.originX = cx;
      this.originY = cy;
      this.k = Math.cos((ll[1] * Math.PI) / 180);
    }
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(model.positions, 3));
    geom.setIndex(new Uint32BufferAttribute(model.indices, 1));
    const block = photoBlock(bbox, this.limits.tileZoom);
    let blockKey: string | null = null;
    if (block) {
      const uv = new Float32Array((model.positions.length / 3) * 2);
      const size = block.bounds[2] - block.bounds[0];
      for (let i = 0, j = 0; i < model.positions.length; i += 3, j += 2) {
        uv[j] = (model.positions[i] + cx - block.bounds[0]) / size;
        uv[j + 1] = (model.positions[i + 1] + cy - block.bounds[1]) / size;
      }
      geom.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    }
    geom.computeVertexNormals();
    const material = new MeshStandardMaterial({ color: new Color(color), roughness: 0.9, metalness: 0, side: DoubleSide });
    const mesh = new Mesh(geom, material);
    mesh.scale.set(this.k, this.k, 1);
    const lngLat = lngLatFrom3857(cx, cy);
    const roof: Roof = { mesh, cx, cy, lngLat, block: null, elev: null };
    this.place(roof);
    this.scene.add(mesh);
    this.roofs.set(id, roof);
    if (block && (this.blocks.has((blockKey = `${block.z}/${block.tx}/${block.ty}`)) || this.blocks.size < this.limits.blocks)) {
      let b = this.blocks.get(blockKey);
      if (!b) {
        const entry: Block = { users: 0, source: 'none', texture: Promise.resolve(null) };
        entry.texture = composeBlock(block.z, block.tx, block.ty, block.bounds).then((c) => {
          if (!c) return null;
          entry.source = c.source;
          const t = new CanvasTexture(c.canvas as unknown as HTMLCanvasElement);
          t.colorSpace = SRGBColorSpace;
          t.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
          return t;
        });
        this.blocks.set(blockKey, entry);
        b = entry;
      }
      b.users++;
      roof.block = blockKey;
      void b.texture.then((t) => {
        if (!t || this.roofs.get(id) !== roof) return;
        material.map = t;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        this.map?.triggerRepaint();
      });
    }
    map.triggerRepaint();
    return true;
  }

  remove(id: string): void {
    const r = this.roofs.get(id);
    if (!r) return;
    this.scene.remove(r.mesh);
    r.mesh.geometry.dispose();
    (r.mesh.material as MeshStandardMaterial).dispose();
    this.roofs.delete(id);
    if (r.block) {
      const b = this.blocks.get(r.block);
      if (b && --b.users <= 0) {
        void b.texture.then((t) => t?.dispose());
        this.blocks.delete(r.block);
      }
    }
  }

  /** Ids furthest from (x, y) beyond `keep`, so callers can release their eave state before removal. */
  farthest(x: number, y: number, keep: number): string[] {
    if (this.roofs.size <= keep) return [];
    return [...this.roofs.entries()]
      .sort((a, b) => Math.hypot(b[1].cx - x, b[1].cy - y) - Math.hypot(a[1].cx - x, a[1].cy - y))
      .slice(0, this.roofs.size - keep)
      .map(([id]) => id);
  }

  private place(r: Roof): void {
    const e = this.map?.queryTerrainElevation(r.lngLat);
    r.elev = e ?? null;
    r.mesh.position.set((r.cx - this.originX) * this.k, (r.cy - this.originY) * this.k, e ?? 0);
  }

  /** Re-seats roofs on the terrain once its tiles load. */
  refreshElevation(): void {
    for (const r of this.roofs.values()) if (r.elev === null) this.place(r);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const renderer = this.renderer;
    const map = this.map;
    if (!renderer || !map || !this.origin || !this.roofs.size || map.getZoom() < ROOF_DRAW_MIN_ZOOM) return;
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

const CREDIT_SOURCE = 'lidar-roofs-credit';
const restoreHooked = new WeakSet<MapLibreMap>();

/** Adds the roof layer above the 3D buildings, with its source credit, and re-adds it after WebGL context loss. */
export function addLidarRoofLayer(map: MapLibreMap, touch: boolean): void {
  if (!map.getSource(CREDIT_SOURCE)) {
    map.addSource(CREDIT_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: `Roof shapes: fitted to <a href="${GA_LIDAR_SOURCE_URL}" target="_blank" rel="noopener">USGS 3DEP LiDAR</a> building returns (public domain); roof photos: <a href="${NAIP_LATEST_SOURCE_URL}" target="_blank" rel="noopener">${NAIP_LATEST_LABEL}</a>, else <a href="${NAIP_SOURCE_URL}" target="_blank" rel="noopener">USDA NAIP 2023 0.6 m via USGS</a> (public domain)`,
    });
  }
  if (!map.getLayer(CREDIT_SOURCE)) map.addLayer({ id: CREDIT_SOURCE, type: 'circle', source: CREDIT_SOURCE, minzoom: ROOF_MESH_MIN_ZOOM });
  if (!map.getLayer(LIDAR_ROOF_LAYER)) map.addLayer(new LidarRoofLayer(touch ? ROOF_LIMITS.touch : ROOF_LIMITS.desktop));
  if (!restoreHooked.has(map)) {
    restoreHooked.add(map);
    map.on('webglcontextrestored', () => {
      map.once('style.load', () => {
        if (!map.getLayer(LIDAR_ROOF_LAYER)) map.addLayer(new LidarRoofLayer(touch ? ROOF_LIMITS.touch : ROOF_LIMITS.desktop));
      });
    });
  }
}
