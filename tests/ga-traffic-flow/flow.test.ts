import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FLOW_COLOR_EXPRESSION, FLOW_COLORS, flowBand, jamFactor, flowMode, mockFlowCollection, tomtomFlowTileUrl, validTile } from '../../lib/ga-traffic-flow/flow';

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

test('jamFactor bands: green 0–3, yellow 4–6, red 7–8, dark red 9–10 or closed', () => {
  assert.equal(jamFactor(1), 0);
  assert.equal(jamFactor(0), 10);
  assert.equal(jamFactor(0.7), 3);
  assert.equal(jamFactor(null), 0);
  assert.equal(jamFactor(1.4), 0);
  assert.equal(flowBand(1), 'free');
  assert.equal(flowBand(0.7), 'free');
  assert.equal(flowBand(0.6), 'slow');
  assert.equal(flowBand(0.4), 'slow');
  assert.equal(flowBand(0.3), 'jam');
  assert.equal(flowBand(0.2), 'jam');
  assert.equal(flowBand(0.1), 'closed');
  assert.equal(flowBand(0.9, true), 'closed');
  assert.equal(flowBand(null), 'free');
  const flat = JSON.stringify(FLOW_COLOR_EXPRESSION);
  for (const c of Object.values(FLOW_COLORS)) assert.ok(flat.includes(c));
  assert.ok(flat.includes('"traffic_level"') && flat.includes('"road_closure"') && flat.includes('[0,1,2,3]') && flat.includes('[7,8]'));
});

test('mock collection is labelled mock and covers every band', () => {
  const fc = mockFlowCollection();
  assert.ok(fc.features.every((f) => f.properties.mock && f.properties.road.startsWith('MOCK')));
  const bands = new Set(fc.features.map((f) => flowBand(f.properties.traffic_level, !!f.properties.road_closure)));
  assert.deepEqual([...bands].sort(), ['closed', 'free', 'jam', 'slow']);
});

test('flow tile URL gets a per-minute stamp so the 60 s refresh busts the CDN once per minute', async () => {
  const { flowTilesUrl, FLOW_REFRESH_MS } = await import('../../lib/ga-traffic-flow-layer');
  assert.equal(FLOW_REFRESH_MS, 60_000);
  assert.equal(flowTilesUrl('https://x', '/api/traffic-flow/{z}/{x}/{y}', 120_000), 'https://x/api/traffic-flow/{z}/{x}/{y}?t=2');
  assert.equal(flowTilesUrl('https://x', '/t?a=1', 59_999), 'https://x/t?a=1&t=0');
});
