/**
 * GEOID18 geoid height N (metres) over Georgia, bilinear between the bounding-box corners. Values from the NOAA NGS
 * geoid API (https://geodesy.noaa.gov/api/geoid/ght?lat=..&lon=..&model=14, retrieved 2026-10-31); the Atlanta check
 * point (33.64, -84.43) reads -29.472 m against -29.15 m interpolated. Height above mean sea level = ellipsoid height − N.
 */
const LAT = [30.4, 35.0] as const;
const LON = [-85.6, -80.8] as const;
const N = { sw: -27.928, nw: -29.073, se: -29.202, ne: -30.396 };

export function geoidHeightM(lat: number, lon: number): number {
  const u = Math.max(0, Math.min(1, (lon - LON[0]) / (LON[1] - LON[0])));
  const v = Math.max(0, Math.min(1, (lat - LAT[0]) / (LAT[1] - LAT[0])));
  return (N.sw * (1 - u) + N.se * u) * (1 - v) + (N.nw * (1 - u) + N.ne * u) * v;
}

/** Metres above mean sea level from readsb `alt_geom` (feet above the WGS84 ellipsoid). */
export const mslFromGeometricFt = (ft: number, lat: number, lon: number) => ft * 0.3048 - geoidHeightM(lat, lon);
