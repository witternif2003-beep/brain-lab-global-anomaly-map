import assert from "node:assert/strict";
import { test } from "node:test";
import { MapChangeStore, MapContentStore } from "../../lib/elections/change-store";
import { compareDirectory, parseDirectory } from "../../lib/elections/directory-drift";
import { ELECTION_OFFICES } from "../../lib/elections/election-offices";
import { verifyOfficePage } from "../../lib/elections/entity-name-verifier";
import { extractTitle, normalizeHtml } from "../../lib/elections/page-fingerprint";
import { runProbes } from "../../lib/elections/probe-runner";
import { MemorySink } from "../../lib/elections/probe-telemetry";
import { applyProbe, classifyFetchError, probeSource } from "../../lib/elections/source-health";
import { MemorySourceHealthStore } from "../../lib/elections/source-health-store";
import { scoreRecord } from "../../lib/elections/source-reliability";

const page = (title: string, body: string) =>
  `<html><head><title>${title}</title><style>.x{}</style><script>var t=Date.now()</script></head><body><h1>${body}</h1><p>${"Voting information. ".repeat(20)}</p></body></html>`;

function fakeFetch(routes: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const h = routes[url];
    if (!h) throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
    return h();
  };
}

test("roster covers exactly the 56 jurisdictions with unique https URLs", () => {
  assert.equal(ELECTION_OFFICES.length, 56);
  assert.equal(new Set(ELECTION_OFFICES.map((o) => o.code)).size, 56);
  for (const o of ELECTION_OFFICES) assert.match(o.url, /^https:\/\//);
  assert.equal(ELECTION_OFFICES.filter((o) => o.type === "territory").length, 5);
});

test("normalizeHtml drops scripts/styles and keeps visible text per block", () => {
  const html = page("Alabama Votes &amp; Elections", "Alabama Secretary of State");
  assert.equal(extractTitle(html), "Alabama Votes & Elections");
  const text = normalizeHtml(html);
  assert.ok(!text.includes("Date.now"));
  assert.ok(!text.includes(".x{}"));
  assert.ok(text.split("\n").includes("Alabama Secretary of State"));
});

test("classifyFetchError maps undici causes", () => {
  const mk = (code: string) => new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) });
  assert.equal(classifyFetchError(mk("ENOTFOUND")).status, "dns-error");
  assert.equal(classifyFetchError(mk("UNABLE_TO_VERIFY_LEAF_SIGNATURE")).status, "tls-error");
  assert.equal(classifyFetchError(new DOMException("The operation was aborted due to timeout", "TimeoutError")).status, "timeout");
  assert.equal(classifyFetchError(mk("ECONNRESET")).status, "network-error");
});

test("probeSource statuses: ok, blocked, http-error, dns-error, too-large", async () => {
  const f = fakeFetch({
    "https://ok.test/": () => new Response(page("Ohio", "Ohio elections"), { status: 200 }),
    "https://blocked.test/": () => new Response("denied", { status: 403, statusText: "Forbidden" }),
    "https://wall.test/": () => new Response(page("Just a moment...", "checking"), { status: 200 }),
    "https://gone.test/": () => new Response("nope", { status: 404 }),
    "https://big.test/": () => new Response("x".repeat(2048), { status: 200 })
  });
  const opts = { fetchImpl: f, maxRetries: 0 };
  assert.equal((await probeSource("https://ok.test/", opts)).probe.status, "ok");
  assert.equal((await probeSource("https://blocked.test/", opts)).probe.status, "blocked");
  assert.equal((await probeSource("https://wall.test/", opts)).probe.status, "blocked");
  const gone = (await probeSource("https://gone.test/", opts)).probe;
  assert.equal(gone.status, "http-error");
  assert.equal(gone.httpStatus, 404);
  assert.equal((await probeSource("https://nx.test/", opts)).probe.status, "dns-error");
  assert.equal((await probeSource("https://big.test/", { ...opts, maxBytes: 1024 })).probe.status, "too-large");
});

test("probeSource retries transient 503 then succeeds", async () => {
  let n = 0;
  const f = fakeFetch({ "https://flaky.test/": () => (++n === 1 ? new Response("", { status: 503 }) : new Response(page("x", "y"))) });
  const { probe } = await probeSource("https://flaky.test/", { fetchImpl: f, maxRetries: 1 });
  assert.equal(probe.status, "ok");
  assert.equal(probe.attempts, 2);
});

test("applyProbe + scoreRecord track failures, uptime and bands", () => {
  const url = "https://x.test/";
  const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
  let r = applyProbe(undefined, { url, status: "ok", probedAt: at(0), latencyMs: 100, attempts: 1, fingerprint: "a" });
  assert.equal(scoreRecord(r, url).band, "healthy");
  r = applyProbe(r, { url, status: "timeout", probedAt: at(1), latencyMs: 15000, attempts: 2 });
  assert.equal(r.consecutiveFailures, 1);
  assert.equal(scoreRecord(r, url).band, "degraded");
  r = applyProbe(r, { url, status: "timeout", probedAt: at(2), latencyMs: 15000, attempts: 2 });
  r = applyProbe(r, { url, status: "timeout", probedAt: at(3), latencyMs: 15000, attempts: 2 });
  const s = scoreRecord(r, url);
  assert.equal(s.band, "failing");
  assert.equal(s.uptime, 0.25);
  assert.equal(s.medianLatencyMs, 100);
  assert.equal(r.lastOkAt, at(0));
  r = applyProbe(r, { url, status: "ok", probedAt: at(4), latencyMs: 120, attempts: 1, fingerprint: "b" });
  assert.equal(r.previousFingerprint, "a");
  assert.equal(r.fingerprintChangedAt, at(4));
  assert.equal(scoreRecord(undefined, url).band, "unknown");
  const dns = applyProbe(undefined, { url, status: "dns-error", probedAt: at(0), latencyMs: 5, attempts: 2 });
  assert.equal(scoreRecord(dns, url).band, "failing");
});

test("verifyOfficePage checks the page names its jurisdiction", () => {
  const pr = ELECTION_OFFICES.find((o) => o.code === "PR");
  const va = ELECTION_OFFICES.find((o) => o.code === "VA");
  assert.ok(pr && va);
  const ok = { url: pr.url, status: "ok" as const, probedAt: "", latencyMs: 1, attempts: 1, title: "CEE" };
  const text = normalizeHtml(page("Inicio", "Comisión Estatal de Elecciones de Puerto Rico"));
  assert.equal(verifyOfficePage(pr, ok, text).verdict, "verified");
  // "West Virginia" must not satisfy Virginia
  assert.equal(verifyOfficePage(va, { ...ok, url: va.url, title: "" }, normalizeHtml(page("", "West Virginia elections"))).verdict, "not-found");
  assert.equal(verifyOfficePage(va, { ...ok, status: "blocked" }, undefined).verdict, "unverifiable");
});

test("directory parse + compare flags changed, missing and out-of-scope entries", () => {
  const html = `<ul><li><a class="url" id="AL" href="https://www.sos.alabama.gov/alabama-votes">Alabama (AL)</a></li>
    <li><a class="url" id="AK" href="https://new.alaska.example/">Alaska (AK)</a></li>
    <li><a class="url" id="PW" href="https://palauelection.org/">Republic of Palau (PW)</a></li></ul>`;
  const entries = parseDirectory(html);
  assert.equal(entries.length, 3);
  const d = compareDirectory(entries, ELECTION_OFFICES);
  assert.deepEqual(d.changed.map((c) => c.code), ["AK"]);
  assert.deepEqual(d.outOfScope.map((e) => e.code), ["PW"]);
  assert.equal(d.missing.length, 54);
});

test("runProbes serializes per host, records content changes and emits telemetry", async () => {
  let version = 1;
  const active = new Map<string, number>();
  let overlap = false;
  const serve = (host: string, body: () => string) => async () => {
    active.set(host, (active.get(host) ?? 0) + 1);
    if ((active.get(host) ?? 0) > 1) overlap = true;
    await new Promise((r) => setTimeout(r, 5));
    active.set(host, (active.get(host) ?? 1) - 1);
    return new Response(body());
  };
  const f = fakeFetch({
    "https://a.test/1": serve("a", () => page("A", `Line one\nversion ${version}`)),
    "https://a.test/2": serve("a", () => page("A2", "static")),
    "https://b.test/": serve("b", () => page("B", "static b"))
  });
  const stores = { health: new MemorySourceHealthStore(), content: new MapContentStore(), changes: new MapChangeStore() };
  const urls = ["https://a.test/1", "https://a.test/2", "https://b.test/", "https://nx.test/"];
  const opts = { perHostDelayMs: 0, probeOptions: { fetchImpl: f, maxRetries: 0 } };

  const sink = new MemorySink();
  const first = await runProbes(urls, stores, { ...opts, telemetry: sink });
  assert.equal(overlap, false);
  assert.equal(first.summary.ok, 3);
  assert.equal(first.summary.dnsError, 1);
  assert.equal(first.summary.changed, 0);
  assert.equal(sink.events.filter((e) => e.eventType === "roster.probe").length, 4);
  assert.equal(sink.events.at(-1)?.eventType, "roster.probe_run");

  version = 2;
  const second = await runProbes(urls, stores, opts);
  assert.equal(second.summary.changed, 1);
  const changes = await stores.changes.listByUrl("https://a.test/1");
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].diff.removed, ["version 1"]);
  assert.deepEqual(changes[0].diff.added, ["version 2"]);
  assert.equal((await stores.health.getByUrl("https://nx.test/"))?.consecutiveFailures, 2);
});
