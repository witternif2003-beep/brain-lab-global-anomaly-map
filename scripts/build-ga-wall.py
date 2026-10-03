"""Build GodsEYE map boundary + Georgia wall visualization GeoJSON.

Input: U.S. Census Bureau 2024 cartographic boundary file, 1:500,000
  https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip
Outputs:
  public/geo/all-states.geojson  (8 map states, 500k geometry, ~100 m simplification)
  public/geo/ga-wall.geojson     (design visualization: 3.05 m wall + concertina coils
                                  along Georgia's mainland boundary)

Usage: python3 scripts/build-ga-wall.py <path/to/cb_2024_us_state_500k.shp>
Requires: pyshp, shapely
"""
import json
import math
import sys
from pathlib import Path

import shapefile
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
STATES = {
    "AL": ("Alabama", 94.65),
    "FL": ("Florida", 353.4),
    "GA": ("Georgia", 169.5),
    "NC": ("North Carolina", 198.2),
    "SC": ("South Carolina", 155.4),
    "TN": ("Tennessee", 88.08),
    "TX": ("Texas", 98.07),
    "VA": ("Virginia", 204.5),
}
WALL_HEIGHT_M = 3.048  # 10 ft
WALL_THICKNESS_M = 0.3
COIL_DIAMETER_M = 0.76  # 30 in concertina coil
BASE_COIL_OFFSET_M = 1.0
LAT0 = 32.7
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(LAT0))


def to_m(x, y, z=None):
    return x * M_PER_DEG_LON, y * M_PER_DEG_LAT


def to_deg(x, y, z=None):
    return x / M_PER_DEG_LON, y / M_PER_DEG_LAT


def rounded(geom, nd):
    def r(coords):
        return [[round(c[0], nd), round(c[1], nd)] for c in coords]

    g = mapping(geom)
    if g["type"] == "Polygon":
        g["coordinates"] = [r(ring) for ring in g["coordinates"]]
    else:
        g["coordinates"] = [[r(ring) for ring in poly] for poly in g["coordinates"]]
    return g


def ring_band(poly_m, inner, outer):
    band = poly_m.buffer(outer, join_style="mitre", mitre_limit=3).difference(
        poly_m.buffer(inner, join_style="mitre", mitre_limit=3)
    )
    return transform(to_deg, band)


def main(shp_path):
    reader = shapefile.Reader(shp_path)
    fields = [f[0] for f in reader.fields[1:]]
    geoms = {}
    for rec, shp in zip(reader.records(), reader.shapes()):
        props = dict(zip(fields, rec))
        if props["STUSPS"] in STATES:
            geoms[props["STUSPS"]] = shape(shp.__geo_interface__)

    features = []
    for code, (name, density) in STATES.items():
        g = geoms[code]
        if isinstance(g, MultiPolygon):
            g = MultiPolygon([p for p in g.geoms if p.area >= 0.002])
        g = g.simplify(0.0003, preserve_topology=True)
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "density": density, "STUSPS": code},
                "geometry": rounded(g, 5),
            }
        )
    (ROOT / "public/geo/all-states.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"))
    )

    ga = geoms["GA"]
    mainland = max(ga.geoms, key=lambda p: p.area) if isinstance(ga, MultiPolygon) else ga
    mainland = Polygon(mainland.exterior).simplify(0.0003, preserve_topology=True)
    ga_m = transform(to_m, mainland)
    perimeter_km = ga_m.exterior.length / 1000

    half = WALL_THICKNESS_M / 2
    parts = [
        ("wall", ring_band(ga_m, -half, half), 0.0, WALL_HEIGHT_M),
        ("wire-top", ring_band(ga_m, -COIL_DIAMETER_M / 2, COIL_DIAMETER_M / 2), WALL_HEIGHT_M, WALL_HEIGHT_M + COIL_DIAMETER_M),
        ("wire-base", ring_band(ga_m, BASE_COIL_OFFSET_M, BASE_COIL_OFFSET_M + COIL_DIAMETER_M), 0.0, COIL_DIAMETER_M),
    ]
    wall_features = [
        {
            "type": "Feature",
            "properties": {"part": part, "base": round(base, 3), "height": round(height, 3)},
            "geometry": rounded(geom, 8),
        }
        for part, geom, base, height in parts
    ]
    wall_features.append(
        {
            "type": "Feature",
            "properties": {"part": "path", "perimeter_km": round(perimeter_km, 1)},
            "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in mainland.exterior.coords]},
        }
    )
    (ROOT / "public/geo/ga-wall.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": wall_features}, separators=(",", ":"))
    )
    print(f"GA mainland perimeter {perimeter_km:.1f} km, {len(mainland.exterior.coords)} vertices")


if __name__ == "__main__":
    main(sys.argv[1])
