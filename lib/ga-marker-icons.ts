import type { RGBA } from './ga-deck-overlay';

/** Marker glyphs drawn in a 64×64 box pointing north; directional ones are rotated by heading. */
export type GaIconShape = 'aircraft' | 'heading' | 'vehicle' | 'scooter' | 'station' | 'gauge' | 'alert' | 'flame' | 'beacon' | 'scan' | 'quake';

const PATHS: Record<GaIconShape, string> = {
  aircraft: 'M32 4 L36.5 24 L58 36 L58 42 L36.5 35.5 L35.5 49 L43 55 L43 60 L32 57 L21 60 L21 55 L28.5 49 L27.5 35.5 L6 42 L6 36 L27.5 24 Z',
  heading: 'M32 5 L52 55 L32 44 L12 55 Z',
  vehicle: 'M14 14 H50 V50 H14 Z',
  scooter: 'M32 10 L54 32 L32 54 L10 32 Z',
  station: 'M32 5 L55 18.5 L55 45.5 L32 59 L9 45.5 L9 18.5 Z',
  gauge: 'M32 4 C32 4 11 30 11 42 A21 21 0 0 0 53 42 C53 30 32 4 32 4 Z',
  alert: 'M32 6 L59 55 H5 Z',
  flame: 'M32 3 C36 15 50 22 50 40 A18 18 0 0 1 14 40 C14 30 20 25 23 17 C26 24 28 27 30 28 C31 20 30 11 32 3 Z',
  beacon: 'M32 3 L39 25 L61 32 L39 39 L32 61 L25 39 L3 32 L25 25 Z',
  scan: 'M8 8 H56 V56 H8 Z',
  quake: 'M32 4 A28 28 0 1 1 32 60 A28 28 0 1 1 32 4 Z',
};

/** Inner marks drawn in the outline colour on top of the glyph. */
const DETAIL: Partial<Record<GaIconShape, string>> = {
  alert: 'M29.5 23 H34.5 L33.5 41 H30.5 Z M29.5 45 H34.5 V50 H29.5 Z',
  beacon: 'M38 32 A6 6 0 1 1 26 32 A6 6 0 1 1 38 32 Z',
  scan: 'M30 16 H34 V30 H48 V34 H34 V48 H30 V34 H16 V30 H30 Z',
  quake: 'M8 34 L18 34 L23 22 L29 46 L35 14 L41 42 L46 30 L56 30 L56 34 L48.5 34 L41 52 L35 26 L29 58 L23 34 L20.5 38 L8 38 Z',
};

export interface GaIconFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  mask: false;
}

export interface GaIconAtlas {
  url: string;
  mapping: Record<string, GaIconFrame>;
}

const GLYPH = 64;
const PAD = 10;
const CELL = GLYPH + PAD * 2;
const COLS = 8;
/** Atlas cells include room for the white neon base around each 64-px glyph. */
export const GA_ICON_CELL_SCALE = CELL / GLYPH;

const css = ([r, g, b, a]: RGBA) => `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
export const gaIconKey = (shape: GaIconShape, fill: RGBA, stroke: RGBA) => `${shape}:${fill.join(',')}:${stroke.join(',')}`;

const glyphs = new Map<string, [GaIconShape, RGBA, RGBA]>();
let atlas: GaIconAtlas | null = null;

function drawGlyph(ctx: CanvasRenderingContext2D, shape: GaIconShape, fill: RGBA, stroke: RGBA): void {
  const path = new Path2D(PATHS[shape]);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = 9;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 9;
  ctx.stroke(path);
  ctx.shadowBlur = 0;
  ctx.fillStyle = css(fill);
  ctx.strokeStyle = css(stroke);
  ctx.lineWidth = 5;
  ctx.fill(path);
  ctx.stroke(path);
  ctx.save();
  ctx.translate(32, 32);
  ctx.scale(0.72, 0.72);
  ctx.translate(-32, -32);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke(path);
  ctx.restore();
  const detail = DETAIL[shape];
  if (detail) {
    ctx.fillStyle = css(stroke);
    ctx.fill(new Path2D(detail));
  }
}

/**
 * Pre-rasterised PNG atlas holding every glyph/colour pair seen so far, so deck.gl never has to decode SVG
 * (which some mobile WebKit builds fail to turn into textures). Rebuilt only when a new pair appears.
 */
export function gaIconAtlas(entries: Iterable<{ icon?: GaIconShape; fill: RGBA; stroke: RGBA }>): GaIconAtlas | null {
  let added = false;
  for (const { icon, fill, stroke } of entries) {
    if (!icon) continue;
    const key = gaIconKey(icon, fill, stroke);
    if (glyphs.has(key)) continue;
    glyphs.set(key, [icon, fill, stroke]);
    added = true;
  }
  if ((atlas && !added) || !glyphs.size || typeof document === 'undefined') return atlas;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = Math.ceil(glyphs.size / COLS) * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return atlas;
  const mapping: Record<string, GaIconFrame> = {};
  [...glyphs.entries()].forEach(([key, [shape, fill, stroke]], i) => {
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    ctx.save();
    ctx.translate(x + PAD, y + PAD);
    drawGlyph(ctx, shape, fill, stroke);
    ctx.restore();
    mapping[key] = { x, y, width: CELL, height: CELL, mask: false };
  });
  atlas = { url: canvas.toDataURL('image/png'), mapping };
  return atlas;
}
