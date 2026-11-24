import { test } from "node:test";
import assert from "node:assert/strict";
import { drapedSourceIds, shouldReleaseDrapes } from "../../lib/map/drape-guard";

const stacks = [["sat", "hillshade"], ["roads-line"], ["tracks-line"]];
const src: Record<string, string> = { sat: "sat", hillshade: "dem-hs", "roads-line": "roads", "tracks-line": "sat-tracks" };
const draped = drapedSourceIds(stacks, (id) => src[id]);

test("draped sources come from the drape stacks", () => {
  assert.deepEqual([...draped].sort(), ["dem-hs", "roads", "sat", "sat-tracks"]);
});

test("tile events from non-draped sources skip the drape release; everything else keeps MapLibre's behaviour", () => {
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "traffic-cars", tile: {} }, "dem", draped), false);
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "sat-tracks", tile: {} }, "dem", draped), true);
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "dem", tile: {} }, "dem", draped), true);
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "cam", tile: {}, source: { type: "image" } }, "dem", draped), true);
  assert.equal(shouldReleaseDrapes({ dataType: "style" }, "dem", draped), true);
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "traffic-cars" }, "dem", draped), true);
  assert.equal(shouldReleaseDrapes({ dataType: "source", sourceId: "traffic-cars", tile: {} }, "dem", null), true);
});
