/**
 * Voter-dashboard verification harness (run: npx tsx scripts/verify-voter-dashboard.ts).
 *
 * 1. Roster integrity: 56 unique codes, https office URLs, slugs present.
 * 2. Pinned roster vs LIVE USA.gov directory: re-fetches all 56 state-hub
 *    pages and compares the election-office field to the pinned officeUrl.
 * 3. EAVS sanity: runtime aggregation returns 56 rows; ND null; TX > 10M.
 * 4. Probe smoke: 3 offices return observed probe shapes.
 * Exits non-zero on any failure.
 */
import { ELECTION_OFFICES } from "../lib/elections/offices";
import { fetchEavsTotals } from "../lib/elections/eavs";
import { probeOffice } from "../lib/elections/probes";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };

// 1. roster integrity
if (ELECTION_OFFICES.length !== 56) fail(`expected 56 offices, got ${ELECTION_OFFICES.length}`);
const codes = new Set<string>(ELECTION_OFFICES.map((o) => o.code));
if (codes.size !== 56) fail("duplicate jurisdiction codes");
for (const o of ELECTION_OFFICES) {
  if (!o.officeUrl.startsWith("https://")) fail(`${o.code} office URL not https`);
  if (!o.usaGovSlug) fail(`${o.code} missing usaGovSlug`);
  if (!o.officeLabel.trim()) fail(`${o.code} missing officeLabel`);
}
for (const t of ["DC", "PR", "GU", "VI", "AS", "MP"]) {
  if (!codes.has(t)) fail(`missing ${t}`);
}

// 2. pinned roster vs live directory
async function checkDirectory() {
  for (let i = 0; i < ELECTION_OFFICES.length; i += 6) {
    const batch = ELECTION_OFFICES.slice(i, i + 6);
    await Promise.all(batch.map(async (o) => {
      try {
        const res = await fetch(`https://www.usa.gov/states/${o.usaGovSlug}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) { fail(`${o.code} hub page HTTP ${res.status}`); return; }
        const html = await res.text();
        const m = html.match(/field-field-election-office[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)<\/a>/);
        if (!m) { fail(`${o.code} hub page has no election-office field`); return; }
        const liveUrl = m[1].replace(/&amp;/g, "&");
        if (liveUrl !== o.officeUrl) {
          fail(`${o.code} URL drift: pinned=${o.officeUrl} live=${liveUrl}`);
        }
      } catch (e) {
        fail(`${o.code} hub fetch error: ${e instanceof Error ? e.message : e}`);
      }
    }));
  }
}

// 3. EAVS sanity
async function checkEavs() {
  try {
    const totals = await fetchEavsTotals();
    if (totals.size !== 56) fail(`EAVS returned ${totals.size} rows, expected 56`);
    const nd = totals.get("ND");
    if (nd && nd.totalRegistered !== null) fail(`ND should have null totals, got ${nd.totalRegistered}`);
    const tx = totals.get("TX");
    if (!tx?.totalRegistered || tx.totalRegistered < 10_000_000) {
      fail(`TX total implausible: ${tx?.totalRegistered}`);
    }
    const pr = totals.get("PR");
    if (!pr?.totalRegistered || pr.totalRegistered < 1_000_000) {
      fail(`PR total implausible: ${pr?.totalRegistered}`);
    }
    console.log(`EAVS rows=${totals.size} TX=${tx?.totalRegistered?.toLocaleString()} PR=${pr?.totalRegistered?.toLocaleString()} ND=${nd?.totalRegistered}`);
  } catch (e) {
    fail(`EAVS fetch threw: ${e instanceof Error ? e.message : e}`);
  }
}

// 4. probe smoke
async function checkProbes() {
  for (const code of ["TX", "PR", "VI"]) {
    const o = ELECTION_OFFICES.find((x) => x.code === code)!;
    const p = await probeOffice(o);
    if (typeof p.band !== "string" || p.checkedAt.length < 10) fail(`${code} probe shape invalid`);
    console.log(`${code} probe: HTTP ${p.httpStatus} ${p.latencyMs}ms band=${p.band} names=${p.namesJurisdiction} err=${p.error ?? "none"}`);
  }
}

async function main() {
  await checkDirectory();
  await checkEavs();
  await checkProbes();
  console.log(`offices: ${ELECTION_OFFICES.length}, failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(`FAIL: harness threw: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
