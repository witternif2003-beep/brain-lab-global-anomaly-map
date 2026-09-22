/**
 * Dynamic Real-Time Telemetry Pulses & Entity Vectors
 * NSA Admin Mode Telemetry Protocol:
 * - NO static cluttered arc lines or overlapping text collisions
 * - Dynamic moving pulses/missiles traveling along geodesic trajectories in real-time
 * - Green chevron / pulse (▲) indicates ally state entity taking advantage of competitor data output
 * - Red chevron / pulse (▼) indicates new entity accepting adversary competition data
 * - Each pulse appears ONCE per event, advances along trajectory, and dissipates upon arrival
 */

export interface TelemetryPulseEvent {
  id: string;
  type: 'ALLY_ADOPT' | 'COMPETITOR_ACCEPT';
  sourceState: string;
  sourceCoord: [number, number];
  targetState: string;
  targetCoord: [number, number];
  flowCount: number;
  label: string;
  timestamp: number;
  durationMs: number; // flight time
}

export const STATE_GEOLOCATIONS: Record<string, [number, number]> = {
  GA: [-83.4, 32.6],
  NC: [-79.0, 35.6],
  TN: [-86.3, 35.8],
  SC: [-80.9, 33.8],
  FL: [-81.5, 27.9],
  TX: [-99.9, 31.4],
  VA: [-78.6, 37.5],
  AL: [-86.8, 32.8],
};

/**
 * Computes single position along parabolic curve at progress t (0.0 -> 1.0)
 */
export function getInterpolatedArcPoint(
  start: [number, number],
  end: [number, number],
  t: number,
  curvature: number = 0.20
): { coord: [number, number]; bearing: number } {
  const [sx, sy] = start;
  const [ex, ey] = end;

  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;

  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);

  const cx = mx + nx * dist * curvature;
  const cy = my + ny * dist * curvature + dist * 0.10;

  // Quadratic Bézier Point at t
  const bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
  const by = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;

  // Tangent at t to compute instantaneous travel direction (bearing)
  // B'(t) = 2(1 - t)(P1 - P0) + 2t(P2 - P1)
  const dxt = 2 * (1 - t) * (cx - sx) + 2 * t * (ex - cx);
  const dyt = 2 * (1 - t) * (cy - sy) + 2 * t * (ey - cy);
  const angleRad = Math.atan2(dyt, dxt);
  const bearing = (90 - (angleRad * 180) / Math.PI + 360) % 360;

  return {
    coord: [Number(bx.toFixed(5)), Number(by.toFixed(5))],
    bearing: Number(bearing.toFixed(1)),
  };
}

/**
 * Live Telemetry Flow Events (Dispatched individually per anomaly)
 */
export const SEED_TELEMETRY_EVENTS: TelemetryPulseEvent[] = [
  {
    id: 'PULSE-NC-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'NC',
    sourceCoord: STATE_GEOLOCATIONS.NC,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowCount: 1420,
    label: '+1,420 NC Capitol Reallocations',
    timestamp: Date.now() - 1200,
    durationMs: 4000,
  },
  {
    id: 'PULSE-TN-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'TN',
    sourceCoord: STATE_GEOLOCATIONS.TN,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowCount: 890,
    label: '+890 TN Rail Telemetry Followers',
    timestamp: Date.now() - 2500,
    durationMs: 4500,
  },
  {
    id: 'PULSE-SC-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'SC',
    sourceCoord: STATE_GEOLOCATIONS.SC,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowCount: 1150,
    label: '+1,150 Savannah 52-ft Berth Ingestions',
    timestamp: Date.now() - 500,
    durationMs: 3500,
  },
  {
    id: 'PULSE-FL-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'FL',
    sourceCoord: STATE_GEOLOCATIONS.FL,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowCount: 2340,
    label: '+2,340 JaxPort Arbitrage Adopters',
    timestamp: Date.now() - 3200,
    durationMs: 4200,
  },
  {
    id: 'PULSE-GA-TX',
    type: 'COMPETITOR_ACCEPT',
    sourceState: 'GA',
    sourceCoord: STATE_GEOLOCATIONS.GA,
    targetState: 'TX',
    targetCoord: STATE_GEOLOCATIONS.TX,
    flowCount: 1820,
    label: '-1,820 Nodes Accepting Texas Ch. 312',
    timestamp: Date.now() - 1800,
    durationMs: 5000,
  },
  {
    id: 'PULSE-GA-VA',
    type: 'COMPETITOR_ACCEPT',
    sourceState: 'GA',
    sourceCoord: STATE_GEOLOCATIONS.GA,
    targetState: 'VA',
    targetCoord: STATE_GEOLOCATIONS.VA,
    flowCount: 1260,
    label: '-1,260 TEU Accepting Virginia 55-ft Port',
    timestamp: Date.now() - 900,
    durationMs: 4600,
  },
];
