/** Soft cumulus sprite for the radar cloud puffs: a feathered disc of overlapping lobes (alpha only, tinted per puff). */
export interface PuffAtlas {
  url: string;
  mapping: Record<'puff', { x: number; y: number; width: number; height: number; mask: boolean }>;
}

const SIZE = 128;

/** Deterministic lobe layout so every client draws the same sprite. */
const LOBES: [number, number, number][] = [
  [0.5, 0.52, 0.34], [0.36, 0.56, 0.22], [0.64, 0.56, 0.22], [0.44, 0.38, 0.2], [0.6, 0.4, 0.18],
  [0.28, 0.44, 0.15], [0.72, 0.46, 0.15], [0.52, 0.68, 0.2], [0.5, 0.28, 0.14],
];

let cached: PuffAtlas | null = null;

export function puffAtlas(): PuffAtlas {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (const [cx, cy, r] of LOBES) {
      const g = ctx.createRadialGradient(cx * SIZE, cy * SIZE, 0, cx * SIZE, cy * SIZE, r * SIZE);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.32)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
  }
  cached = { url: canvas.toDataURL('image/png'), mapping: { puff: { x: 0, y: 0, width: SIZE, height: SIZE, mask: true } } };
  return cached;
}
