import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agencyCategories,
  integrityState,
  OFFENSES,
  parseAgencyDirectory,
  parseAgencySummarized,
  policeStrobeColor,
  POLICE_BLUE,
  POLICE_RED,
} from "../../lib/fbi-agencies/parse";
import { NIBRS_OFFENSES, parseNibrsAgency } from "../../lib/fbi-agencies/nibrs";

test("directory flattens counties, de-duplicates ORIs, drops non-GA ORIs and out-of-state coordinates", () => {
  const ag = parseAgencyDirectory({
    LEE: [
      { ori: "GA0880100", agency_name: "Leesburg Police Department", agency_type_name: "City", counties: "LEE", is_nibrs: true, latitude: 31.82, longitude: -84.15, nibrs_start_date: "2020-01-01" },
      { ori: "GA0880000", agency_name: "Lee County Sheriff's Office", agency_type_name: "County", counties: "LEE", is_nibrs: false, latitude: 40.7, longitude: -74.0 },
    ],
    "LEE, TERRELL": [{ ori: "GA0880100", agency_name: "dup", agency_type_name: "City", latitude: 31.8, longitude: -84.1 }],
    X: [{ ori: "FL0000000", agency_name: "Florida", latitude: 30.5, longitude: -84 }, { ori: "GAGSP0100", agency_name: "GSP Post 1", agency_type_name: "State Police", latitude: null, longitude: null }],
  });
  assert.deepEqual(ag.map((a) => a.ori), ["GA0880000", "GA0880100", "GAGSP0100"]);
  assert.equal(ag.find((a) => a.ori === "GA0880100")!.name, "Leesburg Police Department");
  assert.equal(ag.find((a) => a.ori === "GA0880000")!.lat, null);
  const cats = agencyCategories(ag);
  assert.equal(cats.reduce((n, c) => n + c.count, 0), 3);
  assert.equal(cats.find((c) => c.type === "City")!.color, "#ff2bd6");
});

test("agency series ignores Georgia/US comparison rows, keeps 12 trailing months and flags the newest FBI month", () => {
  const months = Array.from({ length: 24 }, (_, i) => `${String((i % 12) + 1).padStart(2, "0")}-${2025 + Math.floor(i / 12)}`);
  const series = (v: (i: number) => number | null) => Object.fromEntries(months.map((m, i) => [m, v(i)]));
  const raw = {
    offenses: {
      actuals: {
        "Georgia Offenses": series(() => 999),
        "Leesburg Police Department Offenses": series((i) => (i < 22 ? 1 : i === 22 ? 3 : null)),
        "Leesburg Police Department Clearances": series(() => 0),
      },
    },
    cde_properties: { max_data_date: { UCR: "11/2026" } },
  };
  const s = parseAgencySummarized("burglary", raw);
  assert.equal(s.months.length, 12);
  assert.equal(s.months[0], "12-2025");
  assert.equal(s.months.at(-1), "11-2026");
  assert.equal(s.total, 11 + 3);
  assert.equal(s.latestMonth, "11-2026");
  assert.equal(s.latest, 3);
  assert.equal(s.newInLatestFbiMonth, true);
  assert.equal(parseAgencySummarized("arson", { offenses: { actuals: {} } }).total, null);
  assert.equal(OFFENSES.length, 10);
});

test("integrity badge and police strobe colours", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  const f = { sourceUrl: "https://cde.ucr.cjis.gov/x", updatedAt: "2026-10-19T11:30:00Z" };
  assert.equal(integrityState(f, now, 90), "VERIFIED");
  assert.equal(integrityState({ ...f, updatedAt: "2026-10-19T09:00:00Z" }, now, 90), "STALE");
  assert.equal(integrityState({ ...f, updatedAt: null }, now, 90), "NO TIMESTAMP");
  assert.equal(integrityState({ ...f, error: "HTTP 502" }, now, 90), "ERROR");
  assert.equal(integrityState({ ...f, sourceUrl: "/fbi-osint" }, now, 90), "INTERNAL");
  assert.equal(policeStrobeColor(0, 240), POLICE_RED);
  assert.equal(policeStrobeColor(240, 240), POLICE_BLUE);
});

test("NIBRS: 53 Group A codes, no amber hues, victims/offenders summed and all-null breakdowns read as not published", () => {
  assert.equal(NIBRS_OFFENSES.length, 53);
  assert.equal(new Set(NIBRS_OFFENSES.map((o) => o.code)).size, 53);
  for (const o of NIBRS_OFFENSES) {
    const h = Number(/hsl\((\d+)/.exec(o.color)![1]);
    assert.ok(!(h >= 25 && h <= 50), `${o.code} hue ${h}`);
  }
  const c = parseNibrsAgency("13A", {
    victim: { sex: { Male: 2, Female: 1, Unknown: 0 }, location: { Unknown: 9, "Residence/Home": 2, Parking: 1 } },
    offense: { weapons: { None: 5, Firearm: 2, Knife: 1 } },
    offender: { sex: { Male: 2, Female: null } },
  });
  assert.deepEqual([c.victims, c.offenders, c.topLocation, c.topWeapon, c.against], [3, 2, "Residence/Home", "Firearm", "Persons"]);
  const none = parseNibrsAgency("26H", { victim: { sex: { Male: null, Female: null } }, offender: { sex: { Male: null } } });
  assert.equal(none.victims, null);
  assert.equal(none.offenders, null);
});
