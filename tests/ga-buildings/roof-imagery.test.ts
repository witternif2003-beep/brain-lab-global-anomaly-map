import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageColor, liftShade, naipPatchUrl, patchBbox, rgbHex, NAIP_GROUND_M, PATCH_PX } from '../../lib/ga-buildings/roof-imagery';

test('a NAIP patch covers 64 px of 0.6 m ground sampling around the footprint centre', () => {
  const b = patchBbox(1000, 2000);
  assert.ok(Math.abs(b[2] - b[0] - PATCH_PX * NAIP_GROUND_M) < 1e-9);
  assert.ok(Math.abs(b[0] - (1000 - 19.2)) < 1e-9 && Math.abs(b[3] - (2000 + 19.2)) < 1e-9);
  assert.match(naipPatchUrl(b), /bboxSR=3857&imageSR=3857&size=64,64&format=jpgpng/);
});

test('the roof colour averages the middle of the patch and ignores transparent pixels', () => {
  const px = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    px[i * 4] = 200;
    px[i * 4 + 1] = 100;
    px[i * 4 + 2] = 50;
    px[i * 4 + 3] = 255;
  }
  assert.deepEqual(averageColor(px, 8), [200, 100, 50]);
  assert.deepEqual(averageColor(new Uint8ClampedArray(8 * 8 * 4), 8), [203, 213, 225]);
});

test('deep shade is lifted but a bright roof keeps its own colour', () => {
  assert.deepEqual(liftShade([203, 213, 225]), [203, 213, 225]);
  const lifted = liftShade([10, 10, 10]);
  assert.ok(lifted[0] > 60 && lifted[0] < 80);
});

test('colours render as CSS hex', () => {
  assert.equal(rgbHex([0, 16, 255]), '#0010ff');
});
