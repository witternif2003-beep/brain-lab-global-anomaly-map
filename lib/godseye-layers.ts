export interface IntelLayerConfig {
  id: string;
  name: string;
  category: "Aviation" | "Maritime" | "Orbital" | "Thermal/Physical" | "Cyber & Network" | "Infrastructure" | "Seismic/Geophysical" | "Surveillance";
  icon: string;
  entityCount: string;
  updateCadence: string;
  provider: string;
  georgiaRelevance: string;
  active: boolean;
  color: string;
}

export const GODSEYE_INTEL_LAYERS: IntelLayerConfig[] = [
  {
    id: "layer-adsb",
    name: "ADS-B Live Aviation Tracking",
    category: "Aviation",
    icon: "Plane",
    entityCount: "10,000+ Aircraft",
    updateCadence: "1 sec (transponder stream)",
    provider: "OpenSky Network / ADS-B Exchange public feeds",
    georgiaRelevance: "Tracks Hartsfield-Jackson Atlanta (KATL) air freight holding patterns and Savannah/Hilton Head (KSAV) corporate aviation movements.",
    active: true,
    color: "#38bdf8"
  },
  {
    id: "layer-ais",
    name: "AIS Maritime Commercial Fleet Tracking",
    category: "Maritime",
    icon: "Anchor",
    entityCount: "15,000+ Vessels",
    updateCadence: "5 sec (transponder AIS)",
    provider: "Global Maritime AIS / NOAA Vessel Traffic Stream",
    georgiaRelevance: "Monitors Port of Savannah vessel approaches, anchorage waiting queues, and Port of Brunswick vehicle carriers in real time.",
    active: true,
    color: "#06b6d4"
  },
  {
    id: "layer-satellites",
    name: "CelesTrak Orbital Satellite Tracking",
    category: "Orbital",
    icon: "Satellite",
    entityCount: "2,000+ Satellites (including ISS & Sentinel)",
    updateCadence: "Real-time orbital propagation",
    provider: "CelesTrak Two-Line Element (TLE) Public Ephemeris",
    georgiaRelevance: "Overhead pass telemetry for multi-spectral remote sensing over Georgia logistics corridors and agricultural basins.",
    active: true,
    color: "#a855f7"
  },
  {
    id: "layer-firms",
    name: "NASA FIRMS Satellite Thermal & Fire Anomalies",
    category: "Thermal/Physical",
    icon: "Flame",
    entityCount: "Continuous Thermal Hotspots",
    updateCadence: "VIIRS/MODIS 3-hr latency",
    provider: "NASA Earthdata LANCE / FIRMS Open Telemetry",
    georgiaRelevance: "Detects industrial plant heat signatures, flare anomalies, and timber land resource stresses across South Georgia.",
    active: true,
    color: "#f43f5e"
  },
  {
    id: "layer-seismic",
    name: "USGS Global Real-Time Seismic Activity",
    category: "Seismic/Geophysical",
    icon: "Activity",
    entityCount: "M1.0+ Global Events",
    updateCadence: "Immediate event broadcast",
    provider: "US Geological Survey (USGS) Earthquake Hazards API",
    georgiaRelevance: "Monitors seismic and geological stability along the Brevard Fault Zone and Southeast Piedmont reservoir dams.",
    active: true,
    color: "#eab308"
  },
  {
    id: "layer-cyber",
    name: "Cyber Threat & BGP / Internet Outage Radar",
    category: "Cyber & Network",
    icon: "WifiOff",
    entityCount: "Macroscopic Network Traces",
    updateCadence: "5 min telemetry batches",
    provider: "IODA (Georgia Tech) / NetBlocks / BGP Routing Streams",
    georgiaRelevance: "Detects telecommunication and fiber route outages impacting Atlanta's financial transactions and Douglasville data center campuses.",
    active: true,
    color: "#ec4899"
  },
  {
    id: "layer-cctv",
    name: "Worldwide Public DOT & Port Traffic CCTV",
    category: "Surveillance",
    icon: "Camera",
    entityCount: "1,400+ Public Feeds",
    updateCadence: "Live snapshot/HLS refresh",
    provider: "Georgia 511 NaviGAtor & Public DOT Cameras",
    georgiaRelevance: "Physical visual ground truth for I-95/I-85/I-75 freight congestion and Port of Savannah gate queues.",
    active: true,
    color: "#10b981"
  },
  {
    id: "layer-nuclear",
    name: "Nuclear Infrastructure & Grid Baselines",
    category: "Infrastructure",
    icon: "Zap",
    entityCount: "Licensed Facilities",
    updateCadence: "Hourly generation and status",
    provider: "NRC Public Docket / Plant Vogtle Units 1-4 Telemetry",
    georgiaRelevance: "Monitors Plant Vogtle Units 3 & 4 (Waynesboro, Burke County) power output into the Georgia Power transmission grid.",
    active: true,
    color: "#f97316"
  }
];

export interface LiveTelemetryEntity {
  id: string;
  layerId: string;
  callsignOrName: string;
  type: string;
  lat: number;
  lng: number;
  altOrSpeed: string;
  heading: number;
  status: "NORMAL" | "ANOMALOUS" | "CRITICAL_HOLD";
  anomalyFlag?: string;
  source: string;
}

export const SAMPLE_LIVE_ENTITIES: LiveTelemetryEntity[] = [
  {
    id: "VESSEL-CMA-CGM",
    layerId: "layer-ais",
    callsignOrName: "CMA CGM SAVANNAH (Post-Panamax)",
    type: "Container Ship (14,400 TEU)",
    lat: 31.985,
    lng: -80.852,
    altOrSpeed: "1.2 kts (Anchorage Holding)",
    heading: 265,
    status: "ANOMALOUS",
    anomalyFlag: "Wait Time Anomaly: 48h at Savannah Outer Anchorage (+2.4σ dwell queue)",
    source: "AIS Marine Telemetry (NOAA / GPA Gate Sensor)"
  },
  {
    id: "VESSEL-MAERSK-MC",
    layerId: "layer-ais",
    callsignOrName: "MAERSK CAROLINA",
    type: "Container Ship (9,800 TEU)",
    lat: 32.082,
    lng: -81.085,
    altOrSpeed: "0.0 kts (Berth 4 Garden City)",
    heading: 110,
    status: "NORMAL",
    source: "AIS Marine Telemetry"
  },
  {
    id: "FLIGHT-UPS-ATL",
    layerId: "layer-adsb",
    callsignOrName: "UPS 1342 (Boeing 767-300F)",
    type: "Heavy Air Cargo",
    lat: 33.640,
    lng: -84.427,
    altOrSpeed: "4,200 ft | 195 kts",
    heading: 90,
    status: "NORMAL",
    source: "OpenSky Network ADS-B Stream"
  },
  {
    id: "FLIGHT-DAL-AIR",
    layerId: "layer-adsb",
    callsignOrName: "DAL 894 (Airbus A350-900)",
    type: "Commercial Long-Haul",
    lat: 33.820,
    lng: -84.210,
    altOrSpeed: "12,000 ft | 320 kts",
    heading: 280,
    status: "NORMAL",
    source: "OpenSky Network ADS-B Stream"
  },
  {
    id: "SAT-SENTINEL-2B",
    layerId: "layer-satellites",
    callsignOrName: "SENTINEL-2B (MSI Multi-Spectral)",
    type: "Earth Observation Satellite",
    lat: 32.550,
    lng: -83.200,
    altOrSpeed: "786 km | 7.45 km/s",
    heading: 195,
    status: "NORMAL",
    source: "CelesTrak Ephemeris Propagation"
  },
  {
    id: "CAM-I95-SAV",
    layerId: "layer-cctv",
    callsignOrName: "GA-511 CAM #4402: I-95 @ GA-21 Port Corridor",
    type: "Public DOT Traffic Surveillance",
    lat: 32.145,
    lng: -81.215,
    altOrSpeed: "Live 1080p Stream (1.2 FPS)",
    heading: 0,
    status: "ANOMALOUS",
    anomalyFlag: "Severe Drayage Truck Congestion: 2.1-mile freight tailback at Gate 3",
    source: "Georgia 511 NaviGAtor Public Network"
  },
  {
    id: "GRID-VOGTLE",
    layerId: "layer-nuclear",
    callsignOrName: "PLANT VOGTLE UNIT 4 (AP1000)",
    type: "Commercial Nuclear Power (1,117 MW)",
    lat: 33.142,
    lng: -81.763,
    altOrSpeed: "100% Thermal Output",
    heading: 0,
    status: "NORMAL",
    source: "NRC Public Generation Status"
  },
  {
    id: "NET-IODA-ATL",
    layerId: "layer-cyber",
    callsignOrName: "IODA AS-3356 Metro Atlanta BGP Convergence",
    type: "Internet Outage Detection (BGP / Darknet)",
    lat: 33.755,
    lng: -84.390,
    altOrSpeed: "0.994 Signal Integrity",
    heading: 0,
    status: "NORMAL",
    source: "Georgia Tech IODA v2 Stream"
  }
];
