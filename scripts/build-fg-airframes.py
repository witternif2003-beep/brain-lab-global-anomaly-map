#!/usr/bin/env python3
"""FlightGear FGMEMBERS aircraft (GPL) AC3D exterior models -> public/models/airframes/<id>.bin + lib/ga-live-markers/fg-airframes.json.

Each model is flattened (object loc/rot applied), interior/cockpit/light/effect objects dropped, triangulated, flat-shaded,
coloured from its AC3D material, vertex-clustered down to a phone-sized triangle budget, and rotated to the map's mesh axes
(+x forward, +y left, +z up, wheels at z=0). The map stretches each mesh to FAA length/span/tail height at draw time.
Usage: python3 scripts/build-fg-airframes.py /path/to/fgmembers-checkouts
"""
import hashlib, json, math, re, struct, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public/models/airframes"
MANIFEST = ROOT / "lib/ga-live-markers/fg-airframes.json"
DROP = re.compile(r"seat|cabin|cockpit|panel|light|flightdeck|shadow|shade|interior|int$|strobe|glass|window|yoke|pedal|throttle|screen|display|instrument|pilot|fire|smoke|contrail|exhaust|pushback|shield|disk|well", re.I)
AIRFRAMES = [
    {"id": "b739", "repo": "737-900ER", "files": ["Models/737-900.ac"], "types": ["B739", "B738", "B737", "B38M", "B39M", "B37M"]},
    # A320.xml offsets (FlightGear x aft, y right, z up) applied per part; gear and engines are separate models not converted.
    {"id": "a320", "repo": "A320-family", "files": [("Models/a320.fuselage.ac", [0, 0, 0]), ("Models/Wings/a320.wings.ac", [15.28, 0, -1.06019]),
        ("Models/Wings/a320.winglets.ac", [15.28, 0, -1.06019]), ("Models/a320.hstab.ac", [34.1512207, 0, 0]), ("Models/a320.vstab.ac", [32.2535728, 0, 0])],
     "types": ["A320", "A20N", "A319", "A19N", "A318", "A321", "A21N"]},
    {"id": "b748", "repo": "747-8i", "files": ["Models/747-8F.ac"], "types": ["B748", "B744"]},
    {"id": "b788", "repo": "787", "files": ["Models/787-8.ac"], "types": ["B788", "B789", "B78X"]},
    {"id": "e170", "repo": "E-jet-family", "files": ["Models/erj170.ac"], "types": ["E170", "E75L", "E75S"]},
    {"id": "e190", "repo": "E-jet-family", "files": ["Models/erj190.ac"], "types": ["E190", "E195", "E290", "E295"]},
]
BUDGET = 6000


def parse_ac(path):
    lines = path.read_text(errors="replace").splitlines()
    mats, tris, i = [], [], 0

    def obj(parent_m, parent_t):
        nonlocal i
        name, loc, rot, verts, kids = "", [0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1], [], 0
        surfs = []
        i += 1
        while i < len(lines):
            t = lines[i].split()
            if not t:
                i += 1; continue
            k = t[0]
            if k == "name": name = " ".join(t[1:]).strip('"')
            elif k == "loc": loc = list(map(float, t[1:4]))
            elif k == "rot": rot = list(map(float, t[1:10]))
            elif k == "data": i += 1
            elif k == "texture" or k == "texrep" or k == "crease" or k == "url" or k == "texoff" or k == "subdiv": pass
            elif k == "numvert":
                n = int(t[1])
                verts = [list(map(float, lines[i + 1 + j].split()[:3])) for j in range(n)]
                i += n
            elif k == "numsurf":
                for _ in range(int(t[1])):
                    i += 1
                    flags, mat = int(lines[i].split()[1], 0), 0
                    i += 1
                    if lines[i].startswith("mat"): mat = int(lines[i].split()[1]); i += 1
                    nref = int(lines[i].split()[1])
                    refs = [int(lines[i + 1 + j].split()[0]) for j in range(nref)]
                    i += nref
                    if flags & 0xF == 0 and nref >= 3: surfs.append((mat, refs))
            elif k == "kids":
                kids = int(t[1]); i += 1; break
            i += 1
        # world transform: parent_m * (rot, loc)
        m = [sum(parent_m[r * 3 + q] * rot[q * 3 + c] for q in range(3)) for r in range(3) for c in range(3)]
        tr = [parent_t[r] + sum(parent_m[r * 3 + q] * loc[q] for q in range(3)) for r in range(3)]
        keep = not DROP.search(name)
        if keep:
            w = [[sum(m[r * 3 + c] * v[c] for c in range(3)) + tr[r] for r in range(3)] for v in verts]
            for mat, refs in surfs:
                for j in range(1, len(refs) - 1):
                    tris.append((w[refs[0]], w[refs[j]], w[refs[j + 1]], mat))
        for _ in range(kids):
            while i < len(lines) and not lines[i].startswith("OBJECT"): i += 1
            if keep: obj(m, tr)
            else: skip()

    def skip():
        nonlocal i
        kids = 0
        i += 1
        while i < len(lines):
            t = lines[i].split()
            if t and t[0] == "numvert": i += int(t[1])
            elif t and t[0] == "numsurf":
                for _ in range(int(t[1])):
                    i += 2
                    if lines[i].startswith("mat"): i += 1
                    i += int(lines[i].split()[1])
            elif t and t[0] == "data": i += 1
            elif t and t[0] == "kids":
                kids = int(t[1]); i += 1; break
            i += 1
        for _ in range(kids):
            while i < len(lines) and not lines[i].startswith("OBJECT"): i += 1
            skip()

    while i < len(lines):
        if lines[i].startswith("MATERIAL"):
            t = lines[i].split()
            r = t.index("rgb"); tr = t.index("trans")
            mats.append(([float(x) for x in t[r + 1:r + 4]], float(t[tr + 1])))
            i += 1
        elif lines[i].startswith("OBJECT"):
            obj([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]); break
        else: i += 1
    return mats, tris


def cluster(tris, budget):
    """Vertex clustering: snap to a grid whose cell grows until the triangle count fits the budget."""
    xs = [c for t in tris for v in t[:3] for c in v]
    span = max(max(xs[k::3]) - min(xs[k::3]) for k in range(3))
    cell = span / 400
    while True:
        seen, out = set(), []
        for a, b, c, col in tris:
            q = [tuple(round(x / cell) for x in v) for v in (a, b, c)]
            if q[0] == q[1] or q[1] == q[2] or q[0] == q[2]: continue
            key = tuple(sorted(q))
            if key in seen: continue
            seen.add(key)
            out.append(([[x * cell for x in v] for v in q], col))
        if len(out) <= budget: return out, cell
        cell *= 1.25


def build(af, src):
    repo = src / af["repo"]
    tris, colours = [], []
    for f in af["files"]:
        f, off = f if isinstance(f, tuple) else (f, [0, 0, 0])
        mats, ts = parse_ac(repo / f)
        # FlightGear offsets are x aft, y right, z up; AC3D vertices are x aft, y up, z right... converted below via ac (x, y, z) = (x+ox, y+oz, z+oy)
        ts = [tuple([v[0] + off[0], v[1] + off[2], v[2] + off[1]] for v in t[:3]) + (t[3],) for t in ts]
        for a, b, c, mat in ts:
            rgb, trans = mats[mat] if mat < len(mats) else ([0.8] * 3, 0)
            if trans > 0.5: continue
            # AC3D is y-up with the nose toward -x in FlightGear models -> map mesh axes (+x forward, +y left, +z up).
            tris.append(tuple([-v[0], -v[2], v[1]] for v in (a, b, c)) + (tuple(round(x, 2) for x in rgb),))
    raw = len(tris)
    out, cell = cluster(tris, BUDGET)
    zmin = min(v[2] for t, _ in out for v in t)
    # Centre length and span on the origin so the reported position is the middle of the airframe and it turns about that point.
    mid = [(min(v[k] for t, _ in out for v in t) + max(v[k] for t, _ in out for v in t)) / 2 for k in range(2)]
    pos, nor, col = [], [], []
    for t, c in out:
        t = [[v[0] - mid[0], v[1] - mid[1], v[2] - zmin] for v in t]
        u = [t[1][k] - t[0][k] for k in range(3)]; w = [t[2][k] - t[0][k] for k in range(3)]
        n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
        l = math.sqrt(sum(x * x for x in n)) or 1
        for v in t: pos += v; nor += [x / l for x in n]; col += list(c)
    ext = [max(pos[k::3]) - min(pos[k::3]) for k in range(3)]
    blob = struct.pack("<I", len(pos) // 3) + struct.pack(f"<{len(pos)}f", *pos) + struct.pack(f"<{len(nor)}f", *nor) + struct.pack(f"<{len(col)}f", *col)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / f"{af['id']}.bin").write_bytes(blob)
    sha = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    lic_file = next(f for f in ("COPYING", "COPYING.txt", "LICENSE", "License.txt") if (repo / f).exists())
    lic = (repo / lic_file).read_text(errors="replace")[:200]
    assert "GNU GENERAL PUBLIC LICENSE" in lic, f"{af['repo']}: {lic_file} is not a GPL licence"
    return {"id": af["id"], "types": af["types"], "repo": f"https://github.com/FGMEMBERS/{af['repo']}", "commit": sha,
            "files": [f if isinstance(f, str) else f[0] for f in af["files"]], "license": "GPL-3.0" if "Version 3" in lic else "GPL-2.0", "triangles": len(out),
            "sourceTriangles": raw, "extentM": [round(x, 3) for x in ext], "sha256": hashlib.sha256(blob).hexdigest()}


if __name__ == "__main__":
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/fg")
    models = [build(af, src) for af in AIRFRAMES]
    MANIFEST.write_text(json.dumps({"source": "FlightGear FGMEMBERS aircraft models (GPL)", "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "models": models}, indent=1) + "\n")
    for m in models: print(m["id"], m["triangles"], "of", m["sourceTriangles"], "extent", m["extentM"])
