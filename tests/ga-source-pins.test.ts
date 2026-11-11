import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIN_CATEGORIES, largestRing, pinId, pollMs, staleness, toPins } from '../lib/ga-source-pins';
import { transitMarkers, type LiveMarker } from '../lib/ga-live-markers/parse';

test('every category is a distinct layer and the moving ones start on', () => {
  const layers = PIN_CATEGORIES.map((c) => c.layer);
  assert.equal(new Set(layers).size, layers.length);
  assert.equal(layers.length, 23);
  assert.deepEqual(PIN_CATEGORIES.filter((c) => c.on).map((c) => c.layer), ['aircraft', 'vessels', 'transit', 'micromobility']);
});

test('GTFS-RT positions reach the pin without rounding', () => {
  // float32 values as a protobuf decoder returns them
  const lon = Math.fround(-84.267612);
  const lat = Math.fround(33.782071);
  const ms = transitMarkers([{ lon, lat, timestamp: 1_800_000_000, routeId: '29', vehicleLabel: '1604', bearing: 176, speedMs: null , tripId: null }], 'MARTA');
  assert.equal(ms.length, 1);
  const [pin] = toPins('transit', { markers: ms });
  assert.equal(pin.position[0], lon);
  assert.equal(pin.position[1], lat);
  assert.equal(pin.marker.props.agency, 'MARTA');
  assert.equal(pin.key, 'transit:vehicle:1604:MARTA');
});

test('pins drop non-finite coordinates and keep identity across refreshes', () => {
  const m = (lon: number, label: string): LiveMarker => ({ lon, lat: 33.7, observedAt: null, label, props: { vid: label } });
  const a = toPins('vessels', { markers: [m(-81.1, 'A'), m(NaN, 'B')] });
  const b = toPins('vessels', { markers: [m(-81.2, 'A')] });
  assert.equal(a.length, 1);
  assert.equal(a[0].key, b[0].key);
  assert.equal(pinId('aircraft', { lon: 0, lat: 0, observedAt: null, label: 'N660AM', props: {} }), 'aircraft:label:N660AM');
});

test('poll interval follows the API and stale layers are flagged', () => {
  assert.equal(pollMs({ refreshSeconds: 20 }), 20_000);
  assert.equal(pollMs({ refreshSeconds: 1 }), 10_000);
  assert.equal(pollMs(null), 60_000);
  const now = Date.parse('2026-01-01T00:10:00Z');
  assert.equal(staleness('2026-01-01T00:09:30Z', 20, now), 'fresh');
  assert.equal(staleness('2026-01-01T00:05:00Z', 20, now), 'stale');
  assert.equal(staleness('not a date', 20, now), 'stale');
});

test('Georgia boundary ring is the TIGER mainland outline', () => {
  const ring = largestRing(JSON.parse(readFileSync('public/geo/ga-state-boundary.geojson', 'utf8')));
  assert.ok(ring.length > 1000);
  const lons = ring.map((p) => p[0]);
  assert.ok(Math.min(...lons) < -85 && Math.max(...lons) > -81);
});
