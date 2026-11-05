import fs from 'node:fs';
const files = fs.readFileSync('/tmp/audit-files.txt','utf8').trim().split('\n');
const R = {
  random: /Math\.random\(/g,
  fetch: /\bfetch\(/g,
  timeout: /AbortSignal\.timeout|AbortController|signal:/g,
  setInterval: /setInterval\(/g, clearInterval: /clearInterval\(/g,
  addEL: /addEventListener\(/g, rmEL: /removeEventListener\(/g,
  raf: /requestAnimationFrame\(/g, caf: /cancelAnimationFrame\(/g,
  any: /:\s*any\b|as any\b|<any>/g,
  consoleLog: /console\.log\(/g,
  secret: /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,})/gi,
  edge: /runtime\s*=\s*['"]edge['"]/g,
  moduleMap: /^(const|let)\s+\w+\s*=\s*new Map/gm,
  dangerHTML: /dangerouslySetInnerHTML/g,
  post: /export async function (POST|PUT|DELETE)/g,
  auth: /authorization|CRON_SECRET|x-api-key|Bearer/gi,
  maxDuration: /export const maxDuration/g,
  todo: /TODO|FIXME|XXX/g,
  live: /\blive\b|real-?time/gi,
  simulated: /simulat|synthetic|mock|fake|demo/gi,
};
const out = [];
for (const f of files) {
  let s; try { s = fs.readFileSync(f,'utf8'); } catch { continue; }
  const c = {}; for (const [k,re] of Object.entries(R)) c[k] = (s.match(re)||[]).length;
  out.push({ f, lines: s.split('\n').length, ...c });
}
fs.writeFileSync('/home/ubuntu/audit/scan.json', JSON.stringify(out,null,1));
const flag = (r) => {
  const x = [];
  if (r.random) x.push(`random×${r.random}`);
  if (r.fetch && !r.timeout && /^(app\/api|lib)/.test(r.f)) x.push(`fetch-no-timeout×${r.fetch}`);
  if (r.setInterval > r.clearInterval) x.push(`interval-leak?${r.setInterval}/${r.clearInterval}`);
  if (r.addEL > r.rmEL) x.push(`listener-leak?${r.addEL}/${r.rmEL}`);
  if (r.raf && !r.caf) x.push(`raf-no-cancel×${r.raf}`);
  if (r.any) x.push(`any×${r.any}`);
  if (r.consoleLog) x.push(`console.log×${r.consoleLog}`);
  if (r.secret) x.push(`SECRET?×${r.secret}`);
  if (r.edge) x.push('edge');
  if (r.moduleMap) x.push(`module-Map×${r.moduleMap}`);
  if (r.dangerHTML) x.push('dangerHTML');
  if (r.post && !r.auth) x.push(`write-no-auth×${r.post}`);
  if (r.f.startsWith('app/api') && r.fetch && !r.maxDuration) x.push('no-maxDuration');
  return x.join(' ');
};
for (const r of out) { const x = flag(r); if (x) console.log(`${r.f} (${r.lines}) : ${x}`); }
console.log('files scanned', out.length);
