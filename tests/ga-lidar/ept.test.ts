import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GA_LIDAR_PROJECTS,
  decodeNode,
  encodeNode,
  findProject,
  heightAboveGround,
  imageryPixel,
  lidarColor,
  lngLatFrom3857,
  lngLatTo3857,
  nodeBox,
  pickProject,
  planNodes,
  targetDepthFor,
} from "../../lib/ga-lidar/ept";
import type { EptProject, RawPoints } from "../../lib/ga-lidar/ept";

const PROJECT: EptProject = {
  name: "TEST",
  year: 2018,
  points: 0,
  bounds: [0, 0, 0, 1024, 1024, 1024],
  boundsConforming: [0, 0, 0, 1024, 1024, 1024],
  span: 128,
};

test("index lists only GA EPT projects in EPSG:3857", () => {
  assert.ok(GA_LIDAR_PROJECTS.length >= 30);
  assert.ok(GA_LIDAR_PROJECTS.every((p) => p.name.startsWith("GA_") && p.bounds.length === 6));
});

test("lngLat ↔ 3857 round-trips", () => {
  const [x, y] = lngLatTo3857(-84.388, 33.749);
  const [lng, lat] = lngLatFrom3857(x, y);
  assert.ok(Math.abs(lng + 84.388) < 1e-9 && Math.abs(lat - 33.749) < 1e-9);
});

test("pickProject chooses the newest survey covering a point", () => {
  assert.equal(pickProject(...lngLatTo3857(-84.388, 33.749))?.name, "GA_Statewide_B2_2018");
  assert.equal(pickProject(...lngLatTo3857(-83.63, 32.84))?.year, 2018);
  assert.equal(pickProject(...lngLatTo3857(-90, 40)), null);
  assert.equal(findProject("GA_Statewide_B2_2018")?.name, "GA_Statewide_B2_2018");
  assert.equal(findProject("../etc"), null);
});

test("nodeBox splits the cube per depth and rejects bad keys", () => {
  assert.deepEqual(nodeBox(PROJECT, "0-0-0-0"), { depth: 0, minX: 0, minY: 0, maxX: 1024, maxY: 1024, width: 1024 });
  assert.deepEqual(nodeBox(PROJECT, "2-3-1-0"), { depth: 2, minX: 768, minY: 256, maxX: 1024, maxY: 512, width: 256 });
  assert.equal(nodeBox(PROJECT, "1-2-0-0"), null);
  assert.equal(nodeBox(PROJECT, "x"), null);
});

test("planNodes keeps intersecting nodes up to the target depth, reports sub-hierarchies, honours the budget", () => {
  const hierarchy = { "0-0-0-0": 10, "1-0-0-0": 20, "1-1-1-0": 20, "2-0-0-0": -1, "2-1-1-0": 30, "3-0-0-0": 5 };
  const view = { cx: 200, cy: 200, half: 200, targetDepth: 2, pointBudget: 1_000 };
  const plan = planNodes(PROJECT, hierarchy, view);
  assert.deepEqual(plan.nodes.map((n) => n.key), ["0-0-0-0", "1-0-0-0", "2-1-1-0"]);
  assert.deepEqual(plan.pendingHierarchy, ["2-0-0-0"]);
  const tight = planNodes(PROJECT, hierarchy, { ...view, pointBudget: 30 });
  assert.equal(tight.points, 30);
  assert.deepEqual(tight.nodes.map((n) => n.key), ["0-0-0-0", "1-0-0-0"]);
});

test("targetDepthFor picks nodes about a sixth of the view", () => {
  assert.equal(targetDepthFor(PROJECT, 512), 3);
  assert.equal(targetDepthFor(PROJECT, 1e-6), 14);
});

function points(rows: Array<[number, number, number, number]>): RawPoints {
  return {
    x: Float64Array.from(rows.map((r) => r[0])),
    y: Float64Array.from(rows.map((r) => r[1])),
    z: Float64Array.from(rows.map((r) => r[2])),
    cls: Uint8Array.from(rows.map((r) => r[3])),
    intensity: Uint16Array.from(rows.map(() => 1000)),
  };
}

test("heightAboveGround measures roofs against the local ground, filling cells without ground returns", () => {
  const pts = points([
    [1, 1, 300, 2],
    [30, 30, 302, 2],
    [10, 10, 340, 6],
    [31, 2, 310, 5],
  ]);
  const { hag, groundZ } = heightAboveGround(pts, 0, 0, 32, 2);
  assert.equal(hag[0], 0);
  assert.equal(hag[1], 0);
  assert.equal(hag[2], 40);
  assert.ok(Math.abs(hag[3] - 9) < 1e-9);
  assert.equal(groundZ, 301);
});

test("encodeNode/decodeNode round-trip and drop noise classes", () => {
  const box = { depth: 0, minX: 1000, minY: 2000, maxX: 1100, maxY: 2100, width: 100 };
  const pts = points([
    [1010, 2010, 300, 2],
    [1050, 2080, 345.5, 6],
    [1090, 2090, 900, 7],
  ]);
  const node = decodeNode(encodeNode(pts, box).slice().buffer);
  assert.equal(node.count, 2);
  assert.deepEqual([node.minX, node.minY, node.width], [1000, 2000, 100]);
  assert.ok(Math.abs(node.x[1] - 50) < 0.01 && Math.abs(node.y[1] - 80) < 0.01);
  assert.ok(Math.abs(node.hag[1] - 45.5) < 0.011);
  assert.deepEqual(Array.from(node.cls), [2, 6]);
  assert.throws(() => decodeNode(new ArrayBuffer(8)));
});

test("lidarColor grades buildings by height and shades by intensity", () => {
  assert.deepEqual(lidarColor(6, 0, 255), [56, 189, 248]);
  assert.deepEqual(lidarColor(6, 150, 255), [244, 114, 182]);
  const dim = lidarColor(2, 0, 0);
  const bright = lidarColor(2, 0, 255);
  assert.ok(dim[0] < bright[0]);
});

test("imageryPixel maps EPSG:3857 to the Web-Mercator tile and pixel", () => {
  const half = Math.PI * 6378137;
  assert.deepEqual(imageryPixel(-half, half, 1), { tx: 0, ty: 0, px: 0, py: 0 });
  assert.deepEqual(imageryPixel(half / 2, -half / 2, 1), { tx: 1, ty: 1, px: 128, py: 128 });
  const [x, y] = lngLatTo3857(-84.388, 33.757);
  const p = imageryPixel(x, y, 18);
  assert.equal(p.tx, Math.floor(((-84.388 + 180) / 360) * 2 ** 18));
  assert.ok(p.px >= 0 && p.px < 256 && p.py >= 0 && p.py < 256);
});
