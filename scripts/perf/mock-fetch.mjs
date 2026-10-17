// Preload for load tests: replaces global fetch so no request leaves the machine during a load run.
//   UPSTREAM_MODE=record  first call per URL goes to the real upstream once and is saved to UPSTREAM_DIR
//   UPSTREAM_MODE=replay  (default) only saved responses are served; unknown URLs get 503
// UPSTREAM_LATENCY_MS adds a fixed delay; UPSTREAM_RPS caps replayed requests per second per host (429 above it).
// Usage: NODE_OPTIONS="--import ./scripts/perf/mock-fetch.mjs" npx next start
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MODE = process.env.UPSTREAM_MODE ?? 'replay';
const DIR = process.env.UPSTREAM_DIR ?? '.perf-fixtures';
const LATENCY = Number(process.env.UPSTREAM_LATENCY_MS ?? 0);
const RPS = Number(process.env.UPSTREAM_RPS ?? 0);
const realFetch = globalThis.fetch;
const buckets = new Map();
const stats = { replayed: 0, recorded: 0, missing: 0, limited: 0 };
mkdirSync(DIR, { recursive: true });

const local = (u) => ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname) || u.hostname.endsWith('.svc');
const keyOf = (method, url, body) => createHash('sha256').update(`${method} ${url} ${body ?? ''}`).digest('hex').slice(0, 32);

function limited(host) {
  if (!RPS) return false;
  const now = Math.floor(Date.now() / 1000);
  const b = buckets.get(host);
  if (!b || b.sec !== now) { buckets.set(host, { sec: now, n: 1 }); return false; }
  return ++b.n > RPS;
}

globalThis.fetch = async function mockFetch(input, init = {}) {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  if (local(url)) return realFetch(input, init);
  const method = (init.method ?? req?.method ?? 'GET').toUpperCase();
  const body = typeof init.body === 'string' ? init.body : undefined;
  const file = join(DIR, `${keyOf(method, url.href, body)}.json`);
  if (existsSync(file)) {
    if (limited(url.hostname)) { stats.limited++; return new Response('rate limited (mock)', { status: 429 }); }
    if (LATENCY) await new Promise((r) => setTimeout(r, LATENCY));
    const f = JSON.parse(readFileSync(file, 'utf8'));
    stats.replayed++;
    return new Response(Buffer.from(f.body, 'base64'), { status: f.status, headers: f.headers });
  }
  if (MODE !== 'record') { stats.missing++; return new Response('no recorded fixture (mock)', { status: 503 }); }
  const res = await realFetch(input, init);
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k)));
  writeFileSync(file, JSON.stringify({ url: url.href, method, status: res.status, headers, body: buf.toString('base64') }));
  stats.recorded++;
  return new Response(buf, { status: res.status, headers });
};

process.on('SIGTERM', () => { console.error('[mock-fetch]', JSON.stringify(stats)); process.exit(0); });
setInterval(() => console.error('[mock-fetch]', JSON.stringify(stats)), 10_000).unref();
