import type { Map as MapLibreMap, Popup } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { MAX_AGENTS_DESKTOP, MAX_AGENTS_TOUCH, MAX_FLOW_EDGES, SLOW_MS, carLabel, carStatus, haversineM, labelCandidates, msToMph, TrafficSim, type CarAgent, type LineFlow, type LngLat } from './traffic-sim';
import { FLOW_SOURCE_LAYER, TOMTOM_FLOW_DOCS_URL } from './ga-traffic-flow/flow';
import { GA_TRAFFIC_FLOW_SOURCE } from './ga-traffic-flow-layer';

export const TRAFFIC_SIM_PARAM = 'traffic';
const ROAD_SOURCE = 'ofm-buildings';
const ROAD_CLASSES = ['motorway', 'trunk'];
/** CubeGeometry spans -1..1, so scale is half the car size: 4 m long, 2 m wide, 1.5 m tall. */
const HALF = { length: 2, width: 1, height: 0.75 };
const bound = new WeakSet<MapLibreMap>();

/** SIM vehicles run by default; `?traffic=off` turns them off. */
export function trafficSimEnabled(search: string): boolean {
  return new URLSearchParams(search).get(TRAFFIC_SIM_PARAM) !== 'off';
}

/** Motorway/trunk polylines currently loaded from the OpenFreeMap road tiles, de-duplicated across tiles. */
function motorwayLines(map: MapLibreMap): LngLat[][] {
  if (!map.getSource(ROAD_SOURCE)) return [];
  const seen = new Set<string>();
  const out: LngLat[][] = [];
  const feats = map.querySourceFeatures(ROAD_SOURCE, { sourceLayer: 'transportation', filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]] as never });
  for (const f of feats) {
    const g = f.geometry;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const p of parts) {
      const key = p.map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';');
      if (p.length < 2 || seen.has(key)) continue;
      seen.add(key);
      out.push(p as LngLat[]);
    }
  }
  return out;
}

/** Road lines (the 2,000 longest) from the loaded TomTom flow tiles with each line's `traffic_level` / `road_closure`, de-duplicated across tiles. */
export function tomtomFlowLines(map: MapLibreMap): { lines: LngLat[][]; flows: LineFlow[]; keys: string[] } {
  const lines: LngLat[][] = [];
  const flows: LineFlow[] = [];
  const keys: string[] = [];
  if (!map.getSource(GA_TRAFFIC_FLOW_SOURCE)) return { lines, flows, keys };
  const seen = new Set<string>();
  for (const f of map.querySourceFeatures(GA_TRAFFIC_FLOW_SOURCE, { sourceLayer: FLOW_SOURCE_LAYER })) {
    const g = f.geometry;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    const level = typeof f.properties?.traffic_level === 'number' ? f.properties.traffic_level : null;
    const closed = f.properties?.road_closure != null && f.properties.road_closure !== false;
    for (const p of parts) {
      const key = p.map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';');
      if (p.length < 2 || seen.has(key)) continue;
      seen.add(key);
      lines.push(p as LngLat[]);
      flows.push({ level, closed });
      keys.push(key);
    }
  }
  if (lines.length <= MAX_FLOW_EDGES) return { lines, flows, keys };
  const len = (l: LngLat[]) => l.reduce((s, c, i) => (i ? s + haversineM(l[i - 1], c) : 0), 0);
  const keep = lines.map((l, i) => [len(l), i] as const).sort((a, b) => b[0] - a[0]).slice(0, MAX_FLOW_EDGES).map(([, i]) => i);
  return { lines: keep.map((i) => lines[i]), flows: keep.map((i) => flows[i]), keys: keep.map((i) => keys[i]) };
}

/**
 * SIMULATED cars (not real vehicles) on motorways in view, drawn as GPU-instanced boxes in a dedicated deck.gl
 * overlay. On by default, off with `?traffic=off`; see `trafficSimEnabled`.
 */
export async function addGaTrafficSim(map: MapLibreMap): Promise<void> {
  if (typeof window === 'undefined' || bound.has(map)) return;
  bound.add(map);
  if (!trafficSimEnabled(window.location.search)) {
    bound.delete(map);
    return;
  }
  const cap = window.matchMedia('(pointer: coarse)').matches ? MAX_AGENTS_TOUCH : MAX_AGENTS_DESKTOP;
  const [{ Popup: PopupCtor }, { MapLibreOverlay }, { SimpleMeshLayer }, { TextLayer }, { CubeGeometry }] = await Promise.all([import('maplibre-gl'), import('@deck.gl/maplibre'), import('@deck.gl/mesh-layers'), import('@deck.gl/layers'), import('@luma.gl/engine')]);
  const mesh = new CubeGeometry();
  const overlay = new MapLibreOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);
  let sim = new TrafficSim([], cap);
  let raf = 0;
  let last = performance.now();
  let frame = 0;
  let simKeys: string[] = [];
  let selected: { car: CarAgent; popup: Popup; rows: HTMLElement[]; at: number } | null = null;

  const fillPopup = (rows: HTMLElement[], a: CarAgent) => {
    const kmh = a.speed * 3.6;
    rows[0].textContent = `Car ID: ${a.id}`;
    rows[1].textContent = `Speed: ${msToMph(a.speed).toFixed(1)} mph (${kmh.toFixed(1)} km/h)`;
    rows[2].textContent = `Location: ${a.position[1].toFixed(5)}, ${a.position[0].toFixed(5)}`;
    const st = carStatus(a);
    rows[3].textContent = `Status: ${st.label}`;
    rows[3].style.color = st.color;
  };
  const closeSelected = () => {
    const s = selected;
    selected = null;
    s?.popup.remove();
  };
  const openPopup = (car: CarAgent) => {
    closeSelected();
    const box = document.createElement('div');
    box.style.cssText = 'font:12px/1.4 ui-monospace,monospace;color:#d0e8ff';
    const head = document.createElement('div');
    head.style.cssText = 'font-weight:700;color:#00ffff';
    head.textContent = 'SIM vehicle (simulated, not a real car)';
    const rows = [0, 1, 2, 3].map(() => box.appendChild(document.createElement('div')));
    box.prepend(head);
    fillPopup(rows, car);
    const popup = new PopupCtor({ closeButton: true, closeOnClick: false, maxWidth: 'min(300px, 90vw)' }).setLngLat(car.position).setDOMContent(box).addTo(map);
    const s = { car, popup, rows, at: performance.now() };
    selected = s;
    popup.on('close', () => {
      if (selected === s) selected = null;
    });
  };

  const rebuild = () => {
    const tt = tomtomFlowLines(map);
    const onFlow = tt.lines.length > 0;
    const lines = onFlow ? tt.lines : motorwayLines(map);
    const elev = lines.map((l) => l.map((c) => map.queryTerrainElevation(c) ?? 0));
    sim = new TrafficSim(lines, cap, elev, onFlow ? tt.flows : undefined);
    simKeys = onFlow ? tt.keys : [];
    closeSelected();
    const jam = sim.agents.filter((a) => a.speed < SLOW_MS).length;
    reportGaFeed(map, {
      id: 'traffic-sim',
      label: 'SIM vehicles',
      color: '#00ffff',
      count: sim.agents.length,
      detail: onFlow
        ? `${sim.edges.length} TomTom flow lines in view · speed = 100 km/h nominal × TomTom speed ratio, 5–80/km by jamFactor · cap ${cap}`
        : `${sim.edges.length} motorway lines in view · 30% of each line jammed (80/km, 15 km/h), rest 5/km at 100 km/h · cap ${cap}`,
      updatedAt: new Date().toISOString(),
      sourceUrl: onFlow ? TOMTOM_FLOW_DOCS_URL : 'https://openfreemap.org/',
      swatches: [
        { label: onFlow ? 'SIM under 36 km/h' : 'simulated jam', color: '#ff0000', count: jam },
        { label: onFlow ? 'SIM 36 km/h or faster' : 'simulated free flow', color: '#00ffff', count: sim.agents.length - jam },
      ],
    });
  };
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const onMoveEnd = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => map.once('idle', rebuild), 300);
  };

  const draw = (now: number) => {
    const cars = sim.tick(Math.min(100, now - last));
    last = now;
    frame++;
    if (selected) {
      selected.popup.setLngLat(selected.car.position);
      if (now - selected.at > 250) {
        fillPopup(selected.rows, selected.car);
        selected.at = now;
      }
    }
    const c = map.getCenter();
    const labelled = labelCandidates(cars, [c.lng, c.lat], map.getZoom());
    overlay.setProps({
      layers: [
        new SimpleMeshLayer<CarAgent>({
          id: 'ga-traffic-sim-cars',
          data: cars,
          mesh,
          getPosition: (d) => [d.position[0], d.position[1], d.elevM + HALF.height],
          getOrientation: (d) => [0, -d.bearing, 0],
          getScale: [HALF.width, HALF.length, HALF.height],
          getColor: (d) => (d.speed < SLOW_MS ? [255, 0, 0, 255] : [0, 255, 255, 255]),
          material: { ambient: 0.5, diffuse: 0.6, shininess: 32, specularColor: [60, 64, 70] },
          updateTriggers: { getPosition: frame, getOrientation: frame, getColor: frame },
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return false;
            openPopup(object);
            return true;
          },
        }),
        new TextLayer<CarAgent>({
          id: 'ga-traffic-sim-labels',
          data: labelled,
          visible: labelled.length > 0,
          getPosition: (d) => [d.position[0], d.position[1], d.elevM + 2.5],
          getText: carLabel,
          getSize: 12,
          getColor: [255, 255, 255, 255],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          fontFamily: 'ui-monospace, monospace',
          background: true,
          getBackgroundColor: [10, 14, 20, 200],
          backgroundPadding: [3, 1],
          updateTriggers: { getPosition: frame, getText: frame },
        }),
      ],
    });
    raf = requestAnimationFrame(draw);
  };

  const onFlowData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId !== GA_TRAFFIC_FLOW_SOURCE || !e.isSourceLoaded) return;
    map.off('sourcedata', onFlowData);
    onMoveEnd();
  };
  /** After the 60 s tile refresh, re-read TomTom flow for the lines already simulated so cars speed up or slow down in place. */
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshFlows = () => {
    if (!simKeys.length) return;
    const tt = tomtomFlowLines(map);
    const byKey = new Map(tt.keys.map((k, i) => [k, tt.flows[i]] as const));
    sim.updateFlows(simKeys.map((k) => byKey.get(k)));
  };
  const onFlowRefresh = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId !== GA_TRAFFIC_FLOW_SOURCE || !e.isSourceLoaded) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshFlows, 500);
  };
  map.on('sourcedata', onFlowData);
  map.on('sourcedata', onFlowRefresh);
  map.on('moveend', onMoveEnd);
  if (map.loaded()) rebuild();
  else map.once('idle', rebuild);
  raf = requestAnimationFrame(draw);
  map.once('remove', () => {
    cancelAnimationFrame(raf);
    clearTimeout(debounce);
    closeSelected();
    map.off('moveend', onMoveEnd);
    map.off('sourcedata', onFlowData);
    map.off('sourcedata', onFlowRefresh);
    clearTimeout(refreshTimer);
    bound.delete(map);
  });
}
