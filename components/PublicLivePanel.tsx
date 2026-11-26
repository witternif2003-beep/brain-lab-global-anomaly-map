"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";

interface Feed<T> {
  ok: boolean;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  total?: number;
  items: T[];
  note?: string;
  error?: string;
}

interface Alert { event: string; severity: string; headline: string | null; area: string; sent: string; expires: string | null; url: string }
interface Disaster { id: string; type: string; date: string; incident: string; title: string; areas: number; url: string }
interface Quake { mag: number | null; place: string | null; time: string; type: string; url: string }
interface Air { area: string; aqi: number; category: string; pollutant: string; observed: string; agency: string }
interface Jobs { latest: { period: string; rate: number; unemployed?: number; laborForce?: number }; history: { period: string; rate: number }[] }

interface Payload {
  generatedAt: string;
  feeds: { alerts: Feed<Alert>; disasters: Feed<Disaster>; quakes: Feed<Quake>; air: Feed<Air>; jobs: Feed<Jobs> };
}

const REFRESH_MS = 5 * 60_000;
const TICK_MS = 3000;

const ts = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const day = (iso: string) => iso.slice(0, 10);

function tickerLines(p: Payload, name: string): string[] {
  const { alerts, disasters, quakes, air, jobs } = p.feeds;
  const out: string[] = [];
  for (const a of alerts.items) out.push(`NWS • ${a.event.toUpperCase()} • ${a.area}`);
  for (const q of quakes.items.slice(0, 5)) out.push(`USGS • M${q.mag ?? "?"} • ${q.place ?? "unknown location"} • ${ts(q.time)}`);
  for (const r of air.items.slice(0, 5)) out.push(`AIRNOW • AQI ${r.aqi} ${r.category.toUpperCase()} (${r.pollutant}) • ${r.area}`);
  for (const d of disasters.items.slice(0, 3)) out.push(`FEMA • ${d.id} • ${d.incident.toUpperCase()} • ${day(d.date)}`);
  const j = jobs.items[0];
  if (j) out.push(`BLS • UNEMPLOYMENT ${j.latest.rate}% • ${j.latest.period}`);
  return out.length ? out : [`NO ACTIVE PUBLIC EVENTS FOR ${name.toUpperCase()}`];
}

function Section<T>({ title, feed, children }: { title: string; feed: Feed<T>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#00e5ff]/30 bg-[#001424]/60 px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[10px] sm:text-[11px] font-black tracking-widest text-[#00e5ff]">
        <span>
          {title}
          {typeof feed.total === "number" ? ` • ${feed.total.toLocaleString()}` : ""}
        </span>
        <a href={feed.sourceUrl} target="_blank" rel="noreferrer" className="text-[#ff2ec4] underline underline-offset-2 font-bold tracking-normal">
          SOURCE ↗
        </a>
      </div>
      {!feed.ok ? (
        <div className="text-[10px] text-[#ff80ab] break-all">FEED UNAVAILABLE — {feed.error}</div>
      ) : (
        children
      )}
      {feed.note && <div className="text-[9px] sm:text-[10px] text-slate-500">{feed.note}</div>}
      <div className="text-[9px] sm:text-[10px] text-slate-500">
        {feed.source} • retrieved {ts(feed.retrievedAt)}
      </div>
    </div>
  );
}

const rowCls = "text-[10px] sm:text-[11px] text-slate-200 leading-snug break-words";
const linkCls = "text-[#69f0ae] hover:underline";

export default function PublicLivePanel({ code, name }: { code: string; name: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setError(null);
    const load = () =>
      fetch(`/api/public-live?code=${code}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: Payload) => {
          if (!cancelled) {
            setPayload(d);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const lines = useMemo(() => (payload ? tickerLines(payload, name) : []), [payload, name]);

  return (
    <div className="rounded-2xl border border-[#00e5ff]/50 bg-[#020b18]/90 p-3 space-y-2 font-mono">
      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black tracking-widest text-[#80deea]">
        <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse shadow-[0_0_10px_#00e5ff] shrink-0" />
        PUBLIC LIVE FEEDS — {name.toUpperCase()}
      </div>
      {error && !payload && <div className="text-[10px] text-[#ff80ab]">LIVE FEEDS UNAVAILABLE — {error}</div>}
      {!payload && !error && <div className="text-[10px] text-slate-400 animate-pulse">FETCHING NWS • FEMA • USGS • AIRNOW • BLS…</div>}
      {payload && (
        <>
          <div className="rounded-lg border border-[#ff2ec4]/50 bg-[#ff2ec4]/10 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-[#ff9ee8] truncate" aria-live="polite">
            <Radio className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            {lines[tick % lines.length]}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-500">
            Updated {ts(payload.generatedAt)} • refreshes every 5 min{error ? ` • last refresh failed: ${error}` : ""}
          </div>

          <Section title="NWS ACTIVE ALERTS" feed={payload.feeds.alerts}>
            {payload.feeds.alerts.items.length === 0 && <div className={rowCls}>No active alerts.</div>}
            {payload.feeds.alerts.items.map((a) => (
              <div key={a.url} className={rowCls}>
                <a href={a.url} target="_blank" rel="noreferrer" className={linkCls}>{a.event}</a> • {a.severity} • {a.area}
                <span className="text-slate-500"> • sent {ts(a.sent)}{a.expires ? ` • expires ${ts(a.expires)}` : ""}</span>
              </div>
            ))}
          </Section>

          <Section title="USGS EARTHQUAKES (30 DAYS)" feed={payload.feeds.quakes}>
            {payload.feeds.quakes.items.length === 0 && <div className={rowCls}>No events recorded.</div>}
            {payload.feeds.quakes.items.map((q) => (
              <div key={q.url} className={rowCls}>
                <a href={q.url} target="_blank" rel="noreferrer" className={linkCls}>M{q.mag ?? "?"}</a> • {q.place ?? "unknown location"}
                {q.type !== "earthquake" ? ` • ${q.type}` : ""}
                <span className="text-slate-500"> • {ts(q.time)}</span>
              </div>
            ))}
          </Section>

          <Section title="EPA AIRNOW AIR QUALITY" feed={payload.feeds.air}>
            {payload.feeds.air.items.slice(0, 12).map((r) => (
              <div key={r.area} className={rowCls}>
                <span className="text-[#69f0ae]">AQI {r.aqi}</span> {r.category} ({r.pollutant}) • {r.area}
                <span className="text-slate-500"> • {r.observed} • {r.agency}</span>
              </div>
            ))}
          </Section>

          <Section title="FEMA DISASTER DECLARATIONS (12 MO)" feed={payload.feeds.disasters}>
            {payload.feeds.disasters.items.length === 0 && <div className={rowCls}>No declarations on record.</div>}
            {payload.feeds.disasters.items.map((d) => (
              <div key={d.id} className={rowCls}>
                <a href={d.url} target="_blank" rel="noreferrer" className={linkCls}>{d.id}</a> • {d.incident} • {d.title}
                <span className="text-slate-500"> • declared {day(d.date)} • {d.areas} designated area{d.areas === 1 ? "" : "s"}</span>
              </div>
            ))}
          </Section>

          <Section title="BLS UNEMPLOYMENT" feed={payload.feeds.jobs}>
            {payload.feeds.jobs.items.map((j) => (
              <div key={j.latest.period} className={rowCls}>
                <span className="text-[#69f0ae]">{j.latest.rate}%</span> in {j.latest.period}
                {j.latest.unemployed != null && j.latest.laborForce != null
                  ? ` • ${j.latest.unemployed.toLocaleString()} unemployed of ${j.latest.laborForce.toLocaleString()} in labor force`
                  : ""}
                <div className="text-slate-500">
                  13-month trend: {j.history.map((h) => h.rate).join(" → ")}
                </div>
              </div>
            ))}
          </Section>

          <div className="text-[9px] sm:text-[10px] text-slate-500">
            Public statewide and area-level data only; no records about individuals.
          </div>
        </>
      )}
    </div>
  );
}
