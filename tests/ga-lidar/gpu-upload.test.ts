import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BufferAttribute } from 'three';
import { fullArray, releaseAfterUpload } from '../../lib/ga-lidar/gpu-upload';
import { LIDAR_BYTES_PER_POINT, LIDAR_JS_BYTES_PER_POINT, lidarBytesPerPoint } from '../../lib/map/vram-budget';

/** three.js's own WebGL attribute uploader, driven by a fake WebGL context that records what reaches the GPU. */
async function uploader() {
  const path: string = 'three/src/renderers/webgl/WebGLAttributes.js';
  const { WebGLAttributes } = await import(path);
  const gpu: { data?: ArrayBufferView; sub?: ArrayBufferView } = {};
  const gl = {
    ARRAY_BUFFER: 34962, FLOAT: 5126, UNSIGNED_BYTE: 5121,
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: (_t: number, a: ArrayBufferView) => { gpu.data = (a as Float32Array).slice(); },
    bufferSubData: (_t: number, _o: number, a: ArrayBufferView) => { gpu.sub = (a as Float32Array).slice(); },
  };
  return { attrs: new WebGLAttributes(gl), gpu, ARRAY_BUFFER: gl.ARRAY_BUFFER };
}

test('JavaScript copy is freed after upload; count and GPU data are kept', async () => {
  const { attrs, gpu, ARRAY_BUFFER } = await uploader();
  const attr = releaseAfterUpload(new BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6]), 3));
  attrs.update(attr, ARRAY_BUFFER);
  assert.equal(attr.array.length, 0);
  assert.ok(attr.array instanceof Float32Array);
  assert.equal(attr.count, 2);
  assert.deepEqual([...(gpu.data as Float32Array)], [1, 2, 3, 4, 5, 6]);
});

test('a rebuilt full-length array re-uploads in place and is freed again', async () => {
  const { attrs, gpu, ARRAY_BUFFER } = await uploader();
  const attr = releaseAfterUpload(new BufferAttribute(new Float32Array(6), 3));
  attrs.update(attr, ARRAY_BUFFER);
  const arr = fullArray<Float32Array>(attr);
  assert.equal(arr.length, 6);
  arr.set([6, 5, 4, 3, 2, 1]);
  attr.array = arr;
  attr.needsUpdate = true;
  attrs.update(attr, ARRAY_BUFFER);
  assert.deepEqual([...(gpu.sub as Float32Array)], [6, 5, 4, 3, 2, 1]);
  assert.equal(attr.array.length, 0);
});

test('fullArray reuses an array that has not been uploaded yet', () => {
  const attr = new BufferAttribute(new Uint8Array(9), 3, true);
  assert.equal(fullArray(attr), attr.array);
});

test('phones budget GPU and JavaScript bytes per point, desktops GPU only', () => {
  assert.equal(lidarBytesPerPoint(false), LIDAR_BYTES_PER_POINT);
  assert.equal(lidarBytesPerPoint(true), LIDAR_BYTES_PER_POINT + LIDAR_JS_BYTES_PER_POINT);
  assert.equal(lidarBytesPerPoint(true), 29);
});
