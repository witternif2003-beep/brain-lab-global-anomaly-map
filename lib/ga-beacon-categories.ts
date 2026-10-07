/** Police-vehicle beacon categories from the reference document, each tied to the public Georgia feeds that stand in for it. */
export interface BeaconCategory {
  domain: string;
  name: string;
  feeds: string[];
  note: string;
}

const NOT_PUBLIC = 'NO PUBLIC SOURCE · agency-internal';

export const BEACON_CATEGORIES: BeaconCategory[] = [
  { domain: 'Emergency warning', name: 'Light bars, takedown, alley & hideaway strobes', feeds: ['police', 'firestations'], note: 'vehicle light state not published · stations shown' },
  { domain: 'Emergency warning', name: 'Sirens (wail, yelp, piercer, hi-lo, air horn)', feeds: ['sirens'], note: 'fixed outdoor warning sirens · vehicle tones not published' },
  { domain: 'Emergency warning', name: 'V2X light-bar integration (C-V2X OBU)', feeds: [], note: NOT_PUBLIC },
  { domain: 'Communications', name: 'P25 land mobile radio (Phase 1 FDMA / Phase 2 TDMA)', feeds: ['towers'], note: 'tower sites · radio traffic not published' },
  { domain: 'Communications', name: 'Mobile data terminals (MDTs)', feeds: [], note: NOT_PUBLIC },
  { domain: 'Communications', name: 'CAD dispatch / public 911 calls (delayed)', feeds: ['augusta911', 'athens911'], note: 'call locations published by Augusta E911 and Athens-Clarke PD · no unit positions' },
  { domain: 'Location & tracking', name: 'Automatic vehicle location (AVL)', feeds: ['transit'], note: 'public transit AVL · police AVL not published' },
  { domain: 'Location & tracking', name: 'LoJack police tracking computers', feeds: [], note: NOT_PUBLIC },
  { domain: 'Location & tracking', name: 'Covert RFID / IR trackers', feeds: [], note: 'NO PUBLIC SOURCE · covert tracking' },
  { domain: 'Surveillance & detection', name: 'Traffic CCTV (GDOT 511GA)', feeds: ['gdotcams'], note: 'public DOT road cameras · live snapshot on tap · video needs 511GA login' },
  { domain: 'Surveillance & detection', name: 'Automated licence-plate readers (ALPR)', feeds: ['alpr'], note: 'fixed camera positions · no plate reads' },
  { domain: 'Surveillance & detection', name: 'Drone detection & Remote ID', feeds: ['tfr'], note: 'FAA UAS/flight restrictions · operator locations not shown' },
  { domain: 'Surveillance & detection', name: 'Radar & LIDAR speed enforcement', feeds: ['speedcams'], note: 'fixed speed cameras · handheld units not published' },
  { domain: 'Surveillance & detection', name: 'Acoustic hailing devices (LRAD)', feeds: [], note: NOT_PUBLIC },
  { domain: 'Identification', name: 'Thermal / infrared beacons', feeds: ['fires'], note: 'satellite thermal-IR heat detections · vehicle IR beacons not public' },
  { domain: 'Traffic control', name: 'Signal preemption emitters (IR, strobe, DSRC)', feeds: ['signals'], note: 'signalised intersections · preemption events not published' },
  { domain: 'Traffic control', name: 'V2X-based preemption (V2X Hub, BSMs)', feeds: ['signals'], note: 'signalised intersections · RSU messages not published' },
  { domain: 'Emerging', name: 'V2X (V2V, V2I, V2P, V2N)', feeds: [], note: NOT_PUBLIC },
  { domain: 'Emerging', name: 'Bluetooth LE preemption', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'GPS accuracy (HDOP/VDOP, satellite count)', feeds: ['gps-integrity'], note: 'aircraft reporting low GPS accuracy (ADS-B NACp)' },
  { domain: 'Telemetry', name: 'Security monitoring (RF jamming)', feeds: ['gps-integrity'], note: 'low aircraft GPS accuracy can indicate interference' },
  { domain: 'Telemetry', name: 'Alert correlation', feeds: ['anomalies'], note: 'rule-based anomaly beacons on public feeds' },
  { domain: 'Telemetry', name: 'Fleet-wide status dashboard / real-time aggregation', feeds: ['*'], note: 'every public feed in this panel' },
  { domain: 'Telemetry', name: 'VSWR & antenna integrity', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'RF power output & radio PA health', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'MDT / radio battery voltage & cycles', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'IR emitter thermal status', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'ALPR capture rate & AI make/model', feeds: [], note: 'STATUTE-SHIELDED · O.C.G.A. § 35-1-22 limits plate-data disclosure' },
  { domain: 'Telemetry', name: 'Drone detection range & operator geolocation', feeds: [], note: 'RESTRICTED ACCESS · FAA DiSCVR is law-enforcement only' },
  { domain: 'Telemetry', name: 'LRAD impedance & amplifier health', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'LED degradation & predictive maintenance', feeds: [], note: NOT_PUBLIC },
  { domain: 'Telemetry', name: 'OTA firmware updates', feeds: [], note: NOT_PUBLIC },
];
