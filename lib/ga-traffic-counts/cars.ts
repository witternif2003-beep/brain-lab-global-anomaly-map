export type LngLat = [number, number];

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320;
const MPH_TO_MPS = 0.44704;
/** Car icon length plus a gap: icons closer than this would overlap, so denser measured flow is drawn at this spacing. */
export const MIN_CAR_SPACING_M = 9;
export const CAR_PATH_HALF_M = 300;

type XY = [number, number];
/** A mapped road line; `oneway` follows OpenMapTiles: 1 = drawn direction only, -1 = against drawn direction, otherwise two-way. */
export interface RoadLine { coords: LngLat[]; oneway?: number | null; cls?: string | null }

function offsetM(station: LngLat, coords: LngLat[]): number {
  let best = Infinity;
  const xy = coords.map((p) => toXY(station, p));
  for (let i = 0; i + 1 < xy.length; i++) {
    const [a, b] = [xy[i], xy[i + 1]];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return best;
}
const toXY = (o: LngLat, p: LngLat): XY => [(p[0] - o[0]) * M_PER_DEG_LON * Math.cos((o[1] * Math.PI) / 180), (p[1] - o[1]) * M_PER_DEG_LAT];
const toLngLat = (o: LngLat, [x, y]: XY): LngLat => [o[0] + x / (M_PER_DEG_LON * Math.cos((o[1] * Math.PI) / 180)), o[1] + y / M_PER_DEG_LAT];
const bearingOf = (a: XY, b: XY) => ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Measured density for one direction: metres between vehicles = speed / flow (veh/h ÷ mph), across all lanes. */
export function carSpacingM(vph: number, mph: number | null): { spacingM: number; vehiclesPerIcon: number } | null {
  if (!(vph > 0) || !mph || !(mph > 0)) return null;
  const real = (mph * MPH_TO_MPS * 3600) / vph;
  return real >= MIN_CAR_SPACING_M ? { spacingM: real, vehiclesPerIcon: 1 } : { spacingM: MIN_CAR_SPACING_M, vehiclesPerIcon: MIN_CAR_SPACING_M / real };
}

interface RoadMatch { pts: XY[]; seg: number; t: number }

/**
 * The mapped road line through a station for one travel bearing, oriented with traffic.
 * A line qualifies when its nearest segment is within maxOffM of the station and runs within 60° of the bearing;
 * two-way lines may run either way (reversed if opposite), one-way carriageways only with traffic.
 * Only lines of the same road class as the line nearest the station count, so a station on a motorway never borrows a side street.
 */
function matchRoad(station: LngLat, bearing: number, lines: RoadLine[], maxOffM: number): RoadMatch | null {
  let best: { xy: XY[]; seg: number; t: number; score: number; reverse: boolean } | null = null;
  const nearest = lines.reduce<{ off: number; cls: string | null }>((acc, l) => {
    const off = offsetM(station, l.coords);
    return off < acc.off ? { off, cls: l.cls ?? null } : acc;
  }, { off: Infinity, cls: null });
  for (const line of lines) {
    if (nearest.cls && line.cls && line.cls !== nearest.cls) continue;
    const coords = line.oneway === -1 ? [...line.coords].reverse() : line.coords;
    const xy = coords.map((p) => toXY(station, p));
    for (let i = 0; i + 1 < xy.length; i++) {
      const [a, b] = [xy[i], xy[i + 1]];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      if (!len2) continue;
      const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2));
      const off = Math.hypot(a[0] + t * dx, a[1] + t * dy);
      if (off > maxOffM) continue;
      const diff = angleDiff(bearingOf(a, b), bearing);
      const oneway = line.oneway === 1 || line.oneway === -1;
      const along = oneway ? diff : Math.min(diff, 180 - diff);
      if (along > 60) continue;
      const score = off + along;
      if (!best || score < best.score) best = { xy, seg: i, t, score, reverse: diff > 90 };
    }
  }
  if (!best) return null;
  if (!best.reverse) return { pts: best.xy, seg: best.seg, t: best.t };
  return { pts: [...best.xy].reverse(), seg: best.xy.length - 2 - best.seg, t: 1 - best.t };
}

/** Direction of travel of the matched road at the station (degrees from north), or null when no road matches. */
export function roadHeadingAt(station: LngLat, bearing: number, lines: RoadLine[], maxOffM = 80): number | null {
  const m = matchRoad(station, bearing, lines, maxOffM);
  return m ? bearingOf(m.pts[m.seg], m.pts[m.seg + 1]) : null;
}

/** ±halfM of the matched road line through the station, oriented with traffic (see matchRoad). */
export function roadPathFor(station: LngLat, bearing: number, lines: RoadLine[], halfM = CAR_PATH_HALF_M, maxOffM = 80): LngLat[] | null {
  const m = matchRoad(station, bearing, lines, maxOffM);
  if (!m) return null;
  const { pts, seg, t } = m;
  const a = pts[seg], b = pts[seg + 1];
  const mid: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  const walk = (step: -1 | 1): XY[] => {
    const out: XY[] = [mid];
    let left = halfM;
    for (let i = step < 0 ? seg : seg + 1; i >= 0 && i < pts.length && left > 0; i += step) {
      const prev = out[out.length - 1];
      const d = Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1]);
      const f = d > left ? left / d : 1;
      out.push([prev[0] + f * (pts[i][0] - prev[0]), prev[1] + f * (pts[i][1] - prev[1])]);
      left -= d;
    }
    return out;
  };
  const back = walk(-1);
  const fwd = walk(1);
  const path = [...back.reverse(), ...fwd.slice(1)].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
  return path.length >= 2 ? path.map((p) => toLngLat(station, p)) : null;
}

/** Car positions and headings along a path at time tS: evenly spaced, advancing at the measured speed (still when speed is unknown). */
export function carsAlong(path: LngLat[], spacingM: number, mph: number | null, tS: number): { at: LngLat; heading: number }[] {
  const o = path[0];
  const xy = path.map((p) => toXY(o, p));
  const seg = xy.slice(1).map((b, i) => Math.hypot(b[0] - xy[i][0], b[1] - xy[i][1]));
  const total = seg.reduce((s, l) => s + l, 0);
  if (!(total > 0) || !(spacingM > 0)) return [];
  const shift = mph && mph > 0 ? (tS * mph * MPH_TO_MPS) % spacingM : 0;
  const out: { at: LngLat; heading: number }[] = [];
  let i = 0, start = 0;
  for (let d = shift; d < total; d += spacingM) {
    while (i < seg.length - 1 && start + seg[i] < d) start += seg[i++];
    const f = seg[i] ? (d - start) / seg[i] : 0;
    const a = xy[i], b = xy[i + 1];
    out.push({ at: toLngLat(o, [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]), heading: bearingOf(a, b) });
  }
  return out;
}
