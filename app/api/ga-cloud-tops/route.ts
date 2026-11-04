import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { sampleCloudTops, type CloudTopGrid, type FixedGrid, type GeosProjection } from "../../../lib/ga-goes-clouds/cloud-tops";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GOES-19 (GOES East) ABI L2 Cloud Top Height, CONUS sector, NOAA Open Data Dissemination on AWS. */
const BUCKET = "https://noaa-goes19.s3.amazonaws.com";
const PRODUCT = "ABI-L2-ACHAC";
const DOCS = "https://registry.opendata.aws/noaa-goes/";
/** A new CONUS scan lands every 5 minutes. */
const TTL_MS = 2 * 60_000;
const GOOD_QUALITY = 0;

let cache: { at: number; body: Record<string, unknown> } | null = null;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function hourPrefix(t: Date): string {
  const day = Math.floor((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
  return `${PRODUCT}/${t.getUTCFullYear()}/${pad(day, 3)}/${pad(t.getUTCHours())}/`;
}

async function latestKey(): Promise<string> {
  for (let back = 0; back < 3; back++) {
    const prefix = hourPrefix(new Date(Date.now() - back * 3_600_000));
    const r = await fetch(`${BUCKET}/?list-type=2&prefix=${encodeURIComponent(prefix)}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!r.ok) throw new Error(`S3 list HTTP ${r.status}`);
    const keys = [...(await r.text()).matchAll(/<Key>([^<]+\.nc)<\/Key>/g)].map((m) => m[1]).sort();
    if (keys.length) return keys[keys.length - 1];
  }
  throw new Error(`no ${PRODUCT} file in the last 3 hours`);
}

type Attrs = Record<string, { value: unknown }>;
const num = (attrs: Attrs, k: string): number => {
  const v = attrs[k]?.value as unknown;
  const n = Number(ArrayBuffer.isView(v) || Array.isArray(v) ? (v as ArrayLike<number>)[0] : v);
  if (!Number.isFinite(n)) throw new Error(`missing attribute ${k}`);
  return n;
};

async function load(): Promise<Record<string, unknown>> {
  const key = await latestKey();
  const r = await fetch(`${BUCKET}/${key}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) throw new Error(`S3 HTTP ${r.status} (${key})`);
  const path = join(tmpdir(), `acha-${randomUUID()}.nc`);
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
  const { default: h5wasm } = await import("h5wasm/node");
  await h5wasm.ready;
  const f = new h5wasm.File(path, "r");
  try {
    const ds = (name: string) => {
      const d = f.get(name);
      if (!d || !("value" in d)) throw new Error(`missing variable ${name}`);
      return d as unknown as { value: ArrayLike<number>; attrs: Attrs; shape: number[] };
    };
    const ht = ds("HT");
    const dqf = ds("DQF").value;
    const x = ds("x");
    const y = ds("y");
    const projAttrs = ds("goes_imager_projection").attrs;
    const proj: GeosProjection = {
      h: num(projAttrs, "perspective_point_height"),
      a: num(projAttrs, "semi_major_axis"),
      b: num(projAttrs, "semi_minor_axis"),
      lon0: num(projAttrs, "longitude_of_projection_origin"),
    };
    const [ny, nx] = ht.shape;
    const sx = num(x.attrs, "scale_factor");
    const sy = num(y.attrs, "scale_factor");
    const grid: FixedGrid = {
      x0: x.value[0] * sx + num(x.attrs, "add_offset"), dx: (x.value[1] - x.value[0]) * sx,
      y0: y.value[0] * sy + num(y.attrs, "add_offset"), dy: (y.value[1] - y.value[0]) * sy,
      nx, ny,
    };
    const scale = num(ht.attrs, "scale_factor");
    const offset = num(ht.attrs, "add_offset");
    const fill = num(ht.attrs, "_FillValue");
    const raw = ht.value;
    const g: CloudTopGrid = sampleCloudTops((i) => (dqf[i] === GOOD_QUALITY && raw[i] !== fill ? raw[i] * scale + offset : null), grid, proj);
    const gattr = f.attrs as Attrs;
    const measured = g.heightsM.filter((h): h is number => h !== null);
    return {
      generatedAt: new Date().toISOString(),
      source: "NOAA GOES-19 ABI L2 Cloud Top Height (ACHA), CONUS sector, good-quality pixels only",
      sourceUrl: DOCS,
      file: `${BUCKET}/${key}`,
      scanStart: String(gattr.time_coverage_start?.value ?? ""),
      scanEnd: String(gattr.time_coverage_end?.value ?? ""),
      resolution: String(gattr.spatial_resolution?.value ?? ""),
      heightReference: String(ht.attrs.standard_name?.value ?? ""),
      measuredVertices: measured.length,
      minM: measured.length ? Math.min(...measured) : null,
      maxM: measured.length ? Math.max(...measured) : null,
      grid: g,
    };
  } finally {
    f.close();
    void unlink(path).catch(() => {});
  }
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await load() };
  } catch (e) {
    if (!cache) return NextResponse.json({ error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, { status: 502 });
  }
  return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
