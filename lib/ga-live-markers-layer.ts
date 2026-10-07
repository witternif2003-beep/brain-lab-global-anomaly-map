import { Popup } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, offset, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { setGaDeckGroup, type GaDeckItem } from './ga-deck-overlay';
import { hexToRgba } from './ga-point-colors';
import type { GaIconShape } from './ga-marker-icons';
import type { GaModelKind } from './ga-mesh-models';
import { box } from './ga-orbital-layer';
import type { LiveLayer, LiveMarker, LiveValue } from './ga-live-markers/parse';
import type { CameraState } from './ga-live-markers/snapshot';

interface Payload {
  generatedAt?: string;
  refreshSeconds?: number;
  source?: string;
  sourceUrl?: string;
  feeds?: { id: string; count: number | null; unplaced?: number | null; error: string | null }[];
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
  dateOnly?: boolean;
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
const topCounts = (ms: LiveMarker[], key: string, n: number) => countBy(ms, key).split(', ').slice(0, n).join(', ');

const SPECS: Record<LiveLayer, Spec> = {
  gdotcams: {
    label: 'GDOT traffic cameras (511GA)', color: '#1d4ed8', stroke: '#ef4444', radiusPx: 3.5, z: 24, refreshMs: 60 * 60_000,
    iconPx: 16, labelMinZoom: 15, dateOnly: true,
    icon: () => ({ shape: 'camera' }),
    tag: (m) => String(m.props.camera ?? ''),
    title: (m) => `GDOT CAMERA · ${m.label}`,
    rows: (p) => [
      ['Camera', fmt(p.camera)],
      ['Roadway', `${fmt(p.roadway)}${p.direction ? ` · ${p.direction}` : ''}`],
      ['Image', p.imageUrl ? 'live picture from 511ga.org, checked and refreshed every 60 s while open' : 'no enabled view published by GDOT'],
      ['Video', 'GDOT video streams need a 511GA login, so only the live picture is shown'],
    ],
    detail: (ms) => {
      const n = (s: CameraState) => ms.filter((m) => cameraState(m) === s).length;
      return `${n('live')} verified live (blue) · ${n('offline')} with no live picture (gray) · ${ms.length - n('live') - n('offline')} not checked yet (amber), zoom in to check`;
    },
  },
  augusta911: {
    label: 'Augusta E911 calls, last 24 h', color: '#ef4444', stroke: '#1d4ed8', radiusPx: 4.5, z: 29, refreshMs: 2 * 60_000,
    iconPx: 20, labelMinZoom: 12,
    icon: () => ({ shape: 'alert' }),
    tag: (m) => m.label,
    title: (m) => `AUGUSTA E911 · ${m.label}`,
    rows: (p) => [
      ['Location', fmt(p.location)],
      ['Posted', when(p.postedAt)],
      ['Post delay', fmt(p.postDelayMin, ' min after call time')],
      ['Placed by', `${fmt(p.placedBy)}${p.approximate ? ' · APPROXIMATE' : ''}`],
      ['Matched', fmt(p.matched)],
      ['Match score', fmt(p.matchScore)],
    ],
    detail: (ms) => (ms.length ? `${topCounts(ms, 'callType', 3)} · ${ms.filter((m) => m.props.approximate).length} approximate` : 'no calls posted in the last 24 h'),
  },
  athens911: {
    label: 'Athens-Clarke PD calls, last 7 days', color: '#2563eb', stroke: '#ef4444', radiusPx: 3, z: 28, refreshMs: 30 * 60_000,
    iconPx: 14, labelMinZoom: 15, dateOnly: true,
    icon: () => ({ shape: 'beacon' }),
    tag: (m) => m.label,
    title: (m) => `ATHENS-CLARKE PD · ${m.label}`,
    rows: (p) => [
      ['Incident', fmt(p.incident)],
      ['Call source', fmt(p.callSource)],
      ['Date', `${fmt(p.date)} (date only, no time published)`],
      ['Personnel', fmt(p.personnel)],
      ['Position', 'exact point published by Athens-Clarke County'],
    ],
    detail: (ms) => {
      const newest = ms.reduce((a, m) => (String(m.props.date ?? '') > a ? String(m.props.date) : a), '');
      return ms.length ? `${ms.filter((m) => m.props.callSource === '911').length} via 911 · newest date ${newest} · unfiltered` : 'no calls dated in the last 7 days';
    },
  },
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

const FT_TO_M = 0.3048;
const STATIC_MODEL: Partial<Record<LiveLayer, GaModelKind>> = {
  transit: 'bus', micromobility: 'scooter', stations: 'weather', streamgauges: 'gauge', signals: 'signal',
  police: 'police', firestations: 'firestation', sirens: 'siren', speedcams: 'speedcam', alpr: 'alpr', gdotcams: 'speedcam',
};
/** ADS-B emitter category → generic airframe model and scale (DO-260B: A1 light, A2 small, A3 large, A4 high-vortex, A5 heavy, A6 high-performance, A7 rotorcraft). */
const AIRFRAME: Record<string, [GaModelKind, number]> = {
  A1: ['lightplane', 1], A2: ['lightplane', 1.6], A3: ['airliner', 0.9], A4: ['airliner', 1.1], A5: ['airliner', 1.7], A6: ['lightplane', 1.4], A7: ['helicopter', 1],
};

function modelFor(layer: LiveLayer, m: LiveMarker): GaDeckItem['model'] {
  if (layer === 'aircraft') {
    const [kind, s] = AIRFRAME[String(m.props.category)] ?? ['airliner', 0.8];
    const ft = Number(m.props.altFt);
    return { kind, scale: [s, s, s], elevM: m.props.onGround || !Number.isFinite(ft) ? 0 : Math.max(0, ft * FT_TO_M) };
  }
  if (layer === 'towers') {
    const h = Number(m.props.heightM);
    return { kind: 'tower', scale: [1, 1, Number.isFinite(h) && h > 0 ? Math.min(10, Math.max(0.2, h / 60)) : 1] };
  }
  const kind = STATIC_MODEL[layer];
  return kind ? { kind } : undefined;
}

function sourceLink(layer: LiveLayer, m: LiveMarker): { href: string; text: string } {
  if (m.props.osm) return { href: `https://www.openstreetmap.org/${m.props.osm}`, text: 'OpenStreetMap ↗' };
  if (layer === 'tfr' && m.props.notam) return { href: `https://tfr.faa.gov/tfr3/?page=detail_${String(m.props.notam).replace('/', '_')}`, text: 'FAA TFR page ↗' };
  if (layer === 'streamgauges') return { href: `https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(String(m.props.site))}/`, text: 'USGS site page ↗' };
  if (layer === 'stations') return { href: `https://mesonet.agron.iastate.edu/sites/site.php?station=${encodeURIComponent(String(m.props.station))}&network=${encodeURIComponent(String(m.props.network))}`, text: 'IEM station page ↗' };
  if (layer === 'quakes' && m.props.url) return { href: String(m.props.url), text: 'USGS event page ↗' };
  if (layer === 'gdotcams') return { href: 'https://511ga.org/cctv', text: '511GA cameras ↗' };
  if (layer === 'augusta911') return m.props.postUrl ? { href: String(m.props.postUrl), text: 'Augusta E911 post ↗' } : { href: 'https://www.augustaga.gov/66/E911-Emergency-Services', text: 'Augusta E911 ↗' };
  if (layer === 'athens911') return { href: 'https://services2.arcgis.com/xSEULKvB31odt3XQ/arcgis/rest/services/Incidents_accpd_Public/FeatureServer/0', text: 'ACCPD public ArcGIS layer ↗' };
  if (layer === 'aircraft') return { href: `https://adsb.lol/?lat=${m.lat}&lon=${m.lon}&zoom=11`, text: 'Open area in adsb.lol ↗' };
  if (layer === 'transit') return m.props.agency === 'MARTA' ? { href: 'https://itsmarta.com/', text: 'MARTA ↗' } : { href: 'https://mobilitydatabase.org/', text: 'Mobility Database feed catalogue ↗' };
  return { href: 'https://github.com/MobilityData/gbfs', text: 'GBFS specification ↗' };
}

const CAMERA_REFRESH_MS = 60_000;
/** Cameras in view are checked from this zoom (about 2 mi across a phone screen). */
const CAMERA_VERIFY_MIN_ZOOM = 13;
const CAMERA_VERIFY_MAX = 40;
const CAMERA_VERIFY_PARALLEL = 6;
const CAMERA_STATUS_TTL_MS = 5 * 60_000;
const cameraStatus = new Map<string, { state: CameraState; at: number }>();
const cameraState = (m: LiveMarker): CameraState | null => (typeof m.props.imageUrl === 'string' ? cameraStatus.get(m.props.imageUrl)?.state ?? null : 'offline');

/** Asks /api/ga-camera for a fresh 511GA picture; it answers with the image only when it is a real frame, not a "no live feed" placeholder. */
async function checkCamera(url: string): Promise<{ state: CameraState; blob: Blob | null }> {
  let state: CameraState = 'offline';
  let blob: Blob | null = null;
  try {
    const view = url.split('/').pop() ?? '';
    const r = await fetch(`/api/ga-camera?view=${encodeURIComponent(view)}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (r.ok && r.headers.get('x-camera-state') === 'live') {
      state = 'live';
      blob = await r.blob();
    }
  } catch {
    state = 'offline';
  }
  cameraStatus.set(url, { state, at: Date.now() });
  return { state, blob };
}

function popupFor(layer: LiveLayer, onCameraChecked?: () => void) {
  return (map: MapLibreMap, lngLat: LngLat, props: Record<string, unknown>) => {
    const m = props.marker as LiveMarker;
    const link = sourceLink(layer, m);
    const rows = SPECS[layer].dateOnly ? SPECS[layer].rows(m.props) : [...SPECS[layer].rows(m.props), ['Reported', m.observedAt ? new Date(m.observedAt).toLocaleString() : ''] as [string, string]];
    const el = box(SPECS[layer].title(m), rows, link.href, link.text);
    const popup = new Popup({ closeButton: true, maxWidth: layer === 'gdotcams' ? 'min(480px, 94vw)' : 'min(300px, 90vw)' }).setLngLat(lngLat);
    if (layer === 'gdotcams' && typeof m.props.imageUrl === 'string') {
      const src = m.props.imageUrl;
      const img = document.createElement('img');
      const stamp = document.createElement('div');
      img.alt = `GDOT camera ${m.label}`;
      img.style.cssText = 'display:none;width:100%;aspect-ratio:16/9;object-fit:contain;background:#0f172a;margin:4px 0';
      stamp.style.cssText = 'font:10px ui-monospace,monospace;color:#475569';
      stamp.textContent = 'checking camera…';
      let objectUrl = '';
      let open = true;
      const refresh = async () => {
        const { blob } = await checkCamera(src);
        if (!open) return;
        onCameraChecked?.();
        const t = new Date().toLocaleTimeString();
        if (blob) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
          img.style.display = 'block';
          stamp.textContent = `LIVE CAMERA · real 511GA camera picture, not a placeholder · checked ${t} · rechecked every 60 s`;
          stamp.style.color = '#15803d';
        } else {
          img.style.display = 'none';
          stamp.textContent = `NO LIVE PICTURE at ${t}: 511GA is serving its "stream not available" image for this camera · rechecking every 60 s`;
          stamp.style.color = '#b91c1c';
        }
      };
      void refresh();
      const timer = window.setInterval(() => void refresh(), CAMERA_REFRESH_MS);
      popup.on('close', () => {
        open = false;
        window.clearInterval(timer);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
      el.insertBefore(stamp, el.children[1] ?? null);
      el.insertBefore(img, stamp);
    }
    popup.setDOMContent(el).addTo(map);
  };
}

function aircraftCoord(m: LiveMarker, now: number): LngLat {
  const gs = Number(m.props.gsKt);
  const track = Number(m.props.track);
  if (m.props.onGround || !m.observedAt || !Number.isFinite(gs) || !Number.isFinite(track) || m.props.gsKt === null || m.props.track === null) return [m.lon, m.lat];
  const dt = Math.min(DEAD_RECKON_MAX_S, Math.max(0, (now - Date.parse(m.observedAt)) / 1000));
  return offset([m.lon, m.lat], ((90 - track) * Math.PI) / 180, gs * KT_TO_MS * dt);
}

/** Public markers inside the GA wall: ADS-B aircraft, transit buses, parked shared scooters, weather/hydro stations, USGS gauges and earthquakes, FAA TFRs, Augusta E911 and Athens-Clarke PD calls for service, GDOT 511GA traffic cameras, and OSM-mapped public-safety infrastructure (idempotent). */
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
    const items: GaDeckItem[] = ms.map((m) => {
      const cam = layer === 'gdotcams' ? cameraState(m) : 'live';
      return {
      coord: layer === 'aircraft' ? aircraftCoord(m, now) : [m.lon, m.lat],
      radiusPx: spec.radiusPx,
      ...toIcon(spec.icon(m)),
      iconPx: spec.iconPx,
      label: spec.tag?.(m) || undefined,
      model: modelFor(layer, m),
      fill: cam === 'offline' || (layer === 'micromobility' && m.props.disabled) ? hexToRgba('#64748b', 200) : cam === null ? hexToRgba('#f59e0b', 220) : layer === 'aircraft' && m.props.emergency ? hexToRgba('#ef4444') : fill,
      stroke,
      strokePx: layer === 'micromobility' ? 0.5 : 1,
      pulse: (layer === 'aircraft' && !!m.props.emergency) || (layer === 'tfr' && tfrState(m.props, now) === 'active'),
      props: { marker: m },
      };
    });
    setGaDeckGroup(map, layer, { z: spec.z, labelMinZoom: spec.labelMinZoom, items, onClick: popupFor(layer, layer === 'gdotcams' ? camerasChanged : undefined) });
  };

  const reports: Partial<Record<LiveLayer, () => void>> = {};
  const camerasChanged = () => {
    render('gdotcams');
    reports.gdotcams?.();
  };
  let verifying = false;
  /** Checks the cameras in view (nearest the centre first) once zoomed in, so each is colored by whether 511GA has a real picture for it. */
  const verifyCamerasInView = async () => {
    if (verifying || map.getZoom() < CAMERA_VERIFY_MIN_ZOOM) return;
    const b = map.getBounds();
    const c = map.getCenter();
    const now = Date.now();
    const todo = (current.gdotcams ?? [])
      .filter((m) => typeof m.props.imageUrl === 'string' && b.contains([m.lon, m.lat]) && now - (cameraStatus.get(String(m.props.imageUrl))?.at ?? 0) > CAMERA_STATUS_TTL_MS)
      .sort((a, d) => Math.hypot(a.lon - c.lng, a.lat - c.lat) - Math.hypot(d.lon - c.lng, d.lat - c.lat))
      .slice(0, CAMERA_VERIFY_MAX);
    if (!todo.length) return;
    verifying = true;
    try {
      const queue = [...todo];
      let done = 0;
      await Promise.all(Array.from({ length: CAMERA_VERIFY_PARALLEL }, async () => {
        for (let m = queue.shift(); m; m = queue.shift()) {
          await checkCamera(String(m.props.imageUrl));
          if (++done % CAMERA_VERIFY_PARALLEL === 0) camerasChanged();
        }
      }));
    } finally {
      verifying = false;
      camerasChanged();
    }
  };
  const onMoveEnd = () => void verifyCamerasInView();
  map.on('moveend', onMoveEnd);

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
      const unplaced = (d.feeds ?? []).reduce((a, f) => a + (f.unplaced ?? 0), 0);
      const newest = ms.reduce<string | null>((a, m) => (m.observedAt && (!a || m.observedAt > a) ? m.observedAt : a), null);
      reports[layer] = () => reportGaFeed(map, {
        id: layer, label: spec.label, color: spec.color, count: ms.length,
        detail: `${spec.detail(ms)}${unplaced ? ` · ${unplaced} not placed (no map location)` : ''} · refresh ${Math.round(spec.refreshMs / 1000)} s`,
        updatedAt: newest ?? d.generatedAt ?? null,
        sourceUrl: d.sourceUrl ?? '',
        error: failed.length ? `unavailable: ${failed.map((f) => `${f.id} (${f.error})`).join(', ')}` : null,
      });
      reports[layer]();
      if (layer === 'gdotcams') void verifyCamerasInView();
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
    map.off('moveend', onMoveEnd);
    bound.delete(map);
  });
}
