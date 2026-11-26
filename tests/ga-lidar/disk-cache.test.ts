import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedFetch, LIDAR_DISK_CACHE } from '../../lib/ga-lidar/disk-cache';

/** In-memory CacheStorage with the Cache API's ordering and its 206 rejection. */
function memoryStorage() {
  const entries = new Map<string, Response>();
  const cache = {
    match: async (url: string) => entries.get(url)?.clone(),
    put: async (url: string, r: Response) => {
      if (r.status === 206) throw new TypeError('206');
      entries.delete(url);
      entries.set(url, r);
    },
    keys: async () => [...entries.keys()].map((u) => new Request(u)),
    delete: async (req: Request) => entries.delete(req.url),
  };
  const opened: string[] = [];
  const storage = { open: async (name: string) => (opened.push(name), cache) } as unknown as CacheStorage;
  return { storage, entries, opened };
}

test('cachedFetch serves repeat requests from disk without touching the network', async () => {
  const { storage, opened } = memoryStorage();
  let calls = 0;
  const net = (async () => (calls++, new Response('pts', { status: 200 }))) as typeof fetch;
  const c = { diskHits: 0, diskMisses: 0 };
  assert.equal(await (await cachedFetch('https://x/a', c, storage, net)).text(), 'pts');
  assert.equal(await (await cachedFetch('https://x/a', c, storage, net)).text(), 'pts');
  assert.deepEqual([calls, c.diskHits, c.diskMisses], [1, 1, 1]);
  assert.equal(opened[0], LIDAR_DISK_CACHE);
});

test('cachedFetch stores only 200 responses and evicts the oldest past the cap', async () => {
  const { storage, entries } = memoryStorage();
  const c = { diskHits: 0, diskMisses: 0 };
  const status = (s: number) => (async () => new Response(null, { status: s })) as typeof fetch;
  await cachedFetch('https://x/404', c, storage, status(404));
  await cachedFetch('https://x/206', c, storage, status(206));
  for (const k of ['a', 'b', 'c']) await cachedFetch(`https://x/${k}`, c, storage, status(200), 2);
  assert.deepEqual([...entries.keys()], ['https://x/b', 'https://x/c']);
});

test('cachedFetch falls back to the network when the Cache API is missing or throws', async () => {
  const c = { diskHits: 0, diskMisses: 0 };
  const net = (async () => new Response('ok', { status: 200 })) as typeof fetch;
  assert.equal(await (await cachedFetch('https://x/a', c, undefined, net)).text(), 'ok');
  const broken = { open: async () => { throw new Error('SecurityError'); } } as unknown as CacheStorage;
  assert.equal(await (await cachedFetch('https://x/a', c, broken, net)).text(), 'ok');
  assert.equal(c.diskMisses, 2);
});
