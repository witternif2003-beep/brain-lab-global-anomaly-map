"""Georgia agencies and the surveillance technologies they use, from EFF's Atlas of Surveillance.

Inputs (downloaded by hand, then passed as paths):
  atlas.csv   https://atlasofsurveillance.org/download.csv (EFF, CC BY 4.0)
  places.txt  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
  counties.txt https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip

Each agency is placed at its OSM-mapped police/sheriff facility when one has the same name
(data/osm/ga-infra-snapshot.json.gz), otherwise at the Census internal point of its city, otherwise of its county.
The Atlas lists agencies, not vehicles or devices, so no equipment position is implied.

Usage: python3 scripts/build-ga-atlas-of-surveillance.py atlas.csv places.txt counties.txt
"""
import csv
import gzip
import json
import re
import sys
from datetime import datetime, timezone


def norm(s):
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("'s", "s").replace("dept", "department"))
    return re.sub(r"\s+", " ", s).strip()


def gazetteer(path, state="GA"):
    out = {}
    with open(path, encoding="latin-1") as f:
        rows = csv.reader(f, delimiter="\t")
        head = [h.strip() for h in next(rows)]
        for r in rows:
            d = dict(zip(head, (c.strip() for c in r)))
            if d["USPS"] != state:
                continue
            name = re.sub(r" (city|town|CDP|village|consolidated government.*|unified government.*|County)$", "", d["NAME"], flags=re.I)
            out.setdefault(norm(name), (float(d["INTPTLONG"]), float(d["INTPTLAT"])))
    return out


def main(atlas, places_txt, counties_txt):
    places, counties = gazetteer(places_txt), gazetteer(counties_txt)
    infra = json.loads(gzip.open("data/osm/ga-infra-snapshot.json.gz").read())
    osm = {}
    for e in infra["elements"]:
        t = e.get("tags") or {}
        if t.get("amenity") == "police" and t.get("name"):
            osm.setdefault(norm(t["name"]), (e["lon"], e["lat"], f'{e["type"]}/{e["id"]}'))
    agencies = {}
    for r in csv.DictReader(open(atlas, encoding="utf-8-sig")):
        if r["State"].strip() != "GA":
            continue
        a = agencies.setdefault(r["Agency"].strip(), {"city": r["City"].strip(), "county": r["County"].strip(), "type": r["Type of LEA"].strip(), "juris": r["Type of Juris"].strip(), "tech": []})
        a["tech"].append({"technology": r["Technology"].strip(), "vendor": r["Vendor"].strip() or None, "link": r["Link 1"].strip() or None, "linkDate": r["Link 1 Date"].strip() or None, "aos": r["AOSNUMBER"].strip()})
    out, placed = [], {"osm": 0, "city": 0, "county": 0, "none": 0}
    for name, a in sorted(agencies.items()):
        hit, by, osm_id = None, "none", None
        if norm(name) in osm:
            lon, lat, osm_id = osm[norm(name)]
            hit, by = (lon, lat), "osm"
        elif norm(a["city"]) in places:
            hit, by = places[norm(a["city"])], "city"
        elif norm(a["county"].replace(" County", "")) in counties:
            hit, by = counties[norm(a["county"].replace(" County", ""))], "county"
        placed[by] += 1
        if hit:
            out.append({"agency": name, **a, "lon": round(hit[0], 5), "lat": round(hit[1], 5), "placedBy": by, "osm": osm_id})
    body = {"source": "EFF Atlas of Surveillance (CC BY 4.0), https://atlasofsurveillance.org/",
            "retrievedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "agencies": out}
    with open("data/aos/ga-atlas-of-surveillance.json", "w") as f:
        json.dump(body, f, separators=(",", ":"))
    print(f"{len(agencies)} agencies, {sum(len(a['tech']) for a in agencies.values())} records, placed {placed}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
