#!/usr/bin/env python3
"""FAA AC 150/5390-2D (Heliport Design, 1/5/2023) Table C-1 → lib/ga-live-markers/faa-heli.json (overall length, height, rotor diameter per ICAO type).

The table rows are keyed by manufacturer model name; ICAO type designators are mapped by hand below.
Usage: python3 scripts/build-faa-heli.py [path/to/AC_150_5390_2D_Heliports.pdf]
"""
import hashlib, io, json, re, sys, urllib.request
from datetime import datetime, timezone
from pypdf import PdfReader

URL = "https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_150_5390_2D_Heliports.pdf"
OUT = "lib/ga-live-markers/faa-heli.json"
ICAO = {
    "A109": "A-109A", "A119": "A-119 Koala", "A139": "AW-139", "B47G": "47G", "UH1": "Huey II, 210", "B06": "206B-1,2,3",
    "B212": "212", "B222": "222B, UT", "B230": "230", "B407": "407", "B412": "412EP, SP, HP", "B427": "427VFR", "B429": "429",
    "B430": "430", "H47": "234/CH-47F/G", "EN28": "F-28F/280FX", "EN48": "480B/TH-28", "AS50": "AS-350 A Star",
    "AS55": "AS-355 Twin Star", "AS65": "Dolphin", "B105": "BO-105", "BK17": "BK-117", "EC20": "EC-120", "EC30": "EC-130",
    "EC35": "EC-135", "EC45": "EC-145/ UH-72A", "EC55": "EC-155", "EC25": "EC-225", "KMAX": "K-Max/ K1200", "H500": "500E",
    "MD52": "520N", "MD60": "600N", "EXPL": "Explorer/ 902", "R22": "R-22 Beta", "R44": "R-44 Raven", "R66": "R-66 Turbine",
    "H269": "300C", "S76": "S-76A/B/C/D", "S92": "S-92", "H60": "Blackhawk",
}
ROW = re.compile(r"(?m)^(.{0,40}?)\s([\d,]{3,7}(?:\s*-\s*[\d,]+)?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s")

def main():
    raw = open(sys.argv[1], "rb").read() if len(sys.argv) > 1 else urllib.request.urlopen(
        urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 brain-lab heli import"}), timeout=120).read()
    pages = PdfReader(io.BytesIO(raw)).pages
    text = "\n".join(p.extract_text() or "" for p in pages if "Controlling Dimension" in (p.extract_text() or ""))
    rows = {}
    for m in ROW.finditer(text):
        label = " ".join(m.group(1).split())
        eng = re.search(r"\b(\d)\s*[-+]\s*([PT])\b", text[m.end():m.end() + 160])
        rows.setdefault(label, {"lengthFt": float(m.group(4)), "tailFt": float(m.group(5)), "spanFt": float(m.group(6)),
                                "engines": int(eng.group(1)) if eng else None,
                                "engine": {"P": "Piston", "T": "Turboshaft"}[eng.group(2)] if eng else ""})
    types = {}
    for code, label in sorted(ICAO.items()):
        if label not in rows:
            sys.exit(f"{code}: row {label!r} not found")
        types[code] = {"model": label, **rows[label], "adg": None, "wake": None, "rotor": True}
    out = {"source": "FAA AC 150/5390-2D Heliport Design, Table C-1", "sourceUrl": URL, "sha256": hashlib.sha256(raw).hexdigest(),
           "retrievedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "types": types}
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    print(f"{len(types)} types → {OUT}")

if __name__ == "__main__":
    main()
