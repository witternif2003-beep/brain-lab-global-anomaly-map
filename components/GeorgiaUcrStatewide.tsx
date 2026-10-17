"use client";

import React from "react";
import { Scale } from "lucide-react";
import summary from "../data/ga-ucr/summary.json";
import type { OffenseSummary, PeriodSummary } from "../lib/ga-ucr/summarize";

const LABELS: Record<string, string> = {
  "violent-crime": "Violent crime (total)",
  homicide: "Homicide",
  rape: "Rape",
  robbery: "Robbery",
  "aggravated-assault": "Aggravated assault",
  "property-crime": "Property crime (total)",
  burglary: "Burglary",
  larceny: "Larceny-theft",
  "motor-vehicle-theft": "Motor vehicle theft",
  arson: "Arson",
};
const STALE_DAYS = 45;
const offenses = summary.offenses as OffenseSummary[];
const unavailable = summary.unavailable as { offense: string; url: string; error: string }[];

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);
const cov = (p: PeriodSummary | null | undefined) =>
  !p || p.coverageMinPct == null ? "—" : p.coverageMinPct === p.coverageMaxPct ? `${p.coverageMinPct.toFixed(1)}%` : `${p.coverageMinPct.toFixed(1)}–${p.coverageMaxPct?.toFixed(1)}%`;

export default function GeorgiaUcrStatewide() {
  const years = [...new Set(offenses.flatMap((o) => o.completeYears.map((y) => y.year)))].sort();
  const lastYear = years[years.length - 1];
  const prevYear = years[years.length - 2];
  const partial = offenses.find((o) => o.partial)?.partial;
  const ageDays = Math.floor((Date.now() - Date.parse(summary.generatedAt)) / 86_400_000);
  const refCov = offenses[0]?.completeYears.find((y) => y.year === lastYear);
  const prevCov = offenses[0]?.completeYears.find((y) => y.year === prevYear);

  return (
    <div className="w-full rounded-[28px] bg-[#050b16]/90 border border-[#00e5ff]/40 p-4 sm:p-6 font-mono text-xs space-y-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e3a5f]/60 pb-2">
        <h3 className="flex items-center gap-2 text-[12px] sm:text-[13px] font-extrabold tracking-widest text-[#00e5ff] uppercase">
          <Scale className="w-4 h-4" /> Georgia Statewide Crime Trends · FBI UCR
        </h3>
        <span className={`text-[10px] font-bold ${ageDays > STALE_DAYS ? "text-amber-400" : "text-emerald-400"}`}>
          FBI DATA THROUGH {summary.vintage.maxDataDate ?? "?"} · CDE REFRESH {summary.vintage.lastRefreshDate ?? "?"} · SNAPSHOT {summary.generatedAt.slice(0, 10)}
          {ageDays > STALE_DAYS ? ` · ${ageDays} DAYS OLD, RE-RUN SNAPSHOT` : ""}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] text-slate-200">
          <thead className="text-[10px] text-[#00e5ff] tracking-widest">
            <tr className="text-left">
              <th className="py-1 pr-2">OFFENSE</th>
              {prevYear && <th className="py-1 px-2 text-right">{prevYear}</th>}
              {lastYear && <th className="py-1 px-2 text-right">{lastYear}</th>}
              {prevYear && <th className="py-1 px-2 text-right">CHANGE</th>}
              {partial && (
                <>
                  <th className="py-1 px-2 text-right">
                    {partial.priorSamePeriod?.year ?? partial.current.year - 1} {partial.current.firstMonth.slice(0, 2)}–{partial.current.lastMonth.slice(0, 2)}
                  </th>
                  <th className="py-1 pl-2 text-right">
                    {partial.current.year} {partial.current.firstMonth.slice(0, 2)}–{partial.current.lastMonth.slice(0, 2)} (PARTIAL)
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {offenses.map((o) => {
              const a = o.completeYears.find((y) => y.year === prevYear);
              const b = o.completeYears.find((y) => y.year === lastYear);
              const change = o.yearOverYear.find((c) => c.from === prevYear && c.to === lastYear);
              return (
                <tr key={o.offense} className="border-t border-[#1e3a5f]/40">
                  <td className="py-1 pr-2">{LABELS[o.offense] ?? o.offense}</td>
                  {prevYear && <td className="py-1 px-2 text-right">{fmt(a?.offenses)}</td>}
                  {lastYear && <td className="py-1 px-2 text-right">{fmt(b?.offenses)}</td>}
                  {prevYear && (
                    <td className={`py-1 px-2 text-right ${change?.pctChange == null ? "" : change.pctChange < 0 ? "text-emerald-400" : "text-[#ff80ab]"}`}>
                      {pct(change?.pctChange)}
                    </td>
                  )}
                  {partial && (
                    <>
                      <td className="py-1 px-2 text-right">{fmt(o.partial?.priorSamePeriod?.offenses)}</td>
                      <td className="py-1 pl-2 text-right text-slate-400">{fmt(o.partial?.current.offenses)}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {unavailable.map((u) => (
              <tr key={u.offense} className="border-t border-[#1e3a5f]/40 text-slate-500">
                <td className="py-1 pr-2">{LABELS[u.offense] ?? u.offense}</td>
                <td className="py-1 px-2 text-amber-400/90" colSpan={(prevYear ? 2 : 0) + (lastYear ? 1 : 0) + (partial ? 2 : 0)}>
                  not retrieved in this snapshot ({u.error}); no value shown
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-400 space-y-1">
        <div>
          Population covered by reporting agencies (FBI-published, monthly range):{" "}
          {prevYear && <>{prevYear} {cov(prevCov)} · </>}
          {lastYear && <>{lastYear} {cov(refCov)}</>}
          {partial && <> · {partial.current.year} {cov(partial.current)}</>}. Counts are not adjusted for coverage.
        </div>
        {prevCov && refCov && (prevCov.coverageMinPct ?? 0) - (refCov.coverageMinPct ?? 0) >= 1 && (
          <div className="text-amber-300/90">
            Reporting coverage was lower in {lastYear} ({cov(refCov)}) than in {prevYear} ({cov(prevCov)}), so part of the {prevYear}→{lastYear} change
            can come from fewer agencies reporting rather than from fewer crimes.
          </div>
        )}
        {partial && (
          <div className="text-amber-300/90">
            {partial.current.year} is partial and still being filled in by late agency submissions, so its months are shown next to the same months
            of {partial.current.year - 1} without a percent change. Its coverage is lower; do not read the gap as a drop in crime.
          </div>
        )}
        <div>{summary.definitions}</div>
        <div>
          Source:{" "}
          <a className="text-[#00e5ff] underline" href={summary.sourceUrl} target="_blank" rel="noreferrer">
            {summary.source}
          </a>{" "}
          · statewide only, no county, city or incident data · {summary.files.length} source files with SHA-256 checksums in data/ga-ucr/summary.json.
        </div>
      </div>
    </div>
  );
}
