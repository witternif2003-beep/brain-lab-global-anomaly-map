import { bearingDeg, haversineM, type LngLat } from "./traffic-sim";

/**
 * Deck height per OSM `layer` step, in metres. An ESTIMATE: OSM `layer` is stacking order, not height
 * (https://wiki.openstreetmap.org/wiki/Key:layer), so stacked decks are drawn `layer × 7 m` above the ground.
 */
export const BRIDGE_LAYER_M = 7;
/** Steepest approach to a deck (6 %), so cars climb onto a bridge instead of jumping. An assumption, not survey data. */
export const MAX_APPROACH_GRADE = 0.06;
/** A car line vertex sits on a bridge when it is this close to a bridge segment… */
export const MATCH_DIST_M = 12;
/** …and runs within this many degrees of it, either direction. */
export const MATCH_BEARING_DEG = 30;
/** Car lines that touch a bridge are re-sampled at this spacing so short decks aren't skipped. */
export const DENSIFY_STEP_M = 20;
export const DECK_WIDTH_M = 8;
export const DECK_THICKNESS_M = 1.2;

const CELL_DEG = 0.0005;

export interface BridgeSegment {
  a: LngLat;
  b: LngLat;
  layer: number;
  /** Undirected bearing in [0, 180). */
  axis: number;
}

export interface BridgeIndex {
  cells: Map<string, BridgeSegment[]>;
  count: number;
}

/** Segments of OSM ways tagged `brunnel=bridge` with `layer` ≥ 1; a bridge without a positive layer gets no lift. */
export function bridgeSegments(
  features: Array<{
    geometry: { type: string; coordinates?: unknown };
    properties?: Record<string, unknown> | null;
  }>,
): BridgeSegment[] {
  const out: BridgeSegment[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (f.properties?.brunnel !== "bridge") continue;
    const layer = Number(f.properties?.layer);
    if (!Number.isInteger(layer) || layer < 1) continue;
    const g = f.geometry;
    const parts = (
      g.type === "LineString"
        ? [g.coordinates]
        : g.type === "MultiLineString"
          ? g.coordinates
          : []
    ) as LngLat[][];
    for (const p of parts) {
      for (let i = 1; i < p.length; i++) {
        const key = `${p[i - 1][0].toFixed(6)},${p[i - 1][1].toFixed(6)};${p[i][0].toFixed(6)},${p[i][1].toFixed(6)};${layer}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          a: p[i - 1],
          b: p[i],
          layer,
          axis: bearingDeg(p[i - 1], p[i]) % 180,
        });
      }
    }
  }
  return out;
}

const cellKey = (x: number, y: number) => `${x},${y}`;

export function buildBridgeIndex(segs: BridgeSegment[]): BridgeIndex {
  const cells = new Map<string, BridgeSegment[]>();
  for (const s of segs) {
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / CELL_DEG);
    const x1 = Math.floor(Math.max(s.a[0], s.b[0]) / CELL_DEG);
    const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / CELL_DEG);
    const y1 = Math.floor(Math.max(s.a[1], s.b[1]) / CELL_DEG);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = cellKey(x, y);
        const list = cells.get(k);
        if (list) list.push(s);
        else cells.set(k, [s]);
      }
  }
  return { cells, count: segs.length };
}

/** Distance in metres from p to segment ab (local equirectangular projection; fine at the ~10 m scale used here). */
export function pointSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110_574;
  const ax = (a[0] - p[0]) * kx,
    ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx,
    by = (b[1] - p[1]) * ky;
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

const axisDiff = (u: number, v: number) => {
  const d = Math.abs((u % 180) - (v % 180));
  return Math.min(d, 180 - d);
};

/** OSM bridge layer under a car-line point heading `bearing`, or 0. The nearest matching segment wins. */
export function bridgeLayerAt(
  index: BridgeIndex,
  p: LngLat,
  bearing: number,
): number {
  if (!index.count) return 0;
  const cx = Math.floor(p[0] / CELL_DEG);
  const cy = Math.floor(p[1] / CELL_DEG);
  let best = Infinity;
  let layer = 0;
  for (let x = cx - 1; x <= cx + 1; x++)
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (const s of index.cells.get(cellKey(x, y)) ?? []) {
        if (axisDiff(s.axis, bearing) > MATCH_BEARING_DEG) continue;
        const d = pointSegmentM(p, s.a, s.b);
        if (d <= MATCH_DIST_M && d < best) {
          best = d;
          layer = s.layer;
        }
      }
    }
  return layer;
}

/** Splits every segment longer than `step` metres into equal pieces no longer than `step`. */
export function densify(coords: LngLat[], step = DENSIFY_STEP_M): LngLat[] {
  if (coords.length < 2) return coords.slice();
  const out: LngLat[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1],
      b = coords[i];
    const n = Math.max(1, Math.ceil(haversineM(a, b) / step));
    for (let k = 1; k <= n; k++)
      out.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
  }
  return out;
}

/** Raises each vertex to at least `peak − grade × distance` of every bridge vertex, so approaches climb at ≤ `grade`. */
export function taperOffsets(
  raw: number[],
  cum: number[],
  grade = MAX_APPROACH_GRADE,
): number[] {
  const off = raw.slice();
  for (let i = 1; i < off.length; i++)
    off[i] = Math.max(off[i], off[i - 1] - grade * (cum[i] - cum[i - 1]));
  for (let i = off.length - 2; i >= 0; i--)
    off[i] = Math.max(off[i], off[i + 1] - grade * (cum[i + 1] - cum[i]));
  return off;
}

export interface BridgedLine {
  coords: LngLat[];
  /** Metres above the terrain per vertex: `layer × BRIDGE_LAYER_M` on a matched deck, tapered on the approaches, else 0. */
  offsets: number[];
  onBridge: boolean;
}

/** Lifts a car line where it runs along an OSM bridge; lines that touch no bridge come back unchanged with zero offsets. */
export function bridgeLine(index: BridgeIndex, coords: LngLat[]): BridgedLine {
  const flat = { coords, offsets: coords.map(() => 0), onBridge: false };
  if (!index.count || coords.length < 2) return flat;
  const dense = densify(coords);
  const raw = dense.map((p, i) => {
    const j = Math.min(i, dense.length - 2);
    return (
      bridgeLayerAt(index, p, bearingDeg(dense[j], dense[j + 1])) *
      BRIDGE_LAYER_M
    );
  });
  if (!raw.some((v) => v > 0)) return flat;
  const cum = [0];
  for (let i = 1; i < dense.length; i++)
    cum.push(cum[i - 1] + haversineM(dense[i - 1], dense[i]));
  return { coords: dense, offsets: taperOffsets(raw, cum), onBridge: true };
}

export interface DeckFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: LngLat[][] };
  properties: { height: number; base: number };
}

/** One slab per lifted segment of a car line: top at the cars' road height, `DECK_THICKNESS_M` thick, `DECK_WIDTH_M` wide. */
export function deckPolygons(
  line: BridgedLine,
  width = DECK_WIDTH_M,
): DeckFeature[] {
  const out: DeckFeature[] = [];
  const { coords, offsets } = line;
  const kyHalf = width / 2 / 110_574;
  for (let i = 1; i < coords.length; i++) {
    const top = (offsets[i - 1] + offsets[i]) / 2;
    if (!(top > DECK_THICKNESS_M)) continue;
    const a = coords[i - 1],
      b = coords[i];
    const kxHalf = width / 2 / (111_320 * Math.cos((a[1] * Math.PI) / 180));
    const br = (bearingDeg(a, b) * Math.PI) / 180;
    const nx = Math.cos(br) * kxHalf,
      ny = -Math.sin(br) * kyHalf;
    out.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [a[0] - nx, a[1] - ny],
            [b[0] - nx, b[1] - ny],
            [b[0] + nx, b[1] + ny],
            [a[0] + nx, a[1] + ny],
            [a[0] - nx, a[1] - ny],
          ],
        ],
      },
      properties: { height: top, base: top - DECK_THICKNESS_M },
    });
  }
  return out;
}
