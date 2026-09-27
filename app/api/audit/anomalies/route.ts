import { NextResponse } from "next/server";
import {
  getAnomaly,
  anomalyNumbersFor,
  jurisdictionCount,
  BATCH_SIZE,
  TOTAL_ANOMALIES,
  TOTAL_BATCHES,
  CURATED_COUNT,
  US_JURISDICTIONS,
} from "../../../../lib/anomaly-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Structural integrity audit of the 25,000-record registry. This verifies the
 * catalog's internal consistency (numbering, batching, jurisdiction routing,
 * determinism, labeling). It does NOT and cannot verify that any record
 * describes a real-world event: records 1001-25000 are synthetic by design,
 * and records 1-1000 are a curated narrative corpus with no external
 * evidentiary backing available to this system.
 */
export async function GET() {
  const started = Date.now();
  const failures: string[] = [];
  const ids = new Set<string>();
  const perJurisdiction: Record<string, number> = {};
  let syntheticMislabeled = 0;
  let nondeterministic = 0;

  for (let n = 1; n <= TOTAL_ANOMALIES; n++) {
    const a = getAnomaly(n);
    if (a.anomalyNumber !== n) failures.push(`anomalyNumber mismatch at ${n}`);
    if (a.batchNumber !== Math.floor((n - 1) / BATCH_SIZE) + 1) failures.push(`batchNumber mismatch at ${n}`);
    if (ids.has(a.id)) failures.push(`duplicate id ${a.id}`);
    ids.add(a.id);
    const code = a.jurisdictionCode ?? "";
    if (!US_JURISDICTIONS.some((j) => j.code === code)) failures.push(`unknown jurisdiction at ${n}`);
    perJurisdiction[code] = (perJurisdiction[code] ?? 0) + 1;
    if (n > CURATED_COUNT) {
      if (a.verified !== false || a.synthetic !== true) syntheticMislabeled++;
      if (n % 97 === 0 && JSON.stringify(getAnomaly(n)) !== JSON.stringify(a)) nondeterministic++;
    }
  }

  for (const j of US_JURISDICTIONS) {
    if (perJurisdiction[j.code] !== jurisdictionCount(j.code)) {
      failures.push(`jurisdictionCount(${j.code}) = ${jurisdictionCount(j.code)} but registry has ${perJurisdiction[j.code]}`);
    }
    if (anomalyNumbersFor(j.code, BATCH_SIZE).some((x) => getAnomaly(x).jurisdictionCode !== j.code)) {
      failures.push(`jurisdiction filter leak for ${j.code}`);
    }
  }

  if (syntheticMislabeled) failures.push(`${syntheticMislabeled} synthetic records not labeled verified=false/synthetic=true`);
  if (nondeterministic) failures.push(`${nondeterministic} sampled records were not deterministic`);

  return NextResponse.json({
    status: failures.length === 0 ? "PASS" : "FAIL",
    scope: "STRUCTURAL_INTEGRITY_ONLY",
    checked: { records: ids.size, expectedRecords: TOTAL_ANOMALIES, batches: TOTAL_BATCHES, jurisdictions: Object.keys(perJurisdiction).length },
    perJurisdiction,
    failures,
    factualStatus: {
      curatedRecords: {
        range: `1-${CURATED_COUNT}`,
        realWorldVerification: "NONE — narrative corpus; identifiers, intercepts and financial traces are not backed by external evidence available to this system",
      },
      syntheticRecords: {
        range: `${CURATED_COUNT + 1}-${TOTAL_ANOMALIES}`,
        realWorldVerification: "NOT APPLICABLE — deterministically generated, verified=false, synthetic=true, no attribution, no demographic fields",
      },
    },
    durationMs: Date.now() - started,
  });
}
