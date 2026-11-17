import { test } from "node:test";
import assert from "node:assert/strict";
import { encode } from "fast-png";
import {
  TERRAIN_INDEX, candidateSources, decodeTerrarium, encodeTerrarium, groundResolution, inGeorgiaBbox,
  overviewLevel, renderTerrainTile, sampleBilinear, tileBounds,
} from "../lib/ga-terrain/tiler";
import { lonLatConverter } from "../lib/ga-terrain/crs";

test("Terrarium encode/decode round-trips to 1/256 m", () => {
  const px = new Uint8Array(4);
  for (const h of [-85.5, 0, 0.00390625, 123.456, 1458.9]) {
    encodeTerrarium(h, px, 0);
    assert.ok(Math.abs(decodeTerrarium(px[0], px[1], px[2]) - h) < 1 / 256 + 1e-9, String(h));
    assert.equal(px[3], 255);
  }
});

test("z17 is about 1 m per pixel across Georgia", () => {
  for (const lat of [30.36, 33.75, 35.0]) {
    const r = groundResolution(17, lat);
    assert.ok(r > 0.9 && r < 1.04, `${lat}: ${r}`);
  }
});

test("overview choice never uses pixels coarser than the output", () => {
  assert.equal(overviewLevel(1, 1.0, 6), 0);
  assert.equal(overviewLevel(1, 9.9, 6), 3);
  assert.equal(overviewLevel(1, 33, 6), 5);
  assert.equal(overviewLevel(1, 500, 6), 5);
});

test("bilinear sampling skips nodata neighbours", () => {
  const d = [10, 20, -999999, 40];
  assert.equal(sampleBilinear(d, 2, 2, 0, 0), 10);
  assert.equal(sampleBilinear(d, 2, 2, 0.5, 0), 15);
  assert.equal(sampleBilinear(d, 2, 2, 0.5, 1), 40);
  assert.equal(sampleBilinear(d, 2, 2, 0, 1), null);
  assert.equal(sampleBilinear(d, 2, 2, 5, 5), null);
});

test("proj4 CRS definitions match pyproj reference coordinates to < 1 mm", () => {
  // Reference values from pyproj 3.8 (EPSG database): Transformer.from_crs(4326, epsg, always_xy=True).
  const refs: [number, [number, number], [number, number]][] = [
    [6350, [-84.39, 33.75], [1065323.8159181378, 1252196.6414321368]],
    [26916, [-85.2, 32.1], [669847.0861733949, 3552938.058827448]],
    [26917, [-82.1, 31.2], [395204.13545622624, 3452288.4594788426]],
  ];
  for (const [e, ll, xy] of refs) {
    const [x, y] = lonLatConverter(e).forward(ll);
    assert.ok(Math.abs(x - xy[0]) < 1e-3 && Math.abs(y - xy[1]) < 1e-3, `EPSG:${e}`);
  }
});

test("index covers Georgia with S1M first", () => {
  assert.ok(TERRAIN_INDEX.sources.length > 3000, String(TERRAIN_INDEX.sources.length));
  assert.equal(TERRAIN_INDEX.groups[0], "S1M");
  const atl = tileBounds(17, 34952, 52458);
  assert.ok(inGeorgiaBbox(atl));
  const c = candidateSources(atl);
  assert.ok(c.length > 0);
  assert.ok(c.every((s, i) => i === 0 || c[i - 1].pri <= s.pri));
  assert.equal(inGeorgiaBbox(tileBounds(12, 655, 1583)), false); // Colorado
});

test("pixels without 1 m data are filled from AWS Terrain Tiles (z>15 from the z15 ancestor)", async () => {
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) encodeTerrarium(100, rgba, i * 4);
  const png = encode({ width: 256, height: 256, data: rgba, channels: 4, depth: 8 });
  const asked: string[] = [];
  const fetcher = (async (u: string) => { asked.push(String(u)); return new Response(png as unknown as BodyInit); }) as unknown as typeof fetch;
  const empty = { ...TERRAIN_INDEX, sources: [] };
  const { stats, heights } = await renderTerrainTile(17, 34952, 52458, { fetcher, idx: empty });
  assert.equal(stats.onemeter, 0);
  assert.equal(stats.aws, 256 * 256);
  assert.deepEqual(asked, ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/15/8738/13114.png"]);
  assert.ok(Math.abs(heights[1000] - 100) < 0.01);
});
