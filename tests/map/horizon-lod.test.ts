import { test } from "node:test";
import assert from "node:assert/strict";
import { horizonLod, MAPLIBRE_DEFAULT_LOD } from "../../lib/map/horizon-lod";
import { skyFor } from "../../lib/ga-sky";

test("horizonLod keeps distant tiles closer to the centre zoom than MapLibre's default", () => {
  for (const touch of [true, false]) {
    const l = horizonLod(touch);
    assert.ok(l.levels < MAPLIBRE_DEFAULT_LOD.levels);
    assert.ok(l.ratio > MAPLIBRE_DEFAULT_LOD.ratio);
  }
  assert.ok(horizonLod(false).levels < horizonLod(true).levels, "desktop sharper than phone");
});

test("horizonLod falls back to MapLibre's default after a GPU crash", () => {
  assert.deepEqual(horizonLod(true, 1), { ...MAPLIBRE_DEFAULT_LOD });
});

test("sky keeps fog at the horizon and atmosphere at maximum", () => {
  for (const elev of [-20, -5, 2, 30]) {
    const s = skyFor(elev) as Record<string, unknown>;
    assert.equal(s["fog-ground-blend"], 1);
    assert.equal(s["atmosphere-blend"], 1);
  }
});
