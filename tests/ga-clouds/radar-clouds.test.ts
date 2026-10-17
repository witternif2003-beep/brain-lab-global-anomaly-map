import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePng16, readMrmsGrib2, type MrmsGrid } from "../../lib/ga-clouds/mrms";
import { radarCloudBlocks } from "../../lib/ga-clouds/radar-clouds";

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

test("radarCloudBlocks follows the echo cell by cell, not a circle", () => {
  // An L-shaped echo: 3 cells on row 0, 1 cell on row 1.
  const top = grid(3, 2, [5, 5, 5, 5, 0, 0]);
  const dbz = grid(3, 2, [25, 25, 25, 25, -99, -99]);
  const fc = radarCloudBlocks(top, dbz, [], { factor: 1, topStepM: 250, now: new Date("2026-10-17T18:00:00Z") });
  assert.equal(fc.features.length, 2);
  for (const f of fc.features) {
    assert.equal(f.geometry.coordinates[0].length, 5);
    assert.equal(f.properties?.topM, 5000);
    assert.equal(f.properties?.baseM, 0);
    assert.equal(f.properties?.band, "light");
  }
  const area = fc.features.reduce((s, f) => {
    const c = f.geometry.coordinates[0];
    return s + Math.round(((c[1][0] - c[0][0]) * (c[0][1] - c[2][1])) / 1e-4);
  }, 0);
  assert.equal(area, 4);
});

test("radarCloudBlocks splits by echo-top step and reflectivity band and uses METAR bases", () => {
  const top = grid(2, 1, [3, 9]);
  const dbz = grid(2, 1, [35, 58]);
  const fc = radarCloudBlocks(top, dbz, [{ icaoId: "KATL", lat: 34, lon: -84, clouds: [{ cover: "BKN", base: 2000 }, { cover: "OVC", base: 9000 }] }], { factor: 1, topStepM: 250, now: new Date() });
  const props = fc.features.map((f) => f.properties).sort((a, b) => Number(a?.topM) - Number(b?.topM));
  assert.deepEqual(props.map((p) => [p?.band, p?.topM, p?.baseM, p?.baseStation]), [["moderate", 3000, 610, "KATL"], ["intense", 9000, 610, "KATL"]]);
});

test("radarCloudBlocks drops cells without an echo top and rejects mismatched grids", () => {
  assert.equal(radarCloudBlocks(grid(2, 1, [0, -1]), grid(2, 1, [10, 40]), [], { factor: 1, topStepM: 250, now: new Date() }).features.length, 0);
  assert.throws(() => radarCloudBlocks(grid(2, 1, [1, 1]), grid(1, 1, [20]), [], { factor: 1, topStepM: 250, now: new Date() }));
});
