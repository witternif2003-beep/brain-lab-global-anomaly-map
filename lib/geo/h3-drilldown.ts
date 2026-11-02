import { cellToChildren, cellToParent, latLngToCell } from 'h3-js';

/**
 * Coarse-to-fine H3 hotspot search after Townsend et al., "Lightweight Multi-scale Hierarchical Anomaly
 * Detection and Localization for Geospatial Big Data Applications at the Edge" (arXiv:2608.22648).
 * A cell is scored only if its parent was flagged, so quiet regions are dropped at the coarsest level.
 * Score: Poisson z of a cell's count against the mean count of occupied cells at the same resolution.
 */
export interface DrillOptions {
  /** Strictly increasing H3 resolutions, coarse to fine. */
  resolutions: number[];
  /** Minimum z-score for a cell to be flagged. */
  zThreshold: number;
  /** Smallest count a reported cell may have (k-anonymity floor). */
  minCount: number;
}

export interface Hotspot {
  h3: string;
  resolution: number;
  count: number;
  expected: number;
  z: number;
}

export interface DrillResult {
  hotspots: Hotspot[];
  /** Cells scored by the drill-down. */
  evaluations: number;
  /** Cells a flat scan at the finest resolution would score. */
  flatEvaluations: number;
}

export const DEFAULT_DRILL: DrillOptions = { resolutions: [5, 7, 8], zThreshold: 3, minCount: 5 };

export function drillDown(points: { lat: number; lng: number }[], opts: DrillOptions = DEFAULT_DRILL): DrillResult {
  const { resolutions, zThreshold, minCount } = opts;
  if (!resolutions.length || resolutions.some((r, i) => i > 0 && r <= resolutions[i - 1])) {
    throw new Error('resolutions must be non-empty and strictly increasing');
  }
  const finest = resolutions[resolutions.length - 1];
  const counts = resolutions.map(() => new Map<string, number>());
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const leaf = latLngToCell(p.lat, p.lng, finest);
    resolutions.forEach((r, i) => {
      const id = r === finest ? leaf : cellToParent(leaf, r);
      counts[i].set(id, (counts[i].get(id) ?? 0) + 1);
    });
  }
  const means = counts.map((m) => (m.size ? [...m.values()].reduce((a, b) => a + b, 0) / m.size : 0));

  const hotspots: Hotspot[] = [];
  let evaluations = 0;
  let candidates = [...counts[0].keys()];
  for (let i = 0; i < resolutions.length && candidates.length; i++) {
    const next: string[] = [];
    for (const id of candidates) {
      const count = counts[i].get(id);
      if (!count) continue;
      evaluations++;
      const expected = means[i];
      const z = expected > 0 ? (count - expected) / Math.sqrt(expected) : 0;
      if (z < zThreshold) continue;
      if (i === resolutions.length - 1) {
        if (count >= minCount) hotspots.push({ h3: id, resolution: resolutions[i], count, expected, z });
      } else {
        for (const child of cellToChildren(id, resolutions[i + 1])) if (counts[i + 1].has(child)) next.push(child);
      }
    }
    candidates = next;
  }
  hotspots.sort((a, b) => b.z - a.z);
  return { hotspots, evaluations, flatEvaluations: counts[counts.length - 1].size };
}
