"""Build GodsEYE map boundary + Georgia wall visualization GeoJSON.

Input: U.S. Census Bureau 2024 cartographic boundary file, 1:500,000
  https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip
Outputs (every official polygon part is kept; shared borders are simplified together with
shapely.coverage_simplify, so neighbouring states neither overlap nor leave gaps):
  public/geo/all-states.geojson        (8 map states)
  public/geo/competitor-states.geojson (the 7 non-GA states + one label point each)
  public/geo/<st>-state-boundary.geojson (one file per state)
  public/geo/ga-wall.geojson           (design visualization: 3.05 m wall + concertina coils
                                        around every Georgia part; the first `path` feature
                                        is the mainland ring used for inside-the-wall filters)

Usage: python3 scripts/build-ga-wall.py <path/to/cb_2024_us_state_500k.shp>
Requires: pyshp, shapely>=2.1
"""
import json
import math
import sys
from pathlib import Path

import shapefile
import shapely
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union
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
SIMPLIFY_DEG = 0.0003


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

    codes = list(STATES)
    simplified = dict(zip(codes, shapely.coverage_simplify([geoms[c] for c in codes], SIMPLIFY_DEG)))

    def feature(code):
        name, density = STATES[code]
        return {
            "type": "Feature",
            "properties": {"name": name, "density": density, "STUSPS": code},
            "geometry": rounded(simplified[code], 5),
        }

    def write(rel, features):
        (ROOT / rel).write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))

    write("public/geo/all-states.geojson", [feature(c) for c in STATES])
    competitors = [feature(c) for c in STATES if c != "GA"]
    for c in STATES:
        if c == "GA":
            continue
        pt = max(geoms[c].geoms, key=lambda p: p.area).representative_point() if isinstance(geoms[c], MultiPolygon) else geoms[c].representative_point()
        competitors.append(
            {
                "type": "Feature",
                "properties": {"name": STATES[c][0], "STUSPS": c, "label": True},
                "geometry": {"type": "Point", "coordinates": [round(pt.x, 5), round(pt.y, 5)]},
            }
        )
    write("public/geo/competitor-states.geojson", competitors)
    for c in STATES:
        write(f"public/geo/{c.lower()}-state-boundary.geojson", [feature(c)])

    ga_parts = list(simplified["GA"].geoms) if isinstance(simplified["GA"], MultiPolygon) else [simplified["GA"]]
    ga_parts = [Polygon(p.exterior) for p in sorted(ga_parts, key=lambda p: -p.area)]
    ga_m = [transform(to_m, p) for p in ga_parts]
    perimeter_km = sum(p.exterior.length for p in ga_m) / 1000

    def bands(inner, outer):
        return unary_union([ring_band(p, inner, outer) for p in ga_m])

    half = WALL_THICKNESS_M / 2
    parts = [
        ("wall", bands(-half, half), 0.0, WALL_HEIGHT_M),
        ("wire-top", bands(-COIL_DIAMETER_M / 2, COIL_DIAMETER_M / 2), WALL_HEIGHT_M, WALL_HEIGHT_M + COIL_DIAMETER_M),
        ("wire-base", bands(BASE_COIL_OFFSET_M, BASE_COIL_OFFSET_M + COIL_DIAMETER_M), 0.0, COIL_DIAMETER_M),
    ]
    wall_features = [
        {
            "type": "Feature",
            "properties": {"part": part, "base": round(base, 3), "height": round(height, 3)},
            "geometry": rounded(geom, 8),
        }
        for part, geom, base, height in parts
    ]
    for i, (poly, poly_m) in enumerate(zip(ga_parts, ga_m)):
        wall_features.append(
            {
                "type": "Feature",
                "properties": {"part": "path", "ring": "mainland" if i == 0 else "island", "perimeter_km": round(poly_m.exterior.length / 1000, 1)},
                "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in poly.exterior.coords]},
            }
        )
    write("public/geo/ga-wall.geojson", wall_features)
    print(f"GA wall: {len(ga_parts)} rings, perimeter {perimeter_km:.1f} km, mainland {len(ga_parts[0].exterior.coords)} vertices")


if __name__ == "__main__":
    main(sys.argv[1])
