import { test } from "node:test";
import assert from "node:assert/strict";
import { deckGlobeActive, GA_DECK_GLOBE_MAX_ZOOM, meshYaw } from "../../lib/ga-deck-heading";

// Nose direction on screen (compass degrees) for a mesh yaw, given deck.gl's
// MapView convention and the 180° offset of its GlobeView (visgl/deck.gl#7362).
const drawnNose = (yaw: number, globe: boolean) => (((90 - yaw) + (globe ? 180 : 0)) % 360 + 360) % 360;

test("mesh nose points along the reported track on flat and globe maps", () => {
  for (const globe of [false, true]) {
    for (const track of [0, 45, 90, 129.55, 180, 270, 359]) {
      assert.ok(Math.abs(drawnNose(meshYaw(track, globe), globe) - track) < 1e-9, `${globe ? "globe" : "flat"} track ${track}`);
    }
  }
  assert.equal(meshYaw(undefined, true), 0);
});

test("deck.gl GlobeView (and its 180° mesh offset) only applies on a globe map up to zoom 12", () => {
  assert.equal(deckGlobeActive("globe", 11), true);
  assert.equal(deckGlobeActive("globe", GA_DECK_GLOBE_MAX_ZOOM), true);
  assert.equal(deckGlobeActive("globe", 12.5), false);
  assert.equal(deckGlobeActive("mercator", 6), false);
  assert.equal(deckGlobeActive(undefined, 6), false);
});
