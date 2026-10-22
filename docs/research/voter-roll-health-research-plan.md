# Voter-roll health dashboard — sources, method, limits, next steps

Aggregate only. No voter file, name, initial, voter ID, address or individual citizenship status is read or shown.

## Sources (retrieved 2026-10-19, SHA-256 recorded in lib/elections/voter-roll-health-2024.ts)
| Source | Use | Grade |
|---|---|---|
| EAC 2024 EAVS public release V1 CSV + codebook (eac.gov/research-and-data/datasets-codebooks-and-surveys) | A1a total registered, A1b active, A1c inactive, A10a confirmation notices, A12a removals (close of registration Nov 2022 → Nov 2024) per reporting jurisdiction | A (official primary data) |
| Census 2020–2024 ACS 5-year CVAP special tabulation (census.gov/.../voting-rights/cvap.html) | `cvap_est`, `cvap_moe` per county / county subdivision | A |
| Census cartographic boundary file cb_2024_us_county_20m | County polygons for the map | A |

No 2026 EAVS exists: the newest release on the EAC datasets page is the 2024 survey (files dated 2025-06).

## Method (scripts/build-voter-roll-health.py)
- EAVS codes -88 (does not apply) and other negatives (-99, -77) are treated as unavailable, never as 0.
- Reporting units are mapped to counties by FIPS; Connecticut towns and Wisconsin municipalities are mapped through the CVAP county-subdivision (MCD) file.
- A unit that covers more than one county, or cannot be placed in one county, makes the affected county "Insufficient data" (47 counties split, 3 Wisconsin units unmatched).
- A county or state with any missing field for a metric gets no value for that metric (fail closed); nothing is interpolated.
- Alaska, PR and the four island territories report statewide only; GU, VI, AS and MP have no CVAP, so their rates are "Insufficient data".

## Limits (why a rate is not evidence of wrongdoing)
- CVAP is a 5-year survey estimate with a margin of error; EAVS counts are a single-date snapshot (Nov 2024).
- NVRA notice-and-waiting rules keep moved voters on the rolls for up to two federal elections, so active ÷ CVAP can exceed 100% (169 counties) without any ineligible registrant.
- States without an inactive list report A1b = A1a; their inactive rate is blank.
- EAVS removal reasons and procedures differ by state; removals per 1,000 compare administrative activity, not accuracy.

## Next steps / workarounds
1. Resolve the 3 unmatched Wisconsin units with the WEC municipality list and re-run.
2. Split multi-county units (e.g. cities crossing county lines) using the CVAP place file as weights, shown as a separate, labelled estimate.
3. Add official state list-maintenance reports (NVRA section 8) only where a state publishes them as data, each with its own source link.
4. Re-run when the EAC publishes the 2026 EAVS (expected mid-2027 based on the 2024 release timing; UNVERIFIED).
