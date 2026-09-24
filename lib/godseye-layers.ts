export interface IntelLayerConfig {
  id: string;
  name: string;
  category: "Aviation" | "Maritime" | "Orbital" | "Thermal/Physical" | "Cyber & Network" | "Infrastructure" | "Seismic/Geophysical" | "Surveillance" | "OSINT & Recon" | "Space Weather" | "Signals & Geopolitics";
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
    name: "ADS-B Live Aviation Tracking (10,000+ Aircraft)",
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
    name: "CelesTrak Orbital Satellite Tracking (2,000+ Objects)",
    category: "Orbital",
    icon: "Satellite",
    entityCount: "2,000+ Satellites (including ISS & Sentinel)",
    updateCadence: "Real-time SGP4 orbital propagation",
    provider: "CelesTrak Two-Line Element (TLE) Public Ephemeris",
    georgiaRelevance: "Overhead pass telemetry for multi-spectral remote sensing over Georgia logistics corridors and agricultural basins.",
    active: true,
    color: "#a855f7"
  },
  {
    id: "layer-cctv",
    name: "Worldwide Public DOT & Port Traffic CCTV",
    category: "Surveillance",
    icon: "Camera",
    entityCount: "1,400+ Public Feeds",
    updateCadence: "Live snapshot/HLS refresh",
    provider: "Georgia 511 NaviGAtor & Worldwide Highway Cameras",
    georgiaRelevance: "Physical visual ground truth for I-95/I-85/I-75 freight congestion and Port of Savannah gate queues.",
    active: true,
    color: "#10b981"
  },
  {
    id: "layer-firms",
    name: "NASA FIRMS Satellite Thermal Hotspots & Wildfires",
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
    color: "#38bdf8"
  },
  {
    id: "layer-nuclear",
    name: "Nuclear Infrastructure & Grid Baselines (Global)",
    category: "Infrastructure",
    icon: "Zap",
    entityCount: "440+ Commercial Reactors Worldwide",
    updateCadence: "Hourly generation and status",
    provider: "NRC Public Docket / Plant Vogtle Units 1-4 Telemetry",
    georgiaRelevance: "Monitors Plant Vogtle Units 3 & 4 (Waynesboro, Burke County) AP1000 power output into the Georgia Power transmission grid.",
    active: true,
    color: "#34d399"
  },
  {
    id: "layer-cyber",
    name: "Cyber Threat Intelligence, BGP Outages & CVEs",
    category: "Cyber & Network",
    icon: "WifiOff",
    entityCount: "CISA KEV + BGP Routing Traces",
    updateCadence: "Real-time telemetry stream",
    provider: "CISA Known Exploited Vulnerabilities / IODA / NetBlocks",
    georgiaRelevance: "Detects telecommunication and fiber route outages impacting Atlanta's financial transactions and Douglasville data center campuses.",
    active: true,
    color: "#ec4899"
  },
  {
    id: "layer-gps-jamming",
    name: "GPS / GNSS Interference & Spoofing Radar",
    category: "Cyber & Network",
    icon: "Radio",
    entityCount: "ADS-B NIC/NACp Degradation Clusters",
    updateCadence: "Rolling 15-minute anomaly detection",
    provider: "GPSJam.org & ADS-B Signal Integrity Vectors",
    georgiaRelevance: "Signals warfare monitoring across military air corridors including Moody AFB, Robins AFB, and Kings Bay Submarine Base.",
    active: true,
    color: "#fb923c"
  },
  {
    id: "layer-osint",
    name: "Live OSINT Recon: Nmap, DNS, WHOIS & SSL Logs",
    category: "OSINT & Recon",
    icon: "Terminal",
    entityCount: "Browser-executable recon endpoints",
    updateCadence: "On-demand real-time execution",
    provider: "GodsEYE Integrated Engine / crt.sh Certificate Transparency",
    georgiaRelevance: "Reconnaissance auditing against adversary supply chain infrastructure and regional IT vendor endpoints.",
    active: true,
    color: "#67e8f9"
  },
  {
    id: "layer-space-weather",
    name: "Space Weather & Solar Geomagnetic Storms",
    category: "Space Weather",
    icon: "Sun",
    entityCount: "NOAA SWPC K-Index & Flare Alerts",
    updateCadence: "1-minute cadence",
    provider: "NOAA Space Weather Prediction Center (SWPC)",
    georgiaRelevance: "Ionospheric disturbance impacts on high-frequency emergency communications and electrical transmission grid harmonics.",
    active: true,
    color: "#f59e0b"
  },
  {
    id: "layer-conflicts",
    name: "Global Conflict Zones & ACLED Event Monitoring",
    category: "Signals & Geopolitics",
    icon: "ShieldAlert",
    entityCount: "ACLED & GDELT Event Vectors",
    updateCadence: "Live event ingestion",
    provider: "Armed Conflict Location & Event Data (ACLED) / GDELT",
    georgiaRelevance: "Supply chain geopolitical risk scoring for raw material imports into the Savannah Container Terminal.",
    active: true,
    color: "#ef4444"
  },
  {
    id: "layer-breach-intel",
    name: "Breach Intelligence & Dark Web Credential Radar",
    category: "OSINT & Recon",
    icon: "KeyRound",
    entityCount: "14B+ Leak Records Audited",
    updateCadence: "Continuous verification stream",
    provider: "DeHashed / HaveIBeenPwned / Open Threat Feeds",
    georgiaRelevance: "Credentials intelligence protecting Georgia State agency access controls and defense contractors.",
    active: true,
    color: "#c084fc"
  },
  {
    id: "layer-sigint-news",
    name: "SIGINT & Real-Time Open Intelligence Wire",
    category: "Signals & Geopolitics",
    icon: "Newspaper",
    entityCount: "Global Wire Feeds & Open Frequencies",
    updateCadence: "Sub-second wire stream",
    provider: "GDELT Global News Wire / Emergency Broadcasts",
    georgiaRelevance: "Early warning situational awareness during southeastern severe storm outbreaks and logistics disruptions.",
    active: true,
    color: "#22d3ee"
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
  },
  {
    id: "JAM-KINGS-BAY",
    layerId: "layer-gps-jamming",
    callsignOrName: "KINGS BAY NAVAL CORRIDOR GNSS INTEGRITY",
    type: "GPS Jamming & Spoofing Monitor",
    lat: 30.798,
    lng: -81.562,
    altOrSpeed: "NACp 9 (Optimal Integrity)",
    heading: 0,
    status: "NORMAL",
    source: "GPSJam / ADS-B Position Quality Broadcast"
  },
  {
    id: "OSINT-SEC-SCAN",
    layerId: "layer-osint",
    callsignOrName: "SAVANNAH PORT TERMINAL PERIMETER RECON",
    type: "Live DNS / SSL Certificate Audit",
    lat: 32.115,
    lng: -81.140,
    altOrSpeed: "Zero Exposed Ports",
    heading: 0,
    status: "NORMAL",
    source: "crt.sh Certificate Transparency & Nmap Scanner"
  },
  {
    id: "layer-undersea-cables",
    name: "Global Undersea Submarine Telecom Cables",
    category: "Infrastructure",
    icon: "Network",
    entityCount: "550+ Cable Systems",
    updateCadence: "Real-time topology stream",
    provider: "TeleGeography / ITU Submarine Cable Database",
    georgiaRelevance: "Monitors Atlantic landing connections and terrestrial fiber backhaul feeding Atlanta tech and data center nodes.",
    active: true,
    color: "#2dd4bf"
  },
  {
    id: "layer-gdacs",
    name: "GDACS Global Disaster Alerts & Coordination",
    category: "Seismic/Geophysical",
    icon: "AlertTriangle",
    entityCount: "350+ Active Disaster Events",
    updateCadence: "5 min (multi-hazard polling)",
    provider: "UN / EC Global Disaster Alert and Coordination System",
    georgiaRelevance: "Monitors East Coast tropical cyclones, storm surge vectors, and regional FEMA Region IV emergency declarations.",
    active: true,
    color: "#f59e0b"
  },
  {
    id: "layer-ocean-buoys",
    name: "NOAA NDBC Live Ocean Buoys & Coastal Telemetry",
    category: "Maritime",
    icon: "Anchor",
    entityCount: "1,200+ Ocean Buoys",
    updateCadence: "10 min (wave & meteorological feed)",
    provider: "NOAA National Data Buoy Center (NDBC)",
    georgiaRelevance: "Continuous wave height, barometric pressure, and surface current telemetry off Savannah, Tybee Island, and Brunswick approaches.",
    active: true,
    color: "#38bdf8"
  },
  {
    id: "layer-radio-browser",
    name: "Worldwide Local Radio Broadcast & Frequency Intercepts",
    category: "Signals & Geopolitics",
    icon: "Radio",
    entityCount: "35,000+ Stations",
    updateCadence: "Sub-second audio & signal stream",
    provider: "Radio Browser Open SIGINT Network",
    georgiaRelevance: "Tactical VHF/UHF and municipal broadcast monitoring across Georgia public safety, aviation, and emergency frequencies.",
    active: true,
    color: "#a78bfa"
  },
  {
    id: "layer-power-outages",
    name: "US DOE ODIN & WRI Global Power Plant Grid Telemetry",
    category: "Infrastructure",
    icon: "Zap",
    entityCount: "35,000+ Power Plants & Outages",
    updateCadence: "1 min (outage monitor)",
    provider: "US Department of Energy ODIN & WRI Energy Database",
    georgiaRelevance: "Monitors Plant Vogtle Units 1-4 nuclear baseload, Southern Company distribution nodes, and statewide county-by-county power outages.",
    active: true,
    color: "#fbbf24"
  },
  {
    id: "layer-volcanoes",
    name: "Smithsonian Global Volcanism & Ash Advisory Telemetry",
    category: "Seismic/Geophysical",
    icon: "Flame",
    entityCount: "1,400+ Holocene Volcanoes",
    updateCadence: "Hourly VAAC updates",
    provider: "Smithsonian Institution / USGS Global Volcanism Program",
    georgiaRelevance: "Tracks high-altitude Caribbean and Atlantic volcanic ash clouds impacting transatlantic approach routes into KATL.",
    active: true,
    color: "#f87171"
  }
];
