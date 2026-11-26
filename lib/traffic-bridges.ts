import { bearingDeg, haversineM, type LngLat } from "./traffic-sim";

/**
 * Deck height per OSM `layer` step, in metres. An ESTIMATE: OSM `layer` is stacking order, not height
 * (https://wiki.openstreetmap.org/wiki/Key:layer), so a deck is drawn up to `layer × 7 m` above the lowest ground under it.
 * 7 m covers FHWA's 16-ft (4.9 m) Interstate vertical clearance (fhwa.dot.gov/design/090415.cfm) plus the 1.2 m deck below.
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
/** Drawn deck width for one carriageway: FHWA Interstate minimum of two 12-ft lanes + 10-ft right + 4-ft left shoulder (fhwa.dot.gov/programadmin/interstate.cfm). */
export const INTERSTATE_DECK_WIDTH_M = (2 * 12 + 10 + 4) * 0.3048;

const CELL_DEG = 0.0005;

export interface BridgeSegment {
  a: LngLat;
  b: LngLat;
  layer: number;
  /** Undirected bearing in [0, 180). */
  axis: number;
  /** Absolute deck top (drawn-terrain metres) at `a` and `b`, set for segments from `deckProfile`. */
  topA?: number;
  topB?: number;
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

/** OSM bridge under a car-line point heading `bearing`: its layer (0 = none) and, for profiled decks, the deck top there. The nearest matching segment wins. */
export function bridgeMatchAt(
  index: BridgeIndex,
  p: LngLat,
  bearing: number,
): { layer: number; top: number | null } {
  if (!index.count) return { layer: 0, top: null };
  const cx = Math.floor(p[0] / CELL_DEG);
  const cy = Math.floor(p[1] / CELL_DEG);
  let best = Infinity;
  let hit: BridgeSegment | null = null;
  for (let x = cx - 1; x <= cx + 1; x++)
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (const s of index.cells.get(cellKey(x, y)) ?? []) {
        if (axisDiff(s.axis, bearing) > MATCH_BEARING_DEG) continue;
        const d = pointSegmentM(p, s.a, s.b);
        if (d <= MATCH_DIST_M && d < best) {
          best = d;
          hit = s;
        }
      }
    }
  if (!hit) return { layer: 0, top: null };
  if (hit.topA === undefined || hit.topB === undefined) return { layer: hit.layer, top: null };
  const t = segmentT(p, hit.a, hit.b);
  return { layer: hit.layer, top: hit.topA + (hit.topB - hit.topA) * t };
}

/** OSM bridge layer under a car-line point heading `bearing`, or 0. */
export function bridgeLayerAt(index: BridgeIndex, p: LngLat, bearing: number): number {
  return bridgeMatchAt(index, p, bearing).layer;
}

/** Position of p's projection along segment ab, clamped to [0, 1]. */
function segmentT(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180), ky = 110_574;
  const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky;
  const len2 = dx * dx + dy * dy;
  return len2 > 0 ? Math.max(0, Math.min(1, (((p[0] - a[0]) * kx) * dx + ((p[1] - a[1]) * ky) * dy) / len2)) : 0;
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
  const hits = dense.map((p, i) => {
    const j = Math.min(i, dense.length - 2);
    return bridgeMatchAt(index, p, bearingDeg(dense[j], dense[j + 1]));
  });
  const layers = hits.map((h) => h.layer);
  if (!layers.some((v) => v > 0)) return flat();
  const cum = [0];
  for (let i = 1; i < dense.length; i++)
    cum.push(cum[i - 1] + haversineM(dense[i - 1], dense[i]));
  const ground = dense.map(groundAt);
  const est = deckOffsets(layers, ground, cum);
  return {
    coords: dense,
    ground,
    layers,
    offsets: hits.map((h, i) => (h.top === null ? est[i] : Math.max(0, h.top - ground[i]))),
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
/** Slabs are flat-topped, so each car-line segment is drawn as ≤ 5 m pieces: on a 6 % ramp the step between pieces stays ≤ 0.3 m. */
export const SLAB_STEP_M = 5;

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

/**
 * MapLibre draws each fill-extrusion on terrain at `terrain(centroid) + height` (flat top). With `groundAt` (the same
 * terrain the map draws, e.g. `map.queryTerrainElevation`), each slab's height is taken from the deck's absolute top
 * minus the ground under its centroid, so overlapping slabs from different lines with the same absolute top render
 * coplanar instead of stepping by the ground difference between their centroids.
 */
function slabs(
  line: BridgedLine,
  width: number,
  props: (top: number) => DeckFeature["properties"],
  groundAt?: (c: LngLat) => number,
  minTop = DECK_THICKNESS_M,
  keep: (i: number) => boolean = (i) => (line.offsets[i - 1] + line.offsets[i]) / 2 > DECK_THICKNESS_M,
): DeckFeature[] {
  const out: DeckFeature[] = [];
  const { coords, offsets, ground } = line;
  if (coords.length < 2) return out;
  const { left, right } = ribbonEdges(coords, width);
  const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 1; i < coords.length; i++) {
    if (!keep(i)) continue;
    const n = Math.max(1, Math.ceil(haversineM(coords[i - 1], coords[i]) / SLAB_STEP_M));
    const absA = ground[i - 1] + offsets[i - 1], absB = ground[i] + offsets[i];
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2;
      const l0 = lerp(left[i - 1], left[i], t0), l1 = lerp(left[i - 1], left[i], t1);
      const r0 = lerp(right[i - 1], right[i], t0), r1 = lerp(right[i - 1], right[i], t1);
      const lift = offsets[i - 1] + (offsets[i] - offsets[i - 1]) * tm;
      const top = groundAt
        ? Math.max(minTop, absA + (absB - absA) * tm - groundAt(lerp(lerp(l0, r0, 0.5), lerp(l1, r1, 0.5), 0.5)))
        : Math.max(minTop, lift);
      out.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[l0, l1, r1, r0, l0]] }, properties: props(top) });
    }
  }
  return out;
}

/** Slabs (≤ `SLAB_STEP_M` long) along each lifted segment of a car line: top at the cars' road height, `DECK_THICKNESS_M` thick, `DECK_WIDTH_M` wide, mitred at bends. */
export function deckPolygons(line: BridgedLine, width = DECK_WIDTH_M, groundAt?: (c: LngLat) => number): DeckFeature[] {
  return slabs(line, width, (top) => ({ height: top, base: top - DECK_THICKNESS_M }), groundAt);
}

/** Thin stripes in the line's TomTom flow colour lying on the deck slabs from `deckPolygons`. */
export function flowStripePolygons(
  line: BridgedLine,
  color: string,
  width = FLOW_STRIPE_WIDTH_M,
  groundAt?: (c: LngLat) => number,
  onMatchedBridge = false,
): DeckFeature[] {
  return slabs(
    line,
    width,
    (top) => ({ height: top + FLOW_STRIPE_THICKNESS_M, base: top, color }),
    groundAt,
    onMatchedBridge ? OSM_DECK_MIN_TOP_M : DECK_THICKNESS_M,
    onMatchedBridge ? (i) => line.layers[i - 1] > 0 && line.layers[i] > 0 : undefined,
  );
}

/** Largest height gap between overlapping decks that is treated as one bridge drawn twice; bigger gaps are separate structures. */
export const SHARED_DECK_MAX_GAP_M = 2.5;

/**
 * Two car lines on one bridge (e.g. one per direction) get their own decks; where those decks overlap (vertices of the
 * same OSM `layer` within `DECK_WIDTH_M`, tops less than `SHARED_DECK_MAX_GAP_M` apart), the lower deck is raised to the
 * higher top so the slabs are coplanar instead of stacked boxes. The raise tapers along the line at `MAX_APPROACH_GRADE`
 * and never lifts a vertex off the bridge, so approaches stay on the ground. Mutates and returns `lines`.
 */
export function levelSharedDecks(lines: BridgedLine[], radiusM = DECK_WIDTH_M, grade = MAX_APPROACH_GRADE): BridgedLine[] {
  const cell = 0.0003;
  const deck = (b: BridgedLine, i: number) => b.onBridge && b.layers[i] > 0 && b.offsets[i] > 0;
  /** Deck segments bucketed by midpoint; segments are ≤ DENSIFY_STEP_M long, so a 3×3 cell search covers `radiusM`. */
  const grid = new Map<string, { line: number; i: number }[]>();
  const key = (c: LngLat, dx = 0, dy = 0) => `${Math.floor(c[0] / cell) + dx},${Math.floor(c[1] / cell) + dy}`;
  lines.forEach((b, line) => {
    for (let i = 1; i < b.coords.length; i++) {
      if (!deck(b, i - 1) || !deck(b, i)) continue;
      const a = b.coords[i - 1], c = b.coords[i];
      const k = key([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k)!.push({ line, i });
    }
  });
  /** Other lines' deck top under point `p` (projected onto their segments), or -Infinity. */
  const topAt = (p: LngLat, line: number, layer: number) => {
    let best = -Infinity;
    const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180), ky = 110_574;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const q of grid.get(key(p, dx, dy)) ?? []) {
          const o = lines[q.line];
          if (q.line === line || o.layers[q.i] !== layer || o.layers[q.i - 1] !== layer) continue;
          const a = o.coords[q.i - 1], c = o.coords[q.i];
          const vx = (c[0] - a[0]) * kx, vy = (c[1] - a[1]) * ky;
          const wx = (p[0] - a[0]) * kx, wy = (p[1] - a[1]) * ky;
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
          if (Math.hypot(wx - t * vx, wy - t * vy) > radiusM) continue;
          const ta = o.ground[q.i - 1] + o.offsets[q.i - 1], tc = o.ground[q.i] + o.offsets[q.i];
          best = Math.max(best, ta + t * (tc - ta));
        }
    return best;
  };
  const next = lines.map((b, line) => {
    if (!b.onBridge) return b.offsets;
    const n = b.coords.length;
    const s = [0];
    for (let i = 1; i < n; i++) s.push(s[i - 1] + haversineM(b.coords[i - 1], b.coords[i]));
    const own = b.offsets.map((o, i) => b.ground[i] + o);
    const target = own.map((top0, i) => {
      if (!deck(b, i)) return top0;
      const other = topAt(b.coords[i], line, b.layers[i]);
      let top = other > top0 && other - top0 <= SHARED_DECK_MAX_GAP_M ? other : top0;
      for (let k = 0; k < n; k++) if (!deck(b, k)) top = Math.min(top, own[k] + grade * Math.abs(s[i] - s[k]));
      return Math.max(top0, top);
    });
    return own.map((top0, i) => {
      if (!deck(b, i)) return b.offsets[i];
      let top = top0;
      for (let j = 0; j < n; j++) if (target[j] > top0) top = Math.max(top, target[j] - grade * Math.abs(s[i] - s[j]));
      return top - b.ground[i];
    });
  });
  lines.forEach((b, line) => (b.offsets = next[line]));
  return lines;
}

/** One OSM road bridge (`brunnel=bridge`) from the OpenFreeMap tiles. OSM asks bridges to carry `layer`; a missing layer is taken as 1. */
export interface BridgeWay {
  coords: LngLat[];
  cls: string;
  layer: number;
}

export function bridgeWays(
  features: Array<{ geometry: { type: string; coordinates?: unknown }; properties?: Record<string, unknown> | null }>,
  classes?: readonly string[],
): BridgeWay[] {
  const out: BridgeWay[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (f.properties?.brunnel !== "bridge") continue;
    const cls = String(f.properties?.class ?? "");
    if (classes && !classes.includes(cls)) continue;
    const raw = f.properties?.layer;
    const layer = raw === undefined || raw === null ? 1 : Number(raw);
    if (!Number.isInteger(layer) || layer < 1) continue;
    const g = f.geometry;
    const parts = (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []) as LngLat[][];
    for (const p of parts) {
      if (p.length < 2) continue;
      const key = `${cls};${layer};` + p.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ coords: p, cls, layer });
    }
  }
  return out;
}

/** Endpoints closer than this to another piece of the same bridge are tile cuts, not abutments. */
export const PIECE_JOIN_M = 3;

/** Distance from p to the polyline, and the segment index and projection of the nearest point. */
function nearestOnLine(p: LngLat, line: LngLat[]): { d: number; i: number; t: number } {
  let best = { d: Infinity, i: 0, t: 0 };
  for (let i = 1; i < line.length; i++) {
    const d = pointSegmentM(p, line[i - 1], line[i]);
    if (d < best.d) best = { d, i, t: segmentT(p, line[i - 1], line[i]) };
  }
  return best;
}

/**
 * Vector tiles cut a bridge that crosses a tile edge into overlapping pieces, so a cut end would be taken for an
 * abutment in the middle of the span. Pieces of the same class and layer whose end lies on another piece are joined
 * (the first piece, then the rest of the second beyond that end); a piece lying entirely on another is dropped.
 */
export function mergeBridgeWays(ways: BridgeWay[], joinM = PIECE_JOIN_M): BridgeWay[] {
  const list = ways.map((w) => ({ ...w, coords: w.coords.slice() }));
  const len = (c: LngLat[]) => c.reduce((s, v, i) => (i ? s + haversineM(c[i - 1], v) : 0), 0);
  const pad = joinM / 90_000;
  const box = (c: LngLat[]) => c.reduce((b, v) => [Math.min(b[0], v[0]), Math.min(b[1], v[1]), Math.max(b[2], v[0]), Math.max(b[3], v[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const near = (a: number[], b: number[]) => a[0] - pad <= b[2] && b[0] - pad <= a[2] && a[1] - pad <= b[3] && b[1] - pad <= a[3];
  for (let changed = true; changed; ) {
    changed = false;
    const boxes = list.map((w) => box(w.coords));
    outer: for (let a = 0; a < list.length; a++)
      for (let b = 0; b < list.length; b++) {
        if (a === b || list[a].cls !== list[b].cls || list[a].layer !== list[b].layer || !near(boxes[a], boxes[b])) continue;
        const A = list[a].coords, B = list[b].coords;
        if (A.every((p) => nearestOnLine(p, B).d <= joinM) && len(A) <= len(B)) {
          list.splice(a, 1);
          changed = true;
          break outer;
        }
        for (const rev of [false, true]) {
          const B2 = rev ? B.slice().reverse() : B;
          const end = A[A.length - 1];
          const hit = nearestOnLine(end, B2);
          if (hit.d > joinM || nearestOnLine(B2[0], A).d > joinM || hit.i >= B2.length) continue;
          const merged = [...A, ...B2.slice(hit.i)];
          list[a] = { ...list[a], coords: merged };
          list.splice(b, 1);
          changed = true;
          break outer;
        }
      }
  }
  return list;
}

/** Deck profile of one OSM bridge way: abutments at its ends, `deckOffsets` between (chord, ≤ layer × BRIDGE_LAYER_M over the lowest ground, 6 % ramps). */
export function deckProfile(way: BridgeWay, groundAt: (c: LngLat) => number = () => 0, step = 10): BridgedLine {
  const coords = densify(way.coords, step);
  const ground = coords.map(groundAt);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineM(coords[i - 1], coords[i]));
  const layers = coords.map(() => way.layer);
  return { coords, ground, layers, offsets: deckOffsets(layers, ground, cum), onBridge: true };
}

/** Bridge index whose segments carry the profiled deck tops, so car lines ride on the same deck that is drawn. */
export function profiledBridgeIndex(profiles: BridgedLine[]): BridgeIndex {
  const segs: BridgeSegment[] = [];
  for (const p of profiles)
    for (let i = 1; i < p.coords.length; i++)
      segs.push({
        a: p.coords[i - 1],
        b: p.coords[i],
        layer: p.layers[i],
        axis: bearingDeg(p.coords[i - 1], p.coords[i]) % 180,
        topA: p.ground[i - 1] + p.offsets[i - 1],
        topB: p.ground[i] + p.offsets[i],
      });
  return buildBridgeIndex(segs);
}

/** Lowest drawn deck top over the ground, so the deck at an abutment still shows above the draped road it replaces. */
export const OSM_DECK_MIN_TOP_M = 0.3;

/** Slabs along a whole OSM bridge way (abutment to abutment), `width` metres wide, in the road's colour. */
export function osmDeckPolygons(line: BridgedLine, width: number, color: string, groundAt?: (c: LngLat) => number): DeckFeature[] {
  return slabs(
    line,
    width,
    (top) => ({ height: top, base: Math.max(0, top - DECK_THICKNESS_M), color }),
    groundAt,
    OSM_DECK_MIN_TOP_M,
    () => true,
  );
}

/** Parts of a car line off any matched OSM bridge, for the draped flow line; bridge spans get deck stripes (`flowStripePolygons(..., true)`). */
export function groundRuns(line: BridgedLine): LngLat[][] {
  const out: LngLat[][] = [];
  let run: LngLat[] = [];
  line.coords.forEach((c, i) => {
    if (!(line.layers[i] > 0)) run.push(c);
    else {
      if (run.length > 1) out.push(run);
      run = [];
    }
  });
  if (run.length > 1) out.push(run);
  return out;
}
