import { test } from "node:test";
import assert from "node:assert/strict";
import { sparkle, WATER_RGBA } from "../lib/ga-precip/drop-colors";

test("rain drops are translucent water blue, glint toward white, snow stays white", () => {
  const d = { n: 2, speed: new Float32Array([0, 0]), phase: new Float32Array([0, 0]), snow: new Uint8Array([0, 1]) };
  const out = new Uint8Array(8);
  sparkle(d, 0, out);
  assert.deepEqual([...out.slice(0, 4)], [...WATER_RGBA]);
  assert.ok(out[2] > out[0] && out[3] < 255, "blue-dominant and translucent");
  assert.ok(out[4] > 200 && out[5] > 200 && out[6] > 200, "snow is white");
  sparkle(d, Math.PI / 4, out);
  assert.ok(out[0] > 200 && out[1] > 240, "full glint is near white");
});
