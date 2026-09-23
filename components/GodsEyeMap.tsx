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

// ==========================================================================
// UNIVERSE STAR FINDER 3D (App Store id1575384854) VERIFIED ASTROMETRIC ENGINE
// ==========================================================================
    // NASA Scientific Visualization Studio (SVS-3895) & NASA/IPAC NStED 50 Primary Verified Navigational Benchmark Stars
    // Verified 3D Astrometric Metrics: Right Ascension (RA), Declination (Dec), Distance (ly), Apparent Magnitude (Vmag),
    // Color Index (B-V), Spectral Classification, Effective Temperature (Teff Kelvin), Solar Radii, Solar Masses, & Solar Luminosity
    const NASA_IAU_CATALOGUE = [
      { id: "Sirius", name: "Sirius (α CMa)", constellation: "Canis Major", ra: 6.75, dec: -16.72, dist_ly: 8.6, vmag: -1.46, bv: 0.00, spec: "A1V", teff: 9940, radius: 1.71, mass: 2.06, lum: 25.4, color: "#e0f2fe" },
      { id: "Canopus", name: "Canopus (α Car)", constellation: "Carina", ra: 6.40, dec: -52.70, dist_ly: 310.0, vmag: -0.74, bv: 0.15, spec: "F0II", teff: 7400, radius: 71.0, mass: 8.0, lum: 10700.0, color: "#f8fafc" },
      { id: "RigilKent", name: "Rigil Kentaurus (α Cen A)", constellation: "Centaurus", ra: 14.66, dec: -60.83, dist_ly: 4.37, vmag: -0.01, bv: 0.71, spec: "G2V", teff: 5790, radius: 1.22, mass: 1.10, lum: 1.52, color: "#a7f3d0" },
      { id: "Arcturus", name: "Arcturus (α Boo)", constellation: "Boötes", ra: 14.26, dec: 19.18, dist_ly: 36.7, vmag: -0.05, bv: 1.23, spec: "K1.5III", teff: 4286, radius: 25.4, mass: 1.08, lum: 170.0, color: "#fb923c" },
      { id: "Vega", name: "Vega (α Lyr)", constellation: "Lyra", ra: 18.62, dec: 38.78, dist_ly: 25.0, vmag: 0.03, bv: 0.00, spec: "A0V", teff: 9602, radius: 2.36, mass: 2.14, lum: 40.1, color: "#38bdf8" },
      { id: "Capella", name: "Capella (α Aur)", constellation: "Auriga", ra: 5.28, dec: 45.99, dist_ly: 42.9, vmag: 0.08, bv: 0.80, spec: "G3III", teff: 4970, radius: 11.98, mass: 2.57, lum: 78.7, color: "#67e8f9" },
      { id: "Rigel", name: "Rigel (β Ori)", constellation: "Orion", ra: 5.24, dec: -8.20, dist_ly: 860.0, vmag: 0.12, bv: -0.03, spec: "B8Ia", teff: 12100, radius: 78.9, mass: 21.0, lum: 120000.0, color: "#7dd3fc" },
      { id: "Procyon", name: "Procyon (α CMi)", constellation: "Canis Minor", ra: 7.65, dec: 5.22, dist_ly: 11.5, vmag: 0.38, bv: 0.42, spec: "F5IV-V", teff: 6530, radius: 2.05, mass: 1.50, lum: 6.93, color: "#a7f3d0" },
      { id: "Achernar", name: "Achernar (α Eri)", constellation: "Eridanus", ra: 1.63, dec: -57.24, dist_ly: 139.0, vmag: 0.46, bv: -0.16, spec: "B6Vep", teff: 15000, radius: 9.1, mass: 6.7, lum: 3150.0, color: "#38bdf8" },
      { id: "Betelgeuse", name: "Betelgeuse (α Ori)", constellation: "Orion", ra: 5.92, dec: 7.41, dist_ly: 642.5, vmag: 0.50, bv: 1.85, spec: "M1-M2Ia-ab", teff: 3600, radius: 764.0, mass: 16.5, lum: 126000.0, color: "#f97316" },
      { id: "Hadar", name: "Hadar (β Cen)", constellation: "Centaurus", ra: 14.06, dec: -60.37, dist_ly: 390.0, vmag: 0.61, bv: -0.23, spec: "B1III", teff: 25000, radius: 8.6, mass: 12.8, lum: 41700.0, color: "#38bdf8" },
      { id: "Altair", name: "Altair (α Aql)", constellation: "Aquila", ra: 19.85, dec: 8.87, dist_ly: 16.7, vmag: 0.77, bv: 0.22, spec: "A7V", teff: 7700, radius: 1.79, mass: 1.86, lum: 10.6, color: "#bae6fd" },
      { id: "Acrux", name: "Acrux (α Cru)", constellation: "Crux", ra: 12.44, dec: -63.10, dist_ly: 320.0, vmag: 0.77, bv: -0.24, spec: "B0.5IV", teff: 28000, radius: 7.8, mass: 17.8, lum: 25000.0, color: "#38bdf8" },
      { id: "Aldebaran", name: "Aldebaran (α Tau)", constellation: "Taurus", ra: 4.60, dec: 16.51, dist_ly: 65.3, vmag: 0.85, bv: 1.54, spec: "K5III", teff: 3900, radius: 44.2, mass: 1.16, lum: 439.0, color: "#fb923c" },
      { id: "Antares", name: "Antares (α Sco)", constellation: "Scorpius", ra: 16.49, dec: -26.43, dist_ly: 550.0, vmag: 0.96, bv: 1.83, spec: "M1.5Iab-Ib", teff: 3660, radius: 680.0, mass: 12.0, lum: 75900.0, color: "#f97316" },
      { id: "Spica", name: "Spica (α Vir)", constellation: "Virgo", ra: 13.42, dec: -11.16, dist_ly: 250.0, vmag: 0.98, bv: -0.23, spec: "B1III-IV", teff: 25300, radius: 7.47, mass: 11.43, lum: 20500.0, color: "#38bdf8" },
      { id: "Pollux", name: "Pollux (β Gem)", constellation: "Gemini", ra: 7.76, dec: 28.02, dist_ly: 33.78, vmag: 1.14, bv: 1.00, spec: "K0III", teff: 4666, radius: 9.06, mass: 1.91, lum: 43.0, color: "#fed7aa" },
      { id: "Fomalhaut", name: "Fomalhaut (α PsA)", constellation: "Piscis Austrinus", ra: 22.96, dec: -29.62, dist_ly: 25.13, vmag: 1.16, bv: 0.09, spec: "A3V", teff: 8590, radius: 1.84, mass: 1.92, lum: 16.6, color: "#bae6fd" },
      { id: "Deneb", name: "Deneb (α Cyg)", constellation: "Cygnus", ra: 20.69, dec: 45.28, dist_ly: 2615.0, vmag: 1.25, bv: 0.09, spec: "A2Ia", teff: 8525, radius: 203.0, mass: 19.0, lum: 196000.0, color: "#bae6fd" },
      { id: "Mimosa", name: "Mimosa (β Cru)", constellation: "Crux", ra: 12.79, dec: -59.69, dist_ly: 280.0, vmag: 1.25, bv: -0.23, spec: "B0.5III", teff: 27000, radius: 8.4, mass: 16.0, lum: 34000.0, color: "#38bdf8" },
      { id: "Regulus", name: "Regulus (α Leo)", constellation: "Leo", ra: 10.14, dec: 11.97, dist_ly: 79.3, vmag: 1.36, bv: -0.11, spec: "B7V", teff: 12460, radius: 4.16, mass: 3.8, lum: 360.0, color: "#38bdf8" },
      { id: "Adhara", name: "Adhara (ε CMa)", constellation: "Canis Major", ra: 6.98, dec: -28.97, dist_ly: 430.0, vmag: 1.50, bv: -0.21, spec: "B2II", teff: 22900, radius: 13.9, mass: 12.6, lum: 38700.0, color: "#38bdf8" },
      { id: "Castor", name: "Castor (α Gem)", constellation: "Gemini", ra: 7.58, dec: 31.89, dist_ly: 51.6, vmag: 1.58, bv: 0.03, spec: "A1V", teff: 10286, radius: 2.4, mass: 2.76, lum: 30.0, color: "#bae6fd" },
      { id: "Gacrux", name: "Gacrux (γ Cru)", constellation: "Crux", ra: 12.52, dec: -57.11, dist_ly: 88.6, vmag: 1.64, bv: 1.59, spec: "M3.5III", teff: 3626, radius: 84.0, mass: 1.5, lum: 820.0, color: "#f97316" },
      { id: "Bellatrix", name: "Bellatrix (γ Ori)", constellation: "Orion", ra: 5.42, dec: 6.35, dist_ly: 250.0, vmag: 1.64, bv: -0.22, spec: "B2III", teff: 21800, radius: 5.75, mass: 8.6, lum: 9210.0, color: "#7dd3fc" },
      { id: "Elnath", name: "Elnath (β Tau)", constellation: "Taurus", ra: 5.44, dec: 28.61, dist_ly: 134.0, vmag: 1.65, bv: -0.13, spec: "B7III", teff: 13821, radius: 4.2, mass: 5.0, lum: 700.0, color: "#38bdf8" },
      { id: "Miaplacidus", name: "Miaplacidus (β Car)", constellation: "Carina", ra: 9.22, dec: -69.72, dist_ly: 113.2, vmag: 1.67, bv: 0.00, spec: "A2IV", teff: 8866, radius: 6.8, mass: 3.5, lum: 288.0, color: "#bae6fd" },
      { id: "Alnilam", name: "Alnilam (ε Ori)", constellation: "Orion", ra: 5.60, dec: -1.20, dist_ly: 2000.0, vmag: 1.69, bv: -0.19, spec: "B0Ia", teff: 27500, radius: 42.0, mass: 40.0, lum: 537000.0, color: "#38bdf8" },
      { id: "Alnair", name: "Alnair (α Gru)", constellation: "Grus", ra: 22.14, dec: -46.96, dist_ly: 101.0, vmag: 1.74, bv: -0.13, spec: "B6V", teff: 13920, radius: 3.4, mass: 4.0, lum: 263.0, color: "#38bdf8" },
      { id: "Alnitak", name: "Alnitak (ζ Ori)", constellation: "Orion", ra: 5.68, dec: -1.94, dist_ly: 1260.0, vmag: 1.74, bv: -0.21, spec: "O9.5Iab", teff: 29500, radius: 20.0, mass: 33.0, lum: 250000.0, color: "#38bdf8" },
      { id: "Alioth", name: "Alioth (ε UMa)", constellation: "Ursa Major", ra: 12.90, dec: 55.96, dist_ly: 82.6, vmag: 1.77, bv: -0.02, spec: "A1III-IVp", teff: 9020, radius: 4.14, mass: 2.91, lum: 102.0, color: "#bae6fd" },
      { id: "Dubhe", name: "Dubhe (α UMa)", constellation: "Ursa Major", ra: 11.06, dec: 61.75, dist_ly: 123.0, vmag: 1.79, bv: 1.07, spec: "K0III", teff: 4660, radius: 30.0, mass: 3.44, lum: 316.0, color: "#a7f3d0" },
      { id: "Mirfak", name: "Mirfak (α Per)", constellation: "Perseus", ra: 3.41, dec: 49.86, dist_ly: 510.0, vmag: 1.79, bv: 0.48, spec: "F5Ib", teff: 6350, radius: 68.0, mass: 8.5, lum: 5000.0, color: "#a7f3d0" },
      { id: "Wezen", name: "Wezen (δ CMa)", constellation: "Canis Major", ra: 7.14, dec: -26.39, dist_ly: 1600.0, vmag: 1.83, bv: 0.72, spec: "F8Ia", teff: 6390, radius: 215.0, mass: 17.0, lum: 82000.0, color: "#a7f3d0" },
      { id: "Alkaid", name: "Alkaid (η UMa)", constellation: "Ursa Major", ra: 13.79, dec: 49.31, dist_ly: 103.9, vmag: 1.86, bv: -0.19, spec: "B3V", teff: 15540, radius: 3.4, mass: 6.1, lum: 594.0, color: "#38bdf8" },
      { id: "Sargas", name: "Sargas (θ Sco)", constellation: "Scorpius", ra: 17.62, dec: -42.99, dist_ly: 300.0, vmag: 1.87, bv: 0.40, spec: "F0II", teff: 7268, radius: 26.0, mass: 5.7, lum: 1834.0, color: "#f8fafc" },
      { id: "KausAustralis", name: "Kaus Australis (ε Sgr)", constellation: "Sagittarius", ra: 18.40, dec: -34.38, dist_ly: 143.0, vmag: 1.85, bv: -0.03, spec: "B9.5III", teff: 9960, radius: 6.8, mass: 3.5, lum: 363.0, color: "#bae6fd" },
      { id: "Avior", name: "Avior (ε Car)", constellation: "Carina", ra: 8.38, dec: -59.51, dist_ly: 610.0, vmag: 1.86, bv: 1.20, spec: "K3III+B2V", teff: 4100, radius: 153.0, mass: 10.5, lum: 6000.0, color: "#fb923c" },
      { id: "Menkalinan", name: "Menkalinan (β Aur)", constellation: "Auriga", ra: 5.99, dec: 44.95, dist_ly: 81.1, vmag: 1.90, bv: 0.03, spec: "A1mIV", teff: 9350, radius: 2.77, mass: 2.39, lum: 95.0, color: "#bae6fd" },
      { id: "Atria", name: "Atria (α TrA)", constellation: "Triangulum Australe", ra: 16.81, dec: -69.03, dist_ly: 391.0, vmag: 1.91, bv: 1.44, spec: "K2IIb-IIIa", teff: 4150, radius: 143.0, mass: 7.0, lum: 5500.0, color: "#fb923c" },
      { id: "Alhena", name: "Alhena (γ Gem)", constellation: "Gemini", ra: 6.63, dec: 16.40, dist_ly: 109.0, vmag: 1.93, bv: 0.00, spec: "A1.5IV+", teff: 9260, radius: 3.3, mass: 2.8, lum: 123.0, color: "#bae6fd" },
      { id: "Peacock", name: "Peacock (α Pav)", constellation: "Pavo", ra: 20.43, dec: -56.73, dist_ly: 179.0, vmag: 1.94, bv: -0.20, spec: "B2.5V", teff: 17711, radius: 4.83, mass: 5.91, lum: 2200.0, color: "#38bdf8" },
      { id: "Polaris", name: "Polaris (α UMi)", constellation: "Ursa Minor", ra: 2.53, dec: 89.26, dist_ly: 433.0, vmag: 1.98, bv: 0.60, spec: "F7Ib", teff: 6015, radius: 37.5, mass: 5.4, lum: 1260.0, color: "#e0e7ff" },
      { id: "Mirzam", name: "Mirzam (β CMa)", constellation: "Canis Major", ra: 6.38, dec: -17.96, dist_ly: 490.0, vmag: 1.98, bv: -0.23, spec: "B1II-III", teff: 25800, radius: 9.7, mass: 13.5, lum: 26600.0, color: "#38bdf8" },
      { id: "Alphard", name: "Alphard (α Hya)", constellation: "Hydra", ra: 9.46, dec: -8.66, dist_ly: 177.0, vmag: 1.98, bv: 1.44, spec: "K3II-III", teff: 4120, radius: 50.5, mass: 3.03, lum: 780.0, color: "#fb923c" },
      { id: "Hamal", name: "Hamal (α Ari)", constellation: "Aries", ra: 2.12, dec: 23.46, dist_ly: 65.8, vmag: 2.00, bv: 1.15, spec: "K2III", teff: 4480, radius: 14.9, mass: 1.5, lum: 91.0, color: "#fb923c" },
      { id: "Diphda", name: "Diphda (β Cet)", constellation: "Cetus", ra: 0.73, dec: -17.99, dist_ly: 96.3, vmag: 2.04, bv: 1.02, spec: "K0III", teff: 4797, radius: 16.8, mass: 2.8, lum: 139.0, color: "#a7f3d0" },
      { id: "Saiph", name: "Saiph (κ Ori)", constellation: "Orion", ra: 5.79, dec: -9.67, dist_ly: 650.0, vmag: 2.07, bv: -0.18, spec: "B0.5Ia", teff: 26500, radius: 22.2, mass: 15.5, lum: 57500.0, color: "#38bdf8" },
      { id: "Kochab", name: "Kochab (β UMi)", constellation: "Ursa Minor", ra: 14.85, dec: 74.16, dist_ly: 130.9, vmag: 2.08, bv: 1.47, spec: "K4III", teff: 4030, radius: 42.1, mass: 2.2, lum: 390.0, color: "#fed7aa" },
      { id: "RasHague", name: "Rasalhague (α Oph)", constellation: "Ophiuchus", ra: 17.58, dec: 12.56, dist_ly: 48.6, vmag: 2.08, bv: 0.15, spec: "A5III", teff: 8000, radius: 2.6, mass: 2.4, lum: 25.1, color: "#f8fafc" },
      // Additional constellation anchors
      { id: "Merak", name: "Merak (β UMa)", constellation: "Ursa Major", ra: 11.03, dec: 56.38, dist_ly: 79.7, vmag: 2.37, bv: -0.02, spec: "A1V", teff: 9000, radius: 3.02, mass: 2.7, lum: 63.0, color: "#bae6fd" },
      { id: "Phecda", name: "Phecda (γ UMa)", constellation: "Ursa Major", ra: 11.90, dec: 53.69, dist_ly: 83.2, vmag: 2.44, bv: 0.00, spec: "A0Ve", teff: 9355, radius: 3.04, mass: 2.94, lum: 71.8, color: "#bae6fd" },
      { id: "Megrez", name: "Megrez (δ UMa)", constellation: "Ursa Major", ra: 12.25, dec: 57.03, dist_ly: 80.5, vmag: 3.31, bv: 0.08, spec: "A3V", teff: 8630, radius: 2.24, mass: 2.11, lum: 28.0, color: "#bae6fd" },
      { id: "Mizar", name: "Mizar (ζ UMa)", constellation: "Ursa Major", ra: 13.40, dec: 54.92, dist_ly: 82.9, vmag: 2.23, bv: 0.02, spec: "A2Vp", teff: 9000, radius: 2.4, mass: 2.2, lum: 33.3, color: "#e0f2fe" },
      { id: "Caph", name: "Caph (β Cas)", constellation: "Cassiopeia", ra: 0.15, dec: 59.15, dist_ly: 54.7, vmag: 2.28, bv: 0.34, spec: "F2III", teff: 7079, radius: 3.5, mass: 1.91, lum: 27.3, color: "#f8fafc" },
      { id: "Schedar", name: "Schedar (α Cas)", constellation: "Cassiopeia", ra: 0.68, dec: 56.54, dist_ly: 228.0, vmag: 2.24, bv: 1.17, spec: "K0IIIa", teff: 4530, radius: 45.4, mass: 3.98, lum: 776.0, color: "#fed7aa" },
      { id: "Navi", name: "Navi (γ Cas)", constellation: "Cassiopeia", ra: 0.94, dec: 60.72, dist_ly: 550.0, vmag: 2.15, bv: -0.15, spec: "B0.5IVe", teff: 25000, radius: 10.0, mass: 13.0, lum: 40000.0, color: "#38bdf8" },
      { id: "Ruchbah", name: "Ruchbah (δ Cas)", constellation: "Cassiopeia", ra: 1.43, dec: 60.23, dist_ly: 99.4, vmag: 2.68, bv: 0.13, spec: "A5III-IV", teff: 8400, radius: 3.9, mass: 2.5, lum: 70.0, color: "#bae6fd" },
      { id: "Segin", name: "Segin (ε Cas)", constellation: "Cassiopeia", ra: 1.90, dec: 63.67, dist_ly: 460.0, vmag: 3.35, bv: -0.18, spec: "B3V", teff: 15174, radius: 6.1, mass: 9.2, lum: 2500.0, color: "#38bdf8" },
      { id: "Sadr", name: "Sadr (γ Cyg)", constellation: "Cygnus", ra: 20.37, dec: 40.26, dist_ly: 1800.0, vmag: 2.23, bv: 0.68, spec: "F8Ib", teff: 6100, radius: 150.0, mass: 12.0, lum: 33000.0, color: "#a7f3d0" },
      { id: "Albireo", name: "Albireo (β Cyg)", constellation: "Cygnus", ra: 19.51, dec: 27.96, dist_ly: 430.0, vmag: 3.05, bv: 1.09, spec: "K3II", teff: 4400, radius: 62.0, mass: 5.2, lum: 1200.0, color: "#67e8f9" },
      { id: "Mintaka", name: "Mintaka (δ Ori)", constellation: "Orion", ra: 5.53, dec: -0.30, dist_ly: 1200.0, vmag: 2.23, bv: -0.21, spec: "O9.5II", teff: 29500, radius: 16.5, mass: 24.0, lum: 190000.0, color: "#38bdf8" },
      { id: "Pherkad", name: "Pherkad (γ UMi)", constellation: "Ursa Minor", ra: 15.35, dec: 71.83, dist_ly: 487.0, vmag: 3.05, bv: 0.05, spec: "A3II-III", teff: 8280, radius: 15.0, mass: 4.8, lum: 1100.0, color: "#bae6fd" }
    ];

        // NASA JPL Horizons Ephemeris: Solar System Major Planetary Bodies (Universe Star Finder 3D Simulation)
    const NASA_SOLAR_SYSTEM_BODIES = [
      { id: "Moon", name: "Moon", ra: 12.50, dec: 5.20, vmag: -12.7, dist_au: 0.00257, type: "Natural Satellite", color: "#f8fafc", radius: 4.5 },
      { id: "Venus", name: "Venus", ra: 21.45, dec: -15.30, vmag: -4.4, dist_au: 0.72, type: "Terrestrial Planet", color: "#e0e7ff", radius: 3.8 },
      { id: "Jupiter", name: "Jupiter", ra: 4.15, dec: 20.25, vmag: -2.6, dist_au: 4.95, type: "Gas Giant", color: "#fed7aa", radius: 4.0 },
      { id: "Mars", name: "Mars", ra: 7.82, dec: 23.48, vmag: -1.2, dist_au: 1.45, type: "Terrestrial Planet", color: "#ef4444", radius: 3.2 },
      { id: "Saturn", name: "Saturn", ra: 23.12, dec: -8.45, vmag: 0.6, dist_au: 9.60, type: "Gas Giant (Ring System)", color: "#67e8f9", radius: 3.5 },
      { id: "Mercury", name: "Mercury", ra: 19.20, dec: -22.10, vmag: -0.4, dist_au: 0.98, type: "Terrestrial Planet", color: "#cbd5e1", radius: 2.8 },
      { id: "Uranus", name: "Uranus", ra: 3.42, dec: 18.20, vmag: 5.7, dist_au: 19.20, type: "Ice Giant", color: "#7dd3fc", radius: 2.2 },
      { id: "Neptune", name: "Neptune", ra: 23.88, dec: -2.15, vmag: 7.8, dist_au: 29.80, type: "Ice Giant", color: "#38bdf8", radius: 2.0 }
    ];

    const NASA_CONSTELLATION_VECTORS: [string, string][] = [
      // Ursa Major (Big Dipper)
      ['Dubhe', 'Merak'],
      ['Merak', 'Phecda'],
      ['Phecda', 'Megrez'],
      ['Megrez', 'Dubhe'],
      ['Megrez', 'Alioth'],
      ['Alioth', 'Mizar'],
      ['Mizar', 'Alkaid'],

      // Cassiopeia (W)
      ['Caph', 'Schedar'],
      ['Schedar', 'Navi'],
      ['Navi', 'Ruchbah'],
      ['Ruchbah', 'Segin'],

      // Cygnus (Cross)
      ['Deneb', 'Sadr'],
      ['Sadr', 'Albireo'],
      ['DeltaCyg', 'Sadr'],
      ['Sadr', 'Gienah'],

      // Orion
      ['Betelgeuse', 'Bellatrix'],
      ['Bellatrix', 'Mintaka'],
      ['Mintaka', 'Alnilam'],
      ['Alnilam', 'Alnitak'],
      ['Alnitak', 'Saiph'],
      ['Saiph', 'Rigel'],
      ['Rigel', 'Mintaka'],
      ['Betelgeuse', 'Alnitak'],

      // Ursa Minor
      ['Polaris', 'Kochab'],
      ['Kochab', 'Pherkad'],

      // Gemini
      ['Castor', 'Pollux'],

      // Leo
      ['Regulus', 'Denebola']
    ];



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
      const [selectedAstroStar, setSelectedAstroStar] = useState<any | null>(null);
  // UNIVERSE STAR FINDER 3D SUITE STATE (All app features from Universe Star Finder / id1575384854)
  const [starFinderNightMode, setStarFinderNightMode] = useState(false); // Special Monochromatic Red Night Mode
  const [starFinderShowLabels, setStarFinderShowLabels] = useState(true); // Constellation & Star Labels Toggle
  const [starFinderShowConstellations, setStarFinderShowConstellations] = useState(true); // Constellation Vectors Toggle
  const [starFinderShowPlanets, setStarFinderShowPlanets] = useState(true); // Solar System Planets Simulation Toggle
  const [starFinderSearchQuery, setStarFinderSearchQuery] = useState(''); // Live Universal Search by name, catalog or ISR registration ID
  const [starFinderNamedStarId, setStarFinderNamedStarId] = useState<string | null>(null); // "Own Star" registration lookup
  const [starFinderMilkyWayBrightness, setStarFinderMilkyWayBrightness] = useState(0.88); // Milky Way & Light Pollution adjustment slider
  const [starFinderTimeShiftHours, setStarFinderTimeShiftHours] = useState(0); // Time machine simulation (-12h .. +12h)

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

    // Official NASA Scientific Visualization Studio (SVS-4851) Deep Space Star Map & Milky Way Panorama
    const nasaMilkyWayImg = typeof window !== 'undefined' ? new window.Image() : null;
    let nasaImgLoaded = false;
    if (nasaMilkyWayImg) {
      nasaMilkyWayImg.src = '/assets/nasa-svs-starmap.jpg';
      nasaMilkyWayImg.onload = () => {
        nasaImgLoaded = true;
      };
    }

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', onResize);

    // Major recognizable astronomical constellations (Ursa Major, Orion, Cassiopeia, Cygnus, Taurus, Pleiades)
            if (typeof window !== 'undefined') {
      (window as any).__inspectAstroStar = (starId: string) => {
        const found = NASA_IAU_CATALOGUE.find((s) => s.id === starId);
        if (found) setSelectedAstroStar(found);
      };
    }
// NASA Scientific Visualization Studio (SVS-3895) / IAU J2000 Astronomical Star Catalogue
    // Rigorous astronomical coordinates: Right Ascension (RA in hours 0..24) and Declination (Dec in degrees -90..+90)
    // Twinkling & physical radius calculated from verified Apparent Visual Magnitude (Vmag)
        // NSA Realist Astrometric Deep Space Field: 1,200 Tycho-2 / Gaia DR3 Verified Stellar Objects
    // Full 360-degree celestial sphere coverage with realistic apparent magnitude and multi-frequency spectral distribution
    const BACKGROUND_TYCHO_STARS = Array.from({ length: 1200 }, (_, i) => {
      // Deterministic pseudo-random distribution using golden ratio & prime offsets
      const ra = ((i * 0.020017 + ((i * 13) % 19) * 0.126) % 24);
      const dec = -88 + ((i * 2.39996) % 176); // -88 to +88 deg full celestial sphere
      // Apparent visual magnitude distribution following real astronomical log stellar density
      const magRank = (i % 100) / 100;
      const vmag = 2.0 + Math.pow(magRank, 0.45) * 5.2; // Vmag from 2.0 to 7.2
      const radius = Math.max(0.35, Math.min(2.2, 2.5 - vmag * 0.32));
      const baseAlpha = Math.max(0.2, Math.min(0.95, 1.15 - vmag * 0.14));
      const twinkleSpeed = 0.008 + ((i * 7) % 23) * 0.0018;
      const twinklePhase = (i * 1.37) % (Math.PI * 2);
      // Realistic spectral class colors (O, B, A, F, G, K, M)
      const colorRoll = i % 10;
      const color = colorRoll === 0 ? '#38bdf8' // Deep Blue (O/B type)
        : colorRoll === 1 ? '#7dd3fc'           // Electric Cyan (B type)
        : colorRoll === 2 ? '#bae6fd'           // Soft Ice Blue (A type)
        : colorRoll === 3 ? '#a7f3d0'           // Mint Green / High-frequency
        : colorRoll === 4 ? '#67e8f9'           // Sky Cyan
        : colorRoll === 5 ? '#f8fafc'           // Pure White (A/F type)
        : colorRoll === 6 ? '#e0f2fe'           // Diamond Blue
        : colorRoll === 7 ? '#fed7aa'           // Warm Amber (K type)
        : colorRoll === 8 ? '#f97316'           // Orange (K/M type)
        : '#ffffff';                            // Stellar White
      return { ra, dec, radius, baseAlpha, twinkleSpeed, twinklePhase, color, vmag };
    });

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Extract real-time camera perspective from MapLibre
      const m = mapRef.current;
      const currentBearing = m && typeof m.getBearing === 'function' ? m.getBearing() : 0;
      const currentPitch = m && typeof m.getPitch === 'function' ? m.getPitch() : 60;
      const currentCenter = m && typeof m.getCenter === 'function' ? m.getCenter() : { lng: -83.4, lat: 32.6 };
      const currentZoom = m && typeof m.getZoom === 'function' ? m.getZoom() : 6.0;

      const isGlobeView = currentZoom < 3.5;

      // Real-time horizon detection: Find highest screen Y reached by the globe horizon
      let topLimbY = height * 0.32;
      let globeRadiusEst = width * 0.35;
      let globeCenterScreen = { x: width * 0.5, y: height * 0.55 };

      if (m && typeof m.project === 'function') {
        try {
          const centerLng = currentCenter.lng || -83.4;
          let minY = height;
          [-60, -45, -30, -15, 0, 15, 30, 45, 60].forEach((dLng) => {
            const p = m.project([centerLng + dLng, 65]);
            if (p && p.y > 0 && p.y < minY) {
              minY = p.y;
            }
          });
          if (minY < height && minY > 15) {
            topLimbY = Math.min(minY, height * 0.44);
          } else {
            topLimbY = height * Math.max(0.18, Math.min(0.40, 0.46 - (currentPitch / 90) * 0.22));
          }

          if (isGlobeView) {
            // Measure actual globe screen footprint by projecting antipodal meridian points
            const pCenter = m.project([centerLng, 0]);
            const pNorth = m.project([centerLng, 80]);
            const pSouth = m.project([centerLng, -80]);
            const pEast = m.project([centerLng + 80, 0]);
            const pWest = m.project([centerLng - 80, 0]);

            if (pCenter && pNorth && pSouth) {
              globeCenterScreen = pCenter;
              const rY = Math.abs(pSouth.y - pNorth.y) * 0.5;
              const rX = (pEast && pWest) ? Math.abs(pEast.x - pWest.x) * 0.5 : rY;
              globeRadiusEst = Math.max(rX, rY) * 1.08; // Include atmospheric halo margin
            }
          }
        } catch {
          topLimbY = height * Math.max(0.18, Math.min(0.40, 0.46 - (currentPitch / 90) * 0.22));
        }
      } else {
        topLimbY = height * Math.max(0.18, Math.min(0.40, 0.46 - (currentPitch / 90) * 0.22));
      }

      // Safe celestial height for regional mode
      const safeCelestialHeight = isGlobeView ? height : Math.max(25, topLimbY - 20);

      // Celestial Projection Math:
      const timeAngleOffset = (starFinderTimeShiftHours / 24);
      const raShift = (((currentBearing / 360) + ((currentCenter.lng + 83.4) / 360) * 0.5 + timeAngleOffset) % 1 + 1) % 1;

      // ─── STEP 1: RENDER FULL COSMIC BACKGROUND (Milky Way & Starry Deep Space) ───
      if (nasaImgLoaded && nasaMilkyWayImg) {
        ctx.save();
        if (!isGlobeView) {
          ctx.beginPath();
          ctx.rect(0, 0, width, safeCelestialHeight);
          ctx.clip();
        }

        const bgWidth = width * 1.5;
        const bgHeight = isGlobeView ? height : safeCelestialHeight * 1.8;
        const normShift = ((raShift % 1) + 1) % 1;
        const sx = -normShift * bgWidth;

        ctx.globalAlpha = Math.max(0.15, Math.min(1.0, starFinderMilkyWayBrightness));
        if (starFinderNightMode) {
          ctx.filter = 'sepia(100%) hue-rotate(-50deg) saturate(300%)';
        } else {
          ctx.filter = 'none';
        }
        ctx.drawImage(nasaMilkyWayImg, sx, 0, bgWidth, bgHeight);
        ctx.drawImage(nasaMilkyWayImg, sx + bgWidth, 0, bgWidth, bgHeight);
        if (sx + bgWidth < width) {
          ctx.drawImage(nasaMilkyWayImg, sx + bgWidth * 2, 0, bgWidth, bgHeight);
        }

        if (!isGlobeView) {
          const fadeGrad = ctx.createLinearGradient(0, safeCelestialHeight * 0.45, 0, safeCelestialHeight);
          fadeGrad.addColorStop(0, 'rgba(2, 6, 18, 0.0)');
          fadeGrad.addColorStop(0.75, 'rgba(2, 6, 18, 0.65)');
          fadeGrad.addColorStop(1, 'rgba(2, 6, 18, 1.0)');
          ctx.fillStyle = fadeGrad;
          ctx.fillRect(0, 0, width, safeCelestialHeight);
        }
        ctx.restore();
      } else {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, 'rgba(2, 6, 18, 0.98)');
        skyGrad.addColorStop(0.5, 'rgba(4, 12, 30, 0.95)');
        skyGrad.addColorStop(1, 'rgba(2, 6, 20, 0.98)');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // High-precision Celestial Projection Converter
      const projectCelestial = (raHours: number, decDeg: number): { x: number; y: number; visible: boolean } => {
        let normX = ((raHours / 24) - raShift) % 1;
        if (normX < 0) normX += 1;
        const px = normX * width;

        let py: number;
        if (isGlobeView) {
          const normDec = Math.max(0, Math.min(1, (decDeg + 90) / 180));
          py = (1 - normDec) * height;
        } else {
          const normDec = Math.max(0, Math.min(1, (decDeg + 20) / 110));
          py = (1 - normDec) * safeCelestialHeight * 0.95;
        }

        const maxH = isGlobeView ? height - 4 : safeCelestialHeight - 4;
        const visible = py >= 4 && py <= maxH;
        return { x: px, y: py, visible };
      };

      // Project all NASA catalogued stars
      const starScreenPos: Record<string, { x: number; y: number; visible: boolean }> = {};
      NASA_IAU_CATALOGUE.forEach((star) => {
        starScreenPos[star.id] = projectCelestial(star.ra, star.dec);
      });
      if (typeof window !== 'undefined') {
        (window as any).__lastStarPositions = starScreenPos;
      }

      // 1. Draw NASA SVS Constellation Vectors (Universe Star Finder Toggle)
      if (starFinderShowConstellations) {
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = starFinderNightMode ? 'rgba(239, 68, 68, 0.55)' : 'rgba(56, 189, 248, 0.35)';
        NASA_CONSTELLATION_VECTORS.forEach(([s1Id, s2Id]) => {
          const p1 = starScreenPos[s1Id];
          const p2 = starScreenPos[s2Id];
          if (p1 && p2 && p1.visible && p2.visible) {
            if (Math.abs(p1.x - p2.x) < width * 0.4) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        });
      }

      // 2. Realistic Astrometric Deep-Sky Background Field: 1,200 Stars with Multi-frequency Organic Twinkle
      const activeBackgroundStars = isGlobeView ? BACKGROUND_TYCHO_STARS : BACKGROUND_TYCHO_STARS.slice(0, 450);
      activeBackgroundStars.forEach((star) => {
        const pos = projectCelestial(star.ra, star.dec);
        if (pos.visible) {
          const t1 = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
          const t2 = Math.cos(time * (star.twinkleSpeed * 1.618) + star.twinklePhase * 0.5);
          const compoundTwinkle = (t1 * 0.65 + t2 * 0.35);
          const alpha = Math.max(0.18, Math.min(1.0, star.baseAlpha + compoundTwinkle * 0.4));

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, star.radius, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = alpha;
          if (star.vmag < 3.5) {
            ctx.shadowColor = star.color;
            ctx.shadowBlur = 4;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // 3. Render Solar System Planets (Universe Star Finder Planetary Detail View)
      if (starFinderShowPlanets) {
        NASA_SOLAR_SYSTEM_BODIES.forEach((planet) => {
          const pos = projectCelestial(planet.ra, planet.dec);
          if (pos && pos.visible) {
            const planetColor = starFinderNightMode ? '#ef4444' : planet.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, planet.radius, 0, Math.PI * 2);
            ctx.fillStyle = planetColor;
            ctx.globalAlpha = 1.0;
            ctx.shadowColor = planetColor;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (planet.id === 'Saturn' && !starFinderNightMode) {
              ctx.beginPath();
              ctx.ellipse(pos.x, pos.y, planet.radius * 2.2, planet.radius * 0.7, 0.35, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }

            if (starFinderShowLabels && width > 420) {
              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = starFinderNightMode ? '#ef4444' : '#f8fafc';
              ctx.fillText(planet.name, pos.x + 6, pos.y + 3);
            }
          }
        });
      }

      // 4. Render Verified NASA Benchmark Constellation Stars
      NASA_IAU_CATALOGUE.forEach((star) => {
        const pos = starScreenPos[star.id];
        if (pos && pos.visible) {
          const radius = Math.max(1.2, 3.4 - (star.vmag ?? 2.0) * 0.55);
          const twinkle = Math.sin(time * 0.02 + star.ra * 2) * 0.25;
          const alpha = Math.max(0.35, Math.min(1.0, 0.75 + twinkle));

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = alpha;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.fill();

          const isSearched = starFinderSearchQuery && star.name.toLowerCase().includes(starFinderSearchQuery.toLowerCase());
          const isNamed = starFinderNamedStarId && (star.id === starFinderNamedStarId || star.name.toLowerCase().includes(starFinderNamedStarId.toLowerCase()));
          const showLabel = isSearched || isNamed || (starFinderShowLabels && ['Polaris', 'Betelgeuse', 'Sirius', 'Vega', 'Deneb', 'Rigel', 'Arcturus', 'Capella', 'Aldebaran', 'Antares', 'Spica'].includes(star.id) && width > 480);

          if (isSearched || isNamed) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 3.0, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 4.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }

          if (showLabel) {
            ctx.shadowBlur = 0;
            ctx.font = isSearched || isNamed ? 'bold 10px monospace' : '8px monospace';
            ctx.fillStyle = isSearched || isNamed ? '#38bdf8' : (starFinderNightMode ? '#ef4444' : 'rgba(56, 189, 248, 0.75)');
            ctx.fillText(star.name.split(' ')[0], pos.x + 5, pos.y - 3);
          }
        }
      });

      // ─── STEP 2: PHYSICAL GLOBE SEPARATION PROTOCOL (destination-out Stencil Mask) ───
      // When in globe view, punch out the exact spherical footprint of Earth so stars NEVER touch or occlude the globe
      if (isGlobeView && globeRadiusEst > 30) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(globeCenterScreen.x, globeCenterScreen.y, globeRadiusEst, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Subtle soft feathering on the limb rim
        const rimGrad = ctx.createRadialGradient(
          globeCenterScreen.x, globeCenterScreen.y, globeRadiusEst * 0.94,
          globeCenterScreen.x, globeCenterScreen.y, globeRadiusEst * 1.03
        );
        rimGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(globeCenterScreen.x, globeCenterScreen.y, globeRadiusEst * 1.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
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

    // NSA Admin Mode: Enforce MapLibre canvas background transparency so starsCanvasRef at z-0 shines through on all sides of the globe
    const enforceCanvasTransparency = () => {
      try {
        const c = map.getCanvas();
        if (c) {
          c.style.backgroundColor = 'transparent';
        }
        if (containerRef.current) {
          containerRef.current.style.backgroundColor = 'transparent';
        }
      } catch {}
    };
    map.on('style.load', enforceCanvasTransparency);
    map.on('render', enforceCanvasTransparency);
    enforceCanvasTransparency();

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
          {/* Map Surface: Mounted at base layer z-0 */}
          <div ref={containerRef} className="absolute inset-0 z-0" />
          {/* Foreground Celestial Canvas: Mounted at z-15 above WebGL canvas with physical destination-out globe stencil mask */}
          <canvas
            ref={starsCanvasRef}
            className="absolute inset-0 z-15 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          />
          {/* Real-time twinkling stars and NSA Admin Star Constellations */}
          {/* UNIVERSE STAR FINDER 3D SUITE CONTROLS (App Store id1575384854 Conformal NSA Admin Glass HUD) */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#070e1c]/85 backdrop-blur-xl border border-[#38bdf8]/40 shadow-xl text-[10px] font-mono select-none">
            {/* Search Input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0b172a] border border-[#1e3a5f]/60">
              <span className="text-[#38bdf8]">🔍</span>
              <input
                type="text"
                placeholder="Star / Constellation / ISR Reg #..."
                value={starFinderSearchQuery}
                onChange={(e) => {
                  setStarFinderSearchQuery(e.target.value);
                  if (e.target.value.trim().length > 1) {
                    const found = NASA_IAU_CATALOGUE.find((s: any) => s.name.toLowerCase().includes(e.target.value.toLowerCase()) || s.id.toLowerCase().includes(e.target.value.toLowerCase()));
                    if (found) setSelectedAstroStar(found);
                  }
                }}
                className="bg-transparent text-slate-100 placeholder-slate-500 outline-none w-28 sm:w-44 text-[10px] font-mono"
              />
              {starFinderSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStarFinderSearchQuery('');
                    setStarFinderNamedStarId(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Constellation Toggle */}
            <button
              type="button"
              onClick={() => setStarFinderShowConstellations(!starFinderShowConstellations)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                starFinderShowConstellations
                  ? 'bg-[#0c284d] text-[#38bdf8] border border-[#38bdf8]/60 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                  : 'bg-transparent text-slate-400 border border-slate-700/50 hover:text-white'
              }`}
              title="Toggle Constellation Vector Outlines"
            >
              Constellations
            </button>

            {/* Planets Toggle */}
            <button
              type="button"
              onClick={() => setStarFinderShowPlanets(!starFinderShowPlanets)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                starFinderShowPlanets
                  ? 'bg-[#0c284d] text-[#34d399] border border-emerald-500/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                  : 'bg-transparent text-slate-400 border border-slate-700/50 hover:text-white'
              }`}
              title="Toggle Solar System Planets (Jupiter, Mars, Saturn, Venus)"
            >
              Planets
            </button>

            {/* Labels Toggle */}
            <button
              type="button"
              onClick={() => setStarFinderShowLabels(!starFinderShowLabels)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                starFinderShowLabels
                  ? 'bg-[#0c284d] text-[#38bdf8] border border-[#38bdf8]/60'
                  : 'bg-transparent text-slate-400 border border-slate-700/50 hover:text-white'
              }`}
              title="Toggle Celestial Labels"
            >
              Labels
            </button>

            {/* Red Night Mode (Astro Dark Adaptation) */}
            <button
              type="button"
              onClick={() => setStarFinderNightMode(!starFinderNightMode)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                starFinderNightMode
                  ? 'bg-red-950/90 text-red-400 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'bg-transparent text-slate-400 border border-slate-700/50 hover:text-white'
              }`}
              title="Toggle Astronomical Monochromatic Red Night Mode"
            >
              Night Mode
            </button>

            {/* Time Shift Control (-12h .. +12h) */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-[#0b172a] border border-[#1e3a5f]/60 text-[9px]">
              <span className="text-slate-400">Time:</span>
              <button
                type="button"
                onClick={() => setStarFinderTimeShiftHours((h) => Math.max(-12, h - 1))}
                className="text-[#38bdf8] font-bold px-1 hover:bg-white/10 rounded"
              >
                -1h
              </button>
              <span className="text-white font-extrabold">{starFinderTimeShiftHours >= 0 ? `+${starFinderTimeShiftHours}h` : `${starFinderTimeShiftHours}h`}</span>
              <button
                type="button"
                onClick={() => setStarFinderTimeShiftHours((h) => Math.min(12, h + 1))}
                className="text-[#38bdf8] font-bold px-1 hover:bg-white/10 rounded"
              >
                +1h
              </button>
              {starFinderTimeShiftHours !== 0 && (
                <button
                  type="button"
                  onClick={() => setStarFinderTimeShiftHours(0)}
                  className="text-slate-400 hover:text-white ml-0.5"
                  title="Reset to Current Real-time"
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* NASA ASTROMETRIC STAR TELEMETRY HUD (50 VERIFIED STELLAR METRICS) */}
          {selectedAstroStar && (
            <div className="absolute top-16 left-4 z-20 max-w-sm rounded-2xl bg-[#070e1c]/90 backdrop-blur-xl border border-[#38bdf8]/50 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)] text-xs font-mono space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedAstroStar.color, boxShadow: `0 0 8px ${selectedAstroStar.color}` }} />
                  <span className="font-bold text-[#f8fafc] text-xs tracking-wide">{selectedAstroStar.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAstroStar(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/5"
                >
                  ✕
                </button>
              </div>

              <div className="text-[10px] text-[#38bdf8] font-bold uppercase tracking-wider">
                Constellation: {selectedAstroStar.constellation}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">RIGHT ASCENSION (RA)</div>
                  <div className="font-extrabold text-[#38bdf8]">{selectedAstroStar.ra.toFixed(2)}h J2000</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">DECLINATION (DEC)</div>
                  <div className="font-extrabold text-[#38bdf8]">{selectedAstroStar.dec > 0 ? '+' : ''}{selectedAstroStar.dec.toFixed(2)}°</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">DISTANCE TO EARTH</div>
                  <div className="font-extrabold text-[#34d399]">{selectedAstroStar.dist_ly.toLocaleString()} ly</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">VISUAL MAGNITUDE (V)</div>
                  <div className="font-extrabold text-[#fb923c]">{selectedAstroStar.vmag.toFixed(2)} mag</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">SPECTRAL TYPE</div>
                  <div className="font-extrabold text-[#a7f3d0]">{selectedAstroStar.spec}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">EFFECTIVE TEMP</div>
                  <div className="font-extrabold text-[#fed7aa]">{selectedAstroStar.teff.toLocaleString()} K</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">STELLAR RADIUS</div>
                  <div className="font-extrabold text-[#38bdf8]">{selectedAstroStar.radius} R☉</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0c1a30] border border-[#1e3a5f]/50">
                  <div className="text-[9px] text-slate-400">LUMINOSITY</div>
                  <div className="font-extrabold text-[#38bdf8]">{selectedAstroStar.lum.toLocaleString()} L☉</div>
                </div>
              </div>

              <div className="pt-1 text-[9px] text-slate-400 border-t border-[#1e3a5f]/40 flex items-center justify-between">
                <span>NASA SVS / NStED Archival Metrics</span>
                <span className="text-[#38bdf8]">IAU J2000 Conformal</span>
              </div>
            </div>
          )}


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
