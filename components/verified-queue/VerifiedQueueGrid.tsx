"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { QueueItem, VerifiedQueue } from "../../lib/verified-queue/queue";
import { JURISDICTIONS } from "../../lib/territory-catalog";

const PILL = "px-3 py-1 rounded-full border font-mono font-bold uppercase tracking-wider backdrop-blur-md";

const SOURCE_STYLE: Record<string, string> = {
  "FEMA-DECL": "text-[#e0aaff] border-[#bd00ff]/70 bg-[#1b0833]/70",
  NWS: "text-[#80deea] border-[#00e5ff]/60 bg-[#061836]/70",
  "FBI-CDE": "text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/70",
  "EPA-ECHO": "text-[#69f0ae] border-[#00ff88]/60 bg-[#002b1b]/70",
  "DOJ-PRESS": "text-[#ffab91] border-[#ff6e40]/60 bg-[#2b0d00]/70",
  USASPENDING: "text-[#b2ebf2] border-[#00e5ff]/40 bg-[#041630]/70"
};

function Item({ item }: { item: QueueItem }) {
  return (
    <li
      data-testid={`queue-${item.id}`}
      className="rounded-2xl bg-[#020b18]/50 border border-[#00e5ff]/20 px-3 py-2 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#e0f7fa] font-semibold text-[11px]">{item.title}</span>
        <span className={`${PILL} px-2 py-0.5 text-[8px] shrink-0 ${SOURCE_STYLE[item.source_id] ?? SOURCE_STYLE.NWS}`}>
          {item.source_id}
        </span>
      </div>
      <div className="text-[10px] text-[#80deea]/70 mt-0.5">{item.detail}</div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-[10px] text-[#80deea]/50">{item.date ?? ""}</span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-[#00e5ff] hover:underline inline-flex items-center gap-1"
          >
            source <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {item.provenance && (
        <div className="text-[9px] text-[#00e5ff]/40 truncate" title={item.provenance.sha256}>
          sha256 {item.provenance.sha256.slice(0, 16)}… • {item.provenance.retrieved_at}
        </div>
      )}
    </li>
  );
}

export default function VerifiedQueueGrid({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState<string>(initialCode);
  const [data, setData] = useState<VerifiedQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const load = (c: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/ingest/verified-queue?code=${c}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j as VerifiedQueue);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "request failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(code), [code]);

  return (
    <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-4 sm:p-8 space-y-4 overflow-hidden font-mono shadow-[0_16px_70px_rgba(0,229,255,0.25)]">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-full bg-[#020b18]/60 backdrop-blur-xl border-2 border-[#00e5ff]/50 px-4 py-2.5 text-xs text-[#e0f7fa] outline-none w-full sm:w-72"
        >
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.code} — {j.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {data && (
            <span className={`${PILL} text-[10px] text-[#69f0ae] border-[#00ff88]/60 bg-[#002617]/70`}>
              {data.code} • {data.count} items • {data.generated_at.slice(0, 10)}
            </span>
          )}
          <button
            onClick={() => load(code)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#003b5c]/80 to-[#002244]/80 text-[#00e5ff] hover:text-white border-2 border-[#00e5ff] text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Rebuild
          </button>
        </div>
      </div>

      {error && <div className={`${PILL} w-fit text-[10px] text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80`}>Queue failed: {error}</div>}
      {!data && loading && <div className="text-[#80deea] text-xs animate-pulse">Pulling live feeds for {code}…</div>}

      {data && data.unavailable.length > 0 && (
        <div className={`${PILL} w-fit text-[10px] text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/70`}>
          Unavailable this build: {data.unavailable.join(" • ")}
        </div>
      )}

      {data && (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </ul>
      )}
      {data && data.items.length === 0 && (
        <div className="text-[#80deea] text-xs">No verified items for {data.code} in this build.</div>
      )}
    </div>
  );
}
