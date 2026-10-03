import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { setGaDeckGroup } from './ga-deck-overlay';
import { hexToRgba } from './ga-point-colors';

const SOURCE = 'ga-change';
const LABEL = 'ga-change-label';
const DATA_URL = '/geo/ga-change.json';
const SOURCE_URL = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a';
const REFRESH_MS = 60 * 60_000;
const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point, ChangeCell> = { type: 'FeatureCollection', features: [] };
const ATTRIBUTION =
  'Satellite change: contains modified Copernicus Sentinel data 2025–2026 (ESA, via Element 84 Earth Search) · Prithvi-EO-2.0-100M-TL (NASA/IBM/Jülich, Apache-2.0) · statistical/model signal, not proof of an event or a finding about any person or property';
const FOOTER =
  'Statistical/model signal from public imagery at ~80 m; not validated against labelled change data; not proof of an event or a finding about any person or property.';

interface Scene {
  id: string;
  date: string;
  cloud: number;
  url: string;
}

interface ChangeCell extends Record<string, unknown> {
  h3: string;
  lat: number;
  lng: number;
  tier: 'confirmed' | 'candidate';
  kind: 'vegetation/surface loss' | 'vegetation gain / regrowth';
  dNdvi: number;
  dNbr: number;
  zNdvi: number;
  zNbr: number;
  zPersist: number[] | null;
  persists: boolean;
  neighbours: number;
  clear: number;
  geofmDist: number | null;
  geofmZ: number | null;
  geofmNote: string | null;
  mgrs: string;
  pairA: Scene[];
  pairB: Scene[] | null;
}

interface ChangePayload {
  generatedAt: string;
  sourceUrl: string;
  model: { url: string };
  cells: ChangeCell[];
}

const bound = new WeakSet<MapLibreMap>();

function formatNumber(value: number | null | undefined, digits: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'not available';
}

function makeLink(text: string, href: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  return link;
}

function popup(map: MapLibreMap, lngLat: LngLat, cell: ChangeCell, sourceUrl: string, modelUrl: string): void {
  const box = document.createElement('div');
  box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const title = document.createElement('div');
  title.textContent = `SENTINEL-2 CHANGE · ${cell.tier.toUpperCase()}`;
  title.style.cssText = 'font-weight:800;margin-bottom:4px';
  box.append(title);

  const pairB =
    cell.pairB?.length === 2
      ? `${cell.pairB[0].date} → ${cell.pairB[1].date}${cell.zPersist ? ` · z ${cell.zPersist.map((z) => z.toFixed(2)).join(' / ')}` : ''}`
      : 'none';
  const rows: [string, string][] = [
    ['Change', cell.kind],
    ['ΔNDVI', formatNumber(cell.dNdvi, 3)],
    ['ΔNBR', formatNumber(cell.dNbr, 3)],
    ['robust z (NDVI/NBR)', `${formatNumber(cell.zNdvi, 2)} / ${formatNumber(cell.zNbr, 2)}`],
    ['Second date pair', pairB],
    [
      'Prithvi-EO-2.0 embedding z',
      typeof cell.geofmZ === 'number' ? formatNumber(cell.geofmZ, 2) : cell.geofmNote || 'not available',
    ],
    ['Clear-sky fraction', `${Math.round(cell.clear * 100)}%`],
    ['MGRS tile', cell.mgrs],
    ['H3 cell', cell.h3],
  ];
  for (const [key, value] of rows) {
    const row = document.createElement('div');
    const label = document.createElement('b');
    label.textContent = `${key}: `;
    row.append(label, value);
    box.append(row);
  }

  const pairA = document.createElement('div');
  const pairLabel = document.createElement('b');
  pairLabel.textContent = 'Pair A before/after: ';
  pairA.append(pairLabel);
  if (cell.pairA.length === 2) {
    cell.pairA.forEach((scene, index) => {
      if (index) pairA.append(' → ');
      pairA.append(makeLink(scene.date, scene.url));
    });
  } else {
    pairA.append('not available');
  }
  box.append(pairA);

  const links = document.createElement('div');
  links.style.cssText = 'display:flex;gap:8px;margin-top:3px';
  links.append(makeLink('Sentinel-2 source ↗', sourceUrl), makeLink('Prithvi model card ↗', modelUrl));
  box.append(links);

  const footer = document.createElement('div');
  footer.textContent = FOOTER;
  footer.style.cssText = 'margin-top:5px;color:#475569;font-size:10px';
  box.append(footer);
  new Popup({ closeButton: true, maxWidth: 'min(340px, 90vw)' }).setLngLat(lngLat).setDOMContent(box).addTo(map);
}

function sceneDates(cells: ChangeCell[]): string[] {
  return cells.flatMap((cell) => [...(cell.pairA ?? []), ...(cell.pairB ?? [])].map((scene) => scene.date))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
}

function latestPairADate(cells: ChangeCell[]): string | null {
  const dates = cells.flatMap((cell) => (cell.pairA ?? []).map((scene) => scene.date))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Public Sentinel-2 change indicators inside the Georgia wall (idempotent). */
export function addGaChangeLayer(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SOURCE,
      minzoom: 11,
      layout: {
        'text-field': ['concat', 'SAT Δ · ', ['case', ['==', ['get', 'tier'], 'confirmed'], 'CONFIRMED', 'candidate']],
        'text-size': 9,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-max-width': 14,
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': ['match', ['get', 'kind'], 'vegetation/surface loss', '#e879f9', '#2dd4bf'],
        'text-halo-width': 1,
        'text-halo-blur': 0.6,
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const [response, ring] = await Promise.all([fetch(DATA_URL), loadGaWallRing()]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (ring.length < 3) throw new Error('Georgia wall ring unavailable');
      const payload = (await response.json()) as ChangePayload;
      if (!Array.isArray(payload.cells)) throw new Error('Invalid change snapshot: cells missing');
      const cells = payload.cells.filter(
        (cell) => Number.isFinite(cell.lng) && Number.isFinite(cell.lat) && insideRing(ring, [cell.lng, cell.lat]),
      );
      const features: GeoJSON.Feature<GeoJSON.Point, ChangeCell>[] = cells.map((cell) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
        properties: cell,
      }));
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
      setGaDeckGroup(map, 'imagery', {
        z: 25,
        items: cells.map((cell) => {
          const confirmed = cell.tier === 'confirmed';
          const color = cell.kind === 'vegetation/surface loss' ? '#e879f9' : '#2dd4bf';
          return {
            coord: [cell.lng, cell.lat] as LngLat,
            radiusPx: confirmed ? 6 : 4,
            fill: hexToRgba(color, confirmed ? 235 : 170),
            stroke: hexToRgba(confirmed ? '#ffffff' : '#1e1b4b'),
            strokePx: confirmed ? 2 : 1,
            ...(confirmed ? { glow: 0.6 } : {}),
            props: { ...cell },
          };
        }),
        onClick: (targetMap, lngLat, props) =>
          popup(targetMap, lngLat, props as unknown as ChangeCell, payload.sourceUrl || SOURCE_URL, payload.model?.url || 'https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL'),
      });

      const confirmed = cells.filter((cell) => cell.tier === 'confirmed').length;
      const candidate = cells.length - confirmed;
      const dates = sceneDates(cells);
      const snapshot = payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : 'unknown';
      reportGaFeed(map, {
        id: 'imagery',
        label: 'Sentinel-2 change (Prithvi-EO-2.0)',
        color: '#e879f9',
        count: cells.length,
        detail: `${confirmed} confirmed · ${candidate} candidate · scenes ${dates[0] ?? 'unknown'}–${dates[dates.length - 1] ?? 'unknown'} · snapshot ${snapshot}`,
        updatedAt: latestPairADate(cells),
        sourceUrl: payload.sourceUrl || SOURCE_URL,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[GaChange] refresh failed:', error);
      reportGaFeed(map, {
        id: 'imagery',
        label: 'Sentinel-2 change (Prithvi-EO-2.0)',
        color: '#e879f9',
        count: null,
        detail: 'Satellite change snapshot',
        updatedAt: null,
        sourceUrl: SOURCE_URL,
        error: message,
      });
    }
  };

  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
  });
}
