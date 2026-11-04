import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GA_INCIDENT_BBOX, INCIDENT_ICON_EXPRESSION, INCIDENT_MAX_BBOX_KM2, bboxAreaKm2, clampBbox, incidentDetailsUrl, incidentIcon, incidentImageId, mergeIncidents, parseBbox, subdivideBbox, tomtomIncidentTileUrl,
} from '../lib/ga-traffic-incidents/incidents';
import { calculateRouteUrl, parseLngLat, routeSummaryText, routeToFeature } from '../lib/ga-traffic-route/route';
import { nextRouteState } from '../lib/ga-traffic-route-control';

test('Georgia bbox is split into cells under the 10,000 km² Incident Details limit that tile it exactly', () => {
  assert.ok(bboxAreaKm2(GA_INCIDENT_BBOX) > 200_000);
  const cells = subdivideBbox(GA_INCIDENT_BBOX);
  assert.ok(cells.length <= 48);
  for (const c of cells) assert.ok(bboxAreaKm2(c) < INCIDENT_MAX_BBOX_KM2);
  const sum = cells.reduce((a, c) => a + bboxAreaKm2(c), 0);
  assert.ok(Math.abs(sum - bboxAreaKm2(GA_INCIDENT_BBOX)) < 1);
  assert.equal(subdivideBbox([-84.5, 33.7, -84.3, 33.9]).length, 1);
});

test('bbox parsing and clamping to Georgia', () => {
  assert.deepEqual(parseBbox('-84.5,33.7,-84.3,33.9'), [-84.5, 33.7, -84.3, 33.9]);
  assert.equal(parseBbox('1,2,3'), null);
  assert.equal(parseBbox('-84,34,-85,35'), null);
  assert.deepEqual(clampBbox([-90, 25, -84, 33]), [-85.6, 30.3, -84, 33]);
  assert.equal(clampBbox([-100, 40, -95, 45]), null);
});

test('TomTom URLs: v5 incident details with present-only filter, v4 incident tiles', () => {
  const u = new URL(incidentDetailsUrl([-84.5, 33.7, -84.3, 33.9], 'k/1'));
  assert.equal(u.pathname, '/traffic/services/5/incidentDetails');
  assert.equal(u.searchParams.get('key'), 'k/1');
  assert.equal(u.searchParams.get('timeValidityFilter'), 'present');
  assert.equal(u.searchParams.get('bbox'), '-84.50000,33.70000,-84.30000,33.90000');
  assert.equal(tomtomIncidentTileUrl(11, 543, 819, 'a/b'), 'https://api.tomtom.com/traffic/map/4/tile/incidents/11/543/819.pbf?key=a%2Fb');
});

test('icon categories: accident triangle, road works cone, closures, unknown fallback', () => {
  assert.equal(incidentIcon(1), 'accident');
  assert.equal(incidentIcon(9), 'roadworks');
  assert.equal(incidentIcon(8), 'closed');
  assert.equal(incidentIcon(4), 'weather');
  assert.equal(incidentIcon(99), 'unknown');
  const flat = JSON.stringify(INCIDENT_ICON_EXPRESSION);
  assert.ok(flat.includes('icon_category_0') && flat.includes(incidentImageId('accident')) && flat.endsWith(`"${incidentImageId('unknown')}"]`));
});

test('merged incidents are de-duplicated by id across overlapping cells', () => {
  const inc = { type: 'Feature', geometry: { type: 'Point', coordinates: [-84.4, 33.8] }, properties: { id: 'A', iconCategory: 1, magnitudeOfDelay: 2, events: [{ description: 'Crash' }], delay: 120, roadNumbers: ['I-75'] } };
  const fc = mergeIncidents([{ incidents: [inc] }, { incidents: [inc, { ...inc, properties: { ...inc.properties, id: 'B', iconCategory: 9 } }] }]);
  assert.equal(fc.features.length, 2);
  assert.equal(fc.features[0].properties?.category, 'Accident');
  assert.equal(fc.features[0].properties?.description, 'Crash');
  assert.equal(fc.features[1].properties?.icon, 'roadworks');
});

test('routing: Georgia-only points, traffic=true fastest URL, polyline to GeoJSON', () => {
  assert.deepEqual(parseLngLat('-84.388,33.749'), [-84.388, 33.749]);
  assert.equal(parseLngLat('-122.4,37.7'), null);
  assert.equal(parseLngLat('abc'), null);
  const u = new URL(calculateRouteUrl([-84.388, 33.749], [-84.55, 33.95], 'k'));
  assert.ok(u.pathname.endsWith('/33.749000,-84.388000:33.950000,-84.550000/json'));
  assert.equal(u.searchParams.get('traffic'), 'true');
  assert.equal(u.searchParams.get('routeType'), 'fastest');
  const summary = { lengthInMeters: 31947, travelTimeInSeconds: 2162, trafficDelayInSeconds: 311, departureTime: 'd', arrivalTime: 'a' };
  const f = routeToFeature({ routes: [{ summary, legs: [{ points: [{ latitude: 33.7, longitude: -84.3 }, { latitude: 33.8, longitude: -84.4 }] }] }] });
  assert.deepEqual(f?.geometry.coordinates, [[-84.3, 33.7], [-84.4, 33.8]]);
  assert.equal(routeToFeature({ routes: [] }), null);
  assert.equal(routeSummaryText(summary), '31.9 km · 36 min (incl. 5 min traffic delay)');
});

test('route state machine: idle → start → end → loading → result/error, button clears', () => {
  assert.equal(nextRouteState('idle', 'button'), 'picking-start');
  assert.equal(nextRouteState('picking-start', 'click'), 'picking-end');
  assert.equal(nextRouteState('picking-end', 'click'), 'loading');
  assert.equal(nextRouteState('loading', 'click'), 'loading');
  assert.equal(nextRouteState('loading', 'done'), 'result');
  assert.equal(nextRouteState('loading', 'fail'), 'error');
  assert.equal(nextRouteState('result', 'click'), 'picking-end');
  assert.equal(nextRouteState('result', 'button'), 'idle');
  assert.equal(nextRouteState('idle', 'click'), 'idle');
});
