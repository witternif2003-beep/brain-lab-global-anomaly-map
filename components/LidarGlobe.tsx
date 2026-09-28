"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Globe,
  Play,
  Pause,
  Layers,
  Maximize2,
  Minimize2,
  Crosshair,
  Radio,
  Mountain,
  Building2,
  Eye,
  ExternalLink,
  Activity,
  ChevronDown
} from "lucide-react";
import { useTelemetryStore } from "../lib/telemetry-store";
import styles from "./LidarGlobe.module.css";
import {
  AWS_TERRARIUM_TILES,
  DC_LIDAR_BOUNDS,
  DC_LIDAR_PRODUCTS,
  DcLidarProduct,
  ESRI_WORLD_IMAGERY_TILES,
  GLOBE_SOURCES,
  OPENFREEMAP_PLANET,
  dcLidarTileUrl
} from "../lib/lidar-globe-sources";

type LidarMode = DcLidarProduct | "off";

interface CameraPreset {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

const PRESETS: CameraPreset[] = [
  { id: "globe", label: "GLOBE", center: [-77, 28], zoom: 1.7, pitch: 0, bearing: 0 },
  { id: "conus", label: "CONUS", center: [-97, 38.5], zoom: 3.4, pitch: 0, bearing: 0 },
  { id: "dc", label: "DC LIDAR", center: [-77.0365, 38.8977], zoom: 15.6, pitch: 62, bearing: -18 },
  { id: "sav", label: "SAVANNAH PORT", center: [-81.1, 32.08], zoom: 11.8, pitch: 55, bearing: 20 }
];

interface SelectedPin {
  kind: "vessel" | "anomaly";
  title: string;
  lines: string[];
}

interface HudState {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  fps: number;
  tilesLoaded: boolean;
  elevation: number | null;
}

const LIDAR_LAYER_IDS = DC_LIDAR_PRODUCTS.map((p) => `dc-lidar-${p.id}`);

function telemetryGeoJSON(
  vessels: ReturnType<typeof useTelemetryStore.getState>["vessels"],
  anomalies: ReturnType<typeof useTelemetryStore.getState>["anomalies"]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: [
      ...vessels.map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
        properties: {
          kind: "vessel",
          title: v.name,
          l1: `MMSI ${v.mmsi} • ${v.status}`,
          l2: `${v.speedKnots.toFixed(1)} kn @ ${v.courseDeg}° → ${v.destination}`,
          l3: `Dwell ${v.dwellHours.toFixed(1)} h`,
          color: "#00e5ff"
        }
      })),
      ...anomalies.map((a) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: a.coordinates },
        properties: {
          kind: "anomaly",
          title: `${a.code} — ${a.title}`,
          l1: `${a.severity} • ${a.sector} • ${a.location}`,
          l2: `Deviation ${a.deviation} • z ${a.zScore}`,
          l3: new Date(a.timestamp).toISOString(),
          color: a.severity === "CRITICAL" ? "#ff3d71" : a.severity === "HIGH" ? "#ff2ec4" : "#bd00ff"
        }
      }))
    ]
  };
}

export default function LidarGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isRotatingRef = useRef<boolean>(true);

  const vessels = useTelemetryStore((s) => s.vessels);
  const anomalies = useTelemetryStore((s) => s.anomalies);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);

  const [isReady, setIsReady] = useState(false);
  const [isRotating, setIsRotating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lidarMode, setLidarMode] = useState<LidarMode>("Intensity_2024");
  const [lidarOpacity, setLidarOpacity] = useState(85);
  const [glassOpacity, setGlassOpacity] = useState(55);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showHillshade, setShowHillshade] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [hudOpen, setHudOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hud, setHud] = useState<HudState>({
    lng: PRESETS[0].center[0],
    lat: PRESETS[0].center[1],
    zoom: PRESETS[0].zoom,
    pitch: 0,
    bearing: 0,
    fps: 0,
    tilesLoaded: false,
    elevation: null
  });

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    if (!mapElRef.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

    const initial = useTelemetryStore.getState();
    const map = new maplibregl.Map({
      container: mapElRef.current,
      center: PRESETS[0].center,
      zoom: PRESETS[0].zoom,
      maxPitch: 85,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true },
      style: {
        version: 8,
        projection: { type: "globe" },
        sky: {
          "sky-color": "#04162b",
          "horizon-color": "#1b5d8c",
          "fog-color": "#0a2440",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.7,
          "fog-ground-blend": 0.35,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.8, 9, 0]
        },
        sources: {
          imagery: {
            type: "raster",
            tiles: [ESRI_WORLD_IMAGERY_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri World Imagery</a> — Esri, Maxar, Earthstar Geographics, USDA FSA, USGS'
          },
          terrain: {
            type: "raster-dem",
            tiles: [AWS_TERRARIUM_TILES],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 15,
            attribution:
              '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> — Mapzen/AWS, USGS 3DEP'
          },
          "hillshade-dem": {
            type: "raster-dem",
            tiles: [AWS_TERRARIUM_TILES],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 15
          },
          ...Object.fromEntries(
            DC_LIDAR_PRODUCTS.map((p) => [
              `dc-lidar-${p.id}`,
              {
                type: "raster" as const,
                tiles: [dcLidarTileUrl(p.id)],
                tileSize: 256,
                bounds: DC_LIDAR_BOUNDS,
                minzoom: 11,
                maxzoom: 19,
                attribution:
                  '<a href="https://opendata.dc.gov/search?q=2024%20lidar" target="_blank" rel="noopener">DC OCTO 2024 LiDAR</a>'
              }
            ])
          ),
          openmaptiles: {
            type: "vector",
            url: OPENFREEMAP_PLANET,
            attribution:
              '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          },
          telemetry: {
            type: "geojson",
            data: telemetryGeoJSON(initial.vessels, initial.anomalies)
          }
        },
        layers: [
          { id: "space", type: "background", paint: { "background-color": "#010812" } },
          {
            id: "imagery",
            type: "raster",
            source: "imagery",
            paint: { "raster-fade-duration": 200, "raster-contrast": 0.08, "raster-saturation": 0.05 }
          },
          {
            id: "hillshade",
            type: "hillshade",
            source: "hillshade-dem",
            paint: {
              "hillshade-exaggeration": 0.6,
              "hillshade-shadow-color": "rgba(0, 8, 20, 0.75)",
              "hillshade-highlight-color": "rgba(255, 255, 255, 0.12)",
              "hillshade-accent-color": "rgba(0, 229, 255, 0.08)"
            }
          },
          ...DC_LIDAR_PRODUCTS.map((p) => ({
            id: `dc-lidar-${p.id}`,
            type: "raster" as const,
            source: `dc-lidar-${p.id}`,
            layout: { visibility: p.id === "Intensity_2024" ? ("visible" as const) : ("none" as const) },
            paint: { "raster-opacity": 0.85, "raster-fade-duration": 150 }
          })),
          {
            id: "buildings-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "render_height"], 5],
                0,
                "#d9dde3",
                60,
                "#a9c7dd",
                200,
                "#7fb3d5"
              ],
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.72,
              "fill-extrusion-vertical-gradient": true
            }
          },
          {
            id: "telemetry-halo",
            type: "circle",
            source: "telemetry",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 10, 16],
              "circle-color": ["get", "color"],
              "circle-opacity": 0.18,
              "circle-blur": 0.6,
              "circle-pitch-alignment": "map"
            }
          },
          {
            id: "telemetry-pins",
            type: "circle",
            source: "telemetry",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 10, 7],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.2,
              "circle-pitch-alignment": "map"
            }
          }
        ],
        terrain: { source: "terrain", exaggeration: 1.2 }
      }
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

    const stopRotation = () => {
      isRotatingRef.current = false;
      setIsRotating(false);
    };
    map.on("mousedown", stopRotation);
    map.on("touchstart", stopRotation);
    map.on("wheel", stopRotation);

    map.on("click", "telemetry-pins", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties;
      setSelectedPin({
        kind: p.kind === "vessel" ? "vessel" : "anomaly",
        title: String(p.title),
        lines: [String(p.l1), String(p.l2), String(p.l3)]
      });
    });
    map.on("mouseenter", "telemetry-pins", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "telemetry-pins", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("load", () => setIsReady(true));
    map.on("error", (e) => {
      const message = e.error instanceof Error ? e.error.message : "tile request failed";
      setMapError(message);
    });

    let frames = 0;
    let lastFpsAt = performance.now();
    let fps = 0;
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - lastFpsAt >= 1000) {
        fps = Math.round((frames * 1000) / (now - lastFpsAt));
        frames = 0;
        lastFpsAt = now;
        const c = map.getCenter();
        const elev = map.queryTerrainElevation(c);
        setHud({
          lng: c.lng,
          lat: c.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
          fps,
          tilesLoaded: map.areTilesLoaded(),
          elevation: elev
        });
      }
      if (isRotatingRef.current && map.getZoom() < 5 && !map.isMoving()) {
        const c = map.getCenter();
        map.jumpTo({ center: [c.lng + 0.06, c.lat] });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const src = map.getSource("telemetry");
    if (src instanceof maplibregl.GeoJSONSource) {
      src.setData(telemetryGeoJSON(vessels, anomalies));
    }
  }, [vessels, anomalies, isReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    LIDAR_LAYER_IDS.forEach((id) => {
      map.setLayoutProperty(id, "visibility", id === `dc-lidar-${lidarMode}` ? "visible" : "none");
      map.setPaintProperty(id, "raster-opacity", lidarOpacity / 100);
    });
  }, [lidarMode, lidarOpacity, isReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    map.setTerrain(showTerrain ? { source: "terrain", exaggeration: 1.2 } : null);
    map.setLayoutProperty("hillshade", "visibility", showHillshade ? "visible" : "none");
    map.setLayoutProperty("buildings-3d", "visibility", showBuildings ? "visible" : "none");
    const telemetryVisibility = showTelemetry ? "visible" : "none";
    map.setLayoutProperty("telemetry-pins", "visibility", telemetryVisibility);
    map.setLayoutProperty("telemetry-halo", "visibility", telemetryVisibility);
  }, [showTerrain, showHillshade, showBuildings, showTelemetry, isReady]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
      requestAnimationFrame(() => mapRef.current?.resize());
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  };

  const flyTo = (preset: CameraPreset) => {
    const map = mapRef.current;
    if (!map) return;
    if (preset.zoom > 5) {
      isRotatingRef.current = false;
      setIsRotating(false);
    }
    map.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: 4500,
      essential: true
    });
  };

  const glassStyle: React.CSSProperties = { backgroundColor: `rgba(2, 11, 24, ${glassOpacity / 100})` };

  const pill = (active: boolean) => (active ? `${styles.pill} ${styles.pillActive}` : styles.pill);

  const insideDc =
    hud.lng >= DC_LIDAR_BOUNDS[0] &&
    hud.lng <= DC_LIDAR_BOUNDS[2] &&
    hud.lat >= DC_LIDAR_BOUNDS[1] &&
    hud.lat <= DC_LIDAR_BOUNDS[3] &&
    hud.zoom >= 11;

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={isFullscreen ? `${styles.stage} ${styles.stageFull}` : styles.stage}>
        <div ref={mapElRef} className={styles.map} />

        <div className={`${styles.glass} ${styles.hud}`} style={glassStyle}>
          <button
            type="button"
            className={`${styles.row} ${styles.hudToggle}`}
            onClick={() => setHudOpen((o) => !o)}
            aria-expanded={hudOpen}
            aria-controls="lidar-globe-hud"
          >
            <span className={styles.title}>
              <Globe className={styles.icon} />
              <span>LIDAR / HD IMAGERY GLOBE</span>
            </span>
            <span className={styles.hudToggleEnd}>
              <span className={connectionStatus === "streaming" ? `${styles.badge} ${styles.badgeOk}` : styles.badge}>
                <Radio className={styles.iconSm} />
                {connectionStatus.toUpperCase()}
              </span>
              <ChevronDown className={`${styles.iconSm} ${styles.chevron} ${hudOpen ? styles.chevronOpen : ""}`} />
            </span>
          </button>
          {hudOpen && (
            <div id="lidar-globe-hud" className={styles.hudBody}>
              <div className={styles.hudGrid}>
                <span>LAT <b>{hud.lat.toFixed(4)}</b></span>
                <span>LNG <b>{hud.lng.toFixed(4)}</b></span>
                <span>ZOOM <b>{hud.zoom.toFixed(2)}</b></span>
                <span>PITCH <b>{hud.pitch.toFixed(0)}°</b></span>
                <span>BRG <b>{hud.bearing.toFixed(0)}°</b></span>
                <span>FPS <b className={styles.ok}>{hud.fps}</b></span>
                <span className={styles.span2}>
                  ELEV <b>{hud.elevation === null ? "—" : `${hud.elevation.toFixed(0)} m`}</b>
                </span>
                <span>
                  TILES <b className={hud.tilesLoaded ? styles.ok : styles.warn}>{hud.tilesLoaded ? "OK" : "LOAD"}</b>
                </span>
              </div>
              <div className={styles.meta}>
                PINS <b className={styles.cyan}>{vessels.length}</b> vessels • <b className={styles.red}>{anomalies.length}</b>{" "}
                anomalies • DC LIDAR <b className={insideDc ? styles.ok : styles.dim}>{insideDc ? "IN VIEW" : "OUT OF VIEW"}</b>
              </div>
            </div>
          )}
        </div>

        {selectedPin && (
          <div className={`${styles.glass} ${styles.pinCard}`} style={glassStyle}>
            <div className={styles.row}>
              <span className={styles.pinTitle}>
                <Crosshair className={`${styles.iconSm} ${styles.red}`} /> {selectedPin.title}
              </span>
              <button onClick={() => setSelectedPin(null)} className={styles.close} aria-label="Close">
                ✕
              </button>
            </div>
            {selectedPin.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div className={styles.note}>Telemetry feed overlay (/api/telemetry) — not derived from imagery or LiDAR.</div>
          </div>
        )}

        <div className={`${styles.glass} ${styles.dock}`} style={glassStyle}>
          <button onClick={() => setIsRotating((r) => !r)} className={pill(isRotating)} aria-label="Toggle rotation">
            {isRotating ? <Pause className={styles.iconSm} /> : <Play className={styles.iconSm} />}
            SPIN
          </button>
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => flyTo(p)} className={pill(false)}>
              {p.label}
            </button>
          ))}
          <button
            onClick={toggleFullscreen}
            className={`${pill(isFullscreen)} ${styles.pushRight}`}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className={styles.iconSm} /> : <Maximize2 className={styles.iconSm} />}
          </button>
        </div>

        {!isReady && !mapError && (
          <div className={styles.loading}>
            <Activity className={`${styles.icon} ${styles.pulse}`} /> Loading imagery & elevation tiles…
          </div>
        )}
      </div>

      <div className={styles.panels}>
        <div className={`${styles.glass} ${styles.panel}`} style={glassStyle}>
          <div className={styles.panelTitle}>
            <Layers className={styles.icon} /> DC 2024 LIDAR LAYER
          </div>
          <div className={styles.pillRow}>
            {DC_LIDAR_PRODUCTS.map((p) => (
              <button key={p.id} onClick={() => setLidarMode(p.id)} className={pill(lidarMode === p.id)} title={p.detail}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setLidarMode("off")} className={pill(lidarMode === "off")}>
              OFF
            </button>
          </div>
          <label className={styles.range}>
            <span>LIDAR OPACITY <b>{lidarOpacity}%</b></span>
            <input type="range" min={0} max={100} value={lidarOpacity} onChange={(e) => setLidarOpacity(Number(e.target.value))} />
          </label>
          <p className={styles.body}>
            USGS QL1 collection over the District, shown from zoom 11 inside DC. The publisher removed non-ground returns
            inside the Secret Service redaction boundary, so the White House itself shows ground only.
          </p>
        </div>

        <div className={`${styles.glass} ${styles.panel} ${styles.panelGreen}`} style={glassStyle}>
          <div className={styles.panelTitle}>
            <Eye className={styles.icon} /> TRANSPARENCY & LAYERS
          </div>
          <label className={styles.range}>
            <span>GLASS PANEL OPACITY <b>{glassOpacity}%</b></span>
            <input type="range" min={10} max={95} value={glassOpacity} onChange={(e) => setGlassOpacity(Number(e.target.value))} />
          </label>
          <div className={styles.pillRow}>
            <button onClick={() => setShowTerrain((v) => !v)} className={pill(showTerrain)}>
              <Mountain className={styles.iconSm} /> 3D TERRAIN
            </button>
            <button onClick={() => setShowHillshade((v) => !v)} className={pill(showHillshade)}>
              HILLSHADE
            </button>
            <button onClick={() => setShowBuildings((v) => !v)} className={pill(showBuildings)}>
              <Building2 className={styles.iconSm} /> BUILDINGS
            </button>
            <button onClick={() => setShowTelemetry((v) => !v)} className={pill(showTelemetry)}>
              <Radio className={styles.iconSm} /> TELEMETRY
            </button>
          </div>
          {mapError && <p className={`${styles.body} ${styles.warn}`}>Last tile error: {mapError}</p>}
        </div>

        <div className={`${styles.glass} ${styles.panel} ${styles.panelPurple}`} style={glassStyle}>
          <div className={styles.panelTitle}>
            <Globe className={styles.icon} /> DATA SOURCES
          </div>
          {GLOBE_SOURCES.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.source}>
              <div className={styles.sourceHead}>
                <span>{s.label}</span>
                <ExternalLink className={styles.iconSm} />
              </div>
              <div className={styles.sourceSub}>{s.provider}</div>
              <div className={styles.sourceDetail}>{s.detail}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
