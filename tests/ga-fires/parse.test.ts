import { test } from "node:test";
import assert from "node:assert/strict";
import { confidenceOf, firesToGeoJSON, parseFirmsCsv, summarizeFires } from "../../lib/ga-fires/parse";

const VIIRS = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
33.1,-83.2,330.1,0.4,0.4,2026-10-03,705,N20,h,2.0NRT,290.9,12.5,N
48.1,-64.9,300.8,0.5,0.6,2026-10-03,0523,N20,nominal,2.0NRT,279.5,1.6,N
31.5,-82.0,310.0,0.4,0.4,2026-10-03,1812,N,low,2.0NRT,290.0,,D`;

const MODIS = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
32.0,-84.0,320.0,1.0,1.0,2026-10-03,1630,Aqua,85,6.1NRT,295.0,30.2,D
32.5,-84.5,315.0,1.0,1.0,2026-10-03,1630,T,25,6.1NRT,295.0,4.0,D`;

test("keeps Georgia-box VIIRS detections and parses UTC time, satellite and confidence", () => {
  const fires = parseFirmsCsv(VIIRS, "VIIRS");
  assert.equal(fires.length, 2);
  assert.deepEqual(fires[0], { lat: 33.1, lon: -83.2, detectedAt: "2026-10-03T07:05:00.000Z", satellite: "NOAA-20", instrument: "VIIRS", confidence: "high", frpMw: 12.5, daynight: "N" });
  assert.equal(fires[1].satellite, "Suomi NPP");
  assert.equal(fires[1].confidence, "low");
  assert.equal(fires[1].frpMw, null);
});

test("buckets MODIS 0-100 confidence", () => {
  const fires = parseFirmsCsv(MODIS, "MODIS");
  assert.deepEqual(fires.map((f) => [f.satellite, f.confidence]), [["Aqua", "high"], ["Terra", "low"]]);
  assert.equal(confidenceOf("50", "MODIS"), "nominal");
  assert.equal(confidenceOf("n", "VIIRS"), "nominal");
});

test("summarizes and emits GeoJSON", () => {
  const fires = [...parseFirmsCsv(VIIRS, "VIIRS"), ...parseFirmsCsv(MODIS, "MODIS")];
  const s = summarizeFires(fires);
  assert.equal(s.total, 4);
  assert.deepEqual(s.byConfidence, { low: 2, nominal: 0, high: 2 });
  assert.equal(s.latestDetection, "2026-10-03T18:12:00.000Z");
  assert.equal(s.maxFrpMw, 30.2);
  assert.deepEqual(firesToGeoJSON(fires).features[0].geometry.coordinates, [-83.2, 33.1]);
});

test("rejects an unexpected header", () => {
  assert.throws(() => parseFirmsCsv("a,b\n1,2", "VIIRS"), /unexpected FIRMS header/);
});
