// SHA-256 parity between a local `vercel build` output and what a deployment actually serves.
// Run after `npx vercel build --prod && npx vercel deploy --prebuilt --prod`:
//   npx tsx scripts/verify-byte-parity.ts [--dir .vercel/output/static] [--url https://brain-lab-six.vercel.app]
// Compares every file under <dir>/_next/static. Exits 1 if any file differs or can't be fetched.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const dir = arg("--dir", ".vercel/output/static");
const base = arg("--url", "https://brain-lab-six.vercel.app").replace(/\/$/, "");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function walk(d: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = (await walk(join(dir, "_next/static"))).map((p) => relative(dir, p)).sort();
let match = 0;
const bad: string[] = [];
for (let i = 0; i < files.length; i += 16) {
  await Promise.all(
    files.slice(i, i + 16).map(async (f) => {
      const local = sha(await readFile(join(dir, f)));
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) return void bad.push(`${f} HTTP ${res.status}`);
      const remote = sha(new Uint8Array(await res.arrayBuffer()));
      if (remote === local) match++;
      else bad.push(`${f} local ${local.slice(0, 12)} remote ${remote.slice(0, 12)}`);
    }),
  );
}
for (const b of bad) console.log(`MISMATCH ${b}`);
console.log(`${base}: ${match}/${files.length} files under _next/static SHA-256 identical`);
process.exit(bad.length || !files.length ? 1 : 0);
