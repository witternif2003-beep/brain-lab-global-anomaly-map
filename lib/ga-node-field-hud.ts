import type { GaFeedStatus } from './ga-live-status';

/** Real public feeds summarised in the node-field HUD; each count is the number of records the feed returned. */
export const NODE_FIELD_LAYERS = [
  { id: 'aircraft', label: 'Aircraft', source: 'ADS-B', staleAfterMin: 5 },
  { id: 'vessels', label: 'Ships & boats', source: 'AIS', staleAfterMin: 15 },
  { id: 'transit', label: 'Transit buses', source: 'GTFS-RT', staleAfterMin: 5 },
  { id: 'towers', label: 'Comm towers', source: 'OSM', staleAfterMin: 24 * 60 },
] as const;

export type NodeRowState = 'LIVE' | 'STALE' | 'ERROR' | 'LOADING' | 'NO TIMESTAMP';
export type NodeFieldState = 'LIVE' | 'PARTIAL' | 'STALE' | 'LOADING';

export interface NodeFieldRow {
  id: string;
  label: string;
  source: string;
  color: string;
  count: number | null;
  state: NodeRowState;
  age: string;
  error: string | null;
}

export function ageText(iso: string | null, now: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'no timestamp';
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 172_800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
}

function rowState(f: GaFeedStatus | undefined, staleAfterMin: number, now: number): NodeRowState {
  if (!f) return 'LOADING';
  if (f.error) return 'ERROR';
  const t = f.updatedAt ? Date.parse(f.updatedAt) : NaN;
  if (!Number.isFinite(t)) return 'NO TIMESTAMP';
  return now - t > staleAfterMin * 60_000 ? 'STALE' : 'LIVE';
}

/** Builds HUD rows from the statuses the live-marker layers reported; "LIVE" only when every feed is fresh and error-free. */
export function nodeFieldSummary(statuses: readonly GaFeedStatus[], now: number): { rows: NodeFieldRow[]; total: number; state: NodeFieldState } {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const rows = NODE_FIELD_LAYERS.map((l): NodeFieldRow => {
    const f = byId.get(l.id);
    return {
      id: l.id, label: l.label, source: l.source, color: f?.color ?? '#64748b',
      count: f?.count ?? null, state: rowState(f, l.staleAfterMin, now),
      age: f ? ageText(f.updatedAt, now) : 'loading', error: f?.error ?? null,
    };
  });
  const total = rows.reduce((a, r) => a + (r.count ?? 0), 0);
  const live = rows.filter((r) => r.state === 'LIVE').length;
  const state: NodeFieldState = rows.every((r) => r.state === 'LOADING') ? 'LOADING' : live === rows.length ? 'LIVE' : live ? 'PARTIAL' : 'STALE';
  return { rows, total, state };
}
