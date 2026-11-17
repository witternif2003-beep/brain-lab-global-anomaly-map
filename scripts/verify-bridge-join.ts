/**
 * Live check of the TomTom ↔ OSM bridge join on one tile (default: Spaghetti Junction, z14/4357/6550).
 * Fetches the current OpenFreeMap transportation tile and the production TomTom flow tile, runs the
 * same bridge code the map uses on AWS Terrarium z15 ground heights, and fails if no line is lifted, a lifted
 * line leaves the ground before a bridge, or a deck climbs steeper than the grade limit (or its abutment chord).
 * Usage: npx tsx scripts/verify-bridge-join.ts [baseUrl] [z/x/y]
 */
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import sharp from 'sharp';
import { MAX_APPROACH_GRADE, levelSharedDecks, bridgeLine, bridgeSegments, buildBridgeIndex, deckPolygons } from '../lib/traffic-bridges';
import { haversineM, type LngLat } from '../lib/traffic-sim';

const base = process.argv[2] || 'https://brain-lab-six.vercel.app';
const [z, x, y] = (process.argv[3] || '14/4357/6550').split('/').map(Number);

async function bytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

const TERRAIN_Z = 15;
const terrainTiles = new Map<string, Promise<Buffer>>();
async function groundSampler(coords: LngLat[]): Promise<(c: LngLat) => number> {
  const n = 2 ** TERRAIN_Z;
  const pix = (c: LngLat) => {
    const lat = (c[1] * Math.PI) / 180;
    const fx = ((c[0] + 180) / 360) * n;
    const fy = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n;
    return { key: `${Math.floor(fx)}/${Math.floor(fy)}`, px: Math.min(255, Math.floor((fx % 1) * 256)), py: Math.min(255, Math.floor((fy % 1) * 256)) };
  };
  for (const c of coords) {
    const { key } = pix(c);
    if (!terrainTiles.has(key))
      terrainTiles.set(key, bytes(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TERRAIN_Z}/${key}.png`).then((b) => sharp(b).removeAlpha().raw().toBuffer()));
  }
  const tiles = new Map<string, Buffer>();
  for (const [k, p] of terrainTiles) tiles.set(k, await p);
  return (c) => {
    const { key, px, py } = pix(c);
    const t = tiles.get(key);
    if (!t) return 0; // only lines that touch a bridge are sampled; the rest stay flat either way
    const o = (py * 256 + px) * 3;
    return t[o] * 256 + t[o + 1] + t[o + 2] / 256 - 32768;
  };
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

  const flat = lines.map((l) => bridgeLine(index, l));
  const ground = await groundSampler(flat.filter((b) => b.onBridge).flatMap((b) => b.coords));
  const t0 = performance.now();
  const lifted = levelSharedDecks(lines.map((l) => bridgeLine(index, l, ground)));
  const joinMs = performance.now() - t0;
  const on = lifted.filter((b) => b.onBridge);
  let maxGrade = 0;
  let gradeViolations = 0;
  let approachLifts = 0;
  const liftHistogramM: Record<number, number> = {};
  for (const b of on) {
    const deck = b.ground.map((g, i) => g + b.offsets[i]);
    const cum = [0];
    for (let i = 1; i < b.coords.length; i++) cum.push(cum[i - 1] + haversineM(b.coords[i - 1], b.coords[i]));
    // Slope of the straight chord between each run's abutments: a deck may follow it where it is steeper than 6 %.
    const chordSlope = new Array<number>(b.coords.length).fill(0);
    for (let i0 = 0; i0 < b.layers.length; ) {
      if (!(b.layers[i0] > 0)) { i0++; continue; }
      let i1 = i0;
      while (i1 + 1 < b.layers.length && b.layers[i1 + 1] > 0) i1++;
      const a = Math.max(0, i0 - 1), z = Math.min(b.layers.length - 1, i1 + 1);
      const slope = cum[z] > cum[a] ? Math.abs(b.ground[z] - b.ground[a]) / (cum[z] - cum[a]) : 0;
      for (let i = i0; i <= i1; i++) chordSlope[i] = slope;
      i0 = i1 + 1;
    }
    for (let i = 1; i < b.coords.length; i++) {
      if (b.layers[i] === 0 && b.offsets[i] !== 0) approachLifts++;
      const d = cum[i] - cum[i - 1];
      // Where either vertex rests on the ground the deck is the ground itself, not a modelled slope.
      if (!(d > 0) || !(b.offsets[i] > 0) || !(b.offsets[i - 1] > 0)) continue;
      const g = Math.abs(deck[i] - deck[i - 1]) / d;
      maxGrade = Math.max(maxGrade, g);
      if (g > Math.max(MAX_APPROACH_GRADE, chordSlope[i]) + 1e-6) gradeViolations++;
    }
    const top = Math.round(Math.max(...b.offsets));
    liftHistogramM[top] = (liftHistogramM[top] ?? 0) + 1;
  }
  const report = {
    tile: `${z}/${x}/${y}`,
    ofmTiles: tilejson.tiles[0],
    osmTransportFeatures: feats.length,
    osmBridgeSegments: segs.length,
    tomtomLines: lines.length,
    liftedLines: on.length,
    liftHistogramM, // max metres above the ground under each lifted line, rounded
    deckPolygons: on.reduce((n, b) => n + deckPolygons(b).length, 0),
    maxDeckGrade: +maxGrade.toFixed(4),
    gradeLimit: MAX_APPROACH_GRADE,
    gradeViolations,
    approachLifts,
    joinMs: +joinMs.toFixed(1),
  };
  console.log(JSON.stringify(report, null, 2));
  const ok = on.length > 0 && gradeViolations === 0 && approachLifts === 0;
  console.log(ok ? 'BRIDGE_JOIN=OK' : 'BRIDGE_JOIN=FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
