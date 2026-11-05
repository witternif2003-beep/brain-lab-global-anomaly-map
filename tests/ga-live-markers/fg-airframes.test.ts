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
    assert.ok(m.triangles <= 16000);
    for (let k = 0; k < 3; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = k; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
      assert.ok(Math.abs(hi - lo - m.extentM[k]) < 0.01);
      if (k < 2) assert.ok(Math.abs(hi + lo) < 0.01, `${m.id} is centred on its position along axis ${k}`);
    }
    // Nose toward +x: the tail fin (top quarter of the height) is in the rear half. Helicopters have the rotor on top,
    // so there the cabin (most of the body below the rotor) must sit in the front half instead.
    const rotor = m.types.some((t) => faaSpec(t)?.rotor);
    let sumX = 0, n = 0;
    for (let i = 0; i < p.length; i += 3) if (rotor ? p[i + 2] < 0.6 * m.extentM[2] : p[i + 2] > 0.75 * m.extentM[2]) { sumX += p[i]; n++; }
    assert.ok(n > 0 && (rotor ? sumX / n > 0 : sumX / n < 0), `${m.id} nose points along +x`);
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

test("every aircraft gets a verified FlightGear shape, never a generic one", async () => {
  const { airframeModel, fgAirframeId } = await import("../../lib/ga-live-markers/airframe");
  const FGM = (await import("../../lib/ga-live-markers/fg-airframes.json")).default;
  const ACDT = (await import("../../lib/ga-live-markers/faa-acd.json")).default;
  const HELIT = (await import("../../lib/ga-live-markers/faa-heli.json")).default;
  const ids = new Set(FGM.models.map((m: { id: string }) => m.id));
  const types = [...Object.keys(ACDT.types), ...Object.keys(HELIT.types), "A339", "C172", "CRJ9", "PC12", "BE20", "GLF5", "ZZZZ", "", undefined];
  for (const t of types) for (const c of [undefined, "A1", "A2", "A3", "A5", "A7", "B1"]) {
    const { kind, scale } = airframeModel(t, c);
    assert.ok(kind.startsWith("fg-") && ids.has(kind.slice(3)), `${t}/${c} -> ${kind}`);
    assert.ok(scale.every((x) => Number.isFinite(x) && x > 0), `${t}/${c} scale`);
  }
  assert.equal(fgAirframeId("A339", "A5"), "a330");
  assert.equal(fgAirframeId("R44", "A7"), "ec135");
  assert.equal(fgAirframeId("C172", "A1"), "c182");
  assert.equal(fgAirframeId("CRJ9", "A3"), "citationx");
  assert.equal(fgAirframeId("AT76", "A2"), "q400");
  assert.equal(fgAirframeId("B77W", "A5"), "b788");
  assert.equal(fgAirframeId("A388", "A5"), "b748");
});
