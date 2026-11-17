import type { Map as MapLibreMap, ExpressionSpecification } from 'maplibre-gl';

/** Wall pattern tile edge in image pixels; added at pixelRatio 2, so it covers 16 map pixels. */
export const FACADE_TILE_PX = 32;
export const FACADE_PIXEL_RATIO = 2;
/** Storeys drawn per pattern tile (window rows). */
export const FACADE_ROWS = 4;

export interface FacadeSpec {
  wall: string;
  window: string;
  band: string;
  /** Window columns per tile. */
  bays: number;
  /** Share of each bay that is glass (0–1). */
  glazing: number;
}

/** Facade looks for Overture `facade_material` and, without one, the building `subtype`. */
export const FACADE_SPECS = {
  'facade-glass': { wall: '#4f6290', window: '#88aaff', band: '#33405f', bays: 8, glazing: 0.85 },
  'facade-brick': { wall: '#aa5533', window: '#26303b', band: '#874127', bays: 4, glazing: 0.5 },
  'facade-concrete': { wall: '#cccccc', window: '#44515f', band: '#a9a9a9', bays: 4, glazing: 0.6 },
  'facade-residential': { wall: '#d6cbb8', window: '#3a4350', band: '#b9ad98', bays: 2, glazing: 0.45 },
  'facade-default': { wall: '#e0e0e0', window: '#4f5b69', band: '#bdbdbd', bays: 4, glazing: 0.55 },
} as const satisfies Record<string, FacadeSpec>;
export type FacadeId = keyof typeof FACADE_SPECS;

export const FACADE_PATTERN_EXPRESSION: ExpressionSpecification = [
  'match',
  ['get', 'facade_material'],
  'glass', 'facade-glass',
  'brick', 'facade-brick',
  'concrete', 'facade-concrete',
  ['match', ['get', 'subtype'], 'residential', 'facade-residential', 'facade-default'],
];

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * RGBA wall tile: each storey row is a floor band (slab edge), a strip of windows split into bays by
 * piers, then a sill strip of wall. The tile repeats around every wall and up the building.
 */
export function facadePattern(spec: FacadeSpec, size = FACADE_TILE_PX, rows = FACADE_ROWS): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  const wall = rgb(spec.wall);
  const glass = rgb(spec.window);
  const band = rgb(spec.band);
  const rowH = size / rows;
  const bayW = size / spec.bays;
  const pier = Math.max(1, Math.round(bayW * (1 - spec.glazing)));
  const bandH = Math.max(1, Math.round(rowH * 0.2));
  const sillH = Math.max(1, Math.round(rowH * 0.2));
  for (let y = 0; y < size; y++) {
    const ry = y % rowH;
    for (let x = 0; x < size; x++) {
      const bx = x % bayW;
      let c = wall;
      if (ry < bandH) c = band;
      else if (ry < rowH - sillH && bx >= pier) {
        // Glass is lighter at the top of each window, as it reflects more sky there.
        const t = (ry - bandH) / Math.max(1, rowH - sillH - bandH);
        const lift = Math.round(28 * (1 - t));
        c = [Math.min(255, glass[0] + lift), Math.min(255, glass[1] + lift), Math.min(255, glass[2] + lift)];
      }
      const i = (y * size + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

/** Registers every facade pattern with the map style (idempotent; style reloads drop images). */
export function addFacadePatterns(map: MapLibreMap): void {
  for (const [id, spec] of Object.entries(FACADE_SPECS)) {
    if (!map.hasImage(id)) map.addImage(id, facadePattern(spec), { pixelRatio: FACADE_PIXEL_RATIO });
  }
}
