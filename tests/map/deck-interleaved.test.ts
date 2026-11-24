import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useInterleavedDeck } from '../../lib/map/deck-mode';

test('phones draw markers inside the map context; desktop and WebGPU keep the overlaid canvas', () => {
  assert.equal(useInterleavedDeck('webgl2', true, ''), true);
  assert.equal(useInterleavedDeck('webgl2', false, ''), false);
  assert.equal(useInterleavedDeck('webgpu', true, ''), false);
  assert.equal(useInterleavedDeck('webgl2', true, '?deck=overlaid'), false);
});
