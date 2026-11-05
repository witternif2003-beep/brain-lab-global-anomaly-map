import { test } from "node:test";
import assert from "node:assert/strict";
import { augusta911Markers, augustaGeocodeQuery, easternToIso, parseAccpdIncidents, parseAugusta911Feed } from "../../lib/ga-live-markers/parse";

const post = (rkey: string, text: string, createdAt: string, q?: string) => ({
  post: {
    uri: `at://did:plc:x/app.bsky.feed.post/${rkey}`,
    author: { handle: "auge911feed.bsky.social" },
    record: { text, createdAt, facets: q ? [{ features: [{ uri: `http://maps.google.com/maps?q=${encodeURIComponent(q)}&utm_source=dlvr.it` }] }] : [] },
  },
});

test("easternToIso converts US Eastern wall-clock time across EDT and EST", () => {
  assert.equal(easternToIso(2026, 10, 7, 11, 1), "2026-10-07T15:01:00.000Z");
  assert.equal(easternToIso(2026, 1, 15, 0, 30), "2026-01-15T05:30:00.000Z");
});

test("parseAugusta911Feed reads call time, type and full location, skips reposts and merges repeated posts", () => {
  const calls = parseAugusta911Feed({
    feed: [
      post("a1", "10/7/2026@11:01 AM: TRAFFIC ACCIDENT NO INJURY at INTERSTATE 520 EB AND  WINDSOR SPRING RD AUGUSTA GA http://maps.google.c...", "2026-10-07T15:03:11Z", "INTERSTATE 520 EB AND  WINDSOR SPRING RD AUGUSTA GA"),
      post("a2", "10/7/2026@11:01 AM: TRAFFIC ACCIDENT NO INJURY at INTERSTATE 520 EB AND  WINDSOR SPRING RD AUGUSTA GA http://maps.google.c...", "2026-10-07T15:04:00Z", "INTERSTATE 520 EB AND  WINDSOR SPRING RD AUGUSTA GA"),
      post("a3", "10/6/2026@10:52 PM: STRUCTURE FIRE at 33.5026669911576,-82.0610137332532", "2026-10-07T02:55:00Z"),
      { reason: { $type: "app.bsky.feed.defs#reasonRepost" }, ...post("a4", "10/6/2026@9:00 PM: X at Y", "2026-10-07T01:00:00Z") },
      post("a5", "Service notice: feed maintenance tonight", "2026-10-07T01:00:00Z"),
    ],
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    callType: "TRAFFIC ACCIDENT NO INJURY",
    location: "INTERSTATE 520 EB AND WINDSOR SPRING RD AUGUSTA GA",
    calledAt: "2026-10-07T15:01:00.000Z",
    postedAt: "2026-10-07T15:03:11Z",
    postUrl: "https://bsky.app/profile/auge911feed.bsky.social/post/a1",
    coord: null,
  });
  assert.equal(calls[1].calledAt, "2026-10-07T02:52:00.000Z");
  assert.deepEqual(calls[1].coord, [-82.0610137332532, 33.5026669911576]);
});

test("augustaGeocodeQuery writes intersections for the Augusta GIS locator", () => {
  assert.equal(augustaGeocodeQuery("INTERSTATE 520 EB AND WINDSOR SPRING RD AUGUSTA GA"), "INTERSTATE 520 EB & WINDSOR SPRING RD");
  assert.equal(augustaGeocodeQuery("2121 WINDSOR SPRING RD AUGUSTA GA"), "2121 WINDSOR SPRING RD");
});

test("augusta911Markers places by post coordinates or locator hit, flags low scores and drops unmatched calls", () => {
  const calls = [
    { callType: "A", location: "1 MAIN ST AUGUSTA GA", calledAt: "2026-10-07T15:01:00.000Z", postedAt: "2026-10-07T15:04:00Z", postUrl: null, coord: null },
    { callType: "B", location: "33.5,-82.06", calledAt: null, postedAt: null, postUrl: null, coord: [-82.06, 33.5] as [number, number] },
    { callType: "C", location: "NOWHERE AUGUSTA GA", calledAt: null, postedAt: null, postUrl: null, coord: null },
  ];
  const ms = augusta911Markers(calls, (q) => (q === "1 MAIN ST" ? { lon: -81.97, lat: 33.47, score: 72, matched: "1 Main St, Augusta, 30901" } : null));
  assert.equal(ms.length, 2);
  assert.equal(ms[0].props.placedBy, "Augusta GIS address locator");
  assert.equal(ms[0].props.approximate, true);
  assert.equal(ms[0].props.postDelayMin, 3);
  assert.equal(ms[1].props.placedBy, "coordinates in post");
  assert.equal(ms[1].props.approximate, false);
});

test("parseAccpdIncidents keeps every call at its published point with a local date", () => {
  const ms = parseAccpdIncidents({
    features: [
      { attributes: { Incident_Number: "2026-10040122", Incident_Type: "Domestic (10-16)", Date: 1_791_086_400_000, Lat: 33.920334044, Lon: -83.38659951, Call_Source: "911", Personnel_Incidentcount: null, ObjectId: 185780 } },
      { attributes: { Incident_Number: "2026-1", Incident_Type: "Traffic Stop", Date: 1_791_086_400_000, Lat: null, Lon: null, Call_Source: "Officer", ObjectId: 1 } },
      { attributes: { Incident_Number: "2026-2", Incident_Type: "Theft", Date: 1_791_086_400_000, Lat: 40.7, Lon: -74, Call_Source: "Phone", ObjectId: 2 } },
    ],
  });
  assert.equal(ms.length, 1);
  assert.equal(ms[0].label, "Domestic (10-16)");
  assert.equal(ms[0].lat, 33.92033);
  assert.equal(ms[0].observedAt, "2026-10-04T04:00:00.000Z");
  assert.deepEqual(ms[0].props, { agency: "Athens-Clarke County Police", incident: "2026-10040122", callType: "Domestic (10-16)", callSource: "911", date: "2026-10-04", personnel: null, objectId: 185780 });
});
