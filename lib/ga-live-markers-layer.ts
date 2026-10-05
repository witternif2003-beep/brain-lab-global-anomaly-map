import { Popup } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, offset, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { setGaDeckGroup, type GaDeckItem } from './ga-deck-overlay';
import { hexToRgba } from './ga-point-colors';
import type { GaIconShape } from './ga-marker-icons';
import { box } from './ga-orbital-layer';
import type { LiveLayer, LiveMarker, LiveValue } from './ga-live-markers/parse';

interface Payload {
  generatedAt?: string;
  refreshSeconds?: number;
  source?: string;
  sourceUrl?: string;
  feeds?: { id: string; count: number | null; error: string | null }[];
  markers?: LiveMarker[];
  error?: string;
}

interface Spec {
  label: string;
  color: string;
  stroke: string;
  radiusPx: number;
  z: number;
  refreshMs: number;
  iconPx: number;
  icon: (m: LiveMarker) => { shape: GaIconShape; angle?: number };
  labelMinZoom?: number;
  tag?: (m: LiveMarker) => string;
  title: (m: LiveMarker) => string;
  rows: (p: Record<string, LiveValue>) => [string, string][];
  detail: (ms: LiveMarker[]) => string;
}

const KT_TO_MS = 0.514444;
const heading = (v: LiveValue) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const toIcon = ({ shape, angle }: { shape: GaIconShape; angle?: number }) => ({ icon: shape, angle });
const altTag = (p: Record<string, LiveValue>) => {
  if (p.onGround) return 'GND';
  const ft = Number(p.altFt);
  if (p.altFt === null || p.altFt === undefined || !Number.isFinite(ft)) return '';
  return ft >= 18_000 ? `FL${Math.round(ft / 100)}` : `${(Math.round(ft / 100) * 100).toLocaleString('en-US')} ft`;
};
const DEAD_RECKON_MAX_S = 30;
const TICK_MS = 1_000;
const fmt = (v: LiveValue, unit = '') => (v === null || v === undefined || v === '' ? '' : `${v}${unit}`);
const countBy = (ms: LiveMarker[], key: string) => {
  const c = new Map<string, number>();
  for (const m of ms) c.set(String(m.props[key] ?? 'unknown'), (c.get(String(m.props[key] ?? 'unknown')) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ');
};

const SPECS: Record<LiveLayer, Spec> = {
  aircraft: {
    label: 'Aircraft (ADS-B)', color: '#e0f2fe', stroke: '#0369a1', radiusPx: 4.5, z: 30, refreshMs: 10_000,
    iconPx: 26, labelMinZoom: 7,
    icon: (m) => ({ shape: 'aircraft', angle: heading(m.props.track) }),
    tag: (m) => [m.label === 'no callsign' ? '' : m.label, altTag(m.props)].filter(Boolean).join(' · '),
    title: (m) => `AIRCRAFT · ${m.label}`,
    rows: (p) => [
      ['Type', fmt(p.type)],
      ['Altitude', p.onGround ? 'on the ground' : fmt(p.altFt, ' ft')],
      ['Ground speed', fmt(p.gsKt, ' kt')],
      ['Track', fmt(p.track, '°')],
      ['Emergency', fmt(p.emergency)],
      ['Position', 'moved forward each second from the last report using speed and track'],
    ],
    detail: (ms) => `${ms.filter((m) => !m.props.onGround).length} airborne · ${ms.filter((m) => m.props.onGround).length} on ground · PIA/LADD aircraft removed`,
  },
  transit: {
    label: 'MARTA buses (GTFS-RT)', color: '#fbbf24', stroke: '#78350f', radiusPx: 4, z: 28, refreshMs: 20_000,
    iconPx: 20, labelMinZoom: 11,
    icon: (m) => (heading(m.props.bearing) === undefined ? { shape: 'vehicle' } : { shape: 'heading', angle: heading(m.props.bearing) }),
    tag: (m) => (m.props.route ? `MARTA ${m.props.route}` : 'MARTA'),
    title: (m) => `MARTA · ${m.label}`,
    rows: (p) => [['Vehicle', fmt(p.vehicle)], ['Speed', fmt(p.speedMph, ' mph')], ['Bearing', fmt(p.bearing, '°')]],
    detail: (ms) => `${new Set(ms.map((m) => m.props.route)).size} routes running`,
  },
  micromobility: {
    label: 'Parked scooters/bikes (GBFS)', color: '#a3e635', stroke: '#365314', radiusPx: 2.4, z: 12, refreshMs: 60_000,
    iconPx: 9, icon: () => ({ shape: 'scooter' }),
    title: (m) => `SHARED ${String(m.props.vehicleType ?? 'vehicle').toUpperCase()} · ${m.label}`,
    rows: (p) => [['Status', p.disabled ? 'disabled' : 'available'], ['Range', fmt(p.rangeKm, ' km')]],
    detail: (ms) => `${countBy(ms, 'operator')} · City of Atlanta · reserved ones hidden`,
  },
  stations: {
    label: 'Weather/hydro stations (IEM)', color: '#93c5fd', stroke: '#1e3a8a', radiusPx: 3.5, z: 20, refreshMs: 5 * 60_000,
    iconPx: 14, icon: () => ({ shape: 'station' }),
    title: (m) => `STATION · ${m.label}`,
    rows: (p) => [
      ['ID', `${fmt(p.station)} (${fmt(p.network)})`],
      ['Temperature', fmt(p.tempF, ' °F')],
      ['Dew point', fmt(p.dewF, ' °F')],
      ['Humidity', fmt(p.rh, ' %')],
      ['Wind', p.windKt === null ? '' : `${p.windKt} kt${p.windDir === null ? '' : ` from ${p.windDir}°`}${p.gustKt ? `, gust ${p.gustKt} kt` : ''}`],
      ['Rain today', fmt(p.precipDayIn, ' in')],
    ],
    detail: (ms) => countBy(ms, 'network').replace(/GA_/g, ''),
  },
  streamgauges: {
    label: 'USGS stream gauges', color: '#2dd4bf', stroke: '#134e4a', radiusPx: 3.2, z: 18, refreshMs: 5 * 60_000,
    iconPx: 14, icon: () => ({ shape: 'gauge' }),
    title: (m) => `USGS GAUGE · ${m.label}`,
    rows: (p) => [['Site', fmt(p.site)], ['Gage height', fmt(p.gageHeightFt, ` ${p.unit ?? 'ft'}`)], ['Status', p.provisional ? 'provisional (not yet reviewed)' : 'approved']],
    detail: () => 'latest gage height · provisional data',
  },
};

const bound = new WeakSet<MapLibreMap>();

function sourceLink(layer: LiveLayer, m: LiveMarker): { href: string; text: string } {
  if (layer === 'streamgauges') return { href: `https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(String(m.props.site))}/`, text: 'USGS site page ↗' };
  if (layer === 'stations') return { href: `https://mesonet.agron.iastate.edu/sites/site.php?station=${encodeURIComponent(String(m.props.station))}&network=${encodeURIComponent(String(m.props.network))}`, text: 'IEM station page ↗' };
  if (layer === 'aircraft') return { href: `https://adsb.lol/?lat=${m.lat}&lon=${m.lon}&zoom=11`, text: 'Open area in adsb.lol ↗' };
  if (layer === 'transit') return { href: 'https://itsmarta.com/', text: 'MARTA ↗' };
  return { href: 'https://github.com/MobilityData/gbfs', text: 'GBFS specification ↗' };
}

function popupFor(layer: LiveLayer) {
  return (map: MapLibreMap, lngLat: LngLat, props: Record<string, unknown>) => {
    const m = props.marker as LiveMarker;
    const link = sourceLink(layer, m);
    const rows = [...SPECS[layer].rows(m.props), ['Reported', m.observedAt ? new Date(m.observedAt).toLocaleString() : ''] as [string, string]];
    new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' })
      .setLngLat(lngLat)
      .setDOMContent(box(SPECS[layer].title(m), rows, link.href, link.text))
      .addTo(map);
  };
}

function aircraftCoord(m: LiveMarker, now: number): LngLat {
  const gs = Number(m.props.gsKt);
  const track = Number(m.props.track);
  if (m.props.onGround || !m.observedAt || !Number.isFinite(gs) || !Number.isFinite(track) || m.props.gsKt === null || m.props.track === null) return [m.lon, m.lat];
  const dt = Math.min(DEAD_RECKON_MAX_S, Math.max(0, (now - Date.parse(m.observedAt)) / 1000));
  return offset([m.lon, m.lat], ((90 - track) * Math.PI) / 180, gs * KT_TO_MS * dt);
}

/** Live public markers inside the GA wall: ADS-B aircraft, MARTA buses, parked shared scooters, weather/hydro stations and USGS gauges (idempotent). */
export function addGaLiveMarkerLayers(map: MapLibreMap): void {
  if (bound.has(map)) return;
  bound.add(map);
  const wallP = loadGaWallRing().catch(() => [] as LngLat[]);
  const current: Partial<Record<LiveLayer, LiveMarker[]>> = {};

  const render = (layer: LiveLayer) => {
    const spec = SPECS[layer];
    const ms = current[layer] ?? [];
    const now = Date.now();
    const fill = hexToRgba(spec.color, 235);
    const stroke = hexToRgba(spec.stroke);
    const items: GaDeckItem[] = ms.map((m) => ({
      coord: layer === 'aircraft' ? aircraftCoord(m, now) : [m.lon, m.lat],
      radiusPx: spec.radiusPx,
      ...toIcon(spec.icon(m)),
      iconPx: spec.iconPx,
      label: spec.tag?.(m) || undefined,
      fill: layer === 'micromobility' && m.props.disabled ? hexToRgba('#64748b', 200) : layer === 'aircraft' && m.props.emergency ? hexToRgba('#ef4444') : fill,
      stroke,
      strokePx: layer === 'micromobility' ? 0.5 : 1,
      pulse: layer === 'aircraft' && !!m.props.emergency,
      props: { marker: m },
    }));
    setGaDeckGroup(map, layer, { z: spec.z, labelMinZoom: spec.labelMinZoom, items, onClick: popupFor(layer) });
  };

  const load = async (layer: LiveLayer) => {
    const spec = SPECS[layer];
    try {
      const [r, wall] = await Promise.all([fetch(`/api/ga-live-markers?layer=${layer}`), wallP]);
      const d = (await r.json()) as Payload;
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      const ms = (d.markers ?? []).filter((m) => !wall.length || insideRing(wall, [m.lon, m.lat]));
      current[layer] = ms;
      render(layer);
      const failed = (d.feeds ?? []).filter((f) => f.error);
      const newest = ms.reduce<string | null>((a, m) => (m.observedAt && (!a || m.observedAt > a) ? m.observedAt : a), null);
      reportGaFeed(map, {
        id: layer, label: spec.label, color: spec.color, count: ms.length,
        detail: `${spec.detail(ms)} · refresh ${Math.round(spec.refreshMs / 1000)} s`,
        updatedAt: newest ?? d.generatedAt ?? null,
        sourceUrl: d.sourceUrl ?? '',
        error: failed.length ? `unavailable: ${failed.map((f) => `${f.id} (${f.error})`).join(', ')}` : null,
      });
    } catch (err) {
      reportGaFeed(map, { id: layer, label: spec.label, color: spec.color, count: null, updatedAt: null, sourceUrl: '', error: String(err) });
    }
  };

  const layers = Object.keys(SPECS) as LiveLayer[];
  layers.forEach((l) => void load(l));
  const timers = [
    ...layers.map((l) => setInterval(() => void load(l), SPECS[l].refreshMs)),
    setInterval(() => current.aircraft && render('aircraft'), TICK_MS),
  ];
  map.once('remove', () => {
    timers.forEach(clearInterval);
    bound.delete(map);
  });
}
