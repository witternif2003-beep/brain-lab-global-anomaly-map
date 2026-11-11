// Snapshot of the Georgia OSM infrastructure query used by /api/ga-live-markers (served only when Overpass is unreachable).
// Usage: node scripts/build-ga-osm-snapshot.mjs [saved-overpass-response.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BBOX = '30.3,-85.7,35.1,-80.8';
const QUERY = `[out:json][timeout:120][bbox:${BBOX}];node["highway"="traffic_signals"];out skel qt;(nwr["amenity"~"^(police|fire_station)$"];nwr["emergency"="siren"];nwr["man_made"~"^(mast|tower)$"]["tower:type"="communication"];node["highway"="speed_camera"];nwr["man_made"="surveillance"]["surveillance:type"~"^alpr$",i];);out center tags qt;`;
const KEEP = new Set(['name', 'official_name', 'operator', 'height', 'siren:type', 'siren:purpose', 'amenity', 'emergency', 'man_made', 'tower:type', 'highway', 'surveillance:type']);
const OUT = 'data/osm/ga-infra-snapshot.json.gz';

async function query() {
  const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(QUERY)}`, {
    headers: { 'User-Agent': 'brain-lab-global-anomaly-map (public-data map; https://brain-lab-six.vercel.app)' },
    signal: AbortSignal.timeout(200_000),
  });
  if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
  return r.json();
}
const j = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await query();
const elements = [];
for (const e of j.elements ?? []) {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat === undefined || lon === undefined) continue;
  const tags = Object.fromEntries(Object.entries(e.tags ?? {}).filter(([k, v]) => KEEP.has(k) || (k.startsWith('communication:') && v === 'yes')));
  elements.push({ type: e.type, id: e.id, lat: +lat.toFixed(6), lon: +lon.toFixed(6), ...(Object.keys(tags).length ? { tags } : {}) });
}
const body = JSON.stringify({ osm3s: { timestamp_osm_base: j.osm3s?.timestamp_osm_base ?? null }, elements });
writeFileSync(OUT, gzipSync(body, { level: 9 }));
console.log(`${OUT}: ${elements.length} elements, OSM base ${j.osm3s?.timestamp_osm_base}`);
