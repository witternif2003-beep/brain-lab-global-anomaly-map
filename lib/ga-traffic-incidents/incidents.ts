import type { ExpressionSpecification } from 'maplibre-gl';

export const TOMTOM_INCIDENT_DETAILS_DOCS_URL = 'https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details';
export const TOMTOM_INCIDENT_TILES_DOCS_URL = 'https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/vector-incident-tiles';
export const INCIDENT_TILE_PATH = '/api/traffic/incidents/{z}/{x}/{y}';
export const INCIDENT_POI_LAYER = 'Traffic incident POI';
export const INCIDENT_LINE_LAYER = 'Traffic incident flow';
export const INCIDENT_CACHE_S = 120;
/** Incident Details rejects a bbox over 10,000 km²; cells target 9,500 km² for margin. */
export const INCIDENT_MAX_BBOX_KM2 = 10_000;
export const INCIDENT_CELL_KM2 = 9_500;
export const INCIDENT_MAX_CELLS = 48;

export type BBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];
export const GA_INCIDENT_BBOX: BBox = [-85.6, 30.3, -80.8, 35.0];

/** TomTom icon_category values (vector incident tiles and Incident Details share them). */
export const INCIDENT_CATEGORIES: Record<number, string> = {
  0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain', 5: 'Ice', 6: 'Jam', 7: 'Lane closed',
  8: 'Road closed', 9: 'Road works', 10: 'Wind', 11: 'Flooding', 13: 'Several incidents', 14: 'Broken down vehicle',
};

export type IncidentIcon = 'accident' | 'roadworks' | 'closed' | 'lane' | 'jam' | 'weather' | 'breakdown' | 'cluster' | 'unknown';
export const INCIDENT_ICON_GROUPS: ReadonlyArray<{ icon: IncidentIcon; cats: number[]; color: string; label: string }> = [
  { icon: 'accident', cats: [1], color: '#ef4444', label: 'accident' },
  { icon: 'roadworks', cats: [9], color: '#f97316', label: 'road works' },
  { icon: 'closed', cats: [8], color: '#7f1d1d', label: 'road closed' },
  { icon: 'lane', cats: [7], color: '#fb923c', label: 'lane closed' },
  { icon: 'jam', cats: [6], color: '#dc2626', label: 'jam' },
  { icon: 'weather', cats: [2, 3, 4, 5, 10, 11], color: '#38bdf8', label: 'weather / hazard' },
  { icon: 'breakdown', cats: [14], color: '#facc15', label: 'broken-down vehicle' },
  { icon: 'cluster', cats: [13], color: '#ff4fd8', label: 'several incidents' },
];
export const incidentImageId = (icon: IncidentIcon) => `ga-inc-${icon}`;

export function incidentIcon(category: number | null | undefined): IncidentIcon {
  return INCIDENT_ICON_GROUPS.find((g) => g.cats.includes(Number(category)))?.icon ?? 'unknown';
}

/** Tiles tag single incidents with icon_category_0 and clusters with icon_category. */
const TILE_CATEGORY = ['to-number', ['coalesce', ['get', 'icon_category_0'], ['get', 'icon_category'], 0]] as ExpressionSpecification;
export const INCIDENT_ICON_EXPRESSION = [
  'match', TILE_CATEGORY,
  ...INCIDENT_ICON_GROUPS.flatMap((g) => [g.cats.length === 1 ? g.cats[0] : g.cats, incidentImageId(g.icon)]),
  incidentImageId('unknown'),
] as ExpressionSpecification;

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Exact spherical area of a lon/lat box. */
export function bboxAreaKm2([w, s, e, n]: BBox): number {
  return R_KM * R_KM * rad(e - w) * Math.abs(Math.sin(rad(n)) - Math.sin(rad(s)));
}

/** Fewest equal cells (nx × ny) whose largest cell (the one nearest the equator) is under maxKm2. */
export function subdivideBbox(b: BBox, maxKm2 = INCIDENT_CELL_KM2, maxCells = INCIDENT_MAX_CELLS): BBox[] {
  const [w, s, e, n] = b;
  let best: [number, number] | null = null;
  for (let nx = 1; nx <= maxCells; nx++) {
    for (let ny = 1; nx * ny <= maxCells; ny++) {
      const dLat = (n - s) / ny;
      const lowest = Math.abs(s) < Math.abs(n) ? s : n - dLat;
      if (bboxAreaKm2([w, lowest, w + (e - w) / nx, lowest + dLat]) <= maxKm2) {
        if (!best || nx * ny < best[0] * best[1]) best = [nx, ny];
        break;
      }
    }
  }
  if (!best) throw new Error(`bbox needs more than ${maxCells} cells`);
  const [nx, ny] = best;
  const cells: BBox[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    cells.push([w + ((e - w) * i) / nx, s + ((n - s) * j) / ny, w + ((e - w) * (i + 1)) / nx, s + ((n - s) * (j + 1)) / ny]);
  }
  return cells;
}

export function parseBbox(q: string): BBox | null {
  const v = q.split(',').map(Number);
  if (v.length !== 4 || !v.every(Number.isFinite)) return null;
  const [w, s, e, n] = v;
  return w < e && s < n && w >= -180 && e <= 180 && s >= -90 && n <= 90 ? [w, s, e, n] : null;
}

/** Intersection with `to`, or null when they don't overlap. */
export function clampBbox([w, s, e, n]: BBox, to: BBox = GA_INCIDENT_BBOX): BBox | null {
  const c: BBox = [Math.max(w, to[0]), Math.max(s, to[1]), Math.min(e, to[2]), Math.min(n, to[3])];
  return c[0] < c[2] && c[1] < c[3] ? c : null;
}

const FIELDS = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity,lastReportTime}}}';

export function incidentDetailsUrl(b: BBox, key: string): string {
  const q = new URLSearchParams({ key, bbox: b.map((v) => v.toFixed(5)).join(','), fields: FIELDS, language: 'en-US', timeValidityFilter: 'present' });
  return `https://api.tomtom.com/traffic/services/5/incidentDetails?${q}`;
}

export function tomtomIncidentTileUrl(z: number, x: number, y: number, key: string): string {
  return `https://api.tomtom.com/traffic/map/4/tile/incidents/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}`;
}

export const MAGNITUDE: Record<number, string> = { 0: 'unknown', 1: 'minor', 2: 'moderate', 3: 'major', 4: 'undefined (closure)' };

interface RawIncident {
  type?: string;
  geometry?: { type: string; coordinates: unknown };
  properties?: {
    id?: string; iconCategory?: number; magnitudeOfDelay?: number; events?: Array<{ description?: string; code?: number }>;
    startTime?: string | null; endTime?: string | null; from?: string | null; to?: string | null; length?: number; delay?: number | null;
    roadNumbers?: string[]; timeValidity?: string; lastReportTime?: string | null;
  };
}

/** Merges per-cell Incident Details responses into one FeatureCollection, de-duplicated by TomTom incident id. */
export function mergeIncidents(responses: Array<{ incidents?: RawIncident[] }>): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const r of responses) for (const inc of r.incidents ?? []) {
    const p = inc.properties ?? {};
    const g = inc.geometry;
    if (!g || (g.type !== 'Point' && g.type !== 'LineString')) continue;
    const id = p.id ?? JSON.stringify(g.coordinates);
    if (seen.has(id)) continue;
    seen.add(id);
    const cat = Number(p.iconCategory ?? 0);
    features.push({
      type: 'Feature',
      id,
      geometry: g as GeoJSON.Point | GeoJSON.LineString,
      properties: {
        id, iconCategory: cat, category: INCIDENT_CATEGORIES[cat] ?? 'Unknown', icon: incidentIcon(cat),
        magnitudeOfDelay: p.magnitudeOfDelay ?? 0, description: p.events?.map((e) => e.description).filter(Boolean).join('; ') ?? '',
        delayS: p.delay ?? null, lengthM: p.length ?? null, from: p.from ?? null, to: p.to ?? null, roadNumbers: (p.roadNumbers ?? []).join(', '),
        startTime: p.startTime ?? null, endTime: p.endTime ?? null, lastReportTime: p.lastReportTime ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
