/**
 * Weighted L2 Provenance Norm & Conflict Reconciliation
 */

export interface ProvenanceTensor {
  reliability: number;   // R ∈ [0,1]
  credibility: number;   // C ∈ [0,1]
  freshness: number;     // Δt ∈ [0,1]  (1 = fresh)
  cycleEntropy: number;  // H ∈ [0,1]   (1 = no cycles)
}

export function weightedL2Norm(t: ProvenanceTensor): number {
  return +Math.sqrt(
    0.35 * Math.pow(t.reliability, 2) +
    0.30 * Math.pow(t.credibility, 2) +
    0.20 * Math.pow(1 - t.freshness, 2) +
    0.15 * Math.pow(1 - t.cycleEntropy, 2)
  ).toFixed(4);
}

export function reconcileConflict(
  a: ProvenanceTensor,
  b: ProvenanceTensor,
  lambda = 2.0
): ProvenanceTensor {
  const dR = Math.abs(a.reliability - b.reliability);
  const wA = Math.exp(-lambda * dR);
  const wB = 1 - wA;
  return {
    reliability:  +(wA * a.reliability  + wB * b.reliability).toFixed(4),
    credibility:  +(wA * a.credibility  + wB * b.credibility).toFixed(4),
    freshness:    +(wA * a.freshness    + wB * b.freshness).toFixed(4),
    cycleEntropy: +(wA * a.cycleEntropy + wB * b.cycleEntropy).toFixed(4),
  };
}

export const computeWeightedL2Norm = weightedL2Norm;
