import { test } from "node:test";
import assert from "node:assert/strict";
import { teardropMesh, teardropPx, teardropRadius } from "../lib/ga-precip/teardrop-mesh";

test("teardrop mesh: pointed tip on top, round bottom at z = 0, never flat", () => {
  const m = teardropMesh(10, 8);
  const p = m.attributes.positions.value;
  let zMin = Infinity, zMax = -Infinity, rMax = 0, zAtRMax = 0;
  for (let i = 0; i < p.length; i += 3) {
    const r = Math.hypot(p[i], p[i + 1]);
    zMin = Math.min(zMin, p[i + 2]); zMax = Math.max(zMax, p[i + 2]);
    if (r > rMax) { rMax = r; zAtRMax = p[i + 2]; }
  }
  assert.ok(Math.abs(zMin) < 1e-6 && Math.abs(zMax - 1) < 1e-6);
  assert.ok(zAtRMax < 0.5, "widest part is in the lower half, like a teardrop");
  assert.ok(rMax * 2 > 0.5 && rMax * 2 < 0.7, `width/height ${rMax * 2}`);
  // Round bottom: radius shrinks smoothly to 0, no flat base ring.
  assert.ok(teardropRadius(Math.PI) < 1e-9);
  assert.ok(teardropRadius(Math.PI * 0.9) < teardropRadius(Math.PI * 0.7));
  // Sharp tip: radius near the top is far smaller than near the bottom at the same distance from the pole.
  assert.ok(teardropRadius(Math.PI * 0.1) < 0.2 * teardropRadius(Math.PI * 0.9));
});

test("teardrop mesh: triangles wind outward so back-face culling keeps the visible side", () => {
  const m = teardropMesh(10, 8);
  const p = m.attributes.positions.value, ix = m.indices.value;
  let outward = 0, total = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
    total++;
    if (n[0] * cx + n[1] * cy > 0) outward++;
  }
  assert.equal(total, 2 * 10 * 7);
  assert.equal(outward, total);
  const nr = m.attributes.normals.value;
  for (let i = 0; i < nr.length; i += 3) assert.ok(Math.abs(Math.hypot(nr[i], nr[i + 1], nr[i + 2]) - 1) < 1e-5);
});

test("teardrop on-screen size grows from 4 px at state zoom to 10 px at street zoom", () => {
  assert.equal(teardropPx(6), 4);
  assert.equal(teardropPx(15), 10);
  assert.equal(teardropPx(20), 10);
});
