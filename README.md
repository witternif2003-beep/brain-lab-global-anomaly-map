# NASA SVS Deep Star Maps 2020 — web tiles

512 px JPEG tiles of NASA Scientific Visualization Studio "Deep Star Maps 2020" (SVS 4851,
https://svs.gsfc.nasa.gov/4851), built from `starmap_2020_32k.exr` (published 2020-08-12) by
`scripts/build-nasa-sky-tiles.py` on the main branch.

Layout: `<16k|32k>/<row>/<col>.jpg`; row 0 at Dec +90°, col 0 at the image's left edge (RA 12h),
plate carrée, ICRF/J2000. 32K linear values ×17.804 (so the mean sRGB value matches NASA's 4K map), clipped to 1, encoded to sRGB;
16K is a 2×2 box average of those sRGB values, as WebGL mipmapping does. JPEG quality 85.

Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.
