'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { gaFeedStatuses } from '../lib/ga-live-status';
import { nodeFieldSummary, type NodeFieldState, type NodeRowState } from '../lib/ga-node-field-hud';

const BADGE: Record<NodeFieldState, { text: string; color: string; pulse: boolean }> = {
  LIVE: { text: 'LIVE', color: '#4ade80', pulse: true },
  PARTIAL: { text: 'PARTIAL', color: '#fbbf24', pulse: false },
  STALE: { text: 'STALE', color: '#f87171', pulse: false },
  LOADING: { text: 'LOADING', color: '#94a3b8', pulse: false },
};
const ROW_COLOR: Record<NodeRowState, string> = { LIVE: '#4ade80', STALE: '#fbbf24', ERROR: '#f87171', LOADING: '#94a3b8', 'NO TIMESTAMP': '#94a3b8' };

/** Glass HUD over the main map: record counts and freshness of the real public feeds drawn as pins at their source coordinates. */
export default function GaNodeFieldHud({ mapRef }: { mapRef: RefObject<MapLibreMap | null> }) {
  const [now, setNow] = useState(() => Date.now());
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (detailsRef.current && window.innerWidth >= 640) detailsRef.current.open = true;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);
  const map = mapRef.current;
  const { rows, total, state } = nodeFieldSummary(map ? gaFeedStatuses(map) : [], now);
  const badge = BADGE[state];
  return (
    <details
      ref={detailsRef}
      className="absolute top-14 right-14 z-20 max-w-[min(300px,calc(100%-4.5rem))] rounded-xl border border-white/20 bg-black/55 backdrop-blur-md shadow-2xl font-mono text-[#e2e8f0]"
    >
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 text-[11px] font-bold tracking-widest">
        <span className="text-cyan-300">GA NODE FIELD</span>
        <span className="flex items-center gap-1" style={{ color: badge.color }} role="status">
          <span className={`w-2 h-2 rounded-full ${badge.pulse ? 'animate-pulse' : ''}`} style={{ background: badge.color, boxShadow: `0 0 8px ${badge.color}` }} />
          {badge.text}
        </span>
        <span className="ml-auto text-slate-200 tabular-nums">{total.toLocaleString('en-US')}</span>
      </summary>
      <div className="px-3 pb-2.5 space-y-1.5 text-[11px] leading-tight">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2" title={r.error ?? undefined}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }} />
            <span className="truncate">{r.label}</span>
            <span className="text-slate-400 text-[10px]">{r.source}</span>
            <span className="ml-auto tabular-nums">{r.count === null ? '—' : r.count.toLocaleString('en-US')}</span>
            <span className="text-[9px] w-[74px] text-right" style={{ color: ROW_COLOR[r.state] }}>{r.state === 'LIVE' ? r.age : r.state}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-white/10 text-[9.5px] text-slate-400">
          Real public feeds · ships, buses and towers at the coordinates their source publishes · aircraft moved on from their last ADS-B fix by reported speed and track · tap a pin for its source
        </div>
      </div>
    </details>
  );
}
