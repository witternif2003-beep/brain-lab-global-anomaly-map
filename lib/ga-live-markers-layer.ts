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

const lowGps = (m: LiveMarker) => typeof m.props.gpsNacp === 'number' && m.props.gpsNacp <= 7;

const osmRows = (p: Record<string, LiveValue>): [string, string][] => [
  ['Operator', fmt(p.operator)],
  ['Height', fmt(p.heightM, ' m')],
  ['Uses', fmt(p.uses)],
  ['Siren type', fmt(p.sirenType)],
  ['Purpose', fmt(p.sirenPurpose)],
  ['OSM', fmt(p.osm)],
];
const osmTag = (m: LiveMarker) => (m.props.named ? m.label : '');
const OSM_REFRESH_MS = 30 * 60_000;
const tfrState = (p: Record<string, LiveValue>, now = Date.now()) => {
  const from = Date.parse(String(p.effective ?? ''));
  const to = Date.parse(String(p.expires ?? ''));
  if (Number.isFinite(to) && to < now) return 'expired';
  if (Number.isFinite(from) && from > now) return 'scheduled';
  return 'active';
};
const when = (v: LiveValue) => (typeof v === 'string' && v ? new Date(v).toLocaleString() : '');

const SPECS: Record<LiveLayer, Spec> = {
  tfr: {
    label: 'FAA flight restrictions (TFR)', color: '#ef4444', stroke: '#1e3a8a', radiusPx: 5, z: 34, refreshMs: 5 * 60_000,
    iconPx: 26, labelMinZoom: 6,
    icon: () => ({ shape: 'airspace' }),
    tag: (m) => `TFR ${m.props.notam ?? ''} · ${tfrState(m.props)}`,
    title: (m) => `FAA TFR ${m.props.notam ?? ''} · ${m.label}`,
    rows: (p) => [
      ['Type', fmt(p.tfrType)],
      ['Status', tfrState(p)],
      ['Area', fmt(p.area)],
      ['Where', fmt(p.place)],
      ['From', when(p.effective)],
      ['Until', when(p.expires)],
      ['Ceiling', p.upperFt === null ? '' : `${p.upperFt} ft ${p.upperRef === 'HEI' ? 'above ground' : String(p.upperRef ?? '')}`.trim()],
      ['ARTCC', fmt(p.facility)],
      ['Position', 'centre of the restricted area'],
    ],
    detail: (ms) => (ms.length ? `${ms.filter((m) => tfrState(m.props) === 'active').length} active · ${ms.filter((m) => tfrState(m.props) === 'scheduled').length} scheduled` : 'none listed for Georgia'),
  },
  police: {
    label: 'Police facilities (OSM)', color: '#2563eb', stroke: '#ef4444', radiusPx: 4, z: 26, refreshMs: OSM_REFRESH_MS,
    iconPx: 18, labelMinZoom: 11, icon: () => ({ shape: 'shield' }), tag: osmTag,
    title: (m) => `POLICE FACILITY · ${m.label}`, rows: osmRows,
    detail: (ms) => `${ms.filter((m) => m.props.named).length} named · mapped locations, not vehicles`,
  },
  firestations: {
    label: 'Fire stations (OSM)', color: '#ef4444', stroke: '#1d4ed8', radiusPx: 4, z: 25, refreshMs: OSM_REFRESH_MS,
    iconPx: 16, labelMinZoom: 12, icon: () => ({ shape: 'house' }), tag: osmTag,
    title: (m) => `FIRE STATION · ${m.label}`, rows: osmRows,
    detail: (ms) => `${ms.filter((m) => m.props.named).length} named · mapped locations`,
  },
  sirens: {
    label: 'Outdoor warning sirens (OSM)', color: '#f43f5e', stroke: '#2563eb', radiusPx: 3.5, z: 24, refreshMs: OSM_REFRESH_MS,
    iconPx: 16, labelMinZoom: 12, icon: () => ({ shape: 'siren' }), tag: osmTag,
    title: (m) => `WARNING SIREN · ${m.label}`, rows: osmRows,
    detail: () => 'mapped locations · not siren activations',
  },
  towers: {
    label: 'Communication towers (OSM)', color: '#f87171', stroke: '#7f1d1d', radiusPx: 2.5, z: 15, refreshMs: OSM_REFRESH_MS,
    iconPx: 12, icon: () => ({ shape: 'tower' }),
    title: (m) => `COMM TOWER · ${m.label}`, rows: osmRows,
    detail: (ms) => `${ms.filter((m) => m.props.operator).length} with operator tagged · mapped locations`,
  },
  speedcams: {
    label: 'Speed cameras (OSM)', color: '#3b82f6', stroke: '#ef4444', radiusPx: 3, z: 23, refreshMs: OSM_REFRESH_MS,
    iconPx: 14, labelMinZoom: 12, icon: () => ({ shape: 'camera' }), tag: osmTag,
    title: (m) => `SPEED CAMERA · ${m.label}`, rows: osmRows,
    detail: () => 'fixed camera locations · no speed readings',
  },
  alpr: {
    label: 'Plate-reader camera locations (OSM)', color: '#dc2626', stroke: '#1e40af', radiusPx: 3, z: 22, refreshMs: OSM_REFRESH_MS,
    iconPx: 13, icon: () => ({ shape: 'camera' }),
    title: () => 'PLATE-READER CAMERA (location only)', rows: osmRows,
    detail: (ms) => `${ms.filter((m) => m.props.operator).length} with operator tagged · fixed positions only, no plate reads`,
  },
  signals: {
    label: 'Traffic signals (OSM)', color: '#60a5fa', stroke: '#1e3a8a', radiusPx: 2, z: 14, refreshMs: OSM_REFRESH_MS,
    iconPx: 9, icon: () => ({ shape: 'signal' }),
    title: () => 'TRAFFIC SIGNAL', rows: osmRows,
    detail: () => 'signal-preemption points · locations only, no signal state',
  },
  aircraft: {
    label: 'Aircraft (ADS-B)', color: '#e0f2fe', stroke: '#0369a1', radiusPx: 4.5, z: 33, refreshMs: 10_000,
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
      ['GPS accuracy (NACp)', fmt(p.gpsNacp)],
      ['Position', 'moved forward each second from the last report using speed and track'],
    ],
    detail: (ms) => `${ms.filter((m) => !m.props.onGround).length} airborne · ${ms.filter((m) => m.props.onGround).length} on ground · ${ms.filter(lowGps).length} with low GPS accuracy · PIA/LADD aircraft removed`,
  },
  transit: {
    label: 'Transit buses (GTFS-RT)', color: '#fbbf24', stroke: '#78350f', radiusPx: 4, z: 32, refreshMs: 20_000,
    iconPx: 20, labelMinZoom: 11,
    icon: (m) => (heading(m.props.bearing) === undefined ? { shape: 'vehicle' } : { shape: 'heading', angle: heading(m.props.bearing) }),
    tag: (m) => (m.props.route ? `${m.props.agency} ${m.props.route}` : String(m.props.agency)),
    title: (m) => `${String(m.props.agency).toUpperCase()} · ${m.label}`,
    rows: (p) => [['Vehicle', fmt(p.vehicle)], ['Speed', fmt(p.speedMph, ' mph')], ['Bearing', fmt(p.bearing, '°')]],
    detail: (ms) => `${countBy(ms, 'agency')} · ${new Set(ms.map((m) => `${m.props.agency}:${m.props.route}`)).size} routes running`,
  },
  micromobility: {
    label: 'Parked scooters/bikes (GBFS)', color: '#a3e635', stroke: '#365314', radiusPx: 2.4, z: 31, refreshMs: 60_000,
    iconPx: 12, icon: () => ({ shape: 'scooter' }),
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
  quakes: {
    label: 'Earthquakes, last 30 days (USGS)', color: '#c084fc', stroke: '#4c1d95', radiusPx: 4, z: 30, refreshMs: 60_000,
    iconPx: 22, labelMinZoom: 6,
    icon: () => ({ shape: 'quake' }),
    tag: (m) => (m.props.mag === null ? '' : `M${Number(m.props.mag).toFixed(1)}`),
    title: (m) => `EARTHQUAKE · ${m.label}`,
    rows: (p) => [['Magnitude', fmt(p.mag)], ['Depth', fmt(p.depthKm, ' km')], ['Event type', fmt(p.eventType)], ['Review status', fmt(p.status)]],
    detail: (ms) => (ms.length ? `largest M${Math.max(...ms.map((m) => Number(m.props.mag) || 0)).toFixed(1)} · USGS ComCat` : 'none recorded in the last 30 days · USGS ComCat'),
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
  if (m.props.osm) return { href: `https://www.openstreetmap.org/${m.props.osm}`, text: 'OpenStreetMap ↗' };
  if (layer === 'tfr' && m.props.notam) return { href: `https://tfr.faa.gov/tfr3/?page=detail_${String(m.props.notam).replace('/', '_')}`, text: 'FAA TFR page ↗' };
  if (layer === 'streamgauges') return { href: `https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(String(m.props.site))}/`, text: 'USGS site page ↗' };
  if (layer === 'stations') return { href: `https://mesonet.agron.iastate.edu/sites/site.php?station=${encodeURIComponent(String(m.props.station))}&network=${encodeURIComponent(String(m.props.network))}`, text: 'IEM station page ↗' };
  if (layer === 'quakes' && m.props.url) return { href: String(m.props.url), text: 'USGS event page ↗' };
  if (layer === 'aircraft') return { href: `https://adsb.lol/?lat=${m.lat}&lon=${m.lon}&zoom=11`, text: 'Open area in adsb.lol ↗' };
  if (layer === 'transit') return m.props.agency === 'MARTA' ? { href: 'https://itsmarta.com/', text: 'MARTA ↗' } : { href: 'https://mobilitydatabase.org/', text: 'Mobility Database feed catalogue ↗' };
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

/** Public markers inside the GA wall: ADS-B aircraft, transit buses, parked shared scooters, weather/hydro stations, USGS gauges and earthquakes, FAA TFRs, and OSM-mapped public-safety infrastructure (idempotent). */
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
      pulse: (layer === 'aircraft' && !!m.props.emergency) || (layer === 'tfr' && tfrState(m.props, now) === 'active'),
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
      if (layer === 'aircraft') {
        const adsb = ms.filter((m) => typeof m.props.gpsNacp === 'number');
        reportGaFeed(map, {
          id: 'gps-integrity', label: 'ADS-B GPS accuracy (NACp ≤ 7)', color: '#f43f5e', count: adsb.filter(lowGps).length,
          detail: `of ${adsb.length} ADS-B aircraft reporting accuracy · low values can mean GPS interference or older avionics`,
          updatedAt: newest ?? d.generatedAt ?? null,
          sourceUrl: d.sourceUrl ?? '',
        });
      }
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
