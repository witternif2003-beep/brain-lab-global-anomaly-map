import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector4 } from 'three';
import { clipW, depthCoefficients, linearDepth } from '../../lib/ga-lidar/edl';

test('depth linearisation recovers clip w from the depth buffer for a tilted perspective camera', () => {
  const proj = new Matrix4().makePerspective(-0.4, 0.4, 0.3, -0.3, 0.5, 5000);
  const view = new Matrix4().makeRotationX(-0.9).multiply(new Matrix4().makeTranslation(-20, 40, -300));
  const mvp = proj.multiply(view);
  const { a, b } = depthCoefficients(mvp.elements);
  for (const [x, y, z] of [[0, 0, 0], [30, -50, 12], [-200, 400, 5]]) {
    const v = new Vector4(x, y, z, 1).applyMatrix4(mvp);
    const d = (v.z / v.w + 1) / 2;
    assert.ok(Math.abs(linearDepth(d, a, b) - Math.abs(v.w)) / Math.abs(v.w) < 1e-6);
    assert.ok(Math.abs(clipW(mvp.elements, x, y, z) - v.w) < 1e-9);
  }
});
