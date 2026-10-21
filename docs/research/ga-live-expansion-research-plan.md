# Georgia live map: raising the real live-point count (research plan, 2026-10-21)

Request: "Provision postdoctorate level web research plan with verified work around: free 511GA developer key would add the official camera feed and traffic incidents. More bus agencies, scooter companies and ship positions are other options."

Goal: raise the number of real, public, refreshing points inside the Georgia wall toward the 30,000 display ceiling (`lib/ga-live-markers/ceiling.ts`). No point is invented to reach it and none is dropped to fit it. Baseline on the live page at 2026-10-21 ~13:55 UTC: 20,536 points from 13 feeds (68.5%).

Grades: A = the publisher's own documentation or a live response from the publisher's endpoint; B = government or catalogue summary; C = vendor or third-party page; D = forum/social. "Probed" = fetched by us on the date shown, HTTP status and record count recorded.

## 1. Findings

| # | Option | Status | Evidence (grade, accessed 2026-10-21) |
|---|---|---|---|
| 1 | 511GA developer API (cameras, events, message signs, alerts, rest areas, ports of entry, express lanes, EV chargers) | Needs a free key: a 511GA account, then a key request on the developer page. Throttled to 10 calls per 60 s. | https://511ga.org/developers/doc (A); https://511ga.org/developers/help (A, same throttle); event fields at https://511ga.org/help/endpoint/event (A) |
| 1a | Keyless stand-in for 511GA cameras | Already in use: "Georgia 511 Cameras (Detailed)" public ArcGIS layer, 3,938 cameras. | `app/api/ga-live-markers/route.ts` (GA511_MIRROR); production count in `ga-fbi-categories-research-plan.md` |
| 1b | Keyless stand-in for 511GA incidents | Already in use by the traffic layer (`app/api/ga-traffic/route.ts` line 8): `GDOT_511_Events_Public_View` on the GEMA ArcGIS org; probed 193 events at 14:00 and 14:05 UTC, layer last edited 13:58 UTC. Not counted in the ceiling yet because it is drawn by a separate layer. GDOT's own incident board https://incidentreport.dot.ga.gov/ shows the same kind of records (A). | https://services1.arcgis.com/2iUE8l8JKrP2tygQ/ArcGIS/rest/services/GDOT_511_Events_Public_View/FeatureServer/0 (A, probed) |
| 2 | Xpress commuter coaches (ATL / GRTA) GTFS-realtime | **Added.** No key. Probed 8 vehicles, all inside Georgia, header 14:05:03 UTC. | https://myxpress2.xpressga.com/gtfsrt/vehicles (A, probed); listed in Transitland Atlas `xpressga.com.dmfr.json` (B) |
| 3 | Columbus METRA GTFS-realtime | **Added.** No key. Probed 13 vehicles, all inside Georgia, header 14:05:13 UTC. Publisher of the static feed: GMV Syncromatics. | https://metracolumbus.com/gtfs-rt/vehiclepositions (A, probed); Transitland Atlas `metracolumbus.com.dmfr.json` (B) |
| 3x | Passio "athenstransit" | **Rejected.** It is Athens, Ohio: first vehicle at 39.33 N, -82.10. Athens-Clarke Transit is already on the map from `bustracker.accgov.com`. | https://passio3.com/athenstransit/passioTransit/gtfs/realtime/vehiclePositions (A, probed) |
| 4 | Chatham Area Transit (Savannah), Augusta Transit, Macon-Bibb MTA | Not found. No GTFS-realtime feed in the Mobility Database catalogue (3,613 feeds) or the Transitland Atlas. CAT runs a "CAT Tracker" app; Transitland marks Augusta's static GTFS as token-protected. Next step: email the agencies (info@catchacat.org, 311@augustaga.gov, info@mbcta.net) and ask for a public GTFS-RT URL. | https://share.mobilitydata.org/catalogs-csv (B); https://github.com/transitland/transitland-atlas (B); https://catchacat.org/rider-tools/cat-tracker/ (A); https://www.transit.land/feeds/f-augusta~ga~us (B) |
| 5 | More scooter / bike companies | None available. Atlanta's current permitted dockless operators are Bird and Lime, both already on the map. The GBFS systems list has no other Georgia system (its "Zeus Augusta" is Augusta, Italy; "Getaround Macon" is Mâcon, France). Relay Bike Share's old SoBi GBFS still answers but lists 0 stations; Relay moved to the HOPR app in 2020 and no public HOPR GBFS URL was found. Macon-Bibb, Marietta, Smyrna and Acworth ban shared dockless devices (C, needs checking against each city code). | https://atldot.atlantaga.gov/wp-content/uploads/2025/11/Shareable-Dockless-Devices-FAQ_2024.pdf (A); https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv (B); https://relaybikeshare.socialbicycles.com/opendata/station_status.json (A, probed: 0 stations); https://www.atlantaga.gov/government/departments/transportation/strategy-and-planning/office-of-mobility-planning/bicycles/bike-share (A); https://cityrulelookup.com/states/georgia/mobility (C) |
| 6 | Ship positions (AIS) off the Georgia coast and in the Savannah River | Needs a free key from aisstream.io (sign in with GitHub). WebSocket only, bounding box required, browser connections not allowed, up to 3 connections per IP and per account. Workaround for Vercel functions, which can't hold a socket open: the API route opens the socket for a few seconds, collects `PositionReport` messages inside the Georgia coastal box, closes, and caches the result. | https://aisstream.io/documentation (C, vendor); https://aisstream.io/ (C) |
| 6a | Other AIS sources | AISHub gives an API key only to members who share their own AIS receiver (min. 10 vessels, 90% uptime), so it needs hardware. NOAA MarineCadastre publishes historical AIS, not live. | https://www.aishub.net/join-us (C); https://hub.marinecadastre.gov/pages/vesseltraffic (A) |

## 2. Expected gain (one sample each, so a rough range)

- Added today: Xpress 8 + Columbus METRA 13 = about 21 buses at mid-morning on a weekday; fewer at night and weekends.
- Counting 511GA events in the ceiling: about 190 (193 at the sample time).
- Official 511GA cameras with a key: roughly the same ~3,900 cameras as the public copy, so little or no gain in count; the gain is an official source and up-to-date status.
- AIS (key provisioned 2026-10-21): three bounded probes of the Georgia coastal box returned 10 distinct vessels in 30 s, 4 in 20 s and, through the local API route, 2 vessels in one 12 s read (n < 30: statistically indistinguishable from noise). Class A ships report every 2 s to 3 min and Class B boats every 30 s to 3 min, so short reads under-count; the route keeps every position it heard in the last 15 min on a warm instance to offset this.
- Realistic total after all of the above: about 20,700–21,000, still short of 30,000. The scooter, police-call and camera layers already supply most points.

## 3. Implementation plan

1. Done: Xpress and Columbus METRA in the `transit` layer (`app/api/ga-live-markers/route.ts`), test `tests/ga-live-markers/transit-feeds.test.ts`.
2. With `GA511_API_KEY` set in Vercel: the existing camera code switches to the official feed automatically. Add an `events` layer that calls `https://511ga.org/api/v2/get/event` once every 5 minutes (well under 10 calls/60 s), falling back to the public ArcGIS copy, and count it in the ceiling.
3. Done: `vessels` layer (`app/api/ga-live-markers/route.ts`, `parseAisStream` in `lib/ga-live-markers/parse.ts`). A 12 s WebSocket read per refresh (60 s cache), box 30.3–32.3 N, -82.0 to -80.8 W (clipped to `GA_BBOX`; the client then keeps only points inside the GA wall ring, which covers the Savannah River and near-shore water but not open sea). Latest position per vessel from the last 15 min; Class A ships show their broadcast name, Class B craft (mostly private boats) are shown without names; MMSI is used only to merge reports and is never published. Counted toward the 30,000 ceiling. Credit aisstream.io.
4. Ask CAT, Augusta Transit and Macon-Bibb MTA for public GTFS-RT URLs; add each one only after probing it for a 200 response and positions inside Georgia.
5. Re-measure: sample each layer at three times of day and record the counts here.

## 4. Limits and what would change this plan

- Every count above is a single sample (one or two probes), so it shows the order of size, not an average.
- The Xpress and METRA feeds have no published licence in the Transitland Atlas; they are public, unauthenticated agency URLs, used with credit like the other bus feeds. If either agency publishes terms that forbid this, remove it.
- aisstream.io is a vendor page (grade C); its limits should be re-checked after sign-up.
- A city ordinance list from a third-party site (grade C) is not proof of a ban; check the city code before relying on it.
