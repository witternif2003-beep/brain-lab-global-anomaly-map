import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import FG from "../../lib/ga-live-markers/fg-airframes.json";
import { fgLivery } from "../../lib/ga-live-markers/airframe";
import { applyLiveryColours, parseAirframeBin } from "../../lib/ga-mesh-models";

type Model = { id: string; triangles: number; liveries?: Record<string, { name: string | null; sha256: string }> };
const models = FG.models as unknown as Model[];

test("every livery file exists, matches its hash and has one RGB triple per triangle", () => {
  let n = 0;
  for (const m of models) for (const [code, l] of Object.entries(m.liveries ?? {})) {
    assert.match(code, /^[A-Z]{3}$/);
    const f = `public/models/airframes/liveries/${m.id}/${code}.bin`;
    assert.ok(existsSync(f), f);
    const b = readFileSync(f);
    assert.equal(b.length, m.triangles * 3, f);
    assert.equal(createHash("sha256").update(b).digest("hex"), l.sha256, f);
    n++;
  }
  assert.ok(n > 50, `${n} liveries`);
});

test("callsign ICAO airline prefix picks the livery; registrations and unknown codes keep base paint", () => {
  assert.equal(fgLivery("b748", "CLX6696")?.code, "CLX");
  assert.equal(fgLivery("b748", " clx6696 ")?.code, "CLX");
  assert.equal(fgLivery("a320", "DAL1234")?.code, "DAL");
  assert.equal(fgLivery("a320", "N123AB"), null);
  assert.equal(fgLivery("a320", "ZZZ1"), null);
  assert.equal(fgLivery("c182", "DAL1"), null);
});

test("livery repaint keeps geometry and replaces colours per triangle", () => {
  const b = readFileSync("public/models/airframes/b748.bin");
  const base = parseAirframeBin(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const rgb = new Uint8Array(readFileSync("public/models/airframes/liveries/b748/CLX.bin"));
  const m = applyLiveryColours(base, rgb);
  assert.equal(m.attributes.positions, base.attributes.positions);
  assert.notEqual(m.attributes.colors.value, base.attributes.colors.value);
  assert.ok(Math.abs(m.attributes.colors.value[3] - rgb[0] / 255) < 1e-6);
  assert.equal(applyLiveryColours(base, new Uint8Array(3)), base);
});
