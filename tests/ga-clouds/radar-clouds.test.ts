import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePng16, readMrmsGrib2, type MrmsGrid } from "../../lib/ga-clouds/mrms";
import { BASE_SEARCH_KM, radarCloudCells } from "../../lib/ga-clouds/radar-clouds";
import { radarCloudBoxes } from "../../lib/ga-clouds/radar-boxes";

function png16(w: number, h: number, px: number[]): Buffer {
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(y % 2 ? 2 : 1);
    for (let x = 0; x < w; x++) {
      const v = px[y * w + x];
      const left = x ? px[y * w + x - 1] : 0;
      const up = y ? px[(y - 1) * w + x] : 0;
      const ref = y % 2 ? up : left;
      rows.push(((v >> 8) - (ref >> 8)) & 0xff, ((v & 0xff) - (ref & 0xff)) & 0xff);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 16;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]);
}

function grib(w: number, h: number, la1: number, lo1: number, px: number[], R: number, E: number, D: number): Buffer {
  const sec = (n: number, body: Buffer) => {
    const head = Buffer.alloc(5);
    head.writeUInt32BE(body.length + 5);
    head[4] = n;
    return Buffer.concat([head, body]);
  };
  const s1 = Buffer.alloc(16);
  s1.writeUInt16BE(2026, 7);
  s1.set([10, 17, 5, 34, 41], 9);
  const s3 = Buffer.alloc(67);
  s3.writeUInt32BE(w, 25);
  s3.writeUInt32BE(h, 29);
  s3.writeUInt32BE(la1 * 1e6, 41);
  s3.writeUInt32BE(lo1 * 1e6, 45);
  s3.writeUInt32BE(10_000, 58);
  s3.writeUInt32BE(10_000, 62);
  const s5 = Buffer.alloc(16);
  s5.writeUInt16BE(41, 4);
  s5.writeFloatBE(R, 6);
  s5.writeUInt16BE(E < 0 ? 0x8000 | -E : E, 10);
  s5.writeUInt16BE(D, 12);
  const body = Buffer.concat([sec(1, s1), sec(3, s3), sec(5, s5), sec(7, png16(w, h, px)), Buffer.from("7777")]);
  const s0 = Buffer.alloc(16);
  s0.write("GRIB", 0, "ascii");
  s0[7] = 2;
  return Buffer.concat([s0, body]);
}

test("decodePng16 reverses sub/up filters and crops", () => {
  const px = [1, 2, 300, 4, 5, 65535, 7, 8, 9];
  const { samples } = decodePng16(png16(3, 3, px), 1, 3, 1, 3);
  assert.deepEqual([...samples], [5, 65535, 8, 9]);
});

test("readMrmsGrib2 applies (R + X·2^E)/10^D and subsets to the bbox", () => {
  const g = readMrmsGrib2(grib(4, 3, 34.0, 275.0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], -10, 1, 1), { latMin: 33.985, latMax: 34.0, lngMin: -84.995, lngMax: -84.97 });
  assert.equal(g.time, "2026-10-17T05:34:41Z");
  assert.equal(g.width, 3);
  assert.equal(g.height, 2);
  assert.equal(g.lng0, -84.99);
  assert.equal(g.lat0, 34);
  assert.deepEqual([...g.values].map((v) => Math.round(v * 10) / 10), [-0.8, -0.6, -0.4, 0, 0.2, 0.4]);
});

const grid = (w: number, h: number, values: number[]): MrmsGrid => ({ time: "t", width: w, height: h, lat0: 34, lng0: -84, stepDeg: 0.01, values: Float32Array.from(values) });

const KATL = { icaoId: "KATL", lat: 34, lon: -84, reportTime: "2026-10-17T17:52:00Z", clouds: [{ cover: "BKN", base: 2000 }, { cover: "OVC", base: 9000 }] };

test("radarCloudCells keeps every native cell 1:1 with its exact echo top", () => {
  const top = grid(3, 2, [6.1234, 0, 5.5, 0, 7, 0]);
  const dbz = grid(3, 2, [22.4, 0, 47.6, 0, 60, 0]);
  const rc = radarCloudCells(top, dbz, [KATL]);
  assert.equal(rc.stepDeg, 0.01);
  assert.equal(rc.noBase, 0);
  assert.deepEqual(rc.cells, [0, 0, 6123, 22, 0, 2, 0, 5500, 48, 0, 1, 1, 7000, 60, 0]);
  assert.deepEqual(rc.stations, [{ id: "KATL", lat: 34, lng: -84, baseM: 610, observed: "2026-10-17T17:52:00Z" }]);
});

test(`radarCloudCells keeps cells with no measured base within ${BASE_SEARCH_KM} km, flagged -1`, () => {
  assert.equal(BASE_SEARCH_KM, 25);
  const far = { ...KATL, lat: 34.3 }; // ~33 km north
  const rc = radarCloudCells(grid(1, 1, [8]), grid(1, 1, [40]), [far, { icaoId: "KCLR", lat: 34, lon: -84, clouds: [{ cover: "CLR", base: null }] }]);
  assert.deepEqual(rc.cells, [0, 0, 8000, 40, -1]);
  assert.equal(rc.noBase, 1);
  const [b] = radarCloudBoxes(rc, () => 300, new Date());
  assert.equal(b.baseMsl, 8000);
  assert.equal(b.topMsl, 8000);
  assert.equal(b.station, null);
  assert.equal(b.baseAglM, null);
});

test("radarCloudCells drops cells without an echo top and rejects mismatched grids", () => {
  assert.deepEqual(radarCloudCells(grid(2, 1, [0, -1]), grid(2, 1, [10, 40]), [KATL]).cells, []);
  assert.throws(() => radarCloudCells(grid(2, 1, [1, 1]), grid(1, 1, [20]), []));
});

test("radarCloudBoxes: exact cell footprint, base = ground + measured base, top = echo top (both above sea level)", () => {
  const rc = radarCloudCells(grid(2, 1, [6, 1]), grid(2, 1, [35, 20]), [KATL]);
  const boxes = radarCloudBoxes(rc, () => 300, new Date("2026-10-17T18:00:00Z"));
  assert.equal(boxes.length, 2);
  const [b] = boxes;
  assert.deepEqual(b.polygon, [[-84.005, 34.005], [-83.995, 34.005], [-83.995, 33.995], [-84.005, 33.995], [-84.005, 34.005]]);
  assert.equal(b.baseMsl, 910);
  assert.equal(b.topMsl, 6000);
  assert.equal(b.baseAglM, 610);
  assert.equal(b.band, "moderate");
  assert.equal(b.station, "KATL");
  assert.equal(b.stationKm, 0);
  assert.equal(boxes[1].topMsl, 1000);
  assert.deepEqual(radarCloudBoxes(rc, () => 400, new Date()).map((x) => [x.baseMsl, x.topMsl]), [[1010, 6000], [1000, 1000]]);
});

test("radarCloudBoxes is deterministic and adds no shape of its own", () => {
  const rc = radarCloudCells(grid(4, 4, Array(16).fill(9)), grid(4, 4, Array(16).fill(50)), [KATL]);
  const now = new Date("2026-10-17T18:00:00Z");
  const a = radarCloudBoxes(rc, () => 0, now);
  assert.deepEqual(a, radarCloudBoxes(rc, () => 0, now));
  assert.equal(a.length, 16);
  for (const b of a) {
    assert.equal(b.polygon.length, 5);
    assert.ok(Math.abs(b.polygon[1][0] - b.polygon[0][0] - 0.01) < 1e-9);
    assert.equal(b.topMsl - b.baseMsl, 9000 - 610);
  }
});
