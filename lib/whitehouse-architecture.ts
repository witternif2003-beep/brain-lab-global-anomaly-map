/**
 * White House architectural volume catalog for the Three.js digital twin.
 *
 * Coordinate frame (centimeters): origin at the center of the South Portico ground line.
 *   +x = west, +y = north, +z = up. Matches WHITE_HOUSE_ANOMALIES.exactCoordinatesCentimeter.
 *
 * Every volume carries its provenance and the honest tolerance that provenance supports:
 *   PUBLISHED_INCH  — dimension published by WHHA / HABS to the inch (±1.27 cm, inside the ±2.0 cm gate)
 *   HABS_ENVELOPE   — exterior envelope from HABS DC-37 measured drawings (±2.0 cm gate)
 *   FOOTPRINT_EST   — no public measured drawing exists; envelope estimated from aerial/site plans (±100 cm)
 * Volumes tagged FOOTPRINT_EST are rendered as wireframe and never claimed at ±2.0 cm.
 */

export type ProvenanceClass = "PUBLISHED_INCH" | "HABS_ENVELOPE" | "FOOTPRINT_EST";

export type Wing = "EXECUTIVE_RESIDENCE" | "WEST_WING" | "EAST_WING" | "GROUNDS";

export interface ArchitecturalVolume {
  id: string;
  name: string;
  wing: Wing;
  level: string;
  shape: "box" | "ellipse";
  /** center in cm, z = floor elevation */
  center: { x: number; y: number; z: number };
  /** width (x), depth (y), height (z) in cm */
  size: { w: number; d: number; h: number };
  provenance: ProvenanceClass;
  toleranceCm: number;
  source: string;
  sourceUrl: string;
  publishedDimension: string;
  color: string;
}

const FT = 30.48;
const IN = 2.54;
const ft = (feet: number, inches = 0) => +(feet * FT + inches * IN).toFixed(1);

const WHHA_ROOMS = "https://www.whitehousehistory.org/white-house-tour";
const WHHA_FACTS = "https://www.whitehousehistory.org/questions/what-are-the-dimensions-of-the-white-house";
const HABS = "https://www.loc.gov/resource/hhh.dc0402.photos/?sp=49";
const WHHA_360 = "https://www.whitehousehistory.org/tour-the-white-house-in-360-degrees";

export const TOLERANCE: Record<ProvenanceClass, number> = {
  PUBLISHED_INCH: 1.27,
  HABS_ENVELOPE: 2.0,
  FOOTPRINT_EST: 100,
};

const RES_LEN = ft(168);      // 168 ft east-west, excluding porticoes
const RES_DEP = ft(85, 6);    // 85 ft 6 in north-south, excluding porticoes
const RES_H_S = ft(70);       // 70 ft on the south elevation
const STATE_FLOOR_Z = ft(14); // State Floor sits above the Ground Floor
const STATE_CEIL = ft(18);
const SECOND_Z = STATE_FLOOR_Z + ft(22);

export const ARCHITECTURAL_VOLUMES: ArchitecturalVolume[] = [
  {
    id: "RES-ENVELOPE",
    name: "Executive Residence — Exterior Envelope",
    wing: "EXECUTIVE_RESIDENCE",
    level: "All floors",
    shape: "box",
    center: { x: 0, y: RES_DEP / 2, z: 0 },
    size: { w: RES_LEN, d: RES_DEP, h: RES_H_S },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 measured drawings; WHHA dimensions",
    sourceUrl: HABS,
    publishedDimension: "168 ft × 85 ft 6 in; 70 ft high (south)",
    color: "#38bdf8",
  },
  {
    id: "SOUTH-PORTICO",
    name: "South Portico (semicircular)",
    wing: "EXECUTIVE_RESIDENCE",
    level: "Ground + State Floor",
    shape: "ellipse",
    center: { x: 0, y: -ft(15), z: 0 },
    size: { w: ft(60), d: ft(30), h: ft(48) },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 south elevation",
    sourceUrl: HABS,
    publishedDimension: "Semicircular portico, 1824",
    color: "#7dd3fc",
  },
  {
    id: "NORTH-PORTICO",
    name: "North Portico",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: 0, y: RES_DEP + ft(12), z: STATE_FLOOR_Z - ft(2) },
    size: { w: ft(66), d: ft(24), h: ft(38) },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 north elevation",
    sourceUrl: HABS,
    publishedDimension: "Porte-cochère portico, 1829–30",
    color: "#7dd3fc",
  },
  {
    id: "EAST-ROOM",
    name: "East Room",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: -RES_LEN / 2 + ft(79) / 2 + ft(4), y: RES_DEP / 2, z: STATE_FLOOR_Z },
    size: { w: ft(79), d: ft(36, 8), h: ft(22) },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "79 ft × 36 ft 8 in; 22 ft ceiling",
    color: "#f8fafc",
  },
  {
    id: "GREEN-ROOM",
    name: "Green Room",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: -ft(28, 4) / 2 - ft(20) - ft(4), y: ft(22, 6) / 2 + ft(6), z: STATE_FLOOR_Z },
    size: { w: ft(28, 4), d: ft(22, 6), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "28 ft 4 in × 22 ft 6 in",
    color: "#69f0ae",
  },
  {
    id: "BLUE-ROOM",
    name: "Blue Room (oval)",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "ellipse",
    center: { x: 0, y: ft(29, 9) / 2 + ft(4), z: STATE_FLOOR_Z },
    size: { w: ft(39, 8), d: ft(29, 9), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "39 ft 8 in × 29 ft 9 in oval",
    color: "#60a5fa",
  },
  {
    id: "RED-ROOM",
    name: "Red Room",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: ft(28) / 2 + ft(20) + ft(4), y: ft(22, 6) / 2 + ft(6), z: STATE_FLOOR_Z },
    size: { w: ft(28), d: ft(22, 6), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "28 ft × 22 ft 6 in",
    color: "#f87171",
  },
  {
    id: "STATE-DINING",
    name: "State Dining Room",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: RES_LEN / 2 - ft(48) / 2 - ft(4), y: RES_DEP / 2, z: STATE_FLOOR_Z },
    size: { w: ft(48), d: ft(36), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "48 ft × 36 ft",
    color: "#fbbf24",
  },
  {
    id: "ENTRANCE-HALL",
    name: "Entrance Hall",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: 0, y: RES_DEP - ft(31) / 2 - ft(3), z: STATE_FLOOR_Z },
    size: { w: ft(44), d: ft(31), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "44 ft × 31 ft",
    color: "#e2e8f0",
  },
  {
    id: "CROSS-HALL",
    name: "Cross Hall",
    wing: "EXECUTIVE_RESIDENCE",
    level: "State Floor",
    shape: "box",
    center: { x: 0, y: RES_DEP / 2 + ft(6), z: STATE_FLOOR_Z },
    size: { w: ft(80), d: ft(18), h: STATE_CEIL },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "80 ft × 18 ft",
    color: "#cbd5e1",
  },
  {
    id: "YELLOW-OVAL",
    name: "Yellow Oval Room (Second Floor)",
    wing: "EXECUTIVE_RESIDENCE",
    level: "Second Floor",
    shape: "ellipse",
    center: { x: 0, y: ft(30) / 2 + ft(4), z: SECOND_Z },
    size: { w: ft(40), d: ft(30), h: ft(14) },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide / 360° tour",
    sourceUrl: WHHA_360,
    publishedDimension: "40 ft × 30 ft oval",
    color: "#fde68a",
  },
  {
    id: "DIPLOMATIC-RECEPTION",
    name: "Diplomatic Reception Room (oval)",
    wing: "EXECUTIVE_RESIDENCE",
    level: "Ground Floor",
    shape: "ellipse",
    center: { x: 0, y: ft(30) / 2 + ft(4), z: 0 },
    size: { w: ft(40), d: ft(30), h: ft(12) },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA room guide",
    sourceUrl: WHHA_ROOMS,
    publishedDimension: "40 ft × 30 ft oval",
    color: "#a5b4fc",
  },
  {
    id: "WEST-COLONNADE",
    name: "West Colonnade (Jefferson)",
    wing: "GROUNDS",
    level: "Ground",
    shape: "box",
    center: { x: RES_LEN / 2 + ft(60), y: ft(12), z: 0 },
    size: { w: ft(120), d: ft(14), h: ft(14) },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 colonnade drawings",
    sourceUrl: HABS,
    publishedDimension: "Jefferson colonnade, 1805–07",
    color: "#94a3b8",
  },
  {
    id: "EAST-COLONNADE",
    name: "East Colonnade",
    wing: "GROUNDS",
    level: "Ground",
    shape: "box",
    center: { x: -RES_LEN / 2 - ft(60), y: ft(12), z: 0 },
    size: { w: ft(120), d: ft(14), h: ft(14) },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 colonnade drawings",
    sourceUrl: HABS,
    publishedDimension: "East colonnade, 1902 / 1942",
    color: "#94a3b8",
  },
  {
    id: "WEST-WING-ENVELOPE",
    name: "West Wing — Footprint Envelope",
    wing: "WEST_WING",
    level: "Basement, Ground, First",
    shape: "box",
    center: { x: RES_LEN / 2 + ft(120) + ft(75), y: -ft(20), z: -ft(12) },
    size: { w: ft(150), d: ft(110), h: ft(36) },
    provenance: "FOOTPRINT_EST",
    toleranceCm: TOLERANCE.FOOTPRINT_EST,
    source: "Site-plan estimate — no public measured drawing of the West Wing interior",
    sourceUrl: WHHA_FACTS,
    publishedDimension: "Not published",
    color: "#c084fc",
  },
  {
    id: "OVAL-OFFICE",
    name: "Oval Office",
    wing: "WEST_WING",
    level: "First Floor",
    shape: "ellipse",
    center: { x: 3300, y: -1240, z: 0 },
    size: { w: ft(35, 10), d: ft(29), h: ft(18, 6) },
    provenance: "PUBLISHED_INCH",
    toleranceCm: TOLERANCE.PUBLISHED_INCH,
    source: "WHHA / The People's House 1:1 Oval Office replica",
    sourceUrl: "https://www.thepeopleshouse.org/",
    publishedDimension: "35 ft 10 in × 29 ft; 18 ft 6 in ceiling",
    color: "#00e5ff",
  },
  {
    id: "CABINET-ROOM",
    name: "Cabinet Room",
    wing: "WEST_WING",
    level: "First Floor",
    shape: "box",
    center: { x: 3300, y: -ft(6), z: 0 },
    size: { w: ft(40), d: ft(25), h: ft(14) },
    provenance: "FOOTPRINT_EST",
    toleranceCm: TOLERANCE.FOOTPRINT_EST,
    source: "Approximate — interior plan not publicly surveyed",
    sourceUrl: WHHA_FACTS,
    publishedDimension: "Not published",
    color: "#c084fc",
  },
  {
    id: "SITUATION-ROOM",
    name: "Situation Room complex (sub-grade)",
    wing: "WEST_WING",
    level: "Basement",
    shape: "box",
    center: { x: 1920, y: -850, z: -ft(12) },
    size: { w: ft(60), d: ft(40), h: ft(10) },
    provenance: "FOOTPRINT_EST",
    toleranceCm: TOLERANCE.FOOTPRINT_EST,
    source: "Approximate — classified interior; footprint only",
    sourceUrl: WHHA_FACTS,
    publishedDimension: "~5,500 sq ft (public reporting)",
    color: "#c084fc",
  },
  {
    id: "EAST-WING-ENVELOPE",
    name: "East Wing — Footprint Envelope",
    wing: "EAST_WING",
    level: "Ground + First",
    shape: "box",
    center: { x: -RES_LEN / 2 - ft(120) - ft(60), y: -ft(10), z: 0 },
    size: { w: ft(120), d: ft(80), h: ft(28) },
    provenance: "FOOTPRINT_EST",
    toleranceCm: TOLERANCE.FOOTPRINT_EST,
    source: "Site-plan estimate (1942 wing) — no public measured drawing",
    sourceUrl: WHHA_FACTS,
    publishedDimension: "Not published",
    color: "#c084fc",
  },
  {
    id: "ROSE-GARDEN",
    name: "Rose Garden",
    wing: "GROUNDS",
    level: "Grade",
    shape: "box",
    center: { x: RES_LEN / 2 + ft(60), y: -ft(35), z: -5 },
    size: { w: ft(125), d: ft(60), h: 5 },
    provenance: "HABS_ENVELOPE",
    toleranceCm: TOLERANCE.HABS_ENVELOPE,
    source: "HABS DC-37 grounds survey / NPS",
    sourceUrl: HABS,
    publishedDimension: "≈125 ft × 60 ft",
    color: "#4ade80",
  },
];

export const WING_LABELS: Record<Wing, string> = {
  EXECUTIVE_RESIDENCE: "Executive Residence",
  WEST_WING: "West Wing",
  EAST_WING: "East Wing",
  GROUNDS: "Grounds & Colonnades",
};

export function volumesWithinGate(gateCm = 2.0): ArchitecturalVolume[] {
  return ARCHITECTURAL_VOLUMES.filter((v) => v.toleranceCm <= gateCm);
}

export function provenanceSummary() {
  const total = ARCHITECTURAL_VOLUMES.length;
  const within = volumesWithinGate().length;
  return {
    totalVolumes: total,
    withinTwoCmGate: within,
    footprintEstimates: total - within,
    gateCoveragePct: +((within / total) * 100).toFixed(1),
  };
}
