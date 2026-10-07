import { test } from "node:test";
import assert from "node:assert/strict";
import { ga511CamerasFromViewRows, parse511Cameras } from "../../lib/ga-live-markers/parse";

const cam = (over: Record<string, unknown> = {}) => ({
  Id: 186,
  Source: "SKYLINE",
  SourceId: "591",
  Roadway: "SR154",
  Direction: "Westbound",
  Latitude: 33.698067,
  Longitude: -84.44784,
  Location: "GDOT-0054: SR154 W at StantonRd MM 25.7 (Fulton)",
  SortOrder: 0,
  Views: [{ Id: 186, Url: "https://511ga.org/map/Cctv/186", Status: "Enabled", Description: "GDOT-0054", SortId: 0 }],
  Name: "GDOT-CCTV-0054",
  ...over,
});

test("parse511Cameras maps the documented 511GA camera schema to markers with the snapshot URL", () => {
  const [m] = parse511Cameras([cam()]);
  assert.equal(m.label, "GDOT-0054: SR154 W at StantonRd MM 25.7 (Fulton)");
  assert.equal(m.observedAt, null);
  assert.deepEqual(m.props, {
    camera: "GDOT-CCTV-0054",
    cameraId: 186,
    roadway: "SR154",
    direction: "Westbound",
    source: "SKYLINE",
    imageUrl: "https://511ga.org/map/Cctv/186",
    views: 1,
  });
});

test("parse511Cameras only uses enabled 511ga.org snapshot views", () => {
  const [disabled, foreign, second] = parse511Cameras([
    cam({ Views: [{ Id: 1, Url: "https://511ga.org/map/Cctv/1", Status: "Disabled" }] }),
    cam({ Views: [{ Id: 2, Url: "https://example.com/map/Cctv/2", Status: "Enabled" }] }),
    cam({ Views: [{ Id: 3, Url: "https://511ga.org/map/Cctv/3", Status: "Disabled" }, { Id: 4, Url: "https://511ga.org/map/Cctv/4", Status: "Enabled" }] }),
  ]);
  assert.equal(disabled.props.imageUrl, null);
  assert.equal(foreign.props.imageUrl, null);
  assert.equal(second.props.imageUrl, "https://511ga.org/map/Cctv/4");
});

test("parse511Cameras drops cameras without coordinates or outside Georgia and tolerates non-array input", () => {
  assert.equal(parse511Cameras([cam({ Latitude: null }), cam({ Latitude: 40.7, Longitude: -74 })]).length, 0);
  assert.deepEqual(parse511Cameras(null), []);
});

test("ga511CamerasFromViewRows regroups the flattened ArcGIS view rows by camera", () => {
  const row = (Id: number, View_Id: number, View_Status = "Enabled") => ({
    attributes: { Id, Source: "SKYLINE", Roadway: "SR 211", Direction: "Eastbound", Latitude: 33.995518, Longitude: -83.733475, Location: "BARR-0003: SR 211 at Horton St (Barrow)", Name: "BARR-CCTV-0003", View_Id, View_Url: `https://511ga.org/map/Cctv/${View_Id}`, View_Status, View_Description: "BARR-0003" },
  });
  const cams = ga511CamerasFromViewRows({ features: [row(11139, 18549, "Disabled"), row(11139, 18560), row(11140, 18550), { attributes: { Id: null } }] });
  assert.equal(cams.length, 2);
  assert.equal(cams[0].Views?.length, 2);
  const [m] = parse511Cameras(cams);
  assert.equal(m.props.imageUrl, "https://511ga.org/map/Cctv/18560");
  assert.equal(m.props.views, 2);
});
