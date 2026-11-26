import { test } from "node:test";
import assert from "node:assert/strict";
import { localSiderealDeg, projectRaDec, skyBasis, skyBodyPositions } from "../../lib/sky-photo";

const ATLANTA = { lat: 33.749, lon: -84.388 };
const view = (bearingDeg: number, pitchDeg: number, date: Date) => ({
  width: 1000,
  height: 600,
  fovDeg: 36.87,
  bearingDeg,
  pitchDeg,
  date,
  ...ATLANTA,
});

test("GMST at the J2000.0 epoch is 280.46061837°", () => {
  assert.ok(Math.abs(localSiderealDeg(new Date("2000-01-01T12:00:00Z"), 0) - 280.46061837) < 1e-6);
});

test("Polaris sits at screen centre when facing north at an elevation equal to the latitude", () => {
  const date = new Date("2026-10-01T03:00:00Z");
  const basis = skyBasis(view(0, 90 + ATLANTA.lat, date));
  const p = projectRaDec(basis, 1000, 600, 2.530, 89.264);
  assert.ok(p.visible);
  assert.ok(Math.abs(p.x - 500) < 25 && Math.abs(p.y - 300) < 25, `${p.x},${p.y}`);
});

test("facing south, a star east of the meridian appears left of centre and above the horizon line", () => {
  const date = new Date("2026-10-01T03:00:00Z");
  const lstHours = localSiderealDeg(date, ATLANTA.lon) / 15;
  const basis = skyBasis(view(180, 90, date));
  const p = projectRaDec(basis, 1000, 600, (lstHours + 1) % 24, -45);
  assert.ok(p.front && p.visible);
  assert.ok(p.x < 500, `x=${p.x}`);
  assert.ok(p.y < 300, `y=${p.y}`);
});

test("screen → sky → screen round-trips through the camera basis", () => {
  const basis = skyBasis(view(37, 78, new Date("2026-10-01T03:00:00Z")));
  for (const [nx, ny] of [[0, 0], [0.6, 0.8], [-0.9, -0.4]]) {
    const d = [0, 1, 2].map((i) => basis.forward[i] + basis.right[i] * nx * basis.tanX + basis.up[i] * ny * basis.tanY);
    const len = Math.hypot(d[0], d[1], d[2]);
    const ra = ((Math.atan2(d[1], d[0]) * 180) / Math.PI / 15 + 24) % 24;
    const dec = (Math.asin(d[2] / len) * 180) / Math.PI;
    const p = projectRaDec(basis, 1000, 600, ra, dec);
    assert.ok(Math.abs(p.x - ((nx + 1) / 2) * 1000) < 1e-6 && Math.abs(p.y - ((1 - ny) / 2) * 600) < 1e-6);
  }
});

test("Moon and planet positions come from the ephemeris", () => {
  const bodies = skyBodyPositions(new Date("2026-10-01T03:00:00Z"), ATLANTA.lat, ATLANTA.lon);
  assert.deepEqual(bodies.map((b) => b.id), ["Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]);
  for (const b of bodies) assert.ok(b.raHours >= 0 && b.raHours < 24 && Math.abs(b.decDeg) <= 30, `${b.id} ${b.raHours} ${b.decDeg}`);
});
