import { test } from "node:test";
import assert from "node:assert/strict";
import { aircraftAltitude, altTag } from "../../lib/ga-live-markers/altitude";
import { parseAdsbLol, parseOpenSky } from "../../lib/ga-live-markers/parse";
import { mslFromGeometricFt } from "../../lib/ga-live-markers/geoid";

test("label shows the exact height the model is drawn at, with climb/descent", () => {
  const ac = { flight: "CLX6696 ", t: "B748", lat: 34.22609, lon: -83.410435, alt_baro: 35000, alt_geom: 36425, baro_rate: 0, track: 52.5, gs: 519 };
  const [m] = parseAdsbLol({ ac: [ac], now: 0 }, 0);
  const msl = Math.round(mslFromGeometricFt(36425, ac.lat, ac.lon) / 0.3048);
  assert.deepEqual(aircraftAltitude(m.props), { ft: msl, ref: "MSL" });
  assert.equal(altTag(m.props), `${msl.toLocaleString("en-US")} ft MSL`);
  assert.ok(msl > 36425, "GEOID18 is negative over Georgia, so MSL height exceeds ellipsoid height");
  const [c] = parseAdsbLol({ ac: [{ ...ac, baro_rate: -1792 }], now: 0 }, 0);
  assert.match(altTag(c.props), /^[\d,]+ ft MSL ▼1,792 fpm$/);
  const [b] = parseAdsbLol({ ac: [{ ...ac, alt_geom: undefined, baro_rate: 1216 }], now: 0 }, 0);
  assert.equal(altTag(b.props), "35,000 ft PA ▲1,216 fpm");
  const [g] = parseAdsbLol({ ac: [{ ...ac, alt_baro: "ground" as const }], now: 0 }, 0);
  assert.equal(altTag(g.props), "GND");
  const [o] = parseOpenSky({ time: 0, states: [["a", "DAL1", "US", 0, 0, -84.4, 33.6, 3000, false, 200, 90, 5.08, null, null]] });
  assert.equal(o.props.vRateFpm, 1000);
  assert.equal(altTag(o.props), "9,843 ft PA ▲1,000 fpm");
});
