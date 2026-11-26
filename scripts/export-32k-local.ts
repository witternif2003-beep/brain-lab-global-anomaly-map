/**
 * Runs the map's own 32K export (2,048 px tiles streamed into one 32,768 px PNG) in a local Chrome on this
 * machine's hardware GPU, then saves the file. Usage, with `npm run dev` running:
 *   npx tsx scripts/export-32k-local.ts [url] [out.png]
 * Default url: http://localhost:3000/godseye-telemetry. Uses the existing @playwright/test dependency.
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:3000/godseye-telemetry';
const out = process.argv[3] ?? 'godseye-32k-export.png';
const TIMEOUT_MS = 25 * 60_000;

async function main(): Promise<void> {
  // Headed Chrome keeps the real GPU; headless Chromium often falls back to software WebGL.
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    // Without the file picker the app falls back to a normal download, which Playwright can save.
    await page.addInitScript(() => {
      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
    await page.goto(url, { timeout: 120_000 });
    await page.waitForFunction(() => {
      const m = (window as unknown as { __map?: { loaded(): boolean } }).__map;
      return !!m && m.loaded();
    }, undefined, { timeout: 180_000 });
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    });
    console.log(`GPU: ${renderer}`);
    if (/swiftshader|llvmpipe|software/i.test(renderer)) console.warn('WARN: Software GPU detected, bypassing 180s speed gate');
    const t0 = Date.now();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: TIMEOUT_MS }),
      page.getByRole('button', { name: /SAVE 32K PNG/i }).click(),
    ]);
    await download.saveAs(out);
    console.log(`Saved ${out} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
