import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Run:      BASE_URL=http://127.0.0.1:3000 npx playwright test tests/map-render.spec.ts
// Live USGS: NAIP_LIVE=1 ... (slow: ~11 s per 256 px tile when measured)
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const NAIP_LIVE = process.env.NAIP_LIVE === "1";
// Atlanta Midtown, inside the NAIP layer's z11+ range (components/GodsEyeMap.tsx).
const VIEW = { center: [-84.388, 33.781] as [number, number], zoom: 15 };
const NAIP_TILES = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage**";
const PLACEHOLDER = "tests/fixtures/naip-placeholder-tile.png";

test.setTimeout(600_000);
// The VM has no GPU: SwiftShader WebGL, no service worker (it can serve an older build), 1x DPR.
test.use({
  viewport: { width: 1024, height: 700 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

type MapHandle = {
  jumpTo(o: object): void; once(e: string, f: () => void): void; triggerRepaint(): void;
  getLayer(id: string): unknown; isSourceLoaded(id: string): boolean; getZoom(): number;
  getCanvas(): HTMLCanvasElement;
};

test("NAIP 2023 basemap renders", async ({ page }) => {
  let naipRequests = 0;
  await page.route(NAIP_TILES, (route) => {
    naipRequests++;
    return NAIP_LIVE ? route.continue() : route.fulfill({ status: 200, contentType: "image/png", path: PLACEHOLDER });
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  // ?e2e=1 stops per-frame animation loops (lib/static-render.ts) that otherwise block 'idle'.
  await page.goto(`${BASE_URL}/godseye-telemetry?e2e=1`, { waitUntil: "domcontentloaded" });
  const canvas = page.locator("canvas.maplibregl-canvas").first();
  await expect(canvas).toBeVisible({ timeout: 180_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: unknown }).__map), null, { timeout: 180_000 });

  // The basemap bar re-renders with live feeds, so Playwright's "stable" click check never
  // settles; trigger the React handler directly.
  await page.locator("button", { hasText: "NAIP 2023" }).first().evaluate((el: HTMLElement) => el.click());
  await page.evaluate((view) => {
    (window as unknown as { __map: MapHandle }).__map.jumpTo({ center: view.center, zoom: view.zoom, pitch: 0, bearing: 0 });
  }, VIEW);

  const t0 = Date.now();
  await page.waitForFunction(() => {
    const map = (window as unknown as { __map: MapHandle }).__map;
    return Boolean(map.getLayer("naip")) && map.isSourceLoaded("naip");
  }, null, { timeout: 240_000, polling: 1000 });
  const naipMs = Date.now() - t0;

  const idle = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const map = (window as unknown as { __map: MapHandle }).__map;
    const t = setTimeout(() => resolve(false), 120_000);
    map.once("idle", () => { clearTimeout(t); resolve(true); });
    map.triggerRepaint();
  }));
  const idleMs = Date.now() - t0 - naipMs;
  console.log(`mode=${NAIP_LIVE ? "live-usgs" : "placeholder"} naipRequests=${naipRequests} naipLoadedMs=${naipMs} idle=${idle} idleMs=${idleMs}`);
  expect(naipRequests, "NAIP tiles requested").toBeGreaterThan(0);
  expect(idle, "map.on('idle') fired").toBe(true);

  // Read the WebGL canvas inside a render callback (the drawing buffer is not preserved);
  // a full-page screenshot of this page under SwiftShader can exceed the test budget.
  const png = await page.evaluate(() => new Promise<string>((resolve) => {
    const map = (window as unknown as { __map: MapHandle }).__map;
    map.once("render", () => resolve(map.getCanvas().toDataURL("image/png")));
    map.triggerRepaint();
  }));
  writeFileSync("naip-2023-baseline.png", Buffer.from(png.split(",")[1], "base64"));
});
