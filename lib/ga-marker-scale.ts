import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { loadGaWallRing, type LngLat } from './ga-patrol-3d';

/** Ordinary markers inside the GA wall render at 2/3 of their base radius; labels, DISNEY and company markers keep theirs. */
export const GA_MARKER_SCALE = 2 / 3;

export type RadiusExpression = (k: ExpressionSpecification) => ExpressionSpecification;

export function gaWallScaleExpression(ring: LngLat[]): ExpressionSpecification {
  return ['case', ['within', { type: 'Polygon', coordinates: [ring] }], GA_MARKER_SCALE, 1];
}

export function scaleMarkersInsideGaWall(map: MapLibreMap, radii: Record<string, RadiusExpression>): void {
  void loadGaWallRing().then((ring) => {
    if (ring.length < 4 || !map.style) return;
    const k = gaWallScaleExpression(ring);
    for (const [id, radius] of Object.entries(radii)) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-radius', radius(k));
  });
}
