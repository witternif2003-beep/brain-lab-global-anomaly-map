/** Minimal streaming PNG (8-bit RGBA, filter 0) writer: rows go straight into a zlib CompressionStream, so no full-size image is ever held in memory. */
const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(parts: readonly Uint8Array[]): number {
  let c = 0xffffffff;
  for (const buf of parts) for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (v: number) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);

export function chunk(type: string, data: Uint8Array): Uint8Array {
  const tb = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length), 0);
  out.set(tb, 4);
  out.set(data, 8);
  out.set(u32(crc32([tb, data])), 8 + data.length);
  return out;
}

export type ByteSink = (bytes: Uint8Array) => Promise<void> | void;

export class PngStreamWriter {
  private readonly cs = new CompressionStream('deflate');
  private readonly cw = this.cs.writable.getWriter();
  private pump: Promise<void> | null = null;
  private rowsWritten = 0;
  private idat: Uint8Array[] = [];
  private idatBytes = 0;

  constructor(private readonly sink: ByteSink, readonly width: number, readonly height: number, private readonly idatChunk = 1 << 22) {}

  async start(): Promise<void> {
    await this.sink(SIG);
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, this.width);
    dv.setUint32(4, this.height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    await this.sink(chunk('IHDR', ihdr));
    this.pump = (async () => {
      const r = this.cs.readable.getReader();
      for (;;) {
        const { done, value } = await r.read();
        if (done) break;
        this.idat.push(value);
        this.idatBytes += value.length;
        if (this.idatBytes >= this.idatChunk) await this.flushIdat();
      }
      await this.flushIdat();
    })();
  }

  private async flushIdat(): Promise<void> {
    if (!this.idatBytes) return;
    const data = new Uint8Array(this.idatBytes);
    let o = 0;
    for (const p of this.idat) {
      data.set(p, o);
      o += p.length;
    }
    this.idat = [];
    this.idatBytes = 0;
    await this.sink(chunk('IDAT', data));
  }

  /** Writes `rows` full-width RGBA rows (width × 4 bytes each). */
  async writeRows(rgba: Uint8Array | Uint8ClampedArray, rows: number): Promise<void> {
    const stride = this.width * 4;
    const out = new Uint8Array((stride + 1) * rows);
    for (let r = 0; r < rows; r++) out.set(rgba.subarray(r * stride, (r + 1) * stride), r * (stride + 1) + 1);
    this.rowsWritten += rows;
    await this.cw.write(out);
  }

  async finish(): Promise<void> {
    if (this.rowsWritten !== this.height) throw new Error(`PNG has ${this.rowsWritten} of ${this.height} rows`);
    await this.cw.close();
    await this.pump;
    await this.sink(chunk('IEND', new Uint8Array(0)));
  }
}
