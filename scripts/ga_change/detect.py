"""Georgia change detection from public Sentinel-2 L2A imagery.

Stage 1 (statewide baseline): per-pixel NDVI / NBR differencing between an
anniversary-date pair (current window vs. same window one year earlier) on
80 m overview reads, SCL cloud/shadow masking, H3 res-8 medians, robust
per-tile z-scores (median / MAD), contiguity, and persistence across a second
independent date pair.

Stage 2 (open GeoFM): Prithvi-EO-2.0-100M-TL (NASA/IBM, Apache-2.0) encoder
embeddings of 224x224 30 m chips for both dates; cosine distance of the
central tokens, scored against randomly drawn control cells.

Output: public/geo/ga-change.json (aggregate H3 cells only).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import random
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import h3
import numpy as np
import rasterio
import torch
from huggingface_hub import hf_hub_download
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.warp import transform as warp_transform
from rasterio.windows import from_bounds
from shapely.geometry import Point, shape
from shapely.prepared import prep

REPO = Path(__file__).resolve().parents[2]
WALL = REPO / "public/geo/ga-wall.geojson"
OUT = REPO / "public/geo/ga-change.json"

STAC = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
BANDS = ["blue", "green", "red", "nir08", "swir16", "swir22"]  # HLS/Prithvi order: B02 B03 B04 B8A B11 B12
CLEAR_SCL = {4, 5, 6}  # vegetation, not-vegetated, water
PIXEL_M = 80
H3_RES = 8
MIN_VALID_PX = 40
MIN_CLEAR_FRAC = 0.6
MIN_TILE_CELLS = 300
Z_FLAG = 3.5
Z_PERSIST = 3.0
Z_SINGLE = 6.0
GEOFM_Z = 2.0
MAX_CELLS = 300
N_CONTROLS = 200
CHIP = 224
CHIP_M = 30
CENTRE_TOKENS = 4
MAX_CLOUD = 40
MODEL_REPO = "ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL"
MODEL_FILE = "Prithvi_EO_V2_100M_TL.pt"
MODEL_REV = "2c84e383194986040f883cc43d7869002c425e1b"
# Prithvi-EO-2.0 HLS normalisation (reflectance x 10000), from the model card config.
MEAN = np.array([1087.0, 1342.0, 1433.0, 2734.0, 1958.0, 1363.0], dtype=np.float32)
STD = np.array([2248.0, 2179.0, 2178.0, 1850.0, 1242.0, 1049.0], dtype=np.float32)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def ga_polygon():
    g = json.loads(WALL.read_text())
    f = next(f for f in g["features"] if f["properties"].get("part") == "path")
    geom = f["geometry"]
    if geom["type"] == "LineString":
        geom = {"type": "Polygon", "coordinates": [geom["coordinates"]]}
    return shape(geom).buffer(0)


def mgrs(item) -> str:
    p = item.properties
    return f'{p["mgrs:utm_zone"]}{p["mgrs:latitude_band"]}{p["mgrs:grid_square"]}'


def rank(item) -> float:
    p = item.properties
    return p.get("eo:cloud_cover", 100) + p.get("s2:nodata_pixel_percentage", 100)


def search(poly, start: dt.date, end: dt.date):
    items = Client.open(STAC).search(
        collections=[COLLECTION],
        intersects=poly.simplify(0.05).__geo_interface__,
        datetime=f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
        max_items=5000,
    ).item_collection()
    by: dict[str, list] = {}
    for it in items:
        by.setdefault(mgrs(it), []).append(it)
    for v in by.values():
        v.sort(key=rank)
    return by


def pick_two(items):
    """Best and next-best scenes on different dates (independent acquisitions)."""
    if not items:
        return None, None
    first = items[0]
    second = next((i for i in items[1:] if i.datetime.date() != first.datetime.date()), None)
    return first, second


def to_refl(dn: np.ndarray, item) -> np.ndarray:
    """DN -> reflectance x 10000 (HLS scale); NaN for nodata.

    Earth Search COGs flagged ``earthsearch:boa_offset_applied`` already have the
    processing-baseline >= 04.00 BOA offset removed (dense-vegetation red DN ~150-300);
    otherwise the +1000 offset is still present for baseline >= 04.00.
    """
    p = item.properties
    baseline = float(p.get("s2:processing_baseline", "0") or 0)
    off = 1000.0 if baseline >= 4.0 and not p.get("earthsearch:boa_offset_applied") else 0.0
    out = dn.astype(np.float32) - off
    out[dn == 0] = np.nan
    return out


def read_overview(item, shape_px: int):
    bands = {}
    for b in BANDS + ["scl"]:
        with rasterio.open(item.assets[b].href) as ds:
            rs = Resampling.nearest if b == "scl" else Resampling.average
            arr = ds.read(1, out_shape=(shape_px, shape_px), resampling=rs)
            if b == "scl":
                bands[b] = arr
                transform = ds.transform * ds.transform.scale(ds.width / shape_px, ds.height / shape_px)
                crs = ds.crs
            else:
                bands[b] = to_refl(arr, item)
    return bands, transform, crs


def indices(b):
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (b["nir08"] - b["red"]) / (b["nir08"] + b["red"])
        nbr = (b["nir08"] - b["swir22"]) / (b["nir08"] + b["swir22"])
    clear = np.isin(b["scl"], list(CLEAR_SCL)) & np.isfinite(ndvi) & np.isfinite(nbr)
    return ndvi, nbr, clear


def group_median(keys: np.ndarray, vals: np.ndarray, n: int) -> np.ndarray:
    out = np.full(n, np.nan, dtype=np.float32)
    if not len(keys):
        return out
    order = np.lexsort((vals, keys))
    k, v = keys[order], vals[order]
    starts = np.flatnonzero(np.r_[True, k[1:] != k[:-1]])
    ends = np.r_[starts[1:], len(k)]
    mids_lo = starts + (ends - starts - 1) // 2
    mids_hi = starts + (ends - starts) // 2
    out[k[starts]] = (v[mids_lo] + v[mids_hi]) / 2
    return out


def robust_z(x: np.ndarray) -> np.ndarray:
    ok = np.isfinite(x)
    med = np.median(x[ok])
    mad = np.median(np.abs(x[ok] - med)) * 1.4826
    return (x - med) / (mad if mad > 1e-6 else 1e-6)


def pair_stats(t1, t2, cell_idx, n_cells, total_px):
    n1, b1, c1 = indices(t1)
    n2, b2, c2 = indices(t2)
    valid = c1 & c2 & (cell_idx >= 0)
    keys = cell_idx[valid]
    d_ndvi = group_median(keys, (n2 - n1)[valid], n_cells)
    d_nbr = group_median(keys, (b2 - b1)[valid], n_cells)
    count = np.bincount(keys, minlength=n_cells)
    frac = np.divide(count, total_px, out=np.zeros(n_cells), where=total_px > 0)
    ok = (count >= MIN_VALID_PX) & (frac >= MIN_CLEAR_FRAC)
    d_ndvi[~ok] = np.nan
    d_nbr[~ok] = np.nan
    return d_ndvi, d_nbr, count, frac


def scene_meta(item):
    return {
        "id": item.id,
        "date": item.datetime.date().isoformat(),
        "cloud": round(item.properties.get("eo:cloud_cover", float("nan")), 1),
        "url": f"{STAC}/collections/{COLLECTION}/items/{item.id}",
    }


def process_tile(tile, cur, base, poly_prep):
    a2, b2 = pick_two(cur)
    a1, b1 = pick_two(base)
    if not (a1 and a2):
        return None
    px = int(round(109800 / PIXEL_M))
    t2, transform, crs = read_overview(a2, px)
    t1, _, _ = read_overview(a1, px)
    rows, cols = np.mgrid[0:px, 0:px]
    xs, ys = rasterio.transform.xy(transform, rows.ravel(), cols.ravel())
    lon, lat = warp_transform(crs, "EPSG:4326", np.asarray(xs), np.asarray(ys))
    cells = [h3.latlng_to_cell(la, lo, H3_RES) for la, lo in zip(lat, lon)]
    uniq, inv = np.unique(np.asarray(cells), return_inverse=True)
    inside = np.array([poly_prep.contains(Point(h3.cell_to_latlng(c)[::-1])) for c in uniq])
    cell_idx = np.where(inside[inv], inv, -1).reshape(px, px)
    total_px = np.bincount(cell_idx[cell_idx >= 0], minlength=len(uniq))
    dA_ndvi, dA_nbr, countA, fracA = pair_stats(t1, t2, cell_idx, len(uniq), total_px)
    res = {
        "tile": tile, "cells": uniq, "dA_ndvi": dA_ndvi, "dA_nbr": dA_nbr, "countA": countA, "fracA": fracA,
        "pairA": [scene_meta(a1), scene_meta(a2)], "pairB": None, "crs": str(crs), "itemsA": (a1, a2), "itemsB": None,
    }
    if b1 and b2:
        u2, _, _ = read_overview(b2, px)
        u1, _, _ = read_overview(b1, px)
        res["dB_ndvi"], res["dB_nbr"], _, _ = pair_stats(u1, u2, cell_idx, len(uniq), total_px)
        res["pairB"] = [scene_meta(b1), scene_meta(b2)]
        res["itemsB"] = (b1, b2)
    return res


def load_model():
    sys.path.insert(0, str(Path(__file__).parent))
    from prithvi_mae import PrithviViT  # noqa: E402  (vendored from the model repo, Apache-2.0)

    model = PrithviViT(
        img_size=CHIP, patch_size=(1, 16, 16), num_frames=1, in_chans=6, embed_dim=768, depth=12,
        num_heads=12, mlp_ratio=4, coords_encoding=["time", "location"], coords_scale_learn=True,
    )
    path = hf_hub_download(MODEL_REPO, MODEL_FILE, revision=MODEL_REV)
    sd = torch.load(path, map_location="cpu", weights_only=True)
    sd = {k[len("encoder."):]: v for k, v in sd.items() if k.startswith("encoder.") and k != "encoder.pos_embed"}
    missing, unexpected = model.load_state_dict(sd, strict=False)
    assert missing == ["pos_embed"] and not unexpected, (missing, unexpected)
    model.eval()
    return model


def read_chip(item, lat, lon):
    with rasterio.open(item.assets["red"].href) as ds:
        crs = ds.crs
    (x,), (y,) = warp_transform("EPSG:4326", crs, [lon], [lat])
    half = CHIP * CHIP_M / 2
    out = []
    for b in BANDS + ["scl"]:
        with rasterio.open(item.assets[b].href) as ds:
            win = from_bounds(x - half, y - half, x + half, y + half, ds.transform)
            rs = Resampling.nearest if b == "scl" else Resampling.average
            arr = ds.read(1, window=win, out_shape=(CHIP, CHIP), resampling=rs, boundless=True, fill_value=0)
            out.append(arr if b == "scl" else to_refl(arr, item))
    refl = np.stack(out[:6])
    clear = np.isin(out[6], list(CLEAR_SCL)) & np.all(np.isfinite(refl), axis=0)
    return refl, clear


def embed(model, refl, lat, lon):
    x = np.nan_to_num((refl - MEAN[:, None, None]) / STD[:, None, None])
    t = torch.from_numpy(x).float()[None, :, None]  # B C T H W
    loc = torch.tensor([[lat, lon]], dtype=torch.float32)
    with torch.no_grad():
        feats = model.forward_features(t, temporal_coords=None, location_coords=loc)[-1][0, 1:]
    g = CHIP // 16
    lo = (g - CENTRE_TOKENS) // 2
    grid = feats.reshape(g, g, -1)[lo:lo + CENTRE_TOKENS, lo:lo + CENTRE_TOKENS]
    return grid.reshape(-1, grid.shape[-1]).mean(0).numpy()


def geofm_distance(model, items, lat, lon):
    try:
        (r1, c1), (r2, c2) = read_chip(items[0], lat, lon), read_chip(items[1], lat, lon)
    except Exception as e:  # network / partial-coverage failures are reported per cell
        return None, f"chip read failed: {type(e).__name__}"
    g = CHIP // 16
    lo = (g - CENTRE_TOKENS) // 2 * 16
    hi = lo + CENTRE_TOKENS * 16
    centre_clear = min(c1[lo:hi, lo:hi].mean(), c2[lo:hi, lo:hi].mean())
    if centre_clear < 0.9:
        return None, f"centre only {centre_clear:.0%} cloud-free"
    e1, e2 = embed(model, r1, lat, lon), embed(model, r2, lat, lon)
    cos = float(np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2)))
    return 1 - cos, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default=dt.date.today().isoformat())
    ap.add_argument("--days", type=int, default=50)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--only", nargs="*", default=None, help="restrict to these MGRS tiles (smoke tests)")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)

    end = dt.date.fromisoformat(args.end)
    start = end - dt.timedelta(days=args.days)
    b_end, b_start = end.replace(year=end.year - 1), start.replace(year=start.year - 1)
    poly = ga_polygon()
    poly_prep = prep(poly)
    cur, base = search(poly, start, end), search(poly, b_start, b_end)
    tiles = sorted(set(cur) & set(base))
    if args.only:
        tiles = [t for t in tiles if t in args.only]
    log(f"tiles with both windows: {len(tiles)} (current {len(cur)}, baseline {len(base)})")

    def run(t):
        try:
            r = process_tile(t, cur[t], base[t], poly_prep)
            log(f"tile {t}: {'ok' if r else 'skipped'}")
            return r
        except Exception as e:
            log(f"tile {t}: failed {type(e).__name__}: {e}")
            return None

    with ThreadPoolExecutor(args.workers) as ex:
        results = [r for r in ex.map(run, tiles) if r]

    # Per-tile robust z, then assign each cell to the tile with the most clear pixels.
    best: dict[str, dict] = {}
    tiles_meta = []
    for r in results:
        valid = np.isfinite(r["dA_ndvi"])
        tiles_meta.append({"mgrs": r["tile"], "pairA": r["pairA"], "pairB": r["pairB"], "cellsScored": int(valid.sum())})
        if valid.sum() < MIN_TILE_CELLS:
            continue
        zA_ndvi, zA_nbr = robust_z(r["dA_ndvi"]), robust_z(r["dA_nbr"])
        zB_ndvi = robust_z(r["dB_ndvi"]) if r["pairB"] and np.isfinite(r["dB_ndvi"]).sum() >= MIN_TILE_CELLS else None
        zB_nbr = robust_z(r["dB_nbr"]) if zB_ndvi is not None else None
        for i in np.flatnonzero(valid):
            c = str(r["cells"][i])
            if c in best and best[c]["countA"] >= r["countA"][i]:
                continue
            zb = None
            if zB_ndvi is not None and np.isfinite(zB_ndvi[i]):
                zb = (float(zB_ndvi[i]), float(zB_nbr[i]))
            best[c] = {
                "tile": r["tile"], "countA": int(r["countA"][i]), "clearA": float(r["fracA"][i]),
                "dNdvi": float(r["dA_ndvi"][i]), "dNbr": float(r["dA_nbr"][i]),
                "zNdvi": float(zA_ndvi[i]), "zNbr": float(zA_nbr[i]), "zB": zb,
                "itemsA": r["itemsA"], "pairA": r["pairA"], "pairB": r["pairB"],
            }
    log(f"cells scored statewide: {len(best)}")

    def lead(v):  # dominant signed index z
        return v["zNdvi"] if abs(v["zNdvi"]) >= abs(v["zNbr"]) else v["zNbr"]

    flagged = {c: v for c, v in best.items() if abs(lead(v)) >= Z_FLAG}
    keep = {}
    for c, v in flagged.items():
        s = np.sign(lead(v))
        neighbours = sum(1 for n in h3.grid_ring(c, 1) if n in flagged and np.sign(lead(flagged[n])) == s)
        if neighbours >= 1 or abs(lead(v)) >= Z_SINGLE:
            v["neighbours"] = neighbours
            keep[c] = v
    ranked = sorted(keep.items(), key=lambda kv: -abs(lead(kv[1])))[:MAX_CELLS]
    log(f"flagged {len(flagged)}, contiguous/strong {len(keep)}, kept {len(ranked)}")

    model = load_model()
    pool = [c for c, v in best.items() if abs(lead(v)) < 2.0]
    controls = random.sample(pool, min(N_CONTROLS, len(pool)))

    def dist_for(c):
        lat, lon = h3.cell_to_latlng(c)
        return geofm_distance(model, best[c]["itemsA"], lat, lon)

    torch.set_num_threads(max(1, args.workers))
    ctrl = [d for d, _ in map(dist_for, controls) if d is not None]
    log(f"controls with GeoFM distance: {len(ctrl)}/{len(controls)}")
    ctrl_arr = np.array(ctrl)
    c_med = float(np.median(ctrl_arr)) if len(ctrl) else float("nan")
    c_mad = float(np.median(np.abs(ctrl_arr - c_med)) * 1.4826) if len(ctrl) else float("nan")

    out_cells = []
    for c, v in ranked:
        d, why = dist_for(c)
        gz = (d - c_med) / c_mad if d is not None and len(ctrl) >= 30 and c_mad > 1e-9 else None
        s = np.sign(lead(v))
        persists = v["zB"] is not None and any(np.sign(z) == s and abs(z) >= Z_PERSIST for z in v["zB"])
        tier = "confirmed" if persists and gz is not None and gz >= GEOFM_Z else "candidate"
        lat, lon = h3.cell_to_latlng(c)
        out_cells.append({
            "h3": c, "lat": round(lat, 5), "lng": round(lon, 5), "tier": tier,
            "kind": "vegetation/surface loss" if s < 0 else "vegetation gain / regrowth",
            "dNdvi": round(v["dNdvi"], 3), "dNbr": round(v["dNbr"], 3),
            "zNdvi": round(v["zNdvi"], 2), "zNbr": round(v["zNbr"], 2),
            "zPersist": [round(z, 2) for z in v["zB"]] if v["zB"] else None, "persists": bool(persists),
            "neighbours": v["neighbours"], "clear": round(v["clearA"], 2),
            "geofmDist": round(d, 4) if d is not None else None, "geofmZ": round(gz, 2) if gz is not None else None,
            "geofmNote": why, "mgrs": v["tile"], "pairA": v["pairA"], "pairB": v["pairB"],
        })
        log(f"{c} {tier} z={lead(v):+.1f} geofmZ={gz}")

    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Copernicus Sentinel-2 L2A (ESA), via Element 84 Earth Search STAC on AWS Open Data",
        "sourceUrl": f"{STAC}/collections/{COLLECTION}",
        "model": {
            "name": "Prithvi-EO-2.0-100M-TL", "by": "NASA / IBM / Jülich", "license": "Apache-2.0",
            "url": f"https://huggingface.co/{MODEL_REPO}", "revision": MODEL_REV,
        },
        "windows": {"current": [start.isoformat(), end.isoformat()], "baseline": [b_start.isoformat(), b_end.isoformat()]},
        "method": {
            "pixelM": PIXEL_M, "h3Res": H3_RES, "clearScl": sorted(CLEAR_SCL), "minClearFrac": MIN_CLEAR_FRAC,
            "zFlag": Z_FLAG, "zPersist": Z_PERSIST, "zSingle": Z_SINGLE, "geofmZ": GEOFM_Z,
            "chip": f"{CHIP}x{CHIP} px at {CHIP_M} m, centre {CENTRE_TOKENS}x{CENTRE_TOKENS} tokens, no temporal coords",
            "summary": (
                "Anniversary-date NDVI/NBR differencing on cloud-masked Sentinel-2 L2A, H3 res-8 medians, robust z "
                "(median/MAD) per MGRS tile; flagged at |z|>=3.5 with >=1 same-sign neighbour or |z|>=6. Confirmed "
                "when a second independent date pair agrees (|z|>=3) and the Prithvi-EO-2.0 embedding distance is "
                ">=2 robust z above random control cells. Not validated against labelled change benchmarks."
            ),
        },
        "controls": {"n": len(ctrl), "median": round(c_med, 4) if ctrl else None, "mad": round(c_mad, 4) if ctrl else None},
        "tiles": tiles_meta,
        "summary": {
            "cellsScored": len(best), "flagged": len(out_cells),
            "confirmed": sum(c["tier"] == "confirmed" for c in out_cells),
            "candidate": sum(c["tier"] == "candidate" for c in out_cells),
        },
        "cells": out_cells,
    }
    out = Path(args.out)
    out.write_text(json.dumps(payload, separators=(",", ":")))
    log(f"wrote {out} ({out.stat().st_size // 1024} KB): {payload['summary']}")


if __name__ == "__main__":
    main()
