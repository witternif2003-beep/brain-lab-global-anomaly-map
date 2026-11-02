import { test } from "node:test";
import assert from "node:assert/strict";
import { skyBasis } from "../../lib/sky-photo";
import { SKY_TILE_PX, skyPxPerDeg, skyTileLevel, visibleSkyTiles } from "../../lib/sky-tiles";

const DATE = new Date("2026-11-02T03:00:00Z");
const view = (bearingDeg: number, pitchDeg: number, width: number, height: number, lat = 33.749) => ({
  width, height, fovDeg: 36.87, bearingDeg, pitchDeg, lat, lon: -84.388, date: DATE,
});

test("phone at 2x needs more than the 4K base and gets the 16K tiles; a 2160 px tall (4K monitor) map gets the 32K tiles", () => {
  const phone = skyBasis(view(0, 80, 780, 1360));
  assert.ok(skyPxPerDeg(phone, 1360) > 4096 / 360);
  assert.equal(skyTileLevel(skyPxPerDeg(phone, 1360), 4096), 16384);
  const desk = skyBasis(view(0, 80, 3840, 2160));
  assert.equal(skyTileLevel(skyPxPerDeg(desk, 2160), 8192), 32768);
  assert.equal(skyTileLevel(8192 / 360, 8192), 0);
});

for (const [name, bearing, pitch, lat] of [
  ["looking north over the horizon", 0, 80, 33.749],
  ["looking south-west", 225, 85, 33.749],
  ["at the RA seam / near the pole", 0, 85, 89.5],
] as const) {
  test(`every above-horizon screen pixel lies in a listed tile whose rectangle contains it (${name})`, () => {
    const w = 780, h = 1360, level = 16384;
    const basis = skyBasis(view(bearing, pitch, w, h, lat));
    const tiles = visibleSkyTiles(basis, w, h, level, basis.zenith);
    assert.ok(tiles.length > 0);
    const cols = level / SKY_TILE_PX;
    const rows = cols / 2;
    let checked = 0;
    for (let k = 0; k < 4000; k++) {
      const px = ((k * 0.618034) % 1) * w, py = ((k * 0.414214) % 1) * h;
      const nx = (px / w) * 2 - 1, ny = 1 - (py / h) * 2;
      const d = [0, 1, 2].map((i) => basis.forward[i] + basis.right[i] * nx * basis.tanX + basis.up[i] * ny * basis.tanY);
      const len = Math.hypot(d[0], d[1], d[2]);
      const alt = (d[0] * basis.zenith![0] + d[1] * basis.zenith![1] + d[2] * basis.zenith![2]) / len;
      if (alt < 0) continue;
      const u = (((0.5 - Math.atan2(d[1], d[0]) / (2 * Math.PI)) % 1) + 1) % 1;
      const v = 0.5 - Math.asin(d[2] / len) / Math.PI;
      const key = `${level}/${Math.min(rows - 1, Math.floor(v * rows))}/${Math.floor(u * cols) % cols}`;
      const t = tiles.find((x) => x.key === key);
      assert.ok(t, `pixel ${px.toFixed(0)},${py.toFixed(0)} tile ${key} missing`);
      assert.ok(px >= t.x0 && px <= t.x1 && py >= t.y0 && py <= t.y1, `pixel outside ${key} rectangle`);
      checked++;
    }
    assert.ok(checked > 100);
  });
}

test("tiles entirely below the horizon are skipped", () => {
  const w = 780, h = 1360;
  const down = skyBasis(view(0, 0, w, h));
  assert.equal(visibleSkyTiles(down, w, h, 16384, down.zenith).length, 0);
  const up = skyBasis(view(0, 80, w, h));
  assert.ok(visibleSkyTiles(up, w, h, 16384, up.zenith).length <= 24, "phone view fits the touch tile cap");
});
