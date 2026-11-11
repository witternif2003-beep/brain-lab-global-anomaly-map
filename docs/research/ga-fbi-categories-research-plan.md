# Georgia FBI-sourced categories and evidence integrity: research plan

Request (2026-10-19): "30,000 new live tracking telemetry data specific to Georgia … 30,000 new traceable and dynamic categories and anomalies fbi specific … label and indicator color … fbi tracking admissibility", plus "all new admissible evidence … must strobe police colors".

## What was built

| Item | Source | Measured (2026-10-19) |
|---|---|---|
| Georgia agency layer (`lib/ga-fbi-agencies-layer.ts`, `/api/fbi/agencies`) | FBI CDE agency directory, `https://cde.ucr.cjis.gov/LATEST/agency/byStateAbbr/GA` (public, no key) | 664 agencies (unique ORIs), 629 with coordinates, 516 NIBRS |
| Agency categories (type × NIBRS) | same | 10 non-empty categories across 6 agency types: City 345, County 169, University or College 54, State Police 49, Other 39, Other State Agency 8 |
| Per-agency offence categories (`/api/fbi/agency?ori=`) | `https://cde.ucr.cjis.gov/LATEST/summarized/agency/{ORI}/{offense}` | 10 FBI summarized offence categories per agency → 664 × 10 = 6,640 agency × offence series, fetched on tap |
| NIBRS offence types per NIBRS agency (`lib/fbi-agencies/nibrs.ts`, `/api/fbi/nibrs?ori=`) | `https://cde.ucr.cjis.gov/LATEST/nibrs/agency/{ORI}/{code}?from=01-YYYY&to=12-YYYY` | 53 Group A codes × 516 NIBRS agencies = 27,348 agency × offence-type series (previous calendar year), loaded on tap; with the 6,640 summarized series, 33,988 in total |
| Integrity badge on every Georgia feed (`lib/ga-live-status.ts`) | each feed's own source URL and timestamp | VERIFIED / STALE / NO TIMESTAMP / ERROR / INTERNAL, plus a per-browser custody log (state, count, SHA-256 changes) |
| SHA-256 of raw upstream bodies | computed server-side | agency directory and each of the 10 offence responses |
| Police red/blue strobe, 10 min | `lib/fbi-agencies/parse.ts` `policeStrobeColor` | agencies that appear in the directory after first load; agencies and popup categories with offences in the newest FBI-published month (`max_data_date`) |

Colours: agency types and offence categories use neon pink, Tiffany blue, cyan, violet, lime and red hues to stand out on the dark basemap; no amber or brown (user theme). Strobe pair: #ff1744 / #2979ff.

## Why the count is not 30,000, and why nothing is labelled "admissible"

- No public source publishes 30,000 live, FBI-specific, trackable categories inside Georgia. Inventing categories to reach the number would break the data rule (real, sourced data only).
- FBI CDE data are monthly reported-offence aggregates per agency, revised as agencies submit late. They are not live tracking and not about individuals.
- Admissibility is decided by a court under FRE 702/901, not by a data label. Records are labelled with source, source grade, retrieval time and hash instead.
- FBI operational tracking (aircraft, vehicles, personnel) stays out of scope, as before.

## NIBRS detail (built 2026-10-19)

- Each NIBRS response gives victim, offender and weapon/location breakdowns for one agency, code and period; the layer shows victims and offenders (sums of the by-sex counts), the top location and the top weapon/force. These are not incident counts.
- Unknown codes and codes with no published data both return all-null breakdowns (tested with code `ZZZ`), so null is shown as "not published", never as 0. For Atlanta PD, 2025: 48 of 53 codes had data; 26H, 39A, 39D, 40B, 40C were null.
- Colours: crimes against persons in pink-magenta-red hues, property in Tiffany/cyan hues, society in violet hues; one distinct hue per code, none in the amber/brown range.
- Each popup load fetches the 53 codes 8 at a time with a SHA-256 per response and caches the result for 24 h per agency.

## Further paths (not built)

1. (Built, see above.) NIBRS offence detail per agency: `https://cde.ucr.cjis.gov/LATEST/nibrs/agency/{ORI}/{code}` returned victim/offender/weapon breakdowns for code 13A (verified 2026-10-19). NIBRS has 52 Group A offences in 71 three-digit codes and 10 Group B arrest-only offences (FBI NIBRS User Manual 2021.1; BJS). 516 NIBRS agencies × 52 Group A offences ≈ 26,800 agency × offence series; with the 6,640 summarized series that is ≈ 33,400. These are real series but monthly, not live, and many will be all-zero for small agencies.
   - Work needed: confirm the full list of offence codes the CDE accepts; measure the CDE's rate limits before bulk fetching; snapshot into `data/` with SHA-256 per file (as `scripts/build-ga-ucr-snapshot.ts` does) instead of fetching 26,800 URLs at runtime.
2. A free api.data.gov key (`FBI_API_KEY`) gives the documented `api.usa.gov/crime/fbi/cde` gateway with a published rate limit, as a fallback if the public backend changes.
3. Hate-crime, LEOKA and use-of-force CDE datasets add further real agency-level categories; check each one's terms and coverage first.

## Validation

- Unit tests: `tests/fbi-agencies/parse.test.ts` (directory de-duplication and Georgia bounds, trailing-12-month series and newest-month flag, integrity states, strobe colours).
- Live: `/api/fbi/agencies` totals must match the counts above within FBI directory changes; `/api/fbi/agency?ori=GA0880100` must return 10 series with a SHA-256 for each.

## Crime-triangle police strobe (2026-10-21)

Request: "all new crime triangles must flash in the police pattern dark red and blue".

- Applies to the two layers drawn as warning triangles that report police matters: Atlanta PD / Doraville PD police-reported offences (`policereports`) and Augusta E911 calls (`augusta911`) (`lib/ga-live-markers/strobe.ts`, `CRIME_TRIANGLE_LAYERS`). NOAA pilot reports also use a triangle but are not crime and keep their normal pulse.
- "New" is the existing rule: a record first seen within the last 10 minutes, or observed within 10 minutes on first load (`STROBE_MS`, `strobeSince`).
- Pattern: the existing police quad-flash timing (`policeLightBar`, 60 ms on / 60 ms off, four dark-red #8b0000 flashes then four blue #1d4ed8 flashes, 960 ms cycle). The triangle glyph itself and its halo take the flash colour; between flashes the triangle keeps its own colour, so it never disappears.
- Redraw tick is 50 ms, so on a busy device some 60 ms flashes may merge; nothing about the underlying record changes.
- Not added: 30,000 new "FBI tracking" categories. The 33,988 real agency × offence series listed above remain the full set of FBI-published Georgia categories found; none are real-time tracking.
- Tests: `tests/ga-live-markers/strobe.test.ts` (layer set, colours, 16-step phase sequence, glyph fill swap only while pulsing).

## Live points on the map, 30,000 ceiling (2026-10-21)

Request: "I NEED 30,000 max ceiling new live tracking on map".

- Built: a "Live points on map (ceiling 30,000)" row in the Georgia live legend (`lib/ga-live-markers/ceiling.ts`, `lib/ga-live-markers-layer.ts`). It sums the points currently on the map from the 13 public layers that refresh while the map is open, shows the share of 30,000, and lists each layer with its own colour and count. Layers still loading or failing are listed as not counted, never as 0. Fixed OSM and Atlas of Surveillance layers are excluded.
- The ceiling is a display budget, not a target: no points are invented to reach it, and none are dropped to fit it.
- Measured on production `/api/ga-live-markers` (2026-10-21 UTC, one sample each): parked scooters/bikes 5,465; Athens-Clarke PD calls 5,042; GDOT cameras 3,938 (public ArcGIS copy; 511GA API key not set); police-reported offences 2,832; Augusta E911 1,661; weather/hydro stations 628; aircraft 444; USGS gauges 355; transit buses 344; pilot reports 10; webcams 4; earthquakes 3; TFRs 0. Total 20,726 (69.1% of 30,000). One sample, so counts vary with time of day.
- "Live" differs by layer: aircraft refresh every 10 s, buses 20 s, scooters 60 s, gauges/stations 5 min, police reports and Athens calls 30 min (published with a delay), cameras 60 min. Police and 911 layers are incident records, not tracking of people.
- Ways to raise the real count (not built; each needs its terms and rate limits checked first): a free 511GA API key (`GA511_API_KEY`) for the official camera feed and 511GA incidents; more GTFS-realtime agencies listed for Georgia in the Mobility Database; more GBFS systems in Georgia cities; AIS vessel positions off the Georgia coast (keyed APIs).
- Tests: `tests/ga-live-markers/ceiling.test.ts`.
