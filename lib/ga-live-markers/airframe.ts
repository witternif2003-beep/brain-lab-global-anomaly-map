import { gaMesh, type GaModelKind } from '../ga-mesh-models';
import ACD from './faa-acd.json';

/**
 * ICAO Doc 8643 type designator (readsb/adsb.fi `t`) → low-poly airframe and scale.
 * Scales are approximate overall length relative to each mesh (airliner ≈ B738 39 m, regionaljet ≈ 35 m,
 * widebody ≈ 60 m, lightplane ≈ C172 7.5 m). Unlisted types fall back to the ADS-B emitter category.
 */
export type Airframe = [GaModelKind, number];

const T = (kind: GaModelKind, entries: Record<string, number>) => Object.entries(entries).map(([t, s]): [string, Airframe] => [t, [kind, s]]);

const TYPES: ReadonlyMap<string, Airframe> = new Map<string, Airframe>([
  ...T('widebody', {
    A306: 0.9, A30B: 0.9, A310: 0.78, A332: 0.98, A333: 1.06, A337: 1.06, A338: 0.98, A339: 1.06, A342: 1.0, A343: 1.06, A345: 1.12, A346: 1.25,
    A359: 1.11, A35K: 1.23, A388: 1.21, B741: 1.18, B742: 1.18, B743: 1.18, B744: 1.18, B748: 1.27, B74S: 0.94, B762: 0.81, B763: 0.92, B764: 1.03,
    B772: 1.06, B77L: 1.06, B773: 1.23, B77W: 1.23, B778: 1.17, B779: 1.27, B788: 0.95, B789: 1.05, B78X: 1.14, MD11: 1.02, DC10: 0.92, L101: 0.9,
    IL96: 0.92, C17: 0.88, C5M: 1.25, K35E: 0.71, K35R: 0.71, KC2: 0.98, KC46: 0.84,
  }),
  ...T('airliner', {
    A318: 0.8, A319: 0.88, A19N: 0.88, A320: 0.96, A20N: 0.96, A321: 1.15, A21N: 1.15, B731: 0.75, B732: 0.78, B733: 0.86, B734: 0.94, B735: 0.8,
    B736: 0.81, B737: 0.86, B738: 1.0, B739: 1.08, B37M: 0.92, B38M: 1.0, B39M: 1.08, B3XM: 1.12, B752: 1.21, B753: 1.39, B721: 1.05, B722: 1.2,
    BCS1: 0.9, BCS3: 0.98, E170: 0.77, E75S: 0.81, E75L: 0.81, E190: 0.93, E195: 0.99, E290: 0.93, E295: 1.07, C919: 1.0, A400: 1.16, C130: 0.77, C30J: 0.77,
  }),
  ...T('regionaljet', {
    CRJ1: 0.74, CRJ2: 0.74, CRJ7: 0.9, CRJ9: 1.0, CRJX: 1.08, E135: 0.73, E35L: 0.73, E145: 0.83, E45X: 0.83, B712: 1.05, DC91: 0.87, DC93: 1.03,
    DC95: 1.16, MD81: 1.25, MD82: 1.25, MD83: 1.25, MD87: 1.1, MD88: 1.25, MD90: 1.29, F28: 0.75, F70: 0.85, F100: 0.98,
  }),
  // Turboprop airliners: the high-wing light-plane mesh scaled up.
  ...T('lightplane', {
    AT43: 3.0, AT45: 3.0, AT72: 3.6, AT75: 3.6, AT76: 3.6, DH8A: 3.0, DH8B: 3.0, DH8C: 3.4, DH8D: 4.4, SF34: 2.6, JS41: 2.6, E120: 2.7, D328: 2.8,
    SW4: 2.4, B190: 2.3, C208: 1.5, P208: 1.0, PC12: 1.9, BE20: 1.8, BE9L: 1.4, BE9T: 1.4, TBM7: 1.4, TBM9: 1.4,
    C510: 1.6, C525: 1.7, C25A: 1.8, C25B: 2.0, C25C: 2.2, C560: 2.1, C56X: 2.2, C650: 2.3, C680: 2.6, C68A: 2.8, C700: 2.8, C750: 3.0,
    E50P: 1.7, E55P: 2.1, E545: 2.6, E550: 2.7, HDJT: 1.7, SF50: 1.3, EA50: 1.4, PC24: 2.3, BE40: 2.1, H25B: 2.1, LJ35: 2.0, LJ45: 2.3, LJ60: 2.4, LJ75: 2.4,
    CL30: 2.8, CL35: 2.8, CL60: 2.8, F2TH: 2.7, F900: 2.8, FA50: 2.5, FA7X: 3.1, FA8X: 3.3, GLF4: 3.0, GLF5: 3.2, GLF6: 4.0, GA5C: 3.2, GA6C: 3.6,
    GL5T: 3.9, GL7T: 4.4, GLEX: 4.0,
  }),
  ...T('helicopter', {
    R22: 0.8, R44: 0.95, R66: 1.0, H269: 0.8, EC20: 0.85, EC30: 1.05, EC35: 1.05, EC45: 1.15, EC55: 1.2, EC75: 1.45, AS50: 1.05, AS55: 1.05, AS65: 1.15,
    AS32: 1.55, B06: 1.0, B06T: 1.0, B407: 1.05, B427: 1.0, B429: 1.05, B430: 1.15, B412: 1.4, B212: 1.4, B505: 0.95, B47G: 0.85, UH1: 1.4, H500: 0.8,
    MD52: 0.85, MD60: 0.9, A109: 1.15, A119: 1.1, A139: 1.35, A169: 1.25, A189: 1.4, S76: 1.3, S92: 1.6, H60: 1.6, H47: 2.5, EN28: 0.8, EN48: 0.85, G2CA: 0.7,
  }),
]);

/** ADS-B emitter category → generic airframe (DO-260B: A1 light, A2 small, A3 large, A4 high-vortex, A5 heavy, A6 high-performance, A7 rotorcraft). */
const BY_CATEGORY: Record<string, Airframe> = {
  A1: ['lightplane', 1], A2: ['lightplane', 1.6], A3: ['airliner', 0.9], A4: ['airliner', 1.1], A5: ['widebody', 1], A6: ['lightplane', 1.4], A7: ['helicopter', 1],
};

export function airframeFor(type: unknown, category: unknown): Airframe {
  const t = typeof type === 'string' ? type.trim().toUpperCase() : '';
  return TYPES.get(t) ?? BY_CATEGORY[String(category)] ?? (t ? ['lightplane', 1] : ['airliner', 0.8]);
}

export function airframeKnown(type: unknown): boolean {
  return typeof type === 'string' && TYPES.has(type.trim().toUpperCase());
}

export interface FaaSpec {
  model: string; lengthFt: number; spanFt: number; tailFt: number; engine: string; engines: number | null; adg: string | null; wake: string | null;
}
const FAA = ACD.types as Record<string, FaaSpec>;
export const FAA_ACD = { source: ACD.source, sourceUrl: ACD.sourceUrl, sha256: ACD.sha256, retrievedAt: ACD.retrievedAt } as const;

const norm = (type: unknown) => (typeof type === 'string' ? type.trim().toUpperCase() : '');
export const faaSpec = (type: unknown): FaaSpec | null => FAA[norm(type)] ?? null;

const FT_M = 0.3048;
const extents = new Map<GaModelKind, [number, number, number]>();
/** Mesh length (x), wingspan (y) and height above its wheels (z), in metres. */
export function meshExtent(kind: GaModelKind): [number, number, number] {
  let e = extents.get(kind);
  if (e) return e;
  const p = gaMesh(kind).attributes.positions.value;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], p[i]);
    hi[i % 3] = Math.max(hi[i % 3], p[i]);
  }
  extents.set(kind, (e = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - Math.min(0, lo[2])]));
  return e;
}

function kindFromFaa(s: FaaSpec): GaModelKind {
  if (s.engine !== 'Jet') return 'lightplane';
  return s.spanFt >= 140 ? 'widebody' : s.spanFt >= 100 ? 'airliner' : 'regionaljet';
}

/**
 * Shape plus per-axis scale. Types in the FAA Aircraft Characteristics Database are stretched so the mesh's
 * length, wingspan and tail height equal the FAA figures; other types keep the approximate uniform scale.
 */
export function airframeModel(type: unknown, category: unknown): { kind: GaModelKind; scale: [number, number, number]; faa: FaaSpec | null } {
  const [listed, s] = airframeFor(type, category);
  const spec = faaSpec(type);
  if (!spec) return { kind: listed, scale: [s, s, s], faa: null };
  // Business jets have rear-mounted engines, so the regional-jet mesh is the closer shape than the high-wing prop.
  const kind = TYPES.has(norm(type)) ? (spec.engine === 'Jet' && listed === 'lightplane' ? 'regionaljet' : listed) : kindFromFaa(spec);
  const [lx, ly, lz] = meshExtent(kind);
  return { kind, scale: [(spec.lengthFt * FT_M) / lx, (spec.spanFt * FT_M) / ly, (spec.tailFt * FT_M) / lz], faa: spec };
}
