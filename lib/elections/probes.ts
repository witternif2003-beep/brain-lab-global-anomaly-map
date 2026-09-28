/**
 * Live probes of official election-office websites.
 *
 * Each probe fetches the office URL once: HTTP status, latency, live
 * <title>, sha256 of the visible page text, and a heuristic check that the
 * page names its own jurisdiction. The reliability band is derived ONLY
 * from these observed values. No content is generated or estimated.
 */
import { createHash } from "crypto";
import { makeProvenance } from "../provenance";
import type { ElectionOffice, ReliabilityBand, SiteProbe } from "./types";
import { nameTokensFor } from "./offices";

const PROBE_TIMEOUT_MS = 12000;
const TEXT_CAP = 200000;
const UA = "Mozilla/5.0 (compatible; BrainLab/1.0; +https://brain-lab-six.vercel.app/)";

export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXT_CAP);
}

export function pageTitleOf(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 200) : null;
}

function bandFor(status: number | null, names: boolean | null, latencyMs: number | null): ReliabilityBand {
  if (status === 200 && names && latencyMs !== null && latencyMs < 4000) return "high";
  if (status === 200) return "medium";
  return "low";
}

export async function probeOffice(office: ElectionOffice): Promise<SiteProbe> {
  const checkedAt = new Date().toISOString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(office.officeUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    const latencyMs = Date.now() - started;
    const html = await res.text();
    const text = res.ok ? visibleText(html) : "";
    const lower = text.toLowerCase();
    const tokens = nameTokensFor(office);
    const names = res.ok ? tokens.some((t) => lower.includes(t)) : null;
    const sha = res.ok ? createHash("sha256").update(text).digest("hex") : null;
    return {
      code: office.code,
      url: office.officeUrl,
      httpStatus: res.status,
      latencyMs,
      pageTitle: res.ok ? pageTitleOf(html) : null,
      sha256VisibleText: sha,
      visibleTextChars: res.ok ? text.length : null,
      namesJurisdiction: names,
      band: bandFor(res.status, names, latencyMs),
      checkedAt,
      error: res.ok ? null : `HTTP ${res.status}`,
      provenance: makeProvenance({
        source_id: "OFFICE-PROBE",
        jurisdiction: office.code,
        source_url: office.officeUrl,
        body: text.slice(0, 50000),
        http_status: res.status,
        record_count: 1,
        access_note: "live fetch of official office site; hash covers visible text",
      }),
    };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : "fetch error";
    return {
      code: office.code,
      url: office.officeUrl,
      httpStatus: null,
      latencyMs,
      pageTitle: null,
      sha256VisibleText: null,
      visibleTextChars: null,
      namesJurisdiction: null,
      band: "low",
      checkedAt,
      error: msg.slice(0, 200),
      provenance: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Probe many offices with bounded concurrency (serial batches of 6). */
export async function probeOffices(offices: ElectionOffice[]): Promise<SiteProbe[]> {
  const out: SiteProbe[] = [];
  for (let i = 0; i < offices.length; i += 6) {
    const batch = await Promise.all(offices.slice(i, i + 6).map((o) => probeOffice(o)));
    out.push(...batch);
  }
  return out;
}
