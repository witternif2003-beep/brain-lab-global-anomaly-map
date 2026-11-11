/**
 * Rebuilds data/opencellid/ga-cells.csv.gz: Georgia-box rows of OpenCelliD's US exports (MCC 310-314), the app's fallback when the daily download is unavailable.
 * Usage: OPENCELLID_KEY=... npx tsx scripts/build-ga-opencellid.ts   or   npx tsx scripts/build-ga-opencellid.ts <dir with 310.csv.gz ...>
 * Each export file may be downloaded twice a day (https://wiki.opencellid.org/docs/getting-started/access-and-limits).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { GA_BBOX } from "../lib/ga-live-markers/parse";

const MCCS = [310, 311, 312, 313, 314];
const dir = process.argv[2];

async function exportFile(mcc: number): Promise<Buffer> {
  if (dir) return readFileSync(path.join(dir, `${mcc}.csv.gz`));
  const key = process.env.OPENCELLID_KEY;
  if (!key) throw new Error("set OPENCELLID_KEY or pass a directory of downloaded exports");
  const r = await fetch(`https://opencellid.org/ocid/downloads?token=${encodeURIComponent(key)}&type=mcc&file=${mcc}.csv.gz`);
  const b = Buffer.from(await r.arrayBuffer());
  if (!r.ok || b[0] !== 0x1f || b[1] !== 0x8b) throw new Error(`MCC ${mcc}: download refused (HTTP ${r.status})`);
  return b;
}

async function main() {
const rows: string[] = [];
for (const mcc of MCCS) {
  for (const line of gunzipSync(await exportFile(mcc)).toString("utf8").split("\n")) {
    const c = line.split(",");
    const lon = Number(c[6]);
    const lat = Number(c[7]);
    if (lon >= GA_BBOX.west && lon <= GA_BBOX.east && lat >= GA_BBOX.south && lat <= GA_BBOX.north) rows.push(line);
  }
}
const header = `# OpenCelliD US exports (MCC ${MCCS.join(",")}) filtered to the Georgia box; retrieved ${new Date().toISOString()}; Cell tower data from OpenCellID (https://opencellid.org), CC BY-SA 4.0\n`;
const out = path.join(process.cwd(), "data/opencellid/ga-cells.csv.gz");
writeFileSync(out, gzipSync(header + rows.join("\n") + "\n", { level: 9 }));
console.log(`${rows.length} rows -> ${out}`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
