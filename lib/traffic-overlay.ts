import type { Map as MapLibreMap } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { JAM_SPEED_MS, MAX_AGENTS_DESKTOP, MAX_AGENTS_TOUCH, TrafficSim, type CarAgent, type LngLat } from './traffic-sim';

export const TRAFFIC_SIM_PARAM = 'traffic';
const ROAD_SOURCE = 'ofm-buildings';
const ROAD_CLASSES = ['motorway', 'trunk'];
/** CubeGeometry spans -1..1, so scale is half the car size: 4 m long, 2 m wide, 1.5 m tall. */
const HALF = { length: 2, width: 1, height: 0.75 };
const bound = new WeakSet<MapLibreMap>();

export function trafficSimEnabled(search: string): boolean {
  return new URLSearchParams(search).get(TRAFFIC_SIM_PARAM) === 'sim';
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

/**
 * SIMULATED cars (not real vehicles) on motorways in view, drawn as GPU-instanced boxes in a dedicated deck.gl
 * overlay. Opt-in only: the page URL must carry `?traffic=sim`.
 */
export async function addGaTrafficSim(map: MapLibreMap): Promise<void> {
  if (typeof window === 'undefined' || !trafficSimEnabled(window.location.search) || bound.has(map)) return;
  bound.add(map);
  const cap = window.matchMedia('(pointer: coarse)').matches ? MAX_AGENTS_TOUCH : MAX_AGENTS_DESKTOP;
  const [{ MapLibreOverlay }, { SimpleMeshLayer }, { CubeGeometry }] = await Promise.all([import('@deck.gl/maplibre'), import('@deck.gl/mesh-layers'), import('@luma.gl/engine')]);
  const mesh = new CubeGeometry();
  const overlay = new MapLibreOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);
  let sim = new TrafficSim([], cap);
  let raf = 0;
  let last = performance.now();
  let frame = 0;

  const rebuild = () => {
    const lines = motorwayLines(map);
    const elev = lines.map((l) => l.map((c) => map.queryTerrainElevation(c) ?? 0));
    sim = new TrafficSim(lines, cap, elev);
    const jam = sim.agents.filter((a) => a.speed <= JAM_SPEED_MS).length;
    reportGaFeed(map, {
      id: 'traffic-sim',
      label: 'SIMULATED cars (not real vehicles)',
      color: '#00ffff',
      count: sim.agents.length,
      detail: `${sim.edges.length} motorway lines in view · 30% of each line jammed (80/km, 15 km/h), rest 5/km at 100 km/h · cap ${cap}`,
      updatedAt: new Date().toISOString(),
      sourceUrl: 'https://openfreemap.org/',
      swatches: [
        { label: 'simulated jam', color: '#ff0000', count: jam },
        { label: 'simulated free flow', color: '#00ffff', count: sim.agents.length - jam },
      ],
    });
  };
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const onMoveEnd = () => {
    clearTimeout(debounce);
    debounce = setTimeout(rebuild, 300);
  };

  const draw = (now: number) => {
    const cars = sim.tick(Math.min(100, now - last));
    last = now;
    frame++;
    overlay.setProps({
      layers: [
        new SimpleMeshLayer<CarAgent>({
          id: 'ga-traffic-sim-cars',
          data: cars,
          mesh,
          getPosition: (d) => [d.position[0], d.position[1], d.elevM + HALF.height],
          getOrientation: (d) => [0, -d.bearing, 0],
          getScale: [HALF.width, HALF.length, HALF.height],
          getColor: (d) => (d.speed < 10 ? [255, 0, 0, 255] : [0, 255, 255, 255]),
          material: { ambient: 0.5, diffuse: 0.6, shininess: 32, specularColor: [60, 64, 70] },
          updateTriggers: { getPosition: frame, getOrientation: frame, getColor: frame },
        }),
      ],
    });
    raf = requestAnimationFrame(draw);
  };

  map.on('moveend', onMoveEnd);
  if (map.loaded()) rebuild();
  else map.once('idle', rebuild);
  raf = requestAnimationFrame(draw);
  map.once('remove', () => {
    cancelAnimationFrame(raf);
    clearTimeout(debounce);
    map.off('moveend', onMoveEnd);
    bound.delete(map);
  });
}
