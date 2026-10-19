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
