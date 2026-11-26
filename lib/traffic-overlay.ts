import type { Map as MapLibreMap, Popup } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { cappedPixelRatio, isTouchDevice, overlayContextAttributes, qualityTouch } from './map/touch-gpu-budget';
import { MAX_AGENTS_DESKTOP, MAX_AGENTS_TOUCH, MAX_FLOW_EDGES, SLOW_MS, carLabel, carStatus, haversineM, labelCandidates, msToMph, TrafficSim, type CarAgent, type LineFlow, type LngLat } from './traffic-sim';
import { FLOW_COLORS, FLOW_SOURCE_LAYER, TOMTOM_FLOW_DOCS_URL, flowBand } from './ga-traffic-flow/flow';
import { FLOW_LINE_OPACITY, FLOW_LINE_WIDTH, GA_TRAFFIC_FLOW_LAYER, GA_TRAFFIC_FLOW_SOURCE, enableSegmentReadout } from './ga-traffic-flow-layer';
import { BRIDGE_LAYER_M, bridgeLine, bridgeWays, buildBridgeIndex, deckProfile, flowStripePolygons, groundRuns, levelSharedDecks, mergeBridgeWays, osmDeckPolygons, profiledBridgeIndex, type BridgeIndex, type BridgedLine, type DeckFeature } from './traffic-bridges';
import { BRIDGE_DECK_MIN_ZOOM, ROAD_CLASSES as OVERLAY_ROAD_CLASSES, ROAD_LINE_COLOR, ROAD_WIDTH_M } from './ga-roads-overlay';
import { CAR_DIMS_M, carMesh } from './car-mesh';

export const TRAFFIC_SIM_PARAM = 'traffic';
const ROAD_SOURCE = 'ofm-buildings';
const ROAD_CLASSES = ['motorway', 'trunk'];
/** Lifts the car mesh (wheels-down origin, lib/car-mesh.ts) 5 cm off the road so it doesn't z-fight with the flow line or deck stripe. */
const ROAD_CLEARANCE_M = 0.05;
const bound = new WeakSet<MapLibreMap>();
const trafficCanvases = new WeakMap<MapLibreMap, () => HTMLCanvasElement | null>();

/** The simulated-traffic deck.gl canvas (a separate WebGL2 context), so the GPU ledger can count it. */
export const gaTrafficCanvas = (map: MapLibreMap): HTMLCanvasElement | null => trafficCanvases.get(map)?.() ?? null;
export const BRIDGE_DECK_SOURCE = 'ga-bridge-decks';
export const BRIDGE_DECK_LAYER = 'ga-bridge-decks-3d';

/**
 * Every OSM road bridge (`brunnel=bridge`) of the drawn road classes in the loaded OpenFreeMap tiles, joined across
 * tile cuts and profiled abutment to abutment on the drawn terrain. Empty below BRIDGE_DECK_MIN_ZOOM, where the
 * draped road line still covers bridges.
 */
function osmBridgeProfiles(map: MapLibreMap, groundAt: (c: LngLat) => number): { cls: string; line: BridgedLine }[] {
  if (!map.getSource(ROAD_SOURCE) || map.getZoom() < BRIDGE_DECK_MIN_ZOOM) return [];
  const feats = map.querySourceFeatures(ROAD_SOURCE, { sourceLayer: 'transportation', filter: ['==', ['get', 'brunnel'], 'bridge'] as never });
  return mergeBridgeWays(bridgeWays(feats, OVERLAY_ROAD_CLASSES)).map((w) => ({ cls: w.cls, line: deckProfile(w, groundAt) }));
}

export const FLOW_GROUND_SOURCE = 'ga-traffic-flow-ground';
export const FLOW_GROUND_LAYER = 'ga-traffic-flow-ground-line';

/**
 * From BRIDGE_DECK_MIN_ZOOM the TomTom flow is drawn from the car lines with bridge spans cut out (those spans get
 * stripes on the deck), so a flow line no longer drapes into the valley under a bridge. Below that zoom the tile layer draws as before.
 */
function setFlowGround(map: MapLibreMap, features: unknown[]): void {
  const data = { type: 'FeatureCollection' as const, features };
  const src = map.getSource(FLOW_GROUND_SOURCE) as { setData?: (d: unknown) => void } | undefined;
  if (src?.setData) src.setData(data);
  else map.addSource(FLOW_GROUND_SOURCE, { type: 'geojson', data: data as never });
  if (map.getLayer(FLOW_GROUND_LAYER) || !map.getLayer(GA_TRAFFIC_FLOW_LAYER)) return;
  const order = map.getLayersOrder();
  map.addLayer(
    {
      id: FLOW_GROUND_LAYER,
      type: 'line',
      source: FLOW_GROUND_SOURCE,
      minzoom: BRIDGE_DECK_MIN_ZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'] as never, 'line-opacity': FLOW_LINE_OPACITY, 'line-width': FLOW_LINE_WIDTH },
    },
    order[order.indexOf(GA_TRAFFIC_FLOW_LAYER) + 1],
  );
  const flow = map.getLayer(GA_TRAFFIC_FLOW_LAYER) as { minzoom?: number } | undefined;
  map.setLayerZoomRange(GA_TRAFFIC_FLOW_LAYER, flow?.minzoom ?? 0, BRIDGE_DECK_MIN_ZOOM);
  enableSegmentReadout(map, FLOW_GROUND_LAYER);
}

/** OSM road-bridge deck slabs in the road colour, with TomTom flow-colour stripes on top, drawn below the 3D buildings. */
function setBridgeDecks(map: MapLibreMap, decks: DeckFeature[]): void {
  const data = { type: 'FeatureCollection' as const, features: decks };
  const src = map.getSource(BRIDGE_DECK_SOURCE) as { setData?: (d: unknown) => void } | undefined;
  if (src?.setData) src.setData(data);
  else map.addSource(BRIDGE_DECK_SOURCE, { type: 'geojson', data: data as never });
  if (map.getLayer(BRIDGE_DECK_LAYER)) return;
  map.addLayer(
    {
      id: BRIDGE_DECK_LAYER,
      type: 'fill-extrusion',
      source: BRIDGE_DECK_SOURCE,
      minzoom: 13,
      paint: { 'fill-extrusion-color': ['coalesce', ['get', 'color'], '#4a4f57'] as never, 'fill-extrusion-base': ['get', 'base'] as never, 'fill-extrusion-height': ['get', 'height'] as never, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true },
    },
    map.getLayer('buildings-3d') ? 'buildings-3d' : undefined,
  );
}

/**
 * Car lines come from the TomTom flow tiles and bridges from the OpenFreeMap road tiles; either can finish loading
 * after the view settles. Fires once per source per view (`reset` on moveend), so a sim built on the OSM motorway
 * fallback or before bridges arrived is rebuilt when the late source lands.
 */
export function firstLoadTrigger(sourceIds: readonly string[]): { fire: (e: { sourceId?: string; isSourceLoaded?: boolean }) => boolean; reset: () => void } {
  const done = new Set<string>();
  return {
    fire: (e) => {
      if (!e.sourceId || !sourceIds.includes(e.sourceId) || !e.isSourceLoaded || done.has(e.sourceId)) return false;
      done.add(e.sourceId);
      return true;
    },
    reset: () => done.clear(),
  };
}

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

/** Road lines (the `cap` longest, default 2,000) from the loaded TomTom flow tiles with each line's `traffic_level` / `road_closure`, de-duplicated across tiles. */
export function tomtomFlowLines(map: MapLibreMap, cap = MAX_FLOW_EDGES): { lines: LngLat[][]; flows: LineFlow[]; keys: string[] } {
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
  if (lines.length <= cap) return { lines, flows, keys };
  const keep = longest(lines, cap);
  return { lines: keep.map((i) => lines[i]), flows: keep.map((i) => flows[i]), keys: keep.map((i) => keys[i]) };
}

/** Indices of the `cap` longest lines. */
function longest(lines: LngLat[][], cap: number): number[] {
  const len = (l: LngLat[]) => l.reduce((s, c, i) => (i ? s + haversineM(l[i - 1], c) : 0), 0);
  return lines.map((l, i) => [len(l), i] as const).sort((a, b) => b[0] - a[0]).slice(0, cap).map(([, i]) => i);
}

/**
 * SIMULATED cars (not real vehicles) on motorways in view, drawn as GPU-instanced boxes in a dedicated deck.gl
 * overlay. On by default, off with `?traffic=off`; see `trafficSimEnabled`.
 */
const REBUILD_DEBOUNCE_MS = 400;
/** Road tiles may still be loading when the view settles; retry an empty sim every 2 s for up to 1 minute. */
const EMPTY_RETRY_MS = 2_000;
const EMPTY_RETRY_MAX = 30;

export async function addGaTrafficSim(map: MapLibreMap): Promise<void> {
  if (typeof window === 'undefined' || bound.has(map)) return;
  bound.add(map);
  if (!trafficSimEnabled(window.location.search)) {
    bound.delete(map);
    return;
  }
  const cap = window.matchMedia('(pointer: coarse)').matches ? MAX_AGENTS_TOUCH : MAX_AGENTS_DESKTOP;
  const [{ Popup: PopupCtor }, { MapLibreOverlay }, { SimpleMeshLayer }, { TextLayer }] = await Promise.all([import('maplibre-gl'), import('@deck.gl/maplibre'), import('@deck.gl/mesh-layers'), import('@deck.gl/layers')]);
  const mesh = carMesh();
  const touch = isTouchDevice();
  const webglAttrs = overlayContextAttributes(touch, window.location.search);
  const overlay = new MapLibreOverlay({ interleaved: false, layers: [], useDevicePixels: qualityTouch() ? cappedPixelRatio(window.devicePixelRatio || 1, true) : true, ...(webglAttrs ? { deviceProps: { webgl: webglAttrs } } : {}) });
  map.addControl(overlay);
  trafficCanvases.set(map, () => overlay.getCanvas());
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

  const terrainAt = (c: LngLat) => map.queryTerrainElevation(c) ?? 0;
  let bridges: BridgeIndex = buildBridgeIndex([]);
  let osmDecks: DeckFeature[] = [];
  /** Lifts every TomTom line onto the OSM decks, then redraws the draped flow (bridge spans cut out) and the deck stripes. */
  const drawFlow = (tt: ReturnType<typeof tomtomFlowLines>): BridgedLine[] => {
    const lifted = levelSharedDecks(tt.lines.map((l) => bridgeLine(bridges, l, terrainAt)));
    const color = (i: number) => FLOW_COLORS[flowBand(tt.flows[i].level, tt.flows[i].closed)];
    const stripes = lifted.flatMap((b, i) => (b.onBridge ? flowStripePolygons(b, color(i), undefined, terrainAt, true) : []));
    setBridgeDecks(map, [...osmDecks, ...stripes]);
    if (tt.lines.length)
      setFlowGround(map, lifted.flatMap((b, i) => groundRuns(b).map((coordinates) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { color: color(i) } }))));
    flowStripeCount = stripes.length;
    return lifted;
  };
  let flowStripeCount = 0;

  const rebuild = () => {
    const ttAll = tomtomFlowLines(map, Infinity);
    const onFlow = ttAll.lines.length > 0;
    const profiles = osmBridgeProfiles(map, terrainAt);
    bridges = profiledBridgeIndex(profiles.map((p) => p.line));
    osmDecks = profiles.flatMap((p) => osmDeckPolygons(p.line, ROAD_WIDTH_M[p.cls] ?? ROAD_WIDTH_M.minor, ROAD_LINE_COLOR[p.cls] ?? '#94a3b8', terrainAt));
    let lifted: BridgedLine[];
    let tt = ttAll;
    if (onFlow) {
      const all = drawFlow(ttAll);
      const keep = all.length > MAX_FLOW_EDGES ? longest(ttAll.lines, MAX_FLOW_EDGES) : all.map((_, i) => i);
      lifted = keep.map((i) => all[i]);
      tt = { lines: keep.map((i) => ttAll.lines[i]), flows: keep.map((i) => ttAll.flows[i]), keys: keep.map((i) => ttAll.keys[i]) };
    } else {
      lifted = levelSharedDecks(motorwayLines(map).map((l) => bridgeLine(bridges, l, terrainAt)));
      setBridgeDecks(map, osmDecks);
      flowStripeCount = 0;
    }
    const lines = lifted.map((b) => b.coords);
    const elev = lifted.map((b) => b.ground.map((g, j) => g + b.offsets[j]));
    const onBridge = lifted.filter((b) => b.onBridge);
    const bridgeDiag = {
      lineSource: onFlow ? 'tomtom-flow' : 'osm-motorway-fallback',
      flowLines: ttAll.lines.length,
      simLines: lines.length,
      osmBridges: profiles.length,
      osmBridgeSegments: bridges.count,
      liftedLines: onBridge.length,
      deckSlabs: osmDecks.length,
      flowStripes: flowStripeCount,
      maxDeckM: +profiles.reduce((m, p) => p.line.offsets.reduce((n, o) => Math.max(n, o), m), 0).toFixed(1),
      deckLayer: !!map.getLayer(BRIDGE_DECK_LAYER),
      flowGroundLayer: !!map.getLayer(FLOW_GROUND_LAYER),
      zoom: +map.getZoom().toFixed(2),
    };
    (window as unknown as { __gaBridges?: typeof bridgeDiag }).__gaBridges = bridgeDiag;
    console.info('[ga-bridges]', JSON.stringify(bridgeDiag));
    sim = new TrafficSim(lines, cap, elev, onFlow ? tt.flows : undefined);
    simKeys = onFlow ? tt.keys : [];
    closeSelected();
    const jam = sim.agents.filter((a) => a.speed < SLOW_MS).length;
    reportGaFeed(map, {
      id: 'traffic-sim',
      label: 'SIM vehicles',
      color: '#00ffff',
      count: sim.agents.length,
      detail:
        (onFlow
          ? `${sim.edges.length} TomTom flow lines in view · speed = 100 km/h nominal × TomTom speed ratio, 35–200/km by jamFactor · cap ${cap}`
          : `${sim.edges.length} motorway lines in view · 30% of each line jammed (200/km, 15 km/h), rest 35/km at 100 km/h · cap ${cap}`) +
        ` · ${onBridge.length} lines on ${profiles.length} OSM road-bridge decks (deck height estimated: chord between abutments, ≤ layer × ${BRIDGE_LAYER_M} m over the lowest ground)`,
      updatedAt: new Date().toISOString(),
      sourceUrl: onFlow ? TOMTOM_FLOW_DOCS_URL : 'https://openfreemap.org/',
      swatches: [
        { label: onFlow ? 'SIM under 36 km/h' : 'simulated jam', color: '#ff0000', count: jam },
        { label: onFlow ? 'SIM 36 km/h or faster' : 'simulated free flow', color: '#00ffff', count: sim.agents.length - jam },
      ],
    });
  };
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let emptyRetries = 0;
  /** No `idle` wait: animated layers repaint every frame, so `idle` may never fire and the sim would stay empty. */
  const schedule = (ms: number) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      rebuild();
      if (sim.agents.length === 0 && emptyRetries++ < EMPTY_RETRY_MAX) schedule(EMPTY_RETRY_MS);
    }, ms);
  };
  const loadTrigger = firstLoadTrigger([ROAD_SOURCE, GA_TRAFFIC_FLOW_SOURCE]);
  const onMoveEnd = () => {
    emptyRetries = 0;
    loadTrigger.reset();
    schedule(REBUILD_DEBOUNCE_MS);
  };
  const onRoadData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (loadTrigger.fire(e)) schedule(REBUILD_DEBOUNCE_MS);
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
          getPosition: (d) => [d.position[0], d.position[1], d.elevM + ROAD_CLEARANCE_M],
          getOrientation: (d) => [0, -d.bearing, 0],
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
          getPosition: (d) => [d.position[0], d.position[1], d.elevM + CAR_DIMS_M.height + 1],
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
    const tt = tomtomFlowLines(map, Infinity);
    const byKey = new Map(tt.keys.map((k, i) => [k, tt.flows[i]] as const));
    sim.updateFlows(simKeys.map((k) => byKey.get(k)));
    drawFlow(tt);
  };
  const onFlowRefresh = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId !== GA_TRAFFIC_FLOW_SOURCE || !e.isSourceLoaded) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshFlows, 500);
  };
  map.on('sourcedata', onFlowData);
  map.on('sourcedata', onFlowRefresh);
  map.on('moveend', onMoveEnd);
  map.on('sourcedata', onRoadData);
  onMoveEnd();
  raf = requestAnimationFrame(draw);
  map.once('remove', () => {
    cancelAnimationFrame(raf);
    clearTimeout(debounce);
    closeSelected();
    map.off('moveend', onMoveEnd);
    map.off('sourcedata', onRoadData);
    map.off('sourcedata', onFlowData);
    map.off('sourcedata', onFlowRefresh);
    clearTimeout(refreshTimer);
    bound.delete(map);
  });
}
