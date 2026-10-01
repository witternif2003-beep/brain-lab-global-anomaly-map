import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { getGaPatrolPosition, insideRing, loadGaWallRing, offset, RUN_SPEED_MPS, vector, wallDistance } from './ga-patrol-3d';
import type { LngLat } from './ga-patrol-3d';

export const GA_COMPETITORS_SOURCE = 'ga-competitor-markers';
const ATTRIBUTION =
  'Competitor markers: user-supplied list, abstract simulated movement inside the GA wall (not real locations or activity) · links: company sites';

/** Competitor list as supplied by the user; `url` is the entity's own (or successor's) public site. */
const ENTRIES: Array<{ name: string; listed: string; url: string; note?: string }> = [
  { name: 'Booz Allen Hamilton', listed: 'San Antonio, TX', url: 'https://www.boozallen.com/' },
  { name: 'SecureInfo Corp', listed: 'San Antonio, TX', url: 'https://ir.kratosdefense.com/static-files/8596ec95-782c-45b9-b62f-6a938d110f50', note: 'Acquired by Kratos Defense, Nov 2011' },
  { name: 'Raytheon (RTX)', listed: 'McKinney / Plano, TX', url: 'https://www.rtx.com/' },
  { name: 'CACI International', listed: 'TX', url: 'https://www.caci.com/' },
  { name: 'Consolidated Nuclear Security LLC', listed: 'Oak Ridge, TN', url: 'https://www.cns-llc.us/' },
  { name: 'Amentum', listed: 'TN', url: 'https://www.amentum.com/' },
  { name: 'Booz Allen Hamilton', listed: 'TN', url: 'https://www.boozallen.com/' },
  { name: 'NewSat North America', listed: 'Indian Harbour Beach, FL', url: 'https://www.newsatnorthamerica.com/' },
  { name: 'Raytheon Largo (RTX)', listed: 'Pinellas County, FL', url: 'https://www.rtx.com/' },
  { name: 'Celestar Corporation', listed: 'Tampa, FL', url: 'https://www.celestarcorp.com/' },
  { name: 'AITC (Advanced IT Concepts)', listed: 'Winter Springs, FL', url: 'https://aitc-llc.com/' },
  { name: 'SAS Institute', listed: 'Cary, NC', url: 'https://www.sas.com/' },
  { name: 'VTG', listed: 'Lenoir, NC', url: 'https://vtgdefense.com/' },
  { name: 'Leonardo DRS', listed: 'Elizabeth City, NC', url: 'https://www.leonardodrs.com/' },
  { name: 'CACI International', listed: 'Charlotte, NC', url: 'https://www.caci.com/' },
  { name: 'SAIC', listed: 'Hanahan, SC', url: 'https://www.saic.com/' },
  { name: 'ManTech', listed: 'SC', url: 'https://www.mantech.com/' },
  { name: 'BAE Systems', listed: 'North Charleston, SC', url: 'https://www.baesystems.com/' },
  { name: 'Adapt Forward', listed: 'North Charleston, SC', url: 'https://www.adaptforward.com/' },
  { name: 'SAIC', listed: 'Reston, VA', url: 'https://www.saic.com/' },
  { name: 'ManTech', listed: 'Herndon, VA', url: 'https://www.mantech.com/' },
  { name: 'Booz Allen Hamilton', listed: 'McLean, VA', url: 'https://www.boozallen.com/' },
  { name: 'CACI International', listed: 'Reston, VA', url: 'https://www.caci.com/' },
  { name: 'SI International', listed: 'Reston, VA', url: 'https://www.sec.gov/Archives/edgar/data/1143363/000134100409000003/form8k.htm', note: 'Acquired by Serco, Dec 2008' },
  { name: 'VTG', listed: 'Chantilly, VA', url: 'https://vtgdefense.com/' },
];

const FLEE_RADIUS_M = 1500;
const FLEE_RELEASE_M = 2000;
const FLEE_LEG_M = 200;
const MIN_LEG_M = 25;
const HEADING_TRIES = 64;
const SUBSTEP_S = 5;
const MAX_CATCHUP_S = 3600;
const PUSH_INTERVAL_MS = 1000;

type Agent = {
  pos: LngLat;
  from: LngLat;
  to: LngLat;
  length: number;
  travelled: number;
  fleeing: boolean;
};

/**
 * One abstract marker per listed entity. Each runs wall-to-wall legs at RUN_SPEED_MPS; while the
 * patrol is within FLEE_RADIUS_M it switches to short legs pointing as directly away from the patrol
 * as the wall allows. Every leg length comes from wallDistance, so no marker can cross the wall.
 */
export class GaCompetitorSwarm {
  readonly agents: Agent[] = [];
  private lastTick = 0;

  constructor(private readonly ring: LngLat[]) {}

  start(now: number, count: number): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of this.ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    for (let tries = 0; this.agents.length < count && tries < count * 200; tries++) {
      const p: LngLat = [minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY)];
      if (!insideRing(this.ring, p)) continue;
      const leg = this.wanderLeg(p);
      if (!leg) continue;
      this.agents.push({ pos: p, ...leg, travelled: 0, fleeing: false });
    }
    this.lastTick = now;
  }

  tick(now: number, patrol: LngLat | null): void {
    let left = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S);
    this.lastTick = now;
    while (left > 0) {
      const dt = Math.min(left, SUBSTEP_S);
      left -= dt;
      for (const a of this.agents) this.step(a, dt, patrol);
    }
  }

  private step(a: Agent, dt: number, patrol: LngLat | null): void {
    const d = patrol ? vector(patrol, a.pos).dist : Infinity;
    const shouldFlee = a.fleeing ? d < FLEE_RELEASE_M : d < FLEE_RADIUS_M;
    if (shouldFlee !== a.fleeing) {
      a.fleeing = shouldFlee;
      this.replan(a, patrol);
    }
    let dist = dt * RUN_SPEED_MPS;
    while (dist > 0) {
      const step = Math.min(dist, a.length - a.travelled);
      a.travelled += step;
      dist -= step;
      const f = a.length > 0 ? a.travelled / a.length : 1;
      a.pos = [a.from[0] + (a.to[0] - a.from[0]) * f, a.from[1] + (a.to[1] - a.from[1]) * f];
      if (a.travelled < a.length) return;
      if (!this.replan(a, patrol)) return;
    }
  }

  private replan(a: Agent, patrol: LngLat | null): boolean {
    const leg = a.fleeing && patrol ? this.fleeLeg(a.pos, patrol) : this.wanderLeg(a.pos);
    if (!leg) {
      a.from = a.pos;
      a.to = a.pos;
      a.length = 0;
      a.travelled = 0;
      return false;
    }
    Object.assign(a, leg, { travelled: 0 });
    return true;
  }

  private wanderLeg(from: LngLat): Pick<Agent, 'from' | 'to' | 'length'> | null {
    for (let i = 0; i < HEADING_TRIES; i++) {
      const heading = Math.random() * Math.PI * 2;
      const length = wallDistance(this.ring, from, heading);
      if (length === null || length < MIN_LEG_M) continue;
      return { from, to: offset(from, heading, length), length };
    }
    return null;
  }

  /** Best heading away from the patrol: straight away first, then fanning out up to ±165° along the wall. */
  private fleeLeg(from: LngLat, patrol: LngLat): Pick<Agent, 'from' | 'to' | 'length'> | null {
    const away = vector(patrol, from).heading;
    for (let k = 0; k <= 11; k++) {
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const heading = away + sign * k * (Math.PI / 12);
        const room = wallDistance(this.ring, from, heading);
        if (room === null || room < 1) continue;
        const length = Math.min(room, FLEE_LEG_M);
        return { from, to: offset(from, heading, length), length };
      }
    }
    return null;
  }
}

function featureData(swarm: GaCompetitorSwarm | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (swarm?.agents ?? []).map((a, i) => ({
      type: 'Feature',
      id: i,
      properties: { i, fleeing: a.fleeing },
      geometry: { type: 'Point', coordinates: a.pos },
    })),
  };
}

function popupContent(i: number, fleeing: boolean): HTMLElement {
  const e = ENTRIES[i];
  const root = document.createElement('div');
  root.style.cssText = 'font: 12px/1.4 system-ui, sans-serif; color: #0f172a; max-width: 240px';
  const title = document.createElement('strong');
  title.textContent = e.name;
  const listed = document.createElement('div');
  listed.textContent = `Listed location: ${e.listed}`;
  root.append(title, listed);
  if (e.note) {
    const note = document.createElement('div');
    note.textContent = e.note;
    root.append(note);
  }
  const status = document.createElement('div');
  status.textContent = fleeing ? 'Marker state: moving away from patrol' : 'Marker state: random wall-to-wall';
  const link = document.createElement('a');
  link.href = e.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Source';
  const caveat = document.createElement('div');
  caveat.style.cssText = 'color: #64748b; margin-top: 4px';
  caveat.textContent = 'Simulated marker position; not a real location.';
  root.append(status, link, caveat);
  return root;
}

const bound = new WeakSet<MapLibreMap>();

/** Adds the competitor marker source, layers, and simulation loop (idempotent). */
export function addGaCompetitorLayers(map: MapLibreMap): void {
  if (!map.getSource(GA_COMPETITORS_SOURCE)) {
    map.addSource(GA_COMPETITORS_SOURCE, { type: 'geojson', data: featureData(null), attribution: ATTRIBUTION });
  }
  if (!map.getLayer('ga-competitor-markers')) {
    map.addLayer({
      id: 'ga-competitor-markers',
      type: 'circle',
      source: GA_COMPETITORS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 5.5, 16, 8],
        'circle-color': ['case', ['get', 'fleeing'], '#f97316', '#a855f7'],
        'circle-stroke-color': '#f8fafc',
        'circle-stroke-width': 1.5,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  let swarm: GaCompetitorSwarm | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const push = () => {
    if (!swarm) return;
    swarm.tick(performance.now(), getGaPatrolPosition(map));
    (map.getSource(GA_COMPETITORS_SOURCE) as GeoJSONSource | undefined)?.setData(featureData(swarm));
  };
  loadGaWallRing()
    .then((ring) => {
      if (ring.length < 4 || !bound.has(map)) return;
      swarm = new GaCompetitorSwarm(ring);
      swarm.start(performance.now(), ENTRIES.length);
      push();
      timer = setInterval(push, PUSH_INTERVAL_MS);
    })
    .catch((err) => console.warn('[GaCompetitors] wall path load failed:', err));
  map.once('remove', () => {
    if (timer) clearInterval(timer);
    bound.delete(map);
  });

  map.on('click', 'ga-competitor-markers', (e) => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const i = Number(f.properties?.i);
    if (!ENTRIES[i]) return;
    new Popup({ closeButton: true, maxWidth: '260px' })
      .setLngLat(f.geometry.coordinates as LngLat)
      .setDOMContent(popupContent(i, f.properties?.fleeing === true))
      .addTo(map);
  });
  map.on('mouseenter', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = '';
  });
}
