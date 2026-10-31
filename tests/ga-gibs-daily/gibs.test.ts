import { test } from "node:test";
import assert from "node:assert/strict";
import { HLS, VIIRS, daysBack, gibsDomainsUrl, gibsTileTemplate, isUnimaged, latestDomainDate, lngLatToTile } from "../../lib/ga-gibs-daily/gibs";
import { trimStacItems } from "../../lib/ga-gibs-daily/sentinel2";

test("gibsTileTemplate builds the GIBS REST WMTS path with date and {z}/{y}/{x}", () => {
  assert.equal(
    gibsTileTemplate(VIIRS, "2026-10-30"),
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-30/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
  );
  assert.ok(gibsTileTemplate(HLS[0], "2026-10-29").endsWith("/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png"));
  assert.equal(gibsDomainsUrl(HLS[1], "2026-10-11"), "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/HLS_L30_Nadir_BRDF_Adjusted_Reflectance/default/GoogleMapsCompatible_Level12/all/2026-10-11.xml");
});

test("latestDomainDate reads the end of the last range in a GIBS Domains reply", () => {
  const xml = "<Domains><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-20/2026-10-29/P1D</Domain><Size>1</Size></DimensionDomain></Domains>";
  assert.equal(latestDomainDate(xml), "2026-10-29");
  assert.equal(latestDomainDate("<Domain>2026-10-01/2026-10-03/P1D,2026-10-05/2026-10-31/P1D</Domain>"), "2026-10-31");
  assert.equal(latestDomainDate("<Domain>2026-10-31</Domain>"), "2026-10-31");
  assert.equal(latestDomainDate("<x/>"), null);
});

test("daysBack walks back whole UTC days across a month edge", () => {
  assert.deepEqual(daysBack("2026-11-02", 4), ["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30"]);
});

test("lngLatToTile puts Atlanta in the expected z6 tile", () => {
  assert.deepEqual(lngLatToTile(-84.39, 33.75, 6), [16, 25]);
});

test("isUnimaged flags all-black tiles and passes real imagery", () => {
  const black = new Uint8ClampedArray(4 * 100).fill(0);
  for (let i = 3; i < black.length; i += 4) black[i] = 255;
  assert.equal(isUnimaged(black), true);
  const land = new Uint8ClampedArray(4 * 100);
  for (let i = 0; i < land.length; i += 4) land.set([60, 90, 50, 255], i);
  assert.equal(isUnimaged(land), false);
});

test("trimStacItems keeps footprint, time, cloud and links, newest first, and drops broken items", () => {
  const fc = trimStacItems({
    numberMatched: 3,
    features: [
      { id: "A", geometry: { type: "Point", coordinates: [0, 0] }, properties: { datetime: "2026-10-28T16:35:00Z", "eo:cloud_cover": 12.345, platform: "sentinel-2c", "grid:code": "MGRS-16SGC" }, assets: { thumbnail: { href: "https://x/preview.jpg" }, visual: { href: "https://x/TCI.tif" } } },
      { id: "B", geometry: { type: "Point", coordinates: [0, 0] }, properties: { datetime: "2026-10-30T16:35:00Z" }, assets: {} },
      { id: "C", properties: { datetime: "2026-10-30T16:35:00Z" } },
    ],
  });
  assert.equal(fc.matched, 3);
  assert.deepEqual(fc.features.map((f) => f.properties.id), ["B", "A"]);
  const a = fc.features[1].properties;
  assert.equal(a.cloud, 12.3);
  assert.equal(a.tile, "MGRS-16SGC");
  assert.equal(a.visual, "https://x/TCI.tif");
  assert.equal(fc.features[0].properties.cloud, null);
  assert.ok(a.stac.endsWith("/sentinel-2-l2a/items/A"));
});
