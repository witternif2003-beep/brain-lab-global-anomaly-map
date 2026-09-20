import { NextResponse } from "next/server";
import { addCandidateSource, MANIFEST_STORE } from "../../../../lib/manifest/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") || "all";

  // Simulate execution of probes
  const simulatedCandidates = [
    {
      name: "Census Quarterly Financial Report (QFR) Manufacturing & Wholesale",
      url: "https://api.census.gov/data/2026/qfr?get=SALES,NETINC&for=us:*",
      feedType: "json_api" as const,
      tier: "federal_statistical" as const,
      cadence: "quarterly" as const,
      discoveredBy: "data.gov-catalog",
      discoveryQuery: "qfr manufacturing financial series",
    },
    {
      name: "EIA Natural Gas Industrial Delivery & Storage Monthly",
      url: "https://api.eia.gov/v2/natural-gas/cons/sum/data/?facets[stateId][]=GA",
      feedType: "json_api" as const,
      tier: "federal_statistical" as const,
      cadence: "monthly" as const,
      discoveredBy: "agency-data-json",
      discoveryQuery: "https://www.eia.gov/data.json",
    },
    {
      name: "USPS Postal Pro Inbound/Outbound Mail Velocity Index",
      url: "https://postalpro.usps.com/rest/service-performance/quarterly-reports/GA",
      feedType: "json_api" as const,
      tier: "federal_other" as const,
      cadence: "weekly" as const,
      discoveredBy: "openapi-registry",
      discoveryQuery: "usps service performance",
    }
  ];

  const added = [];
  for (const cand of simulatedCandidates) {
    if (!MANIFEST_STORE.some(m => m.url === cand.url)) {
      const entry = addCandidateSource(cand);
      added.push(entry);
    }
  }

  return NextResponse.json({
    status: "success",
    probeExecuted: probe,
    discoveredCount: added.length,
    newEntries: added,
    currentManifestCount: MANIFEST_STORE.length
  });
}
