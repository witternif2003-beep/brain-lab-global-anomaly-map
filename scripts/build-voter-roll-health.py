"""Build the aggregate voter-roll health dataset (zero PII).

Inputs (official public releases, downloaded into a work dir):
  EAC 2024 EAVS public release CSV zip
  Census CVAP 2020-2024 ACS special tabulation CSV zip
  Census cartographic boundary counties, 2024, 1:20,000,000
Outputs:
  public/data/voter-roll-health-2024.csv
  public/data/voter-roll-health-2024-counties.geojson
  lib/elections/voter-roll-health-2024.ts

Usage: python3 scripts/build-voter-roll-health.py [workdir]
"""
import csv, hashlib, io, json, os, sys, urllib.request, zipfile
from collections import defaultdict

import shapefile  # pyshp

WORK = sys.argv[1] if len(sys.argv) > 1 else "/tmp/voter-roll-health"
RETRIEVED = os.environ.get("RETRIEVED", "2026-10-01")
SOURCES = {
    "eavs": {
        "publisher": "U.S. Election Assistance Commission",
        "title": "2024 Election Administration and Voting Survey (EAVS), public release V1",
        "url": "https://www.eac.gov/sites/default/files/2025-06/2024_EAVS_for_Public_Release_nolabel_V1_csv.zip",
        "landingUrl": "https://www.eac.gov/research-and-data/datasets-codebooks-and-surveys",
        "instrumentUrl": "https://www.eac.gov/sites/default/files/2024-04/2024_EAVS_FINAL_508c.pdf",
        "vintage": "Registered and eligible voters for the 5 Nov 2024 general election; removals and confirmation notices between the close of registration for the Nov 2022 and Nov 2024 general elections",
    },
    "cvap": {
        "publisher": "U.S. Census Bureau",
        "title": "Citizen Voting Age Population by Race and Ethnicity, 2020-2024 ACS 5-year special tabulation",
        "url": "https://www2.census.gov/programs-surveys/decennial/rdo/datasets/2024/2024-cvap/CVAP_2020-2024_ACS_csv_files.zip",
        "landingUrl": "https://www.census.gov/programs-surveys/decennial-census/about/voting-rights/cvap.html",
        "documentationUrl": "https://www2.census.gov/programs-surveys/decennial/rdo/technical-documentation/special-tabulation/CVAP_2020-2024_ACS_documentation_v1.pdf",
        "vintage": "ACS 5-year estimates, 2020-2024 (survey estimate with 90% margin of error)",
    },
    "boundaries": {
        "publisher": "U.S. Census Bureau",
        "title": "Cartographic Boundary File, counties, 2024, 1:20,000,000",
        "url": "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_20m.zip",
        "landingUrl": "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
        "vintage": "Boundaries as of 1 January 2024",
    },
}

# 56 jurisdictions: FIPS -> (abbr, name)
JURIS = {
    "01": ("AL", "Alabama"), "02": ("AK", "Alaska"), "04": ("AZ", "Arizona"), "05": ("AR", "Arkansas"),
    "06": ("CA", "California"), "08": ("CO", "Colorado"), "09": ("CT", "Connecticut"), "10": ("DE", "Delaware"),
    "11": ("DC", "District of Columbia"), "12": ("FL", "Florida"), "13": ("GA", "Georgia"), "15": ("HI", "Hawaii"),
    "16": ("ID", "Idaho"), "17": ("IL", "Illinois"), "18": ("IN", "Indiana"), "19": ("IA", "Iowa"),
    "20": ("KS", "Kansas"), "21": ("KY", "Kentucky"), "22": ("LA", "Louisiana"), "23": ("ME", "Maine"),
    "24": ("MD", "Maryland"), "25": ("MA", "Massachusetts"), "26": ("MI", "Michigan"), "27": ("MN", "Minnesota"),
    "28": ("MS", "Mississippi"), "29": ("MO", "Missouri"), "30": ("MT", "Montana"), "31": ("NE", "Nebraska"),
    "32": ("NV", "Nevada"), "33": ("NH", "New Hampshire"), "34": ("NJ", "New Jersey"), "35": ("NM", "New Mexico"),
    "36": ("NY", "New York"), "37": ("NC", "North Carolina"), "38": ("ND", "North Dakota"), "39": ("OH", "Ohio"),
    "40": ("OK", "Oklahoma"), "41": ("OR", "Oregon"), "42": ("PA", "Pennsylvania"), "44": ("RI", "Rhode Island"),
    "45": ("SC", "South Carolina"), "46": ("SD", "South Dakota"), "47": ("TN", "Tennessee"), "48": ("TX", "Texas"),
    "49": ("UT", "Utah"), "50": ("VT", "Vermont"), "51": ("VA", "Virginia"), "53": ("WA", "Washington"),
    "54": ("WV", "West Virginia"), "55": ("WI", "Wisconsin"), "56": ("WY", "Wyoming"),
    "60": ("AS", "American Samoa"), "66": ("GU", "Guam"), "69": ("MP", "Northern Mariana Islands"),
    "72": ("PR", "Puerto Rico"), "78": ("VI", "U.S. Virgin Islands"),
}
ABBR_FIPS = {a: f for f, (a, _) in JURIS.items()}
FIELDS = {"total": "A1a", "active": "A1b", "inactive": "A1c", "notices": "A10a", "removed": "A12a"}


def fetch(key):
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, os.path.basename(SOURCES[key]["url"]))
    if not os.path.exists(path):
        req = urllib.request.Request(SOURCES[key]["url"], headers={"User-Agent": "Mozilla/5.0 (brain-lab voter-roll health)"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
    blob = open(path, "rb").read()
    SOURCES[key]["sha256"] = hashlib.sha256(blob).hexdigest()
    SOURCES[key]["bytes"] = len(blob)
    SOURCES[key]["retrieved"] = RETRIEVED
    return zipfile.ZipFile(io.BytesIO(blob))


def value(raw):
    """EAVS codes: -88 does not apply, -99 data not available, -77 other/blank."""
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None, "missing"
    if v == -88:
        return None, "not_applicable"
    if v < 0:
        return None, "missing"
    return int(v), None


eavs_zip = fetch("eavs")
cvap_zip = fetch("cvap")
bnd_zip = fetch("boundaries")

# --- CVAP --------------------------------------------------------------------
def cvap_rows(name):
    for r in csv.DictReader(io.TextIOWrapper(cvap_zip.open(name), encoding="latin-1")):
        if r["lnnumber"] == "1":
            yield r

cvap_county = {r["geoid"][-5:]: (int(r["cvap_est"]), int(r["cvap_moe"])) for r in cvap_rows("County.csv")}
county_names = {r["geoid"][-5:]: r["geoname"].split(",")[0].strip().upper() for r in cvap_rows("County.csv")}
cvap_state = {r["geoid"][-2:]: (int(r["cvap_est"]), int(r["cvap_moe"])) for r in cvap_rows("State.csv")}
# County-subdivision -> county, for EAVS units that are towns/municipalities (CT planning regions, WI).
cousub_county = defaultdict(set)
for r in cvap_rows("MCD.csv"):
    g = r["geoid"][-10:]
    cousub_county[(g[:2], g[5:])].add(g[:5])

# --- EAVS --------------------------------------------------------------------
eavs_name = next(n for n in eavs_zip.namelist() if n.endswith(".csv"))
eavs = list(csv.DictReader(io.TextIOWrapper(eavs_zip.open(eavs_name), encoding="latin-1")))

def blank():
    return {"jurisdictions": 0, **{k: 0 for k in FIELDS}, "status": {k: None for k in FIELDS}}

def add(acc, row):
    acc["jurisdictions"] += 1
    for k, col in FIELDS.items():
        v, why = value(row[col])
        if v is None:
            # fail closed: one unreported unit makes the aggregate unreported
            if acc["status"][k] is None or why == "missing":
                acc["status"][k] = why
        else:
            acc[k] += v

states = defaultdict(blank)
counties = defaultdict(blank)
county_split = set()  # counties fed by an EAVS unit spanning several counties
state_only_units = defaultdict(int)
unmatched = []
for row in eavs:
    st = ABBR_FIPS[row["State_Abbr"]]
    add(states[st], row)
    fp = row["FIPSCode"].strip()
    if row["State_Abbr"] == "WI" and len(fp) == 5:
        targets = cousub_county.get((st, fp), set())
    elif len(fp) in (9, 10):
        fp = fp.zfill(10)
        if fp[2:5] == "000":
            state_only_units[st] += 1
            continue
        targets = {fp[:5]}
        if st == "09":  # CT: EAVS keeps legacy county codes; CVAP/boundaries use planning regions
            targets = cousub_county.get((st, fp[5:]), set())
    else:
        state_only_units[st] += 1
        continue
    if not targets:
        unmatched.append((row["State_Abbr"], row["FIPSCode"], row["Jurisdiction_Name"]))
        # unit missing from the county crosswalk: fail closed on the county its name gives
        county_name = row["Jurisdiction_Name"].rsplit(" - ", 1)[-1].strip().upper()
        county_split.update(g for g, n in county_names.items() if g[:2] == st and n == county_name)
        continue
    if len(targets) > 1:
        county_split.update(targets)
        continue
    add(counties[next(iter(targets))], row)

# --- Metrics -----------------------------------------------------------------
def rnd(x, n):
    return None if x is None else round(x, n)

def metrics(acc, cvap):
    s = acc["status"]
    total = acc["total"] if s["total"] is None else None
    active = acc["active"] if s["active"] is None else None
    inactive = acc["inactive"] if s["inactive"] is None else None
    removed = acc["removed"] if s["removed"] is None else None
    notices = acc["notices"] if s["notices"] is None else None
    est, moe = cvap if cvap else (None, None)
    return {
        "registered_total": total, "active": active, "inactive": inactive,
        "removed_2022_2024": removed, "confirmation_notices_2022_2024": notices,
        "cvap_est": est, "cvap_moe": moe,
        "active_pct_cvap": rnd(100 * active / est, 1) if active is not None and est else None,
        "inactive_pct": rnd(100 * inactive / total, 1) if inactive is not None and total else None,
        "removed_per_1000_active": rnd(1000 * removed / active, 1) if removed is not None and active else None,
    }

def status_note(acc, cvap, extra=None):
    notes = []
    for k, why in acc["status"].items():
        if why:
            notes.append(f"{FIELDS[k]} {why.replace('_', ' ')}")
    if not cvap:
        notes.append("no CVAP estimate")
    if extra:
        notes.append(extra)
    return "; ".join(notes)

# --- Boundaries --------------------------------------------------------------
reader = shapefile.Reader(
    shp=io.BytesIO(bnd_zip.read("cb_2024_us_county_20m.shp")),
    dbf=io.BytesIO(bnd_zip.read("cb_2024_us_county_20m.dbf")),
    shx=io.BytesIO(bnd_zip.read("cb_2024_us_county_20m.shx")),
)
def rounded(geom):
    def r(c):
        return [round(c[0], 3), round(c[1], 3)]
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [[r(c) for c in ring] for ring in geom["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[[r(c) for c in ring] for ring in poly] for poly in geom["coordinates"]]}

csv_rows, features = [], []
county_counts = defaultdict(lambda: {"counties": 0, "with_rate": 0})
for sr in reader.iterShapeRecords():
    rec = sr.record.as_dict()
    geoid, st = rec["GEOID"], rec["STATEFP"]
    if st not in JURIS:
        continue
    abbr = JURIS[st][0]
    cvap = cvap_county.get(geoid)
    if geoid in county_split:
        acc, extra = blank(), "an EAVS unit here spans several counties or is missing from the Census crosswalk; county total not separable"
        for k in FIELDS:
            acc["status"][k] = "missing"
    elif geoid in counties:
        acc, extra = counties[geoid], None
    else:
        acc, extra = blank(), "EAVS reports this jurisdiction statewide only" if state_only_units.get(st) else "no EAVS unit matched"
        for k in FIELDS:
            acc["status"][k] = "missing"
    m = metrics(acc, cvap)
    note = status_note(acc, cvap, extra)
    county_counts[st]["counties"] += 1
    if m["active_pct_cvap"] is not None:
        county_counts[st]["with_rate"] += 1
    name = rec["NAMELSAD"]
    csv_rows.append({"level": "county", "fips": geoid, "geography": name, "state": abbr,
                     "eavs_units": acc["jurisdictions"], **m, "data_note": note})
    features.append({
        "type": "Feature",
        "properties": {"g": geoid, "n": name, "s": abbr, "u": acc["jurisdictions"],
                       "t": m["registered_total"], "a": m["active"], "i": m["inactive"], "r": m["removed_2022_2024"],
                       "c": m["cvap_est"], "cm": m["cvap_moe"],
                       "ar": m["active_pct_cvap"], "ir": m["inactive_pct"], "rm": m["removed_per_1000_active"],
                       "q": note},
        "geometry": rounded(sr.shape.__geo_interface__),
    })

STATE_KEYS = {"ar": "active_pct_cvap", "ir": "inactive_pct", "rm": "removed_per_1000_active"}
state_metric = {st: metrics(states[st], cvap_state.get(st)) for st in JURIS}
for f in features:
    sm = state_metric[f["properties"]["g"][:2]]
    for k, field in STATE_KEYS.items():
        f["properties"]["s" + k] = sm[field]

state_rows = []
for st, (abbr, name) in sorted(JURIS.items(), key=lambda x: x[1][1]):
    acc = states[st]
    cvap = cvap_state.get(st)
    m = metrics(acc, cvap)
    note = status_note(acc, cvap)
    row = {"level": "state", "fips": st, "geography": name, "state": abbr, "eavs_units": acc["jurisdictions"], **m, "data_note": note}
    csv_rows.append(row)
    state_rows.append({**row, "counties": county_counts[st]["counties"], "counties_with_rate": county_counts[st]["with_rate"]})

csv_rows.sort(key=lambda r: (r["level"] != "state", r["fips"]))
cols = ["level", "fips", "geography", "state", "eavs_units", "registered_total", "active", "inactive",
        "removed_2022_2024", "confirmation_notices_2022_2024", "cvap_est", "cvap_moe",
        "active_pct_cvap", "inactive_pct", "removed_per_1000_active", "data_note"]
buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\n")
w.writeheader()
for r in csv_rows:
    w.writerow({k: ("" if r[k] is None else r[k]) for k in cols})
csv_bytes = buf.getvalue().encode("utf-8")
geo_bytes = json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")).encode("utf-8")
open("public/data/voter-roll-health-2024.csv", "wb").write(csv_bytes)
open("public/data/voter-roll-health-2024-counties.geojson", "wb").write(geo_bytes)

summary = {
    "eavsUnits": len(eavs),
    "eavsUnitsUnmatched": len(unmatched),
    "eavsUnitsStateOnly": sum(state_only_units.values()),
    "countiesSplitAcrossUnits": len(county_split),
    "counties": len(features),
    "countiesWithActiveRate": sum(1 for f in features if f["properties"]["ar"] is not None),
    "countiesWithInactiveRate": sum(1 for f in features if f["properties"]["ir"] is not None),
    "countiesWithRemovalRate": sum(1 for f in features if f["properties"]["rm"] is not None),
}
out = {
    "sources": SOURCES,
    "outputs": {
        "csv": {"path": "/data/voter-roll-health-2024.csv", "sha256": hashlib.sha256(csv_bytes).hexdigest(), "bytes": len(csv_bytes)},
        "geojson": {"path": "/data/voter-roll-health-2024-counties.geojson", "sha256": hashlib.sha256(geo_bytes).hexdigest(), "bytes": len(geo_bytes)},
    },
    "summary": summary,
}
with open("lib/elections/voter-roll-health-2024.ts", "w") as f:
    f.write("// Generated by scripts/build-voter-roll-health.py. Do not edit by hand.\n")
    f.write("import type { VoterRollStateRow } from \"./voter-roll-health\";\n\n")
    f.write(f"export const VOTER_ROLL_HEALTH_META = {json.dumps(out, indent=2)} as const;\n\n")
    f.write(f"export const VOTER_ROLL_HEALTH_STATES: VoterRollStateRow[] = {json.dumps(state_rows, indent=1)};\n")
print(json.dumps(summary, indent=1))
print("unmatched sample:", unmatched[:8])
print("csv sha", out["outputs"]["csv"]["sha256"], "geo bytes", len(geo_bytes))
