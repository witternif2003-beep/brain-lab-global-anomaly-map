'use client';
import { useEffect, useState } from 'react';
import type { AnomalyReport } from './statewide-anomalies';

let cache: AnomalyReport[] | null = null;
let pending: Promise<AnomalyReport[]> | null = null;

/**
 * The 1,000-record corpus is ~7.5 MB of source; imported statically it sat inside the God's Eye page's first-load script.
 * Loading it as its own chunk after first paint lets the map start without parsing it first. Every record is unchanged.
 */
export function loadStatewideAnomalies(): Promise<AnomalyReport[]> {
  pending ??= import('./statewide-anomalies')
    .then((m) => (cache = m.STATEWIDE_ANOMALIES_1000))
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

const EMPTY: AnomalyReport[] = [];

/** The corpus once its chunk has loaded; an empty array until then (and if the chunk fails to load). */
export function useStatewideAnomalies(): AnomalyReport[] {
  const [rows, setRows] = useState<AnomalyReport[]>(cache ?? EMPTY);
  useEffect(() => {
    if (cache) return;
    let live = true;
    loadStatewideAnomalies().then((r) => live && setRows(r), () => {});
    return () => {
      live = false;
    };
  }, []);
  return rows;
}
