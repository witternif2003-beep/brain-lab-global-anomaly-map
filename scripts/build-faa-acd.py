#!/usr/bin/env python3
"""FAA Aircraft Characteristics Database → lib/ga-live-markers/faa-acd.json (length, wingspan, tail height per ICAO type).

Source: https://www.faa.gov/airports/engineering/aircraft_char_database (the xlsx is served at .../aircraft_data).
Usage: python3 scripts/build-faa-acd.py [path/to/acd.xlsx]
"""
import hashlib, io, json, sys, urllib.request
from datetime import datetime, timezone

import openpyxl

URL = "https://www.faa.gov/airports/engineering/aircraft_char_database/aircraft_data"
OUT = "lib/ga-live-markers/faa-acd.json"


def num(v):
    return round(float(v), 1) if isinstance(v, (int, float)) else None


def main():
    if len(sys.argv) > 1:
        raw = open(sys.argv[1], "rb").read()
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 brain-lab ACD import"})
        raw = urllib.request.urlopen(req, timeout=120).read()
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    rows = list(wb["ACD_Data"].iter_rows(values_only=True))
    head = rows[0]
    types = {}
    for r in rows[1:]:
        d = dict(zip(head, r))
        code = str(d.get("ICAO_Code") or "").strip().upper()
        length = num(d.get("Length_ft"))
        span = num(d.get("Wingspan_ft_with_winglets_sharklets")) or num(d.get("Wingspan_ft_without_winglets_sharklets"))
        tail = num(d.get("Tail_Height_at_OEW_ft"))
        if not code or not length or not span or not tail:
            continue
        types[code] = {
            "model": str(d.get("Model_FAA") or "").strip(),
            "lengthFt": length,
            "spanFt": span,
            "tailFt": tail,
            "engine": str(d.get("Physical_Class_Engine") or "").strip(),
            "engines": d.get("Num_Engines") if isinstance(d.get("Num_Engines"), int) else None,
            "adg": str(d.get("ADG") or "").strip() or None,
            "wake": str(d.get("ICAO_WTC") or "").strip() or None,
        }
    out = {
        "source": "FAA Aircraft Characteristics Database",
        "sourceUrl": "https://www.faa.gov/airports/engineering/aircraft_char_database",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrievedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "types": dict(sorted(types.items())),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    print(f"{len(types)} types → {OUT}")


if __name__ == "__main__":
    main()
