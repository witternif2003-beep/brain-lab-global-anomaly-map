import type { RGBA } from './ga-deck-overlay';

/** Marker glyphs drawn in a 64×64 box pointing north; directional ones are rotated by heading. */
export type GaIconShape = 'aircraft' | 'heading' | 'vehicle' | 'scooter' | 'station' | 'gauge';

const PATHS: Record<GaIconShape, string> = {
  aircraft: 'M32 4 L36.5 24 L58 36 L58 42 L36.5 35.5 L35.5 49 L43 55 L43 60 L32 57 L21 60 L21 55 L28.5 49 L27.5 35.5 L6 42 L6 36 L27.5 24 Z',
  heading: 'M32 5 L52 55 L32 44 L12 55 Z',
  vehicle: 'M14 14 H50 V50 H14 Z',
  scooter: 'M32 10 L54 32 L32 54 L10 32 Z',
  station: 'M32 5 L55 18.5 L55 45.5 L32 59 L9 45.5 L9 18.5 Z',
  gauge: 'M32 4 C32 4 11 30 11 42 A21 21 0 0 0 53 42 C53 30 32 4 32 4 Z',
};

export interface GaIconDef {
  id: string;
  url: string;
  width: number;
  height: number;
  mask: false;
}

const cache = new Map<string, GaIconDef>();
const css = ([r, g, b, a]: RGBA) => `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;

/** SVG data-URL icon with a dark outline and a faint inner rim so it reads on imagery. */
export function gaMarkerIcon(shape: GaIconShape, fill: RGBA, stroke: RGBA): GaIconDef {
  const id = `${shape}:${fill.join(',')}:${stroke.join(',')}`;
  let def = cache.get(id);
  if (!def) {
    const d = PATHS[shape];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
      `<path d="${d}" fill="${css(fill)}" stroke="${css(stroke)}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" stroke-linejoin="round" transform="translate(32 32) scale(0.72) translate(-32 -32)"/>` +
      `</svg>`;
    def = { id, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: 64, height: 64, mask: false };
    cache.set(id, def);
  }
  return def;
}
