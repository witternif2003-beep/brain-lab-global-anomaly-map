/**
 * LUCID-1 provenance envelope — every federally-fetched record carries this.
 *
 * HONESTY PROTOCOL: "fetched" means a live API returned the row in this run.
 * It is NOT an investigative verification. source_url + retrieved_at + sha256
 * let anyone re-pull the bytes and confirm the hash.
 */
import { createHash } from "crypto";

export interface Provenance {
  source_id: string;
  jurisdiction: string;
  source_url: string;
  retrieved_at: string;
  sha256: string;
  http_status: number;
  record_count: number;
  access_note: string;
}

export function makeProvenance(a: {
  source_id: string;
  jurisdiction: string;
  source_url: string;
  body: string;
  http_status: number;
  record_count: number;
  access_note: string;
}): Provenance {
  return {
    source_id: a.source_id,
    jurisdiction: a.jurisdiction,
    source_url: a.source_url,
    retrieved_at: new Date().toISOString(),
    sha256: createHash("sha256").update(a.body).digest("hex"),
    http_status: a.http_status,
    record_count: a.record_count,
    access_note: a.access_note
  };
}
