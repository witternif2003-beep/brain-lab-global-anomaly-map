import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestRelease, buildingsUrl, HEIGHT_EXPRESSION, OVERTURE_FULL_ZOOM, BUILDINGS_2D_MIN_ZOOM } from '../../lib/ga-buildings/overture';

const xml = `<ListBucketResult><CommonPrefixes><Prefix>tiles/2026-09-23.0/</Prefix></CommonPrefixes>
<CommonPrefixes><Prefix>tiles/2026-09-23.1/</Prefix></CommonPrefixes>
<CommonPrefixes><Prefix>tiles/2026-10-21.0/</Prefix></CommonPrefixes></ListBucketResult>`;

test('the newest Overture release wins, including the revision suffix', () => {
  assert.equal(latestRelease(xml), '2026-10-21.0');
  assert.equal(latestRelease(xml.replace('2026-10-21.0', '2026-08-01.0')), '2026-09-23.1');
  assert.equal(latestRelease('<ListBucketResult/>'), null);
});

test('the source URL uses the pmtiles protocol over public HTTPS', () => {
  assert.equal(buildingsUrl('2026-10-21.0'), 'pmtiles://https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-10-21.0/buildings.pmtiles');
});

test('a LiDAR-measured height outranks the recorded height, floors and the 5 m default', () => {
  assert.deepEqual(HEIGHT_EXPRESSION[1], ['feature-state', 'lidarHeight']);
  assert.deepEqual(HEIGHT_EXPRESSION[2], ['get', 'height']);
  assert.deepEqual((HEIGHT_EXPRESSION[3] as unknown[])[3], 5);
});

test('2D outlines start five zooms before the complete z14 building tiles', () => {
  assert.equal(BUILDINGS_2D_MIN_ZOOM, 10);
  assert.equal(OVERTURE_FULL_ZOOM, 14);
});

import { PART_BASE_EXPRESSION, PART_HEIGHT_EXPRESSION, BUILDING_3D_LAYERS, SHELL_OPACITY } from '../../lib/ga-buildings/overture';

test('building parts sit on their recorded base and rise to their recorded height', () => {
  assert.deepEqual(PART_BASE_EXPRESSION[1], ['get', 'min_height']);
  assert.deepEqual(PART_HEIGHT_EXPRESSION[1], ['get', 'height']);
});

test('buildings split into parts stay drawn as see-through shells, and LiDAR dims all three layers', () => {
  assert.ok(SHELL_OPACITY > 0 && SHELL_OPACITY < 1);
  assert.deepEqual([...BUILDING_3D_LAYERS], ['buildings-3d', 'buildings-3d-shell', 'buildings-parts-3d']);
});
