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
