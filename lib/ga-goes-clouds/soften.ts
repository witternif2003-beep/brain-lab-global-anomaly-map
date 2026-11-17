export const smooth = (t: number) => (t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t));
export const nightFactor = (sunAltDeg: number) => Math.max(0, Math.min(1, (6 - sunAltDeg) / 12));

/** Separable box blur (both axes); two passes approximate a Gaussian, softening the satellite pixel steps. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = sum / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = sum / n;
    }
  }
  return out;
}
