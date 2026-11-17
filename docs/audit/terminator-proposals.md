# AUDIT: SOLAR TERMINATOR PROPOSALS (4 PASTED FILES, 2026-10-16)

## SCOPE
Four pasted proposals: (1) MapLibre CustomLayerInterface terminator with WebGL2 shaders, NOAA subsolar math, twilight bands, ocean glint, limb glow, OpenTelemetry metrics; (2) WebGPU renderer with device-loss handling, timestamp queries, 8K export, quadtree texture streaming; (3) WebGPU/WebGL2 backend dispatcher, capability probe and pixel-conformance harness; (4) shared LOD selection, WebGL2 texture-array store, quadtree fragment shader.

## CONFIRMED ISSUES IN THE PROPOSALS
1. Full-screen-quad equirectangular renderer does not match this map. GodsEYE runs MapLibre `projection: globe` with 3D terrain; a screen-space quad that maps fragments to lon/lat via an inverse equirectangular transform draws the wrong place on a globe and ignores terrain. A custom layer would have to use MapLibre's globe projection matrices per vertex.
2. The proposals replace the basemap with NASA Blue Marble / Black Marble textures (5400x2700 to 21600x10800). GodsEYE already uses Esri/Maxar imagery; swapping basemaps would remove an existing component (not authorised).
3. Example call sites use `https://demotiles.maplibre.org/style.json`, a demo style, not this app's style.
4. Proposal 2's 8K offscreen export copies ~118 MB to the CPU; proposal 3 itself notes this fails on mobile. The user checks on an iPhone.
5. Proposal 4 flags a seam bug in its own texture-array LOD design (linear filtering does not cross TEXTURE_2D_ARRAY layers) and leaves it unfixed.
6. Browser-support figures ("WebGPU ~85%", "EXT_disjoint_timer_query ~30% of devices", "Firefox 141+") are not sourced. Not repeated here.
7. No new npm dependency was needed; the OpenTelemetry browser metrics in proposal 1 would add a client OTel SDK that the app does not ship (server OTel is `@vercel/otel` in instrumentation.ts).

## UNCERTAINTIES
- WebGPU, GPU timestamp queries and WebGL timer queries cannot be measured on the Devin VM (SwiftShader Chrome: no `navigator.gpu`, no EXT_disjoint_timer_query_webgl2). Any frame-time number for them would be invented.
- Not tested on a physical iPhone.

## WHAT WAS BUILT INSTEAD (MAPLIBRE-NATIVE)
- `lib/terminator/solar.ts`: Astronomical Almanac low-precision sun position (subsolar declination/longitude, altitude), per-meridian below-threshold latitude intervals, GeoJSON strips for four nested bands: sunset (-0.833°), civil (-6°), nautical (-12°), astronomical (-18°).
- `lib/terminator-layer.ts`: four translucent `fill` layers on the GodsEYE globe, recomputed every 60 s while the tab is visible, faded out from zoom 5 to 7.5 so street-level views are unchanged; reports a "Day/night terminator" row in the live-feeds legend with subsolar point and sun altitude at Atlanta. Labelled as computed, not observed.
- `tests/terminator/solar.test.ts`: equinox/solstice declination, equation-of-time longitude, altitude extremes, interval correctness, ring closure.

## NOT DONE
WebGPU backend, 8K export, quadtree texture streaming, ocean glint, limb glow, conformance harness. Reason: items 1-5 above, and no hardware to measure them.

## GATE RESULTS (COMMIT 5ee3f83)
- `npx tsc --noEmit -p .`: pass
- `node --import tsx --test`: 136 tests, 136 pass, 0 fail
- `npx next build`: compiled successfully
- Production https://brain-lab-six.vercel.app: BUILD 5ee3f83; /godseye-telemetry 200, /api/ga-clouds 200, /fbi-osint 200, /api/space-weather 404 (removed in rollback, expected); terminator source + 4 layers present (sunset 360, civil 360, nautical 164, astronomical 149 strips at 12:54 UTC); 0 console errors.

## FOLLOW-UP: SEAMLESS SHADE AND FAST-BLINK STROBE
- The four stepped bands are replaced by one fill layer `solar-terminator-shade`: non-overlapping strips for 20 altitude slices (+0.8° down to -18° in 1° steps, plus full night), each with a `opacity` property from a smoothstep ramp (0 above the sunset limit, 0.9 black at -18°; later 0.95). Adjacent slices share interpolated boundaries, so there is no stacking and no hard band edge.
- Confirmed seam found on the live map after the first deploy: where a slice changes from one to two latitude intervals between neighbouring meridians (contour tangent to a meridian), index pairing failed and fell back to rectangles, visible as vertical stripes near 70-82°E. Fixed by recursively bisecting the 2° strip down to 0.125° wherever slice topology differs.
- New indicators on every live-marker layer now strobe for 10 minutes (was 15) with a ~4 Hz on/off blink (240 ms period). Event layers (911, police reports, PIREPs, quakes, TFRs) key each observation; aircraft key by callsign+type, transit by agency+vehicle, fixed sites by name+position, so moving or re-read markers do not re-strobe. Non-event layers start steady on first load. `tests/ga-live-markers/strobe.test.ts` had been committed empty; it now has 4 tests.

## FIFTH PROPOSAL (NASA BLACK MARBLE TONE CURVE / NIGHT QUADTREE)
Scope: GLSL tone curve for VIIRS Day/Night Band radiance, new fragment shader for the proposals' WebGL2/WebGPU renderer, per-channel quadtree fallback, pinning the level-0 tile.

Confirmed issues:
1. It patches the renderer from proposals 2-4 (`sampleLayers`, `uSlotMeta`, `WebGl2TextureStore`, `evictStale`, `acquireSlot`). None of that exists in this repo (not adopted, see above), so there is no code to apply it to.
2. GodsEYE has no night texture. The night side is a black shade over Esri/Maxar imagery, so a radiance tone curve has no input.
3. `smoothstep(0.0, -0.1045, c)` and the other three twilight weights pass edge0 > edge1; the GLSL ES 3.00 spec leaves smoothstep undefined when edge0 >= edge1, so results can differ across GPUs.
4. `sampleChannel` is called in `sampleLayers` before it is declared; GLSL requires a declaration or prototype first, so the shader as written does not compile.
5. `sampleChannel` finds the slot rectangle by layer index only, but day, night and ocean use separate texture arrays whose layer indices overlap, so it can pick another channel's rectangle.
6. The radiance figures (city cores ~0.85, populated 0.05-0.15, unlit 0.01-0.03), the "gamma ~0.45 standard" and "Geospatial Product Specification, Section 4.2" are unsourced; the file itself says it cannot verify the citation.
7. "Night drops out at high zoom": in GodsEYE this was the shade's own zoom 5-7.5 fade, not texture residency. Removed on user request ("the ground should reflect night mode also"): the shade now covers the ground at every zoom and reaches 0.95 black at -18°. Buildings, clouds, LiDAR points and markers draw above it and are not darkened.

Uncertainty: whether a NASA GIBS VIIRS city-lights layer could be limited to the night side inside MapLibre's globe without a custom shader. Not attempted.

## FOLLOW-UP: NIGHT LIGHTS ("GOOGLE EARTH NIGHT MODE" LOOK)
Google Earth imagery is not used: its terms do not allow its tiles in other map apps. The look is reproduced from public sources instead.
- Night shade max darkness lowered from 0.95 to 0.8, so the satellite ground stays faintly visible at night.
- Above the shade, three raster overlays are masked per pixel to the night side with the same sun-altitude ramp as the shade (`lib/terminator/night-mask.ts`), via a `nightmask://` MapLibre protocol (`lib/night-lights-layer.ts`). Masks are recomputed in 5-minute buckets.
  - City lights: NASA GIBS `VIIRS_Black_Marble` (title "Black Marble (VIIRS, Suomi NPP)"), time dimension values 2012-01-01 and 2016-01-01 (P1Y), default 2016-01-01, `Current` false per the GIBS WMTS capabilities. A yearly composite, not live; native max zoom 8, overzoomed above that. Unlit pixels (max channel < 0.08) are made transparent so only emitted light shows.
  - Roads: Esri World_Transportation reference tiles. Labels and borders: Esri World_Boundaries_and_Places.
- Uncertainty: whether Google Earth's own night layer uses the same NASA data was not verified.
- Observed: from this VM, GIBS tiles sometimes took 4-17 s in Chrome (0.14 s with curl), so city lights can appear after the roads and labels.

## SIXTH PROPOSAL SET ("LUMINOUS GRID" ROADS/CLUSTERS, "LIDAR APEX" 2M CEILING, STYLE.JSON + CLUSTER CLICK HANDLER)
Five files received; files 4 and 5 are byte-identical and contain only directive text, no technical content.

Adopted:
- LiDAR hard ceiling of 2,000,000 points on any device (`LIDAR_POINT_CEILING` in `lib/map/touch-gpu-budget.ts`; desktop budget was 5,000,000). The touch-device GPU budget from e5b9b80 is restored: 1,500,000 points, 3 parallel node fetches, 48 imagery tiles, deck.gl drawing buffer capped at 2x device pixels. It was lost when the Oct 15 update was rolled back.
- Prometheus alerts `LidarPointCeilingExceeded` (lidar_points_drawn > 2,000,000) and `RepeatedWebglContextLoss` (webgl_context_losses > 2 for 10 min), on metrics the RUM pipeline already exports.

Confirmed issues / already present:
1. "Roads are missing at night": stale. Esri World_Transportation roads already draw above the night shade (follow-up above).
2. `mapbox://mapbox.mapbox-streets-v8` needs a Mapbox access token and Mapbox's own `mapbox://` URL handling; MapLibre does not resolve it. The `DIN Offc Pro Medium` font stack is likewise served only by Mapbox glyph endpoints.
3. The style.json would replace the whole map style (terrain, globe, sky, every live layer) with 6 layers, which removes existing features.
4. `getClusterExpansionZoom(clusterId, callback)` is the pre-v3 callback API; in MapLibre 6.13 it returns a Promise. GodsEYE already uses the Promise form for its clustered anomaly source (`anomaly-clusters`, clusterRadius 50, clusterMaxZoom 12, click-to-expand).
5. WebGL context-loss handling exists (b8e9477): MapLibre itself calls `event.preventDefault()` in `_contextLost`, the map counts losses, shows a GPU-lost state, and re-adds layers including LiDAR on restore; losses are exported as `webgl_context_losses`.
6. The point cloud source is USGS 3DEP Entwine (EPT) octrees with nearest/shallowest-first node planning under the point budget, not COPC; switching formats is not needed to enforce the cap.
7. GPU radix sort for 2M points: the LiDAR layer draws opaque points with depth testing, so no depth sort is needed. This VM's browser has no WebGPU to measure it.
8. `map.gpu.overdraw_ratio`, `map.layer.road.render_time_ms` and the quoted results ("draw calls reduced by >80%", "p95 14 ms desktop / 28 ms mobile", "60 FPS at zoom 8 Tallahassee") have no measurement method in the files. They are not reported. Browsers do not expose per-layer GPU time for MapLibre raster/line layers.

Not adopted:
- Clustering the deck.gl live-marker layers. It would hide individual markers at low zoom, which conflicts with the standing rule not to hide existing features. Available on request.
