/**
 * Telemetry Flight & Flow Arcs (Bézier / Great-Circle Interpolation)
 * Visualizes dynamic competitor telemetry adoption:
 * - Green Arc with Arrow: Ally state user adoption of competitor output data
 * - Red Arc with Arrow: New entrant accepting adversary competition data output
 */

export interface TelemetryArc {
  id: string;
  type: 'ALLY_ADOPT' | 'COMPETITOR_ACCEPT';
  sourceState: string;
  sourceCoord: [number, number];
  targetState: string;
  targetCoord: [number, number];
  flowRate: number; // people / decisions adopting
  label: string;
  timestamp: string;
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
 * Generates an elevated parabolic 2D curved trajectory line between two lon/lat coordinates
 */
export function generateCurvedArc(
  start: [number, number],
  end: [number, number],
  numPoints: number = 36,
  curvature: number = 0.22
): number[][] {
  const points: number[][] = [];
  const [sx, sy] = start;
  const [ex, ey] = end;

  // Midpoint
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;

  // Perpendicular vector for arc bowing (upwards / northwards in latitude)
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Offset normal vector perpendicular to chord
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);

  // Control point
  const cx = mx + nx * dist * curvature;
  const cy = my + ny * dist * curvature + dist * 0.12;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Quadratic Bézier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
    const by = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
    points.push([Number(bx.toFixed(5)), Number(by.toFixed(5))]);
  }

  return points;
}

/**
 * Builds GeoJSON FeatureCollection for all live telemetry flow arcs with directional arrowhead endpoints
 */
export function buildTelemetryArcsGeoJSON(arcs: TelemetryArc[]): {
  arcLines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  arrowHeads: GeoJSON.FeatureCollection<GeoJSON.Point>;
} {
  const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const arc of arcs) {
    const coords = generateCurvedArc(arc.sourceCoord, arc.targetCoord);
    
    // Line feature
    lineFeatures.push({
      type: 'Feature',
      properties: {
        id: arc.id,
        type: arc.type,
        color: arc.type === 'ALLY_ADOPT' ? '#10b981' : '#ef4444', // Green vs Red
        label: arc.label,
        flowRate: arc.flowRate,
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });

    // Arrowhead feature positioned at the terminal coordinate pointing towards destination
    const lastCoord = coords[coords.length - 1];
    const prevCoord = coords[coords.length - 3] || coords[coords.length - 2];
    const angleRad = Math.atan2(lastCoord[1] - prevCoord[1], lastCoord[0] - prevCoord[0]);
    const bearing = (90 - (angleRad * 180) / Math.PI + 360) % 360;

    pointFeatures.push({
      type: 'Feature',
      properties: {
        id: `${arc.id}-arrow`,
        type: arc.type,
        color: arc.type === 'ALLY_ADOPT' ? '#10b981' : '#ef4444',
        bearing,
        symbolText: '▶',
        labelText: `${arc.type === 'ALLY_ADOPT' ? '▲' : '▼'} ${arc.flowRate.toLocaleString()} adoptions (${arc.sourceState}→${arc.targetState})`,
      },
      geometry: {
        type: 'Point',
        coordinates: lastCoord,
      },
    });
  }

  return {
    arcLines: { type: 'FeatureCollection', features: lineFeatures },
    arrowHeads: { type: 'FeatureCollection', features: pointFeatures },
  };
}

/**
 * Real-time dynamic active telemetry arcs
 */
export const ACTIVE_TELEMETRY_ARCS: TelemetryArc[] = [
  // Green Arcs: Ally state entities taking advantage of competitor data output
  {
    id: 'ARC-NC-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'NC',
    sourceCoord: STATE_GEOLOCATIONS.NC,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowRate: 1420,
    label: 'NC Tech Corridor → GA HB 463 Capital Reallocation (+1,420 Firms)',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'ARC-TN-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'TN',
    sourceCoord: STATE_GEOLOCATIONS.TN,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowRate: 890,
    label: 'TN Freight Logistics → Savannah Rail Ingestion (+890 Operators)',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'ARC-SC-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'SC',
    sourceCoord: STATE_GEOLOCATIONS.SC,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowRate: 1150,
    label: 'Charleston Maritime Diverting to Savannah 52-Foot Berth (+1,150 Vessels/TEU)',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'ARC-FL-GA',
    type: 'ALLY_ADOPT',
    sourceState: 'FL',
    sourceCoord: STATE_GEOLOCATIONS.FL,
    targetState: 'GA',
    targetCoord: STATE_GEOLOCATIONS.GA,
    flowRate: 2340,
    label: 'JaxPort Ingestion Arbitrage to Brunswick Auto Ro-Ro (+2,340 Transfers)',
    timestamp: new Date().toISOString(),
  },

  // Red Arcs: Adversary / Competition data output acceptance & drain signals
  {
    id: 'ARC-GA-TX-DRAIN',
    type: 'COMPETITOR_ACCEPT',
    sourceState: 'GA',
    sourceCoord: STATE_GEOLOCATIONS.GA,
    targetState: 'TX',
    targetCoord: STATE_GEOLOCATIONS.TX,
    flowRate: 1820,
    label: 'TX Chapter 312 Incentive Accepting Silicon Semiconductor Yield (-1,820 Nodes)',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'ARC-GA-VA-DRAIN',
    type: 'COMPETITOR_ACCEPT',
    sourceState: 'GA',
    sourceCoord: STATE_GEOLOCATIONS.GA,
    targetState: 'VA',
    targetCoord: STATE_GEOLOCATIONS.VA,
    flowRate: 1260,
    label: 'Virginia 55-ft Dredging Depth Dredge Acceptance (-1,260 TEU Diversions)',
    timestamp: new Date().toISOString(),
  },
];
