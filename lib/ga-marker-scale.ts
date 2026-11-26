import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { loadGaWallRing, type LngLat } from './ga-patrol-3d';

/** Ordinary markers inside the GA wall render at 2/3 of their base radius; labels, DISNEY and company markers keep theirs. */
export const GA_MARKER_SCALE = 2 / 3;
/** Inside the GA wall, the part of a glow/halo/pulse ring that extends past its marker is drawn at 1/3 of its base width. */
export const GA_GLOW_SCALE = 1 / 3;

/** Radius multiplier for a glow drawn at `multiplier` × its marker's radius, after the in-wall glow reduction. */
export function gaGlowMultiplier(multiplier: number): number {
  return 1 + (multiplier - 1) * GA_GLOW_SCALE;
}

/** Glow radius for a marker of radius `core` whose glow reaches `outer`, with `g` the glow-width scale. */
export function glowRadius(core: number, outer: number, g: ExpressionSpecification): ExpressionSpecification {
  return ['+', core, ['*', outer - core, g]];
}

export type RadiusExpression = (k: ExpressionSpecification, g: ExpressionSpecification) => ExpressionSpecification;

function insideWall(ring: LngLat[], inside: number): ExpressionSpecification {
  return ['case', ['within', { type: 'Polygon', coordinates: [ring] }], inside, 1];
}

export function gaWallScaleExpression(ring: LngLat[]): ExpressionSpecification {
  return insideWall(ring, GA_MARKER_SCALE);
}

export function gaWallGlowExpression(ring: LngLat[]): ExpressionSpecification {
  return insideWall(ring, GA_GLOW_SCALE);
}

export function scaleMarkersInsideGaWall(map: MapLibreMap, radii: Record<string, RadiusExpression>): void {
  void loadGaWallRing().then((ring) => {
    if (ring.length < 4 || !map.style) return;
    const k = gaWallScaleExpression(ring);
    const g = gaWallGlowExpression(ring);
    for (const [id, radius] of Object.entries(radii)) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-radius', radius(k, g));
  });
}
