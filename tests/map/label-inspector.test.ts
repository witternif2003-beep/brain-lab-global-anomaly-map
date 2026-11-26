import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelInfoRows, labelInfoHtml } from '../../lib/map/label-info';
import { ROAD_WIDTH_M, roadPxAt, M_PER_PX_Z16 } from '../../lib/ga-roads-overlay';
import { INTERSTATE_DECK_WIDTH_M, BRIDGE_LAYER_M, DECK_THICKNESS_M } from '../../lib/traffic-bridges';

test('a base-map road label card names the road, its layer and its source', () => {
  const rows = labelInfoRows({ name: 'Peachtree St NE', class: 'primary', ref: 'US 19' }, 'highway-name-primary', 'openmaptiles', 'transportation_name', '<a href="https://openfreemap.org">OpenFreeMap</a> © OpenStreetMap');
  assert.deepEqual(rows.slice(0, 4), [['Label', 'Peachtree St NE'], ['Map layer', 'highway-name-primary'], ['Data source', 'openmaptiles › transportation_name'], ['Credit', 'OpenFreeMap © OpenStreetMap']]);
  assert.ok(rows.some(([k, v]) => k === 'ref' && v === 'US 19'));
});

test('labels without a name still get a card, and HTML in attributes is escaped', () => {
  const rows = labelInfoRows({ count: 3, note: '<img src=x onerror=alert(1)>' }, 'cluster-count', 'agencies');
  assert.equal(rows[0][1], '(no text attribute)');
  const html = labelInfoHtml(rows);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('road overlay is metre-true from z16: a 3-lane Interstate carriageway is 15.2 m on the ground', () => {
  assert.ok(Math.abs(ROAD_WIDTH_M.motorway - 15.24) < 0.01);
  assert.ok(Math.abs(M_PER_PX_Z16 - 1.0046) < 0.001);
  for (const z of [16, 18, 20, 22]) {
    const groundM = roadPxAt('motorway', z) * M_PER_PX_Z16 / 2 ** (z - 16);
    assert.ok(Math.abs(groundM - ROAD_WIDTH_M.motorway) < 1e-9);
  }
  assert.ok(roadPxAt('minor', 16) > 1.2, 'z16 metric width must not be thinner than the z14 pixel width');
});

test('bridge decks: one Interstate carriageway wide and high enough for 16-ft clearance', () => {
  assert.ok(Math.abs(INTERSTATE_DECK_WIDTH_M - 11.58) < 0.01);
  assert.ok(BRIDGE_LAYER_M - DECK_THICKNESS_M >= 16 * 0.3048);
});
