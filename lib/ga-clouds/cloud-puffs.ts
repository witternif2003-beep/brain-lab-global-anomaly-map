/** Radar cloud blocks (NOAA MRMS cells) → overlapping lit spheres ("puffs") that fill each echo column, drawn as cumulus-like 3D cloud (pure). */
import type { GaMesh } from '../ga-mesh-models';

export interface CloudPuff {
  /** lng, lat, metres above sea level (centre). */
  position: [number, number, number];
  /** Sphere radii in metres (east, north, up). */
  scale: [number, number, number];
  color: [number, number, number, number];
  /** Index of the source radar block in the input collection. */
  block: number;
}

export interface CloudPuffOptions {
  cellDeg: number;
  /** True ground elevation (m above sea level) under a point; cloud bases are reported above ground. */
  groundM: (lng: number, lat: number) => number;
  maxPuffs: number;
}

interface Column { lng: number; lat: number; baseMsl: number; topMsl: number; night: number; band: number; block: number }

const BANDS = ['light', 'moderate', 'heavy', 'intense'];
const M_PER_DEG_LAT = 111_320;
const DAY: [number, number, number] = [255, 255, 255];
const NIGHT: [number, number, number] = [172, 186, 212];

/** Deterministic 0..1 noise per (x, y, k) so puffs keep their place between refreshes. */
function hash(x: number, y: number, k: number): number {
  let h = (x * 374_761_393 + y * 668_265_263 + k * 2_147_483_647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

function columns(fc: GeoJSON.FeatureCollection, cell: number, groundM: CloudPuffOptions['groundM']): Map<string, Column> {
  const out = new Map<string, Column>();
  let lng0 = Infinity;
  let lat0 = Infinity;
  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon') continue;
    for (const [lng, lat] of f.geometry.coordinates[0]) {
      lng0 = Math.min(lng0, lng);
      lat0 = Math.min(lat0, lat);
    }
  }
  fc.features.forEach((f, block) => {
    if (f.geometry.type !== 'Polygon') return;
    const ring = f.geometry.coordinates[0];
    const lngs = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
    const p = f.properties ?? {};
    const topM = Number(p.topM);
    if (!Number.isFinite(topM) || topM <= 0) return;
    const baseAgl = Math.max(0, Number(p.baseM) || 0);
    const night = Math.max(0, Math.min(1, Number(p.night) || 0));
    const band = Math.max(0, BANDS.indexOf(String(p.band)));
    for (let y = Math.round((s - lat0) / cell); y < Math.round((n - lat0) / cell); y++) {
      for (let x = Math.round((w - lng0) / cell); x < Math.round((e - lng0) / cell); x++) {
        const lng = lng0 + (x + 0.5) * cell;
        const lat = lat0 + (y + 0.5) * cell;
        const baseMsl = groundM(lng, lat) + baseAgl;
        out.set(`${x},${y}`, { lng, lat, baseMsl, topMsl: topM, night, band, block });
      }
    }
  });
  return out;
}

/** Merge f×f cells into one column keeping the highest top, lowest base and strongest band. */
function coarsen(cols: Map<string, Column>, f: number): Map<string, Column> {
  if (f <= 1) return cols;
  const out = new Map<string, Column & { n: number }>();
  for (const [key, c] of cols) {
    const [x, y] = key.split(',').map(Number);
    const k = `${Math.floor(x / f)},${Math.floor(y / f)}`;
    const o = out.get(k);
    if (!o) out.set(k, { ...c, n: 1 });
    else {
      o.lng += c.lng; o.lat += c.lat; o.n++;
      o.baseMsl = Math.min(o.baseMsl, c.baseMsl);
      if (c.topMsl > o.topMsl) { o.topMsl = c.topMsl; o.block = c.block; }
      o.band = Math.max(o.band, c.band);
      o.night = Math.max(o.night, c.night);
    }
  }
  for (const o of out.values()) { o.lng /= o.n; o.lat /= o.n; }
  return out;
}

function puffsFor(cols: Map<string, Column>, cell: number): CloudPuff[] {
  const out: CloudPuff[] = [];
  for (const [key, c] of cols) {
    const [x, y] = key.split(',').map(Number);
    const cellNs = cell * M_PER_DEG_LAT;
    const cellEw = cellNs * Math.cos((c.lat * Math.PI) / 180);
    const r = 0.75 * Math.max(cellNs, cellEw);
    const base = c.baseMsl;
    const top = Math.max(c.topMsl, base + 1.2 * r);
    const levels = Math.max(1, Math.ceil((top - base) / (0.9 * r)));
    const lo = base + 0.6 * r;
    const hi = top - 0.6 * r;
    const step = levels > 1 ? (hi - lo) / (levels - 1) : 0;
    const nb = [cols.get(`${x + 1},${y}`), cols.get(`${x - 1},${y}`), cols.get(`${x},${y + 1}`), cols.get(`${x},${y - 1}`)];
    for (let k = 0; k < levels; k++) {
      const z = levels > 1 ? lo + k * step : (lo + hi) / 2;
      const crown = k === levels - 1;
      const exposed = crown || k === 0 || nb.some((o) => !o || o.topMsl < z + 0.5 * r || o.baseMsl > z - 0.5 * r);
      if (!exposed) continue;
      const j = (i: number) => hash(x, y, k * 8 + i);
      const t = top > base ? (z - base) / (top - base) : 1;
      const shade = Math.min(1, 0.68 + 0.32 * t - 0.04 * c.band * (1 - t));
      const rgb = DAY.map((d, i) => Math.round((d + (NIGHT[i] - d) * c.night) * shade));
      const color: [number, number, number, number] = [rgb[0], rgb[1], rgb[2], 255];
      const size = r * (crown ? 1.1 + 0.25 * j(0) : 0.95 + 0.2 * j(0));
      const flatBase = k === 0 && !crown;
      out.push({
        position: [
          c.lng + (j(1) - 0.5) * 0.4 * cell,
          c.lat + (j(2) - 0.5) * 0.4 * cell,
          flatBase ? base + 0.45 * r : z + (j(3) - 0.5) * 0.3 * r,
        ],
        scale: [size, size, size * (flatBase ? 0.45 : 0.7)],
        color,
        block: c.block,
      });
      if (!crown) continue;
      // Cauliflower crown: two smaller turrets on opposite diagonals, kept inside the cell.
      const sx = j(4) < 0.5 ? 1 : -1;
      for (const d of [1, -1]) {
        const sr = r * (0.55 + 0.2 * j(5 + (d > 0 ? 0 : 1)));
        out.push({
          position: [c.lng + d * sx * 0.4 * cell, c.lat + d * 0.4 * cell, z + 0.35 * r],
          scale: [sr, sr, sr * 0.8],
          color: [Math.min(255, color[0] + 8), Math.min(255, color[1] + 8), Math.min(255, color[2] + 8), 255],
          block: c.block,
        });
      }
    }
  }
  return out;
}

/**
 * Fills every radar echo column (nearest METAR base → MRMS echo top) with overlapping spheres. Only spheres on the
 * cloud's surface are kept; crowns are larger and bottoms greyer, so the echo reads as a cumulus mass. The jitter is
 * deterministic and stays inside each radar cell. Cells merge 2×2 until the count fits `maxPuffs`.
 */
export function radarCloudPuffs(fc: GeoJSON.FeatureCollection, opts: CloudPuffOptions): CloudPuff[] {
  if (!(opts.cellDeg > 0)) return [];
  const cols = columns(fc, opts.cellDeg, opts.groundM);
  for (let f = 1; ; f *= 2) {
    const puffs = puffsFor(coarsen(cols, f), opts.cellDeg * f);
    if (puffs.length <= opts.maxPuffs || f >= 64) return puffs;
  }
}

/** Unit UV sphere; undersides are pre-darkened so each puff reads as self-shadowed. */
export function puffSphereMesh(rings = 8, segments = 14): GaMesh {
  const p: number[] = [];
  const n: number[] = [];
  const c: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    for (let j = 0; j <= segments; j++) {
      const th = (j / segments) * 2 * Math.PI;
      const v: [number, number, number] = [Math.sin(phi) * Math.cos(th), Math.sin(phi) * Math.sin(th), Math.cos(phi)];
      p.push(...v);
      n.push(...v);
      const s = 0.78 + 0.22 * (v[2] + 1) / 2;
      c.push(s, s, s);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    attributes: {
      positions: { value: new Float32Array(p), size: 3 },
      normals: { value: new Float32Array(n), size: 3 },
      colors: { value: new Float32Array(c), size: 3 },
    },
    indices: { value: new Uint32Array(idx), size: 1 },
  };
}
