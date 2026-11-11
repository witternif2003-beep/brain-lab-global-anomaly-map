import { NextResponse } from "next/server";
import { parseStateEstimate, type StateEstimate } from "../../../lib/ga-census-density";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Census publishes a new vintage each December; the newest file that exists is the current official estimate. */
const vintageUrl = (y: number) => `https://www2.census.gov/programs-surveys/popest/datasets/2020-${y}/state/totals/NST-EST${y}-ALLDATA.csv`;
const TTL_MS = 6 * 60 * 60_000;
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)" };

let cache: { at: number; body: StateEstimate & { vintage: number; sourceUrl: string; retrievedAt: string } } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.body);
  const errors: string[] = [];
  for (let y = new Date().getUTCFullYear(); y >= 2024; y--) {
    const url = vintageUrl(y);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: HEADERS, cache: "no-store" });
      if (!r.ok) {
        errors.push(`${y}: HTTP ${r.status}`);
        continue;
      }
      const body = { ...parseStateEstimate(await r.text(), "13"), vintage: y, sourceUrl: url, retrievedAt: new Date().toISOString() };
      cache = { at: Date.now(), body };
      return NextResponse.json(body);
    } catch (e) {
      errors.push(`${y}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ error: `Census population estimates unavailable (${errors.join("; ")})` }, { status: 502 });
}
