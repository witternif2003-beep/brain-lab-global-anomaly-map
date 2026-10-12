// Bounded HTTP load test: node scripts/perf/load.mjs <baseUrl> <concurrency> <seconds> <path...>
const [base, conc = '50', secs = '30', ...paths] = process.argv.slice(2);
if (!base || !paths.length) {
  console.error('usage: node scripts/perf/load.mjs <baseUrl> <concurrency> <seconds> <path...>');
  process.exit(2);
}
const until = Date.now() + Number(secs) * 1000;
const lat = [];
const codes = {};
let errors = 0;
let i = 0;
async function worker() {
  while (Date.now() < until) {
    const p = paths[i++ % paths.length];
    const t0 = performance.now();
    try {
      const r = await fetch(base + p, { signal: AbortSignal.timeout(30_000) });
      await r.arrayBuffer();
      codes[r.status] = (codes[r.status] ?? 0) + 1;
    } catch {
      errors++;
    }
    lat.push(performance.now() - t0);
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
lat.sort((a, b) => a - b);
const q = (p) => Math.round(lat[Math.min(lat.length - 1, Math.floor(p * lat.length))]);
console.log(JSON.stringify({ base, concurrency: Number(conc), seconds: Number(secs), paths, requests: lat.length, rps: Math.round(lat.length / Number(secs)), codes, errors, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: Math.round(lat.at(-1)) }));
