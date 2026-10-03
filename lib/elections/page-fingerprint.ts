import { createHash } from "node:crypto";

const DROP_BLOCKS = /<(script|style|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const BLOCK_TAGS =
  /<\/?(p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|nav|main|aside|form|option|dd|dt|blockquote)\b[^>]*>/gi;
const ANY_TAG = /<[^>]+>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  copy: "©",
  reg: "®"
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const cp = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Visible page text, one block per line, whitespace collapsed. */
export function normalizeHtml(html: string): string {
  const text = html
    .replace(COMMENTS, " ")
    .replace(DROP_BLOCKS, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(ANY_TAG, " ");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function extractTitle(html: string): string | undefined {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return undefined;
  const t = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  return t || undefined;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function fingerprintPage(html: string): { normalized: string; sha256: string } {
  const normalized = normalizeHtml(html);
  return { normalized, sha256: sha256(normalized) };
}
