#!/usr/bin/env python3
"""Builds every NASA star-map level lib/sky-photo.ts draws from one source: SVS 4851 Deep Star Maps 2020, 32K EXR
(https://svs.gsfc.nasa.gov/4851).

Usage: python3 scripts/build-nasa-sky-tiles.py <dir with starmap_2020_4k.exr, starmap_2020_32k.exr> <tile out dir> <public/assets dir>
Output: <tiles>/<16k|32k>/<row>/<col>.jpg (512 px, row 0 at Dec +90°, col 0 at the image's left edge = RA 12h, same plate
carrée as the EXR) and <assets>/nasa-svs-starmap-8k.jpg, nasa-svs-starmap.jpg (4K).

NASA renders each published resolution separately: a 4K pixel holds ≈8.6× the mean light of the 32K pixels it covers, and
its faint-star haze looks different. Drawing NASA's own 4K under 32K tiles therefore shows mismatched patches. Here the
32K linear values are scaled so their mean sRGB value equals that of NASA's 4K map (same screen brightness),
clipped to 1, encoded to sRGB, and box-averaged in sRGB to 16K, 8K and 4K. WebGL filters and mipmaps these RGB textures in sRGB values too, so every level, magnified or
minified, shows the same mean brightness: the same sky at a different sharpness.
Needs: pip install OpenEXR numpy pillow
"""
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image

TILE = 512
QUALITY = 85
BASE_QUALITY = 90


def load(src: str, name: str) -> np.ndarray:
    with OpenEXR.File(os.path.join(src, f"starmap_2020_{name}.exr")) as exr:
        return exr.channels()["RGB"].pixels


def mean(img: np.ndarray) -> float:
    return float(sum(img[r:r + 1024].astype(np.float64).sum() for r in range(0, img.shape[0], 1024)) / img.size)


def srgb(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def u8(s: np.ndarray) -> np.ndarray:
    return (np.clip(s, 0.0, 1.0) * 255 + 0.5).astype(np.uint8)


def box(x: np.ndarray, f: int) -> np.ndarray:
    return x.reshape(x.shape[0] // f, f, x.shape[1] // f, f, 3).mean(axis=(1, 3))


def tiles(out: str, name: str, row0: int, band: np.ndarray, sizes: dict) -> None:
    enc = u8(band)
    for r in range(band.shape[0] // TILE):
        row = row0 + r
        os.makedirs(os.path.join(out, name, str(row)), exist_ok=True)
        for c in range(band.shape[1] // TILE):
            path = os.path.join(out, name, str(row), f"{c}.jpg")
            Image.fromarray(enc[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE]).save(path, "JPEG", quality=QUALITY, optimize=True)
            sizes[name] = sizes.get(name, 0) + os.path.getsize(path)


def main(src: str, out: str, assets: str) -> None:
    ref = mean(srgb(load(src, "4k").astype(np.float32)))
    img = load(src, "32k")
    sample = img[::32].astype(np.float32)
    lo, hi = 1.0, 1000.0
    for _ in range(40):
        gain = (lo * hi) ** 0.5
        lo, hi = (gain, hi) if srgb(sample * gain).mean() < ref else (lo, gain)
    del sample
    print(f"32k gain {gain:.3f}", flush=True)
    sizes: dict = {}
    b8, b4 = [], []
    step = 2 * TILE
    for r0 in range(0, img.shape[0], step):
        band = srgb(img[r0:r0 + step].astype(np.float32) * gain)
        tiles(out, "32k", r0 // TILE, band, sizes)
        tiles(out, "16k", r0 // step, box(band, 2), sizes)
        b8.append(box(band, 4))
        b4.append(box(band, 8))
    del img
    for arr, name in ((b8, "nasa-svs-starmap-8k.jpg"), (b4, "nasa-svs-starmap.jpg")):
        path = os.path.join(assets, name)
        Image.fromarray(u8(np.concatenate(arr))).save(path, "JPEG", quality=BASE_QUALITY, optimize=True)
        sizes[name] = os.path.getsize(path)
    for k, v in sizes.items():
        print(f"{k}: {v / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
