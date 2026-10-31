import { test } from "node:test";
import assert from "node:assert/strict";
import { airframeModel, faaSpec, meshExtent } from "../../lib/ga-live-markers/airframe";
import { geoidHeightM, mslFromGeometricFt } from "../../lib/ga-live-markers/geoid";
import { parseAdsbLol } from "../../lib/ga-live-markers/parse";

const FT = 0.3048;
const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("FAA-listed types are drawn at the FAA length, wingspan and tail height", () => {
  for (const t of ["B763", "B739", "CRJ9", "C172", "GLF5", "A321"]) {
    const f = faaSpec(t)!;
    assert.ok(f, t);
    const { kind, scale } = airframeModel(t, "A3");
    const [lx, ly, lz] = meshExtent(kind);
    close(lx * scale[0], f.lengthFt * FT);
    close(ly * scale[1], f.spanFt * FT);
    close(lz * scale[2], f.tailFt * FT);
  }
  assert.deepEqual(faaSpec(" b763 ")?.lengthFt, 180.3);
  assert.equal(airframeModel("GLF5", "A3").kind, "regionaljet");
  assert.equal(airframeModel("B763", "A5").kind, "widebody");
});

test("types missing from the FAA database keep the approximate uniform scale", () => {
  const m = airframeModel("R44", "A7");
  assert.equal(m.faa, null);
  assert.equal(m.kind, "helicopter");
  assert.equal(m.scale[0], m.scale[1]);
});

test("GEOID18 interpolation and GNSS → mean-sea-level conversion over Georgia", () => {
  close(geoidHeightM(30.4, -85.6), -27.928);
  close(geoidHeightM(35.0, -80.8), -30.396);
  close(geoidHeightM(33.64, -84.43), -29.472, 0.5);
  close(mslFromGeometricFt(10_000, 33.64, -84.43), 10_000 * FT - geoidHeightM(33.64, -84.43));
});

test("parseAdsbLol keeps GNSS altitude and derives height above sea level", () => {
  const [m] = parseAdsbLol({ now: 1e12, ac: [{ flight: "DAL927 ", t: "B752", lat: 33.64, lon: -84.43, alt_baro: 11_500, alt_geom: 12_075 }] });
  assert.equal(m.props.altGeomFt, 12_075);
  assert.equal(m.props.altMslFt, Math.round(mslFromGeometricFt(12_075, 33.64, -84.43) / FT));
  const [g] = parseAdsbLol({ now: 1e12, ac: [{ t: "B752", lat: 33.64, lon: -84.43, alt_baro: "ground", alt_geom: 1_000 }] });
  assert.equal(g.props.altMslFt, null);
});
