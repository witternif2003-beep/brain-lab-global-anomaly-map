import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchSize } from '../../lib/webgpu/point-raster';

// GPU correctness checks run in their own process (npm run check:webgpu): Dawn's Node
// bindings abort inside the node:test runner.
test('dispatch splits past the 65535 workgroup limit', () => {
  assert.deepEqual(dispatchSize(1), [1, 1]);
  assert.deepEqual(dispatchSize(256 * 65535), [65535, 1]);
  assert.deepEqual(dispatchSize(10_000_000), [39063, 1]);
  assert.deepEqual(dispatchSize(500_000_000), [65535, 30]);
});
