import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FLOW_COLOR_EXPRESSION, FLOW_COLORS, FLOW_FREE_MIN, FLOW_SLOW_MIN, flowBand, flowMode, mockFlowCollection, tomtomFlowTileUrl, validTile } from '../../lib/ga-traffic-flow/flow';

test('flow mode: key → live, explicit flag → mock, otherwise off (no invented congestion)', () => {
  assert.equal(flowMode({}), 'off');
  assert.equal(flowMode({ TOMTOM_API_KEY: '  ' }), 'off');
  assert.equal(flowMode({ TRAFFIC_FLOW_MOCK: 'true' }), 'off');
  assert.equal(flowMode({ TRAFFIC_FLOW_MOCK: '1' }), 'mock');
  assert.equal(flowMode({ TOMTOM_API_KEY: 'k', TRAFFIC_FLOW_MOCK: '1' }), 'live');
});

test('tile validation and TomTom relative-flow URL', () => {
  assert.ok(validTile(12, 1093, 1645));
  assert.ok(!validTile(23, 0, 0));
  assert.ok(!validTile(2, 4, 0));
  assert.ok(!validTile(1.5, 0, 0));
  assert.equal(tomtomFlowTileUrl(12, 1, 2, 'a/b'), 'https://api.tomtom.com/traffic/map/4/tile/flow/relative/12/1/2.pbf?key=a%2Fb');
});

test('congestion bands: green ≥ 0.75, yellow ≥ 0.40, red below, dark red for closures', () => {
  assert.equal(flowBand(1), 'free');
  assert.equal(flowBand(FLOW_FREE_MIN), 'free');
  assert.equal(flowBand(0.6), 'slow');
  assert.equal(flowBand(FLOW_SLOW_MIN), 'slow');
  assert.equal(flowBand(0.39), 'jam');
  assert.equal(flowBand(0.9, true), 'closed');
  assert.equal(flowBand(null), 'free');
  const flat = JSON.stringify(FLOW_COLOR_EXPRESSION);
  for (const c of Object.values(FLOW_COLORS)) assert.ok(flat.includes(c));
  assert.ok(flat.includes(String(FLOW_FREE_MIN)) && flat.includes(String(FLOW_SLOW_MIN)));
});

test('mock collection is labelled mock and covers every band', () => {
  const fc = mockFlowCollection();
  assert.ok(fc.features.every((f) => f.properties.mock && f.properties.road.startsWith('MOCK')));
  const bands = new Set(fc.features.map((f) => flowBand(f.properties.traffic_level, !!f.properties.road_closure)));
  assert.deepEqual([...bands].sort(), ['closed', 'free', 'jam', 'slow']);
});
