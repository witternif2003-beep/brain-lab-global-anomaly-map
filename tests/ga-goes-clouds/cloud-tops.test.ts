import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudTopMesh, coverAt, fillHeights, geosScanAngles, parallaxCorrect, sampleCloudTops, type FixedGrid, type GeosProjection } from "../../lib/ga-goes-clouds/cloud-tops";

const G19: GeosProjection = { h: 35_786_023, a: 6_378_137, b: 6_356_752.31414, lon0: -75 };
/** GOES-19 ACHAC (CONUS) fixed grid, from OR_ABI-L2-ACHAC-M6_G19 x/y attributes. */
const CONUS: FixedGrid = { x0: -0.10122, dx: 0.00028, y0: 0.1281, dy: -0.00028, nx: 500, ny: 300 };

test("geosScanAngles: sub-satellite point is (0, 0) and the far side of the Earth is invisible", () => {
  const [x, y] = geosScanAngles(G19, -75, 0)!;
  assert.ok(Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12);
  assert.equal(geosScanAngles(G19, 105, 0), null);
  const [ax, ay] = geosScanAngles(G19, -84.39, 33.75)!;
  assert.ok(ax < 0 && ay > 0, "Atlanta is west and north of the sub-satellite point");
  const col = (ax - CONUS.x0) / CONUS.dx;
  const row = (ay - CONUS.y0) / CONUS.dy;
  assert.ok(col > 0 && col < CONUS.nx && row > 0 && row < CONUS.ny, `Atlanta inside the CONUS sector (${col}, ${row})`);
});

test("sampleCloudTops: uniform 9 km field reads 9 km everywhere; no good pixels reads null with zero cover", () => {
  const full = sampleCloudTops(() => 9000, CONUS, G19);
  assert.ok(full.heightsM.every((h) => h === 9000));
  assert.ok(full.cover.every((c) => c === 1));
  const none = sampleCloudTops(() => null, CONUS, G19);
  assert.ok(none.heightsM.every((h) => h === null) && none.cover.every((c) => c === 0));
  assert.equal(cloudTopMesh(none), null);
});

test("fillHeights spreads measured heights into empty vertices", () => {
  const out = fillHeights({ cols: 3, rows: 1, heightsM: [null, 5000, null] })!;
  assert.deepEqual(out, [5000, 5000, 5000]);
});

test("parallaxCorrect: no shift at ground level; tall tops move toward the satellite by about h·tan(zenith)", () => {
  assert.deepEqual(parallaxCorrect(-84.39, 33.75, 0, -75, G19.h), [-84.39, 33.75]);
  const [lng, lat] = parallaxCorrect(-84.39, 33.75, 10_000, -75, G19.h);
  assert.ok(lng > -84.39 && lat < 33.75, "shifted east and south, toward the satellite");
  const km = Math.hypot((lng + 84.39) * 111.32 * Math.cos((33.75 * Math.PI) / 180), (lat - 33.75) * 110.57);
  assert.ok(km > 6 && km < 14, `shift ${km.toFixed(1)} km for a 10 km top`);
});

test("cloudTopMesh is one watertight grid: shared vertices, heights × exaggeration, texture spanning 0–1", () => {
  const g = sampleCloudTops(() => 6000, CONUS, G19);
  const m = cloudTopMesh(g, 1.5)!;
  assert.equal(m.attributes.positions.value.length, g.cols * g.rows * 3);
  assert.equal(m.indices.value.length, (g.cols - 1) * (g.rows - 1) * 6);
  for (let i = 2; i < m.attributes.positions.value.length; i += 3) assert.equal(m.attributes.positions.value[i], 9000);
  const uv = m.attributes.texCoords.value;
  assert.deepEqual([uv[0], uv[1]], [0, 0]);
  assert.ok(Math.abs(uv[uv.length - 2] - 1) < 1e-6 && Math.abs(uv[uv.length - 1] - 1) < 1e-6);
  assert.ok(Math.max(...m.indices.value) < g.cols * g.rows);
});

test("coverAt interpolates between vertices", () => {
  const g = { cols: 2, rows: 2, cover: [0, 1, 0, 1] };
  assert.equal(coverAt(g, 0, 0, 11, 11), 0);
  assert.equal(coverAt(g, 10, 0, 11, 11), 1);
  assert.ok(Math.abs(coverAt(g, 5, 5, 11, 11) - 0.5) < 1e-9);
});
