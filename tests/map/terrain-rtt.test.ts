import { test } from "node:test";
import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import { freeIdleDrapes } from "../../lib/map/terrain-rtt";

test("freeIdleDrapes destroys only the pooled drapes and reports how many", () => {
  let destroyed = 0;
  const pool = Array.from({ length: 198 }, () => ({ texture: { destroy: () => destroyed++ } }));
  const painter = { _rttObjectRecyclePool: pool, clearRTTPool() { for (const o of this._rttObjectRecyclePool) o.texture.destroy(); this._rttObjectRecyclePool.length = 0; } };
  assert.equal(freeIdleDrapes({ painter } as unknown as MapLibreMap), 198);
  assert.equal(destroyed, 198);
  assert.equal(freeIdleDrapes({ painter } as unknown as MapLibreMap), 0);
  assert.equal(freeIdleDrapes({} as unknown as MapLibreMap), 0);
});
