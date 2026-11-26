/** Pure helpers for the tap-a-label card (no MapLibre import, so they run under node:test). */
const NAME_KEYS = ['name', 'name:en', 'name_en', 'ref', 'label', 'title', 'callsign', 'callsignOrName', 'id'];
const MAX_EXTRA_ROWS = 10;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Rows describing one tapped label: its text, the map layer and data source it comes from, and its own attributes. */
export function labelInfoRows(
  props: Record<string, unknown>,
  layerId: string,
  source: string,
  sourceLayer?: string,
  attribution?: string,
): [string, string][] {
  const nameKey = NAME_KEYS.find((k) => props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== '');
  const rows: [string, string][] = [['Label', nameKey ? String(props[nameKey]) : '(no text attribute)']];
  rows.push(['Map layer', layerId]);
  rows.push(['Data source', sourceLayer ? `${source} › ${sourceLayer}` : source]);
  if (attribution) rows.push(['Credit', stripTags(attribution)]);
  let extra = 0;
  for (const [k, v] of Object.entries(props)) {
    if (k === nameKey || v === null || v === undefined || typeof v === 'object') continue;
    if (extra++ >= MAX_EXTRA_ROWS) break;
    rows.push([k, String(v)]);
  }
  return rows;
}

export function labelInfoHtml(rows: [string, string][]): string {
  const body = rows
    .map(([k, v]) => `<div style="display:flex;gap:8px"><span style="color:#94a3b8;min-width:84px">${esc(k)}</span><span style="color:#f8fafc;word-break:break-word">${esc(v)}</span></div>`)
    .join('');
  return `<div style="font:12px/1.45 ui-monospace,monospace;max-width:280px;padding:4px 2px">${body}</div>`;
}
