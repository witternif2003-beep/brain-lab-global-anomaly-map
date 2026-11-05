"""Build the Georgia road graph the patrol walks on.

Input: U.S. Census Bureau TIGER/Line 2024 primary + secondary roads for Georgia (state FIPS 13)
  https://www2.census.gov/geo/tiger/TIGER2024/PRISECROADS/tl_2024_13_prisecroads.zip
Clip: public/geo/ga-wall.geojson `path` ring, shrunk by CLEARANCE_M so no road vertex sits at the wall.
Output: public/geo/ga-roads.json
  {"source": ..., "nodes": [lng, lat, lng, lat, ...], "edges": [a, b, a, b, ...]}
  Only the largest connected component is kept, so every node is reachable from every other.

Usage: python3 scripts/build-ga-roads.py <path/to/tl_2024_13_prisecroads.shp>
Requires: pyshp, shapely
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import shapefile
from shapely.geometry import LineString, MultiLineString, Polygon, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
LAT0 = 32.7
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(LAT0))
CLEARANCE_M = 10.0
SIMPLIFY_M = 25.0
SNAP_DECIMALS = 5


def to_m(x, y, z=None):
    return x * M_PER_DEG_LON, y * M_PER_DEG_LAT


def to_deg(x, y, z=None):
    return x / M_PER_DEG_LON, y / M_PER_DEG_LAT


def main(shp_path: str) -> None:
    wall = json.loads((ROOT / "public/geo/ga-wall.geojson").read_text())
    ring = next(f for f in wall["features"] if f["properties"]["part"] == "path")["geometry"]["coordinates"]
    inner = transform(to_m, Polygon(ring)).buffer(-CLEARANCE_M)

    reader = shapefile.Reader(shp_path)
    key = lambda p: (round(p[0], SNAP_DECIMALS), round(p[1], SNAP_DECIMALS))
    adj: dict[tuple, set] = defaultdict(set)
    for sr in reader.iterShapeRecords():
        if sr.record["MTFCC"] not in ("S1100", "S1200"):
            continue
        geom = transform(to_m, shape(sr.shape.__geo_interface__))
        clipped = geom.intersection(inner)
        if clipped.is_empty:
            continue
        lines = clipped.geoms if hasattr(clipped, "geoms") else [clipped]
        for line in lines:
            if not isinstance(line, LineString) or line.length < 1:
                continue
            pts = [key(transform(to_deg, line.simplify(SIMPLIFY_M)).coords[i]) for i in range(len(line.simplify(SIMPLIFY_M).coords))]
            for a, b in zip(pts, pts[1:]):
                if a != b:
                    adj[a].add(b)
                    adj[b].add(a)

    seen: set = set()
    best: list = []
    for start in adj:
        if start in seen:
            continue
        comp, stack = [], [start]
        seen.add(start)
        while stack:
            n = stack.pop()
            comp.append(n)
            for m in adj[n]:
                if m not in seen:
                    seen.add(m)
                    stack.append(m)
        if len(comp) > len(best):
            best = comp

    index = {n: i for i, n in enumerate(best)}
    nodes = [c for n in best for c in n]
    edges = [c for n in best for m in adj[n] if index[n] < index.get(m, -1) for c in (index[n], index[m])]
    out = {
        "source": "U.S. Census Bureau TIGER/Line 2024 primary + secondary roads (tl_2024_13_prisecroads), largest connected component inside the GA wall",
        "nodes": nodes,
        "edges": edges,
    }
    dest = ROOT / "public/geo/ga-roads.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    total = sum(len(adj[n]) for n in best) // 2
    print(f"components kept {len(best)} of {len(adj)} nodes, {len(edges)//2} edges ({total}), {dest.stat().st_size/1e6:.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1])
