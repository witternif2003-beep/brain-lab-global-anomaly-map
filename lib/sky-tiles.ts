import type { SkyBasis } from './sky-photo';

/** 512 px JPEG tiles cut from the NASA SVS 4851 16K and 32K EXRs by scripts/build-nasa-sky-tiles.py. */
export const SKY_TILE_PX = 512;
export const SKY_TILE_LEVELS = [16384, 32768] as const;
export const SKY_TILE_BASE_URL = 'https://cdn.jsdelivr.net/gh/witternif2003-beep/brain-lab-global-anomaly-map@f9f4399b4118b32e786f948bc2e2f10def3fbdbc';
export const skyTileUrl = (levelWidth: number, row: number, col: number) => `${SKY_TILE_BASE_URL}/${levelWidth / 1024}k/${row}/${col}.jpg`;

/** A tile of one level and the device-pixel rectangle (y down) of the screen it covers. */
export type SkyTile = { key: string; width: number; row: number; col: number; x0: number; y0: number; x1: number; y1: number };

const GRID = 32;
/** Tolerance (in tiles) for great-circle cell edges bulging past their corners. */
const EDGE_EPS = 0.02;
/** Cells with every corner below this altitude (sin, about −1°) are hidden by the ground. */
const BELOW_HORIZON = -0.0175;

/** Texture pixels per degree the screen needs, from its height in device px and the vertical field of view. */
export function skyPxPerDeg(basis: SkyBasis, pixelHeight: number): number {
  return pixelHeight / ((2 * Math.atan(basis.tanY) * 180) / Math.PI);
}

/** Coarsest tile level whose pixels per degree reach the screen's, or 0 when the base texture is already sharp enough. */
export function skyTileLevel(needPxPerDeg: number, baseWidth: number): number {
  if (baseWidth / 360 >= needPxPerDeg) return 0;
  for (const w of SKY_TILE_LEVELS) if (w / 360 >= needPxPerDeg) return w;
  return SKY_TILE_LEVELS[SKY_TILE_LEVELS.length - 1];
}

/** Star-map texture coordinates (u from RA, v from Dec, v = 0 at +90°) and altitude (sin) of a screen point. */
function screenSky(basis: SkyBasis, nx: number, ny: number, zenith: readonly number[] | undefined): [number, number, number] {
  const d = [0, 1, 2].map((i) => basis.forward[i] + basis.right[i] * nx * basis.tanX + basis.up[i] * ny * basis.tanY);
  const len = Math.hypot(d[0], d[1], d[2]);
  const ra = Math.atan2(d[1], d[0]);
  const dec = Math.asin(Math.max(-1, Math.min(1, d[2] / len)));
  const u = (((0.5 - ra / (2 * Math.PI)) % 1) + 1) % 1;
  const alt = zenith ? (d[0] * zenith[0] + d[1] * zenith[1] + d[2] * zenith[2]) / len : 1;
  return [u, 0.5 - dec / Math.PI, alt];
}

/** Tiles of a level that cover the part of the screen above the horizon, each with the screen rectangle it may draw into. */
export function visibleSkyTiles(basis: SkyBasis, pixelWidth: number, pixelHeight: number, levelWidth: number, zenith?: readonly number[]): SkyTile[] {
  const cols = levelWidth / SKY_TILE_PX;
  const rows = cols / 2;
  const corners: [number, number, number][] = [];
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) corners.push(screenSky(basis, (i / GRID) * 2 - 1, 1 - (j / GRID) * 2, zenith));
  const tiles = new Map<string, SkyTile>();
  const cw = pixelWidth / GRID;
  const ch = pixelHeight / GRID;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const cell = [corners[j * (GRID + 1) + i], corners[j * (GRID + 1) + i + 1], corners[(j + 1) * (GRID + 1) + i], corners[(j + 1) * (GRID + 1) + i + 1]];
      if (cell.every((c) => c[2] < BELOW_HORIZON)) continue;
      const vs = cell.map((c) => c[1] * rows);
      const r0 = Math.max(0, Math.floor(Math.min(...vs) - EDGE_EPS));
      const r1 = Math.min(rows - 1, Math.floor(Math.max(...vs) + EDGE_EPS));
      // Unwrap RA across the u = 0/1 seam relative to the first corner.
      const us = cell.map((c) => c[0] - Math.round(c[0] - cell[0][0]));
      let c0 = Math.floor(Math.min(...us) * cols - EDGE_EPS);
      let c1 = Math.floor(Math.max(...us) * cols + EDGE_EPS);
      const nearPole = cell.some((c) => c[1] < 0.03 || c[1] > 0.97);
      if (nearPole || c1 - c0 >= cols / 2) [c0, c1] = [0, cols - 1];
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const col = ((c % cols) + cols) % cols;
          const key = `${levelWidth}/${r}/${col}`;
          const t = tiles.get(key);
          const x0 = i * cw, y0 = j * ch, x1 = (i + 1) * cw, y1 = (j + 1) * ch;
          if (t) {
            t.x0 = Math.min(t.x0, x0); t.y0 = Math.min(t.y0, y0); t.x1 = Math.max(t.x1, x1); t.y1 = Math.max(t.y1, y1);
          } else tiles.set(key, { key, width: levelWidth, row: r, col, x0, y0, x1, y1 });
        }
      }
    }
  }
  return [...tiles.values()];
}
