import { test } from 'node:test';
import assert from 'node:assert/strict';
import { naipLatestSearch, naipLatestTileUrl, naipSearchBody, photoBlock, resetNaipLatestSearch, tileBounds3857, tileOf3857 } from '../../lib/ga-buildings/naip-latest';
import { lngLatTo3857 } from '../../lib/ga-lidar/ept';

test('the mosaic search asks for NAIP flown 2025 onward, newest first', () => {
  const b = naipSearchBody();
  assert.deepEqual(b.collections, ['naip']);
  assert.equal(b.filter.args[1], '2025-01-01T00:00:00Z');
  assert.deepEqual(b.sortby, [{ field: 'datetime', direction: 'desc' }]);
});

test('tile URLs use the Planetary Computer mosaic tiler with RGB bands', () => {
  assert.equal(
    naipLatestTileUrl('abc', 19, 1, 2),
    'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/abc/tiles/WebMercatorQuad/19/1/2?collection=naip&assets=image&asset_bidx=image%7C1%2C2%2C3',
  );
});

test('a point lies inside the bounds of the tile computed for it', () => {
  const [x, y] = lngLatTo3857(-84.39, 33.75);
  const t = tileOf3857(x, y, 19);
  const [minX, minY, maxX, maxY] = tileBounds3857(19, t.tx, t.ty);
  assert.ok(x >= minX && x <= maxX && y >= minY && y <= maxY);
  assert.ok(t.px >= 0 && t.px < 256 && t.py >= 0 && t.py < 256);
});

test('a house fits one 2×2 photo block; a footprint wider than the block gets none', () => {
  const [x, y] = lngLatTo3857(-84.39, 33.75);
  const b = photoBlock([x - 8, y - 8, x + 8, y + 8], 19);
  assert.ok(b);
  assert.ok(b.bounds[0] <= x - 8 && b.bounds[2] >= x + 8 && b.bounds[1] <= y - 8 && b.bounds[3] >= y + 8);
  assert.equal(photoBlock([x - 200, y - 8, x + 200, y + 8], 19), null);
});

test('registration failures resolve to null so callers fall back to NAIP 2023', async () => {
  resetNaipLatestSearch();
  const id = await naipLatestSearch((async () => new Response('down', { status: 503 })) as typeof fetch);
  assert.equal(id, null);
  resetNaipLatestSearch();
  const ok = await naipLatestSearch((async () => Response.json({ searchid: 'pc1.x' })) as typeof fetch);
  assert.equal(ok, 'pc1.x');
  resetNaipLatestSearch();
});
