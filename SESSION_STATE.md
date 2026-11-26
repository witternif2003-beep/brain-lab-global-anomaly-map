# SESSION_STATE
## Task
God's Eye (`/godseye-telemetry`) crash and slow-load remediation on phones, additions only (no layer, panel, label or record removed).
Done means: each change measured in a phone-sized browser, `npx tsc --noEmit -p .` + `npm test` + `npm run build` pass, pushed to PR #4
(https://github.com/witternif2003-beep/brain-lab-global-anomaly-map/pull/4), deployed to Vercel production, and `/api/health` reports the commit.
"100/100 at all zooms" and "no crashes" cannot be proven by finite tests; report measured numbers instead. Physical iPhone retest still required.

## Done (with proof)
- [x] Reverted phone marker interleaving — commit a313562, deployed.
- [x] Phones: imagery not sharpened (`?sharp=on` restores), sky offscreen at 2x, traffic canvas capped at 2x and counted in GPU ledger — commit 32eac2f; 486/486 tests; build exit 0; deployed, `/api/health` reported 32eac2f.
  Probe (393x852 @3x, SwiftShader, z16.5 pitch 60, 1 run each): map textures at +90 s 287.8 MB -> 191.9 MB.
- [x] 1,000-anomaly corpus (lib/statewide-anomalies.ts, 7.5 MB) loads as its own chunk after first paint — commit 83e0e1c; tsc exit 0; 486/486 tests; build exit 0;
  deployed, `/api/health` reports 83e0e1c, `/godseye-telemetry` HTTP 200. First-load JS 9.58 MB (prod before) -> 3.52 MB (local build). Time-to-map NOT improved in 1 run (local 34.4 s vs prod 23.7 s, different servers; unverified).

- [x] Overlay drawing buffers — commit 64a5cd8, deployed (prod chunk contains `overlaybuf`; /api/health commit field empty for CLI deploys): on touch, marker + traffic deck.gl canvases request `preserveDrawingBuffer:false, antialias:false`
  (luma.gl default was true/true; `?overlaybuf=default` restores). Ledger models each canvas buffer by attributes. Files: lib/map/touch-gpu-budget.ts,
  lib/map/vram-budget.ts, lib/ga-deck-overlay.ts, lib/traffic-overlay.ts, lib/map/gpu-ledger-controller.ts. tsc exit 0; 488/488 tests; build exit 0.
  Probe run7.log (local, 1 run): actual attrs aa=false pdb=false on both overlays; no page errors.
- [!] Root-cause finding (run7.log): map canvas textures keep growing at z16.5 hold: 188 MB (+15 s) -> 413 MB (+120 s); 198 x 512x512 mipmapped
  textures = 263 MB = terrain render-to-texture drapes (MapLibre tile.acquireRTT, one per tile per layer stack). Ledger shed to pixelRatio 1 but growth continued.

## Next (execute in order)
0. [x] Touch: free idle terrain drapes every 5 s at rest (lib/map/terrain-rtt.ts freeIdleDrapes; tests/map/terrain-rtt.test.ts). 489/489 tests, tsc 0, build 0.
   Probe run9.log (1 run, z16.5 hold): textures 238.7 MB at +120 s vs 412.8 MB in run7; flat from +75 s; 1448 drapes freed; no page errors.
   Deployed (CLI, commit 561c502): prod chunk 3ubylmephgjci.js contains freeIdleDrapes; /godseye-telemetry 200, /api/health 200.
   CORRECTION (churn1.log): the 198 "pooled" drapes were in transit, not idle; run7 vs run9 differ mainly in terrain tile count (22 vs 12), so the -42% is not attributable to freeIdleDrapes.
0b. [x] Drape guard (commit aeeac1b) (lib/map/drape-guard.ts, installed in components/GodsEyeMap.tsx; tests/map/drape-guard.test.ts): MapLibre released every drape on any source's
   tile data event; animated GeoJSON (cars/pulses, non-draped) caused 1,512 drape re-renders per 10 s at z18 (churn1.log). With guard: 450 per 10 s (churn2.log), 171 drapes held, 0 pooled.
   tsc 0, 491/491 tests, build 0. `?drapeguard=off` restores MapLibre behaviour. Zoom 17-22 sweep: sweep3.log.
0c. [x] Drape stack consolidation (lib/map/drape-stack.ts, installed in components/GodsEyeMap.tsx; tests/map/drape-stack.test.ts): phones move every
   draped layer (fill/line/raster/hillshade/background/color-relief), in order, below the first non-draped layer -> 1 drape stack instead of 9. `?drapestack=off` restores.
   sweep4-on.log vs sweep4-off.log (1 run each, same build): z18 hold 93.5 vs 323.5 MB textures; z20 hold 177.9 vs 346 MB (peak 525.6). 494/494 tests, tsc 0, build 0.
   Screenshots map-on-z18.png / map-off-z18.png look the same (satellite ground does not render in SwiftShader either way).
   Known: ScaleControl showed "NaN m" after jumpTo with stack on (2 of 2 runs); one 2-px pan fixed it (30 m). Not root-caused.
0d. [x] Script-memory profile (heap1.log, 1 run, z16 -> z12 Atlanta -> z18): JS heap 164 / 256 / 205 MB, no single dominant retainer
   (native buffers 50 MB, maplibre 22.5 MB, deck/three 19.7 MB of sampled live allocations). DOM nodes up to 44k.
0e. [x] Scale bar NaN fix (lib/map/scale-refresh.ts, tests/map/scale-refresh.test.ts): probe now reads 30 m / 50 ft right after the jump.
   MapDebugOverlay WebGL2 probe context now released (components/MapDebugOverlay.tsx). 495/495 tests, tsc 0, build 0.
   User decided "maximum everywhere" (2026-11-24 12:08), then asked for a VRAM/buffer latch (12:11).
0f. [x] Max quality + memory latch (lib/map/touch-gpu-budget.ts safeQualityRequested/qualityTouch/qualityCrashes/engageQualityLatch; callers in
   ga-lidar-layer, ga-deck-overlay, traffic-overlay, sharp-raster, terrain-rtt, gpu-ledger-controller, moving-tracks-layer, GodsEyeMap).
   Phones start at desktop quality; the ledger latches (sessionStorage ga-quality-latch) at pressure (>=90% of 512 MB) and turns the phone-safe
   settings + shedding on until the tab closes; a crash restart starts latched. `?quality=safe` forces safe, `?quality=max` disables the latch.
   Probe (probe_latch*.mjs, 3 runs): max quality ~238-280 MB textures at load, 287-296 MB at z18; latch engaged in 2 of 3 runs (608-609 MB of 512),
   map canvas then 373x754. Drape factor switch after latch not observed (unverified). 497/497 tests, tsc 0, build 0.
0g. [x] Slow load + earlier latch. Load probe on prod (load9.log): map 'load' at 145 s in SwiftShader, 485 requests / 32.9 MB, 8K starmap 11.4 MB first.
   CPU profile (cpu1/cpu2.log): toDataURL 33.7 s of 87 s main thread = marker-icon atlas PNG re-encoded per rebuild via sharedAtlas's no-device fallback.
   Fixes: lazyUrlAtlas (lib/ga-marker-icons.ts, puff-texture), ATLAS_PENDING_URL before deck device (lib/ga-deck-overlay.ts) -> toDataURL 0.1 s (cpu4.log);
   sky loads 4K then 8K (lib/sky-photo.ts); latch at QUALITY_LATCH_RATIO 0.7 (lib/map/gpu-ledger.ts): engaged at 361 MB during load, drape factor 1,
   ledger 268-338 MB of 512 at z18 (1 run). tests/lazy-url-atlas.test.ts. 499/499 tests, tsc 0, build 0.
0h. [x] Telemetry stream + rendering completion (complete1.log, sse-prod.log vs sse-local.log): hooks/useAnomalyStream.ts reopened /api/telemetry/stream
   on every GodsEyeMap re-render (inline callback in effect deps: prod 19 opened / 18 aborted in 78 s) and wrote the stream's {timestamp,tick,samples}
   frames into the 'anomalies' source, replacing 6 valid features with 1 invalid one (0 rendered at +60 s). Fix: callbacks in refs, isAnomalyFeature filter;
   local: 1 connection, 0 aborts, 6/6 features kept and rendered at +60 s. tests/anomaly-stream.test.ts. 500/500 tests, tsc 0, build 0.
   Also measured: map.loaded()/areTilesLoaded() never true because 14 animated GeoJSON sources update continuously (not changed).
0i. [x] Rain/snow/hail layer (user: "the rain/snow isn't being seen", "Proof grade rain layer"). No precipitation layer existed (MRMS only shaped clouds).
   app/api/ga-precip/route.ts: NOAA MRMS PrecipFlag + PrecipRate (mm/h) + RadarOnly_QPE_01H (mm), 0.01° grid, 2-min, retry once on truncated .latest.
   lib/ga-precip/precip-cells.ts (flag table from NSSL MRMS product table, archived copy), lib/ga-precip-layer.ts (MapLibre fill + popup + feed status
   'precip', stale after 10 min), deck SolidPolygonLayer 'ga-deck-precip' above the cyan Census dots (which hid MapLibre layers). tests/ga-precip.test.ts.
   Local 2026-11-25 23:18Z: 140,024 wet cells (all rain), peak 49.6 mm/h, peak 1-h 23.9 mm, 6,897 features at 0.02° (1.79 MB), screenshot precip-deck2.png.
   505/505 tests, tsc 0, build 0.
0j. [x] DONE (commit 3f9c716, deployed 2026-11-26): falling-droplet rain (user 2026-11-25 20:55: remove flat rain from base layer, droplets in the sky at source location/altitude,
   real time; 20:57 "resume deploy to vercel and GitHub"). Plan: lib/ga-precip-layer.ts keeps fill at opacity 0 (tap target) and stops pushing
   'ga-deck-precip' (keep behind ?rainbase=on); new deck LineLayer 'ga-deck-rain' in lib/ga-deck-overlay.ts fed by setGaDeckRain(map, droplets),
   animated from the existing startPulse loop (add `|| state.rain` condition). Droplets: budget 32,768 (8,192 when qualityTouch()), seeded on
   moveend over precip features in view, weight = Marshall-Palmer N_T(R)=N0/Λ (N0=8000 m^-3 mm^-1, Λ=4.1 R^-0.21 mm^-1) × area × base height;
   D sampled exponential, v = 9.65 - 10.3 exp(-0.6 D) m/s (Atlas et al. 1973) rain, ~1 m/s snow (Locatelli & Hobbs 1974); start height = nearest
   METAR lowest cloud base (stationBases in lib/ga-clouds/radar-clouds.ts, 100 km) else 1,500 m AGL "assumed" — add baseM to /api/ga-precip
   features; ground = map.queryTerrainElevation (includes exaggeration; deck z = MSL × exaggeration like cloud puffs). Streak length = ~14 px at
   current zoom (visibility, labelled). Research plan file: /home/ubuntu/rain-research-plan.md (attach; not committed).
   Sources verified via Crossref: Marshall & Palmer 1948 J. Meteor. 5:165-166; Gunn & Kinzer 1949 J. Meteor. 6:243-248; Atlas, Srivastava & Sekhon
   1973 Rev. Geophys. 11:1-35; Locatelli & Hobbs 1974 JGR 79:2185-2197. MRMS BrightBandTop/BottomHeight (m AGL, 2-min) and Model_0degC_Height
   (m MSL, 60-min) exist but are 10-16 MB per file (not used).
   PROGRESS (uncommitted in working tree): lib/ga-precip/droplets.ts + tests/ga-droplets.test.ts (3 pass); route adds baseM/baseStation per feature
   (local: 89 METAR stations, 5856/5856 features got a station base); overlay LineLayer 'ga-deck-rain' + rainTick in pulse loop; fill opacity 0
   unless ?rainbase=on; ?rain=off disables drops. tsc 0, npm test 508/508, build 0. Probe: __gaRain drawn 8192 (latch on) in 2 runs, no page errors.
   FAILED TWICE: screenshots (Playwright screenshot timed out 30 s and 150 s while drops animate); rain_view.mjs (iPhone UA + inject.js) saw
   window.__map never set in 300 s (2 runs). Diagnostic next: same script with ?rain=off (/home/ubuntu/gpuprobe/rain_view.mjs). If off loads and
   on does not, drops starve load on SwiftShader -> defer seeding until map 'idle' after load and cap at 8,192 before latch.
   RESULT: ?rain=off ALSO never set window.__map in 300 s -> probe-harness problem, not the drops (unresolved). Visual check UNVERIFIED.
   DEPLOY: vercel deploy --prod exit 0; live /godseye-telemetry 200, /api/health 200, /api/ga-precip returns baseRule + metarStations 89
   (2026-11-26T02:36Z, 131,786 rain cells). Client chunk hashes differ from local build (remote build), so the drops on screen are UNVERIFIED.
0k. [x] DONE (user 22:19-22:25: drops visible on whole Georgia map, 32K, sun-shower sparkle): drops drawn LAST in deck createLayers (above Census
   dots/markers/labels), head dot (ScatterplotLayer 'ga-deck-rain-heads', 1.6 px) + 2 px streak, 32,768 on every device (latch no longer cuts to 8,192),
   per-drop glint colour (sparkle() in lib/ga-precip-layer.ts, visual only). Probe (probe_rain2.mjs, local prod): drawn 32,768 at z6.6 and z8.5/pitch 65,
   0 page errors; z6.6 screenshot shows white drops over the map. Probe-harness failure earlier = stale `next start` serving an old .next after rebuild
   (fix: `fuser -k 3217/tcp` before restarting; never `pkill -f` a pattern that appears in your own shell command).
   Root cause measured in run8.log: 9 layer stacks x 22 terrain tiles = 198 pooled 512² drapes, 0 held by tiles.
0l. [x] DONE (user 22:44 "rain is not visible and cloud touches ground"; 22:51 "leave cloud layer alone if that is the correct location"):
   commit d028f4e. Drops seeded within max(600 m, 2 screen widths) of view centre (lib/ga-precip-layer.ts); radar clouds keep the
   measured METAR base, never lowered to fit a shallow echo, assumed 1,500 m with no station (lib/ga-clouds/radar-clouds.ts, ASSUMED_BASE_M);
   popup shows echo top vs drawn top. Cloud LOCATIONS untouched per user. Evidence the low cloud is real: METAR KVDI/KAZE OVC003 BR,
   KEZM OVC004 DZ (91-122 m). tsc 0, 509/509 tests, build 0, push 0, npx vercel deploy --prod 0; live page/health/ga-precip/ga-radar-clouds 200,
   radar features 30373, zero-base 0, 70 tops raised above base. Local probe at z18.5 pitch 75 over heaviest cell: 32,768 drawn within 600 m,
   errors []. NOTE: `vercel` is not on PATH; use `npx --yes vercel deploy --prod --yes`.
0m. [x] DONE (user 22:55 "rain must be tear drop shape 3d"; answer: "3d teardrop never flat proof grade from photo"): rain drops are a
   deck SimpleMeshLayer of a procedural 3D teardrop (lib/ga-precip/teardrop-mesh.ts: tip up, round bottom, 140 tris, outward winding,
   back-face culled), 4 px tall at z<=8 to 10 px at z>=15; snow/hail keep 1.6 px dots (per-instance getScale/getRadius); `?drop=dot`
   restores dots. Popup note says teardrop is artistic (NASA GPM: real drops are hamburger-bun shaped). tsc 0, 512/512 tests, build 0.
   Local probe (rain cell -81.55,30.35, z18.5 pitch 75): 32,768 drawn, errors [], screenshot ~/gpuprobe/precip-tear-pitch.png shows teardrops.
0n. [x] DONE (user 23:11 "the drops must be the color of water"): drop colour moved to lib/ga-precip/drop-colors.ts (WATER_RGBA 60,150,215,175
   translucent blue from the user's photo, glint toward 235,248,255; snow stays white). 0m teardrop commit 70eb783 deployed (npx vercel exit 0,
   page/health/ga-precip 200). This step: tsc 0, 513/513 tests, build 0; probe at -81.52,30.41 z18.5 pitch 75: 32,768 drawn, errors [],
   ~/gpuprobe/precip-water-pitch.png. Commit 8656fe2 pushed + deployed (exit 0); live page/health 200; /api/ga-precip 502 once, 200 on retry
   20 s later (observedAt 04:16Z, 3,887 features, error null).
0o. [x] DONE (user 23:22 "all drops 32k and 50% less size"): teardropPx 4-10 -> 2-5 px (lib/ga-precip/teardrop-mesh.ts:12), dot radius 1.6 -> 0.8 (lib/ga-precip-layer.ts), tests/ga-teardrop.test.ts expects 2/5/5. tsc pass, npm test 513/513, build exit 0. Local probe (gpuprobe/r9.log): state view 32,768 drawn, pitched z18.5 at -81.42,30.47 32,768 drawn, errors []; screenshot gpuprobe/precip-half-pitch.png. Commit d4e7bf5 pushed (exit 0); npx vercel deploy --prod exit 0; live page 200, /api/health 200, /api/ga-precip 200 (observedAt 2026-11-26T04:28:00Z, 3,986 features, error null). iPhone check pending.
1. Ask user to retest on iPhone (Turner County, 100 m scale, hold 60 s; zoom 1 km -> 500 m) and send a recording.
2. Terrain drapes: 512x512 render-to-texture tiles hold ~144 MB on phones (lib/map/terrain-rtt.ts, lib/map/horizon-lod.ts). Test touch LOD variants one at a time (parallel probes starve CPU): `node /home/ubuntu/gpuprobe/probe_lod.mjs <url> '[5,3]' B`.
3. Clouds: audit existing cloud layer against NOAA GOES cloud-top height (location, size, height, update interval); grade sources.
4. Rain/snow: build from NOAA MRMS (precip rate, type, update interval); show source grid size and timestamp.
5. Older pending items: see task list in Devin session (elections modules, ICAO aircraft classes, NOAA audit, /sim-nodes).

## Git
PR #4 head branch is `devin/1790587184-jurisdiction-cards`. The /home/ubuntu/wt-fix checkout is on `devin/tmp-render-fix`; push with
`git push origin HEAD:devin/1790587184-jurisdiction-cards` (plain `git push origin HEAD` misses the PR). Commits e3580be..2c5b844 reached the PR branch only on 2026-11-24.

## Verify on resume
`npx tsc --noEmit -p .` · `npm test` · `curl -s https://brain-lab-six.vercel.app/api/health | grep -o '"commit":"[^"]*"'`

## Blockers / failures (evidence attached)
- No physical iPhone test; all probes are Linux Chromium + SwiftShader.
- Devin session hit out_of_quota once mid-deploy (deploy had completed).
- Probe scripts live outside the repo in /home/ubuntu/gpuprobe (not committed).

## Secrets
Referenced by name only. Vercel CLI auth and GitHub auth are provided by the Devin environment; no values stored here.
