import { test } from "node:test";
import assert from "node:assert/strict";
import { LIGHTS_FLOOR, maskTileToNight, nightFactor } from "../../lib/terminator/night-mask";
import type { SubsolarPoint } from "../../lib/terminator/solar";

const SIZE = 8;
const tile = (r: number, g: number, b: number, a: number) => {
  const px = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let o = 0; o < px.length; o += 4) px.set([r, g, b, a], o);
  return px;
};
const alphas = (px: Uint8ClampedArray) => [...px.filter((_, i) => i % 4 === 3)];
// z=4 tile x=4,y=7 covers 90°W-67.5°W, 0-21.9°N.
const [Z, X, Y] = [4, 4, 7];
const noonOverTile: SubsolarPoint = { declinationDeg: 10, longitudeDeg: -80 };
const midnightOverTile: SubsolarPoint = { declinationDeg: -10, longitudeDeg: 100 };

test("night factor is 0 in daylight and 1 at astronomical night", () => {
  assert.equal(nightFactor(10), 0);
  assert.equal(nightFactor(-25), 1);
  assert.ok(nightFactor(-9) > 0 && nightFactor(-9) < 1);
});

test("overlays vanish in daylight and keep their alpha at night", () => {
  const day = tile(255, 255, 255, 200);
  maskTileToNight(day, SIZE, Z, X, Y, noonOverTile, "overlay");
  assert.ok(alphas(day).every((a) => a === 0));
  const night = tile(255, 255, 255, 200);
  maskTileToNight(night, SIZE, Z, X, Y, midnightOverTile, "overlay");
  assert.ok(alphas(night).every((a) => a === 200));
});

test("city lights keep bright pixels and drop the unlit background at night", () => {
  const lit = tile(255, 220, 150, 255);
  maskTileToNight(lit, SIZE, Z, X, Y, midnightOverTile, "lights");
  assert.ok(alphas(lit).every((a) => a === 255));
  const dark = Math.floor(LIGHTS_FLOOR * 255);
  const unlit = tile(dark, dark, dark, 255);
  maskTileToNight(unlit, SIZE, Z, X, Y, midnightOverTile, "lights");
  assert.ok(alphas(unlit).every((a) => a === 0));
});
