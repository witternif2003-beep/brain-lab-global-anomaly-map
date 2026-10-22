# Georgia cameras: live-feed research plan

Retrieved 2026-10-19 (UTC). Grades: [A] official primary documentation or the operator's own service, [B] government summary or secondary, [C] vendor or third party, [UNVERIFIED].

## 1. Answer (confidence: high)

Not every camera on the map can show live video. The map has four kinds of camera:

| Layer | What the source publishes | What the map shows |
|---|---|---|
| GDOT traffic cameras (511GA, about 3,900) | Snapshot image refreshed by 511GA every 60 s; HLS video only with a 2-minute token issued by 511ga.org | Verified live snapshot, refreshed every 60 s (same cadence as 511GA) |
| Coastal GA webcams (GEMA list, 4) | Owners' own embeddable players and HLS | Live video in the popup (new layer `webcams`) |
| Speed cameras (OSM) | Location only | Location, "no video published" |
| Plate-reader cameras (OSM) | Location only | Location, "no video published" |

## 2. Evidence

| Claim | Grade | Source | Date |
|---|---|---|---|
| 511GA's own map refreshes each camera picture every 60 s (`data-refresh-rate="60000"`) | A | https://511ga.org/tooltip/Cameras/11359?lang=en | 2026-10-19 |
| 511GA video URLs carry `data-videoauth="true"`; the player first calls `/Camera/GetVideoUrl?imageId=` and appends the returned token | A | https://511ga.org/bundles/map (minified `map` bundle) | 2026-10-19 |
| The token is a JWT valid for 120 s (`iat` 1792420981, `exp` 1792421101) | A | https://511ga.org/Camera/GetVideoUrl?imageId=18769 | 2026-10-19 |
| GDOT HLS without the token returns HTTP 401 | A | https://sfs-msc-pub-lq-01.navigator.dot.ga.gov/rtplive/CHER-CCTV-0043/playlist.m3u8 | 2026-10-19 |
| 7,083 cameras in "GDOT_511_Traffic_Cameras_Updated", all with `rtplive` HLS URLs (token-gated, same hosts) | A | https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_511_Traffic_Cameras_Updated/FeatureServer/0 | 2026-10-19 |
| 1,125 cameras in "GDOT_Live_Traffic_Cameras" list `vss*live.dot.ga.gov` HLS; the layer was last edited 2020-12-29 and the hosts did not answer within 25 s | A (listing) / UNVERIFIED (liveness) | https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0 | 2026-10-19 |
| GEMA lists 4 coastal webcams with public players | A | https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/Coastal_GA_WebCams/FeatureServer/0 (owner `rbagby_gema`) | 2026-10-19 |
| Tybee Beach cam plays 1920×1080 live | C | https://live2.brownrice.com/embed/mousepad1 (desktop CDP: `videoWidth` 1920, `currentTime` advancing) | 2026-10-19 |
| Savannah River Street East is a 1920×1080 HLS stream with `Access-Control-Allow-Origin: *` | C | https://5b5d5bdb0d55e.streamlock.net/live/camera_river-street-east.stream/playlist.m3u8 | 2026-10-19 |
| St. Simons Beach Club cam showed the owner's "upgrading this webcam" notice | C | https://manage.hdrelay.com/webPlayer/iframe/4f5fcb64-95d4-4a1e-883c-2312f33f8fe2 | 2026-10-19 |
| Jekyll Island cam player loads with a live frame and play button | C | https://manage.hdrelay.com/webPlayer/iframe/d19998ec-36a9-4f38-bb8c-c53436cc8c4b | 2026-10-19 |

## 3. Decision on GDOT video

Requesting 511GA's anonymous 2-minute tokens from this app's server, and replaying the streams here, would work around the access control GDOT puts on its video servers (HTTP 401 without a token). It is not done. The map keeps the verified 60-second snapshot, which is what 511GA itself shows until a user presses "Show Video" on 511ga.org.

## 4. Verified routes to more live video

1. Ask GDOT for permission to embed video: 511GA developer programme https://511ga.org/developers/doc or GDOT Office of Traffic Operations.
2. Add more owner-published public webcams (EarthCam, municipal, university, port) only where the owner publishes an embeddable player or open HLS, one by one with liveness checks.
3. Keep the HLS player hls.js 1.7.3 (Apache-2.0, published 2026-09-11) for browsers without native HLS; iOS Safari plays HLS natively.

## 5. Adversarial review

- **Strongest counterargument:** the 511GA token is issued to any anonymous visitor, so relaying it might be seen as acceptable. Counter: GDOT chose to gate the streams; the app would be a third-party rebroadcaster without permission.
- **Least supported claim:** the `vss*live` HLS hosts being retired. They timed out from this VM only; a different network might reach them. Graded UNVERIFIED.
- **Selection bias:** the GEMA list holds 4 coastal cameras; it is not a statewide webcam census.

## 6. What would change this

- GDOT granting embed permission, or publishing a keyless public HLS endpoint.
- A statewide public webcam registry with embeddable players.
