import { test } from "node:test";
import assert from "node:assert/strict";
import { defang, ipv4Host, newestFirst, parseFeodo, parseKev, parseRss, parseSslbl, parseThreatfox, parseUrlhaus, utcIso } from "../../lib/fbi-osint/parse";
import { buildIpCountryDb } from "../../lib/fbi-osint/geo";

test("defangs URLs and IPs", () => {
  assert.equal(defang("http://120.84.212.113:55570/bin.sh"), "hxxp://120[.]84[.]212[.]113:55570/bin[.]sh");
  assert.equal(defang("https://a.b/x"), "hxxps://a[.]b/x");
});

test("parses abuse.ch and CISA timestamps as UTC", () => {
  assert.equal(utcIso("2026-10-14 20:20:12 UTC"), "2026-10-14T20:20:12.000Z");
  assert.equal(utcIso("2026-10-14"), "2026-10-14T00:00:00.000Z");
  assert.equal(utcIso("Tue, 13 Oct 2026 15:00:00 -04:00"), "2026-10-13T19:00:00.000Z");
  assert.equal(utcIso("nope"), null);
});

test("parses IC3 RSS items", () => {
  const xml = `<rss><channel><item><title>North Korean IT Workers &amp; Facilitators</title><link>https://www.ic3.gov/PSA/2026/PSA261013</link><pubDate>Tue, 13 Oct 2026 15:00:00 -04:00</pubDate></item><item><title>no date</title></item></channel></rss>`;
  const out = parseRss(xml, "ic3-psa", "PSA");
  assert.equal(out.length, 1);
  assert.equal(out[0].value, "North Korean IT Workers & Facilitators");
  assert.equal(out[0].ref, "https://www.ic3.gov/PSA/2026/PSA261013");
});

test("parses URLhaus, ThreatFox, SSLBL, Feodo and KEV rows", () => {
  const u = parseUrlhaus({ "1": [{ dateadded: "2026-10-14 20:20:12 UTC", url: "http://x.y/a", url_status: "online", threat: "malware_download", tags: ["Mozi"], urlhaus_link: "https://urlhaus.abuse.ch/url/1/" }] });
  assert.equal(u[0].value, "hxxp://x[.]y/a");
  assert.equal(u[0].threat, "malware_download · online · Mozi");
  const t = parseThreatfox({ "9": [{ ioc_value: "abc123", ioc_type: "sha256_hash", malware_printable: "Vidar", threat_type: "payload", first_seen_utc: "2026-10-14 20:29:31", confidence_level: 100 }] });
  assert.equal(t[0].value, "abc123");
  assert.equal(t[0].ref, "https://threatfox.abuse.ch/ioc/9/");
  const s = parseSslbl("# header\n2026-10-14 05:49:58,09545cca,Vidar C&C\n");
  assert.equal(s.length, 1);
  assert.equal(s[0].threat, "Vidar C&C");
  const f = parseFeodo([{ ip_address: "1.2.3.4", port: 8080, status: "offline", malware: "Emotet", last_online: "2026-03-07" }]);
  assert.equal(f[0].value, "1[.]2[.]3[.]4:8080");
  const k = parseKev({ vulnerabilities: [{ cveID: "CVE-2026-1", vendorProject: "Acme", product: "VPN", vulnerabilityName: "RCE", dateAdded: "2026-10-01", knownRansomwareCampaignUse: "Known" }] });
  assert.equal(k[0].threat, "Acme VPN · RCE · used in ransomware");
});

test("sorts newest first, dedupes and caps", () => {
  const mk = (id: string, seenAt: string) => ({ id, source: "kev" as const, kind: "cve", value: id, threat: "", seenAt, ref: "" });
  const out = newestFirst([mk("a", "2026-01-01T00:00:00Z"), mk("b", "2026-03-01T00:00:00Z"), mk("a", "2026-01-01T00:00:00Z"), mk("c", "2026-02-01T00:00:00Z")], 2);
  assert.deepEqual(out.map((i) => i.id), ["b", "c"]);
});

test('ipv4Host extracts IPv4 hosts only', () => {
  assert.equal(ipv4Host('http://1.2.3.4:8080/a.sh'), '1.2.3.4');
  assert.equal(ipv4Host('5.6.7.8:443'), '5.6.7.8');
  assert.equal(ipv4Host('http://evil.example/x'), undefined);
  assert.equal(ipv4Host('http://999.1.1.1/'), undefined);
});

test('IP country db resolves ranges and gaps', () => {
  const db = buildIpCountryDb({ source: 't', codes: ['', 'AU', 'CN'], starts: [16777216, 256, 512], cc: [1, 0, 2], centroids: { AU: [-25, 133, 'Australia'] } });
  assert.equal(db.lookup('1.0.0.5'), 'AU');
  assert.equal(db.lookup('1.0.1.5'), undefined);
  assert.equal(db.lookup('1.0.3.0'), 'CN');
  assert.equal(db.lookup('0.0.0.1'), undefined);
  assert.equal(db.centroid('AU')?.name, 'Australia');
});
