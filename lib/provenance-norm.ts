/**
 * Provenance Weighted L2 Norm & Multi-Source Conflict Reconciliation
 * Computes standardized algebraic distance and resolves observational conflicts.
 */

export interface ProvenanceTensor {
  reliability: number;    // R ∈ [0, 1]
  credibility: number;    // C ∈ [0, 1]
  freshness: number;      // Δt ∈ [0, 1]
  cycleEntropy: number;   // H ∈ [0, 1]
}

export const RECONCILIATION_WEIGHTS = {
  wR: 0.35,  // Source Reliability (Institutional standing)
  wC: 0.30,  // Information Credibility (Cross-sensor corroboration)
  wDt: 0.20, // Temporal Freshness Decay
  wH: 0.15   // Graph Cycle Entropy (Circularity penalty)
};

/**
 * Standardized Weighted L2 Norm:
 * ||T||_2 = sqrt(w_R * R^2 + w_C * C^2 + w_dt * (1 - dt)^2 + w_H * (1 - H)^2)
 */
export function computeWeightedL2Norm(t: ProvenanceTensor): number {
  const sumSquares =
    RECONCILIATION_WEIGHTS.wR * Math.pow(t.reliability, 2) +
    RECONCILIATION_WEIGHTS.wC * Math.pow(t.credibility, 2) +
    RECONCILIATION_WEIGHTS.wDt * Math.pow(1 - t.freshness, 2) +
    RECONCILIATION_WEIGHTS.wH * Math.pow(1 - t.cycleEntropy, 2);

  return +Math.sqrt(sumSquares).toFixed(4);
}

/**
 * Conflict Reconciliation Rule:
 * Lower-reliability source downweighted by e^(-lambda * deltaR), lambda = 2.0
 */
export function reconcileConflict(
  a: ProvenanceTensor,
  b: ProvenanceTensor,
  lambda = 2.0
): { reconciled: ProvenanceTensor; dominant: "a" | "b"; weightA: number; weightB: number } {
  const deltaR = Math.abs(a.reliability - b.reliability);
  let weightA: number;
  let weightB: number;

  if (a.reliability >= b.reliability) {
    weightA = 1.0;
    weightB = Math.exp(-lambda * deltaR);
  } else {
    weightB = 1.0;
    weightA = Math.exp(-lambda * deltaR);
  }

  const sumWeights = weightA + weightB;
  const normA = weightA / sumWeights;
  const normB = weightB / sumWeights;

  const reconciled: ProvenanceTensor = {
    reliability: +(normA * a.reliability + normB * b.reliability).toFixed(4),
    credibility: +(normA * a.credibility + normB * b.credibility).toFixed(4),
    freshness: +(normA * a.freshness + normB * b.freshness).toFixed(4),
    cycleEntropy: +(normA * a.cycleEntropy + normB * b.cycleEntropy).toFixed(4),
  };

  return {
    reconciled,
    dominant: a.reliability >= b.reliability ? "a" : "b",
    weightA: +normA.toFixed(3),
    weightB: +normB.toFixed(3)
  };
}
