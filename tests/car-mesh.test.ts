import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CAR_DIMS_M, carMesh } from "../lib/car-mesh";

test("car mesh: body + cabin, 24 triangles, within the stated footprint, sits above the road", () => {
  const m = carMesh();
  const p = m.positions.value;
  assert.equal(p.length / 9, 24);
  let minZ = Infinity, maxZ = -Infinity, maxX = 0, maxY = 0;
  for (let i = 0; i < p.length; i += 3) {
    maxX = Math.max(maxX, Math.abs(p[i])); maxY = Math.max(maxY, Math.abs(p[i + 1]));
    minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
  }
  assert.ok(Math.abs(maxX * 2 - CAR_DIMS_M.width) < 1e-6);
  assert.ok(Math.abs(maxY * 2 - CAR_DIMS_M.length) < 1e-6);
  assert.ok(Math.abs(maxZ - CAR_DIMS_M.height) < 1e-6);
  assert.ok(minZ > 0 && minZ < 0.3);
});

test("car mesh: unit normals agree with each triangle's winding (counter-clockwise from outside)", () => {
  const { positions: { value: p }, normals: { value: n } } = carMesh();
  for (let t = 0; t < p.length; t += 9) {
    const a = [p[t], p[t + 1], p[t + 2]], b = [p[t + 3], p[t + 4], p[t + 5]], c = [p[t + 6], p[t + 7], p[t + 8]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const dotN = x[0] * n[t] + x[1] * n[t + 1] + x[2] * n[t + 2];
    assert.ok(Math.abs(Math.hypot(n[t], n[t + 1], n[t + 2]) - 1) < 1e-6);
    assert.ok(dotN > 0, `triangle ${t / 9} winding disagrees with its normal`);
  }
});
