import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import FG from "../../lib/ga-live-markers/fg-airframes.json";
import { airframeModel, faaSpec, fgAirframe } from "../../lib/ga-live-markers/airframe";
import { parseAirframeBin } from "../../lib/ga-mesh-models";

for (const m of FG.models) {
  test(`FlightGear ${m.id} mesh matches its manifest`, () => {
    const buf = readFileSync(`public/models/airframes/${m.id}.bin`);
    assert.equal(createHash("sha256").update(buf).digest("hex"), m.sha256);
    const mesh = parseAirframeBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const p = mesh.attributes.positions.value;
    assert.equal(p.length / 9, m.triangles);
    assert.ok(m.triangles <= 6000);
    for (let k = 0; k < 3; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = k; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
      assert.ok(Math.abs(hi - lo - m.extentM[k]) < 0.01);
    }
    assert.match(m.license, /^GPL-[23]\.0$/);
  });
}

test("FlightGear meshes are stretched to FAA length, span and tail height", () => {
  for (const type of ["A320", "B738", "A21N"]) {
    const fg = fgAirframe(type)!;
    const { kind, scale } = airframeModel(type, "A3");
    const f = faaSpec(type)!;
    assert.equal(kind, `fg-${fg.id}`);
    assert.ok(Math.abs(scale[0] * fg.extentM[0] - f.lengthFt * 0.3048) < 1e-6);
    assert.ok(Math.abs(scale[1] * fg.extentM[1] - f.spanFt * 0.3048) < 1e-6);
  }
  assert.equal(fgAirframe("C172"), null);
});
