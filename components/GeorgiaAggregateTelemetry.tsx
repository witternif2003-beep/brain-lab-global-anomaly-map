"use client";

import React, { useEffect, useState } from "react";
import { Hexagon } from "lucide-react";

interface Payload {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  apiUrl: string;
  coverage: string;
  window: { from: string; to: string; days: number; latestReport: string | null };
  privacy: { kMin: number; method: string };
  incidents: number;
  byHour: number[];
  byWeekday: number[];
  byDay: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byAgainst: { against: string; count: number }[];
  suppressed: Record<string, { cells: number; incidents: number }>;
  hex: Record<string, { features: unknown[] }>;
  ytd: { year: number; total: number; byCategory: { category: string; count: number }[] };
}

const REFRESH_MS = 15 * 60_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ts = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function Bars({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px] h-16">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${labels[i]}: ${v.toLocaleString()}`}>
          <div className="w-full rounded-t-sm" style={{ height: `${(v / max) * 100}%`, background: color, minHeight: v ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#00e5ff]/30 bg-[#001424]/60 px-3 py-2 space-y-1.5">
      <div className="text-[10px] sm:text-[11px] font-black tracking-widest text-[#00e5ff]">{title}</div>
      {children}
    </div>
  );
}

export default function GeorgiaAggregateTelemetry() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ga-telemetry")
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
          return j as Payload;
        })
        .then((j) => alive && (setData(j), setError(null)))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const days = data?.byDay ?? [];
  const complete = days.slice(0, -1);
  const last7 = complete.slice(-7).reduce((a, b) => a + b.count, 0) / Math.max(1, Math.min(7, complete.length));
  const prior = complete.slice(0, -7);
  const base = prior.reduce((a, b) => a + b.count, 0) / Math.max(1, prior.length);
  const delta = base ? ((last7 - base) / base) * 100 : 0;

  return (
    <div className="w-full rounded-[28px] bg-[#050b16]/90 border border-[#00e5ff]/40 p-4 sm:p-6 font-mono text-xs space-y-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e3a5f]/60 pb-2">
        <h3 className="flex items-center gap-2 text-[12px] sm:text-[13px] font-extrabold tracking-widest text-[#00e5ff] uppercase">
          <Hexagon className="w-4 h-4" /> Georgia Aggregate Telemetry · H3 Hex Grid
        </h3>
        <span className="text-[10px] text-emerald-400 font-bold">
          {data ? `REFRESHED ${ts(data.generatedAt)} · EVERY 15 MIN` : error ? "FEED UNAVAILABLE" : "LOADING…"}
        </span>
      </div>

      {error && !data && <div className="text-[#ff80ab] text-[11px] break-all">FEED UNAVAILABLE — {error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center">
            {[
              [`REPORTS · ${data.window.days} DAYS`, data.incidents.toLocaleString()],
              [`REPORTS · ${data.ytd.year} YTD`, data.ytd.total.toLocaleString()],
              ["HEX CELLS SHOWN (RES 8)", (data.hex["8"]?.features.length ?? 0).toLocaleString()],
              ["LAST 7 FULL DAYS VS PRIOR", `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%/day`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#00e5ff]/25 bg-[#001424]/60 py-2">
                <div className="text-[9px] text-slate-400 tracking-widest">{k}</div>
                <div className="text-[15px] font-black text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Box title="DAILY REPORTS">
              <Bars values={days.map((d) => d.count)} labels={days.map((d) => d.date)} color="#00e5ff" />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>{days[0]?.date}</span>
                <span>{days[days.length - 1]?.date}</span>
              </div>
            </Box>
            <Box title="HOUR OF DAY (ET)">
              <Bars values={data.byHour} labels={data.byHour.map((_, h) => `${h}:00`)} color="#ff2ec4" />
              <div className="flex justify-between text-[9px] text-slate-500"><span>0h</span><span>12h</span><span>23h</span></div>
            </Box>
            <Box title="DAY OF WEEK">
              <Bars values={data.byWeekday} labels={WEEKDAYS} color="#facc15" />
              <div className="flex justify-between text-[9px] text-slate-500">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
            </Box>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Box title={`TOP CATEGORIES · ${data.window.days} DAYS`}>
              {data.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="flex justify-between text-[11px] text-slate-200"><span>{c.category}</span><span>{c.count.toLocaleString()}</span></div>
              ))}
            </Box>
            <Box title={`TOP CATEGORIES · ${data.ytd.year} YEAR TO DATE`}>
              {data.ytd.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="flex justify-between text-[11px] text-slate-200"><span>{c.category}</span><span>{c.count.toLocaleString()}</span></div>
              ))}
            </Box>
          </div>

          <div className="text-[10px] text-slate-400 space-y-1">
            <div>
              Source:{" "}
              <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-[#ff2ec4] underline">{data.source}</a>
              {data.window.latestReport ? ` · newest report ${ts(data.window.latestReport)}` : ""}
            </div>
            <div>{data.coverage}</div>
            <div>
              {data.privacy.method} Withheld at res 8: {data.suppressed["8"]?.cells ?? 0} cells / {data.suppressed["8"]?.incidents ?? 0} reports.
            </div>
            <div>Reported incidents, not convictions. Not affiliated with APD or any federal agency.</div>
          </div>
        </>
      )}
    </div>
  );
}
