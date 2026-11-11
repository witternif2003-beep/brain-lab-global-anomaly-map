import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockRadiusPx, decodeCensusBlocks, densityAnchors, densityDotRadiusPx, DENSITY_REFERENCE_ICON_PX, parseStateEstimate } from "../lib/ga-census-density";

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

test("decodes block internal points and populations at 1e-6° precision", () => {
  const b = Buffer.alloc(4 + 2 * 10);
  b.writeUInt32LE(2, 0);
  b.writeInt32LE(-84388000, 4); b.writeInt32LE(-81091234, 8);
  b.writeInt32LE(33749000, 12); b.writeInt32LE(32080567, 16);
  b.writeUInt16LE(12, 20); b.writeUInt16LE(3029, 22);
  const d = decodeCensusBlocks(ab(b));
  assert.equal(d.n, 2);
  assert.deepEqual([...d.positions], [-84.388, 33.749, -81.091234, 32.080567]);
  assert.deepEqual([...d.pops], [12, 3029]);
  assert.equal(d.total, 3041);
  assert.throws(() => decodeCensusBlocks(ab(b.subarray(0, 20))));
});

test("drops records whose position is outside WGS84 and keeps the rest", () => {
  const b = Buffer.alloc(4 + 2 * 10);
  b.writeUInt32LE(2, 0);
  b.writeInt32LE(-84388000, 4); b.writeInt32LE(-84000000, 8);
  b.writeInt32LE(33749000, 12); b.writeInt32LE(95000000, 16);
  b.writeUInt16LE(12, 20); b.writeUInt16LE(50, 22);
  const d = decodeCensusBlocks(ab(b));
  assert.equal(d.n, 1);
  assert.equal(d.dropped, 1);
  assert.deepEqual([...d.positions], [-84.388, 33.749]);
  assert.equal(d.total, 12);
});

test("committed Georgia file matches the 2020 census: 165,333 populated blocks, 10,711,908 people, all inside Georgia's extent", () => {
  const d = decodeCensusBlocks(ab(readFileSync("public/data/ga-census-blocks-2020.bin")));
  assert.equal(d.n, 165_333);
  assert.equal(d.total, 10_711_908);
  assert.equal(d.dropped, 0);
  for (let i = 0; i < d.n; i++) {
    const [lon, lat] = [d.positions[2 * i], d.positions[2 * i + 1]];
    assert.ok(lon > -85.61 && lon < -80.84 && lat > 30.35 && lat < 35.01, `block ${i} at ${lon},${lat}`);
  }
});

test("dot radius grows with √population and is bounded", () => {
  assert.equal(blockRadiusPx(1), 1.625);
  assert.equal(blockRadiusPx(64), 2.5);
  assert.equal(blockRadiusPx(3029), 7);
  assert.ok(blockRadiusPx(100) < blockRadiusPx(400));
});

test("densityAnchors keeps only in-box blocks and lifts each to its terrain elevation", () => {
  const b = Buffer.alloc(4 + 3 * 10);
  b.writeUInt32LE(3, 0);
  b.writeInt32LE(-84388000, 4); b.writeInt32LE(-81091234, 8); b.writeInt32LE(-84390000, 12);
  b.writeInt32LE(33749000, 16); b.writeInt32LE(32080567, 20); b.writeInt32LE(33750000, 24);
  b.writeUInt16LE(12, 28); b.writeUInt16LE(3029, 30); b.writeUInt16LE(64, 32);
  const d = decodeCensusBlocks(ab(b));
  const a = densityAnchors(d, { west: -84.4, east: -84.3, south: 33.7, north: 33.8 }, (lon, lat) => Math.round((lon + lat) * 1000));
  assert.equal(a.n, 2);
  assert.deepEqual([...a.positions], [-84.388, 33.749, Math.round((-84.388 + 33.749) * 1000), -84.39, 33.75, Math.round((-84.39 + 33.75) * 1000)]);
  assert.deepEqual([...a.radii], [d.radii[0], d.radii[2]]);
});

test("parseStateEstimate reads the newest POPESTIMATE column for Georgia", () => {
  const csv = "SUMLEV,REGION,DIVISION,STATE,NAME,ESTIMATESBASE2020,POPESTIMATE2020,POPESTIMATE2024,POPESTIMATE2025\n" +
    "010,0,0,00,United States,1,2,3,4\n040,3,5,13,Georgia,10713861,10732595,11204208,11302748\n";
  assert.deepEqual(parseStateEstimate(csv), { year: 2025, estimate: 11302748, base2020: 10713861 });
  assert.throws(() => parseStateEstimate(csv, "99"));
});

test("density dots are a fixed half the size of a standard map icon at every zoom", () => {
  const markerScale = 2 / 3;
  const iconDiameterPx = DENSITY_REFERENCE_ICON_PX * markerScale;
  assert.equal(2 * densityDotRadiusPx(markerScale), iconDiameterPx / 2);
});

test('heatmap glow only below zoom 9; dots are still drawn', async () => {
  const { densityHeatmapOn, densityHeatmapTexturePx, DENSITY_HEATMAP_MAX_ZOOM } = await import('../lib/ga-census-density');
  assert.equal(DENSITY_HEATMAP_MAX_ZOOM, 9);
  assert.equal(densityHeatmapOn(0), true);
  assert.equal(densityHeatmapOn(8.99), true);
  assert.equal(densityHeatmapOn(9), false);
  assert.equal(densityHeatmapOn(17), false);
  assert.equal(densityHeatmapOn(Number.NaN), false);
  assert.equal(densityHeatmapTexturePx(true), 512);
  assert.equal(densityHeatmapTexturePx(false), 1024);
});
