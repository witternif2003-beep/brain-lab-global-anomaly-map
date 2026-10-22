/** NOAA HRRR pressure-level cloud cover (via Open-Meteo) → 3D cloud columns with model base and top heights above ground (pure). */

export const MODEL_LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 500, 400, 300, 250, 200];
export const MODEL_GRID_DEG = 0.5;
export const MODEL_GRID = { latMin: 30.5, latMax: 35, lngMin: -85.5, lngMax: -81 };
export const MODEL_CLOUD_MIN_COVER = 20;

export interface OpenMeteoPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  hourly?: { time?: string[] } & Record<string, (number | null)[] | string[] | undefined>;
}

export interface ModelCloudLayer { baseM: number; topM: number; maxCover: number; baseHpa: number; topHpa: number }

export function modelGrid(): [number, number][] {
  const pts: [number, number][] = [];
  for (let lat = MODEL_GRID.latMin; lat <= MODEL_GRID.latMax + 1e-9; lat += MODEL_GRID_DEG) {
    for (let lng = MODEL_GRID.lngMin; lng <= MODEL_GRID.lngMax + 1e-9; lng += MODEL_GRID_DEG) pts.push([+lat.toFixed(3), +lng.toFixed(3)]);
  }
  return pts;
}

/** Index of the latest hourly step at or before `now` (Open-Meteo GMT times carry no zone suffix). */
export function hourIndex(times: string[], now: Date): number {
  let idx = -1;
  times.forEach((t, i) => {
    if (Date.parse(`${t}Z`) <= now.getTime()) idx = i;
  });
  return idx;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Each pressure level's cloud cover fills the slab between the midpoints to its neighbouring levels;
 * consecutive cloudy levels merge into one layer. Heights are geopotential (MSL) minus model ground elevation.
 */
export function modelCloudLayers(p: OpenMeteoPoint, idx: number, minCover = MODEL_CLOUD_MIN_COVER): ModelCloudLayer[] {
  const h = p.hourly;
  if (!h || idx < 0) return [];
  const ground = num(p.elevation) ?? 0;
  const lv = MODEL_LEVELS_HPA.map((hpa) => ({
    hpa,
    cover: num(h[`cloud_cover_${hpa}hPa`]?.[idx]),
    z: num(h[`geopotential_height_${hpa}hPa`]?.[idx]),
  })).filter((l): l is { hpa: number; cover: number; z: number } => l.cover !== null && l.z !== null && l.z > ground);
  const layers: ModelCloudLayer[] = [];
  let cur: ModelCloudLayer | null = null;
  lv.forEach((l, i) => {
    const below = i > 0 ? (lv[i - 1].z + l.z) / 2 : Math.max(ground, l.z - ((lv[i + 1]?.z ?? l.z) - l.z) / 2);
    const above = i < lv.length - 1 ? (l.z + lv[i + 1].z) / 2 : l.z + (l.z - (lv[i - 1]?.z ?? l.z)) / 2;
    if (l.cover >= minCover) {
      const baseM = Math.max(0, Math.round(below - ground));
      const topM = Math.round(above - ground);
      if (cur) {
        cur.topM = topM;
        cur.topHpa = l.hpa;
        cur.maxCover = Math.max(cur.maxCover, l.cover);
      } else {
        cur = { baseM, topM, maxCover: l.cover, baseHpa: l.hpa, topHpa: l.hpa };
        layers.push(cur);
      }
    } else {
      cur = null;
    }
  });
  return layers;
}

const coverBand = (c: number) => (c >= 80 ? 'high' : c >= 50 ? 'mid' : 'low');

export function modelCloudCells(points: OpenMeteoPoint[], now: Date, cellDeg = MODEL_GRID_DEG * 0.92): {
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  validTime: string | null;
} {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  let validTime: string | null = null;
  const d = cellDeg / 2;
  for (const p of points) {
    const idx = hourIndex(p.hourly?.time ?? [], now);
    if (idx < 0) continue;
    validTime ??= `${p.hourly?.time?.[idx]}Z`;
    const { latitude: lat, longitude: lng } = p;
    const ring: [number, number][] = [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
    for (const l of modelCloudLayers(p, idx)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { ...l, band: coverBand(l.maxCover), lat: +lat.toFixed(3), lng: +lng.toFixed(3) },
      });
    }
  }
  return { geojson: { type: 'FeatureCollection', features }, validTime };
}

/** Replace a METAR slab's placeholder top with the top of the model layer that contains its measured base. */
export function refineMetarTops(
  metar: GeoJSON.FeatureCollection<GeoJSON.Polygon>,
  model: GeoJSON.FeatureCollection<GeoJSON.Polygon>,
  maxDeg = MODEL_GRID_DEG * 0.75,
  toleranceM = 300,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const cols = model.features.map((f) => f.properties as { lat: number; lng: number; baseM: number; topM: number });
  return {
    type: 'FeatureCollection',
    features: metar.features.map((f) => {
      const p = f.properties as { baseM: number; lat?: number; lng?: number; [k: string]: unknown };
      const [lng, lat] = f.geometry.coordinates[0].reduce((s, c, i, a) => (i === a.length - 1 ? s : [s[0] + c[0] / (a.length - 1), s[1] + c[1] / (a.length - 1)]), [0, 0]);
      let best: { topM: number; dist: number } | null = null;
      for (const c of cols) {
        const dist = Math.hypot(c.lat - lat, c.lng - lng);
        if (dist > maxDeg || p.baseM < c.baseM - toleranceM || p.baseM >= c.topM) continue;
        if (!best || dist < best.dist) best = { topM: c.topM, dist };
      }
      return best ? { ...f, properties: { ...p, topM: best.topM, topSource: 'model' } } : { ...f, properties: { ...p, topSource: 'default' } };
    }),
  };
}
