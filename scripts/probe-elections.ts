/**
 * Probes the 56 official election-office sites, updates the persistent
 * health/content/change stores and writes a report.
 *
 *   npm run probe:elections
 *
 * State lives in ROSTER_STATE_DIR (default .roster-state/). Exit code 1 when
 * a site that was healthy on the previous run now fails, or when the pinned
 * roster no longer matches the live USA.gov directory. A bot-management
 * block is reported but does not fail the run.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getContentStores } from "../lib/elections/change-store";
import { checkDirectoryDrift } from "../lib/elections/directory-drift";
import { ELECTION_OFFICES } from "../lib/elections/election-offices";
import { verifyOfficePage } from "../lib/elections/entity-name-verifier";
import { runProbes } from "../lib/elections/probe-runner";
import { MemorySink, StdoutJsonSink } from "../lib/elections/probe-telemetry";
import { isHealthy } from "../lib/elections/source-health";
import { getHealthStore } from "../lib/elections/source-health-store";
import { scoreRecord } from "../lib/elections/source-reliability";

const stateDir = path.resolve(process.env.ROSTER_STATE_DIR ?? ".roster-state");
process.env.ROSTER_HEALTH_STORE = "file";
process.env.ROSTER_HEALTH_FILE = path.join(stateDir, ".roster-health.json");

async function main() {
  await mkdir(stateDir, { recursive: true });
  const health = getHealthStore();
  const stores = { health, ...getContentStores() };
  const before = new Map((await health.readAll()).map((r) => [r.url, r]));

  const telemetry = process.env.PROBE_JSON_EVENTS === "1" ? new StdoutJsonSink() : new MemorySink();
  const [run, drift] = await Promise.all([
    runProbes(
      ELECTION_OFFICES.map((o) => o.url),
      stores,
      {
        maxHostConcurrency: 8,
        perHostDelayMs: 500,
        telemetry,
        onProbe: ({ url, probe, index, total }) => {
          if (process.env.PROBE_JSON_EVENTS === "1") return;
          const code = ELECTION_OFFICES.find((o) => o.url === url)?.code ?? "??";
          const mark = isHealthy(probe.status) ? "ok " : "ERR";
          console.log(`[${String(index + 1).padStart(2)}/${total}] ${mark} ${code} ${probe.status.padEnd(13)} ${String(probe.httpStatus ?? "-").padEnd(3)} ${String(probe.latencyMs).padStart(6)}ms ${url}${probe.error ? "  " + probe.error : ""}`);
        }
      }
    ),
    checkDirectoryDrift(ELECTION_OFFICES)
  ]);

  const rows = await Promise.all(
    ELECTION_OFFICES.map(async (o) => {
      const rec = await health.getByUrl(o.url);
      const text = run.texts.get(o.url) ?? (await stores.content.get(o.url))?.normalized;
      const prev = before.get(o.url);
      return {
        code: o.code,
        name: o.name,
        url: o.url,
        probe: rec?.lastProbe,
        reliability: scoreRecord(rec, o.url),
        verification: verifyOfficePage(o, rec?.lastProbe, text),
        regression: !!prev && isHealthy(prev.lastProbe.status) && !!rec && !isHealthy(rec.lastProbe.status) && rec.lastProbe.status !== "blocked"
      };
    })
  );

  const regressions = rows.filter((r) => r.regression);
  const driftProblems = drift.status === "ok" ? drift.changed.length + drift.missing.length : 0;
  const report = { generatedAt: new Date().toISOString(), summary: run.summary, durationMs: run.durationMs, drift, rows, regressions: regressions.map((r) => r.code) };
  await writeFile(path.join(stateDir, "report.json"), JSON.stringify(report, null, 2));

  const band = (b: string) => rows.filter((r) => r.reliability.band === b).length;
  const verdict = (v: string) => rows.filter((r) => r.verification.verdict === v).length;
  const lines = [
    `## Election source health — ${report.generatedAt}`,
    "",
    `Probed ${run.summary.total} sites in ${(run.durationMs / 1000).toFixed(1)} s: ok ${run.summary.ok}, not-modified ${run.summary.notModified}, blocked ${run.summary.blocked}, http-error ${run.summary.httpError}, dns-error ${run.summary.dnsError}, tls-error ${run.summary.tlsError}, timeout ${run.summary.timeout}, network-error ${run.summary.networkError}, changed ${run.summary.changed}.`,
    `Reliability: healthy ${band("healthy")}, degraded ${band("degraded")}, failing ${band("failing")}, unknown ${band("unknown")}.`,
    `Page names its jurisdiction: verified ${verdict("verified")}, not-found ${verdict("not-found")}, unverifiable ${verdict("unverifiable")}.`,
    drift.status === "ok"
      ? `USA.gov directory: ${drift.entryCount} entries, ${drift.changed.length} URL changes, ${drift.missing.length} missing, out of scope: ${drift.outOfScope.map((e) => e.code).join(", ") || "none"}.`
      : `USA.gov directory check failed: ${drift.error}`,
    ...drift.changed.map((c) => `- ${c.code}: pinned ${c.pinned} → live ${c.live}`),
    regressions.length ? `Regressions (healthy last run, failing now, excluding bot blocks): ${regressions.map((r) => r.code).join(", ")}` : "No regressions since the previous run.",
    "",
    "| Code | Status | HTTP | ms | Band | Page check |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.code} | ${r.probe?.status ?? "-"} | ${r.probe?.httpStatus ?? "-"} | ${r.probe?.latencyMs ?? "-"} | ${r.reliability.band} | ${r.verification.verdict} |`)
  ];
  console.log("\n" + lines.slice(0, 8).join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");

  process.exit(regressions.length > 0 || driftProblems > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
