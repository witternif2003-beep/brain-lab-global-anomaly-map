"""Build the 50-state border paths used by the border-runner layer.

Input: U.S. Census Bureau 2024 cartographic boundary file, 1:500,000
  https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip
Output: public/geo/us-50-state-borders.json
  {"source", "sha256", "simplifyDeg", "states": [{"st", "name", "fips", "perimeterM", "d": [...]}]}
  One closed ring per state: the exterior of its largest polygon part (mainland), simplified by
  SIMPLIFY_DEG. `d` is the ring as integer 1e-5° deltas: x0, y0, dx1, dy1, ...

Usage: python3 scripts/build-us-border-runners.py <path/to/cb_2024_us_state_500k.zip>
Requires: pyshp, shapely>=2.1
"""
import hashlib
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip"
NON_STATES = {"11", "60", "66", "69", "72", "78"}
SIMPLIFY_DEG = 0.0005
SCALE = 100_000
M_PER_DEG_LAT = 111_320.0


def perimeter_m(coords):
    total = 0.0
    for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
        k = M_PER_DEG_LAT * math.cos(math.radians((y0 + y1) / 2))
        total += math.hypot((x1 - x0) * k, (y1 - y0) * M_PER_DEG_LAT)
    return total


def main(zip_path):
    raw = Path(zip_path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    with tempfile.TemporaryDirectory() as tmp:
        zipfile.ZipFile(zip_path).extractall(tmp)
        reader = shapefile.Reader(str(Path(tmp) / "cb_2024_us_state_500k.shp"))
        fields = [f[0] for f in reader.fields[1:]]
        states = []
        for sr in reader.shapeRecords():
            rec = dict(zip(fields, sr.record))
            if rec["STATEFP"] in NON_STATES:
                continue
            geom = shape(sr.shape.__geo_interface__)
            parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
            ring = max(parts, key=lambda p: p.area).exterior.simplify(SIMPLIFY_DEG)
            pts = [(round(x * SCALE), round(y * SCALE)) for x, y in ring.coords]
            dedup = [pts[0]] + [p for a, p in zip(pts, pts[1:]) if p != a]
            d = [dedup[0][0], dedup[0][1]]
            for (ax, ay), (bx, by) in zip(dedup, dedup[1:]):
                d += [bx - ax, by - ay]
            coords = [(x / SCALE, y / SCALE) for x, y in dedup]
            states.append({
                "st": rec["STUSPS"],
                "name": rec["NAME"],
                "fips": rec["STATEFP"],
                "perimeterM": round(perimeter_m(coords)),
                "d": d,
            })
    states.sort(key=lambda s: s["st"])
    assert len(states) == 50, len(states)
    out = {"source": SOURCE, "sha256": sha, "simplifyDeg": SIMPLIFY_DEG, "states": states}
    dest = ROOT / "public/geo/us-50-state-borders.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(dest, dest.stat().st_size, "bytes", sum(len(s["d"]) // 2 for s in states), "points")


if __name__ == "__main__":
    main(sys.argv[1])
