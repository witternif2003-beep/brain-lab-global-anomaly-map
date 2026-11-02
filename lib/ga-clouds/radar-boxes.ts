/** Radar cells → exact 3D boxes: footprint = the radar cell, bottom = measured METAR base over the ground, top = MRMS echo top (pure). */
import { CELL_STRIDE, RADAR_BANDS, bandOf, haversineKm, type RadarCells } from './radar-clouds';
import { nightFactor } from '../terminator/night-mask';
import { subsolarPoint, sunAltitudeDeg } from '../terminator/solar';

export interface CloudBox {
  /** Cell corners (lng, lat), closed ring. */
  polygon: [number, number][];
  lng: number;
  lat: number;
  /** Metres above sea level. */
  baseMsl: number;
  topMsl: number;
  /** Null when no station measured a base within BASE_SEARCH_KM: the box is then only the measured top surface. */
  baseAglM: number | null;
  dbz: number;
  band: string;
  station: string | null;
  stationKm: number | null;
  observed: string | null;
  color: [number, number, number, number];
}

const DAY: [number, number, number] = [255, 255, 255];
const NIGHT: [number, number, number] = [172, 186, 212];
/** Opacity per reflectivity band: stronger echoes draw denser. */
const ALPHA = [150, 175, 200, 225];

/**
 * `groundM` is the true ground height (m above sea level) at a point; the METAR base is reported above ground at the
 * station, so it is added to the ground under the cell. Cells with no base in range, or whose echo top is not above
 * that base, are drawn as a flat surface at the echo top (zero thickness) rather than with a guessed base.
 */
export function radarCloudBoxes(rc: RadarCells, groundM: (lng: number, lat: number) => number, now: Date): CloudBox[] {
  const out: CloudBox[] = [];
  const h = rc.stepDeg / 2;
  const sun = subsolarPoint(now);
  for (let i = 0; i + CELL_STRIDE <= rc.cells.length; i += CELL_STRIDE) {
    const [x, y, topMsl, dbz, si] = rc.cells.slice(i, i + CELL_STRIDE);
    const st = si >= 0 ? rc.stations[si] : undefined;
    const lng = rc.lng0 + x * rc.stepDeg;
    const lat = rc.lat0 - y * rc.stepDeg;
    const measuredBase = st ? groundM(lng, lat) + st.baseM : Infinity;
    const baseMsl = measuredBase < topMsl ? measuredBase : topMsl;
    const b = bandOf(dbz);
    const night = nightFactor(sunAltitudeDeg(sun, lng, lat));
    const rgb = DAY.map((d, k) => Math.round((d + (NIGHT[k] - d) * night) * (1 - 0.06 * b)));
    const r = (v: number) => Math.round(v * 1e5) / 1e5;
    out.push({
      polygon: [[r(lng - h), r(lat + h)], [r(lng + h), r(lat + h)], [r(lng + h), r(lat - h)], [r(lng - h), r(lat - h)], [r(lng - h), r(lat + h)]],
      lng, lat, baseMsl, topMsl, baseAglM: st?.baseM ?? null, dbz, band: RADAR_BANDS[b][0], station: st?.id ?? null,
      stationKm: st ? Math.round(haversineKm(lat, lng, st.lat, st.lng) * 10) / 10 : null, observed: st?.observed ?? null,
      color: [rgb[0], rgb[1], rgb[2], ALPHA[b]],
    });
  }
  return out;
}
