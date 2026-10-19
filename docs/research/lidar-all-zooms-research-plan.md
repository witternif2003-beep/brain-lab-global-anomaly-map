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
