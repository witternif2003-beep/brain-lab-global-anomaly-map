"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { JURISDICTIONS } from "../../lib/territory-catalog";
import type { JurisdictionRecordList as RecordList } from "../../lib/jurisdiction-records/records";

const PAGE_SIZE = 25;

const SOURCE_STYLE: Record<string, string> = {
  OPENFEMA: "text-[#80deea] border-[#00e5ff]/60 bg-[#061836]/80",
  "DOJ-PRESS": "text-[#ffd54f] border-[#ffaa00]/70 bg-[#331e00]/80"
};

export default function JurisdictionRecordList() {
  const [code, setCode] = useState("GA");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<RecordList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(`/api/ingest/records?code=${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.error) setError(d.error);
        else setList(d.list);
      })
      .catch((e) => live && setError(String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [code]);

  const records = useMemo(() => (list?.code === code ? list.records : []), [list, code]);
  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const shown = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const name = JURISDICTIONS.find((j) => j.code === code)?.name ?? code;

  return (
    <div className="space-y-4 font-mono">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-full bg-[#030c1c]/80 border-2 border-[#00e5ff]/60 text-[#e0f7fa] text-xs font-bold uppercase tracking-wider backdrop-blur-md"
        >
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.code} · {j.name}
            </option>
          ))}
        </select>
        {list?.code === code && (
          <span className="text-[11px] text-[#69f0ae] uppercase tracking-wider">
            {records.length.toLocaleString("en-US")} records · {list.counts.OPENFEMA} FEMA · {list.counts["DOJ-PRESS"]} DOJ
          </span>
        )}
      </div>

      <div className="rounded-[28px] border-2 border-[#ffaa00]/50 bg-[#140d02]/80 backdrop-blur-2xl overflow-hidden">
        <div className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#69f0ae]">
          Batch {page} of {pages} · Records {records.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
          {Math.min(page * PAGE_SIZE, records.length)} of {records.length.toLocaleString("en-US")} · {name}
        </div>
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 text-[#ffaa00] disabled:opacity-30"
            disabled={page === 1}
            aria-label="Previous batch"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`min-w-[40px] px-2 py-1.5 rounded-md text-sm font-bold ${
                n === page ? "bg-[#ffaa00] text-black" : "text-[#ffd54f]/80 hover:text-[#ffd54f]"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="p-2 text-[#ffaa00] disabled:opacity-30"
            disabled={page === pages}
            aria-label="Next batch"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {loading && <div className="px-4 py-6 text-xs text-[#ffd54f]">Loading public records for {name}…</div>}
        {error && <div className="px-4 py-6 text-xs text-[#ff80ab]">Source request failed: {error}</div>}
        {!loading && !error && records.length === 0 && (
          <div className="px-4 py-6 text-xs text-[#80deea]">No public records returned for {name}.</div>
        )}

        <ul className="divide-y divide-[#ffaa00]/30">
          {shown.map((r) => (
            <li key={r.id} className="px-4 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full border border-[#ffaa00]/70 text-[#ffaa00] text-[11px] font-bold">{r.id}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${SOURCE_STYLE[r.source]}`}>
                    {r.source}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`Source feed SHA-256 ${r.source_sha256}`}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#00ff88]/70 bg-[#002b1b]/80 text-[#69f0ae] text-[10px] font-bold uppercase"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Sourced <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="text-sm sm:text-base font-bold text-white leading-snug">{r.title}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#ffd54f]">
                <MapPin className="w-4 h-4 text-[#ffaa00] shrink-0" />
                <span>
                  {name} · {r.category} · {r.date}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
