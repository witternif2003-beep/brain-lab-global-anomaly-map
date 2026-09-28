#!/usr/bin/env node
/**
 * Jurisdiction card verification harness.
 * Usage: BASE_URL=http://localhost:3000 node scripts/verify-cards.mjs [--fresh]
 *
 * I1 exactly 56 cards, codes unique and equal to the expected set
 * I2 every card has FIPS (2 digits) and a capital
 * I3 every card carries the same ordered field ids
 * I4 sourced fields: non-null value + provenance (http 200, source_url, 64-hex sha256)
 * I5 non-sourced fields: value null
 */
const EXPECTED = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
  "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","VI","GU","AS","MP"
];

const base = process.env.BASE_URL ?? "http://localhost:3000";
const fresh = process.argv.includes("--fresh");
const res = await fetch(`${base}/api/ingest/cards${fresh ? "?fresh=1" : ""}`);
if (!res.ok) {
  console.error(`FAIL: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
const failures = [];
const fail = (m) => failures.push(m);

const codes = data.cards.map((c) => c.code);
if (data.cards.length !== 56) fail(`I1 expected 56 cards, got ${data.cards.length}`);
if (new Set(codes).size !== codes.length) fail("I1 duplicate codes");
for (const c of EXPECTED) if (!codes.includes(c)) fail(`I1 missing ${c}`);

const refIds = data.cards[0]?.fields.map((f) => f.id).join(",");
for (const card of data.cards) {
  if (!/^\d{2}$/.test(card.fips)) fail(`I2 ${card.code} bad fips`);
  if (!card.capital) fail(`I2 ${card.code} missing capital`);
  if (card.fields.map((f) => f.id).join(",") !== refIds) fail(`I3 ${card.code} field set differs`);
  for (const f of card.fields) {
    if (f.status === "sourced") {
      const p = f.provenance;
      if (f.value == null) fail(`I4 ${card.code}.${f.id} sourced without value`);
      if (!p || p.http_status !== 200 || !p.source_url || !/^[0-9a-f]{64}$/.test(p.sha256))
        fail(`I4 ${card.code}.${f.id} bad provenance`);
    } else if (f.value != null) {
      fail(`I5 ${card.code}.${f.id} ${f.status} but has value`);
    }
  }
}

console.log(`cards: ${data.cards.length}  summary: ${JSON.stringify(data.summary)}`);
for (const card of data.cards) {
  console.log(`${card.code}  ${card.fields.map((f) => `${f.id}=${f.status === "sourced" ? f.value : f.status}`).join("  ")}`);
}
if (failures.length) {
  console.error(`\nFAIL (${failures.length}):\n` + failures.join("\n"));
  process.exit(1);
}
console.log("\nPASS: all invariants hold");
