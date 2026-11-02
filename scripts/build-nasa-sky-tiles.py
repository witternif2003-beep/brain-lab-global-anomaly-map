#!/usr/bin/env python3
"""Cuts NASA SVS 4851 Deep Star Maps 2020 (https://svs.gsfc.nasa.gov/4851) into 512 px JPEG tiles for lib/sky-photo.ts.

Usage: python3 scripts/build-nasa-sky-tiles.py <dir with starmap_2020_{4k,16k,32k}.exr> <out dir>
Output: <out>/<16k|32k>/<row>/<col>.jpg, row 0 at Dec +90°, col 0 at the image's left edge (RA 12h), same
plate carrée as the published EXR. NASA renders each resolution separately, and the 16K/32K maps hold far less
light per pixel than the 4K one (4K pixel ≈ 8.6× the mean of the 16 16K pixels it covers). Each level's linear values are
therefore scaled so its mean equals the 4K map's, then encoded to sRGB like the 4K/8K JPEGs.
Needs: pip install OpenEXR numpy pillow
"""
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image

TILE = 512
QUALITY = 85


def srgb8(x: np.ndarray) -> np.ndarray:
    x = np.clip(x.astype(np.float32), 0.0, 1.0)
    s = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    return (s * 255 + 0.5).astype(np.uint8)


def load(src: str, name: str) -> np.ndarray:
    with OpenEXR.File(os.path.join(src, f"starmap_2020_{name}.exr")) as exr:
        return exr.channels()["RGB"].pixels


def mean(img: np.ndarray) -> float:
    return float(sum(img[r:r + 1024].astype(np.float64).sum() for r in range(0, img.shape[0], 1024)) / img.size)


def main(src: str, out: str) -> None:
    ref = mean(load(src, "4k"))
    for name in ("16k", "32k"):
        img = load(src, name)
        gain = ref / mean(img)
        print(f"{name}: gain {gain:.3f}", flush=True)
        rows, cols = img.shape[0] // TILE, img.shape[1] // TILE
        total = 0
        for r in range(rows):
            os.makedirs(os.path.join(out, name, str(r)), exist_ok=True)
            band = srgb8(img[r * TILE:(r + 1) * TILE].astype(np.float32) * gain)
            for c in range(cols):
                path = os.path.join(out, name, str(r), f"{c}.jpg")
                Image.fromarray(band[:, c * TILE:(c + 1) * TILE]).save(path, "JPEG", quality=QUALITY, optimize=True)
                total += os.path.getsize(path)
        print(f"{name}: {rows}x{cols} tiles, {total / 1e6:.1f} MB", flush=True)
        del img


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
