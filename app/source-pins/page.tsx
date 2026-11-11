'use client';
/**
 * Georgia source pins: every layer `/api/ga-live-markers` serves, one green pin per marker at the
 * longitude/latitude the API returns, refreshed on each layer's own interval. Nothing is invented
 * or snapped to a road; a tapped pin shows its category, source feed and observed time.
 */
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { LiveLayer } from '@/lib/ga-live-markers/parse';
import {
  GA_CENTER,
  PIN_CATEGORIES,
  loadGaRing,
  pollMs,
  staleness,
  toPins,
  type LayerResponse,
  type LngLat,
  type SourcePin,
} from '@/lib/ga-source-pins';

setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);

const PIN_GREEN: [number, number, number, number] = [34, 197, 94, 235];
const PIN_EDGE: [number, number, number, number] = [5, 46, 22, 255];

type LayerState =
  | { status: 'loading' }
  | { status: 'ok'; body: LayerResponse; pins: SourcePin[]; fetchedAt: number }
  | { status: 'error'; error: string; last?: { body: LayerResponse; pins: SourcePin[] } };

const fmtCoord = (n: number) => String(n);
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'not given by source');

export default function SourcePinsPage() {
  const container = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<MapLibreOverlay | null>(null);
  const layersRef = useRef<typeof import('@deck.gl/layers') | null>(null);
  const states = useRef(new Map<LiveLayer, LayerState>());
  const selectedKey = useRef<string | null>(null);
  const [enabled, setEnabled] = useState<Set<LiveLayer>>(() => new Set(PIN_CATEGORIES.filter((c) => c.on).map((c) => c.layer)));
  const enabledRef = useRef(enabled);
  const [, setVersion] = useState(0);
  const [selected, setSelected] = useState<SourcePin | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; pin: SourcePin } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pinsOf = (s: LayerState | undefined) => (s?.status === 'ok' ? s.pins : s?.status === 'error' ? (s.last?.pins ?? []) : []);
  const bodyOf = (s: LayerState | undefined) => (s?.status === 'ok' ? s.body : s?.status === 'error' ? s.last?.body : undefined);

  const redraw = () => {
    const L = layersRef.current;
    const overlay = overlayRef.current;
    const all: SourcePin[] = [];
    for (const layer of enabledRef.current) all.push(...pinsOf(states.current.get(layer)));
    const sel = selectedKey.current ? (all.find((p) => p.key === selectedKey.current) ?? null) : null;
    setSelected(sel);
    setVersion((v) => v + 1);
    if (!L || !overlay) return;
    overlay.setProps({
      layers: [
        new L.ScatterplotLayer<SourcePin>({
          id: 'ga-source-pins',
          data: all,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: 4.5,
          radiusMinPixels: 3,
          stroked: true,
          lineWidthUnits: 'pixels',
          getLineWidth: 1.2,
          getFillColor: PIN_GREEN,
          getLineColor: PIN_EDGE,
          getPosition: (d) => d.position,
          onHover: ({ object, x, y }) => setHover(object ? { x, y, pin: object } : null),
          onClick: ({ object }) => {
            selectedKey.current = object?.key ?? null;
            redraw();
            return true;
          },
        }),
        new L.ScatterplotLayer<SourcePin>({
          id: 'ga-source-pin-selected',
          data: sel ? [sel] : [],
          radiusUnits: 'pixels',
          getRadius: 10,
          stroked: true,
          filled: false,
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          getLineColor: [255, 210, 80, 255],
          getPosition: (d) => d.position,
        }),
      ],
    });
  };

  useEffect(() => {
    enabledRef.current = enabled;
    redraw();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  // One poll loop per enabled layer, on the interval the API reports for that layer.
  useEffect(() => {
    const timers = new Map<LiveLayer, ReturnType<typeof setTimeout>>();
    const aborts: AbortController[] = [];
    let stopped = false;
    const poll = async (layer: LiveLayer) => {
      const prev = states.current.get(layer);
      if (!prev) states.current.set(layer, { status: 'loading' });
      const ac = new AbortController();
      aborts.push(ac);
      let body: LayerResponse | null = null;
      try {
        const r = await fetch(`/api/ga-live-markers?layer=${layer}`, { signal: ac.signal, cache: 'no-store' });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
        body = j as LayerResponse;
        states.current.set(layer, { status: 'ok', body, pins: toPins(layer, body), fetchedAt: Date.now() });
      } catch (e) {
        if (stopped) return;
        const last = prev?.status === 'ok' ? { body: prev.body, pins: prev.pins } : prev?.status === 'error' ? prev.last : undefined;
        states.current.set(layer, { status: 'error', error: (e as Error).message, last });
      }
      if (stopped) return;
      redraw();
      timers.set(layer, setTimeout(() => void poll(layer), pollMs(body)));
    };
    for (const layer of enabled) void poll(layer);
    return () => {
      stopped = true;
      for (const t of timers.values()) clearTimeout(t);
      for (const ac of aborts) ac.abort();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Imagery: Esri World Imagery',
          },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite' },
          { id: 'dark', type: 'background', paint: { 'background-color': '#02040a', 'background-opacity': 0.6 } },
        ],
      },
      center: GA_CENTER,
      zoom: 6.5,
    });
    (window as unknown as { __sourcePinsMap?: maplibregl.Map }).__sourcePinsMap = map;
    let cancelled = false;
    const start = async () => {
      const [ring, { MapLibreOverlay: Overlay }, L] = await Promise.all([
        loadGaRing(),
        import('@deck.gl/maplibre'),
        import('@deck.gl/layers'),
        new Promise<void>((done) => (map.isStyleLoaded() ? done() : map.once('load', () => done()))),
      ]);
      if (cancelled) return;
      map.addSource('ga-boundary', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring as LngLat[]] } },
      });
      map.addLayer({ id: 'ga-boundary-edge', type: 'line', source: 'ga-boundary', paint: { 'line-color': '#e0ffff', 'line-width': 2, 'line-opacity': 0.9 } });
      layersRef.current = L;
      overlayRef.current = new Overlay({ interleaved: false, layers: [] });
      map.addControl(overlayRef.current);
      redraw();
    };
    void start().catch((e: Error) => setMapError(e.message));
    return () => {
      cancelled = true;
      if (overlayRef.current) map.removeControl(overlayRef.current);
      overlayRef.current = null;
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (layer: LiveLayer) =>
    setEnabled((s) => {
      const n = new Set(s);
      if (n.has(layer)) n.delete(layer);
      else n.add(layer);
      return n;
    });

  let total = 0;
  for (const l of enabled) total += pinsOf(states.current.get(l)).length;
  const selCat = selected ? PIN_CATEGORIES.find((c) => c.layer === selected.layer) : undefined;
  const selBody = selected ? bodyOf(states.current.get(selected.layer)) : undefined;
  const selOwner = selected ? String(selected.marker.props.agency ?? selected.marker.props.operator ?? '') : '';
  const selFeed = selBody && selOwner ? selBody.feeds.find((f) => f.id === selOwner || f.id.startsWith(`${selOwner} `)) : undefined;
  const selProps = selected ? Object.entries(selected.marker.props).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object') : [];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#02040a]">
      <div ref={container} className="h-full w-full" />
      <div className="absolute top-4 left-4 z-10 max-h-[calc(100vh-2rem)] w-[22rem] overflow-y-auto rounded-xl border border-green-500/50 bg-black/90 p-3 font-mono text-[13px] text-gray-200 backdrop-blur-md">
        <h2 className="text-base font-black tracking-widest text-green-400">GEORGIA SOURCE PINS</h2>
        <p className="mt-1 text-green-300" data-testid="pin-total">
          {total.toLocaleString()} pins · {enabled.size} of {PIN_CATEGORIES.length} categories on
        </p>
        <p className="mt-1 leading-snug text-gray-200">
          One pin per record at the coordinates its public source publishes. Nothing is simulated or snapped to roads.
        </p>
        <ul className="mt-2 list-none space-y-1">
          {PIN_CATEGORIES.map((c) => {
            const s = states.current.get(c.layer);
            const on = enabled.has(c.layer);
            const body = bodyOf(s);
            const n = pinsOf(s).length;
            const stale = body ? staleness(body.generatedAt, body.refreshSeconds, now) === 'stale' : false;
            const failed = body?.feeds.filter((f) => f.error).length ?? 0;
            return (
              <li key={c.layer}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-0.5 accent-green-500" checked={on} onChange={() => toggle(c.layer)} />
                  <span className="flex-1">
                    <span className={on ? 'text-white' : 'text-gray-400'}>{c.label}</span>
                    {on && (
                      <span className="block text-xs text-gray-300">
                        {!s || s.status === 'loading' ? (
                          <span className="text-cyan-300">loading…</span>
                        ) : (
                          <>
                            <span className="text-green-300">{n.toLocaleString()}</span>
                            {body && <> · every {body.refreshSeconds}s · {new Date(body.generatedAt).toLocaleTimeString()}</>}
                            {stale && <span className="text-amber-300"> · STALE</span>}
                            {n === 0 && s.status === 'ok' && <span className="text-amber-300"> · source returned 0</span>}
                            {failed > 0 && <span className="text-amber-300"> · {failed} feed(s) failed</span>}
                            {s.status === 'error' && <span className="text-red-400"> · error: {s.error.slice(0, 80)}</span>}
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {mapError && <p className="mt-2 text-red-400">map: {mapError}</p>}
        <p className="mt-2 text-xs text-gray-300">Boundary: US Census TIGER · Imagery: Esri World Imagery</p>
      </div>
      {hover && (
        <div
          data-testid="pin-hover"
          className="pointer-events-none absolute z-20 rounded-md border border-green-400/60 bg-black/90 px-2 py-1 font-mono text-[13px] text-white shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="text-green-300">{PIN_CATEGORIES.find((c) => c.layer === hover.pin.layer)?.label}</div>
          <div>{hover.pin.marker.label}</div>
          <div className="text-yellow-300">
            {fmtCoord(hover.pin.marker.lat)}, {fmtCoord(hover.pin.marker.lon)}
          </div>
        </div>
      )}
      {selected && selCat && (
        <div data-testid="pin-readout" className="absolute top-4 right-4 z-10 max-h-[calc(100vh-10rem)] w-[30rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-yellow-400/60 bg-black/90 p-3 font-mono text-[13px] text-gray-200 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-green-300">{selCat.label}</span>
            <button className="text-gray-400 hover:text-white" onClick={() => { selectedKey.current = null; redraw(); }}>✕</button>
          </div>
          <div className="mt-1 text-base text-white">{selected.marker.label}</div>
          <div className="mt-1 text-sm">
            lat <span className="text-yellow-300">{fmtCoord(selected.marker.lat)}</span> · lon <span className="text-yellow-300">{fmtCoord(selected.marker.lon)}</span>
          </div>
          <div className="text-gray-300">position: {selCat.position}</div>
          <div className="text-gray-300">observed: {fmtTime(selected.marker.observedAt)}</div>
          {selProps.length > 0 && (
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
              {selProps.slice(0, 10).map(([k, v]) => (
                <span key={k} className="contents">
                  <span className="text-gray-400">{k}</span>
                  <span className="truncate">{String(v)}</span>
                </span>
              ))}
            </div>
          )}
          {selBody && (
            <div className="mt-1 text-xs leading-snug break-all text-gray-300">
              {selFeed ? (
                <>
                  feed: <span className="text-gray-200">{selFeed.id}</span> ·{' '}
                  <a className="text-cyan-300 underline" href={selFeed.url} target="_blank" rel="noreferrer">
                    {selFeed.url}
                  </a>
                </>
              ) : (
                <>
                  source: {selBody.source} ·{' '}
                  <a className="text-cyan-300 underline" href={selBody.sourceUrl} target="_blank" rel="noreferrer">
                    {selBody.sourceUrl}
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
