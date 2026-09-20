import { create } from 'zustand';

export interface LiveVesselData {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  speedKnots: number;
  courseDeg: number;
  destination: string;
  status: string;
  dwellHours: number;
}

export interface LiveAnomalyData {
  id: string;
  code: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  entity: string;
  sector: string;
  deviation: string;
  confidenceScore: number;
  zScore: number;
  timestamp: string;
  location: string;
  coordinates: [number, number];
}

export interface LiveQueueData {
  queueDepth: number;
  activeFetching: number;
  verifying: number;
  accepted: number;
  rejected: number;
  lastProcessedAt: string;
}

export interface TelemetryState {
  vessels: LiveVesselData[];
  anomalies: LiveAnomalyData[];
  queueMetrics: LiveQueueData;
  gridLoadMW: number;
  portTEUVelocity: number;
  timestamp: number;
  connectionStatus: 'connecting' | 'streaming' | 'reconnecting' | 'disconnected';
  setTelemetry: (data: Partial<TelemetryState>) => void;
  setConnectionStatus: (status: TelemetryState['connectionStatus']) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  vessels: [
    {
      mmsi: "368124000",
      name: "MSC LAUREN",
      lat: 32.012,
      lng: -80.954,
      speedKnots: 11.4,
      courseDeg: 285,
      destination: "US SAVANNAH OCEAN TERMINAL",
      status: "Underway Using Engine",
      dwellHours: 42.6,
    },
    {
      mmsi: "636019821",
      name: "MAERSK MC-KINNEY MOLLER",
      lat: 32.128,
      lng: -81.144,
      speedKnots: 0.2,
      courseDeg: 310,
      destination: "GARDEN CITY TERMINAL BERTH 4",
      status: "Moored",
      dwellHours: 68.2,
    },
    {
      mmsi: "477218300",
      name: "CMA CGM MARCO POLO",
      lat: 31.985,
      lng: -80.880,
      speedKnots: 14.1,
      courseDeg: 290,
      destination: "SAVANNAH ANCHORAGE B",
      status: "At Anchor",
      dwellHours: 54.0,
    },
    {
      mmsi: "211281000",
      name: "EVER GIVEN",
      lat: 32.776,
      lng: -79.931,
      speedKnots: 8.5,
      courseDeg: 340,
      destination: "PORT OF CHARLESTON LEATHERMAN",
      status: "Underway",
      dwellHours: 18.2,
    }
  ],
  anomalies: [
    {
      id: "ANOM-GA-001",
      code: "PORT-SAV-THRU-01",
      title: "Port of Savannah Container Dwell & Ocean Terminal Berth Reconstruction Bottleneck",
      severity: "CRITICAL",
      entity: "Georgia Ports Authority (Port of Savannah)",
      sector: "Logistics",
      deviation: "+67.8% dwell deviation (2.4σ anomaly)",
      confidenceScore: 94.8,
      zScore: 2.45,
      timestamp: new Date().toISOString(),
      location: "Savannah, Chatham County, GA",
      coordinates: [-81.144, 32.128]
    },
    {
      id: "ANOM-GA-002",
      code: "TAX-HB463-HQ-02",
      title: "Corporate Headquarters Tax Credit Statutory Repeal Invalidation",
      severity: "CRITICAL",
      entity: "Georgia Department of Revenue / General Assembly",
      sector: "Fiscal & Tax",
      deviation: "-100% statutory credit entitlement for new relocations",
      confidenceScore: 99.2,
      zScore: 3.12,
      timestamp: new Date().toISOString(),
      location: "Atlanta, Fulton County, GA",
      coordinates: [-84.388, 33.749]
    },
    {
      id: "ANOM-GA-003",
      code: "HLTH-PHYS-ARBIT-03",
      title: "Healthcare Provider Access Deficit & Clinical Retention Asymmetry",
      severity: "HIGH",
      entity: "Georgia Composite Medical Board",
      sector: "Healthcare",
      deviation: "-15.1% vs national physician density baseline (2.1σ)",
      confidenceScore: 92.4,
      zScore: 2.14,
      timestamp: new Date().toISOString(),
      location: "Macon / Bibb County, GA",
      coordinates: [-83.632, 32.840]
    },
    {
      id: "ANOM-GA-006",
      code: "GRID-DATACENTER-06",
      title: "Data Center Clean Energy Grid Load & 2032 Sales Tax Exemption Horizon",
      severity: "CRITICAL",
      entity: "Georgia Power / Public Service Commission",
      sector: "Infrastructure",
      deviation: "-37.8% reserve margin compression with 2.7x queue backlog",
      confidenceScore: 93.7,
      zScore: 2.82,
      timestamp: new Date().toISOString(),
      location: "Douglasville / Douglas County, GA",
      coordinates: [-84.747, 33.751]
    }
  ],
  queueMetrics: {
    queueDepth: 10,
    activeFetching: 2,
    verifying: 3,
    accepted: 8,
    rejected: 0,
    lastProcessedAt: new Date().toISOString()
  },
  gridLoadMW: 18450,
  portTEUVelocity: 541405,
  timestamp: Date.now(),
  connectionStatus: 'connecting',
  setTelemetry: (data) => set((prev) => ({ ...prev, ...data, timestamp: Date.now() })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
