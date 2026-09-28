/**
 * Independent-agency telemetry bindings — verified live 2026-09-28.
 * All three URLs returned HTTP 200 + parseable JSON in verification probes.
 * NASA uses the shared DEMO_KEY pool (rate-limited; 429 surfaces honestly).
 */

import type { TelemetryBinding } from "../types";
import { arr, money, num, rec, str } from "../parse";

export const AGENCY_BINDINGS: TelemetryBinding[] = [
  {
    id: "NASA-APOD",
    entity: "NASA",
    label: "ASTRONOMY PICTURE OF THE DAY",
    url: "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
    sourceUrl: "https://apod.nasa.gov/",
    extract: (json) => {
      const r = rec(json);
      return {
        count: 1,
        fields: [
          { k: "DATE", v: str(r.date, 12) },
          { k: "TITLE", v: str(r.title, 70) },
          { k: "MEDIA", v: str(r.media_type, 12) }
        ]
      };
    }
  },
  {
    id: "NSF-AWARDS",
    entity: "National Science Foundation",
    label: "RESEARCH AWARDS — SAMPLE SLICE",
    url: "https://api.nsf.gov/services/v1/awards.json?agency=NSF&printFields=id,title,agency,fundsObligatedAmt&offset=1",
    sourceUrl: "https://www.nsf.gov/awardsearch/",
    extract: (json) => {
      const awards = arr(rec(rec(json).response).award);
      const first = rec(awards[0]);
      return {
        count: awards.length,
        fields: [
          { k: "AWARD", v: str(first.id, 16) },
          { k: "TITLE", v: str(first.title, 70) },
          { k: "OBLIGATED", v: money(first.fundsObligatedAmt) }
        ]
      };
    }
  },
  {
    id: "FDIC-BANKS",
    entity: "FDIC",
    label: "INSURED INSTITUTIONS",
    url: "https://api.fdic.gov/banks/institutions?limit=1&format=json",
    sourceUrl: "https://banks.data.fdic.gov/bankfind-suite/bankfind",
    extract: (json) => {
      const r = rec(json);
      const total = num(rec(r.meta).total);
      const first = rec(rec(arr(r.data)[0]).data);
      return {
        count: total,
        fields: [
          { k: "SAMPLE", v: `${str(first.NAME, 40)} — ${str(first.CITY, 24)}, ${str(first.STNAME, 20)}` },
          { k: "CERT", v: str(first.CERT, 10) }
        ]
      };
    }
  }
];
