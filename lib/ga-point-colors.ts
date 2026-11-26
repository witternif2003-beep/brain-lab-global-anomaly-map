import type { ExpressionSpecification } from 'maplibre-gl';

export const GA_ANOMALY_LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#facc15',
  3: '#f97316',
  4: '#ef4444',
};

export const GA_TRAFFIC_TYPE_COLORS: Record<string, string> = {
  accidentsAndIncidents: '#ef4444',
  closures: '#f97316',
  roadwork: '#facc15',
  specialEvents: '#22d3ee',
};
export const GA_TRAFFIC_DEFAULT_COLOR = '#a3a3a3';

export const GA_FLOOD_CATEGORY_COLORS: Record<string, string> = {
  no_flooding: '#22c55e',
  action: '#eab308',
  minor: '#f97316',
  moderate: '#ef4444',
  major: '#a855f7',
};
export const GA_FLOOD_DEFAULT_COLOR = '#64748b';

export function hexToRgba(color: string, alpha = 255): [number, number, number, number] {
  const hex = color.replace(/^#/, '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    alpha,
  ];
}

export function colorMatchExpression(property: string, colors: Record<string, string>, fallback: string): ExpressionSpecification {
  return [
    'match',
    ['get', property],
    ...Object.entries(colors).flatMap(([key, value]) => [key, value]),
    fallback,
  ] as unknown as ExpressionSpecification;
}
