import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaussianize, neighbourScales, SH_C0, toPlyColumns } from '../../lib/ga-lidar/gaussian';

test('scale is the mean distance to the 3 nearest neighbours on a 1 m grid', () => {
  const pts: number[] = [];
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) pts.push(x, y, 0);
  const s = neighbourScales(new Float32Array(pts), 0.01, 5);
  assert.ok(Math.abs(s[5 * 10 + 5] - 1) < 1e-6);
  assert.ok(Math.abs(s[0] - (1 + 1 + Math.SQRT2) / 3) < 1e-6);
});

test('isolated points are clamped to maxScale', () => {
  const s = neighbourScales(new Float32Array([0, 0, 0, 100, 0, 0]), 0.05, 2);
  assert.deepEqual([...s], [2, 2]);
});

test('ply columns encode log scale, identity rotation, SH DC colour and logit opacity', () => {
  const set = gaussianize(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), new Uint8Array([255, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0]), { maxScale: 5 });
  const c = toPlyColumns(set, 0.5);
  assert.equal(c.rot_0[0], 1);
  assert.equal(c.rot_1[0], 0);
  assert.ok(Math.abs(Math.exp(c.scale_0[0]) - set.scale[0]) < 1e-6);
  assert.ok(Math.abs(c.f_dc_0[0] * SH_C0 + 0.5 - 1) < 1e-6);
  assert.ok(Math.abs(c.f_dc_1[0] * SH_C0 + 0.5) < 1e-6);
  assert.ok(Math.abs(c.opacity[0]) < 1e-6);
});
