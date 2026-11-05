import { bearingDeg, haversineM, type LngLat } from "./traffic-sim";

/**
 * Deck height per OSM `layer` step, in metres. An ESTIMATE: OSM `layer` is stacking order, not height
 * (https://wiki.openstreetmap.org/wiki/Key:layer), so a deck is drawn up to `layer × 7 m` above the lowest ground under it.
 */
export const BRIDGE_LAYER_M = 7;
/** Steepest climb from an abutment onto a deck (6 %), so cars ramp up instead of jumping. An assumption, not survey data. */
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

/**
 * Deck heights above the ground, per vertex. A bridge run (consecutive vertices with `layers[i] > 0`) rests on
 * abutments at the ground just outside it. Its profile is the highest line that stays at or below
 * `lowest ground under the run + layer × BRIDGE_LAYER_M` and climbs from each abutment at ≤ `grade`, but never
 * below the straight chord between the abutments (a span over a valley stays level with its ends).
 * Off a run the offset is 0, so cars on the approach roads stay on the road.
 */
export function deckOffsets(
  layers: number[],
  ground: number[],
  cum: number[],
  grade = MAX_APPROACH_GRADE,
): number[] {
  const n = layers.length;
  const off = new Array<number>(n).fill(0);
  for (let i0 = 0; i0 < n; ) {
    if (!(layers[i0] > 0)) {
      i0++;
      continue;
    }
    let i1 = i0;
    while (i1 + 1 < n && layers[i1 + 1] > 0) i1++;
    const a = Math.max(0, i0 - 1),
      b = Math.min(n - 1, i1 + 1);
    let low = Infinity;
    for (let i = i0; i <= i1; i++) low = Math.min(low, ground[i]);
    const p: number[] = [];
    for (let i = a; i <= b; i++)
      p.push(i < i0 || i > i1 ? ground[i] : low + layers[i] * BRIDGE_LAYER_M);
    if (a === i0) p[0] = ground[a];
    if (b === i1) p[p.length - 1] = ground[b];
    for (let k = 1; k < p.length; k++)
      p[k] = Math.min(p[k], p[k - 1] + grade * (cum[a + k] - cum[a + k - 1]));
    for (let k = p.length - 2; k >= 0; k--)
      p[k] = Math.min(p[k], p[k + 1] + grade * (cum[a + k + 1] - cum[a + k]));
    const span = cum[b] - cum[a];
    for (let i = i0; i <= i1; i++) {
      const chord =
        span > 0
          ? ground[a] + ((ground[b] - ground[a]) * (cum[i] - cum[a])) / span
          : ground[a];
      off[i] = Math.max(0, Math.max(chord, p[i - a]) - ground[i]);
    }
    i0 = i1 + 1;
  }
  return off;
}

export interface BridgedLine {
  coords: LngLat[];
  /** Ground height per vertex from `groundAt` (the map's drawn terrain). */
  ground: number[];
  /** Matched OSM bridge `layer` per vertex, 0 off a bridge. */
  layers: number[];
  /** Metres above `ground` per vertex, from `deckOffsets`; 0 off a bridge. */
  offsets: number[];
  onBridge: boolean;
}

/** Lifts a car line where it runs along an OSM bridge; lines that touch no bridge come back unchanged with zero offsets. */
export function bridgeLine(
  index: BridgeIndex,
  coords: LngLat[],
  groundAt: (c: LngLat) => number = () => 0,
): BridgedLine {
  const flat = (): BridgedLine => ({
    coords,
    ground: coords.map(groundAt),
    layers: coords.map(() => 0),
    offsets: coords.map(() => 0),
    onBridge: false,
  });
  if (!index.count || coords.length < 2) return flat();
  const dense = densify(coords);
  const layers = dense.map((p, i) => {
    const j = Math.min(i, dense.length - 2);
    return bridgeLayerAt(index, p, bearingDeg(dense[j], dense[j + 1]));
  });
  if (!layers.some((v) => v > 0)) return flat();
  const cum = [0];
  for (let i = 1; i < dense.length; i++)
    cum.push(cum[i - 1] + haversineM(dense[i - 1], dense[i]));
  const ground = dense.map(groundAt);
  return {
    coords: dense,
    ground,
    layers,
    offsets: deckOffsets(layers, ground, cum),
    onBridge: true,
  };
}

export interface DeckFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: LngLat[][] };
  /** `color` is set on flow stripes only; slabs fall back to the deck grey. */
  properties: { height: number; base: number; color?: string };
}

/** TomTom flow colour stripe on top of each deck slab, so the live flow layer stays visible on the bridge (the flat line layer drapes onto the ground below). */
export const FLOW_STRIPE_WIDTH_M = 3;
export const FLOW_STRIPE_THICKNESS_M = 0.05;

/**
 * Left/right edge points per vertex, offset by `width / 2` along the mitred vertex normal, so consecutive slabs share
 * their joint edge instead of leaving wedge gaps (or overlaps) at bends. The mitre is capped at 2× for sharp turns.
 */
export function ribbonEdges(coords: LngLat[], width: number): { left: LngLat[]; right: LngLat[] } {
  const half = width / 2;
  const kx = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);
  const normals: [number, number][] = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const dx = (b[0] - a[0]) * kx(a[1]), dy = (b[1] - a[1]) * 110_574;
    const len = Math.hypot(dx, dy) || 1;
    normals.push([-dy / len, dx / len]);
  }
  const left: LngLat[] = [], right: LngLat[] = [];
  for (let i = 0; i < coords.length; i++) {
    const n0 = normals[Math.max(0, i - 1)], n1 = normals[Math.min(normals.length - 1, i)];
    let nx = n0[0] + n1[0], ny = n0[1] + n1[1];
    const nl = Math.hypot(nx, ny);
    if (nl < 1e-9) [nx, ny] = n1;
    else [nx, ny] = [nx / nl, ny / nl];
    const miter = half / Math.max(0.5, nx * n1[0] + ny * n1[1]);
    const [lng, lat] = coords[i];
    const ox = (nx * miter) / kx(lat), oy = (ny * miter) / 110_574;
    left.push([lng + ox, lat + oy]);
    right.push([lng - ox, lat - oy]);
  }
  return { left, right };
}

function slabs(line: BridgedLine, width: number, props: (top: number) => DeckFeature["properties"]): DeckFeature[] {
  const out: DeckFeature[] = [];
  const { coords, offsets } = line;
  if (coords.length < 2) return out;
  const { left, right } = ribbonEdges(coords, width);
  for (let i = 1; i < coords.length; i++) {
    const top = (offsets[i - 1] + offsets[i]) / 2;
    if (!(top > DECK_THICKNESS_M)) continue;
    out.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[left[i - 1], left[i], right[i], right[i - 1], left[i - 1]]] },
      properties: props(top),
    });
  }
  return out;
}

/** One slab per lifted segment of a car line: top at the cars' road height, `DECK_THICKNESS_M` thick, `DECK_WIDTH_M` wide, mitred at bends. */
export function deckPolygons(line: BridgedLine, width = DECK_WIDTH_M): DeckFeature[] {
  return slabs(line, width, (top) => ({ height: top, base: top - DECK_THICKNESS_M }));
}

/** Thin stripes in the line's TomTom flow colour lying on the deck slabs from `deckPolygons`. */
export function flowStripePolygons(line: BridgedLine, color: string, width = FLOW_STRIPE_WIDTH_M): DeckFeature[] {
  return slabs(line, width, (top) => ({ height: top + FLOW_STRIPE_THICKNESS_M, base: top, color }));
}
