import { test } from "node:test";
import assert from "node:assert/strict";
import { osmInfraKind, parseOverpassInfra, parseTfrXml } from "../../lib/ga-live-markers/parse";

test("osmInfraKind classifies tagged public-safety infrastructure and untagged signal nodes", () => {
  assert.equal(osmInfraKind(undefined), "signals");
  assert.equal(osmInfraKind({ amenity: "police" }), "police");
  assert.equal(osmInfraKind({ amenity: "fire_station" }), "firestations");
  assert.equal(osmInfraKind({ emergency: "siren" }), "sirens");
  assert.equal(osmInfraKind({ man_made: "mast", "tower:type": "communication" }), "towers");
  assert.equal(osmInfraKind({ highway: "speed_camera" }), "speedcams");
  assert.equal(osmInfraKind({ man_made: "surveillance", "surveillance:type": "ALPR" }), "alpr");
  assert.equal(osmInfraKind({ man_made: "surveillance", "surveillance:type": "camera" }), null);
  assert.equal(osmInfraKind({ man_made: "tower", "tower:type": "observation" }), null);
});

test("parseOverpassInfra splits Overpass elements by kind, uses way centres and keeps only Georgia-area points", () => {
  const out = parseOverpassInfra({
    osm3s: { timestamp_osm_base: "2026-10-07T11:37:37Z" },
    elements: [
      { type: "node", id: 1, lat: 33.749, lon: -84.388 },
      { type: "way", id: 2, center: { lat: 33.75, lon: -84.39 }, tags: { amenity: "police", name: "Zone 5 Precinct", operator: "Atlanta Police Department" } },
      { type: "node", id: 3, lat: 32.08, lon: -81.09, tags: { man_made: "mast", "tower:type": "communication", "communication:mobile_phone": "yes", height: "90" } },
      { type: "node", id: 4, lat: 40.7, lon: -74.0, tags: { amenity: "fire_station" } },
      { type: "node", id: 5, lat: 31.5, lon: -84.2, tags: { emergency: "siren", "siren:type": "electronic" } },
    ],
  });
  assert.equal(out.signals.length, 1);
  assert.equal(out.signals[0].label, "Traffic signal");
  assert.equal(out.signals[0].observedAt, "2026-10-07T11:37:37Z");
  assert.equal(out.police[0].label, "Zone 5 Precinct");
  assert.equal(out.police[0].props.osm, "way/2");
  assert.equal(out.police[0].props.named, true);
  assert.equal(out.towers[0].props.uses, "mobile phone");
  assert.equal(out.towers[0].props.heightM, 90);
  assert.equal(out.firestations.length, 0);
  assert.equal(out.sirens[0].props.sirenType, "electronic");
});

test("parseTfrXml centres the restricted area and keeps its window and ceiling", () => {
  const xml = `<XNOTAM-Update><Group><Add><Not><NotUid><dateIssued>2026-10-05T10:37:16</dateIssued>
    <txtLocalName>26-#123-ESA-Morehouse College Homecoming (GA)</txtLocalName></NotUid>
    <dateEffective>2026-10-10T12:00:00</dateEffective><dateExpire>2026-10-11T02:00:00</dateExpire>
    <TfrNot><TFRAreaGroup><aseTFRArea><txtName>Morehouse College</txtName><codeDistVerUpper>HEI</codeDistVerUpper><valDistVerUpper>400</valDistVerUpper></aseTFRArea>
    <Avx><geoLat>33.76N</geoLat><geoLong>084.42W</geoLong></Avx><Avx><geoLat>33.74N</geoLat>
    <geoLong>084.40W</geoLong></Avx></TFRAreaGroup></TfrNot></Not></Add></Group></XNOTAM-Update>`;
  const m = parseTfrXml(xml, { notam_id: "6/7150", type: "UAS PUBLIC GATHERING", state: "GA", description: "Atlanta, GA", facility: "ZTL" });
  assert.ok(m);
  assert.equal(m.lat, 33.75);
  assert.equal(m.lon, -84.41);
  assert.equal(m.label, "26-#123-ESA-Morehouse College Homecoming (GA)");
  assert.equal(m.observedAt, "2026-10-05T10:37:16Z");
  assert.equal(m.props.effective, "2026-10-10T12:00:00Z");
  assert.equal(m.props.expires, "2026-10-11T02:00:00Z");
  assert.equal(m.props.upperFt, 400);
  assert.equal(m.props.tfrType, "UAS PUBLIC GATHERING");
  assert.equal(parseTfrXml("<x/>", {}), null);
});
