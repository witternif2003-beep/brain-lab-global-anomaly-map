# Research plan: 50,000 moving public tracks, and what "FBI-specific" can mean in public data

Status: phase 1 built (`/api/moving-tracks`, layer `moving-tracks`). Measurements below were taken from the build VM on 2026-10-17 around 23:45 UTC unless marked otherwise.

## 1. Question

Can the map carry up to 50,000 simultaneously moving tracks drawn only from verified public feeds, with every track attributed, timestamped, privacy-filtered and health-monitored, and without inventing tracks to reach the number?

The 50,000 figure is a ceiling (`MOVING_TRACKS_MAX`). The published count is whatever the sources actually report as moving at that moment.

## 2. Scope boundary: FBI

Out of scope, not built:

- Following FBI (or any law-enforcement) aircraft, vehicles, staff or operations in real time. That tracks live law-enforcement activity and specific people.
- Re-identifying aircraft that use FAA LADD/PIA privacy, or tail numbers linked to agencies.
- Non-public FBI systems (CJIS, NCIC, N-DEx, LEEP) or anything that needs credentials the project does not hold.

In scope as public, non-operational research (not yet built, proposed as phase 4):

| Public source | What it gives | Access |
| --- | --- | --- |
| FBI Crime Data Explorer API (api.usa.gov) | Aggregate UCR/NIBRS statistics by agency/state | Free api.data.gov key; already wired as `fbi-cde` |
| FBI Wanted API (api.fbi.gov/wanted) | Published wanted/missing notices | Open; already wired as `fbi-wanted` |
| SAM.gov opportunities API | FBI (agency 1549) solicitations and awards, e.g. sensor/BLE/ALPR procurement | Free SAM.gov API key |
| USAspending.gov API | Obligated contract and grant dollars by awarding sub-agency | Open, no key |
| FBI Vault (vault.fbi.gov), DOJ OIG, GAO reports | Released FOIA records and oversight findings | Open web documents |
| Federal Register / regulations.gov | FBI System of Records Notices and rules | Open API |

The procurement work answers "what tracking technology does the FBI buy, from whom, for how much" from public records. It does not say where any FBI asset is.

## 3. Candidate moving sources (measured)

| Source | Coverage | Records returned | Moving | Licence / terms | Status |
| --- | --- | --- | --- | --- | --- |
| OpenSky `/states/all` | Global ADS-B/MLAT | 8,222 states | 7,580 above 5 m/s; 7,321 airborne | Free for non-commercial/research use with attribution; anonymous 400 credits/day (global call = 4 credits), registered 4,000/day | Built (phase 1) |
| Digitraffic AIS locations | Baltic / Finnish waters | 890 vessels (night) | 311 at ≥0.5 kt | CC BY 4.0, Fintraffic | Built (phase 1) |
| Digitraffic rail latest | Finland | 32 trains (night) | 29 | CC BY 4.0, Fintraffic | Built (phase 1) |
| adsb.fi `/api/v2/lat/../lon/../dist/250` | Regional ADS-B | 515 records within 250 NM of Atlanta (one sample, HTTP 200 from VM) | n/a | Personal non-commercial use only; 1 request/s | Second aircraft rotation since phase 1b |
| adsb.lol point/area | Regional ADS-B | n/a (HTTP 000 from VM; reachable from Vercel) | n/a | Licence terms not verified here; rate limits are dynamic per adsb.lol's API README | Primary aircraft source since phase 1b: 48 overlapping 250 NM tiles over the contiguous US and Europe; also Georgia aircraft and LADD/PIA lists |
| adsb.fi | Regional ADS-B | 305 (earlier sample) | not measured | Personal/non-commercial terms | Superseded by the adsb.fi row above (built) |
| airplanes.live | Regional ADS-B | HTTP 403 | – | Restricted | Not built |
| GTFS-RT (OVAPI NL, SEQ, MBTA, HSL, Edmonton, BART) | City buses/trains | 135–631 per feed | 0 with a speed field over 0.5 m/s | Per-agency open licences | Not built: speed is usually absent, so "moving" needs two successive fixes |

Day-time expectation (inference, not yet measured): OpenSky global airborne counts usually peak well above the night figure, so the ceiling may be approached by aircraft alone during the European/US day. This must be measured, not assumed (see 5).

## 4. Phase 1 design (built)

- Phase 1b (measured): from Vercel, OpenSky failed with `UND_ERR_CONNECT_TIMEOUT` (TCP connect never completed), so aircraft now come from adsb.lol `/v2/point` tiles. Fetching all 48 tiles at once was measured to return HTTP 429 for 44 of them, so each request now refreshes at most 4 tiles in rotation, 1.5 s apart, backs off 60 s after a 429, and merges tiles fetched in the last 10 min (a full cycle takes about 6 min of traffic; each track keeps its own fix time, so lag is reported honestly). The payload warning reports how many tiles are fresh. adsb.lol then also returned ECONNREFUSED and timeouts from Vercel, so adsb.fi open data (published limit 1 request/s; personal non-commercial use only, per github.com/adsbfi/opendata) was added as a second rotation over the same 48 tiles (8 tiles per request, 1.1 s apart). Both providers are merged and deduplicated by ICAO hex server-side, with a 20 s refresh budget per request. Local measurement (VM, 2026-10-01 ~14:50 UTC, 7 calls 31 s apart): after one full adsb.fi cycle 5,704 aircraft received, 4,615 moving, 249 removed for PIA/LADD; adsb.lol kept answering HTTP 429 or timing out (9 of 48 tiles fresh). Payload was 720 KB for 4,765 tracks (~150 B/track), so the 50,000 ceiling would be ~7.5 MB, above Vercel's 4.5 MB function response limit; phase 2 must ship tracks as a compact array or binary tiles before the ceiling can be reached. OpenSky is kept as a standby source queried only when every adsb.lol tile fails; standby sources are left out of the up/lag gauges so they do not trip `MovingTrackSourceOffline`.
- Server: `app/api/moving-tracks/route.ts` fetches each source with its own TTL (OpenSky 900 s anonymous, 90 s with `OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET`; AIS 60 s; rail 30 s), caches per instance, and returns per-source `ok`, `error`, `received`, `moving`, `removedPrivacy`, `newestAt`, `lagSeconds`. If every source fails it returns HTTP 502 and the legend shows the error; nothing is filled in.
- Motion rule: aircraft not on ground and above 5 m/s; vessels 0.5 kt to <102.3 kt (102.3 is AIS "not available"); trains speed > 0. Fix age limits: aircraft 2 min, AIS 10 min, rail 2 min.
- Ceiling: `capTracks` shares 50,000 across sources in proportion to supply and keeps the newest fixes; the dropped count is published as `truncated`.
- Privacy: no ICAO hex, registration or MMSI leaves the server. adsb.lol aircraft with the PIA or LADD `dbFlags` bit (readsb bits 4 and 8) are removed per record; hex is used only server-side to dedupe overlapping tiles. For the OpenSky standby, aircraft on adsb.lol's live LADD/PIA lists are removed; if those lists fail, every US-registered aircraft (ICAO A00000–ADFFFF) is removed instead. Pleasure craft (AIS ship types 36/37) are unnamed.
- Client: `lib/moving-tracks-layer.ts` renders one GeoJSON source (circle for tracks without course, rotated SDF arrow otherwise), projects aircraft up to 15 min and ships up to 10 min forward along course at reported speed, redraws every 2 s (4 s on touch), and skips aircraft inside the Georgia wall because the Georgia ADS-B layer already draws them.
- Telemetry: `moving_tracks_total{kind}`, `moving_tracks_truncated`, `moving_tracks_source_up{source}`, `moving_tracks_source_lag_seconds{source}`, `moving_tracks_privacy_removed{source}`; alerts `MovingTrackSourceOffline`, `MovingTrackSourceStale`, `MovingTracksAtCeiling`. Browser: `window.__gaMoving.{tracks,flushMs}`.

## 5. Measurement plan

| Metric | Method | Target / decision |
| --- | --- | --- |
| Moving count by hour | Scrape `/api/metrics` every 5 min for 7 days | Report p5/p50/p95 per kind; only claim 50,000 if p95 reaches it |
| Source availability | `moving_tracks_source_up` over 7 days | ≥99% per source, else add a fallback |
| Fix lag | `moving_tracks_source_lag_seconds` | Anonymous OpenSky is ~15 min by design; get registered credentials if that is too coarse |
| Projection error | Compare projected position to the next real fix for the same (server-side, unpublished) track | Median and p95 metres by kind; shorten the projection cap if p95 > 5 km |
| Client cost | `window.__gaMoving.flushMs`, FPS and heap from RUM on touch vs desktop | flush p95 < 50 ms desktop, < 120 ms touch at 50,000; otherwise raise the touch tick or switch to deck.gl binary attributes |
| Privacy | Unit tests + spot check that no payload field matches `/^[0-9a-f]{6}$/` or a 9-digit MMSI | Zero leaks |

Threats to validity: OpenSky coverage is receiver-dependent (dense over Europe/US, sparse over oceans/Africa); MLAT and ADS-B mix; AIS here is regional only; rail is one country; the LADD/PIA list is only as complete as adsb.lol's current view, so a listed aircraft seen only by OpenSky can be missed (mitigation under evaluation: drop US-registered aircraft not seen by adsb.lol).

## 6. Later phases

- Phase 2: registered OpenSky credentials (needs the project owner's account) to move aircraft refresh from 15 min to 90 s.
- Phase 3: GTFS-RT feeds with motion inferred from two consecutive fixes (needs per-vehicle state on the server, never published), starting with the Georgia agencies already in `ga-live-markers`.
- Phase 4: the public FBI procurement/oversight panel in section 2 (SAM.gov key required).
- Phase 5: global AIS beyond the Baltic only if an openly licensed feed is found; AISHub and similar require data-sharing agreements.

## 7. Georgia: 100,000-track ceiling and measured supply

Request: up to 100,000 more live moving tracks inside the Georgia state boundary. As with the global layer, 100,000 is a ceiling, not a target to fill: no synthetic or projected-only tracks are counted.

Measured supply inside Georgia (2026-10-18 ~00:40 UTC, Saturday evening local time; one sample each):

| Signal | Source | Count | Moving? | Notes |
| --- | --- | --- | --- | --- |
| Aircraft | adsb.fi `/api/v2/lat/32.7/lon/-83.25/dist/250` | 462 in the 250 NM circle, 222 in the Georgia bbox | 196 airborne above 10 kt | adsb.lol alone timed out from Vercel, so the Georgia layer showed 0 aircraft; it now queries adsb.lol and adsb.fi in parallel and merges per ICAO hex (`mergeAdsbPoints`), OpenSky stays the fallback |
| Buses / shuttles | GTFS-RT: MARTA 147, CobbLinc 18, Ride Gwinnett 14, UGA 12, Connect Douglas 1, Athens Transit 0, GT Stinger 0 | 192 | Yes, but most feeds give no speed, so "moving" needs two fixes (phase 3) | Added Kennesaw State, SCAD Atlanta, SCAD Savannah and Valdosta State Passio GO feeds (found by probing all 283 Passio systems; 0–3 vehicles each at the sample time). Chatham Area Transit, Augusta Transit, Macon-Bibb MTA, Columbus METRA, Albany Transit and Xpress have no GTFS-RT feed listed in the Mobility Database catalogue and none was found at the usual vendor URLs. Correction 2026-10-21: Columbus METRA and Xpress do publish GTFS-RT (listed in the Transitland Atlas) and are now on the map; see `ga-live-expansion-research-plan.md` |
| Shared scooters / bikes | Lime and Bird GBFS, Atlanta | 5,155 | No: GBFS publishes parked, available vehicles only | Kept on the map as parked vehicles; not counted as moving |
| Ships | none | 0 | – | No openly licensed live AIS feed for the Savannah/Brunswick coast was found; NOAA MarineCadastre AIS is historical; AISHub and similar require data-sharing agreements |
| Rail | none | 0 | – | No public live freight or Amtrak position feed with an open licence |
| Road traffic (BLE / probe speeds) | none public | 0 | – | GDOT and ARC speed/travel-time data need a data use agreement (DataSupport@dot.ga.gov) and are offered to agencies and contractors |

Expected Georgia total with every source above: roughly 200–600 moving tracks (aircraft peak in the daytime; buses peak at weekday rush hour). The 100,000 ceiling is about 170× the measured peak supply. The 4.5 MB Vercel response limit (~30,000 tracks at ~150 B each in the current JSON) would also need the compact or binary transport from phase 2.

Legitimate ways to raise the count (each needs a step outside this repo):

1. GDOT / ARC probe-speed data under a data use agreement (the project owner would have to apply).
2. Registered OpenSky credentials for 90 s aircraft refresh.
3. Asking Chatham Area Transit, Augusta Transit, Macon-Bibb MTA and Columbus METRA to publish GTFS-RT vehicle positions (they publish static GTFS).
4. Two-fix motion inference for the bus feeds (phase 3), which changes "moving" from "has a position" to "has moved since the last fix".

Not workarounds this project will use: tracking FBI or other law-enforcement aircraft and vehicles, removing the LADD/PIA privacy filter, de-anonymising aggregate feeds, scraping sources whose terms forbid it, or padding the count with synthetic or projected-only tracks.
