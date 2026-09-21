'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AnomalyItem, CompetitorStateIntel } from '../lib/schema';
import { useAnomalyStream, AnomalyFeature } from '../hooks/useAnomalyStream';
import { registerGeoJSONVTSource, shouldUseTiledRendering } from '../lib/geojson-vt-protocol';

interface StateMapProps {
  anomalies: AnomalyItem[];
  competitors: CompetitorStateIntel[];
  selectedState: string | null;
  onSelectState: (stateCode: string) => void;
  onSelectAnomaly: (anomaly: AnomalyItem) => void;
}

const BASEMAPS = {
  dark: {
    version: 8,
    sources: {
      proxyTiles: {
        type: 'raster',
        tiles: ['/api/tiles/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors (Same-Origin Clean Proxy)',
      },
    },
    layers: [
      {
        id: 'proxy-layer',
        type: 'raster',
        source: 'proxyTiles',
        paint: {
          'raster-opacity': 0.72,
          'raster-brightness-max': 0.45,
          'raster-contrast': 0.35,
          'raster-saturation': -0.85,
        },
      },
    ],
  },
  light: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['/api/tiles/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
  },
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
  const addMapLayers = useCallback((map: maplibregl.Map) => {
    // 1. Georgia Target Boundary (Census TIGER Polygon)
    if (!map.getSource('ga-target')) {
      map.addSource('ga-target', {
        type: 'geojson',
        data: '/geo/ga-state-boundary.geojson',
      });
    }

    if (!map.getLayer('ga-fill')) {
      map.addLayer({
        id: 'ga-fill',
        type: 'fill',
        source: 'ga-target',
        paint: {
          'fill-color': '#dc2626',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.28,
            10, 0.12,
          ],
        },
      });
    }

    if (!map.getLayer('ga-outline')) {
      map.addLayer({
        id: 'ga-outline',
        type: 'line',
        source: 'ga-target',
        paint: {
          'line-color': '#f87171',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 10, 3.2],
          'line-blur': 1,
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

    // Resolve MapLibre v6 ESM Web Worker to prevent canvas blackouts
    if (typeof window !== 'undefined' && typeof (maplibregl as any).setWorkerUrl === 'function') {
      (maplibregl as any).setWorkerUrl('/maplibre-gl-worker.mjs');
    }

    const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

    // Initialize MapLibre Map
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS.dark,
      bounds: GA_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 3,
      attributionControl: false,
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

    try {
      (map as any).setProjection({ type: 'globe' });
      (map as any).setSky?.({
        'sky-color': '#0f172a',
        'horizon-color': '#1e293b',
        'fog-color': '#0f172a',
        'atmosphere-blend': [
          'interpolate', ['linear'], ['zoom'],
          0, 1,
          12, 0,
        ],
      });
    } catch {}

    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('pitch', () => setPitch(map.getPitch()));

    map.on('load', () => {
      setReady(true);
      addMapLayers(map);
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
    return () => {
      clearTimeout(fallbackTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [addMapLayers]);

  // Respond to selectedState prop changes
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
        zoom: selectedState === 'GA' ? 6.8 : 5.8,
        duration: 1000,
        essential: true,
      });
    }
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
          url: 'https://demotilesmaplibre.org/terrain-tiles/tiles.json',
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
      {/* 3D / Perspective HUD Toggle Button */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
        <button
          onClick={toggle3D}
          className="rounded-lg bg-[#0f172a]/90 border border-[#28394e] px-2.5 py-1 text-[11px] text-[#00ff9d] font-bold backdrop-blur shadow-md hover:border-[#00ff9d]"
        >
          {pitch > 20 ? '2D MERCATOR' : '3D GLOBE / TERRAIN'}
        </button>
        <div className="rounded-lg bg-[#0f172a]/90 border border-[#28394e] px-2 py-0.5 text-[9px] text-slate-400 backdrop-blur font-mono">
          z{zoom.toFixed(1)} · p{pitch.toFixed(0)}° · {webgpuSupported ? 'WEBGPU' : 'WEBGL2'}
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
