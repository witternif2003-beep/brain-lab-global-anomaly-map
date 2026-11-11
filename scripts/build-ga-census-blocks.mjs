#!/usr/bin/env node
/**
 * Builds public/data/ga-census-blocks-2020.bin from the Census Bureau TIGER/Line 2020 tabulation-block
 * file for Georgia (https://www2.census.gov/geo/tiger/TIGER2020/TABBLOCK20/tl_2020_13_tabblock20.zip).
 * Keeps blocks with POP20 > 0: each record is the block's internal point (INTPTLON20/INTPTLAT20) and
 * its 2020 census population. Layout (little-endian): u32 n, i32 lon×1e6 [n], i32 lat×1e6 [n], u16 pop [n].
 * Usage: node scripts/build-ga-census-blocks.mjs path/to/tl_2020_13_tabblock20.dbf
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dbf = readFileSync(process.argv[2] ?? 'tl_2020_13_tabblock20.dbf');
const nRec = dbf.readUInt32LE(4);
const headerLen = dbf.readUInt16LE(8);
const recLen = dbf.readUInt16LE(10);
const fields = [];
for (let off = 32, pos = 1; dbf[off] !== 0x0d; off += 32) {
  const name = dbf.toString('latin1', off, off + 11).replace(/\0.*$/, '');
  const len = dbf[off + 16];
  fields.push({ name, pos, len });
  pos += len;
}
const f = (name) => fields.find((x) => x.name === name) ?? (() => { throw new Error(`missing field ${name}`); })();
const [LON, LAT, POP] = [f('INTPTLON20'), f('INTPTLAT20'), f('POP20')];
const lon = [], lat = [], pop = [];
let total = 0;
for (let i = 0; i < nRec; i++) {
  const r = headerLen + i * recLen;
  if (dbf[r] === 0x2a) continue;
  const read = (fd) => dbf.toString('latin1', r + fd.pos, r + fd.pos + fd.len).trim();
  const p = Number(read(POP));
  if (!(p > 0)) continue;
  if (p > 65535) throw new Error(`block population ${p} exceeds u16`);
  lon.push(Math.round(Number(read(LON)) * 1e6));
  lat.push(Math.round(Number(read(LAT)) * 1e6));
  pop.push(p);
  total += p;
}
const n = pop.length;
const out = Buffer.alloc(4 + n * 10);
out.writeUInt32LE(n, 0);
for (let i = 0; i < n; i++) {
  out.writeInt32LE(lon[i], 4 + 4 * i);
  out.writeInt32LE(lat[i], 4 + 4 * n + 4 * i);
  out.writeUInt16LE(pop[i], 4 + 8 * n + 2 * i);
}
writeFileSync('public/data/ga-census-blocks-2020.bin', out);
console.log(`${nRec} blocks read, ${n} populated, population ${total}, ${out.length} bytes`);
