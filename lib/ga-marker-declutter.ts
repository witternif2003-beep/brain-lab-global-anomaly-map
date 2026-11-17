/** One on-screen marker competing for space; `keep` markers are always placed (they still block others). */
export interface DeclutterCandidate<T> {
  item: T;
  x: number;
  y: number;
  /** Half the marker's on-screen width in CSS pixels. */
  half: number;
  keep?: boolean;
}

const CELL_PX = 32;

/**
 * Screen-space marker declutter. Candidates are placed in the order given (caller sorts by priority, highest first),
 * `keep` ones first. A marker is dropped when its square box overlaps an already-placed box by more than `overlap`
 * of their combined half-widths along both axes (0 = no overlap allowed).
 */
export function declutterMarkers<T>(candidates: DeclutterCandidate<T>[], overlap = 0.25): Set<T> {
  const grid = new Map<string, [number, number, number][]>();
  const shown = new Set<T>();
  const ordered = [...candidates.filter((c) => c.keep), ...candidates.filter((c) => !c.keep)];
  let maxHalf = 0;
  for (const c of ordered) {
    const cx = Math.floor(c.x / CELL_PX);
    const cy = Math.floor(c.y / CELL_PX);
    if (!c.keep) {
      const reach = Math.ceil((c.half + maxHalf) / CELL_PX);
      let hit = false;
      for (let gx = cx - reach; gx <= cx + reach && !hit; gx++) {
        for (let gy = cy - reach; gy <= cy + reach && !hit; gy++) {
          for (const [bx, by, bh] of grid.get(`${gx}:${gy}`) ?? []) {
            const min = (c.half + bh) * (1 - overlap);
            if (Math.abs(bx - c.x) < min && Math.abs(by - c.y) < min) { hit = true; break; }
          }
        }
      }
      if (hit) continue;
    }
    const key = `${cx}:${cy}`;
    const list = grid.get(key);
    if (list) list.push([c.x, c.y, c.half]);
    else grid.set(key, [[c.x, c.y, c.half]]);
    if (c.half > maxHalf) maxHalf = c.half;
    shown.add(c.item);
  }
  return shown;
}

/** True when a screen rect [x0, y0, x1, y1] lies wholly inside a w×h viewport, so its label is never cut by the screen edge. */
export function fitsViewport(rect: readonly [number, number, number, number], w: number, h: number): boolean {
  return rect[0] >= 0 && rect[1] >= 0 && rect[2] <= w && rect[3] <= h;
}
