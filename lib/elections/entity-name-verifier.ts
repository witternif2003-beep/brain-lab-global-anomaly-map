import { ELECTION_OFFICES } from "./election-offices";
import type { ElectionOffice, SourceProbe } from "./types";

export type CitationVerdict = "verified" | "not-found" | "unverifiable";

export interface CitationVerification {
  code: string;
  url: string;
  verdict: CitationVerdict;
  matchedAlias?: string;
  /** ~100 chars of page text around the match */
  matchContext?: string;
  reason?: string;
}

const MIN_TEXT_CHARS = 200;

function stripMarks(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f\u02bb\u02bc]/g, "");
}

function fold(s: string): string {
  return stripMarks(s).toLowerCase();
}

/** Other jurisdictions' names that contain this alias, e.g. "West Virginia" for "Virginia". */
function shadowingNames(office: ElectionOffice, alias: string): string[] {
  const a = fold(alias);
  return ELECTION_OFFICES.filter((o) => o.code !== office.code)
    .flatMap((o) => o.aliases)
    .map(fold)
    .filter((n) => n !== a && n.includes(a));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks that the official office page names its own jurisdiction. This
 * confirms the pinned URL still serves that office's site, not a parked
 * domain, a redirect to an unrelated portal or an error page.
 */
export function verifyOfficePage(office: ElectionOffice, probe: SourceProbe | undefined, normalized: string | undefined): CitationVerification {
  const base = { code: office.code, url: office.url };
  if (!probe) return { ...base, verdict: "unverifiable", reason: "not probed yet" };
  if (probe.status !== "ok" && probe.status !== "not-modified") {
    return { ...base, verdict: "unverifiable", reason: `${probe.status}${probe.error ? ": " + probe.error : ""}` };
  }
  if (normalized === undefined) return { ...base, verdict: "unverifiable", reason: "page text not captured" };
  if (normalized.length < MIN_TEXT_CHARS) {
    return { ...base, verdict: "unverifiable", reason: `only ${normalized.length} chars of visible text` };
  }

  const text = stripMarks(`${probe.title ?? ""}\n${normalized}`);
  const lower = text.toLowerCase();
  for (const alias of office.aliases) {
    let hay = lower;
    for (const n of shadowingNames(office, alias)) hay = hay.split(n).join(" ".repeat(n.length));
    const needle = fold(alias);
    const m = new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}($|[^a-z0-9])`).exec(hay);
    if (m) {
      const idx = m.index + m[1].length;
      return {
        ...base,
        verdict: "verified",
        matchedAlias: alias,
        matchContext: text.slice(Math.max(0, idx - 40), idx + needle.length + 60).replace(/\s+/g, " ").trim()
      };
    }
  }
  return { ...base, verdict: "not-found", reason: `none of ${office.aliases.map((a) => `"${a}"`).join(", ")} on page (${normalized.length} chars)` };
}
