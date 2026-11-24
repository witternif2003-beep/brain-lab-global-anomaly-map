import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * USGS's NAIP ImageServer sits above the Esri imagery at full opacity from z12. When it times out or returns 5xx,
 * MapLibre keeps showing over-zoomed parent tiles, so the ground turns to blur at street zoom. This watcher fades the
 * NAIP layer out (layer kept, opacity 0) after repeated tile errors so the sharp Esri tiles underneath show, then
 * probes NAIP every few minutes and fades it back in when it answers again.
 */
export const NAIP_SOURCE = 'naip';
export const NAIP_ERRORS_TO_FALLBACK = 3;
export const NAIP_ERROR_WINDOW_MS = 60_000;
export const NAIP_PROBE_MS = 5 * 60_000;
export const NAIP_PROBE_TIMEOUT_MS = 10_000;
/** One 256-px tile over Turner County, GA (EPSG:3857 bbox), used only to test that the service answers. */
export const NAIP_PROBE_URL =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?bbox=-9300000,3720000,-9299389,3720611&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&f=image';

export interface NaipHealthState { down: boolean; errors: number[]; since: number | null; lastError: string | null }
export const initialNaipHealth = (): NaipHealthState => ({ down: false, errors: [], since: null, lastError: null });

/** Records one NAIP tile error; switches to `down` once enough errors land inside the window. */
export function noteNaipError(s: NaipHealthState, now: number, message: string | null = null): NaipHealthState {
  const errors = [...s.errors.filter((t) => now - t <= NAIP_ERROR_WINDOW_MS), now];
  const down = s.down || errors.length >= NAIP_ERRORS_TO_FALLBACK;
  return { down, errors, since: down ? (s.since ?? now) : null, lastError: message ?? s.lastError };
}

export const noteNaipRecovered = (): NaipHealthState => initialNaipHealth();

declare global {
  interface Window { __gaNaip?: NaipHealthState }
}

export function watchNaipHealth(map: MapLibreMap, fetchImpl: typeof fetch = fetch): () => void {
  let state = initialNaipHealth();
  let normalOpacity: unknown = null;
  const publish = () => { if (typeof window !== 'undefined') window.__gaNaip = state; };
  const setOpacity = (v: unknown) => {
    try {
      if (map.getLayer(NAIP_SOURCE)) map.setPaintProperty(NAIP_SOURCE, 'raster-opacity', v as never);
    } catch { /* style mid-reload */ }
  };
  const onError = (e: { sourceId?: string; error?: { message?: string; status?: number } }) => {
    if (e?.sourceId !== NAIP_SOURCE) return;
    const wasDown = state.down;
    state = noteNaipError(state, Date.now(), e.error?.message ?? (e.error?.status ? `HTTP ${e.error.status}` : null));
    if (state.down && !wasDown) {
      if (map.getLayer(NAIP_SOURCE)) normalOpacity = map.getPaintProperty(NAIP_SOURCE, 'raster-opacity') ?? 1;
      setOpacity(0);
    }
    publish();
  };
  const probe = async () => {
    if (!state.down) return;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), NAIP_PROBE_TIMEOUT_MS);
    try {
      const r = await fetchImpl(NAIP_PROBE_URL, { signal: ctl.signal, cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) {
        state = noteNaipRecovered();
        setOpacity(normalOpacity ?? 1);
        publish();
      }
    } catch { /* still down */ } finally {
      clearTimeout(t);
    }
  };
  map.on('error', onError as never);
  const timer = setInterval(() => void probe(), NAIP_PROBE_MS);
  publish();
  return () => {
    clearInterval(timer);
    map.off('error', onError as never);
  };
}
