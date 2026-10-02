import { cellToBoundary, latLngToCell } from "h3-js";

export const K_MIN = 5;
export const H3_RESOLUTIONS = [7, 8] as const;
const TZ = "America/New_York";

export interface IncidentPoint {
  reportedAt: number;
  category: string;
  against: string;
  lat: number;
  lng: number;
}

export interface HexCell {
  h3: string;
  resolution: number;
  count: number;
  topCategory: string;
  topCategoryCount: number;
}

export interface Aggregate {
  incidents: number;
  cells: Record<string, HexCell[]>;
  suppressed: Record<string, { cells: number; incidents: number }>;
  byHour: number[];
  byWeekday: number[];
  byDay: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byAgainst: { against: string; count: number }[];
}

const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tally(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sorted(map: Map<string, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function aggregate(points: IncidentPoint[], k = K_MIN): Aggregate {
  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  const byDay = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byAgainst = new Map<string, number>();
  const hex = new Map<number, Map<string, Map<string, number>>>(H3_RESOLUTIONS.map((r) => [r, new Map()]));

  for (const p of points) {
    const d = new Date(p.reportedAt);
    byHour[Number(hourFmt.format(d)) % 24]++;
    byWeekday[WEEKDAYS.indexOf(weekdayFmt.format(d))]++;
    tally(byDay, dateFmt.format(d));
    tally(byCategory, p.category);
    tally(byAgainst, p.against);
    for (const r of H3_RESOLUTIONS) {
      const id = latLngToCell(p.lat, p.lng, r);
      const cats = hex.get(r)!;
      const c = cats.get(id) ?? new Map<string, number>();
      tally(c, p.category);
      cats.set(id, c);
    }
  }

  const cells: Aggregate["cells"] = {};
  const suppressed: Aggregate["suppressed"] = {};
  for (const r of H3_RESOLUTIONS) {
    const out: HexCell[] = [];
    const sup = { cells: 0, incidents: 0 };
    for (const [id, cats] of hex.get(r)!) {
      const count = [...cats.values()].reduce((a, b) => a + b, 0);
      if (count < k) {
        sup.cells++;
        sup.incidents += count;
        continue;
      }
      const [top] = sorted(cats);
      // Category counts below k are not disclosed for a cell.
      const topOk = top[1] >= k;
      out.push({ h3: id, resolution: r, count, topCategory: topOk ? top[0] : "mixed", topCategoryCount: topOk ? top[1] : 0 });
    }
    cells[r] = out.sort((a, b) => b.count - a.count);
    suppressed[r] = sup;
  }

  return {
    incidents: points.length,
    cells,
    suppressed,
    byHour,
    byWeekday,
    byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
    byCategory: sorted(byCategory).map(([category, count]) => ({ category, count })),
    byAgainst: sorted(byAgainst).map(([against, count]) => ({ against, count })),
  };
}

export function cellsToGeoJSON(cells: HexCell[]) {
  return {
    type: "FeatureCollection" as const,
    features: cells.map((c) => {
      return {
        type: "Feature" as const,
        properties: { ...c },
        geometry: { type: "Polygon" as const, coordinates: [cellToBoundary(c.h3, true)] },
      };
    }),
  };
}
