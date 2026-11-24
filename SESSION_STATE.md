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
   Root cause measured in run8.log: 9 layer stacks x 22 terrain tiles = 198 pooled 512² drapes, 0 held by tiles.
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
