/**
 * Unified P1 Tier-1 anomaly registry.
 *
 * Records 1-1000 are the curated Georgia/interstate corpus in
 * `statewide-anomalies.ts`. Records 1001-25000 are generated deterministically
 * (seeded PRNG keyed on the record number) and cover all 50 states, the
 * District of Columbia, and the 5 inhabited U.S. territories.
 *
 * Generated records are NOT intercepts, investigations, or verified findings:
 * `verified` is false and `synthetic` is true on every one of them. They exist
 * to exercise the dashboard's pagination, jurisdiction filtering, and telemetry
 * pipelines at catalog scale. Nothing here is attributable to a real person or
 * organization, and no record is keyed on race, ethnicity, or national origin.
 */
import { STATEWIDE_ANOMALIES_1000, AnomalyReport } from "./statewide-anomalies";
import {
  BATCH_SIZE,
  TOTAL_ANOMALIES,
  TOTAL_BATCHES,
  CURATED_COUNT,
  US_JURISDICTIONS,
  JURISDICTION_BY_CODE,
  Jurisdiction,
} from "./anomaly-registry-meta";

export {
  BATCH_SIZE,
  TOTAL_ANOMALIES,
  TOTAL_BATCHES,
  CURATED_COUNT,
  US_JURISDICTIONS,
  JURISDICTION_BY_CODE,
  jurisdictionCount,
  registrySummary,
} from "./anomaly-registry-meta";
export type { Jurisdiction, JurisdictionKind } from "./anomaly-registry-meta";

/** Deterministic 32-bit PRNG so a record number always yields the same record. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VECTOR_CLASSES = [
  { sector: "Energy & Grid", vector: "SCADA setpoint drift on transmission relay telemetry", cmd: "SCADA TELEMETRY BASELINE DIFF" },
  { sector: "Ports & Logistics", vector: "Container dwell-time divergence against berth schedule", cmd: "BERTH DWELL VARIANCE SCAN" },
  { sector: "Aviation", vector: "ADS-B track discontinuity clustered on one approach corridor", cmd: "ADSB TRACK GAP CORRELATE" },
  { sector: "Rail & Freight", vector: "Interchange manifest mismatch across carrier handoff", cmd: "MANIFEST HANDOFF RECONCILE" },
  { sector: "Telecom", vector: "BGP path prepend anomaly on regional transit", cmd: "BGP PATH DELTA WATCH" },
  { sector: "Water & Utilities", vector: "Pressure-sensor residual outside seasonal envelope", cmd: "HYDRAULIC RESIDUAL GATE" },
  { sector: "Public Finance", vector: "Procurement award concentration above historical HHI", cmd: "HHI CONCENTRATION AUDIT" },
  { sector: "Labor & Macro", vector: "Claims-to-payroll divergence versus state trend", cmd: "CLAIMS PAYROLL DIVERGE" },
  { sector: "Spectrum & RF", vector: "Unlicensed subcarrier persisting in licensed band", cmd: "SPECTRUM OCCUPANCY DIFF" },
  { sector: "Healthcare Supply", vector: "Cold-chain excursion cluster at distribution node", cmd: "COLD CHAIN EXCURSION MAP" },
  { sector: "Maritime Domain", vector: "AIS gap coincident with draft-change report", cmd: "AIS GAP DRAFT CORRELATE" },
  { sector: "Cyber Infrastructure", vector: "Certificate reissue burst on state-operated domains", cmd: "CT LOG REISSUE BURST" },
];

const SEVERITY = ["P1-CRITICAL", "P1-HIGH", "P1-ELEVATED"];
const METHOD_STAGES = [
  "Stage 1: Pull public source series for the jurisdiction and sector",
  "Stage 2: Fit seasonal baseline and compute standardized residual",
  "Stage 3: Gate residual at |z| >= 3.0 against the rolling 24-month window",
  "Stage 4: Cross-check the flagged window against a second independent public series",
  "Stage 5: Emit provenance tensor (reliability, credibility, freshness, cycle entropy)",
  "Stage 6: Route to analyst queue — no automated attribution is asserted",
];

const SYNTHETIC_BANNER =
  "SYNTHETIC CATALOG RECORD — deterministically generated for pipeline and UI scale testing. " +
  "This is not an intercept, investigation, or verified finding, and it is not attributable to any real person or organization.";

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function sci(rnd: () => number, min: number, max: number): string {
  const v = min + rnd() * (max - min);
  return v.toExponential(2);
}

function jurisdictionForNumber(n: number): Jurisdiction {
  if (n <= CURATED_COUNT) return JURISDICTION_BY_CODE.GA;
  return US_JURISDICTIONS[(n - CURATED_COUNT - 1) % US_JURISDICTIONS.length];
}

function generateAnomaly(n: number): AnomalyReport {
  const rnd = mulberry32(n * 2654435761);
  const j = jurisdictionForNumber(n);
  const cls = VECTOR_CLASSES[(n - CURATED_COUNT - 1) % VECTOR_CLASSES.length];
  const severity = pick(rnd, SEVERITY);
  const batchNumber = Math.floor((n - 1) / BATCH_SIZE) + 1;
  const z = (3 + rnd() * 3.4).toFixed(2);
  const lat = (j.lat + (rnd() - 0.5) * 0.9).toFixed(4);
  const lon = (j.lon + (rnd() - 0.5) * 0.9).toFixed(4);
  const coords = `${Math.abs(+lat).toFixed(4)}°${+lat >= 0 ? "N" : "S"}, ${Math.abs(+lon).toFixed(4)}°${+lon >= 0 ? "E" : "W"}`;
  const hour = String(Math.floor(rnd() * 24)).padStart(2, "0");
  const minute = String(Math.floor(rnd() * 60)).padStart(2, "0");
  const detector = `STGNN-${severity === "P1-CRITICAL" ? "A" : severity === "P1-HIGH" ? "B" : "C"}${String((n % 97) + 1).padStart(2, "0")}`;

  const definition =
    `${j.name} — ${cls.vector}. Standardized residual z = ${z}σ over a 24-month seasonal baseline for the ` +
    `${cls.sector.toLowerCase()} series at the ${j.hub} reporting node. Flagged by ${detector}; awaiting analyst adjudication.`;

  return {
    id: `${j.code}-ANOMALY-${String(n).padStart(5, "0")}`,
    batch: `BATCH ${batchNumber} OF ${TOTAL_BATCHES}, ANOMALIES ${(batchNumber - 1) * BATCH_SIZE + 1}–${batchNumber * BATCH_SIZE}`,
    batchNumber,
    anomalyNumber: n,
    verified: false,
    synthetic: true,
    jurisdictionCode: j.code,
    jurisdictionName: j.name,
    jurisdictionKind: j.kind,
    sector: cls.sector,
    severity,
    zScore: +z,
    term: `${j.name} — ${cls.vector} [${severity}]`,
    interstateImplications: `${j.kind === "STATE" ? "Interstate" : "Inter-jurisdictional"} corridor: ${j.hub} reporting node`,
    verbatimNarrative:
      `${SYNTHETIC_BANNER}\n\nRECORD ${n} OF ${TOTAL_ANOMALIES} — ${j.name} (${j.code}) — ${cls.sector}\n` +
      `DETECTOR: ${detector} • RESIDUAL: ${z}σ • SEVERITY: ${severity}\n\n${definition}\n\n` +
      `ADJUDICATION STATE: unverified. No entity, individual, or nationality is named or implied. ` +
      `Coordinates are a jittered offset from the jurisdiction's public administrative hub and do not denote a surveilled location.`,
    definition,
    espionageContext: `${j.name} ${cls.sector} monitoring node near ${j.hub} (${coords}). Synthetic record — no adversary attribution asserted.`,
    operationalCoordinates: { aa: coords, ca: coords, target: `${j.name} ${cls.sector} node` },
    cmd: cls.cmd,
    decryptedEvidence: {
      usb: "n/a — synthetic record, no physical evidence exists",
      decryptedString: "n/a",
      decryptedVoIP: "n/a",
      finalVoice: "n/a",
    },
    forensicFlags: [
      `Residual ${z}σ exceeds the |z| >= 3.0 detection gate`,
      `Seasonal baseline fit on 24 months of public ${cls.sector.toLowerCase()} series`,
      `Secondary independent series corroboration: ${rnd() > 0.35 ? "present" : "not yet available"}`,
      "Attribution: none asserted (synthetic catalog record)",
    ],
    interceptExpansion:
      `No intercept content exists for this record. It is a generated catalog entry used to validate ` +
      `jurisdiction filtering (${US_JURISDICTIONS.length} jurisdictions) and ${TOTAL_BATCHES}-batch pagination at ${TOTAL_ANOMALIES}-record scale.`,
    financialDetails: {
      unreportedTransfers: "n/a — synthetic record",
      wireTarget: "n/a",
      wireAccount: "n/a",
      intermediaryAccounts: 0,
      highlights: [`Modeled ${cls.sector.toLowerCase()} exposure delta: ${sci(rnd, 1e4, 9e6)} USD (synthetic)`],
    },
    phoneRecords: {
      carrier: "n/a — synthetic record",
      aaPhone: "n/a",
      aaImei: "n/a",
      caPhone: "n/a",
      caImei: "n/a",
      totalCallDurationSec: "n/a",
      dataVolumeMb: `${sci(rnd, 1e3, 5e5)} MB (telemetry ingested)`,
      towers: [`${j.hub} public reporting node (${coords})`],
    },
    bankingHistory: {
      aaAccount: "n/a",
      caAccount: "n/a",
      beneficiaryAccount: "n/a",
      totalMoved: "n/a — synthetic record",
      highlights: ["No financial records are associated with this generated entry"],
    },
    locationData: {
      aaTimeline: [{ time: `2026-09-23 ${hour}:${minute} EST`, location: `${j.name} ${cls.sector} node`, coords }],
      caTimeline: [],
    },
    identifiers: { aaEmails: [], aaSocials: [], caEmails: [], caSocials: [] },
    metrics14x: {
      financial: `${sci(rnd, 1e4, 9e6)} USD modeled exposure`,
      callDurationSec: "n/a",
      dataVolumeMb: `${sci(rnd, 1e3, 5e5)} MB`,
      locationPrecisionDeg: `${sci(rnd, 1e-4, 9e-3)} deg (jittered)`,
    },
    deviceForensics: {
      transmitter: "n/a — synthetic record",
      transmitterMac: "n/a",
      newsSet: "n/a",
      newsSetMac: "n/a",
      intlTraits: "n/a",
      modifiedEquipment: "n/a",
    },
    impact: `Modeled ${cls.sector.toLowerCase()} service-continuity impact for ${j.name}; unverified pending analyst review.`,
    evidenceChain: {
      evidenceList: `Public ${cls.sector.toLowerCase()} time series for ${j.name} (${j.code})`,
      sha256: "n/a — synthetic record, no evidence hash",
      collectedBy: `Automated detector ${detector}`,
      timestamp: `2026-09-23T${hour}:${minute}:00Z`,
      transferLog: "n/a",
      admissibility: "Not evidentiary — synthetic catalog record",
    },
    federalCharges: [],
    nsaValidation: {
      attribution: "None asserted — synthetic catalog record",
      validationCode: `${j.code}-${String(n).padStart(5, "0")}-SYNTH`,
    },
    forensicMethodology: METHOD_STAGES,
    timestampEst: `${hour}:${minute} EST`,
    dateStr: "SEPTEMBER 23, 2026",
  };
}

const cache = new Map<number, AnomalyReport>();

/** 1-indexed record accessor over the full 25,000-record registry. */
export function getAnomaly(n: number): AnomalyReport {
  if (n < 1 || n > TOTAL_ANOMALIES) n = 1;
  if (n <= CURATED_COUNT) {
    const curated = STATEWIDE_ANOMALIES_1000[n - 1];
    return {
      ...curated,
      jurisdictionCode: "GA",
      jurisdictionName: "Georgia",
      jurisdictionKind: "STATE",
      batchNumber: Math.floor((n - 1) / BATCH_SIZE) + 1,
    };
  }
  const hit = cache.get(n);
  if (hit) return hit;
  const built = generateAnomaly(n);
  if (cache.size > 4000) cache.clear();
  cache.set(n, built);
  return built;
}

export function getBatch(batchNumber: number): AnomalyReport[] {
  const start = (batchNumber - 1) * BATCH_SIZE + 1;
  return Array.from({ length: BATCH_SIZE }, (_, i) => getAnomaly(start + i));
}

/** Record numbers assigned to a jurisdiction, ascending. */
export function anomalyNumbersFor(code: string, limit = BATCH_SIZE): number[] {
  const out: number[] = [];
  if (code === "GA") {
    for (let n = 1; n <= CURATED_COUNT && out.length < limit; n++) out.push(n);
  }
  const idx = US_JURISDICTIONS.findIndex((j) => j.code === code);
  if (idx < 0) return out;
  for (let n = CURATED_COUNT + 1 + idx; n <= TOTAL_ANOMALIES && out.length < limit; n += US_JURISDICTIONS.length) {
    out.push(n);
  }
  return out;
}
