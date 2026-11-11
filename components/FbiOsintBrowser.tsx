"use client";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { OsintIndicator } from "../lib/fbi-osint/parse";
import type { OsintSourceStatus } from "../lib/fbi-osint/load";


const REFRESH_MS = 5 * 60_000;

interface Payload { fetchedAt: string; total: number; available: number; matched: number; offset: number; sources: OsintSourceStatus[]; items: OsintIndicator[]; error?: string }

function ago(iso: string | null, now: number): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 2880 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
}

/** Searchable, auto-refreshing list of public FBI-relevant OSINT indicators (shared by /fbi-osint and the GodsEYE popup). */
export default function FbiOsintBrowser({ compact = false, onMeta, country = null, onClearCountry }: { compact?: boolean; onMeta?: (m: { total: number; available: number; fetchedAt: string }) => void; country?: { cc: string; name: string } | null; onClearCountry?: () => void }) {
  const PAGE = compact ? 100 : 200;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ offset: String(page * PAGE), limit: String(PAGE), source });
      if (query) sp.set("q", query);
      if (country) sp.set("cc", country.cc);
      const res = await fetch(`/api/fbi-osint?${sp}`, { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      onMeta?.({ total: json.total, available: json.available, fetchedAt: json.fetchedAt });
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, [page, source, query, PAGE, onMeta, country]);

  useEffect(() => setPage(0), [country]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      if (next !== query) { setQuery(next); setPage(0); }
    }, 400);
    return () => clearTimeout(t);
  }, [q, query]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const pages = data ? Math.max(1, Math.ceil(data.matched / PAGE)) : 1;
  const label = (id: string) => data?.sources.find((s) => s.id === id)?.label ?? id;

  const panel = compact ? "rounded-xl border border-white/10 bg-[#020b18]/40" : "glass-panel border border-white/10 rounded-2xl shadow-xl";
  return (
    <div className="space-y-3 font-mono">
      <div className={`${panel} p-3`}>
        <div className={`grid gap-2 ${compact ? "sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto pr-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {(data?.sources ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => { setSource(source === s.id ? "all" : s.id); setPage(0); }}
              className={`text-left rounded-xl border px-3 py-2 text-[11px] transition-all ${source === s.id ? "border-[#38bdf8] bg-[#38bdf8]/10" : "border-white/10 hover:border-white/30"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.error ? "bg-red-400" : "bg-emerald-400"}`} />
                <span className="font-bold text-white">{s.label}</span>
                <span className="ml-auto font-black text-white">{s.shown.toLocaleString()}</span>
              </div>
              {!compact && (
                <div className="text-[#94a3b8] mt-0.5">
                  {s.publisher} · {s.why}
                </div>
              )}
              <div className={s.error ? "text-red-400 mt-0.5" : "text-[#64748b] mt-0.5"}>
                {s.error ? `feed error: ${s.error}` : `${s.available.toLocaleString()} available · newest ${ago(s.newest, now)}`}{" "}
                <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#38bdf8] underline">source</a>
              </div>
            </button>
          ))}
        </div>
        <form
          role="search"
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(0); }}
        >
          <input
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Filter indicators"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search malware, CVE, group, source…"
            className="w-full sm:w-auto sm:flex-1 min-w-0 bg-[#020b18] border border-white/15 rounded-lg px-3 py-1.5 text-base sm:text-xs text-white placeholder:text-[#64748b] outline-none focus:border-[#38bdf8]"
          />
          <button className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-[#38bdf8] text-[#0b1320] text-xs font-bold">FILTER</button>
          <button type="button" onClick={() => void load()} className="flex-1 sm:flex-none justify-center px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
          </button>
        </form>
      </div>

      {country && (
        <div className="flex items-center gap-2 text-[11px] text-[#f472b6]">
          <span className="rounded-full border border-[#f472b6]/60 px-2 py-0.5">country: {country.name} ({country.cc})</span>
          <span className="text-[#94a3b8]">IP hosting country or ransomware victim country</span>
          <button type="button" onClick={onClearCountry} className="underline text-[#38bdf8]">show all</button>
        </div>
      )}
      {error && <div className="text-red-400 text-xs">Feed error: {error}</div>}

      <div className={`${panel} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-[#94a3b8] border-b border-white/10">
          <span>
            {data ? `${data.matched.toLocaleString()} matching · rows ${(data.matched ? data.offset + 1 : 0).toLocaleString()}–${Math.min(data.offset + PAGE, data.matched).toLocaleString()}` : "loading…"}
          </span>
          <span className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2 py-0.5 rounded border border-white/15 disabled:opacity-30">PREV</button>
            page {page + 1} / {pages}
            <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="px-2 py-0.5 rounded border border-white/15 disabled:opacity-30">NEXT</button>
          </span>
        </div>
        {(
          <ul className="sm:hidden list-none m-0 p-0 divide-y divide-white/5 text-[11px]">
            {(data?.items ?? []).map((i) => (
              <li key={i.id} className="px-3 py-1.5">
                <div className="text-white break-all">{i.value}</div>
                <div className="text-[#94a3b8]">
                  {ago(i.seenAt, now)} · <span className="text-[#38bdf8]">{i.source}</span> · {i.kind}
                  {i.cc && <span className="text-[#f472b6]"> · {i.cc}</span>}
                  {i.ref && (
                    <a href={i.ref} target="_blank" rel="noreferrer noopener" className="text-[#38bdf8] ml-1 inline-flex align-middle" title="Open the publisher's record">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {i.threat && <div className="text-[#64748b]">{i.threat}</div>}
              </li>
            ))}
          </ul>
        )}
        <div className={compact ? "hidden sm:block overflow-auto max-h-[45vh]" : "hidden sm:block overflow-x-auto"}>
          <table className="w-full text-[11px]">
            <thead className={`text-[#64748b] text-left ${compact ? "sticky top-0 bg-[#070e1c]/90" : ""}`}>
              <tr>
                <th className="px-3 py-1.5">SEEN</th>
                <th className="px-3 py-1.5">SOURCE</th>
                <th className="px-3 py-1.5">TYPE</th>
                <th className="px-3 py-1.5">INDICATOR</th>
                <th className="px-3 py-1.5">CC</th>
                <th className="px-3 py-1.5">CONTEXT</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((i) => (
                <tr key={i.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-1 whitespace-nowrap text-[#94a3b8]" title={i.seenAt}>{ago(i.seenAt, now)}</td>
                  <td className="px-3 py-1 whitespace-nowrap text-[#38bdf8]">{label(i.source)}</td>
                  <td className="px-3 py-1 whitespace-nowrap text-[#94a3b8]">{i.kind}</td>
                  <td className="px-3 py-1 text-white break-all">{i.value}</td>
                  <td className="px-3 py-1 whitespace-nowrap text-[#f472b6]">{i.cc ?? ""}</td>
                  <td className="px-3 py-1 text-[#94a3b8]">{i.threat}</td>
                  <td className="px-3 py-1">
                    {i.ref && (
                      <a href={i.ref} target="_blank" rel="noreferrer noopener" className="text-[#38bdf8]" title="Open the publisher's record">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
