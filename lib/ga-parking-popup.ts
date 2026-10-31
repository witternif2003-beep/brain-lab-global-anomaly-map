import { Popup, type Map as MapLibreMap, type MapGeoJSONFeature } from 'maplibre-gl';
import { checkCamera } from './ga-live-markers-layer';
import { GA_STORE_LAYERS } from './ga-retail-parking-layer';
import type { LiveMarker } from './ga-live-markers/parse';
import { fmtArea, fmtDistance, nearest, nwsObservationText, osmRefFromPoiId, parkingTagRows, parseOsmElement, ringAreaM2, type OsmRef } from './ga-parking-details';
const CAMERA_REFRESH_MS = 60_000;
const WEATHER_REFRESH_MS = 5 * 60_000;
const CAMERA_MAX_M = 3_000;
const STORE_MAX_M = 1_000;
const NWS_HEADERS = { Accept: 'application/geo+json' };

let camerasP: Promise<LiveMarker[]> | null = null;
const gdotCameras = () =>
  (camerasP ??= fetch('/api/ga-live-markers?layer=gdotcams')
    .then((r) => (r.ok ? r.json() : { markers: [] }))
    .then((j: { markers?: LiveMarker[] }) => (j.markers ?? []).filter((m) => typeof m.props.imageUrl === 'string'))
    .catch(() => { camerasP = null; return []; }));

const stationByCell = new Map<string, Promise<{ id: string; name: string } | null>>();
function nwsStation(at: [number, number]) {
  const key = `${at[1].toFixed(2)},${at[0].toFixed(2)}`;
  let p = stationByCell.get(key);
  if (!p) {
    p = fetch(`https://api.weather.gov/points/${at[1].toFixed(4)},${at[0].toFixed(4)}`, { headers: NWS_HEADERS })
      .then((r) => r.json())
      .then((j) => fetch(j.properties.observationStations, { headers: NWS_HEADERS }))
      .then((r) => r.json())
      .then((j) => { const s = j.features?.[0]?.properties; return s ? { id: String(s.stationIdentifier), name: String(s.name) } : null; })
      .catch(() => { stationByCell.delete(key); return null; });
    stationByCell.set(key, p);
  }
  return p;
}

const CSS = {
  root: 'font:13px/1.5 system-ui,-apple-system,sans-serif;color:#0f172a;min-width:min(300px,82vw);max-height:min(58vh,640px);overflow-y:auto;overscroll-behavior:contain',
  title: 'font-weight:800;font-size:15px;letter-spacing:.02em;margin:0 18px 2px 0',
  sub: 'font:11px ui-monospace,monospace;color:#475569;margin-bottom:6px',
  head: 'font:700 11px ui-monospace,monospace;letter-spacing:.08em;color:#1d4ed8;margin:8px 0 2px;border-top:1px solid #e2e8f0;padding-top:6px',
  row: 'display:flex;gap:8px;justify-content:space-between',
  key: 'color:#475569;flex:none',
  val: 'font-weight:600;text-align:right;overflow-wrap:anywhere',
  stamp: 'font:11px ui-monospace,monospace;color:#475569',
};

function el(tag: string, css: string, text = ''): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
}

function section(root: HTMLElement, title: string) {
  root.append(el('div', CSS.head, title));
  const body = el('div', '');
  body.append(el('div', CSS.stamp, 'loading…'));
  root.append(body);
  return body;
}

function fill(body: HTMLElement, rows: [string, string][], stamp?: { text: string; ok: boolean }, link?: { href: string; text: string }) {
  body.replaceChildren();
  for (const [k, v] of rows) {
    if (!v) continue;
    const r = el('div', CSS.row);
    r.append(el('span', CSS.key, k), el('span', CSS.val, v));
    body.append(r);
  }
  if (stamp) body.append(el('div', `${CSS.stamp};color:${stamp.ok ? '#15803d' : '#b91c1c'}`, stamp.text));
  if (link) {
    const a = el('a', 'font-size:12px') as HTMLAnchorElement;
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.textContent = link.text;
    body.append(a);
  }
}

const clock = () => new Date().toLocaleTimeString();

async function loadOsm(body: HTMLElement, ref: OsmRef | null) {
  if (!ref) return fill(body, [], { text: 'no OpenStreetMap id on this point', ok: false });
  const url = `https://api.openstreetmap.org/api/0.6/${ref.type}/${ref.id}${ref.type === 'way' ? '/full' : ''}.json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const got = parseOsmElement(await r.json(), ref);
    if (!got) throw new Error('element missing from response');
    const { el: e, ring } = got;
    fill(body, [
      ...parkingTagRows(e.tags ?? {}),
      ['Lot area', ring ? fmtArea(ringAreaM2(ring)) : ''],
      ['Last OSM edit', e.timestamp ? `${new Date(e.timestamp).toLocaleDateString()} (v${e.version ?? '?'})` : ''],
    ], { text: `live OSM record as of ${new Date().toLocaleString()}${e.timestamp ? ` · nobody has changed it since ${new Date(e.timestamp).toLocaleDateString()}` : ''}`, ok: true }, { href: `https://www.openstreetmap.org/${ref.type}/${ref.id}`, text: `OpenStreetMap ${ref.type} ${ref.id} ↗` });
  } catch (err) {
    fill(body, [], { text: `OpenStreetMap API unavailable (${String(err)})`, ok: false }, { href: `https://www.openstreetmap.org/${ref.type}/${ref.id}`, text: 'Open on OpenStreetMap ↗' });
  }
}

function loadStore(body: HTMLElement, map: MapLibreMap, at: [number, number]) {
  const stores = map.queryRenderedFeatures({ layers: GA_STORE_LAYERS.filter((id) => map.getLayer(id)) })
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => { const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates; return { lon, lat, name: String(f.properties?.name ?? '') }; });
  const hit = nearest(stores, at, STORE_MAX_M);
  fill(body, hit ? [['Store', hit.item.name], ['Distance', fmtDistance(hit.m)]] : [], hit ? undefined : { text: `no big-box store mapped within ${fmtDistance(STORE_MAX_M)} in this view`, ok: false });
}

function loadCamera(body: HTMLElement, at: [number, number], isOpen: () => boolean) {
  const img = el('img', 'display:none;width:100%;aspect-ratio:16/9;object-fit:contain;background:#0f172a;border-radius:4px;margin:4px 0') as HTMLImageElement;
  let objectUrl = '';
  let cam: { item: LiveMarker; m: number } | null = null;
  const refresh = async () => {
    if (!cam) {
      cam = nearest(await gdotCameras(), at, CAMERA_MAX_M);
      if (!cam) return fill(body, [], { text: `no GDOT camera within ${fmtDistance(CAMERA_MAX_M)}`, ok: false });
    }
    const { blob } = await checkCamera(String(cam.item.props.imageUrl));
    if (!isOpen()) return;
    if (blob) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      img.style.display = 'block';
    } else img.style.display = 'none';
    fill(body, [['Camera', cam.item.label], ['Distance', fmtDistance(cam.m)], ['Roadway', String(cam.item.props.roadway ?? '')]],
      blob ? { text: `LIVE 511GA picture · checked ${clock()} · refreshes every 60 s · roadway view, not this lot`, ok: true } : { text: `no live picture at ${clock()} · rechecking every 60 s`, ok: false },
      { href: 'https://511ga.org/cctv', text: '511GA cameras ↗' });
    body.prepend(img);
  };
  void refresh();
  const t = window.setInterval(() => void refresh(), CAMERA_REFRESH_MS);
  return () => { window.clearInterval(t); if (objectUrl) URL.revokeObjectURL(objectUrl); };
}

function loadWeather(body: HTMLElement, at: [number, number], isOpen: () => boolean) {
  const refresh = async () => {
    const st = await nwsStation(at);
    if (!st) return fill(body, [], { text: 'NWS weather API unavailable', ok: false });
    try {
      const r = await fetch(`https://api.weather.gov/stations/${st.id}/observations/latest`, { headers: NWS_HEADERS, cache: 'no-store' });
      const p = (await r.json()).properties;
      if (!isOpen()) return;
      fill(body, [['Station', `${st.id} · ${st.name}`], ['Now', nwsObservationText(p)], ['Observed', p.timestamp ? new Date(p.timestamp).toLocaleString() : '']],
        { text: `NWS latest observation · fetched ${clock()} · refreshes every 5 min`, ok: true },
        { href: `https://api.weather.gov/stations/${st.id}/observations/latest`, text: 'NWS observation ↗' });
    } catch (err) {
      fill(body, [], { text: `NWS observation unavailable (${String(err)})`, ok: false });
    }
  };
  void refresh();
  const t = window.setInterval(() => void refresh(), WEATHER_REFRESH_MS);
  return () => window.clearInterval(t);
}

/** Parking-lot popup: the lot's current OSM record and area, plus the nearest live GDOT camera, NWS observation and big-box store. */
export function openParkingPopup(map: MapLibreMap, f: MapGeoJSONFeature, click: [number, number], kind: 'lot' | 'store' = 'lot') {
  const at: [number, number] = f.geometry.type === 'Point' ? ((f.geometry as GeoJSON.Point).coordinates as [number, number]) : click;
  const ref = osmRefFromPoiId(f.id);
  const root = el('div', CSS.root);
  root.append(
    el('div', CSS.title, `${kind === 'store' ? 'STORE' : 'PARKING'} · ${String(f.properties?.name ?? '') || `unnamed ${kind}`}`),
    el('div', CSS.sub, `${at[1].toFixed(5)}, ${at[0].toFixed(5)} · ${kind === 'store' ? 'mapped store, not a live shopper count' : 'mapped lot, not a live occupancy count'}`),
  );
  let open = true;
  const isOpen = () => open;
  void loadOsm(section(root, `${kind === 'store' ? 'STORE' : 'LOT'} · OPENSTREETMAP`), ref);
  if (kind === 'lot') loadStore(section(root, 'NEAREST BIG-BOX STORE'), map, at);
  const stopCam = loadCamera(section(root, 'NEAREST LIVE TRAFFIC CAMERA · GDOT 511GA'), at, isOpen);
  const stopWx = loadWeather(section(root, 'WEATHER NOW · NWS'), at, isOpen);
  const popup = new Popup({ closeButton: true, anchor: 'bottom', maxWidth: 'min(440px, 94vw)' }).setLngLat(at).setDOMContent(root).addTo(map);
  popup.on('close', () => { open = false; stopCam(); stopWx(); });
  map.easeTo({ center: at, offset: [0, Math.round(map.getContainer().clientHeight * 0.3)], duration: 400 });
}
