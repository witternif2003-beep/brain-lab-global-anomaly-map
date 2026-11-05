/**
 * Live check of the TomTom ↔ OSM bridge join on one tile (default: Spaghetti Junction, z14/4357/6550).
 * Fetches the current OpenFreeMap transportation tile and the production TomTom flow tile, runs the
 * same bridge code the map uses, and fails if no line is lifted or an approach exceeds the grade limit.
 * Usage: npx tsx scripts/verify-bridge-join.ts [baseUrl] [z/x/y]
 */
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { MAX_APPROACH_GRADE, bridgeLine, bridgeSegments, buildBridgeIndex, deckPolygons } from '../lib/traffic-bridges';
import { haversineM, type LngLat } from '../lib/traffic-sim';

const base = process.argv[2] || 'https://brain-lab-six.vercel.app';
const [z, x, y] = (process.argv[3] || '14/4357/6550').split('/').map(Number);

async function bytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function lineParts(g: { type: string; coordinates?: unknown }): LngLat[][] {
  if (g.type === 'LineString') return [g.coordinates as LngLat[]];
  if (g.type === 'MultiLineString') return g.coordinates as LngLat[][];
  return [];
}

async function main() {
  const tilejson = (await (await fetch('https://tiles.openfreemap.org/planet')).json()) as { tiles: string[] };
  const ofmUrl = tilejson.tiles[0].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  const roads = new VectorTile(new PbfReader(await bytes(ofmUrl))).layers.transportation;
  const feats = Array.from({ length: roads?.length ?? 0 }, (_, i) => roads!.feature(i).toGeoJSON(x, y, z));
  const segs = bridgeSegments(feats);
  const index = buildBridgeIndex(segs);

  const flow = new VectorTile(new PbfReader(await bytes(`${base}/api/traffic-flow/${z}/${x}/${y}`)));
  const lines: LngLat[][] = [];
  for (const layer of Object.values(flow.layers)) for (let i = 0; i < layer.length; i++) lines.push(...lineParts(layer.feature(i).toGeoJSON(x, y, z).geometry));

  const t0 = performance.now();
  const lifted = lines.map((l) => bridgeLine(index, l));
  const joinMs = performance.now() - t0;
  const on = lifted.filter((b) => b.onBridge);
  let maxGrade = 0;
  const liftHistogramM: Record<number, number> = {};
  for (const b of on) {
    for (let i = 1; i < b.coords.length; i++) {
      const d = haversineM(b.coords[i - 1], b.coords[i]);
      if (d > 0) maxGrade = Math.max(maxGrade, Math.abs(b.offsets[i] - b.offsets[i - 1]) / d);
    }
    const top = Math.max(...b.offsets);
    liftHistogramM[top] = (liftHistogramM[top] ?? 0) + 1;
  }
  const report = {
    tile: `${z}/${x}/${y}`,
    ofmTiles: tilejson.tiles[0],
    osmTransportFeatures: feats.length,
    osmBridgeSegments: segs.length,
    tomtomLines: lines.length,
    liftedLines: on.length,
    liftHistogramM,
    deckPolygons: on.reduce((n, b) => n + deckPolygons(b).length, 0),
    maxGrade: +maxGrade.toFixed(4),
    gradeLimit: MAX_APPROACH_GRADE,
    joinMs: +joinMs.toFixed(1),
  };
  console.log(JSON.stringify(report, null, 2));
  const ok = on.length > 0 && maxGrade <= MAX_APPROACH_GRADE + 1e-9;
  console.log(ok ? 'BRIDGE_JOIN=OK' : 'BRIDGE_JOIN=FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
