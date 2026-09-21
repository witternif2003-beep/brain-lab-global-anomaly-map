'use client';

import { setWorkerUrl } from 'maplibre-gl';
setWorkerUrl('/maplibre-gl-worker.mjs');

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAnomalyStream, AnomalyFeature } from '../hooks/useAnomalyStream';
import { registerGeoJSONVTSource, shouldUseTiledRendering } from '../lib/geojson-vt-protocol';
import { GEORGIA_ANOMALIES } from '../lib/data';
import MapDebugOverlay from './MapDebugOverlay';

// ─── Constants ────────────────────────────────────────────────────────
const COMPETITOR_STATES = ['GA', 'NC', 'TN', 'SC', 'FL', 'TX', 'VA', 'AL'] as const;
type StateCode = (typeof COMPETITOR_STATES)[number];

const BASEMAPS = {
  demotiles: 'https://demotiles.maplibre.org/style.json',
  satellite: {
    version: 8,
    sources: {
      sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
  },
  dark: 'https://demotiles.maplibre.org/style.json',
  terrain: 'https://demotiles.maplibre.org/style.json',
};

// Georgia viewport bounds — auto-fit on load
const GA_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-85.6, 30.3], // SW
  [-80.8, 35.0], // NE
];

// Initial baseline anomalies converted to GeoJSON Feature collection
const INITIAL_ANOMALIES: AnomalyFeature[] = GEORGIA_ANOMALIES.map((a, idx) => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: a.coordinates as [number, number],
  },
  properties: {
    id: `ga-anomaly-${idx + 1}`,
    severity: (a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'HIGH' : 'MEDIUM') as any,
    category: a.sector || 'Economic',
    title: `${a.code} - ${a.location}`,
    zScore: 2.4 + (idx % 5) * 0.3,
    confidence: (a.confidenceScore || 95) / 100,
  },
}));

interface Props {
  anomalies?: AnomalyFeature[];
  focusState?: StateCode | 'ALL';
  onFocusChange?: (s: StateCode | 'ALL') => void;
  onAnomalyClick?: (id: string) => void;
}

export default function GodsEyeMap({
  anomalies = INITIAL_ANOMALIES,
  focusState = 'GA',
  onFocusChange,
  onAnomalyClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('dark');
  const [pitch, setPitch] = useState(0);
  const [zoom, setZoom] = useState(6.2);
  const [activeFocus, setActiveFocus] = useState<StateCode | 'ALL'>(focusState);
  const [webgpuSupported, setWebgpuSupported] = useState(false);
  const [selectedInspect, setSelectedInspect] = useState<any>(null);

  // Sync internal state with external prop if provided
  useEffect(() => {
    setActiveFocus(focusState);
  }, [focusState]);

  // Check WebGPU availability in browser
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setWebgpuSupported(true);
    }
  }, []);

  // Coalesced real-time SSE stream hook with rAF 60fps ceiling
  useAnomalyStream('anomalies', mapRef.current, (newFeature) => {
    // Optionally trigger inspection or reactive telemetry
  });

  // Layer stack constructor
  const addMapLayers = useCallback((map: maplibregl.Map) => {
    // ═══ SINGLE SOURCE for all 8 state boundaries ═══
    if (!map.getSource('all-states')) {
      map.addSource('all-states', {
        type: 'geojson',
        data: '/geo/all-states.geojson',
      });
    }

    // ─── GEORGIA: permanent red target ─────────────────────────
    if (!map.getLayer('ga-fill')) {
      map.addLayer({
        id: 'ga-fill',
        type: 'fill',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], 'GA'],
        paint: {
          'fill-color': '#dc2626',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.18,
            10, 0.06,
          ],
        },
      });
    }

    if (!map.getLayer('ga-glow')) {
      map.addLayer({
        id: 'ga-glow',
        type: 'line',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], 'GA'],
        paint: {
          'line-color': '#dc2626',
          'line-width': 4,
          'line-blur': 6,
          'line-opacity': 0.75,
        },
      });
    }

    if (!map.getLayer('ga-outline')) {
      map.addLayer({
        id: 'ga-outline',
        type: 'line',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], 'GA'],
        paint: {
          'line-color': '#ef4444',
          'line-width': 2.5,
        },
      });
    }

    // ─── SELECTED ALLY: blue/teal neon highlight ────────────────
    if (!map.getLayer('ally-fill')) {
      map.addLayer({
        id: 'ally-fill',
        type: 'fill',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], '__none__'],
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.18,
            10, 0.06,
          ],
        },
      });
    }

    if (!map.getLayer('ally-glow')) {
      map.addLayer({
        id: 'ally-glow',
        type: 'line',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], '__none__'],
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 4,
          'line-blur': 6,
          'line-opacity': 0.75,
        },
      });
    }

    if (!map.getLayer('ally-outline')) {
      map.addLayer({
        id: 'ally-outline',
        type: 'line',
        source: 'all-states',
        filter: ['==', ['get', 'STUSPS'], '__none__'],
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
        },
      });
    }

    // 2. Competitor state boundaries
    if (!map.getSource('competitors')) {
      map.addSource('competitors', {
        type: 'geojson',
        data: '/geo/competitor-states.geojson',
      });
    }

    if (!map.getLayer('competitor-outline')) {
      map.addLayer({
        id: 'competitor-outline',
        type: 'line',
        source: 'competitors',
        paint: {
          'line-color': '#475569',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
      });
    }

    // 3. Competitor state labels (Native Symbol Layer, NO HTML overlays)
    if (!map.getLayer('competitor-labels')) {
      map.addLayer({
        id: 'competitor-labels',
        type: 'symbol',
        source: 'competitors',
        layout: {
          'text-field': ['get', 'STUSPS'],
          'text-size': 13,
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#00e5ff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2,
        },
      });
    }

    // 4. Anomaly markers with Supercluster native clustering
    const featureCount = anomalies.length;
    if (!map.getSource('anomalies')) {
      if (shouldUseTiledRendering(featureCount)) {
        // High feature count: client-side vector tile protocol (geojson-vt + vt-pbf)
        registerGeoJSONVTSource(map, 'anomalies', {
          type: 'FeatureCollection',
          features: anomalies,
        });
      } else {
        map.addSource('anomalies', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: anomalies },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 12,
          clusterProperties: {
            criticalCount: ['+', ['case', ['==', ['get', 'severity'], 'CRITICAL'], 1, 0]],
          },
        });
      }
    }

    // Cluster circles
    if (!map.getLayer('anomaly-clusters')) {
      map.addLayer({
        id: 'anomaly-clusters',
        type: 'circle',
        source: 'anomalies',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#00ff9d', 5,
            '#00e5ff', 15,
            '#dc2626',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 15, 32],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.88,
        },
      });
    }

    // Cluster count text
    if (!map.getLayer('anomaly-cluster-count')) {
      map.addLayer({
        id: 'anomaly-cluster-count',
        type: 'symbol',
        source: 'anomalies',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: { 'text-color': '#0f172a' },
      });
    }

    // Pulsing ring on critical anomalies
    if (!map.getLayer('anomaly-pulse')) {
      map.addLayer({
        id: 'anomaly-pulse',
        type: 'circle',
        source: 'anomalies',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'severity'], 'CRITICAL']],
        paint: {
          'circle-color': '#dc2626',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 12, 12, 24],
          'circle-opacity': 0.28,
        },
      });
    }

    // Individual anomaly markers (unclustered)
    if (!map.getLayer('anomaly-points')) {
      map.addLayer({
        id: 'anomaly-points',
        type: 'circle',
        source: 'anomalies',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match', ['get', 'severity'],
            'CRITICAL', '#dc2626',
            'HIGH', '#00e5ff',
            'MEDIUM', '#00ff9d',
            '#64748b',
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6, 12, 14],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.92,
        },
      });
    }

    // ─── 5. Interaction Handlers ────────────────────────────────────

    // Zoom into cluster on click
    map.on('click', 'anomaly-clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['anomaly-clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource('anomalies') as any;
      if (source && typeof source.getClusterExpansionZoom === 'function') {
        source.getClusterExpansionZoom(clusterId).then((targetZoom: number) => {
          if (features[0].geometry.type !== 'Point') return;
          map.easeTo({
            center: features[0].geometry.coordinates as [number, number],
            zoom: (targetZoom || 10) + 0.5,
            duration: 600,
            easing: (t) => t * (2 - t), // easeOutQuad
          });
        }).catch(() => {});
      }
    });

    // Popup on individual anomaly click
    map.on('click', 'anomaly-points', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const props = f.properties as any;
      const coords = f.geometry.coordinates.slice() as [number, number];

      setSelectedInspect({
        title: props.title,
        severity: props.severity,
        category: props.category,
        zScore: props.zScore,
        confidence: props.confidence,
        coords,
      });

      new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '340px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:monospace;padding:6px;background:#0f172a;color:#f8fafc;border-radius:8px;">
            <div style="font-size:11px;color:${props.severity === 'CRITICAL' ? '#f87171' : '#00e5ff'};font-weight:700;">
              ${props.severity} · ${props.category}
            </div>
            <div style="font-size:13px;font-weight:700;color:#f8fafc;margin:6px 0;">
              ${props.title}
            </div>
            <div style="font-size:11px;color:#94a3b8;">
              Z-Score: <strong style="color:#00ff9d;">${typeof props.zScore === 'number' ? props.zScore.toFixed(2) : props.zScore}σ</strong> ·
              Confidence: <strong style="color:#00e5ff;">${typeof props.confidence === 'number' ? (props.confidence * 100).toFixed(1) : '95'}%</strong>
            </div>
          </div>
        `)
        .addTo(map);

      if (onAnomalyClick && props.id) {
        onAnomalyClick(props.id);
      }
    });

    // Cursor pointer feedback
    map.on('mouseenter', 'anomaly-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'anomaly-clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'anomaly-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'anomaly-points', () => { map.getCanvas().style.cursor = ''; });
  }, [anomalies, onAnomalyClick]);

  // ─── Map Initialization ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

// Default MapLibre bundled worker

    const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      bounds: GA_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      pitch: 0,
      bearing: 0,
      maxZoom: 24,
      minZoom: 3,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      cooperativeGestures: false,
    } as any);

    // Navigation controls (Zoom + Compass + Pitch)
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    // Scale bar (km / miles)
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'imperial' }),
      'bottom-left'
    );

    // Fullscreen control
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Geolocate control
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      } as any),
      'top-right'
    );

    // Configure projection safely once style loads (per official MapLibre specification)
    map.on('style.load', () => {
      try {
        (map as any).setProjection?.({ type: 'globe' });
      } catch (err) {
        console.warn('[Map] Globe projection deferred:', err);
      }
    });

    // Viewport telemetry
    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('pitch', () => setPitch(map.getPitch()));

    map.on('error', (e) => {
      console.error('[maplibre]', e?.error?.message ?? e);
    });

    map.on('load', async () => {
      try {
        if (typeof window !== 'undefined') {
          (window as any).__map = map;
        }
        console.log('[Map] worker URL set to: /maplibre-gl-worker.mjs');
        console.log('[Map] tiles loaded:', map.areTilesLoaded());
        console.log('[Map] style loaded:', map.isStyleLoaded());
        console.log('[GodsEyeMap] MapLibre loaded style successfully, adding layers...');
        await addMapLayers(map);
        setReady(true);
      } catch (err) {
        console.error('[GodsEyeMap] Load error:', err);
      }
    });

    // 5-second resilient fallback timeout to keyless demotiles if style fails or stalls
    const fallbackTimer = setTimeout(() => {
      if (!map.isStyleLoaded()) {
        console.warn('[Map] Style timeout — falling back to keyless demotiles');
        try {
          map.setStyle('https://demotiles.maplibre.org/style.json');
          map.once('styledata', () => addMapLayers(map));
        } catch {}
      }
    }, 5000);

    map.on('styledata', () => clearTimeout(fallbackTimer));

    mapRef.current = map;

    // Force resize after the DOM layout pass completes (fixes 0x0 canvas on iOS Safari)
    const resizeTimer = setTimeout(() => {
      try { map.resize(); } catch {}
    }, 300);

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      try { map.resize(); } catch {}
    }) : null;

    if (containerRef.current && resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (typeof window !== 'undefined' && (window as any).__map === map) {
        delete (window as any).__map;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [addMapLayers]);

  // Force resize once layout has settled and watch for container dimensions changes
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    // Force resize once the layout has settled (fonts, flex parents, safe-area insets)
    const t1 = setTimeout(() => { try { map.resize(); } catch {} }, 100);
    const t2 = setTimeout(() => { try { map.resize(); } catch {} }, 500);
    const t3 = setTimeout(() => { try { map.resize(); } catch {} }, 1500);

    // Watch for any future size changes: orientation, keyboard, dynamic siblings
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      try { map.resize(); } catch {}
    }) : null;
    if (ro) ro.observe(container);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
    };
  }, [ready]);

  // Basemap switcher
  const switchBasemap = useCallback((next: keyof typeof BASEMAPS) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(next);

    if (next === 'satellite') {
      map.setStyle(BASEMAPS.satellite as any);
      map.once('styledata', () => addMapLayers(map));
    } else {
      map.setStyle(BASEMAPS[next] as string);
      map.once('styledata', () => addMapLayers(map));
    }
  }, [addMapLayers]);

  // 3D terrain toggle
  const toggle3D = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const is3D = map.getPitch() > 20;

    if (!is3D) {
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        });
      }
      (map as any).setTerrain?.({ source: 'terrain-dem', exaggeration: 1.5 });
      map.easeTo({ pitch: 60, bearing: -15, duration: 800 });
    } else {
      (map as any).setTerrain?.(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
  }, []);

  // Update anomalies dataset dynamically without reconstructing map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('anomalies') as maplibregl.GeoJSONSource | undefined;
    if (src && typeof src.setData === 'function') {
      src.setData({ type: 'FeatureCollection', features: anomalies });
    }
  }, [anomalies, ready]);

  // Smooth camera flyTo when focus state changes

  // Swap the ally filter on focus change (instantaneous, zero network fetch)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // When GA or ALL is selected, no ally highlight is shown
    const allyCode = (activeFocus === 'GA' || activeFocus === 'ALL') ? '__none__' : activeFocus;

    // Update filter on all three ally layers
    ['ally-fill', 'ally-glow', 'ally-outline'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, ['==', ['get', 'STUSPS'], allyCode]);
      }
    });
  }, [activeFocus, ready]);

  const handleFocusChange = (state: StateCode | 'ALL') => {
    setActiveFocus(state);
    if (onFocusChange) onFocusChange(state);

    const map = mapRef.current;
    if (!map || !ready) return;

    if (state === 'ALL') {
      map.fitBounds(
        [
          [-106.6, 25.8],
          [-75.2, 39.5],
        ],
        { padding: 40, duration: 1200 }
      );
      return;
    }

    const STATE_CENTERS: Record<StateCode, [number, number]> = {
      GA: [-83.4, 32.6],
      NC: [-79.0, 35.6],
      TN: [-86.3, 35.8],
      SC: [-80.9, 33.8],
      FL: [-81.5, 27.9],
      TX: [-99.9, 31.4],
      VA: [-78.6, 37.5],
      AL: [-86.8, 32.8],
    };

    map.flyTo({
      center: STATE_CENTERS[state],
      zoom: state === 'GA' ? 7.2 : 6.0,
      duration: 1200,
      essential: true,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono">
      {/* Map Surface (8 Cols) */}
      <div className="lg:col-span-8 flex flex-col space-y-3">
        <div className="relative w-full h-[500px] sm:h-[580px] rounded-2xl overflow-hidden border border-[#28394e] bg-[#0f172a] shadow-2xl">
          <div ref={containerRef} className="absolute inset-0" />
          <MapDebugOverlay mapRef={mapRef} />

          {/* Layer + Focus label bar — glass-morphism style with dark red GA target */}
          <div
            className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1 p-1.5 rounded-lg max-w-[calc(100vw-140px)]"
            style={{
              background: 'rgba(15, 23, 42, 0.35)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}
          >
            {/* 3D GLOBE toggle */}
            <button
              key="3d-globe"
              type="button"
              onClick={toggle3D}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                padding: '4px 10px',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: '#34d399',
                background: 'transparent',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {pitch > 20 ? '2D' : '3D GLOBE'}
            </button>

            {/* Layer toggles */}
            {(['LIGHT', 'SATELLITE', 'TERRAIN'] as const).map((layer) => {
              const keyMap: Record<string, keyof typeof BASEMAPS> = {
                'LIGHT': 'demotiles',
                'SATELLITE': 'satellite',
                'TERRAIN': 'terrain',
              };
              const active = (layer === 'SATELLITE' && basemap === 'satellite') || (layer === 'LIGHT' && basemap === 'demotiles') || (layer === 'TERRAIN' && basemap === 'terrain');
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => switchBasemap(keyMap[layer])}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: active ? '#38bdf8' : '#cbd5e1',
                    background: active ? 'rgba(14, 165, 233, 0.25)' : 'transparent',
                    border: active ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 180ms ease',
                  }}
                >
                  {layer}
                </button>
              );
            })}

            {/* Separator */}
            <div style={{ width: 1, height: 18, background: 'rgba(148, 163, 184, 0.25)', margin: '0 4px' }} />

            {/* State focus labels */}
            {(['GA', 'NC', 'TN', 'FL', 'SC', 'TX', 'VA', 'AL'] as const).map((s) => {
              const isTarget = s === 'GA';
              const isActive = activeFocus === s;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleFocusChange(s)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 180ms ease',

                    // ── TARGET (GA) ─────────────────────────────────
                    ...(isTarget && !isActive && {
                      color: '#991b1b',                              // dark red text
                      background: 'transparent',
                      border: '1px solid rgba(127, 29, 29, 0.55)',    // dark red border
                    }),
                    ...(isTarget && isActive && {
                      color: '#fca5a5',                              // light red text
                      background: 'rgba(220, 38, 38, 0.35)',         // red glass
                      border: '1px solid rgba(248, 113, 113, 0.7)',
                      boxShadow: '0 0 12px 2px rgba(239, 68, 68, 0.45)',
                    }),

                    // ── ALLY STATES ─────────────────────────────────
                    ...(!isTarget && !isActive && {
                      color: '#cbd5e1',
                      background: 'transparent',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }),
                    ...(!isTarget && isActive && {
                      color: '#e0f2fe',
                      background: 'rgba(14, 165, 233, 0.35)',        // blue glass
                      border: '1px solid rgba(125, 211, 252, 0.7)',
                      boxShadow: '0 0 12px 2px rgba(56, 189, 248, 0.45)',
                    }),
                  }}
                >
                  {isTarget ? 'GA (Target)' : s}
                </button>
              );
            })}

            {/* Separator */}
            <div style={{ width: 1, height: 18, background: 'rgba(148, 163, 184, 0.25)', margin: '0 4px' }} />

            {/* Live Telemetry Pill */}
            <div
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#94a3b8',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              z{typeof zoom === 'number' && !isNaN(zoom) ? zoom.toFixed(1) : '6.5'} · p{typeof pitch === 'number' && !isNaN(pitch) ? pitch.toFixed(0) : '0'}°
            </div>
          </div>

          {/* Severity Legend */}
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-[#0f172a]/90 border border-[#28394e] p-1.5 sm:p-2 text-xs backdrop-blur space-y-1 hidden sm:block">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Severity</div>
            {[
              { label: 'CRITICAL', color: '#dc2626' },
              { label: 'HIGH', color: '#00e5ff' },
              { label: 'MEDIUM', color: '#00ff9d' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 text-[10px]">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="text-slate-300 font-bold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side Inspector (4 Cols) */}
      <div className="lg:col-span-4 space-y-4">
        {selectedInspect ? (
          <div className="bg-[#131d2c] border border-[#28394e] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#28394e] pb-2">
              <span className="px-2 py-0.5 rounded bg-[#1e293b] text-cyan-400 border border-cyan-400/40 text-[10px] font-bold">
                {selectedInspect.category}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedInspect.severity === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {selectedInspect.severity}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">{selectedInspect.title}</h3>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Target Coordinates: <span className="text-cyan-400">{selectedInspect.coords[1].toFixed(3)}°N, {selectedInspect.coords[0].toFixed(3)}°W</span>
              </div>
            </div>

            <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e] text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Anomaly Z-Score:</span>
                <span className="text-emerald-400 font-bold">{typeof selectedInspect.zScore === 'number' ? selectedInspect.zScore.toFixed(2) : selectedInspect.zScore}σ</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Validation Confidence:</span>
                <span className="text-cyan-400 font-bold">{typeof selectedInspect.confidence === 'number' ? (selectedInspect.confidence * 100).toFixed(1) : '95'}%</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Detection Protocol:</span>
                <span className="text-white font-bold">SiForest + AutoSAD UCB-1</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-[#28394e] rounded-2xl bg-[#131d2c]/40">
            Click any vector anomaly marker or cluster centroid to inspect live forensic telemetry
          </div>
        )}

        {/* Live Vector Feed Overview */}
        <div className="bg-[#131d2c] border border-[#28394e] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#28394e] pb-2">
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-ping" />
              <span>LIVE GOD'S EYE TELEMETRY STREAM</span>
            </h4>
            <span className="text-[10px] text-cyan-400 font-bold">60 FPS rAF Sync</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {anomalies.slice(0, 10).map((a, idx) => (
              <div
                key={a.properties?.id || idx}
                onClick={() => setSelectedInspect({
                  title: a.properties?.title,
                  severity: a.properties?.severity,
                  category: a.properties?.category,
                  zScore: a.properties?.zScore,
                  confidence: a.properties?.confidence,
                  coords: a.geometry.coordinates,
                })}
                className="p-2 rounded-lg border border-[#28394e] bg-[#0b1320] hover:border-cyan-400/50 cursor-pointer transition-all text-xs"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white font-bold truncate max-w-[170px]">{a.properties?.title}</span>
                  <span className={a.properties?.severity === 'CRITICAL' ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
                    {a.properties?.severity}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Z-Score: {a.properties?.zScore?.toFixed(2)}σ · {a.properties?.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
