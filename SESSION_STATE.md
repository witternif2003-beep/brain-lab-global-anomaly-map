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

## Next (execute in order)
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
