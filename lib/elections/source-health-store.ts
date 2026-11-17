import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SourceHealthRecord } from "./types";

export interface SourceHealthStore {
  readonly kind: string;
  readAll(): Promise<SourceHealthRecord[]>;
  getByUrl(url: string): Promise<SourceHealthRecord | undefined>;
  upsertMany(records: SourceHealthRecord[]): Promise<void>;
}

export class MemorySourceHealthStore implements SourceHealthStore {
  readonly kind = "memory";
  private records = new Map<string, SourceHealthRecord>();

  async readAll(): Promise<SourceHealthRecord[]> {
    return [...this.records.values()];
  }

  async getByUrl(url: string): Promise<SourceHealthRecord | undefined> {
    return this.records.get(url);
  }

  async upsertMany(records: SourceHealthRecord[]): Promise<void> {
    for (const r of records) this.records.set(r.url, r);
  }
}

/** JSON file map keyed by URL. Used by the CI probe run, restored between runs from the Actions cache. */
export class FileSourceHealthStore implements SourceHealthStore {
  readonly kind = "file";
  constructor(private readonly file: string) {}

  private async load(): Promise<Record<string, SourceHealthRecord>> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as Record<string, SourceHealthRecord>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  async readAll(): Promise<SourceHealthRecord[]> {
    return Object.values(await this.load());
  }

  async getByUrl(url: string): Promise<SourceHealthRecord | undefined> {
    return (await this.load())[url];
  }

  async upsertMany(records: SourceHealthRecord[]): Promise<void> {
    const all = await this.load();
    for (const r of records) all[r.url] = r;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2));
    await rename(tmp, this.file);
  }
}

let memorySingleton: MemorySourceHealthStore | undefined;

/**
 * ROSTER_HEALTH_STORE=file (with ROSTER_HEALTH_FILE) persists to disk;
 * anything else uses one in-process store, which on serverless lives only as
 * long as the function instance.
 */
export function getHealthStore(): SourceHealthStore {
  if (process.env.ROSTER_HEALTH_STORE === "file") {
    return new FileSourceHealthStore(process.env.ROSTER_HEALTH_FILE ?? path.join(process.cwd(), ".roster-health.json"));
  }
  memorySingleton ??= new MemorySourceHealthStore();
  return memorySingleton;
}
