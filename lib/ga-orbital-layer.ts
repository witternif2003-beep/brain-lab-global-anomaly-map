import { Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { twoline2satrec, type SatRec } from 'satellite.js';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck, setGaDeckGroup } from './ga-deck-overlay';
import { hexToRgba } from './ga-point-colors';
import { GA_GLOW_SCALE, GA_MARKER_SCALE } from './ga-marker-scale';
import { elevationDeg, subPoint, type TleEntry } from './ga-satellites/tle';
import type { FireConfidence } from './ga-fires/parse';

const SATS = 'ga-satellites';
const TRACKS = 'ga-satellite-tracks';
const FIRE_LABELS = 'ga-fire-labels';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const TICK_MS = 2_000;
const TLE_REFRESH_MS = 2 * 60 * 60_000;
const FIRE_REFRESH_MS = 10 * 60_000;
const REGION = { west: -97, south: 22, east: -68, north: 44 };
const TRACK_MIN = { back: 3, ahead: 9 };
const STALE_EPOCH_DAYS = 7;
const MIN_ELEVATION_DEG = 10;
const LEO_MAX_KM = 2_000;

const GROUP_COLOR: ExpressionSpecification = [
  'match', ['get', 'group'],
  'Space stations', '#f472b6', 'Weather', '#38bdf8', 'Earth resources', '#4ade80', 'Science', '#c084fc', 'Geodetic', '#fbbf24', 'GPS', '#94a3b8', 'Brightest', '#fde047', 'Amateur radio', '#fb923c',
  '#e2e8f0',
];
const CORE_PX = 4.5;
const GLOW_PX = 11;
const inWall = (outside: number, inside: number): ExpressionSpecification => ['case', ['get', 'overhead'], inside, outside];

const FIRE_COLORS: Record<FireConfidence, string> = { high: '#ef4444', nominal: '#f97316', low: '#facc15' };

interface Tracked extends TleEntry {
  satrec: SatRec;
}
interface SatPayload { satellites?: TleEntry[]; source?: string; sourceUrl?: string; generatedAt?: string; errors?: string[]; error?: string }
interface FirePayload {
  geojson?: GeoJSON.FeatureCollection<GeoJSON.Point>;
  summary?: { total: number; byConfidence: Record<FireConfidence, number>; latestDetection: string | null };
  feeds?: { id: string; error: string | null }[];
  sourceUrl?: string;
  error?: string;
}

const bound = new WeakSet<MapLibreMap>();

export function box(title: string, rows: [string, string][], href: string, link: string) {
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-weight:800;margin-bottom:4px';
  el.append(h);
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    el.append(row);
  }
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = link;
  el.append(a);
  return el;
}

const inRegion = (lon: number, lat: number) => lon >= REGION.west && lon <= REGION.east && lat >= REGION.south && lat <= REGION.north;

function satPopup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties;
  if (!p) return;
  const ageDays = (Date.now() - Date.parse(String(p.epoch))) / 86_400_000;
  const el = box(
    `SATELLITE · ${String(p.name)}`,
    [
      ['NORAD ID', String(p.norad)],
      ['Group', String(p.group)],
      ['Directly over the GA wall', p.overhead === true || p.overhead === 'true' ? 'yes' : 'no'],
      ['Elevation from central GA', p.elevationDeg === null || p.elevationDeg === undefined ? '' : `${Number(p.elevationDeg).toFixed(1)}° ${Number(p.elevationDeg) >= MIN_ELEVATION_DEG ? '(above the horizon)' : '(not usefully visible)'}`],
      ['Altitude', `${Number(p.altKm).toFixed(0)} km`],
      ['Speed', `${Number(p.speedKmS).toFixed(2)} km/s`],
      ['Sub-point', `${Number(p.lat).toFixed(3)}, ${Number(p.lon).toFixed(3)}`],
      ['Elements epoch', `${new Date(String(p.epoch)).toLocaleString()}${ageDays > STALE_EPOCH_DAYS ? ` (${ageDays.toFixed(0)} d old, position less accurate)` : ''}`],
      ['Method', 'SGP4 propagation in your browser every 2 s'],
    ],
    `https://celestrak.org/satcat/table-satcat.php?CATNR=${encodeURIComponent(String(p.norad))}`,
    'CelesTrak catalogue entry ↗',
  );
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

function firePopup(map: MapLibreMap, lngLat: LngLat, p: Record<string, unknown>) {
  const el = box(
    `NASA FIRMS · ${String(p.instrument)} FIRE DETECTION`,
    [
      ['Satellite', String(p.satellite)],
      ['Detected', new Date(String(p.detectedAt)).toLocaleString()],
      ['Confidence', String(p.confidence)],
      ['Fire radiative power', p.frpMw === null || p.frpMw === undefined ? '' : `${Number(p.frpMw).toFixed(1)} MW`],
      ['Pass', p.daynight === 'D' ? 'day' : p.daynight === 'N' ? 'night' : ''],
      ['Location', `${lngLat[1].toFixed(4)}, ${lngLat[0].toFixed(4)}`],
      ['Note', 'A thermal anomaly; can be a wildfire, prescribed burn, flare or hot industrial site.'],
    ],
    `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lngLat[0].toFixed(4)},${lngLat[1].toFixed(4)},12.0z`,
    'Open in FIRMS ↗',
  );
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(lngLat).setDOMContent(el).addTo(map);
}

function trackLine(sat: Tracked, now: number): GeoJSON.Feature<GeoJSON.LineString> | null {
  const coords: LngLat[] = [];
  for (let m = -TRACK_MIN.back; m <= TRACK_MIN.ahead; m += 0.5) {
    const p = subPoint(sat.satrec, new Date(now + m * 60_000));
    if (!p) continue;
    const prev = coords[coords.length - 1];
    if (prev && Math.abs(prev[0] - p.lon) > 180) break;
    coords.push([p.lon, p.lat]);
  }
  return coords.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { name: sat.name, group: sat.group } } : null;
}

/** Satellites over and around Georgia (positions propagated from public TLEs) and NASA FIRMS fire detections inside the GA wall (idempotent). */
export function addGaOrbitalLayers(map: MapLibreMap): void {
  if (!map.getSource(SATS)) map.addSource(SATS, { type: 'geojson', data: EMPTY, attribution: 'Satellite positions: SGP4 from CelesTrak / Space-Track public element sets' });
  if (!map.getSource(TRACKS)) map.addSource(TRACKS, { type: 'geojson', data: EMPTY });
  if (!map.getSource(FIRE_LABELS)) map.addSource(FIRE_LABELS, { type: 'geojson', data: EMPTY, attribution: 'Fire detections: NASA FIRMS (VIIRS/MODIS)' });
  if (!map.getLayer(`${TRACKS}-line`))
    map.addLayer({ id: `${TRACKS}-line`, type: 'line', source: TRACKS, paint: { 'line-color': GROUP_COLOR, 'line-width': 1.4, 'line-opacity': 0.75, 'line-dasharray': [3, 2] } });
  if (!map.getLayer(`${SATS}-glow`)) {
    map.addLayer({
      id: `${SATS}-glow`, type: 'circle', source: SATS, filter: ['==', ['get', 'overhead'], true],
      paint: { 'circle-radius': (CORE_PX + (GLOW_PX - CORE_PX) * GA_GLOW_SCALE) * GA_MARKER_SCALE, 'circle-color': GROUP_COLOR, 'circle-opacity': 0.35, 'circle-blur': 0.6 },
    });
  }
  if (!map.getLayer(`${SATS}-core`)) {
    map.addLayer({
      id: `${SATS}-core`, type: 'circle', source: SATS,
      paint: {
        'circle-radius': inWall(CORE_PX * 0.7, CORE_PX * GA_MARKER_SCALE),
        'circle-color': GROUP_COLOR,
        'circle-opacity': ['case', ['any', ['get', 'overhead'], ['get', 'visible']], 1, 0.45],
        'circle-stroke-color': '#0b1220',
        'circle-stroke-width': 1,
      },
    });
  }
  if (!map.getLayer(`${SATS}-label`)) {
    map.addLayer({
      id: `${SATS}-label`, type: 'symbol', source: SATS, filter: ['any', ['==', ['get', 'overhead'], true], ['==', ['get', 'visible'], true]], minzoom: 5,
      layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 16 },
      paint: { 'text-color': GROUP_COLOR, 'text-halo-color': '#020617', 'text-halo-width': 1.4 },
    });
  }
  if (!map.getLayer(`${FIRE_LABELS}-label`)) {
    map.addLayer({
      id: `${FIRE_LABELS}-label`, type: 'symbol', source: FIRE_LABELS, minzoom: 9,
      layout: { 'text-field': ['concat', 'FIRE · ', ['get', 'label']], 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
      paint: { 'text-color': '#fdba74', 'text-halo-color': '#1c1917', 'text-halo-width': 1.4 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  let tracked: Tracked[] = [];
  let satMeta: SatPayload = {};
  let ring: LngLat[] = [];

  const loadTles = async () => {
    try {
      const [r, wall] = await Promise.all([fetch('/api/ga-satellites'), loadGaWallRing().catch(() => [] as LngLat[])]);
      ring = wall;
      satMeta = (await r.json()) as SatPayload;
      if (!r.ok) throw new Error(satMeta.error ?? `HTTP ${r.status}`);
      tracked = (satMeta.satellites ?? []).flatMap((s) => {
        try {
          return [{ ...s, satrec: twoline2satrec(s.line1, s.line2) }];
        } catch {
          return [];
        }
      });
      tick();
    } catch (err) {
      reportGaFeed(map, { id: 'satellites', label: `Satellites above GA horizon (≥${MIN_ELEVATION_DEG}°)`, color: '#38bdf8', count: null, updatedAt: null, sourceUrl: 'https://celestrak.org/NORAD/elements/', error: String(err) });
    }
  };

  const tick = () => {
    if (!tracked.length || document.hidden) return;
    const now = Date.now();
    const date = new Date(now);
    const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const tracks: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (const sat of tracked) {
      const p = subPoint(sat.satrec, date);
      if (!p) continue;
      const elev = elevationDeg(sat.satrec, date);
      const visible = elev !== null && elev >= MIN_ELEVATION_DEG;
      if (!visible && !inRegion(p.lon, p.lat)) continue;
      const overhead = ring.length > 3 && insideRing(ring, [p.lon, p.lat]);
      points.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { name: sat.name, norad: sat.norad, group: sat.group, epoch: sat.epoch, overhead, visible, elevationDeg: elev, altKm: p.altKm, speedKmS: p.speedKmS, lon: p.lon, lat: p.lat, label: `${sat.name} · ${p.altKm.toFixed(0)} km` },
      });
      if (overhead || (visible && p.altKm < LEO_MAX_KM)) {
        const t = trackLine(sat, now);
        if (t) tracks.push(t);
      }
    }
    (map.getSource(SATS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: points });
    (map.getSource(TRACKS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: tracks });
    const over = points.filter((f) => f.properties?.overhead).length;
    const vis = points.filter((f) => f.properties?.visible).sort((a, b) => Number(b.properties?.elevationDeg) - Number(a.properties?.elevationDeg));
    const names = vis.slice(0, 3).map((f) => String(f.properties?.name)).join(', ');
    reportGaFeed(map, {
      id: 'satellites', label: `Satellites above GA horizon (≥${MIN_ELEVATION_DEG}°)`, color: '#38bdf8', count: vis.length,
      detail: `${over} directly over the wall · ${tracked.length} tracked${names ? ` · highest: ${names}` : ''}${satMeta.errors?.length ? ` · ${satMeta.errors.length} group(s) failed` : ''}`,
      updatedAt: date.toISOString(), sourceUrl: satMeta.sourceUrl ?? 'https://celestrak.org/NORAD/elements/',
      error: satMeta.source?.includes('unreachable') ? 'CelesTrak unreachable; using SatNOGS element sets' : null,
    });
  };

  const loadFires = async () => {
    try {
      const [r, wall] = await Promise.all([fetch('/api/ga-fires'), loadGaWallRing().catch(() => [] as LngLat[])]);
      const d = (await r.json()) as FirePayload;
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      const fires = (d.geojson?.features ?? []).filter((f) => !wall.length || insideRing(wall, f.geometry.coordinates as LngLat));
      (map.getSource(FIRE_LABELS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: fires });
      const now = Date.now();
      setGaDeckGroup(map, 'fires', {
        z: 25,
        items: fires.map((f) => {
          const p = f.properties ?? {};
          const conf = (String(p.confidence) as FireConfidence) in FIRE_COLORS ? (String(p.confidence) as FireConfidence) : 'nominal';
          const frp = Number(p.frpMw ?? 0);
          const recent = now - Date.parse(String(p.detectedAt)) < 3 * 3_600_000;
          return {
            coord: f.geometry.coordinates as LngLat,
            radiusPx: frp >= 50 ? 6 : frp >= 10 ? 4.5 : 3.5,
            fill: hexToRgba(FIRE_COLORS[conf], 235),
            stroke: hexToRgba('#450a0a'),
            strokePx: 1,
            glow: conf === 'high' ? 0.6 : 0,
            pulse: recent && conf !== 'low',
            props: { ...p },
          };
        }),
        onClick: firePopup,
      });
      const failed = (d.feeds ?? []).filter((f) => f.error).map((f) => f.id);
      const c = d.summary?.byConfidence;
      reportGaFeed(map, {
        id: 'fires', label: 'NASA FIRMS fire detections', color: '#ef4444', count: fires.length,
        detail: `last 24 h${c ? ` · ${c.high} high, ${c.nominal} nominal, ${c.low} low confidence (GA box)` : ''}`,
        updatedAt: d.summary?.latestDetection ?? null, sourceUrl: d.sourceUrl ?? 'https://firms.modaps.eosdis.nasa.gov/',
        error: failed.length ? `feed unavailable: ${failed.join(', ')}` : null,
      });
    } catch (err) {
      reportGaFeed(map, { id: 'fires', label: 'NASA FIRMS fire detections', color: '#ef4444', count: null, updatedAt: null, sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/', error: String(err) });
    }
  };

  void loadTles();
  void loadFires();
  const timers = [setInterval(tick, TICK_MS), setInterval(() => void loadTles(), TLE_REFRESH_MS), setInterval(() => void loadFires(), FIRE_REFRESH_MS)];
  map.once('remove', () => {
    timers.forEach(clearInterval);
    bound.delete(map);
  });

  map.on('click', `${SATS}-core`, (e) => {
    if (hitsGaDeck(map, e.point)) return;
    satPopup(map, e);
  });
  map.on('mouseenter', `${SATS}-core`, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', `${SATS}-core`, () => (map.getCanvas().style.cursor = ''));
}
