/** Pure helpers for the Georgia parking-lot popup: OSM ids, lot geometry, tags, nearest live feed and NWS observation text. */

export type OsmRef = { type: 'node' | 'way' | 'relation'; id: number };

/** OpenFreeMap (OpenMapTiles/Planetiler) POI feature id = OSM id × 10 + 1 node, 2 way, 3 relation. */
export function osmRefFromPoiId(fid: unknown): OsmRef | null {
  const n = typeof fid === 'string' ? Number(fid) : fid;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0) return null;
  const type = ({ 1: 'node', 2: 'way', 3: 'relation' } as const)[n % 10 as 1 | 2 | 3];
  return type ? { type, id: Math.floor(n / 10) } : null;
}

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Area of a closed lon/lat ring in m² (local equirectangular projection; error well under 1% at parking-lot size). */
export function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 4) return 0;
  const lat0 = rad(ring.reduce((s, p) => s + p[1], 0) / ring.length);
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [rad(ring[i][0]) * Math.cos(lat0) * R, rad(ring[i][1]) * R];
    const [x2, y2] = [rad(ring[i + 1][0]) * Math.cos(lat0) * R, rad(ring[i + 1][1]) * R];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string>; timestamp?: string; version?: number; user?: string };

/** Picks the requested element from an OSM API 0.6 `/full.json` or element response and rebuilds a way's ring from its nodes. */
export function parseOsmElement(json: { elements?: OsmElement[] }, ref: OsmRef): { el: OsmElement; ring: [number, number][] | null } | null {
  const els = json.elements ?? [];
  const el = els.find((e) => e.type === ref.type && e.id === ref.id);
  if (!el) return null;
  if (ref.type !== 'way' || !el.nodes) return { el, ring: null };
  const at = new Map(els.filter((e) => e.type === 'node' && typeof e.lat === 'number').map((e) => [e.id, [e.lon!, e.lat!] as [number, number]]));
  const ring = el.nodes.map((id) => at.get(id)).filter((p): p is [number, number] => !!p);
  return { el, ring: ring.length === el.nodes.length && el.nodes[0] === el.nodes[el.nodes.length - 1] ? ring : null };
}

const PARKING_KIND: Record<string, string> = {
  surface: 'surface lot', 'multi-storey': 'multi-storey garage', underground: 'underground garage', rooftop: 'rooftop',
  street_side: 'street-side bays', lane: 'on-street lane', carports: 'carports', garage_boxes: 'garage boxes',
};

/** Human-readable rows for the OSM tags a parking lot can carry; empty values are dropped by the popup. */
export function parkingTagRows(tags: Record<string, string>): [string, string][] {
  const t = (k: string) => tags[k] ?? '';
  const cap = [t('capacity') && `${t('capacity')} spaces`, t('capacity:disabled') && `${t('capacity:disabled')} accessible`, t('capacity:charging') && `${t('capacity:charging')} EV charging`].filter(Boolean).join(' · ');
  return [
    ['Name', t('name')],
    ['Type', PARKING_KIND[t('parking')] ?? t('parking')],
    ['Access', t('access')],
    ['Fee', t('fee') === 'yes' ? `yes${t('charge') ? ` (${t('charge')})` : ''}` : t('fee')],
    ['Mapped capacity', cap],
    ['Levels', t('building:levels') || t('levels')],
    ['Surface', t('surface')],
    ['Operator', t('operator') || t('brand')],
    ['Hours', t('opening_hours')],
    ['Max stay', t('maxstay')],
    ['Park & ride', t('park_ride')],
  ];
}

/** Nearest item within `maxM` metres. */
export function nearest<T extends { lon: number; lat: number }>(items: T[], at: [number, number], maxM = Infinity): { item: T; m: number } | null {
  let best: { item: T; m: number } | null = null;
  for (const item of items) {
    const m = distanceM(at, [item.lon, item.lat]);
    if (m <= maxM && (!best || m < best.m)) best = { item, m };
  }
  return best;
}

export const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1609.344).toFixed(1)} mi`);
export const fmtArea = (m2: number) => `${Math.round(m2).toLocaleString('en-US')} m² (${(m2 / 4046.856).toFixed(2)} acres)`;

type Q = { value: number | null } | undefined;
const val = (q: Q) => (q && typeof q.value === 'number' && Number.isFinite(q.value) ? q.value : null);

/** One-line NWS latest observation (api.weather.gov `/stations/{id}/observations/latest` properties). */
export function nwsObservationText(p: { textDescription?: string; temperature?: Q; windSpeed?: Q; windDirection?: Q; windGust?: Q; relativeHumidity?: Q; visibility?: Q }): string {
  const c = val(p.temperature);
  const ws = val(p.windSpeed);
  const wd = val(p.windDirection);
  const g = val(p.windGust);
  const rh = val(p.relativeHumidity);
  const vis = val(p.visibility);
  return [
    p.textDescription || '',
    c === null ? '' : `${Math.round((c * 9) / 5 + 32)}°F (${c.toFixed(1)}°C)`,
    ws === null ? '' : `wind ${Math.round(ws / 1.609344)} mph${wd === null ? '' : ` from ${Math.round(wd)}°`}${g === null ? '' : `, gusts ${Math.round(g / 1.609344)} mph`}`,
    rh === null ? '' : `humidity ${Math.round(rh)}%`,
    vis === null ? '' : `visibility ${(vis / 1609.344).toFixed(1)} mi`,
  ].filter(Boolean).join(' · ');
}
