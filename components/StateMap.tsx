'use client';

import { setWorkerUrl } from 'maplibre-gl';
setWorkerUrl('/maplibre-gl-worker.mjs');

// FIPS to state abbreviation lookup table
const FIPS_TO_ABBR: Record<string, string> = {
  '01': 'AL', '12': 'FL', '13': 'GA', '37': 'NC',
  '45': 'SC', '47': 'TN', '48': 'TX', '51': 'VA',
};

// Normalize states GeoJSON to guarantee STUSPS field
async function loadNormalizedStates(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch('/geo/all-states.geojson');
  if (!res.ok) throw new Error(`all-states.geojson HTTP ${res.status}`);
  const raw = await res.json();

  const features = raw.features
    .map((f: any) => {
      const p = f.properties || {};
      const code =
        p.STUSPS || p.stusps || p.STATE || p.state ||
        p.NAME_ABBR || p.abbr ||
        FIPS_TO_ABBR[p.STATEFP] || FIPS_TO_ABBR[p.statefp] ||
        (p.name === 'Georgia' ? 'GA' :
         p.name === 'South Carolina' ? 'SC' :
         p.name === 'North Carolina' ? 'NC' :
         p.name === 'Tennessee' ? 'TN' :
         p.name === 'Florida' ? 'FL' :
         p.name === 'Texas' ? 'TX' :
         p.name === 'Virginia' ? 'VA' :
         p.name === 'Alabama' ? 'AL' : null);
      return { ...f, properties: { ...p, STUSPS: code } };
    })
    .filter((f: any) => f.properties.STUSPS);

  return { type: 'FeatureCollection', features };
}



import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AnomalyItem, CompetitorStateIntel } from '../lib/schema';
import { useAnomalyStream, AnomalyFeature } from '../hooks/useAnomalyStream';
import { registerGeoJSONVTSource, shouldUseTiledRendering } from '../lib/geojson-vt-protocol';
import MapDebugOverlay from './MapDebugOverlay';

interface StateMapProps {
  anomalies: AnomalyItem[];
  competitors: CompetitorStateIntel[];
  selectedState: string | null;
  onSelectState: (stateCode: string) => void;
  onSelectAnomaly: (anomaly: AnomalyItem) => void;
}

const BASEMAPS = {
  demotiles: 'https://demotiles.maplibre.org/style.json',
  dark: 'https://demotiles.maplibre.org/style.json',
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
    layers: [{ id: 'sat-layer', type: 'raster', source: 'sat' }],
  },
  light: 'https://demotiles.maplibre.org/style.json',
  terrain: 'https://demotiles.maplibre.org/style.json',
};

const GA_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-85.6, 30.3], // SW
  [-80.8, 35.0], // NE
];

export default function StateMap({
  anomalies,
  competitors,
  selectedState = 'GA',
  onSelectState,
  onSelectAnomaly,
}: StateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [zoom, setZoom] = useState(6.2);
  const [webgpuSupported, setWebgpuSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setWebgpuSupported(true);
    }
  }, []);

  // Format anomalies into GeoJSON Features
  const features: AnomalyFeature[] = anomalies.map((a, idx) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: a.coordinates as [number, number],
    },
    properties: {
      id: a.id || `anom-${idx}`,
      severity: (a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'HIGH' : 'MEDIUM') as any,
      category: a.sector || 'Economic',
      title: `${a.code} - ${a.location}`,
      zScore: 2.4 + (idx % 5) * 0.3,
      confidence: (a.confidenceScore || 95) / 100,
    },
  }));

  // Coalesced real-time SSE stream hook
  useAnomalyStream('anomalies', mapRef.current);

  // Setup layers on map load
  const addMapLayers = useCallback(async (map: maplibregl.Map) => {
    // ═══ SINGLE SOURCE for all 8 state boundaries ═══
    let normalizedData: any = '/geo/all-states.geojson';
    try {
      normalizedData = await loadNormalizedStates();
    } catch {}

    if (!map.getSource('all-states')) {
      map.addSource('all-states', {
        type: 'geojson',
        data: normalizedData,
        maxzoom: 14,
      } as any);
    } else {
      const src = map.getSource('all-states') as any;
      if (src && typeof src.setData === 'function' && typeof normalizedData === 'object') {
        src.setData(normalizedData);
      }
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
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            3, 4,
            10, 10,
            18, 22,
            24, 30,
          ],
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
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            3, 1.2,
            6, 2.0,
            10, 3.5,
            14, 6.0,
            18, 10.0,
            22, 16.0,
            24, 20.0,
          ],
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
          'fill-opacity': 0.22,
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
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            3, 4,
            10, 10,
            18, 22,
            24, 30,
          ],
          'line-blur': 6,
          'line-opacity': 0.85,
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
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            3, 1.2,
            6, 2.0,
            10, 3.5,
            14, 6.0,
            18, 10.0,
            22, 16.0,
            24, 20.0,
          ],
          'line-opacity': 1,
        },
      });
    }

    // 2. Competitor Boundaries
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

    // 3. Competitor Native Symbol Layer (NO HTML Badges)
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

    // 4. Clustered Anomaly Markers (Circle Layers)
    if (!map.getSource('anomalies')) {
      if (shouldUseTiledRendering(features.length)) {
        registerGeoJSONVTSource(map, 'anomalies', {
          type: 'FeatureCollection',
          features,
        });
      } else {
        map.addSource('anomalies', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 12,
          clusterProperties: {
            criticalCount: ['+', ['case', ['==', ['get', 'severity'], 'CRITICAL'], 1, 0]],
          },
        });
      }
    }

    // Cluster Circles
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

    // Pulsing Ring for Critical Anomalies
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

    // Unclustered Points
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

    // 5. Native Map Event Handlers
    map.on('click', 'anomaly-clusters', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ['anomaly-clusters'] });
      const clusterId = feats[0]?.properties?.cluster_id;
      const src = map.getSource('anomalies') as any;
      if (src && typeof src.getClusterExpansionZoom === 'function') {
        src.getClusterExpansionZoom(clusterId).then((targetZoom: number) => {
          if (feats[0].geometry.type !== 'Point') return;
          map.easeTo({
            center: feats[0].geometry.coordinates as [number, number],
            zoom: (targetZoom || 10) + 0.5,
            duration: 600,
            easing: (t) => t * (2 - t),
          });
        }).catch(() => {});
      }
    });

    map.on('click', 'anomaly-points', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const props = f.properties as any;
      const matched = anomalies.find((item) => item.id === props.id || `${item.code} - ${item.location}` === props.title);
      if (matched) {
        onSelectAnomaly(matched);
      }

      new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '320px' })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(`
          <div style="font-family:monospace;padding:6px;background:#0f172a;color:#f8fafc;border-radius:8px;">
            <div style="font-size:11px;color:${props.severity === 'CRITICAL' ? '#f87171' : '#00e5ff'};font-weight:700;">
              ${props.severity} · ${props.category}
            </div>
            <div style="font-size:13px;font-weight:700;color:#f8fafc;margin:6px 0;">
              ${props.title}
            </div>
            <div style="font-size:11px;color:#94a3b8;">
              Z-Score: <strong style="color:#00ff9d;">${typeof props.zScore === 'number' ? props.zScore.toFixed(2) : props.zScore}σ</strong>
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on('click', 'competitor-labels', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const st = f.properties?.STUSPS;
      if (st) onSelectState(st);
    });

    map.on('mouseenter', 'anomaly-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'anomaly-clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'anomaly-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'anomaly-points', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'competitor-labels', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'competitor-labels', () => { map.getCanvas().style.cursor = ''; });
  }, [features, anomalies, onSelectAnomaly, onSelectState]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

// Default MapLibre worker

    const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

    // Initialize MapLibre Map with maxZoom: 24 architectural ceiling
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      bounds: GA_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      pitch: 0,
      bearing: 0,
      minZoom: 3,
      maxZoom: 24,
      maxPitch: 85,
      attributionControl: false,
      experimentalZoomLevelsToOverscale: 4,
      hash: false,
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      cooperativeGestures: false,
    } as any);

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'imperial' }),
      'bottom-left'
    );

    map.on('style.load', () => {
      try {
        (map as any).setProjection?.({ type: 'globe' });
      } catch (err) {
        console.warn('[StateMap] Globe projection deferred:', err);
      }
    });

    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('pitch', () => setPitch(map.getPitch()));

    map.on('error', (e) => {
      console.error('[maplibre]', e?.error?.message ?? e);
    });

    map.on('load', async () => {
      try {
        if (typeof window !== 'undefined') {
          (window as any).__map = map;
          console.log('[Map] maxZoom:', map.getMaxZoom(), 'minZoom:', map.getMinZoom());
        }
        await addMapLayers(map);
        setReady(true);
      } catch (err) {
        console.error('[Map] Layer initialization failed:', err);
        try {
          map.setStyle('https://demotiles.maplibre.org/style.json');
        } catch {}
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

  // Respond to selectedState prop changes: flyTo and dynamic polygon boundary swap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedState) return;

    const STATE_CENTERS: Record<string, [number, number]> = {
      GA: [-83.4, 32.6],
      NC: [-79.0, 35.6],
      TN: [-86.3, 35.8],
      SC: [-80.9, 33.8],
      FL: [-81.5, 27.9],
      TX: [-99.9, 31.4],
      VA: [-78.6, 37.5],
      AL: [-86.8, 32.8],
    };

    if (STATE_CENTERS[selectedState]) {
      map.flyTo({
        center: STATE_CENTERS[selectedState],
        zoom: selectedState === 'GA' ? 6.8 : 6.2,
        duration: 1200,
        essential: true,
      });
    }

    // Update filter on all three ally layers (instantaneous, zero network fetch)
    const allyCode = selectedState === 'GA' ? '__none__' : selectedState;
    ['ally-fill', 'ally-glow', 'ally-outline'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, ['==', ['get', 'STUSPS'], allyCode]);
      }
    });

    // Automated Diagnostic Log directly into browser console on focus change
    try {
      const matched = map.querySourceFeatures('all-states', {
        filter: ['==', ['get', 'STUSPS'], allyCode],
      });
      console.log(`[StateMap Diagnostic] SelectedState: ${selectedState} | AllyCode: ${allyCode}`);
      console.log(`[StateMap Diagnostic] all-states source exists: ${!!map.getSource('all-states')}`);
      console.log(`[StateMap Diagnostic] ally-outline layer exists: ${!!map.getLayer('ally-outline')}`);
      console.log(`[StateMap Diagnostic] ally-outline filter:`, JSON.stringify(map.getFilter('ally-outline')));
      console.log(`[StateMap Diagnostic] Matched features in source: ${matched.length}`);
    } catch (e) {
      console.error('[StateMap Diagnostic] Error querying features:', e);
    }

    // Ensure correct layer ordering so ally outline renders clearly
    try {
      if (map.getLayer('ally-fill')) map.moveLayer('ally-fill');
      if (map.getLayer('ally-glow')) map.moveLayer('ally-glow');
      if (map.getLayer('ally-outline')) map.moveLayer('ally-outline');
      if (map.getLayer('ga-fill')) map.moveLayer('ga-fill');
      if (map.getLayer('ga-glow')) map.moveLayer('ga-glow');
      if (map.getLayer('ga-outline')) map.moveLayer('ga-outline');
    } catch {}
  }, [selectedState, ready]);

  // Toggle 3D Terrain
  const toggle3D = () => {
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
      map.easeTo({ pitch: 55, bearing: -10, duration: 800 });
    } else {
      (map as any).setTerrain?.(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[480px] min-h-[380px] rounded-xl overflow-hidden border border-[#28394e] bg-[#0f172a] shadow-2xl"
    >
      <MapDebugOverlay mapRef={mapRef} />
      {/* 3D / Perspective HUD Toggle Button — glass style */}
      <div
        className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1 p-1 rounded-lg"
        style={{
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
        }}
      >
        <button
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
          {pitch > 20 ? '2D MERCATOR' : '3D GLOBE / TERRAIN'}
        </button>
        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8', padding: '2px 6px' }}>
          z{mapRef.current && typeof zoom === 'number' && !isNaN(zoom) ? zoom.toFixed(1) : '--'} · p{typeof pitch === 'number' && !isNaN(pitch) ? pitch.toFixed(0) : '0'}° · WEBGL2
        </div>
      </div>

      {/* Overlay Radar Legend (Bottom Right) */}
      <div className="absolute bottom-3 left-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-lg p-2 text-[10px] text-slate-300 font-mono shadow-xl flex items-center space-x-3 pointer-events-none z-10">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] border border-white" />
          <span>Critical Anomaly</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff]" />
          <span>High Severity</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#00ff9d]" />
          <span>Medium Severity</span>
        </div>
      </div>
    </div>
  );
}
