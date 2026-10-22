# LiDAR at every zoom, 5,000,000-point ceiling: research plan

Request (2026-10-19): real-time pipeline "at all zooms", "8k resolution for all lidar at every zoom", keep the 5,000,000-point limit on phone and desktop, no crashes.

## Built

- LiDAR now loads from zoom 10 (was 15). Below 15 the OSM 3D buildings stay on the map; from 15 LiDAR replaces them as before. The 5,000,000-point ceiling (`LIDAR_POINT_CEILING`, lib/map/touch-gpu-budget.ts) is unchanged on phones and computers.

## Measured (phone-sized 390×844 window, DPR 3, touch emulation, desktop Chrome with software WebGL, downtown Atlanta, pitch 55°)

| Zoom | Before (min zoom 15) | After (min zoom 10) | Octree depth | Graphics context lost |
|---|---|---|---|---|
| 10 | 0 points ("zoom to 15+") | 309,106 points after 50 s, still loading | 4 | 0 |
| 12 | 0 points | 670,343 points after 50 s, still loading | 6 | 0 |
| 15 | 84,263 points after 70 s | 584,795 points after 70 s | 9 | 0 |
| 18 | 431,414 points after 70 s | 1,295,864 points after 70 s | 12 | 0 |

The "before" run used the live site and the "after" run a local production build, so network timing differs; both were still loading when sampled.

## Why "8K at every zoom" is not literally possible

- Detail is fixed by the survey. Georgia's statewide USGS 3DEP collection (GA_Statewide_B2_2018) is a fixed point cloud; zooming in shows deeper octree levels down to the surveyed points, never more. USGS quality levels: QL2 ≥ 2 points/m², QL1 ≥ 8 points/m² (USGS Lidar Base Specification).
- 8K is a screen size (7680 × 4320 ≈ 33 million pixels). The existing "SAVE 8K PNG" export (lib/map-8k-export.ts) renders one frame at that size. Running the live map at 8K would need ~16× the graphics memory of a 2× phone screen; iPhones cap the drawing buffer far below that, so phones stay at a 2× pixel ratio (`TOUCH_MAX_PIXEL_RATIO`).
- "Without crash" can't be guaranteed: 5,000,000 points need about 75 MB of GPU memory (15 bytes each) before imagery and other layers, and iOS Safari can drop the WebGL context under memory pressure. The map records each loss (`map_page_crashes`, `__gaGpu`) and redraws itself.

## Workarounds / next steps

1. Find the slow stage of point loading on phones (the proxy answers in 0.3–0.6 s per node; the browser drew 7–40 nodes per minute here). Candidates: imagery colouring per node, LAZ decode, buffer uploads. Time each with `performance.mark`.
2. Move node decoding to a Web Worker and send typed arrays as transferables.
3. Quantise positions to 16-bit per node (from 32-bit float), cutting GPU memory per point by about a third.
4. Test on a real iPhone (Safari Web Inspector) at zoom 10, 12, 15 and 18 for 10 minutes each, recording context losses.
5. Use a QL1 collection where USGS has one for the area.

## GPU memory at max zoom (measured 2026-10-19)

- `lib/map/vram-meter.ts` counts this page's WebGL allocations (buffers, textures, renderbuffers; freed on delete). Browsers expose no GPU-memory API, so it is an estimate of what the page asked for.
- Before: on a 390×844 touch view, zoom 22 with 70° pitch held 1,263 MB. 1,195 MB of it was 224 MapLibre terrain drape textures (1024² RGBA, mipmapped), not LiDAR.
- Fix (`lib/map/terrain-rtt.ts`): drape factor 2 → 1 (512² drapes) on touch devices always, and on desktops once measured memory reaches the target. After: 343 MB at zoom 22 / 70° (peak 355 MB), 241 MB at zoom 18 / 60°.
- `lib/map/vram-budget.ts` gives LiDAR whatever fits in the target (touch 512 MB, desktop 2,048 MB; lower after a crash) after everything else, from 250,000 up to the 5,000,000 ceiling. These targets are this app's own limits: iOS does not publish a per-tab GPU memory limit (UNVERIFIED).
- 5,000,000 points × 15 bytes = 75 MB. 500× that (37.5 GB) exceeds phone and most desktop GPU memory, so it is not offered.
