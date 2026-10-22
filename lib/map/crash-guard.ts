/**
 * Detects map crashes that JavaScript cannot observe directly: a page that was visible and never reached
 * `pagehide`/`visibilitychange: hidden` was killed (iOS Safari reloads tabs that run out of GPU/heap memory).
 * WebGL context losses are logged too. Any crash in the last SAFE_MODE_MS switches the map to lighter GPU budgets.
 */
export interface CrashStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type CrashKind = 'unclean-exit' | 'context-lost';
export interface CrashEvent { at: number; kind: CrashKind }

const ALIVE_KEY = 'ga-map-alive';
const LOG_KEY = 'ga-map-crashes';
export const SAFE_MODE_MS = 30 * 60_000;
const MAX_EVENTS = 20;

function readLog(store: CrashStore, now: number): CrashEvent[] {
  try {
    const raw: unknown = JSON.parse(store.getItem(LOG_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is CrashEvent => !!e && typeof e.at === 'number' && (e.kind === 'unclean-exit' || e.kind === 'context-lost'))
      .filter((e) => now - e.at <= SAFE_MODE_MS);
  } catch {
    return [];
  }
}

function writeLog(store: CrashStore, log: CrashEvent[]): void {
  store.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_EVENTS)));
}

export function recordCrash(store: CrashStore, kind: CrashKind, now: number): void {
  writeLog(store, [...readLog(store, now), { at: now, kind }]);
}

/** Marks the page live; returns 1 if the previous visible session ended without a clean exit. */
export function markAlive(store: CrashStore, now: number): number {
  const prev = store.getItem(ALIVE_KEY);
  store.setItem(ALIVE_KEY, String(now));
  if (prev === null) return 0;
  recordCrash(store, 'unclean-exit', Number(prev) || now);
  return 1;
}

/** Called on pagehide / hidden: the page is leaving or backgrounded on purpose. */
export function markClean(store: CrashStore): void {
  store.removeItem(ALIVE_KEY);
}

export function recentCrashes(store: CrashStore, now: number): CrashEvent[] {
  return readLog(store, now);
}

const browserStore = (): CrashStore | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** True when the map crashed or lost its GPU context in the last 30 minutes on this device. */
export function gpuSafeMode(): boolean {
  const s = browserStore();
  return !!s && recentCrashes(s, Date.now()).length > 0;
}

export function noteContextLost(): void {
  const s = browserStore();
  if (s) recordCrash(s, 'context-lost', Date.now());
}

/** Starts crash tracking for this tab; returns unclean exits found from the previous session (0 or 1). */
export function startCrashTracking(): number {
  const s = browserStore();
  if (!s) return 0;
  const found = document.visibilityState === 'visible' ? markAlive(s, Date.now()) : 0;
  const onHide = () => markClean(s);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', () => document.visibilityState === 'visible' && s.setItem(ALIVE_KEY, String(Date.now())));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') markClean(s);
    else s.setItem(ALIVE_KEY, String(Date.now()));
  });
  return found;
}
