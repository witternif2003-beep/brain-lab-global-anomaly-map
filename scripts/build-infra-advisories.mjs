// Builds a public, source-linked advisory stream for the statewide telemetry panel.
// Source: NIST NVD CVE API 2.0 (public, no key). Records are real published advisories
// for critical-infrastructure / OT / ICS vendors and products — NOT incident reports.
import fs from "node:fs";
import path from "node:path";

const TARGET = 25000;
const PAGE = 2000;
const OUT_DIR = path.join(process.cwd(), "public", "data", "infra-advisories");
const SHARD = 1000;
const API = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const YEAR = 2026;

// NVD allows at most 120 days between pubStartDate and pubEndDate.
function windows() {
  const out = [];
  const end = Math.min(Date.now(), Date.UTC(YEAR + 1, 0, 1) - 1);
  for (let t = Date.UTC(YEAR, 0, 1); t <= end; t += 120 * 86_400_000) {
    const to = Math.min(t + 120 * 86_400_000 - 1, end);
    out.push(`pubStartDate=${new Date(t).toISOString()}&pubEndDate=${new Date(to).toISOString()}`);
  }
  return out;
}
const WINDOWS = windows();

// Advisory coordinators / PSIRTs that publish critical-infrastructure advisories.
const SOURCES = [
  "ics-cert@hq.dhs.gov",
  "productcert@siemens.com",
  "cybersecurity@se.com",
  "cybersecurity@schneider-electric.com",
  "cybersecurity@ch.abb.com",
  "cybersecurity@hitachienergy.com",
  "Mitsubishielectric.Psirt@yd.MitsubishiElectric.co.jp",
  "psirt@honeywell.com",
  "PSIRT@rockwellautomation.com",
  "psirt@bosch.com",
  "psirt@moxa.com",
  "info@cert.vde.com",
  "productsecurity@jci.com",
  "psirt@cisco.com",
  "psirt@fortinet.com",
  "sirt@juniper.net",
  "psirt@paloaltonetworks.com",
  "psirt@zyxel.com.tw",
  "security@eset.com",
  "secure@dell.com",
  "psirt@us.ibm.com",
  "security-alert@hpe.com",
  "psirt@hcl.com",
  "cve-coordination@google.com",
  "secure@microsoft.com",
  "security@apache.org",
  "cve@mitre.org",
];

const KEYWORDS = [
  "SCADA", "PLC", "RTU", "HMI", "Modbus", "DNP3", "IEC 61850", "OPC UA", "BACnet",
  "substation", "relay protection", "energy management system", "distribution automation",
  "building automation", "water treatment", "pipeline", "railway", "crane",
  "air traffic", "radar", "automatic train", "turbine", "transformer monitoring",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": "brain-lab-advisory-sync" } });
      if (res.status === 200) return await res.json();
      if (res.status === 403 || res.status === 503 || res.status === 429) {
        await sleep(20000 * (attempt + 1));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      await sleep(15000 * (attempt + 1));
    }
  }
  return null;
}

function cvss(metrics) {
  const order = ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"];
  for (const k of order) {
    const arr = metrics?.[k];
    if (arr && arr.length) {
      const d = arr[0].cvssData;
      return {
        score: d.baseScore ?? null,
        severity: (d.baseSeverity || arr[0].baseSeverity || "UNKNOWN").toUpperCase(),
        vector: d.vectorString || null,
        version: d.version || k,
      };
    }
  }
  return { score: null, severity: "UNKNOWN", vector: null, version: null };
}

function shape(v) {
  const c = v.cve;
  const en = (c.descriptions || []).find((d) => d.lang === "en");
  const m = cvss(c.metrics);
  const cwes = [];
  for (const w of c.weaknesses || []) {
    for (const d of w.description || []) if (d.value && d.value !== "NVD-CWE-noinfo") cwes.push(d.value);
  }
  const products = [];
  for (const conf of c.configurations || []) {
    for (const node of conf.nodes || []) {
      for (const match of node.cpeMatch || []) {
        const parts = (match.criteria || "").split(":");
        const vendor = parts[3], product = parts[4];
        if (vendor && product) products.push(`${vendor}:${product}`.replace(/_/g, " "));
      }
    }
  }
  return {
    id: c.id,
    source: c.sourceIdentifier || null,
    published: c.published || null,
    lastModified: c.lastModified || null,
    status: c.vulnStatus || null,
    severity: m.severity,
    cvssScore: m.score,
    cvssVector: m.vector,
    cvssVersion: m.version,
    cwes: [...new Set(cwes)].slice(0, 4),
    products: [...new Set(products)].slice(0, 6),
    description: (en?.value || "").replace(/\s+/g, " ").slice(0, 600),
    references: (c.references || []).slice(0, 3).map((r) => r.url),
    url: `https://nvd.nist.gov/vuln/detail/${c.id}`,
  };
}

const byId = new Map();

async function harvest(label, baseParams) {
  let start = 0;
  let total = Infinity;
  while (byId.size < TARGET && start < total) {
    const json = await get(`${baseParams}&resultsPerPage=${PAGE}&startIndex=${start}`);
    await sleep(6500);
    if (!json) { console.log(`  ${label}: request failed, skipping`); return; }
    total = json.totalResults ?? 0;
    const vulns = json.vulnerabilities || [];
    if (!vulns.length) break;
    for (const v of vulns) {
      if (!byId.has(v.cve.id)) byId.set(v.cve.id, shape(v));
    }
    start += PAGE;
    console.log(`  ${label}: ${Math.min(start, total)}/${total} fetched, unique total ${byId.size}`);
  }
}

for (const s of SOURCES) {
  for (const w of WINDOWS) {
    if (byId.size >= TARGET) break;
    console.log(`source ${s} ${w}`);
    await harvest(s, `sourceIdentifier=${encodeURIComponent(s)}&${w}`);
  }
}
for (const k of KEYWORDS) {
  for (const w of WINDOWS) {
    if (byId.size >= TARGET) break;
    console.log(`keyword ${k} ${w}`);
    await harvest(k, `keywordSearch=${encodeURIComponent(k)}&${w}`);
  }
}
const prioritized = byId.size;
// Fill the remainder with other vendors' advisories published the same year.
for (const w of WINDOWS) {
  if (byId.size >= TARGET) break;
  console.log(`all vendors ${w}`);
  await harvest("all vendors", w);
}

const all = [...byId.values()]
  .filter((r) => String(r.published).startsWith(String(YEAR)))
  .sort((a, b) => (b.cvssScore ?? -1) - (a.cvssScore ?? -1) || String(b.published).localeCompare(String(a.published)))
  .slice(0, TARGET)
  .map((r, i) => ({ recordNumber: i + 1, ...r }));

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));
const shards = Math.ceil(all.length / SHARD);
for (let i = 0; i < shards; i++) {
  fs.writeFileSync(
    path.join(OUT_DIR, `shard-${String(i).padStart(3, "0")}.json`),
    JSON.stringify(all.slice(i * SHARD, (i + 1) * SHARD))
  );
}
const severityCounts = {};
for (const r of all) severityCounts[r.severity] = (severityCounts[r.severity] || 0) + 1;
fs.writeFileSync(
  path.join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      provider: "NIST National Vulnerability Database (NVD) CVE API 2.0",
      providerUrl: "https://nvd.nist.gov/developers/vulnerabilities",
      scope: `Public vulnerability advisories published in ${YEAR}. ${prioritized.toLocaleString("en-US")} come from critical-infrastructure, OT/ICS and network vendors; the rest are other vendors' ${YEAR} advisories. These are advisories, not incident reports, and are not attributed to any person or location.`,
      publishedYear: YEAR,
      prioritizedRecords: prioritized,
      totalRecords: all.length,
      shardSize: SHARD,
      shards,
      severityCounts,
    },
    null,
    2
  )
);
console.log(`wrote ${all.length} records in ${shards} shards to ${OUT_DIR}`);
