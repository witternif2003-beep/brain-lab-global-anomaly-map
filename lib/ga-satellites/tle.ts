import { degreesLat, degreesLong, degreesToRadians, ecfToLookAngles, eciToEcf, eciToGeodetic, gstime, propagate, type SatRec } from "satellite.js";

export interface TleEntry {
  name: string;
  norad: number;
  group: string;
  line1: string;
  line2: string;
  epoch: string;
}

export interface SatPosition {
  lon: number;
  lat: number;
  altKm: number;
  speedKmS: number;
}

/** TLE line 1 columns 19–32 hold the epoch as YYDDD.DDDDDDDD (years 57–99 are 1900s). */
export function tleEpoch(line1: string): string {
  const yy = Number(line1.slice(18, 20));
  const day = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000).toISOString();
}

function entry(name: string, line1: string, line2: string, group: string): TleEntry | null {
  const norad = Number(line1.slice(2, 7));
  if (!line1.startsWith("1 ") || !line2.startsWith("2 ") || !Number.isInteger(norad)) return null;
  return { name: name.replace(/^0 /, "").trim(), norad, group, line1, line2, epoch: tleEpoch(line1) };
}

/** Parses three-line (name + 2 element lines) TLE text. */
export function parseTle(text: string, group: string): TleEntry[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out: TleEntry[] = [];
  for (let i = 0; i + 2 < lines.length; ) {
    if (lines[i + 1].startsWith("1 ") && lines[i + 2].startsWith("2 ")) {
      const e = entry(lines[i], lines[i + 1], lines[i + 2], group);
      if (e) out.push(e);
      i += 3;
    } else i += 1;
  }
  return out;
}

export interface SatnogsTle {
  tle0: string;
  tle1: string;
  tle2: string;
}

export function fromSatnogs(rows: SatnogsTle[], group: string): TleEntry[] {
  return rows.flatMap((r) => entry(r.tle0, r.tle1, r.tle2, group) ?? []);
}

export function dedupeByNorad(entries: TleEntry[]): TleEntry[] {
  const seen = new Set<number>();
  return entries.filter((e) => (seen.has(e.norad) ? false : (seen.add(e.norad), true)));
}

/** SGP4 sub-satellite point at `date`, or null when the propagator rejects the elements (e.g. decayed). */
export function subPoint(satrec: SatRec, date: Date): SatPosition | null {
  const pv = propagate(satrec, date);
  if (!pv || typeof pv.position !== "object") return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const { x, y, z } = pv.velocity;
  const lon = degreesLong(geo.longitude);
  const lat = degreesLat(geo.latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(geo.height)) return null;
  return { lon, lat, altKm: geo.height, speedKmS: Math.sqrt(x * x + y * y + z * z) };
}

/** Central Georgia, used as the reference observer for "above the horizon from Georgia". */
export const GA_OBSERVER = { lat: 32.68, lon: -83.22, heightKm: 0.1 };

/** Elevation of the satellite above the local horizon at `observer`, in degrees, or null if propagation fails. */
export function elevationDeg(satrec: SatRec, date: Date, observer = GA_OBSERVER): number | null {
  const pv = propagate(satrec, date);
  if (!pv || typeof pv.position !== "object") return null;
  const look = ecfToLookAngles(
    { latitude: degreesToRadians(observer.lat), longitude: degreesToRadians(observer.lon), height: observer.heightKm },
    eciToEcf(pv.position, gstime(date)),
  );
  return (look.elevation * 180) / Math.PI;
}
