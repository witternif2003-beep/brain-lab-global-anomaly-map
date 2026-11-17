/** NOAA MRMS GRIB2 (lat/lon grid, template 3.0; PNG packing, template 5.41) → regional value subset (pure, Node zlib). */
import { inflateSync } from 'node:zlib';

export interface Bbox { latMin: number; latMax: number; lngMin: number; lngMax: number }

export interface MrmsGrid {
  /** Validity time from GRIB2 section 1 (UTC ISO). */
  time: string;
  width: number;
  height: number;
  /** Centre of the north-west subset cell. */
  lat0: number;
  lng0: number;
  stepDeg: number;
  /** Row-major, north to south, west to east. */
  values: Float32Array;
}

const u32 = (b: Buffer, o: number) => b.readUInt32BE(o);
/** GRIB2 signed integers are sign-magnitude. */
const s32 = (b: Buffer, o: number) => {
  const v = b.readUInt32BE(o);
  return v & 0x80000000 ? -(v & 0x7fffffff) : v;
};
const s16 = (b: Buffer, o: number) => {
  const v = b.readUInt16BE(o);
  return v & 0x8000 ? -(v & 0x7fff) : v;
};

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes a 16-bit greyscale PNG and returns raw sample values for rows [row0, row1) and columns [col0, col1). */
export function decodePng16(png: Buffer, row0: number, row1: number, col0: number, col1: number): { width: number; samples: Uint16Array } {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('GRIB2 section 7 is not a PNG');
  let o = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o);
    const type = png.toString('ascii', o + 4, o + 8);
    const data = png.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (colorType !== 0 || (bitDepth !== 16 && bitDepth !== 8)) throw new Error(`unsupported PNG (type ${colorType}, ${bitDepth}-bit)`);
  const bpp = bitDepth / 8;
  const stride = width * bpp;
  const end = Math.min(row1, height);
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  const w = col1 - col0;
  const samples = new Uint16Array(w * Math.max(0, end - row0));
  for (let y = 0; y < end; y++) {
    const base = y * (stride + 1);
    const filter = raw[base];
    for (let x = 0; x < stride; x++) {
      const r = raw[base + 1 + x];
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      cur[x] = (filter === 0 ? r : filter === 1 ? r + a : filter === 2 ? r + b : filter === 3 ? r + ((a + b) >> 1) : r + paeth(a, b, c)) & 0xff;
    }
    if (y >= row0) {
      const out = (y - row0) * w;
      for (let x = col0; x < col1; x++) samples[out + x - col0] = bpp === 2 ? (cur[x * 2] << 8) | cur[x * 2 + 1] : cur[x];
    }
    [prev, cur] = [cur, prev];
  }
  return { width, samples };
}

/** Reads one MRMS GRIB2 message and returns physical values (Y = (R + X·2^E) / 10^D) inside `bbox`. */
export function readMrmsGrib2(grib: Buffer, bbox: Bbox): MrmsGrid {
  if (grib.toString('ascii', 0, 4) !== 'GRIB' || grib[7] !== 2) throw new Error('not a GRIB2 message');
  let o = 16;
  let time = '';
  let nx = 0;
  let ny = 0;
  let la1 = 0;
  let lo1 = 0;
  let dx = 0;
  let dy = 0;
  let R = 0;
  let E = 0;
  let D = 0;
  let png: Buffer | null = null;
  while (o < grib.length - 4 && grib.toString('ascii', o, o + 4) !== '7777') {
    const len = u32(grib, o);
    const sec = grib[o + 4];
    if (sec === 1) {
      const t = (i: number) => String(grib[o + i]).padStart(2, '0');
      time = `${grib.readUInt16BE(o + 12)}-${t(14)}-${t(15)}T${t(16)}:${t(17)}:${t(18)}Z`;
    } else if (sec === 3) {
      if (grib.readUInt16BE(o + 12) !== 0) throw new Error('MRMS grid is not a lat/lon grid');
      nx = u32(grib, o + 30);
      ny = u32(grib, o + 34);
      la1 = s32(grib, o + 46) / 1e6;
      lo1 = s32(grib, o + 50) / 1e6;
      dx = u32(grib, o + 63) / 1e6;
      dy = u32(grib, o + 67) / 1e6;
      if (grib[o + 71] !== 0) throw new Error(`unsupported scanning mode ${grib[o + 71]}`);
    } else if (sec === 5) {
      if (grib.readUInt16BE(o + 9) !== 41) throw new Error('MRMS field is not PNG-packed');
      R = grib.readFloatBE(o + 11);
      E = s16(grib, o + 15);
      D = s16(grib, o + 17);
    } else if (sec === 7) png = grib.subarray(o + 5, o + len);
    o += len;
  }
  if (!png || !nx || !ny) throw new Error('GRIB2 message missing grid or data section');
  const lng0All = lo1 > 180 ? lo1 - 360 : lo1;
  const row0 = Math.max(0, Math.ceil((la1 - bbox.latMax) / dy));
  const row1 = Math.min(ny, Math.floor((la1 - bbox.latMin) / dy) + 1);
  const col0 = Math.max(0, Math.ceil((bbox.lngMin - lng0All) / dx));
  const col1 = Math.min(nx, Math.floor((bbox.lngMax - lng0All) / dx) + 1);
  const { samples } = decodePng16(png, row0, row1, col0, col1);
  const scaleE = 2 ** E;
  const scaleD = 10 ** D;
  const values = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) values[i] = (R + samples[i] * scaleE) / scaleD;
  return { time, width: col1 - col0, height: row1 - row0, lat0: la1 - row0 * dy, lng0: lng0All + col0 * dx, stepDeg: dx, values };
}
