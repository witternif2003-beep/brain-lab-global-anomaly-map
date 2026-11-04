/** Soft cumulus sprites for the radar cloud puffs: feathered lobe clusters (alpha only, tinted per puff). */
export interface PuffAtlas {
  url: string;
  mapping: Record<string, { x: number; y: number; width: number; height: number; mask: boolean }>;
}

/** Sprite edge in texels; mipmapped, so distant puffs stay smooth. */
export const PUFF_SIZE = 512;
export const PUFF_VARIANTS = 4;
const PEAK_ALPHA = 0.72;

/** Deterministic 0..1 noise so every client draws the same sprites. */
function rand(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** [cx, cy, radius] lobes in 0..1 sprite units, kept inside the inner circle so no square edge is ever visible. */
function lobes(variant: number): [number, number, number][] {
  const out: [number, number, number][] = [[0.5, 0.52, 0.2]];
  for (let i = 0; i < 11; i++) {
    const a = rand(variant * 97 + i * 3) * Math.PI * 2;
    const d = 0.06 + 0.16 * rand(variant * 97 + i * 3 + 1);
    out.push([0.5 + d * Math.cos(a), 0.52 + d * 0.8 * Math.sin(a), 0.08 + 0.08 * rand(variant * 97 + i * 3 + 2)]);
  }
  return out;
}

/** Alpha 0..1 for one sprite texel: summed Gaussian lobes, saturated, faded to zero before the sprite rim. */
export function puffAlpha(variant: number, u: number, v: number, lobeSet = lobes(variant)): number {
  let density = 0;
  for (const [cx, cy, r] of lobeSet) {
    const dx = u - cx;
    const dy = v - cy;
    density += Math.exp(-(dx * dx + dy * dy) / (0.5 * r * r));
  }
  const rim = Math.hypot(u - 0.5, v - 0.5) / 0.48;
  const fade = rim >= 1 ? 0 : 1 - rim * rim * (3 - 2 * rim);
  return PEAK_ALPHA * (1 - Math.exp(-1.6 * density)) * fade;
}

let cached: PuffAtlas | null = null;

export function puffAtlas(): PuffAtlas {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = PUFF_SIZE * PUFF_VARIANTS;
  canvas.height = PUFF_SIZE;
  const ctx = canvas.getContext('2d');
  const mapping: PuffAtlas['mapping'] = {};
  for (let k = 0; k < PUFF_VARIANTS; k++) {
    mapping[`puff${k}`] = { x: k * PUFF_SIZE, y: 0, width: PUFF_SIZE, height: PUFF_SIZE, mask: true };
    if (!ctx) continue;
    const img = ctx.createImageData(PUFF_SIZE, PUFF_SIZE);
    const set = lobes(k);
    for (let y = 0; y < PUFF_SIZE; y++) {
      for (let x = 0; x < PUFF_SIZE; x++) {
        const a = puffAlpha(k, (x + 0.5) / PUFF_SIZE, (y + 0.5) / PUFF_SIZE, set);
        const i = (y * PUFF_SIZE + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        // Dither by under one 8-bit step so the falloff has no visible contour bands.
        img.data[i + 3] = a <= 0 ? 0 : Math.min(255, Math.floor(a * 255 + rand(i + k) ));
      }
    }
    ctx.putImageData(img, k * PUFF_SIZE, 0);
  }
  cached = { url: canvas.toDataURL('image/png'), mapping };
  return cached;
}
