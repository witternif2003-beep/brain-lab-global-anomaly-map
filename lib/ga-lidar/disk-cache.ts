/**
 * Persistent on-device cache for LiDAR hierarchy and node payloads (Cache API). Node payloads are immutable per
 * project/node key, so a hit never goes stale. Only whole 200 responses are stored: the Cache API rejects 206.
 */
export const LIDAR_DISK_CACHE = 'ga-lidar-v1';
/** Oldest entries are evicted past this count; node payloads are ~0.1–0.5 MB, so roughly ≤ 200 MB on disk. */
export const LIDAR_DISK_CACHE_MAX_ENTRIES = 400;

export interface DiskCacheCounters {
  diskHits: number;
  diskMisses: number;
}

export async function cachedFetch(
  url: string,
  counters: DiskCacheCounters,
  storage: CacheStorage | undefined = globalThis.caches,
  network: typeof fetch = fetch,
  maxEntries = LIDAR_DISK_CACHE_MAX_ENTRIES,
): Promise<Response> {
  let cache: Cache | undefined;
  try {
    cache = storage ? await storage.open(LIDAR_DISK_CACHE) : undefined;
    const hit = await cache?.match(url);
    if (hit) {
      counters.diskHits++;
      return hit;
    }
  } catch {
    cache = undefined;
  }
  counters.diskMisses++;
  const r = await network(url);
  if (cache && r.status === 200) {
    try {
      await cache.put(url, r.clone());
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(k);
    } catch {
      // Quota exceeded or storage unavailable: the network response is still used.
    }
  }
  return r;
}
