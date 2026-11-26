import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffText, type TextDiff } from "./myers-diff";

export const MAX_STORED_CHARS = 200_000;
const MAX_CHANGES_PER_URL = 10;

export interface StoredContent {
  url: string;
  fingerprint: string;
  normalized: string;
  originalLength: number;
  capturedAt: string;
}

export interface ChangeRecord {
  url: string;
  fromFingerprint: string;
  toFingerprint: string;
  capturedAt: string;
  diff: TextDiff;
}

export function captureContent(url: string, fingerprint: string, normalized: string, at = new Date().toISOString()): StoredContent {
  return { url, fingerprint, normalized: normalized.slice(0, MAX_STORED_CHARS), originalLength: normalized.length, capturedAt: at };
}

export function buildChangeRecord(before: StoredContent, after: StoredContent): ChangeRecord {
  return {
    url: after.url,
    fromFingerprint: before.fingerprint,
    toFingerprint: after.fingerprint,
    capturedAt: after.capturedAt,
    diff: diffText(before.normalized, after.normalized)
  };
}

export interface ContentStore {
  get(url: string): Promise<StoredContent | undefined>;
  put(content: StoredContent): Promise<void>;
}

export interface ChangeStore {
  record(change: ChangeRecord): Promise<void>;
  listByUrl(url: string): Promise<ChangeRecord[]>;
  listAll(): Promise<ChangeRecord[]>;
}

class JsonMap<T> {
  private cache: Map<string, T> | undefined;
  constructor(private readonly file: string | undefined) {}

  async load(): Promise<Map<string, T>> {
    if (this.cache) return this.cache;
    const map = new Map<string, T>();
    if (this.file) {
      try {
        const raw = JSON.parse(await readFile(this.file, "utf8")) as Record<string, T>;
        for (const [k, val] of Object.entries(raw)) map.set(k, val);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }
    this.cache = map;
    return map;
  }

  async save(): Promise<void> {
    if (!this.file || !this.cache) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(Object.fromEntries(this.cache)));
    await rename(tmp, this.file);
  }
}

export class MapContentStore implements ContentStore {
  private map: JsonMap<StoredContent>;
  constructor(file?: string) {
    this.map = new JsonMap(file);
  }
  async get(url: string) {
    return (await this.map.load()).get(url);
  }
  async put(content: StoredContent) {
    (await this.map.load()).set(content.url, content);
    await this.map.save();
  }
}

export class MapChangeStore implements ChangeStore {
  private map: JsonMap<ChangeRecord[]>;
  constructor(file?: string) {
    this.map = new JsonMap(file);
  }
  async record(change: ChangeRecord) {
    const m = await this.map.load();
    m.set(change.url, [change, ...(m.get(change.url) ?? [])].slice(0, MAX_CHANGES_PER_URL));
    await this.map.save();
  }
  async listByUrl(url: string) {
    return (await this.map.load()).get(url) ?? [];
  }
  async listAll() {
    return [...(await this.map.load()).values()].flat().sort((x, y) => y.capturedAt.localeCompare(x.capturedAt));
  }
}

let contentSingleton: MapContentStore | undefined;
let changeSingleton: MapChangeStore | undefined;

/** Same backing choice as getHealthStore(): file when ROSTER_HEALTH_STORE=file, otherwise in-process. */
export function getContentStores(): { content: ContentStore; changes: ChangeStore } {
  if (process.env.ROSTER_HEALTH_STORE === "file") {
    const dir = path.dirname(process.env.ROSTER_HEALTH_FILE ?? path.join(process.cwd(), ".roster-health.json"));
    return {
      content: new MapContentStore(path.join(dir, ".roster-content.json")),
      changes: new MapChangeStore(path.join(dir, ".roster-changes.json"))
    };
  }
  contentSingleton ??= new MapContentStore();
  changeSingleton ??= new MapChangeStore();
  return { content: contentSingleton, changes: changeSingleton };
}
