import { test } from "node:test";
import assert from "node:assert/strict";
import { sharpenBasemap } from "../../lib/map/sharp-raster";

const style = {
  version: 8,
  sources: {
    sat: { type: "raster", tiles: ["https://x/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 21 },
    naip: { type: "raster", tiles: ["https://x/exportImage?bbox={bbox-epsg-3857}&size=256,256&f=image"], tileSize: 256, maxzoom: 18 },
    trails: { type: "raster", tiles: ["https://t/{z}/{x}/{y}.png"], tileSize: 256 },
    "terrain-dem": { type: "raster-dem", tiles: ["https://d/{z}/{x}/{y}.png"], tileSize: 256 },
  },
  layers: [],
};

test("2×/3× screens fetch one zoom finer for imagery sources only, keeping maxzoom", () => {
  const out = sharpenBasemap(style, 3);
  assert.equal(out.sources.sat.tileSize, 128);
  assert.equal(out.sources.sat.maxzoom, 21);
  assert.equal(out.sources.naip.tileSize, 256);
  assert.match(out.sources.naip.tiles[0], /size=512,512/);
  assert.equal(out.sources.trails, style.sources.trails);
  assert.equal(out.sources["terrain-dem"], style.sources["terrain-dem"]);
  assert.equal(style.sources.sat.tileSize, 256);
});

test("1× screens, a recent GPU crash, and style URLs are left unchanged", () => {
  assert.equal(sharpenBasemap(style, 1), style);
  assert.equal(sharpenBasemap(style, 3, 1), style);
  assert.equal(sharpenBasemap("https://demotiles.maplibre.org/style.json", 3), "https://demotiles.maplibre.org/style.json");
});
