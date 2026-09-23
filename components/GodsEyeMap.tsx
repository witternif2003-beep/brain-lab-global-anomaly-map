'use client';
import { OUTBOUND_GA_PERSON_TEMPLATES, getInterpolatedArcPoint, VerifiedPersonLeavingGA } from '../lib/telemetry-arcs';

// Safe module initialization
if (typeof window !== 'undefined') {
  try {
    const ml = require('maplibre-gl');
    if (ml && typeof ml.setWorkerUrl === 'function') {
      ml.setWorkerUrl('/maplibre-gl-worker.mjs');
    }
  } catch (e) {
    console.warn('[MapLibre] Worker URL initialization deferred:', e);
  }
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAnomalyStream, AnomalyFeature } from '../hooks/useAnomalyStream';
import { registerGeoJSONVTSource, shouldUseTiledRendering } from '../lib/geojson-vt-protocol';
import { GEORGIA_ANOMALIES } from '../lib/data';
import { GODSEYE_INTEL_LAYERS, SAMPLE_LIVE_ENTITIES, LiveTelemetryEntity, IntelLayerConfig } from '../lib/godseye-layers';
import MapDebugOverlay from './MapDebugOverlay';
import MapMenuOverlay from './MapMenuOverlay';

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
  terrain: {
    version: 8,
    sources: {
      sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
      'terrain-dem': {
        type: 'raster-dem',
        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
        tileSize: 256,
      },
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
    terrain: { source: 'terrain-dem', exaggeration: 1.5 },
  },
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
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('satellite');
  const [pitch, setPitch] = useState(60);
  const [zoom, setZoom] = useState(6.0);
  const [activeFocus, setActiveFocus] = useState<StateCode | 'ALL'>(focusState);
  const [webgpuSupported, setWebgpuSupported] = useState(false);
  const [selectedInspect, setSelectedInspect] = useState<any>(null);
  const [activePersonEvent, setActivePersonEvent] = useState<VerifiedPersonLeavingGA | null>(null);
  const [activeIntelLayer, setActiveIntelLayer] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<LiveTelemetryEntity | null>(null);
  const [outboundCounts, setOutboundCounts] = useState<Record<string, number>>({
    NC: 3412,
    TN: 2189,
    SC: 1945,
    FL: 4820,
    TX: 2760,
    VA: 1630,
    AL: 1140,
  });

  // NSA Admin Real-Time Star Constellations Canvas Animation
  const starsCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = starsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', onResize);

    // Major recognizable astronomical constellations (Ursa Major, Orion, Cassiopeia, Cygnus, Taurus, Pleiades)
    const STARS = Array.from({ length: 160 }, (_, i) => ({
      x: Math.random(),
      y: Math.random() * 0.52, // Sky hemisphere above horizon
      radius: Math.random() * 1.6 + 0.4,
      baseAlpha: Math.random() * 0.6 + 0.35,
      twinkleSpeed: Math.random() * 0.03 + 0.015,
      twinklePhase: Math.random() * Math.PI * 2,
      color: i % 7 === 0 ? '#38bdf8' : i % 11 === 0 ? '#a7f3d0' : '#ffffff',
    }));

    // Real constellation star lines (normalized [x, y])
    const CONSTELLATIONS = [
      // Big Dipper (Ursa Major)
      [
        { x: 0.18, y: 0.12 }, { x: 0.22, y: 0.14 }, { x: 0.25, y: 0.17 },
        { x: 0.29, y: 0.18 }, { x: 0.32, y: 0.24 }, { x: 0.27, y: 0.26 },
        { x: 0.25, y: 0.20 }, { x: 0.29, y: 0.18 }
      ],
      // Cassiopeia (W)
      [
        { x: 0.72, y: 0.08 }, { x: 0.76, y: 0.13 }, { x: 0.79, y: 0.10 },
        { x: 0.83, y: 0.15 }, { x: 0.87, y: 0.11 }
      ],
      // Orion's Belt & Shield
      [
        { x: 0.48, y: 0.15 }, { x: 0.51, y: 0.17 }, { x: 0.54, y: 0.19 }, // belt
      ],
      // Cygnus (Northern Cross)
      [
        { x: 0.38, y: 0.06 }, { x: 0.40, y: 0.14 }, { x: 0.42, y: 0.22 },
      ]
    ];

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
      skyGrad.addColorStop(0, 'rgba(2, 6, 18, 0.95)');
      skyGrad.addColorStop(0.6, 'rgba(4, 12, 30, 0.75)');
      skyGrad.addColorStop(1, 'rgba(6, 16, 40, 0.0)');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height * 0.55);

      // Draw constellation guide lines (subtle cyan/sky telemetry lines)
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      CONSTELLATIONS.forEach((points) => {
        ctx.beginPath();
        points.forEach((pt, idx) => {
          const px = pt.x * width;
          const py = pt.y * height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Star node points on constellation vertices
        points.forEach((pt) => {
          const px = pt.x * width;
          const py = pt.y * height;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });

      // Render twinkling stars
      STARS.forEach((star) => {
        const px = star.x * width;
        const py = star.y * height;
        const alpha = Math.max(0.15, Math.min(1.0, star.baseAlpha + Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.35));

        ctx.beginPath();
        ctx.arc(px, py, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        if (alpha > 0.7) {
          ctx.shadowColor = star.color;
          ctx.shadowBlur = 4;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);


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
          'fill-opacity': 0.0,
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
          'line-color': '#ff3b3b',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
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
          'text-color': '#38bdf8',
          'text-halo-color': '#0f172a',
          'text-halo-width': 3,
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

    
    // ─── DYNAMIC TELEMETRY PULSES: Clean Moving Directional Vectors (NO STATIC LINES) ───
    // ─── GODSEYE MULTI-DOMAIN SENSOR ENTITIES (AVIATION, MARITIME, ORBITAL, CYBER, THERMAL) ───
    if (!map.getSource('godseye-entities')) {
      const entityFeatures = SAMPLE_LIVE_ENTITIES.map((ent) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [ent.lng, ent.lat] as [number, number],
        },
        properties: {
          id: ent.id,
          layerId: ent.layerId,
          callsignOrName: ent.callsignOrName,
          type: ent.type,
          altOrSpeed: ent.altOrSpeed,
          heading: ent.heading,
          status: ent.status,
          anomalyFlag: ent.anomalyFlag || '',
          source: ent.source,
          color: ent.layerId === 'layer-adsb' ? '#38bdf8' :
                 ent.layerId === 'layer-ais' ? '#06b6d4' :
                 ent.layerId === 'layer-satellites' ? '#c084fc' :
                 ent.layerId === 'layer-cctv' ? '#10b981' :
                 ent.layerId === 'layer-nuclear' ? '#34d399' :
                 ent.layerId === 'layer-cyber' ? '#ec4899' :
                 ent.layerId === 'layer-gps-jamming' ? '#fb923c' : '#38bdf8',
        },
      }));

      map.addSource('godseye-entities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: entityFeatures },
      });
    }

    if (!map.getLayer('godseye-entities-halo')) {
      map.addLayer({
        id: 'godseye-entities-halo',
        type: 'circle',
        source: 'godseye-entities',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 12,
          'circle-opacity': 0.25,
          'circle-blur': 0.6,
        },
      });
    }

    if (!map.getLayer('godseye-entities-core')) {
      map.addLayer({
        id: 'godseye-entities-core',
        type: 'circle',
        source: 'godseye-entities',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5.5,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.95,
        },
      });
    }

    if (!map.getLayer('godseye-entities-labels')) {
      map.addLayer({
        id: 'godseye-entities-labels',
        type: 'symbol',
        source: 'godseye-entities',
        layout: {
          'text-field': ['get', 'callsignOrName'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': '#090d16',
          'text-halo-width': 2,
        },
      });
    }

    map.on('click', 'godseye-entities-core', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const props = f.properties as any;
      const matched = SAMPLE_LIVE_ENTITIES.find((item) => item.id === props.id);
      if (matched) {
        setSelectedEntity(matched);
      }
      new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '340px' })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(`
          <div style="font-family:monospace;padding:6px;background:#090d16;color:#f8fafc;border-radius:8px;border:1px solid #38bdf8;">
            <div style="font-size:10px;color:#38bdf8;font-weight:700;text-transform:uppercase;">
              ${props.layerId} • ${props.status}
            </div>
            <div style="font-size:12px;font-weight:700;color:#f8fafc;margin:4px 0;">
              ${props.callsignOrName}
            </div>
            <div style="font-size:11px;color:#94a3b8;">
              Type: <strong style="color:#ffffff;">${props.type}</strong><br/>
              Velocity / Alt: <strong style="color:#10b981;">${props.altOrSpeed}</strong><br/>
              Source: <span style="color:#38bdf8;">${props.source}</span>
              ${props.anomalyFlag ? `<div style="margin-top:4px;color:#f87171;font-weight:bold;">⚠️ ${props.anomalyFlag}</div>` : ''}
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'godseye-entities-core', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'godseye-entities-core', () => { map.getCanvas().style.cursor = ''; });

    if (!map.getSource('telemetry-pulses')) {
      map.addSource('telemetry-pulses', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Pulse Halos (expanding radar ping)
    if (!map.getLayer('telemetry-pulse-glow')) {
      map.addLayer({
        id: 'telemetry-pulse-glow',
        type: 'circle',
        source: 'telemetry-pulses',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 14,
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      });
    }

    // Pulse Core Dot
    if (!map.getLayer('telemetry-pulse-core')) {
      map.addLayer({
        id: 'telemetry-pulse-core',
        type: 'circle',
        source: 'telemetry-pulses',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 1.0,
        },
      });
    }

    // Dynamic Directional Heading Chevron (Rotating in real-time with bearing)
    if (!map.getLayer('telemetry-pulse-arrow')) {
      map.addLayer({
        id: 'telemetry-pulse-arrow',
        type: 'symbol',
        source: 'telemetry-pulses',
        layout: {
          'text-field': '▲',
          'text-size': 12,
          'text-rotate': ['get', 'bearing'],
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 2,
        },
      });
    }

    // Glowing Neon Green Digital Identifier for Verified Persons Leaving GA
    if (!map.getLayer('telemetry-pulse-neon-digit')) {
      map.addLayer({
        id: 'telemetry-pulse-neon-digit',
        type: 'symbol',
        source: 'telemetry-pulses',
        layout: {
          'text-field': ['get', 'neonDigit'],
          'text-size': 13,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#00ff66', // Glowing Electric Neon Green
          'text-halo-color': '#003311', // Deep Emerald Shield Halo
          'text-halo-width': 3,
          'text-halo-blur': 2,
        },
      });
    }

    // Secondary Corridor Direction Tag
    if (!map.getLayer('telemetry-pulse-label')) {
      map.addLayer({
        id: 'telemetry-pulse-label',
        type: 'symbol',
        source: 'telemetry-pulses',
        layout: {
          'text-field': ['get', 'corridorLabel'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#34d399',
          'text-halo-color': '#090d16',
          'text-halo-width': 2,
        },
      });
    }

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
      style: BASEMAPS.satellite as any,
      bounds: GA_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      pitch: 60,
      bearing: 0,
      maxZoom: 35,
      minZoom: 1,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      cooperativeGestures: false,
    } as any);

    // Geolocate control (Locate icon at top of right rail)
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      } as any),
      'top-right'
    );

    // Navigation controls (Zoom +/- and 3D Tilt Compass at bottom right rail)
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    // Scale bar (imperial, 50 mi)
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'imperial' }),
      'bottom-left'
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


  // ─── NSA ADMIN MODE: OUTBOUND GEORGIA VERIFIED PERSON TELEMETRY (ONE AT A TIME) ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let inFlightPerson: VerifiedPersonLeavingGA | null = null;
    let templateIdx = 0;
    let verifiedSequence = 18450;
    let lastSpawnTime = 0;
    let animId: number;

    const animate = () => {
      const now = Date.now();

      // Launch exactly ONE verified person at a time (spacing out every 3.8s)
      if (!inFlightPerson && now - lastSpawnTime > 1200) {
        lastSpawnTime = now;
        verifiedSequence++;
        const tmpl = OUTBOUND_GA_PERSON_TEMPLATES[templateIdx % OUTBOUND_GA_PERSON_TEMPLATES.length];
        templateIdx++;

        const newPerson: VerifiedPersonLeavingGA = {
          ...tmpl,
          decisionId: `GA-OUTBOUND-${verifiedSequence}`,
          individualId: `PER-${tmpl.targetState}-${String(verifiedSequence).slice(-4)}`,
          personNumber: verifiedSequence,
          sourceState: 'GA',
          timestamp: now,
        };

        inFlightPerson = newPerson;
        setActivePersonEvent(newPerson);

        // Increment cumulative verified migration tally for the destination state
        setOutboundCounts((prev) => ({
          ...prev,
          [tmpl.targetState]: (prev[tmpl.targetState] || 0) + 1,
        }));
      }

      const currentFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

      if (inFlightPerson) {
        const elapsed = now - inFlightPerson.timestamp;
        const t = elapsed / inFlightPerson.flightDurationMs;

        if (t >= 1.0) {
          // Completed flight to destination: de-spawn cleanly so next person can launch
          inFlightPerson = null;
        } else {
          const { coord, bearing } = getInterpolatedArcPoint(
            inFlightPerson.sourceCoord,
            inFlightPerson.targetCoord,
            t
          );

          currentFeatures.push({
            type: 'Feature',
            properties: {
              id: inFlightPerson.decisionId,
              individualId: inFlightPerson.individualId,
              personNumber: inFlightPerson.personNumber,
              neonDigit: `№ ${inFlightPerson.personNumber.toLocaleString()}`,
              corridorLabel: `GA→${inFlightPerson.targetState} [${inFlightPerson.individualId}]`,
              role: inFlightPerson.role,
              type: inFlightPerson.type,
              color: inFlightPerson.type === 'ALLY_MIGRATION' ? '#10b981' : '#ef4444',
              bearing,
              label: `№ ${inFlightPerson.personNumber.toLocaleString()} GA→${inFlightPerson.targetState}`,
              source: `GA (${inFlightPerson.sourceCity})`,
              target: `${inFlightPerson.targetState} (${inFlightPerson.targetCity})`,
              reason: inFlightPerson.reason,
              progress: t,
            },
            geometry: {
              type: 'Point',
              coordinates: coord,
            },
          });
        }
      }

      // Update MapLibre GeoJSON layer at 60 FPS
      const src = map.getSource('telemetry-pulses') as any;
      if (src && typeof src.setData === 'function') {
        src.setData({
          type: 'FeatureCollection',
          features: currentFeatures,
        });
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [ready]);

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

  // Filter God's Eye intelligence layer entities when activeIntelLayer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      if (map.getLayer('godseye-entities-core')) {
        if (activeIntelLayer === 'all') {
          map.setFilter('godseye-entities-core', null);
          map.setFilter('godseye-entities-halo', null);
          map.setFilter('godseye-entities-labels', null);
        } else {
          const filter = ['==', ['get', 'layerId'], activeIntelLayer];
          map.setFilter('godseye-entities-core', filter as any);
          map.setFilter('godseye-entities-halo', filter as any);
          map.setFilter('godseye-entities-labels', filter as any);
        }
      }
    } catch {}
  }, [activeIntelLayer, ready]);

  // Basemap switcher
  const switchBasemap = useCallback((next: keyof typeof BASEMAPS) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(next);

    if (next === 'terrain') {
      map.setStyle(BASEMAPS.terrain as any);
      map.once('styledata', () => {
        try {
          (map as any).setTerrain?.({ source: 'terrain-dem', exaggeration: 1.5 });
        } catch {}
        addMapLayers(map);
      });
      map.easeTo({ pitch: 60, bearing: -12, duration: 800 });
    } else if (next === 'satellite') {
      try {
        (map as any).setTerrain?.(null);
      } catch {}
      map.setStyle(BASEMAPS.satellite as any);
      map.once('styledata', () => addMapLayers(map));
    } else {
      try {
        (map as any).setTerrain?.(null);
      } catch {}
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
      map.easeTo({ pitch: 60, bearing: 0, duration: 800 });
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
          {/* Real-time twinkling stars and NSA Admin Star Constellations */}
          <canvas
            ref={starsCanvasRef}
            className="absolute inset-0 pointer-events-none z-0"
            style={{ width: '100%', height: '100%' }}
          />
          {/* MapMenuOverlay removed - Diagnostics integrated into bottom control matrix */}
          {/* Real-Time Outbound Person Telemetry Stream (GA -> Ally States) - Positioned safely below 3-row HUD without overlap */}
          <div className="absolute bottom-3 right-16 z-10 rounded-xl bg-[#090d16]/95 border border-[#38bdf8]/40 p-2.5 backdrop-blur shadow-2xl max-w-[340px] text-xs font-mono space-y-1.5 hidden md:block">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                OUTBOUND GEORGIA TELEMETRY (LIVE)
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">1 AT A TIME</span>
            </div>

            {activePersonEvent && (
              <div className="space-y-0.5 text-[11px]">
                <div className="text-white font-bold flex justify-between">
                  <span className="text-emerald-400">#{activePersonEvent.personNumber.toLocaleString()} Verified Person</span>
                  <span className={activePersonEvent.type === 'ALLY_MIGRATION' ? 'text-emerald-400 font-extrabold' : 'text-red-400 font-extrabold'}>
                    GA → {activePersonEvent.targetState}
                  </span>
                </div>
                <div className="text-slate-300 text-[10px] truncate">{activePersonEvent.role}</div>
                <div className="text-slate-400 text-[9px] truncate">Reason: {activePersonEvent.reason}</div>
              </div>
            )}

            {/* Real-Time Cumulative Corridor Tallies */}
            <div className="pt-1 border-t border-slate-800/80 grid grid-cols-4 gap-1 text-[9px] text-center">
              {['NC', 'TN', 'SC', 'FL', 'TX', 'VA', 'AL'].map((st) => (
                <div key={st} className="bg-slate-900/80 rounded px-1 py-0.5 border border-slate-800">
                  <span className="text-slate-400">{st}: </span>
                  <span className="text-white font-bold">{outboundCounts[st]?.toLocaleString() ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Severity & Telemetry Arc Flow Legend */}
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-[#0f172a]/90 border border-[#28394e] p-2 text-xs backdrop-blur space-y-2 hidden sm:block max-w-[270px]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                Real-Time Telemetry Vectors
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-400 font-bold text-xs">▲</span>
                <span className="text-emerald-400 text-[10px] font-semibold">Green Pulse: Person Leaving GA to Ally State (Collaborative Regional Growth)</span>
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-red-400 font-bold text-xs">▲</span>
                <span className="text-red-400 text-[10px] font-semibold">Red Pulse: Person Leaving GA to Competitor Offer (Adversary Incentive)</span>
              </div>
            </div>

            <div className="border-t border-[#28394e] pt-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Severity</div>
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

        
      {/* Pixel-perfect control styling matching IMG_6584 exactly */}
      <style jsx global>{`
        .maplibregl-ctrl-top-right {
          top: 72px !important;
          right: 14px !important;
        }
        .maplibregl-ctrl-bottom-right {
          bottom: 24px !important;
          right: 14px !important;
        }
        .maplibregl-ctrl-group {
          background: rgba(255, 255, 255, 0.95) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35) !important;
          border: 1px solid rgba(203, 213, 225, 0.7) !important;
          overflow: hidden !important;
        }
        .maplibregl-ctrl-group button {
          width: 34px !important;
          height: 34px !important;
          border: none !important;
          background: transparent !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease !important;
        }
        .maplibregl-ctrl-group button:hover {
          background-color: rgba(226, 232, 240, 0.9) !important;
        }
        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(226, 232, 240, 0.9) !important;
        }
        .maplibregl-ctrl-scale {
          background: rgba(255, 255, 255, 0.88) !important;
          backdrop-filter: blur(8px) !important;
          border: 2px solid #0f172a !important;
          border-top: none !important;
          color: #0f172a !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 2px 6px !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
          margin-left: 14px !important;
          margin-bottom: 14px !important;
        }
      `}</style>

        {/* STANDALONE MAP MENU WIDGET DIRECTLY BENEATH THE MAP ITSELF — NSA ADMIN MODERN OVAL DASHBOARD WIDGET */}
        <div className="w-full rounded-[36px] bg-[#080e1a]/85 backdrop-blur-2xl border border-[#38bdf8]/40 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(56,189,248,0.35)] font-mono text-xs">
          <div className="flex flex-col gap-3 w-full">
            
            {/* Header Status Rail: Integrated NSA Admin Diagnostics Controller */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#1e3a5f]/60 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                </span>
                <span className="text-xs sm:text-[13px] font-extrabold text-[#38bdf8] tracking-widest uppercase">
                  GOD'S EYE NSA ADMIN OVAL COMMAND MATRIX // 3-ROW TACTICAL HUD
                </span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-[#062018]/90 px-3 py-1 rounded-full border border-emerald-500/50 font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(52,211,153,0.25)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AIP-20 ACTIVE
                </div>
                {/* Embedded NSA Admin Diagnostics Controller */}
                <div className="relative">
                  <MapDebugOverlay mapRef={mapRef} embedded={true} />
                </div>
              </div>
            </div>

            {/* Row 1: Projection & Basemap Modes - NSA Standard Spacing */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              <button
                type="button"
                onClick={toggle3D}
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  color: pitch <= 20 ? '#34d399' : '#cbd5e1',
                  background: pitch <= 20 ? 'rgba(6, 44, 32, 0.75)' : 'rgba(10, 18, 40, 0.85)',
                  border: pitch <= 20 ? '1px solid rgba(52, 211, 153, 0.65)' : '1px solid rgba(30, 58, 95, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: pitch <= 20 ? '0 0 12px rgba(52, 211, 153, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => switchBasemap('demotiles')}
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  color: basemap === 'demotiles' ? '#38bdf8' : '#cbd5e1',
                  background: basemap === 'demotiles' ? 'rgba(12, 36, 68, 0.85)' : 'rgba(10, 18, 40, 0.85)',
                  border: basemap === 'demotiles' ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(30, 58, 95, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: basemap === 'demotiles' ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                LIGHT
              </button>
              <button
                type="button"
                onClick={() => switchBasemap('satellite')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  color: basemap === 'satellite' ? '#38bdf8' : '#cbd5e1',
                  background: basemap === 'satellite' ? 'rgba(14, 75, 120, 0.65)' : 'rgba(10, 18, 40, 0.85)',
                  border: basemap === 'satellite' ? '1px solid rgba(56, 189, 248, 0.85)' : '1px solid rgba(30, 58, 95, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: basemap === 'satellite' ? '0 0 14px rgba(56, 189, 248, 0.5), inset 0 0 8px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                SATELLITE
              </button>
              <button
                type="button"
                onClick={() => switchBasemap('terrain')}
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  color: basemap === 'terrain' ? '#38bdf8' : '#cbd5e1',
                  background: basemap === 'terrain' ? 'rgba(12, 36, 68, 0.85)' : 'rgba(10, 18, 40, 0.85)',
                  border: basemap === 'terrain' ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(30, 58, 95, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: basemap === 'terrain' ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                TERRAIN
              </button>
            </div>

            {/* Row 2: Target & Primary Corridors - NSA Standard Spacing */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => handleFocusChange('GA')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  color: '#f87171',
                  background: activeFocus === 'GA' ? 'rgba(69, 10, 10, 0.65)' : 'rgba(24, 10, 10, 0.85)',
                  border: activeFocus === 'GA' ? '1px solid rgba(239, 68, 68, 0.85)' : '1px solid rgba(127, 29, 29, 0.65)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: activeFocus === 'GA' ? '0 0 14px rgba(239, 68, 68, 0.5)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                GA (Target)
              </button>
              <button
                type="button"
                onClick={() => handleFocusChange('NC')}
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  color: activeFocus === 'NC' ? '#38bdf8' : '#cbd5e1',
                  background: activeFocus === 'NC' ? 'rgba(14, 75, 120, 0.65)' : 'rgba(10, 18, 40, 0.85)',
                  border: activeFocus === 'NC' ? '1px solid rgba(56, 189, 248, 0.85)' : '1px solid rgba(30, 58, 95, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: activeFocus === 'NC' ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                NC
              </button>
              {(['TN', 'FL', 'SC', 'TX'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleFocusChange(st)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    color: activeFocus === st ? '#38bdf8' : '#cbd5e1',
                    background: activeFocus === st ? 'rgba(14, 75, 120, 0.65)' : 'rgba(10, 18, 40, 0.85)',
                    border: activeFocus === st ? '1px solid rgba(56, 189, 248, 0.85)' : '1px solid rgba(30, 58, 95, 0.7)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: activeFocus === st ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Row 3: Secondary Corridors & Viewport Metrics - NSA Standard Spacing */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1e3a5f]/50 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
                {(['VA', 'AL'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleFocusChange(st)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      color: activeFocus === st ? '#38bdf8' : '#cbd5e1',
                      background: activeFocus === st ? 'rgba(14, 75, 120, 0.65)' : 'rgba(10, 18, 40, 0.85)',
                      border: activeFocus === st ? '1px solid rgba(56, 189, 248, 0.85)' : '1px solid rgba(30, 58, 95, 0.7)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: activeFocus === st ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Viewport Readout Pill */}
              <div
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  background: 'rgba(7, 13, 24, 0.9)',
                  border: '1px solid rgba(30, 58, 95, 0.75)',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.1)',
                }}
              >
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  z{typeof zoom === 'number' && !isNaN(zoom) ? zoom.toFixed(1) : '6.0'} · p{typeof pitch === 'number' && !isNaN(pitch) ? pitch.toFixed(0) : '60'}°
                </span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>| WEBGL2</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Side Inspector (4 Cols) */}
      <div className="lg:col-span-4 space-y-4">
        {/* Active God's Eye Intelligence Layer Controller */}
        <div className="bg-[#0b1320] border border-[#1e3a5f] rounded-2xl p-4 shadow-xl space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[#1e3a5f]/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                GOD'S EYE MULTI-DOMAIN SENSORS
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-[#062018] px-2 py-0.5 rounded-full border border-emerald-500/40">
              14 FEEDS LIVE
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Select intelligence layer to filter real-time orbital, maritime, aviation, and cyber sensors directly on the map.
          </p>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveIntelLayer('all')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-left transition-all truncate border ${
                activeIntelLayer === 'all'
                  ? 'bg-[#0c2444] text-[#38bdf8] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                  : 'bg-[#070d18]/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              🌐 ALL SENSORS (10)
            </button>
            {GODSEYE_INTEL_LAYERS.slice(0, 7).map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveIntelLayer(layer.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-left transition-all truncate border ${
                  activeIntelLayer === layer.id
                    ? 'bg-[#0c2444] text-[#38bdf8] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                    : 'bg-[#070d18]/80 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="truncate">{layer.category.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Sensor Entity Quick Inspector */}
        {selectedEntity ? (
          <div className="bg-[#0b1320] border border-[#38bdf8]/50 rounded-2xl p-4 shadow-xl space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-[10px] uppercase font-bold text-sky-400">
                ACTIVE SENSOR TELEMETRY LOCK
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${selectedEntity.status === 'ANOMALOUS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {selectedEntity.status}
              </span>
            </div>
            <div className="text-white font-bold text-xs">{selectedEntity.callsignOrName}</div>
            <div className="text-[11px] text-slate-300">
              Type: <span className="text-white">{selectedEntity.type}</span><br/>
              Velocity / Alt: <span className="text-emerald-400">{selectedEntity.altOrSpeed}</span><br/>
              Coordinates: <span className="text-sky-300">{selectedEntity.lat.toFixed(3)}°N, {selectedEntity.lng.toFixed(3)}°W</span><br/>
              Source: <span className="text-slate-400">{selectedEntity.source}</span>
            </div>
            {selectedEntity.anomalyFlag && (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-300">
                ⚠️ {selectedEntity.anomalyFlag}
              </div>
            )}
          </div>
        ) : null}

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
        ) : null}

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
