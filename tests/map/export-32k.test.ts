import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { planExport, EXPORT_32K_WIDTH } from '../../lib/map/export-32k';
import { PngStreamWriter, crc32 } from '../../lib/map/png-stream';

test('a 1280×720 view plans one 32,768 × 18,432 image in 2,048 px tiles', () => {
  const p = planExport(1280, 720, 36.87);
  assert.equal(p.width, EXPORT_32K_WIDTH);
  assert.equal(p.height, 18432);
  assert.equal(p.cols, 16);
  assert.equal(p.rows, 9);
  assert.equal(p.tiles.length, 144);
  assert.ok(Math.abs(p.zoomOffset - Math.log2(18432 / 720)) < 1e-12);
});

test('every tile shares one camera: its narrowed field of view times the grid equals the full view', () => {
  const fov = 36.87;
  const p = planExport(1280, 720, fov);
  const tanTile = Math.tan((p.tiles[0].fovDeg * Math.PI) / 360);
  assert.ok(Math.abs((tanTile * p.height) / 2048 - Math.tan((fov * Math.PI) / 360)) < 1e-12);
});

test('the principal point stays at the full image centre in every tile (off-centre frustum)', () => {
  const p = planExport(1280, 720, 36.87);
  for (const t of p.tiles) {
    assert.equal(t.x0 + t.centerX, p.width / 2);
    assert.equal(t.y0 + t.centerY, p.height / 2);
  }
});

test('edge tiles are cropped so the image is exactly the planned size', () => {
  const p = planExport(1000, 777, 36.87);
  const widths = p.tiles.filter((t) => t.row === 0).reduce((s, t) => s + t.w, 0);
  const heights = p.tiles.filter((t) => t.col === 0).reduce((s, t) => s + t.h, 0);
  assert.equal(widths, p.width);
  assert.equal(heights, p.height);
});

test('the streamed PNG decodes to the exact rows written', async () => {
  const parts: Uint8Array[] = [];
  const w = new PngStreamWriter((b) => void parts.push(b), 3, 2, 8);
  await w.start();
  const rows = Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255, 13, 14, 15, 255, 16, 17, 18, 255]);
  await w.writeRows(rows.subarray(0, 12), 1);
  await w.writeRows(rows.subarray(12), 1);
  await w.finish();
  const buf = Buffer.concat(parts);
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buf.readUInt32BE(16), 3);
  assert.equal(buf.readUInt32BE(20), 2);
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    assert.equal(buf.readUInt32BE(o + 8 + len), crc32([new TextEncoder().encode(type), data]));
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, 2 * (1 + 12));
  assert.equal(raw[0], 0);
  assert.deepEqual([...raw.subarray(1, 13)], [...rows.subarray(0, 12)]);
  assert.deepEqual([...raw.subarray(14, 26)], [...rows.subarray(12)]);
});

test('finishing early is an error rather than a truncated image', async () => {
  const w = new PngStreamWriter(() => {}, 2, 2);
  await w.start();
  await assert.rejects(() => w.finish(), /1? ?of 2 rows|0 of 2 rows/);
});

import { exportSpeedGate } from '../../lib/map/export-32k';

test('the 180 s export gate is strict on a hardware GPU', () => {
  assert.deepEqual(exportSpeedGate('ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11)', 179), { pass: true, limitS: 180, warning: null });
  assert.equal(exportSpeedGate('Apple M3 Max', 181).pass, false);
});

test('a software GPU warns and is allowed 1,200 s (the measured 931 s VM run passes)', () => {
  const g = exportSpeedGate('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 931);
  assert.equal(g.pass, true);
  assert.equal(g.limitS, 1200);
  assert.equal(g.warning, 'WARN: Software GPU detected, bypassing 180s speed gate');
  assert.equal(exportSpeedGate('SwiftShader', 1201).pass, false);
});
