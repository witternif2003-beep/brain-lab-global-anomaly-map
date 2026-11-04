import type { GeoJSONSource, IControl, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { routeSummaryText, type LngLat, type RouteSummary } from './ga-traffic-route/route';

export type RouteState = 'idle' | 'picking-start' | 'picking-end' | 'loading' | 'result' | 'error';
const SRC = 'ga-traffic-route';
const LINE = 'ga-traffic-route-line';
const CASING = 'ga-traffic-route-casing';
const PTS = 'ga-traffic-route-points';
const TIFFANY = '#0ABAB5';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Next state when the map is clicked (or the button pressed) in a given state. */
export function nextRouteState(s: RouteState, event: 'button' | 'click' | 'done' | 'fail'): RouteState {
  if (event === 'button') return s === 'idle' ? 'picking-start' : 'idle';
  if (event === 'click') return s === 'picking-start' ? 'picking-end' : s === 'picking-end' ? 'loading' : s === 'result' || s === 'error' ? 'picking-end' : s;
  if (s !== 'loading') return s;
  return event === 'done' ? 'result' : 'error';
}

/** Click-to-route: press Route, click start and end; draws TomTom's fastest live-traffic route. Clicking again after a result starts a new route from that point. */
export class GaTrafficRouteControl implements IControl {
  private map: MapLibreMap | null = null;
  private el: HTMLDivElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private status: HTMLDivElement | null = null;
  private state: RouteState = 'idle';
  private pts: LngLat[] = [];
  private route: GeoJSON.Feature | null = null;
  private abort: AbortController | null = null;

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Traffic-aware route (TomTom): click start, then end';
    btn.setAttribute('aria-label', 'Traffic-aware route');
    btn.textContent = 'Route';
    btn.style.cssText = `width:auto;padding:0 8px;font:700 11px system-ui;color:${TIFFANY}`;
    btn.addEventListener('click', () => this.transition('button'));
    const status = document.createElement('div');
    status.style.cssText = 'display:none;max-width:200px;padding:4px 8px;font:11px/1.35 system-ui;color:#e2e8f0;background:rgba(10,18,40,0.85)';
    el.append(btn, status);
    Object.assign(this, { el, btn, status });
    map.on('click', this.onClick);
    map.on('style.load', this.ensureLayers);
    window.addEventListener('keydown', this.onKey);
    return el;
  }

  onRemove(): void {
    this.abort?.abort();
    this.map?.off('click', this.onClick);
    this.map?.off('style.load', this.ensureLayers);
    window.removeEventListener('keydown', this.onKey);
    this.el?.remove();
    this.map = null;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.state !== 'idle') this.transition('button');
  };

  private onClick = (e: MapMouseEvent) => {
    if (this.state === 'idle' || this.state === 'loading') return;
    const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
    if (this.state === 'picking-start') this.pts = [p];
    else if (this.state === 'picking-end') this.pts = [this.pts[0], p];
    else { this.pts = [p]; this.route = null; }
    this.transition('click');
  };

  private transition(event: 'button' | 'click' | 'done' | 'fail', msg?: string) {
    const next = nextRouteState(this.state, event);
    this.state = next;
    if (next === 'idle') { this.abort?.abort(); this.pts = []; this.route = null; }
    if (next === 'loading') void this.fetchRoute();
    this.render(msg);
  }

  private async fetchRoute() {
    const [a, b] = this.pts;
    this.abort?.abort();
    const ac = (this.abort = new AbortController());
    try {
      const r = await fetch(`/api/route?from=${a[0]},${a[1]}&to=${b[0]},${b[1]}`, { signal: ac.signal, cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(String(j.error ?? `HTTP ${r.status}`));
      this.route = j as GeoJSON.Feature;
      this.transition('done', routeSummaryText(j.properties as RouteSummary));
    } catch (err) {
      if (ac.signal.aborted) return;
      this.transition('fail', err instanceof Error ? err.message : String(err));
    }
  }

  private ensureLayers = () => {
    const map = this.map;
    if (!map) return;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: EMPTY });
    if (!map.getLayer(CASING)) map.addLayer({ id: CASING, type: 'line', source: SRC, filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#05070c', 'line-opacity': 0.8, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 9, 18, 16] } });
    if (!map.getLayer(LINE)) map.addLayer({ id: LINE, type: 'line', source: SRC, filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': TIFFANY, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 6, 18, 11], 'line-blur': 0.5 } });
    if (!map.getLayer(PTS)) map.addLayer({ id: PTS, type: 'circle', source: SRC, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'role'], 'start', TIFFANY, '#ff4fd8'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    this.draw();
  };

  private draw() {
    const src = this.map?.getSource(SRC) as GeoJSONSource | undefined;
    if (!src) return;
    const pts: GeoJSON.Feature[] = this.pts.map((c, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { role: i === 0 ? 'start' : 'end' } }));
    src.setData({ type: 'FeatureCollection', features: [...(this.route ? [this.route] : []), ...pts] });
  }

  private render(msg?: string) {
    if (!this.btn || !this.status || !this.map) return;
    const text: Record<RouteState, string> = {
      idle: '',
      'picking-start': 'Click the start point (Esc to cancel)',
      'picking-end': 'Click the destination',
      loading: 'Routing with live TomTom traffic…',
      result: `${msg ?? ''} · Routing © TomTom. Click to start a new route.`,
      error: `Route failed: ${msg ?? 'unknown error'}. Click to retry.`,
    };
    this.btn.textContent = this.state === 'idle' ? 'Route' : 'Clear';
    this.status.textContent = text[this.state];
    this.status.style.display = this.state === 'idle' ? 'none' : 'block';
    this.status.style.color = this.state === 'error' ? '#f87171' : '#e2e8f0';
    this.map.getCanvas().style.cursor = this.state === 'picking-start' || this.state === 'picking-end' ? 'crosshair' : '';
    this.ensureLayersOnly();
    this.draw();
  }

  private ensureLayersOnly() {
    if (this.map && !this.map.getSource(SRC) && this.map.isStyleLoaded()) this.ensureLayers();
  }
}
