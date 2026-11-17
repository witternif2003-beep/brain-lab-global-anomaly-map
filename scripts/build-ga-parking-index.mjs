// Statewide index of Georgia OSM parking lots and big-box stores, used by the map below zoom 14 (OpenFreeMap tiles only carry POIs at z14).
// Usage: node scripts/build-ga-parking-index.mjs [saved-overpass-response.json]
import { readFileSync, writeFileSync } from 'node:fs';

const BBOX = '30.35,-85.61,35.0,-80.84';
const BRANDS = 'Walmart|Target|Publix|Kroger|Home Depot|Lowe|Costco|Sam.s Club';
const STORE_SHOPS = new Set(['supermarket', 'department_store', 'doityourself', 'hardware', 'wholesale', 'general', 'variety_store']);
const QUERY = `[out:json][timeout:180][bbox:${BBOX}];(nwr["amenity"="parking"];nwr["shop"]["name"~"${BRANDS}",i];);out center tags qt;`;
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OUT = 'public/geo/ga-parking-index.json';
const TYPE_CODE = { node: 1, way: 2, relation: 3 };

async function query() {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
        headers: { 'User-Agent': 'brain-lab-global-anomaly-map (public-data map; https://brain-lab-six.vercel.app)' },
        signal: AbortSignal.timeout(240_000),
      });
      if (r.ok) return await r.json();
      console.error(`${url}: HTTP ${r.status}`);
    } catch (e) {
      console.error(`${url}: ${e}`);
    }
  }
  throw new Error('every Overpass mirror failed');
}

const ga = JSON.parse(readFileSync('public/geo/ga-state-boundary.geojson', 'utf8'));
const geom = (ga.features?.[0] ?? ga).geometry;
const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inGeorgia = (x, y) => polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));

const j = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await query();
const features = [];
for (const e of j.elements ?? []) {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  const t = e.tags ?? {};
  if (lat === undefined || lon === undefined || !inGeorgia(lon, lat)) continue;
  const store = t.amenity !== 'parking';
  if (store && !STORE_SHOPS.has(t.shop)) continue;
  const props = { k: store ? 's' : 'p' };
  if (t.name) props.name = t.name;
  // Same id encoding as OpenFreeMap POIs (osm id × 10 + 1/2/3 for node/way/relation), so the popup reads the live OSM record either way.
  features.push({ type: 'Feature', id: e.id * 10 + TYPE_CODE[e.type], geometry: { type: 'Point', coordinates: [+lon.toFixed(5), +lat.toFixed(5)] }, properties: props });
}
const osmBase = j.osm3s?.timestamp_osm_base ?? null;
writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', osmBase, features }));
const stores = features.filter((f) => f.properties.k === 's').length;
console.log(`${OUT}: ${features.length - stores} parking lots, ${stores} big-box stores in Georgia, OSM base ${osmBase}`);
