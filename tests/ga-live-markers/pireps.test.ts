import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAwcPireps } from "../../lib/ga-live-markers/parse";

const now = Date.parse("2026-10-14T22:10:00Z");
const feature = (obsTime: string, rawOb: string, extra: Record<string, unknown> = {}, coordinates = [-84.2931, 31.6552]) => ({
  type: "Feature",
  properties: { rawOb, airepType: "PIREP", acType: "B38M", aircraft: "Boeing 737 MAX 8", fltlvlType: "OTHER", obsTime, receiptTime: obsTime, fltlvl: 360, ...extra },
  geometry: { type: "Point", coordinates },
});

test("parseAwcPireps keeps recent Georgia-area reports with turbulence, icing and altitude", () => {
  const ms = parseAwcPireps({
    features: [
      feature("2026-10-14T21:53:00Z", "ATL UUA /OV PZD/TM 2153/FL360/TP B38M/TB MOD", { tbInt1: "MOD", tbType1: "CAT", icgInt1: "LGT", temp: -52, wdir: 270, wspd: 85 }),
      feature("2026-10-14T10:00:00Z", "ATL UA /OV PZD/TM 1000/FL360/TP B38M/TB NEG"),
      feature("2026-10-14T21:00:00Z", "BOS UA /OV BOS/TM 2100/FL100/TP C172", {}, [-71.0, 42.36]),
    ],
  }, now);
  assert.equal(ms.length, 1);
  const [m] = ms;
  assert.equal(m.observedAt, "2026-10-14T21:53:00.000Z");
  assert.equal(m.label, "PIREP B38M");
  assert.equal(m.props.urgent, true);
  assert.equal(m.props.altFt, 36_000);
  assert.equal(m.props.turbulence, "MOD CAT");
  assert.equal(m.props.icing, "LGT");
  assert.equal(m.props.tempC, -52);
  assert.equal(m.props.windKt, 85);
});

test("parseAwcPireps reports ground-level altitude as unknown and routine reports as not urgent", () => {
  const [m] = parseAwcPireps({ features: [feature("2026-10-14T22:00:00Z", "AGS UA /OV AIK/TM 2200/FLUNKN/TP SR22", { fltlvlType: "GRND", fltlvl: 0 })] }, now);
  assert.equal(m.props.altFt, null);
  assert.equal(m.props.urgent, false);
  assert.equal(parseAwcPireps({}, now).length, 0);
});
