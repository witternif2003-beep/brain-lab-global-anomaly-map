import { Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';
import { insideRing, loadGaWallRing, offset, type LngLat } from './ga-patrol-3d';
import type { MovingTrack, MovingTracksPayload, TrackKind } from './moving-tracks/parse';

const API = '/api/moving-tracks';
const SRC = 'moving-tracks';
const ARROW = 'moving-track-arrow';
const REFRESH_MS = 30_000;
const KT_TO_MS = 0.514444;
const PROJECT_MAX_S: Record<TrackKind, number> = { aircraft: 900, vessel: 600, train: 0 };
const COLORS: Record<TrackKind, string> = { aircraft: '#7dd3fc', vessel: '#34d399', train: '#f472b6' };
const FEED = { id: 'moving-tracks', label: 'Moving tracks worldwide (aircraft, ships, trains)', color: '#7dd3fc', sourceUrl: 'https://opensky-network.org/' };
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface MovingFlushStats {
  tracks: number;
  flushMs: number;
  at: number;
}

declare global {
  interface Window {
    __gaMoving?: MovingFlushStats;
  }
}

const bound = new WeakSet<MapLibreMap>();

function arrowImage(): ImageData {
  const n = 32;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  if (!g) return new ImageData(n, n);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(16, 2);
  g.lineTo(28, 28);
  g.lineTo(16, 21);
  g.lineTo(4, 28);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, n, n);
}

/** Position projected forward from the last fix along course at reported speed, capped per kind. */
export function projected(t: MovingTrack, now: number): LngLat {
  const cap = PROJECT_MAX_S[t.kind];
  if (!cap || t.course === null || !(t.speedKt > 0)) return [t.lon, t.lat];
  const dt = Math.min(cap, Math.max(0, (now - t.at) / 1000));
  return offset([t.lon, t.lat], ((90 - t.course) * Math.PI) / 180, t.speedKt * KT_TO_MS * dt);
}

function toFeatures(tracks: MovingTrack[], now: number): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: tracks.map((t, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: projected(t, now) },
      properties: { kind: t.kind, course: t.course, speedKt: t.speedKt, altFt: t.altFt, label: t.label, at: t.at, source: t.source },
    })),
  };
}

function ensureLayers(map: MapLibreMap): void {
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: EMPTY, attribution: 'Moving tracks: OpenSky Network (aircraft); Fintraffic / digitraffic.fi CC BY 4.0 (AIS ships, trains)' });
  if (!map.hasImage(ARROW)) map.addImage(ARROW, arrowImage(), { sdf: true, pixelRatio: 2 });
  const color: ExpressionSpecification = ['match', ['get', 'kind'], 'aircraft', COLORS.aircraft, 'vessel', COLORS.vessel, COLORS.train];
  if (!map.getLayer(`${SRC}-dot`)) {
    map.addLayer({
      id: `${SRC}-dot`,
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'course'], null],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 1.6, 8, 4], 'circle-color': color, 'circle-stroke-color': '#020617', 'circle-stroke-width': 0.6 },
    });
  }
  if (!map.getLayer(`${SRC}-arrow`)) {
    map.addLayer({
      id: `${SRC}-arrow`,
      type: 'symbol',
      source: SRC,
      filter: ['!=', ['get', 'course'], null],
      layout: {
        'icon-image': ARROW,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 0.8],
        'icon-rotate': ['get', 'course'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-color': color, 'icon-halo-color': '#020617', 'icon-halo-width': 0.6 },
    });
  }
}

const row = (box: HTMLElement, k: string, v: string) => {
  if (!v) return;
  const r = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = `${k}: `;
  r.append(b, v);
  box.append(r);
};

/** Up to 50,000 moving public tracks worldwide, projected forward between fixes; aircraft inside the Georgia wall are left to the Georgia ADS-B layer (idempotent). */
export function addMovingTrackLayers(map: MapLibreMap): void {
  ensureLayers(map);
  if (bound.has(map)) return;
  bound.add(map);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const tickMs = touch ? 4_000 : 2_000;
  const wallP = loadGaWallRing().catch(() => [] as LngLat[]);
  let tracks: MovingTrack[] = [];

  const draw = () => {
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!src) return;
    const t0 = performance.now();
    src.setData(toFeatures(tracks, Date.now()));
    window.__gaMoving = { tracks: tracks.length, flushMs: Math.round((performance.now() - t0) * 10) / 10, at: Date.now() };
  };

  const refresh = async () => {
    try {
      const r = await fetch(API);
      const d = (await r.json()) as MovingTracksPayload & { error?: string };
      if (!r.ok || d.error) throw new Error(d.error ?? `HTTP ${r.status}`);
      const wall = await wallP;
      tracks = d.tracks.filter((t) => t.kind !== 'aircraft' || !wall.length || !insideRing(wall, [t.lon, t.lat]));
      draw();
      const active = d.sources.filter((s) => !s.standby);
      const down = active.filter((s) => !s.ok).map((s) => `${s.id} offline (${s.error})`);
      const per = active.filter((s) => s.ok).map((s) => `${s.moving.toLocaleString()} ${s.kind === 'aircraft' ? 'aircraft' : s.kind === 'vessel' ? 'ships' : 'trains'} (${s.id}, fix ${s.lagSeconds ?? '?'} s old${s.error ? `, ${s.error}` : ''})`);
      const newest = Math.max(...d.sources.map((s) => s.newestAt ?? 0));
      reportGaFeed(map, {
        ...FEED,
        count: tracks.length,
        detail: [
          `moving only, ceiling ${d.max.toLocaleString()}${d.truncated ? ` (${d.truncated.toLocaleString()} dropped)` : ''}`,
          ...per,
          ...down,
          'positions projected forward from the last fix',
          d.privacy.note,
        ].join(' · '),
        updatedAt: newest ? new Date(newest).toISOString() : null,
        error: down.length === active.length ? down.join('; ') : null,
      });
    } catch (err) {
      reportGaFeed(map, { ...FEED, count: null, updatedAt: null, error: String(err instanceof Error ? err.message : err) });
    }
  };
  void refresh();
  const refreshTimer = setInterval(() => void refresh(), REFRESH_MS);
  const tickTimer = setInterval(draw, tickMs);
  map.on('style.load', () => {
    ensureLayers(map);
    draw();
  });
  map.once('remove', () => {
    clearInterval(refreshTimer);
    clearInterval(tickTimer);
    bound.delete(map);
  });

  const onClick = (e: MapLayerMouseEvent) => {
    if (hitsGaDeck(map, e.point)) return;
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const box = document.createElement('div');
    box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
    const h = document.createElement('div');
    h.textContent = `${String(p.kind).toUpperCase()} · ${String(p.label)}`;
    h.style.cssText = 'font-weight:800;margin-bottom:4px';
    box.append(h);
    row(box, 'Speed', `${p.speedKt} kt`);
    row(box, 'Course', p.course === null || p.course === undefined || p.course === 'null' ? '' : `${p.course}°`);
    row(box, 'Altitude', p.altFt === null || p.altFt === undefined || p.altFt === 'null' ? '' : `${Number(p.altFt).toLocaleString()} ft`);
    row(box, 'Last fix', new Date(Number(p.at)).toLocaleString());
    row(box, 'Position', p.kind === 'train' ? 'last GPS fix' : 'projected forward from the last fix using speed and course');
    row(box, 'Source', String(p.source));
    new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
  };
  for (const id of [`${SRC}-dot`, `${SRC}-arrow`]) {
    map.on('click', id, onClick);
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
  }
}
