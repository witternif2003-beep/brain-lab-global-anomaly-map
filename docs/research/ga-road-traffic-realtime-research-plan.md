# Georgia roads: real-time traffic level research plan

Retrieved 2026-10-19 (UTC). Scope: roads inside the Georgia wall. Data rule: measured public data only; nothing synthetic.

## 1. Answer

- **Real-time counts exist, but only at stations, not on every road.** GDOT's Traffic Analysis & Data (TADA) public portal
  (https://gdottrafficdata.drakewell.com/publicmultinodemap.asp, accessed 2026-10-19) serves live 15-minute vehicle counts and
  average speeds for its continuous count stations (`GDOT_CCS`) without a login. [A: official GDOT portal, primary data]
- On 2026-10-19 the portal listed 332 continuous stations; 323 were in the live snapshot and 205 had a count in the latest
  15-minute bin (10:00–10:15 ET), totalling 102,700 vehicles. Method: one `POST /dataserver/liveSnapshot` call for all 332 ids,
  `lookbackHours: 1`. N = 1 snapshot, so this is a point observation, not a statistic.
- **Every other road segment has no live count.** The map shows those roads (OpenFreeMap roads overlay) but not a traffic level.
  The 45,979-segment GDOT AADT layer is year 2023 and is not used as live data.

## 2. Source hierarchy (what was tested)

| Source | What it is | Live? | Coverage | Grade | Used |
|---|---|---|---|---|---|
| GDOT TADA `liveSnapshot` (drakewell.com) | 15-min counts, avg speed, HGV share, GDOT "normal" count, per direction and lane | Yes, 15-min bins, collected every 5 min | 205 of 332 stations reporting | A | **Yes** |
| GDOT TADA `siteStatus` | last vehicle / last data time per station | Yes | 171 stations | A | Health only (not stored) |
| GDOT TADA `public/sites` | station list, location, bearing, speed limit, county | Static | 332 CCS + 27,328 portable | A | Yes (24 h cache) |
| GDOT 511 events (ArcGIS, GEMA) | incidents, closures, roadwork | 15 min | statewide events | A | Already on map |
| `EOC/GeoTrafficCountsDisplay` (GDOT ArcGIS) | inclement-weather counters | Only during events | 0 records on 2026-10-19 | A | No (empty) |
| `EOC/Reveal_Sensor_Lines` | spreader/equipment sensor lines | Yes | equipment, not traffic | A | No |
| `GA_Traffic_Counts_2022` FeatureServer | AADT per segment, `YEAR = 2023` | No (annual) | 45,979 segments | A | No (not real-time) |
| GDOT/ARC probe speeds (INRIX/HERE via DUA) | segment speeds on most roads | Yes | statewide | A | No: needs a signed data use agreement |
| GDOT ATSPM signal data | signal phase/detector logs | Near real-time | instrumented signals | A | No public feed found |

## 3. Data contract (verified fields)

- Units: speeds are mm/s; the portal's own `jsSpeedFactor` is 0.00223693629 mph per mm/s
  (scripts/mnm/customer/gdottrafficdata-config.js). Speed limit 24,587 mm/s = 55 mph, matching SR 169's posted limit.
- Times are station-local (`tz: US/Eastern`) wall times; the route converts them to UTC (DST-aware).
- Bin i covers `startTime + i × interval` to `+ interval`; `interval` = 900 s.
- `countStatus = NONE` or a null count means no measurement; those stations are counted as "no current count", never zero.
- `normalCount` is labelled "GDOT normal" as the portal provides it; its derivation is not documented publicly [UNVERIFIED].

## 4. Visual encoding (code: lib/ga-traffic-counts-layer.ts, lib/ga-traffic-counts/normalize.ts)

- **Traffic level** = measured vehicles per hour at the station (15-min count × 4), in this map's own bands
  (not a GDOT classification): Light < 250, Moderate 250–999, Busy 1,000–2,999, Heavy 3,000–5,999, Very heavy ≥ 6,000.
  Colours: Tiffany, sky, violet, pink, neon magenta, each on a dark outline.
- **Slowed** = measured average speed below 67% of the posted limit: red outline.
- **Direction arrows**: one arrow per measured direction, a map symbol anchored at its centre on the station's published
  coordinate at every zoom (the floating dash markers that stuck out beside each station were removed). From zoom 14 the
  arrow points along the matched mapped road (same matcher as the cars); below that, along GDOT's lane bearing.
- **Readability at every zoom**: dots scale with zoom and volume (3–22 px); labels from zoom 6.5 ("13700/h"), full
  "I-85 · 13656 veh/h · 32 mph" from zoom 10; text 10–17 px with a 2.2 px dark halo; arrows scale 0.45×–1.4× with zoom.
  Layers are raised above roads and LiDAR, and again after a WebGL context restore.
- **Freshness**: a station whose latest bin is > 45 min old is drawn at 45% opacity and labelled STALE; the live-feeds legend
  shows the feed's data age, Verified/Stale/Error badge and per-level counts.

## 4a. Car-level animation at 1,000 ft and below (code: lib/ga-traffic-counts/cars.ts)

- **Colour:** all cars are the same grey (#9ca3af) with white headlights and red tail lights; the traffic level stays on the station dot and arrow.
- **Gate:** cars draw only when the camera is at or below 1,000 ft (304.8 m) above the map centre: camera-to-centre distance × cos(pitch), from the vertical field of view, viewport height and Web Mercator scale. Measured on a 390×844 viewport: zoom 17.2 = 483 m (off), zoom 18.7 = 171 m (on), zoom 19.2 pitch 55° = 69 m (on).
- **Pinned to mapped roads:** for each measured direction the layer takes the OpenFreeMap road lines rendered around the station. It keeps the road class nearest the station, so a motorway station never borrows a side street. It picks the line within 80 m whose direction is within 60° of GDOT's lane bearing; one-way carriageways are used only with traffic (OpenMapTiles `oneway` 1 / −1). Then it draws ±300 m of that line.
- **Spacing = measured density:** metres between vehicles = mph × 1609.34 ÷ veh/h for that direction, across all lanes. Below 9 m (icon length + gap) the spacing is held at 9 m and one icon stands for more than one vehicle (exposed as `vehiclesPerIcon`).
- **Speed = measured average mph** for that direction; cars stand still when no speed was measured. With `prefers-reduced-motion` they are drawn once and not animated.
- **Not individual vehicles:** GDOT TADA publishes 15-minute counts and average speeds per station and direction, not vehicle positions. The cars are an encoding of those aggregates, on roads that have a station only. Lane positions, gaps between cars and vehicle types are not measured.
- **Limitation:** GDOT's lane bearings are coarse at some stations (e.g. 0°/180° on a stretch of I-85 that runs about 35°). The 60° tolerance still matches the right carriageway, but a station whose bearing is off by more than 60° gets no cars.

## 4b. Arrow pinning precision (retrieved 2026-10-19)

- **On screen:** the arrow is a MapLibre symbol whose anchor is the station coordinate itself (`icon-anchor: center`), so the
  drawn position equals the coordinate up to sub-pixel rounding. The CDP check finds the arrow within ±1 CSS px of
  `map.project(coordinate)` at each tested zoom; 1 px is about 0.6 m at zoom 18 and 0.04 m at zoom 22 at 33.9°N.
- **On the ground (5 cm target): INSUFFICIENT_EVIDENCE / not achievable from the source.** GDOT TADA publishes station
  coordinates with these decimal places (202 reporting stations, /api/ga-traffic-counts): 3 decimals (about 110 m) ×3, 4 (about
  11 m) ×24, 5 (about 1.1 m) ×120, 6 (about 0.11 m) ×55. No station is published finer than about 0.11 m, and GDOT does not
  state the survey accuracy. OpenStreetMap road geometry is traced from imagery and usually a few metres from the true lane.
- **What would get closer:** surveyed station positions from GDOT (RTK GNSS, cm-level) or lane-level HD map geometry.

## 5. Performance budget

- One API call per 5 min; the server caches the snapshot 3 min and the 22 MB station list 24 h (one ~4 s fetch per cold start).
- ~400 DOM markers, each one compositor-only `transform` animation; no WebGL redraw per frame. Reduced-motion users get 4× slower motion.
- Not yet measured on a physical iPhone.

## 6. Workarounds for roads without a live count

1. **Statewide segment speeds**: request the GDOT/ARC probe-speed data use agreement (DataSupport@dot.ga.gov). This is the only
   route found to live traffic on most roads.
2. **Portable counts**: 27,328 `GDOT_PORTABLES` sites exist; only short-term studies, so they'd be shown as dated studies, not live.
3. **Signals**: ask GDOT for public ATSPM read access; until then signal markers remain OSM locations, not live phases.
4. **Do not** extrapolate station counts onto neighbouring roads: that would be modelled data, which the data rule excludes.

## 7. Adversarial review

- Strongest objection: 205 stations are a small, interstate-heavy sample of Georgia roads; the map must not read as statewide
  coverage. Mitigation: dots only at stations, legend says "measured at stations only".
- Least-supported claim: the meaning of `normalCount` [UNVERIFIED].
- Selection bias: continuous stations favour high-volume routes; rural roads are under-represented.
- Dependency: the endpoints are the portal's own frontend API, not a documented public API; they may change without notice.
  The route fails visibly (HTTP 502, legend "Error") rather than showing old numbers as live.
- Independence: all live counts come from one source (GDOT TADA); there is no second live source to triangulate against.
  The 511 feed and AADT are independent context, not confirmation.

## 8. What would change this

- A GDOT data use agreement for probe speeds (would add live levels on most roads).
- GDOT publishing documented terms for the TADA endpoints, or changing them.
