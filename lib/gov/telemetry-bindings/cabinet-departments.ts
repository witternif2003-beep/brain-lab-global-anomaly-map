/**
 * Cabinet-department telemetry bindings — verified live 2026-09-28.
 *
 * Each URL below returned HTTP 200 + parseable JSON in verification probes,
 * except FEMA + STATE (sandbox 403 from the research network; plausibly open
 * — FEMA is independently proven from Vercel runtime by the verified-anomalies
 * feed). Those two carry sandboxBlocked and report live runtime truth.
 */

import type { TelemetryBinding } from "../types";
import { arr, isoDate, money, num, rec, str } from "../parse";

export const CABINET_BINDINGS: TelemetryBinding[] = [
  {
    id: "TREASURY-DEBT",
    entity: "Dept. of the Treasury",
    label: "FEDERAL DEBT TO THE PENNY",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?filter=record_date:gte:2026-08-01&sort=-record_date&page%5Bsize%5D=1",
    sourceUrl: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    extract: (json) => {
      const row = rec(arr(rec(json).data)[0]);
      return {
        count: 1,
        fields: [
          { k: "RECORD DATE", v: str(row.record_date, 12) },
          { k: "TOTAL PUBLIC DEBT", v: money(row.tot_pub_debt_out_amt) },
          { k: "HELD BY PUBLIC", v: money(row.debt_held_public_amt) }
        ]
      };
    }
  },
  {
    id: "USGS-QUAKES",
    entity: "Dept. of the Interior (USGS)",
    label: "M2.5+ EARTHQUAKES — LATEST 20",
    url: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=20&orderby=time",
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/map/",
    extract: (json) => {
      const feats = arr(rec(json).features);
      let best = -1;
      let bestPlace = "—";
      for (const f of feats) {
        const p = rec(rec(f).properties);
        const m = num(p.mag);
        if (m !== null && m > best) {
          best = m;
          bestPlace = str(p.place);
        }
      }
      const latest = rec(rec(feats[0]).properties);
      return {
        count: feats.length,
        fields: [
          { k: "STRONGEST (20)", v: best >= 0 ? `M${best} — ${bestPlace}` : "—" },
          { k: "LATEST", v: `${str(latest.place)} • ${isoDate(latest.time)}` }
        ]
      };
    }
  },
  {
    id: "NHTSA-RECALLS",
    entity: "Dept. of Transportation (NHTSA)",
    label: "VEHICLE RECALLS — REF QUERY HONDA CIVIC 2020",
    url: "https://api.nhtsa.gov/recalls/recallsByVehicle?make=Honda&model=Civic&modelYear=2020",
    sourceUrl: "https://www.nhtsa.gov/recalls",
    extract: (json) => {
      const r = rec(json);
      const results = arr(r.results);
      const first = rec(results[0]);
      return {
        count: num(r.Count),
        fields: [
          { k: "CAMPAIGN", v: str(first.NHTSACampaignNumber, 14) },
          { k: "COMPONENT", v: str(first.Component, 70) }
        ]
      };
    }
  },
  {
    id: "FEMA-DECLARATIONS",
    entity: "Dept. of Homeland Security (FEMA)",
    label: "DISASTER DECLARATIONS — LATEST 5",
    url: "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=5&$orderby=incidentBeginDate%20desc",
    sourceUrl: "https://www.fema.gov/disasters",
    sandboxBlocked: true,
    extract: (json) => {
      const rows = arr(rec(json).value ?? rec(json).DisasterDeclarationsSummaries);
      const first = rec(rows[0]);
      return {
        count: rows.length,
        fields: [
          { k: "LATEST", v: `${str(first.state, 4)} ${str(first.disasterNumber)} — ${str(first.declarationTitle, 50)}` },
          { k: "INCIDENT", v: `${str(first.incidentType, 30)} • BEGAN ${isoDate(first.incidentBeginDate)}` }
        ]
      };
    }
  },
  {
    id: "STATE-ADVISORIES",
    entity: "Dept. of State",
    label: "TRAVEL ADVISORIES",
    url: "https://cadataapi.state.gov/api/travel-advisories",
    sourceUrl: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/",
    sandboxBlocked: true,
    extract: (json) => {
      const rows = Array.isArray(json) ? json : arr(rec(json).data ?? rec(json).advisories ?? rec(json).results);
      const first = rec(rows[0]);
      const keys = Object.keys(first).slice(0, 3);
      return {
        count: rows.length,
        fields:
          keys.length > 0
            ? keys.map((k) => ({ k: k.toUpperCase().slice(0, 24), v: str(first[k], 60) }))
            : [{ k: "PAYLOAD", v: "unrecognized shape" }]
      };
    }
  }
];
