import { test } from "node:test";
import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import { capTileTexturePool, TOUCH_TILE_TEXTURE_POOL } from "../lib/map/tile-texture-pool";

test("caps MapLibre's tile texture pool and frees the excess", () => {
  let destroyed = 0;
  const tex = () => ({ destroy: () => { destroyed++; } });
  class Painter { static MAX_TEXTURE_POOL_SIZE_PER_BUCKET = 50; _tileTextures = { 256: Array.from({ length: 20 }, tex), 512: Array.from({ length: 3 }, tex) }; }
  const painter = new Painter();
  assert.equal(capTileTexturePool({ painter } as unknown as MapLibreMap), TOUCH_TILE_TEXTURE_POOL);
  assert.equal(Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET, TOUCH_TILE_TEXTURE_POOL);
  assert.equal(painter._tileTextures[256].length, TOUCH_TILE_TEXTURE_POOL);
  assert.equal(painter._tileTextures[512].length, 3);
  assert.equal(destroyed, 20 - TOUCH_TILE_TEXTURE_POOL);
});

test("never raises the pool and ignores unknown internals", () => {
  class Painter { static MAX_TEXTURE_POOL_SIZE_PER_BUCKET = 4; }
  assert.equal(capTileTexturePool({ painter: new Painter() } as unknown as MapLibreMap), 4);
  assert.equal(capTileTexturePool({} as unknown as MapLibreMap), null);
});
