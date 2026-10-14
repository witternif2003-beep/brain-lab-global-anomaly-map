# Technical audit — 2026-10-12

Scope: all 286 tracked source/config/doc files (`git ls-files`, excluding bundled data, images, models and the lockfile). Every file was scanned by `docs/audit/scan.mjs` (file list: `git ls-files` filtered as above, written to /tmp/audit-files.txt) for the patterns listed in the appendix; files with server-side network I/O, write endpoints, rendering loops or WebGL were then read by hand. Findings are split into CONFIRMED (reproduced or read in code), UNCERTAIN (plausible, not reproduced) and PROPOSED/APPLIED corrections.

## CONFIRMED ISSUES

| # | File | Issue | Evidence | Correction |
|---|---|---|---|---|
| C1 | lib/ga-lidar-layer.ts | LiDAR layer disappeared permanently after a WebGL context loss | MapLibre logged "Custom layer with id 'ga-lidar-3d' cannot be restored after WebGL context loss" during repeated phone-size runs on this VM | Re-create the layer on `webglcontextrestored` (applied, d0631aa) |
| C2 | lib/ga-lidar-layer.ts | Touch devices drew dots up to 10 CSS px, blurring points together | shader cap `uMaxPx = 10 * dpr` for all devices | Touch cap 4 CSS px (applied, ea77c7e) |
| C3 | 16 server files (app/api/fbi/*, ga-hydromet, ga-telemetry, ga-telemetry/recent, ga-traffic, public-live, tiles, lib/connectors/{bls,doj,epa-echo,fbi-cde,fema,sec-edgar,worldbank}) | Upstream `fetch` had no timeout, so one hung public API holds the function until the platform kills it | 20 fetch calls without `signal` | `signal: AbortSignal.timeout(15_000)` on each (applied, d0631aa) |
| C4 | app/api/petitions/sign/route.ts | Returned `status: "VERIFIED"`, `signatureCount: 142850`, "FISMA High & Zero Trust WIF Authenticated" for any POST; nothing is stored or authenticated | code read | Returns 501 with a plain explanation (applied) |
| C5 | app/api/health/route.ts | Fell back to a hard-coded commit SHA when `VERCEL_GIT_COMMIT_SHA` is unset, so BuildFreshnessChip could show a false drift/match | code read | `commit: null` when unknown (applied). Remaining fields (`directivesAvailable`, `clearanceLevel`, etc.) are static strings, not measurements — see U4 |
| C6 | app/api/system-scan/route.ts, app/api/lucid1/route.ts | Served a fabricated "TOP SECRET//SI//NOFORN…" classification marking on a public site | code read | Line removed (applied) |
| C7 | app/api/telemetry/route.ts → components/LidarGlobe.tsx | SSE "Real-World Telemetry Pulse" is synthetic: 4 hard-coded vessels with `Math.random()` jitter; LidarGlobe popups showed them with MMSI like real AIS | code read | Popup now says "simulated demo track, not live AIS" (applied). Stream itself left in place (see P2) |
| C8 | app/api/cron/ingest/route.ts | Missing/invalid CRON_SECRET answered 503 (service unavailable) instead of 401 | `curl` → 503 | 401 (applied) |
| C9 | app/api/tiles/[...path]/route.ts | OSM tile proxy sent an invented contact address (contact@brainlab.ai) in User-Agent; OSM tile policy requires a real contact | code read | UA now points at the repo URL (applied) |
| C10 | next.config.js vs vercel.json | `/api/*` CORS restricted to brain-lab-six.vercel.app in next.config.js is overridden: production answers `access-control-allow-origin: *` | `curl -D -` on /api/health and /api/ga-live-markers | Not changed — decide which policy is intended (P3) |
| C11 | k8s/keda-redis-scaler.yaml | References image `brain-lab/sse-consumer:latest`, a Redis stream and secrets that exist nowhere in the repo; cannot be applied | repo search | Superseded by deploy/k8s (P4) |
| C12 | app/api/metrics/route.ts | Metric names differed from the brief (`nodejs_heap_used_bytes`, `usgs_seismic_events_30d`) | code read | see metrics section of the final report |
| C13 | eslint | `npx eslint` fails: ESLint 10 with no `eslint.config.*` in the repo, and no `lint` script | tool output | Not changed: the repo uses TypeScript 7, and typescript-eslint (needed by eslint-config-next/typescript) declares `typescript >=4.8.4 <6.1.0`. `tsc --noEmit` is the type gate (P5) |
| C14 | app/api/health/route.ts, components/LucidMethodologyTrace.tsx | /api/health served constants (`clearanceLevel: NSA_ADMIN_MODE_SENIOR_MANAGER_SPECIFIC`, `directivesAvailable: 3800000`, `deployment: "Vercel Production Edge"`) as if measured; the threat-globe strip showed them as "LIVE FROM /api/health" | `curl /api/health` | Health returns status, commit, `VERCEL_ENV`, timestamp only. The strip keeps the theme figures as constants labelled "THEME FIGURES, NOT MEASURED" (applied) |
| C15 | app/api/metrics/rum/route.ts | Logged every browser report, one log line per visitor per 30 s | code read | Log removed; values go to the span and the metrics window only (applied) |

## UNCERTAINTIES

| # | Area | Uncertainty |
|---|---|---|
| U1 | app/api/metrics | Probes 9 layers through the deployment's own origin; a cold start can take 20–45 s. Scrape interval should be ≥ 60 s with a 55 s timeout. |
| U2 | module-level `new Map` caches (ga-live-markers, ga-hydromet, geojson-vt-protocol, jurisdiction-cards, marker icons, mesh models) | Bounded by layer/feed count in the code read; not load-tested for growth across long-lived instances. |
| U3 | Client fetches without timeout (ga-lidar-layer, ga-orbital-layer, ga-patrol-3d, ga-wall-3d, ga-traffic-layer, …) | Browser fetches are cancelled on navigation; a stalled one only delays that layer. Not changed. |
| U4 | /api/health, /api/system-scan, /api/spark, BUILD_REPORT.md, FULL_SYSTEM_AUDIT*.md | Contain static claims ("VERIFIED / LIVE", "3,800,000 directives", "±2.0cm grounding", "subSecondLatencyMs: 42", Spark "1,000,000 tokens") that are constants, not measurements. Only the commit SHA and classification marking were corrected. |
| U5 | `any` usage (GodsEyeMap ×28, StateMap ×18, …) | Type holes; no runtime bug traced to them. |
| U6 | Math.random in ga-patrol-3d, ga-competitors, ga-deck-overlay, AmbientBackground, isolation-forest | Used for simulations, visual effects or model sampling; whether every simulated layer is labelled on screen was not checked. county-matrix and reports pages jitter displayed confidence values — not labelled as simulated. |
| U7 | Mobile 60 FPS / 16 ms frame budget | Not measurable on this VM (software WebGL, frequent context loss). Desktop frame timings are reported separately. |

## PROPOSED CORRECTIONS (not applied)

- P1: county-matrix and reports pages: stop jittering confidence values with Math.random or label them simulated.
- P2: /api/telemetry SSE: mark payloads `simulated: true` or replace with a real public AIS source (none keyless found for Georgia).
- P3: pick one CORS policy: drop `Access-Control-Allow-Origin: *` from vercel.json for `/api/*`, or drop the dead next.config.js header.
- P4: done — k8s/keda-redis-scaler.yaml deleted, replaced by deploy/k8s/brain-lab.yaml.
- P5: add an `eslint.config.mjs` (next/core-web-vitals) and a `lint` script.
- P6: /api/health done (C14). /api/system-scan and /api/spark still return constants.
- P7: RUM aggregation is per instance and in memory; for fleet-wide numbers export the browser values as OTLP metrics or into a shared store (Redis/Prometheus remote-write).
- P8: /api/metrics/rum is public and unauthenticated (bounded to 4 KB, validated); add per-IP rate limiting (e.g. Vercel firewall rule) before relying on it.

## MEASUREMENTS (this VM)

All numbers below were measured on this VM; none come from production users.

- Container stack (`deploy/docker-compose.yml`): image built, `/api/health` 200, `/api/metrics` 200 in 1.83 s with all 9 `ga_feed_up` = 1. OTel Collector received 125 spans from 2 resources. Prometheus scraped both targets (`up`), `count(ga_feed_up==1)` = 9, all 8 rules loaded with health `ok`.
- RUM round trip: POST of a valid report → 204, malformed → 400, values appear in `/api/metrics` as `map_render_fps{page,device}` etc.
- Load test (`scripts/perf/load.mjs`, one container, localhost):
  - 200 concurrent, 20 s, `/api/health` + both map pages: 18,283 requests, 914 req/s, 0 errors, p50 211 ms, p95 342 ms, p99 464 ms.
  - 50 concurrent, 20 s, `/api/ga-live-markers?layer=quakes|tfr` (served from the module cache after the first upstream call): 33,456 requests, 1,673 req/s, 0 errors, p50 27 ms, p95 52 ms, p99 62 ms.
- Browser frame profile (`/godseye-telemetry`, 1600×1000, street LiDAR over downtown Atlanta): renderer is SwiftShader (CPU software WebGL), 3.7 FPS mean, p95 frame 483 ms, JS heap 104 MB used. LiDAR was still loading after 90 s. This measures the VM's software renderer, not a GPU; it cannot confirm or refute the 16 ms / 60 FPS target.

## NOT DONE, AND WHY

- WebGPU 3D Gaussian Splatting: splats are fitted from many overlapping photographs; USGS LiDAR provides points with x/y/z/class/intensity, no per-point covariance or opacity. Converting points to "splats" would invent geometry rather than render the survey.
- Kafka/Flink event bus: the app runs as stateless Vercel functions with no long-lived consumer to attach them to.
- 10,000-concurrent-user test against production: every live-marker request fans out to third-party public APIs (ADS-B, GDOT, USGS, FAA, Bluesky, county ArcGIS). That load would hit those agencies, not just this app. A bounded local test was run instead.
- E911 queue depth, WebSocket reconnect rate: no Georgia agency publishes a dispatch queue; the app uses no WebSockets.

## RUNBOOK v2 FOLLOW-UP (2026-10-12)

Input: a second brief proposing WebGPU 3DGS (PlayCanvas 2.19.0, Streamed SOG), Vercel Drains, GPU timestamp queries, 99.9% SLOs, Kubernetes/Helm validation, mocked load tests and CI.

Confirmed issue found during Kubernetes validation:
- C16 `Dockerfile` — `USER app` (non-numeric) made the pod fail with `CreateContainerConfigError: container has runAsNonRoot and image has non-numeric user`. Fixed: user/group 10001, `USER 10001:10001`; `runAsUser`/`runAsGroup: 10001` set in deploy/k8s/brain-lab.yaml and the Helm chart.

Done and verified on this VM:
- SLO: deploy/prometheus/rules.yml now targets 99.9% with multi-window burn-rate alerts (1h&5m at 14.4x page, 6h&30m at 6x page, 3d&6h at 1x ticket) plus FeedDown, TransitStale, FeedSlow, RenderBelow30Fps, FrameOver16ms, LidarGpuPassOver8ms, MobileHeapOver512MB. `promtool check rules`: 16 rules, SUCCESS.
- Helm: deploy/helm/brain-lab (app Deployment/Service/HPA, OTel Collector with optional extra exporters). `helm lint` passes for values-dev and values-production.
- Kubernetes (kind v0.27.0, Kubernetes node image from kind, local only): Helm release installed with the locally built image; app pod Ready, securityContext `runAsNonRoot/runAsUser 10001/RuntimeDefault seccomp`; `/api/health` 200 through the Service; `/api/metrics` 200 in 3.4 s with 9/9 `ga_feed_up` = 1; the in-cluster Collector logged a 125-span batch. deploy/k8s/brain-lab.yaml passes `kubectl apply --dry-run=server`.
- Mocked upstream load test: scripts/perf/mock-fetch.mjs replaces `fetch` in the server process. One record pass saved 61 upstream responses; the replay run served only saved responses (unknown URLs get 503) with 150 ms added latency. 200 concurrent, 30 s, all 9 layer APIs + health: 24,100 requests, 803 req/s, 0 errors, p50 219 ms, p95 257 ms, p99 457 ms, max 18.4 s. 273 replayed upstream calls, 0 unrecorded. No request reached a public agency during the run.
- GPU timing: lib/ga-lidar/gpu-timer.ts wraps the LiDAR draw in `EXT_disjoint_timer_query_webgl2` queries; p95 over the last 120 passes goes to `window.__gaLidar.gpuMsP95`, the RUM report and `lidar_gpu_ms_p95`. This is WebGL GPU timing, not WebGPU timestamps. On this VM (ANGLE/SwiftShader, Chrome 137) the extension is absent and `navigator.gpu` is undefined, so no value was produced; the metric is omitted rather than reported as 0. Browsers that hide GPU timers for privacy (Safari, Firefox) will also report nothing.
- CI: .github/workflows/ci.yml runs typecheck, all tests, `next build`, Docker build + container health check, Helm lint/template and promtool.

Checked against sources, not built:
- Vercel Drains (https://vercel.com/docs/drains): Pro/Enterprise only; trace drains accept OTLP/HTTP only (no gRPC). The linked Vercel team `nicks-projects-128db960` is on the Hobby plan, so no drain can be configured. No Snowflake/Elastic/OTLP endpoint exists for this project.
- PlayCanvas 2.19.0 (https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins): the brief's FPS figures match that post (M4 Max 35 M splats 13.3 -> 75.8 FPS; iPhone 13 Pro Max 4 M splats 20.4 -> 42.4 FPS). They are PlayCanvas's numbers on a photogrammetry splat scene, not this app. The 1,557 MB -> 105 MB heap figure is not in that post and is unverified.
- 3DGS from 3DEP: still not done. Splats would have to be trained from imagery or synthesised from points (isotropic splats with guessed scale/opacity), and the result would be a stylised rendering of the survey, not new detail. A splat renderer would also add PlayCanvas as a second WebGL/WebGPU engine beside MapLibre.

## APPENDIX — automated scan of every file

Columns are pattern counts (scan before fixes). `post` = POST/PUT/DELETE handlers; `secret` = key-shaped literals (0 everywhere).

| file | lines | fetch | timeout | setInterval | clearInterval | addEL | rmEL | raf | caf | any | random | consoleLog | post | dangerHTML | secret |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| .github/workflows/deploy.yml | 35 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| .github/workflows/roster-health.yml | 67 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| .gitignore | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| BUILD_REPORT.md | 509 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EVENT_DRIVEN_SELF_HEALING_BLUEPRINT.md | 115 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| FULL_SYSTEM_AUDIT.md | 102 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| FULL_SYSTEM_AUDIT_REPORT.md | 103 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| LUCID1_HONESTY_PROTOCOL_PLAN.md | 104 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| README.md | 47 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RESEARCH_IMPLEMENTATION_PLAN.md | 61 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/alerts/page.tsx | 174 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/anomalies/page.tsx | 212 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/anomalies/route.ts | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/benchmarks/amc-gpu/route.ts | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/benchmarks/siforest/route.ts | 107 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/competitor-pipelines/route.ts | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/cron/ingest/route.ts | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| app/api/cron/process/route.ts | 53 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| app/api/elections/ops/route.ts | 22 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/fbi/crime/route.ts | 113 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| app/api/fbi/stream/route.ts | 133 | 1 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| app/api/fbi/wanted/route.ts | 57 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| app/api/feeds/count/route.ts | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-camera/route.ts | 32 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-fires/route.ts | 49 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-hydromet/route.ts | 70 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-lidar/route.ts | 33 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-live-markers/route.ts | 379 | 6 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-satellites/route.ts | 52 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-telemetry/recent/route.ts | 57 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-telemetry/route.ts | 265 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ga-traffic/route.ts | 45 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/health/route.ts | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/cards/route.ts | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/probe/route.ts | 216 | 2 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/records/route.ts | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/states/records/route.ts | 116 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/territories/probe/route.ts | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/ingest/territories/records/route.ts | 52 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/lucid1/route.ts | 33 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/manifest/discover/route.ts | 57 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/manifest/queue/route.ts | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/manifest/route.ts | 32 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/manifest/transitions/route.ts | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/metrics/route.ts | 32 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/petitions/sign/route.ts | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 |
| app/api/public-live/route.ts | 242 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/recommendations/route.ts | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/spark/route.ts | 37 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 |
| app/api/super-agents/route.ts | 23 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/system-scan/route.ts | 44 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/telemetry/amc/route.ts | 47 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/telemetry/route.ts | 288 | 0 | 0 | 1 | 2 | 1 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 |
| app/api/telemetry/stream/route.ts | 91 | 0 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/api/tiles/[...path]/route.ts | 53 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| app/benchmarks/page.tsx | 135 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/bot-pipeline/page.tsx | 456 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/county-matrix/page.tsx | 118 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| app/election-sources/page.tsx | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/evidence/page.tsx | 111 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/forensic-telemetry/page.tsx | 244 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/globals.css | 663 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/godseye-telemetry/page.tsx | 138 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/insider-intel/page.tsx | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| app/jurisdiction-cards/page.tsx | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/jurisdiction-records/page.tsx | 27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/layout.tsx | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/methodology/page.tsx | 103 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/page.tsx | 430 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/recommendations-hub/page.tsx | 201 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/reports/page.tsx | 194 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| app/sitemap.ts | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/sources/page.tsx | 376 | 4 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/telemetry.ts | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| app/test-map/page.tsx | 136 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| app/threat-globe/page.tsx | 136 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| app/three-pillars/page.tsx | 159 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| bots/discovery-bot.ts | 98 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/AmbientBackground.tsx | 225 | 0 | 0 | 0 | 0 | 5 | 5 | 3 | 2 | 2 | 8 | 0 | 0 | 0 | 0 |
| components/BuildFreshnessChip.tsx | 63 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/ComplianceNotice.tsx | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/Footer.tsx | 117 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/GeorgiaAggregateTelemetry.tsx | 430 | 3 | 0 | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/GeorgiaUcrStatewide.tsx | 137 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/GodsEyeMap.tsx | 2295 | 0 | 0 | 0 | 0 | 2 | 2 | 4 | 2 | 28 | 0 | 0 | 0 | 0 | 0 |
| components/LidarGlobe.module.css | 434 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/LidarGlobe.tsx | 635 | 0 | 0 | 0 | 0 | 1 | 1 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/LucidMethodologyTrace.tsx | 141 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/MapDebugOverlay.tsx | 318 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| components/MapMenuOverlay.tsx | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| components/Navbar.tsx | 192 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/PageEmblemHeader.tsx | 94 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/PlatformProbe.tsx | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/PublicAdvisoryStream.tsx | 189 | 2 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/PublicLivePanel.tsx | 191 | 1 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/RealTimeSparkline.tsx | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/RealTimeStreamProvider.tsx | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/RotatingHeroEmblem.tsx | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/StateMap.tsx | 970 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 18 | 0 | 5 | 0 | 0 | 0 |
| components/StatewideAnomalyDashboard.tsx | 772 | 0 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/TerritoryCatalogPanel.tsx | 975 | 5 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/ThreatGlobe3D.tsx | 463 | 0 | 0 | 0 | 0 | 1 | 1 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/VitalsProbe.tsx | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/WhiteHouseDigitalTwin3D.tsx | 670 | 0 | 0 | 1 | 1 | 0 | 0 | 5 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| components/WhiteHouseReal3DViewer.tsx | 84 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/ambient-store.ts | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/election-sources/ElectionSourcesPanel.tsx | 320 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/fbi/FbiDataSection.tsx | 967 | 2 | 0 | 3 | 3 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| components/jurisdiction-cards/JurisdictionCardGrid.tsx | 209 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/jurisdiction-records/JurisdictionRecordList.tsx | 143 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hooks/useAnomalyStream.ts | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 1 | 0 | 0 | 0 | 0 |
| hooks/useSSE.ts | 81 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hooks/useTelemetryCanvas.ts | 36 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hooks/useTelemetryStream.ts | 73 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| k8s/keda-redis-scaler.yaml | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/adapters/jurisdictions.ts | 167 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/adapters/state-datasets.ts | 423 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/adapters/territories.ts | 27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/adaptive-telemetry-encoder.ts | 123 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/adapts.ts | 130 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/addaeil.ts | 94 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/anomaly-detector.ts | 84 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/anomaly-surfaces.ts | 49 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/arcus.ts | 108 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/autonomous-agents.ts | 106 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/autosad.ts | 96 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/competitor-pipeline.ts | 96 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| lib/competitor-pipelines.ts | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/arcgis.ts | 87 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/bls.ts | 140 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/ckan.ts | 84 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/csv.ts | 150 | 2 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/doj.ts | 138 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/epa-echo.ts | 100 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/fbi-cde.ts | 68 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/fema.ts | 71 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/index.ts | 54 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/sec-edgar.ts | 80 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/socrata.ts | 91 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/connectors/worldbank.ts | 61 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| lib/cron-auth.ts | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/data.ts | 585 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/dess.ts | 68 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/deterministic-telemetry.ts | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/disney-live.ts | 259 | 1 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/change-store.ts | 125 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/directory-drift.ts | 77 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/eavs-2024-registration.ts | 408 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/election-offices.ts | 86 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/entity-name-verifier.ts | 74 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/myers-diff.ts | 114 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/noncitizen-voting-cases.ts | 146 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/ops.ts | 158 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/page-fingerprint.ts | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/probe-runner.ts | 144 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/probe-telemetry.ts | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/registration-2026.ts | 62 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/registration.ts | 68 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/source-health-store.ts | 75 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/source-health.ts | 196 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/source-probe-policy.ts | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/source-reliability.ts | 69 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/elections/types.ts | 57 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/executive-pillar-intel.ts | 195 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/fbi-skills-catalog.ts | 175 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-anomaly-bulbs.ts | 331 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-beacon-categories.ts | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-change-layer.ts | 243 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-company-profiles.json | 1598 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-competitors.ts | 556 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| lib/ga-deck-overlay.ts | 844 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| lib/ga-fbi-feed.ts | 69 | 2 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-fires/parse.ts | 84 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-h3-telemetry.ts | 173 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-hydromet-layer.ts | 181 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-hydromet/normalize.ts | 112 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-lidar-layer.ts | 477 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-lidar/ept.ts | 350 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-lidar/laz.ts | 49 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-lidar/projects.json | 777 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-live-markers-layer.ts | 496 | 2 | 2 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-live-markers/parse.ts | 592 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-live-markers/snapshot.ts | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-live-status.ts | 150 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-marker-icons.ts | 129 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-marker-scale.ts | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-mesh-models.ts | 236 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-orbital-layer.ts | 306 | 2 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-patrol-3d.ts | 614 | 2 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| lib/ga-point-colors.ts | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-satellites/tle.ts | 87 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-telemetry/aggregate.ts | 117 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-telemetry/models.ts | 207 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-traffic-layer.ts | 162 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-traffic/normalize.ts | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-ucr/summarize.ts | 120 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/ga-wall-3d.ts | 517 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/geojson-vt-protocol.ts | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 |
| lib/godseye-layers.ts | 396 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/gpu-privacy.ts | 58 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/isolation-forest.ts | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| lib/isolation-tree.ts | 68 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| lib/jurisdiction-cards/outliers.ts | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/jurisdiction-cards/pipeline.ts | 333 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/jurisdiction-cards/reference.ts | 62 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/jurisdiction-cards/types.ts | 88 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/jurisdiction-records/records.ts | 88 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/kafka-partition-router.ts | 52 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/lidar-globe-sources.ts | 88 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/lucid1-honesty-protocol.ts | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/manifest/store.ts | 490 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/manifest/types.ts | 186 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| lib/map-8k-export.ts | 82 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/metrics/prometheus.ts | 73 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/nsa-super-agent-protocol.ts | 94 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/page-hinckley.ts | 71 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/provenance-norm.ts | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/provenance.ts | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/public-live/jurisdictions.ts | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/public-live/laus-latest.json | 3232 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/recommendation-engine.ts | 161 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/recommendation-matrix.ts | 847 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/recommendations-catalog.ts | 39129 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/schema.ts | 81 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/siforest.ts | 130 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/sky-photo.ts | 187 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/sources/expanded-p1-sources.ts | 62 | 5 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/spark-llm.ts | 74 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| lib/starfield/index.js | 348 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| lib/statewide-anomalies.ts | 135221 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/streaming-isolation-forest.ts | 161 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| lib/telemetry-arcs.ts | 182 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-catalog.ts | 308 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-renderer.ts | 121 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-ring-buffer.ts | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-store.ts | 171 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-stream-engine.ts | 268 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/telemetry-upgrade-models.ts | 197 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/territory-catalog.ts | 139 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/webgpu-amc-compute.ts | 62 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lib/whitehouse-digital-twin.ts | 288 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| next-env.d.ts | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| next.config.js | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| package.json | 63 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| postcss.config.mjs | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| public/maplibre-gl-shared.mjs | 6 | 1 | 3 | 0 | 0 | 2 | 1 | 1 | 0 | 0 | 1 | 9 | 0 | 0 | 0 |
| public/maplibre-gl-starfield.mjs | 348 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| public/maplibre-gl-worker.mjs | 9 | 2 | 10 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 1 | 9 | 0 | 0 | 0 |
| public/workers/ambient.worker.js | 159 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 8 | 0 | 0 | 0 | 0 |
| scripts/build-company-profiles.py | 269 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/build-eavs-registration.py | 53 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/build-ga-lidar-index.mjs | 29 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| scripts/build-ga-roads.py | 98 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/build-ga-ucr-snapshot.ts | 99 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |
| scripts/build-ga-wall.py | 152 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/build-infra-advisories.mjs | 215 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 |
| scripts/build-laus-snapshot.mjs | 55 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| scripts/ga_change/README.md | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/ga_change/detect.py | 439 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/ga_change/prithvi_mae.py | 767 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/ga_change/requirements.txt | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scripts/probe-elections.ts | 104 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| scripts/verify-cards.mjs | 75 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |
| tailwind.config.js | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/elections/myers-diff.test.ts | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/elections/probe.test.ts | 162 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/elections/registration-cases.test.ts | 95 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-fires/parse.test.ts | 43 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-hydromet/normalize.test.ts | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-lidar/ept.test.ts | 129 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-live-markers/cameras.test.ts | 62 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-live-markers/e911.test.ts | 75 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-live-markers/infra.test.ts | 59 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-live-markers/parse.test.ts | 140 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-live-markers/snapshot.test.ts | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-satellites/tle.test.ts | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-telemetry/aggregate.test.ts | 44 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-telemetry/models.test.ts | 53 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-traffic/normalize.test.ts | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/ga-ucr/summarize.test.ts | 54 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/map/sky-photo.test.ts | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/map/static-assets.test.ts | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/metrics/prometheus.test.ts | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tests/public-live/coverage.test.ts | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tsconfig.json | 42 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| vercel.json | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Addendum: Gaussian splats, WebGPU, WebXR, metric count

| Item | Status | Evidence |
| --- | --- | --- |
| LiDAR -> Gaussian conversion (`lib/ga-lidar/gaussian.ts`) | Added. One isotropic Gaussian per point, kNN(3) scale, SH DC colour. Not trained. | `tests/ga-lidar/gaussian.test.ts` (3 tests) |
| `/lidar-splat` viewer (`components/LidarSplatViewer.tsx`) | Added; PlayCanvas 2.23.0, WebGPU then WebGL2 | Local prod build: 1,188,568 Gaussians, renderer webgl2 (WebGPU adapter refused), ~10 FPS SwiftShader, 0 errors |
| WebXR immersive-vr | Button wired to `CameraComponent.startXr`, gated on `XrManager.isAvailable` | VM browser: not available. Headset path unverified |
| WebGPU rendering | Requested first by `createGraphicsDevice` | Not exercised: VM has no GPU adapter |
| RUM: `gaussian_splats_drawn`, `gaussian_splat_webgpu_ratio` | Added | `tests/metrics/rum.test.ts` |
| "7,000 metrics" | Not done. 24 metric families; 52 production series before change | `curl /api/metrics` |
| Runbook claims (PlayCanvas FPS table, 1,557 MB -> 105 MB heap, wall-widening spec) | Not adopted; third-party or out of scope | see FINAL_REPORT section 3 |

## Addendum: smaller LiDAR points

| Item | Change | Evidence |
| --- | --- | --- |
| Map LiDAR point diameter (`lib/ga-lidar-layer.ts`) | 0.7x -> 0.45x projected node spacing; min 1.5 -> 1 CSS px; caps 10 -> 6 (desktop), 4 -> 3 (touch) | CDP before/after on /threat-globe ATL STREET LIDAR |
| Map LiDAR depth | +1 octree level on desktop only; 5 M desktop / 2.5 M touch budgets unchanged | `window.__gaLidar.targetDepth` |
| Splat sigma (`components/LidarSplatViewer.tsx`, `lib/ga-lidar/gaussian.ts` `sizeFactor`) | 1.0x -> 0.4x mean 3-NN distance, clamp 0.08-1.5 m -> 0.03-0.6 m | `tests/ga-lidar/gaussian.test.ts` |
| Attachment claims (SHARP-GS 8K 250 FPS, 562 MB -> 13.6 MB, StreamingGS 45.7x, wall widening) | Not adopted: third-party results on other scenes/hardware, or out of scope | FINAL_REPORT section 3 |

## Addendum: Gaia GPS App Store extract and "Gaia Mirror" runbook

| Runbook item | Decision | Evidence / reason |
| --- | --- | --- |
| Phase 2: mirror the Gaia GPS App Store page (name, copy, screenshots, reviews, subscription tiers) | Not done | Third-party trademark and copyrighted listing text; reviews are other users' content. Copying them would misrepresent this site as Gaia GPS. |
| Phase 2 functional equivalent: topographic map with trails | Added: TOPO basemap on /godseye-telemetry (`components/GodsEyeMap.tsx` `BASEMAPS.topo`) | USGS The National Map USGSTopo tiles (public domain, cached to z16; z17 returns 404, MapLibre overzooms) + Waymarked Trails hiking overlay (OSM data, CC BY-SA). Existing SATELLITE / TERRAIN / MAP basemaps unchanged. |
| Offline maps, route/waypoint editing, accounts, subscriptions | Not built | Would need storage, auth and a service worker tile cache; no requirement beyond the extract. |
| Phase 3: Mapbox GL JS v3 Standard Satellite, Cesium World Terrain | Not added | Both need a provider access token (Mapbox account / Cesium ion). Existing MapLibre + AWS Terrarium DEM (`setTerrain`, 1.5x) + Esri imagery already provides 3D terrain; not replaced (no-removal rule). |
| "60 FPS desktop and mobile" | Not claimed | Vendor statement about Mapbox, not a measurement of this app. VM renders in software. |
| Phase 4: Vercel Drains (OTLP, Elastic, Snowflake) | Not configured | Drains need Pro/Enterprise; team is on Hobby. |
| Phase 4: WebGPU timestamp queries | Not added | WebGPU path only in /lidar-splat via PlayCanvas; VM has no GPU adapter to verify. WebGL timer (EXT_disjoint_timer_query_webgl2) already covers the map LiDAR pass. |
| Phase 4: gen_ai.* attributes | Not added | `lib/spark-llm.ts` / `app/api/spark` make no model call; they return constants (see U4). There are no LLM spans to annotate. |
| Phase 4: 99.9% multi-window burn rate (1h/5m, 6h/30m, 3d/6h) | Already present | `deploy/prometheus/rules.yml`, promtool OK |
| Phase 4: Core Web Vitals | LCP, INP, CLS present; TTFB and FID not collected | FID is deprecated in favour of INP. TTFB can be added to RUM if wanted. |
| Phase 5: RED metrics, mock-only load test, Kubernetes | Already present | ga_feed_up / duration / source_errors; scripts/perf/mock-fetch.mjs; Helm chart on local kind. Queue depth / consumer lag: no queue exists. |
| Phase 5: Gatling simulation | Not added | Equivalent bounded Node load test already in repo; the "914 req/s, p95 342 ms" target is this app's own earlier local result, not an external benchmark. |

## Addendum: satellite imagery with 3D terrain everywhere on /godseye-telemetry

| Item | Decision | Evidence / reason |
| --- | --- | --- |
| Satellite + 3D terrain by default | Done: `BASEMAPS.satellite` (the initial style) now carries the AWS Terrarium `terrain-dem` source and `terrain: { exaggeration: 1.5 }` | Before, the default SATELLITE view was a flat draped image (user screenshots, build 73730d1). Local CDP, 390x844 touch viewport: `getTerrain()` = `{source:'terrain-dem', exaggeration:1.5}` on load; `queryTerrainElevation` at 34.74N, -84.11W (Blue Ridge) = 1128 m (exaggerated). |
| SATELLITE and TOPO switching | Done: `switchBasemap` no longer calls `setTerrain(null)` for these; it re-applies terrain after `setStyle` | CDP: TOPO -> terrain on, 53 layers; SATELLITE -> terrain on, 52 layers (same layer counts as before the change, so no overlay lost). |
| Existing controls | Kept | TERRAIN, MAP, 2D and STREET LIDAR unchanged. 2D still turns terrain off on request (user-initiated). |
| Street LiDAR on terrain | Verified | `lib/ga-lidar-layer.ts` already lifts points onto `queryTerrainElevation` + height above ground. CDP downtown Atlanta z18 pitch 75 with terrain: status ready, 2,485,759 points, 0 errors (touch budget 2.5 M). |
| U: scale bar reads "NaN ft" at street zoom + steep pitch with terrain | Not fixed | MapLibre 6 `ScaleControl` unprojects the bottom of the canvas; with terrain at pitch 75 that point can miss the surface. Upstream behaviour; cosmetic. |
| U: blur near the horizon on phones | Not fixed | Steep-pitch texture stretch is inherent to draped raster imagery; terrain does not add imagery resolution. Esri World Imagery is the source (z21 max). |
| Mapbox Standard Satellite / Cesium World Terrain / Google Photorealistic 3D Tiles | Not added | All need a provider account key and billing; not available. |
| "+7000 telemetry" | Not added | No new measured quantity came with this change; metric families stay at the finite measured set. |

## Addendum: zoom-in crash on phones, and 3D-only maps

| Item | Decision | Evidence / reason |
| --- | --- | --- |
| C: map crashes after zooming in on a phone (user report) | Mitigated, not reproduced | The VM's software Chrome did not crash at z18 pitch 75 with terrain + 2.49 M LiDAR points. Likely cause on phones: GPU memory. At DPR 3 the WebGL map canvas was full device resolution with MSAA, plus a second WebGL context holding the 8K (8192x4096) star map, plus LiDAR buffers. |
| Touch canvas pixel ratio | `mapPixelRatio()` caps the map and sky canvases at 2x on touch devices; desktop unchanged | CDP, 390x844 viewport at DPR 3, touch: canvas 740x1492 (pixel ratio 2) instead of 1110x2238, about 56% fewer pixels per frame buffer. |
| Touch antialiasing | `antialias: !isTouchDevice()` | MSAA multiplies the framebuffer memory; off on touch only. |
| Touch star map | 4K star map on touch devices, 8K on desktop | 8K RGBA texture is about 128 MB of GPU memory before mipmaps. |
| LiDAR point size | `uMaxPx`/`uMinPx` now scale by `map.getPixelRatio()` instead of `window.devicePixelRatio` | Keeps dot size in CSS px the same when the canvas pixel ratio is capped. CDP after change: 2,007,635 points loading, 0 errors. |
| 2D button (GodsEYE), 2D/3D toggle (home map), 3D TERRAIN toggle (/threat-globe) | Removed at the user's explicit instruction ("remove 2d layer only show new 3d for all mapps") | Terrain is now always on. LIGHT basemap on GodsEYE re-adds `terrain-dem` after its style loads (CDP: terrain on, 59 layers). Home `StateMap` satellite style now has AWS Terrarium terrain and opens at pitch 55 (CDP: terrain on). HILLSHADE, buildings and all live layers are unchanged. |
| U: real-phone verification | Not done | No physical phone or GPU on this VM. |

## Addendum: OPERATION MAP HARDEN brief (MapLibre memory, context loss, dense layers)

| Item | Decision | Evidence / reason |
| --- | --- | --- |
| Upgrade the map library | Done: `maplibre-gl` 6.11.2 -> 6.13.0; `public/maplibre-gl-worker.mjs` and `-shared.mjs` replaced from the package (6.13 worker is self-contained; `tests/map/static-assets.test.ts` checks the version) | MapLibre changelog: 6.12.0 fixes GeoJSONSource memory growth "until the page crashed" when `setData` outpaces the worker, terrain gestures, cheaper terrain elevation reads, and render failures when context loss precedes the event; 6.13.0 fixes stale cached workers crashing maps after an upgrade and the camera going under terrain on scroll zoom into mountains. 6.14.0 (setStyle/ScaleControl fixes) was published 2026-10-11 and is not adopted yet (too new to vet). Mapbox GL JS items in the brief do not apply: the repo uses MapLibre. |
| Stale worker after upgrade | Worker URL is versioned: `setWorkerUrl('/maplibre-gl-worker.mjs?v=' + getVersion())` in GodsEyeMap, StateMap, LidarGlobe, test-map | The site's service worker and CDN can serve the previous worker file; a version query makes a 6.13 page fetch the 6.13 worker. |
| Tile cache cap | `maxTileCacheZoomLevels: 3` on touch devices (MapLibre default 5); desktop unchanged | Fewer off-screen tiles (imagery + DEM + vector) held in GPU memory on phones. CDP: `_maxTileCacheZoomLevels` = 3 at 390x844 touch. |
| WebGL context loss on the GodsEYE map | MapLibre already calls `event.preventDefault()` and restores its style, but drops custom layers. Added: `webglcontextlost` shows "Graphics memory ran out. Restoring the map…" and counts the loss; `webglcontextrestored` re-runs `addMapLayers` on `style.load` (wall, LiDAR, patrol, all overlays); the LiDAR hook now waits for `style.load` | CDP, forced loss with `WEBGL_lose_context`: before 52 layers + 3 custom layers; lost -> 0 custom layers, overlay shown, `__gaGpu.contextLost` 1; restored -> 52 layers, `ga-wall-3d`, `ga-lidar-3d`, `ga-patrol-3d` back, overlay gone, 0 console errors. The first attempt (re-adding on `styledata`) logged "Style is not done loading"; fixed by waiting for `style.load`. |
| Metric `webgl_context_losses` | Added to RUM and `/api/metrics` (sum of losses reported in the last 5 min per page/device) | Unit test in `tests/metrics/rum.test.ts`. Same per-instance RUM limitation as the other browser metrics. |
| Probe canvas | Already done | The WebGL2 limits probe calls `WEBGL_lose_context.loseContext()` immediately after reading limits. |
| Pause rendering when hidden | Already covered | Custom rAF loops (sky, ambient background, metrics probe) use `requestAnimationFrame`, which browsers stop in hidden tabs; orbital layer and ThreatGlobe3D also check visibility. |
| DOM markers -> GPU layers, icon atlas | Already done | No `maplibregl.Marker` in the map components; live markers are deck.gl Icon layers with a pre-built atlas (`lib/ga-marker-icons.ts`). |
| Supercluster tuning, VideoSource leaks, GPU aggregation >100K | Not applicable | Supercluster and video sources are not used; no layer has more than ~43K features (OSM snapshot). |
| WebGPU `GPUDevice.lost` | Not changed | Only `/lidar-splat` (PlayCanvas) uses WebGPU; the maps are WebGL2. |
| One WebGL context per page | Not done | GodsEYE uses the map, the sky canvas and the deck.gl overlay (3 contexts). Merging them is a large refactor; risk recorded. |
| VRAM, tile cache bytes, overdraw | Not measured | Browsers expose no GPU memory API; MapLibre exposes no cache byte count. |
| U: `[StateMap Diagnostic] Error querying features` on the home page | Not fixed (pre-existing) | Same error on production (6.11.2) before this change: `getFilter('ally-outline')` runs before the layer exists. Logged by a try/catch; no visible effect. |
| U: real-phone verification | Not done | No physical phone or GPU on this VM. |

## Addendum: OSINT4ALL feeds, search bar, anomaly-report format (2026-10-14)

| Item | Finding / change | Evidence |
|---|---|---|
| OSINT4ALL source access | Live `start.me/p/L1rEYQ` returns a Cloudflare challenge; not bypassed. Wayback JSON (`20260721182214`) used: 79 widgets, 1,456 links | `curl` title "Just a moment..."; gunzipped archive parsed |
| U: catalog count | Attachment: 77 groups / 1,446 canonical resources; archive: 79 widgets / 1,456 placements | Not reconciled; recorded as uncertainty |
| Candidate triage | Person/phone/email/username/social lookups rejected (person-level). FlightAware, Flightradar24, MarineTraffic, VesselFinder need paid keys or forbid scraping. Directories and static maps have no feed | Catalog groups inspected: WEATHER, FLIGHT TRACKER, MARITIME, IoT, RADIO, MAPS, GEO |
| Added layer `pireps` | NOAA AWC `api/data/pirep` GeoJSON, Georgia bbox, age 6 h, TTL 300 s; `parseAwcPireps` keeps type, altitude, turbulence, icing, sky, temperature, wind, raw report; urgent (UUA) flagged | Endpoint HTTP 200, 18 features; `tests/ga-live-markers/pireps.test.ts` |
| Not added: OSM generic surveillance | `node["man_made"="surveillance"]` over Georgia: overpass-api.de HTTP 504 after 27 s; private.coffee no answer in 90-100 s (twice) | Existing OSM query and snapshot unchanged |
| Not added: NHC storms | `CurrentStorms.json` verified, but live markers are clipped to the Georgia wall ring | Would show nothing unless a storm is inside Georgia |
| Not added: METAR | Same airports as the IEM `GA_ASOS` stations layer | Duplicate |
| Search bar | Input full width on phones, 16 px font (stops iOS focus zoom), `type=search`, live filter after 0.4 s, source-name matching on `/api/fbi-osint`; phones get the card list instead of the wide table | `tsc`, tests, build |
| Anomaly-report format / 53,000 generator | Not implemented: fabricated espionage records with ethnic labels, real institutions, phone/bank/location data and charges | Data rule: only real, sourced records |
