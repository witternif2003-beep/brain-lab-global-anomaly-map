import { decodeEntities } from "./page-fingerprint";
import { MONITOR_USER_AGENT } from "./source-probe-policy";
import { ELECTION_OFFICE_DIRECTORY } from "./election-offices";
import type { ElectionOffice } from "./types";

export interface DirectoryEntry {
  code: string;
  label: string;
  url: string;
}

export interface DirectoryDrift {
  directoryUrl: string;
  fetchedAt: string;
  status: "ok" | "error";
  httpStatus?: number;
  error?: string;
  entryCount: number;
  /** Codes on the directory that are not among the 56 (e.g. freely associated states) */
  outOfScope: DirectoryEntry[];
  /** Pinned roster entries the directory no longer lists */
  missing: string[];
  /** Directory now lists a different URL than the pinned roster */
  changed: Array<{ code: string; pinned: string; live: string }>;
}

const ENTRY = /<a\b[^>]*\bid="([A-Z]{2})"[^>]*\bhref="([^"]+)"[^>]*>([^<]+)<\/a>/g;

export function parseDirectory(html: string): DirectoryEntry[] {
  const out: DirectoryEntry[] = [];
  for (const m of html.matchAll(ENTRY)) {
    out.push({ code: m[1], url: decodeEntities(m[2]).trim(), label: decodeEntities(m[3]).trim() });
  }
  return out;
}

function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

export function compareDirectory(entries: DirectoryEntry[], roster: ElectionOffice[]): Pick<DirectoryDrift, "outOfScope" | "missing" | "changed" | "entryCount"> {
  const live = new Map(entries.map((e) => [e.code, e]));
  const pinned = new Set(roster.map((o) => o.code));
  return {
    entryCount: entries.length,
    outOfScope: entries.filter((e) => !pinned.has(e.code)),
    missing: roster.filter((o) => !live.has(o.code)).map((o) => o.code),
    changed: roster.flatMap((o) => {
      const e = live.get(o.code);
      return e && !sameUrl(e.url, o.url) ? [{ code: o.code, pinned: o.url, live: e.url }] : [];
    })
  };
}

export async function checkDirectoryDrift(roster: ElectionOffice[], fetchImpl: typeof fetch = fetch): Promise<DirectoryDrift> {
  const fetchedAt = new Date().toISOString();
  const base = { directoryUrl: ELECTION_OFFICE_DIRECTORY.url, fetchedAt };
  try {
    const res = await fetchImpl(ELECTION_OFFICE_DIRECTORY.url, {
      headers: { "user-agent": MONITOR_USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store"
    });
    if (!res.ok) {
      return { ...base, status: "error", httpStatus: res.status, error: `HTTP ${res.status}`, entryCount: 0, outOfScope: [], missing: [], changed: [] };
    }
    const entries = parseDirectory(await res.text());
    if (entries.length === 0) {
      return { ...base, status: "error", httpStatus: res.status, error: "directory page had no office links (layout changed?)", entryCount: 0, outOfScope: [], missing: [], changed: [] };
    }
    return { ...base, status: "ok", httpStatus: res.status, ...compareDirectory(entries, roster) };
  } catch (err) {
    return { ...base, status: "error", error: err instanceof Error ? err.message : String(err), entryCount: 0, outOfScope: [], missing: [], changed: [] };
  }
}
