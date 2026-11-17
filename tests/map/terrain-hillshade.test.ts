import { test } from "node:test";
import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import { HILLSHADE_LAYER, HILLSHADE_SOURCE, addTerrainHillshade, hillshadeBeforeId } from "../../lib/map/terrain-hillshade";

const dem = { type: "raster-dem" as const, tiles: ["/api/ga-terrain/{z}/{x}/{y}.png"], encoding: "terrarium" as const, tileSize: 256, maxzoom: 17 };

function fakeMap(layers: Array<{ id: string; type: string }>) {
  const sources: Record<string, any> = {};
  const added: Array<{ layer: any; before?: string }> = [];
  const map = {
    getSource: (id: string) => sources[id],
    addSource: (id: string, s: any) => { sources[id] = s; },
    getLayer: (id: string) => added.find((a) => a.layer.id === id)?.layer,
    addLayer: (layer: any, before?: string) => { added.push({ layer, before }); },
    getStyle: () => ({ layers }),
  } as unknown as MapLibreMap;
  return { map, sources, added };
}

test("shading sits directly above the satellite and NAIP imagery", () => {
  assert.equal(hillshadeBeforeId([{ id: "sat", type: "raster" }, { id: "naip", type: "raster" }, { id: "solar-terminator-shade", type: "fill" }]), "solar-terminator-shade");
  assert.equal(hillshadeBeforeId([{ id: "usgstopo", type: "raster" }, { id: "trails", type: "raster" }]), undefined);
});

test("on a vector basemap shading goes above the land fills", () => {
  assert.equal(hillshadeBeforeId([{ id: "background", type: "background" }, { id: "countries-fill", type: "fill" }, { id: "countries-boundary", type: "line" }]), "countries-boundary");
});

test("phones shade from z15 tiles, desktop from the full z17 pyramid, and a second call adds nothing", () => {
  const phone = fakeMap([{ id: "sat", type: "raster" }]);
  addTerrainHillshade(phone.map, dem, true);
  addTerrainHillshade(phone.map, dem, true);
  assert.equal(phone.sources[HILLSHADE_SOURCE].maxzoom, 15);
  assert.equal(phone.added.length, 1);
  assert.equal(phone.added[0].layer.id, HILLSHADE_LAYER);
  const desk = fakeMap([{ id: "sat", type: "raster" }]);
  addTerrainHillshade(desk.map, dem, false);
  assert.equal(desk.sources[HILLSHADE_SOURCE].maxzoom, 17);
});
