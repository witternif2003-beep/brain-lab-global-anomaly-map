"""Georgia public-equipment snapshot for /api/ga-live-markers?layer=equipment.

Reads a Geofabrik OpenStreetMap extract (https://download.geofabrik.de/north-america/us/georgia.html),
keeps only the categories in data/osm/ga-equipment-categories.json that are publicly usable
(access not private/no), and writes data/osm/ga-equipment-snapshot.json.gz in Overpass JSON shape.

Usage: pip install osmium && python3 scripts/build-ga-osm-equipment.py georgia-latest.osm.pbf
"""
import gzip
import json
import sys

import osmium

CATS = json.load(open("data/osm/ga-equipment-categories.json"))
MATCH = {(c["key"], c["value"]) for c in CATS}
KEYS = {c["key"] for c in CATS}
KEEP = {"name", "operator", "brand", "network", "capacity", "fee", "opening_hours", "access", "indoor",
        "socket:type1", "socket:type2", "socket:chademo", "socket:type1_combo", "socket:tesla_supercharger", "socket:nacs",
        "fuel:diesel", "fuel:e85", "fuel:cng", "fuel:lpg", "wheelchair", "covered", "bottle", "drinking_water"}
CLOSED = {"private", "no"}
BBOX = (-85.7, 30.3, -80.8, 35.1)


def category(tags):
    for k in KEYS:
        v = tags.get(k)
        if v and (k, v) in MATCH:
            return k, v
    return None


class Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.elements = []

    def add(self, kind, oid, tags, lon, lat):
        cat = category(tags)
        if not cat or tags.get("access") in CLOSED:
            return
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            return
        kept = {k: v for k, v in tags if k in KEEP}
        kept[cat[0]] = cat[1]
        self.elements.append({"type": kind, "id": oid, "lat": round(lat, 6), "lon": round(lon, 6), "tags": kept})

    def node(self, n):
        if n.tags and n.location.valid():
            self.add("node", n.id, n.tags, n.location.lon, n.location.lat)

    def way(self, w):
        if not w.tags or not category(w.tags):
            return
        pts = [(nd.lon, nd.lat) for nd in w.nodes if nd.location.valid()]
        if pts:
            self.add("way", w.id, w.tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def main(path):
    base = osmium.io.Reader(path, osmium.osm.osm_entity_bits.NOTHING).header().get("osmosis_replication_timestamp")
    h = Handler()
    h.apply_file(path, locations=True, idx="flex_mem")
    body = json.dumps({"osm3s": {"timestamp_osm_base": base or None}, "elements": h.elements}, separators=(",", ":"))
    out = "data/osm/ga-equipment-snapshot.json.gz"
    with gzip.open(out, "wb", compresslevel=9) as f:
        f.write(body.encode())
    counts = {}
    for e in h.elements:
        c = category(e["tags"])
        counts[c] = counts.get(c, 0) + 1
    for c in CATS:
        print(f'{c["id"]:14} {counts.get((c["key"], c["value"]), 0)}')
    print(f"{out}: {len(h.elements)} elements, OSM base {base}")


if __name__ == "__main__":
    main(sys.argv[1])
