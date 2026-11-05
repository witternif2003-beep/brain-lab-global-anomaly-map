import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app/api/ga-live-markers/route.ts", import.meta.url), "utf8");

test("transit layer includes the Xpress and Columbus METRA GTFS-realtime feeds", () => {
  assert.match(src, /gtfsRt\("Xpress", "https:\/\/myxpress2\.xpressga\.com\/gtfsrt\/vehicles"\)/);
  assert.match(src, /gtfsRt\("Columbus METRA", "https:\/\/metracolumbus\.com\/gtfs-rt\/vehiclepositions"\)/);
});

test("transit layer does not use Passio's athenstransit system, which is Athens, Ohio", () => {
  assert.doesNotMatch(src, /passio3\.com\/athenstransit\//);
});
