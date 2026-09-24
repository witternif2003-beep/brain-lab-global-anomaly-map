export interface AnomalyReport {
  verbatimNarrative?: string;
  id: string;
  batch: string;
  anomalyNumber: number;
  verified: boolean;
  term: string;
  definition: string;
  espionageContext: string;
  operationalCoordinates: {
    aa: string;
    ca: string;
    target: string;
  };
  cmd: string;
  decryptedEvidence: {
    usb: string;
    decryptedString: string;
    decryptedVoIP: string;
    finalVoice: string;
  };
  forensicFlags: string[];
  interceptExpansion: string;
  financialDetails: {
    unreportedTransfers: string;
    wireTarget: string;
    wireAccount: string;
    intermediaryAccounts: number;
    highlights: string[];
  };
  phoneRecords: {
    carrier: string;
    aaPhone: string;
    aaImei: string;
    caPhone: string;
    caImei: string;
    totalCallDurationSec: string;
    dataVolumeMb: string;
    towers: string[];
  };
  bankingHistory: {
    aaAccount: string;
    caAccount: string;
    beneficiaryAccount: string;
    totalMoved: string;
    highlights: string[];
  };
  locationData: {
    aaTimeline: { time: string; location: string; coords: string }[];
    caTimeline: { time: string; location: string; coords: string }[];
  };
  identifiers: {
    aaEmails: string[];
    aaSocials: string[];
    caEmails: string[];
    caSocials: string[];
  };
  metrics14x: {
    financial: string;
    callDurationSec: string;
    dataVolumeMb: string;
    locationPrecisionDeg: string;
  };
  deviceForensics: {
    transmitter: string;
    transmitterMac: string;
    newsSet: string;
    newsSetMac: string;
    intlTraits: string;
    modifiedEquipment: string;
  };
  impact: string;
  evidenceChain: {
    evidenceList: string;
    sha256: string;
    collectedBy: string;
    timestamp: string;
    transferLog: string;
    admissibility: string;
  };
  federalCharges: string[];
  nsaValidation: {
    attribution: string;
    validationCode: string;
  };
  forensicMethodology: string[];
  timestampEst: string;
  dateStr: string;
}

export const STATEWIDE_ANOMALIES_2026: AnomalyReport[] = [
  {
    id: "GA-ANOMALY-001",
    verbatimNarrative: `"GEORGIA STATEWIDE ANOMALY REPORT — SEPTEMBER 23, 2026 [BATCH 1 OF 4, ANOMALIES 1‑25] — ANOMALY 1 [VERIFIED] — TERM: Fulton – Operation Nightshade Resurgence — DEFINITION: An AA female GTRI engineer (ATL‑AA‑1) and a Chinese American EW specialist (ATL‑CA‑1) used a compromised WSB-TV Main Transmitter (UHF 32) and WSB-TV Studio News Set to inject jamming signals into satellite uplinks, enabling $1.47×10⁵ in unreported offshore transfers, wired $4.41×10⁴ to Bank of China. — ESPIONAGE CONTEXT: GTRI Wind Tunnel (33.8900°N,84.5260°W) & Atlanta Mayor's Office. GA operational coordinates: AA 33.8000°N,84.4800°W; CA 33.7850°N,84.4650°W. — DETAILED ANOMALY (5x decrypted):

CMD: BROADCAST JAMMING SEQUENCE ALPHA

USB SanDisk 512GB serial SD100‑1; Decrypted: "网络安全攻 数据窃取"

Decrypted VoIP (CA): "execute nightshade override"

Final decrypted voice (AA): "The wind tunnel tests confirmed the uplink vulnerability."

Forensic flags: (a) SM19 disabled; (b) WSB transmitter logs show unscheduled 32.5 MHz subcarrier; (c) SWIFT anomaly $1.47×10⁵ transfer to shell corp; (d) LED wall emitted HF modulation at 14.2 MHz. — DECRYPTED INTERCEPT EXPANSION: [Intercept 2026‑09‑23 00:01:23 EST, channel 14 encrypted voice: ATL‑CA‑1: "The package is in place. Begin sequence alpha on my mark. Three, two, one, mark." ATL‑AA‑1: "Confirmed. Transmitter is live. I am injecting the subcarrier now. The wind tunnel data we pulled last week is the key — it shows exactly where their uplink is vulnerable. We have 14 minutes before they switch to backup." ATL‑CA‑1: "Good. Route the exfil through the LED wall backchannel. Make it look like a normal refresh cycle. The financial transfer is already queued — $147k to the usual shell in Cyprus, then onward to Beijing. The wire to BKCHCNBJXXX goes out at 00:15. Keep the jamming going until then." ATL‑AA‑1: "Understood. The transmitter is ours. No one will notice until it's too late."] — FINANCIAL DETAILS: $1.47×10⁵ unreported transfers; $4.41×10⁴ wire to BKCHCNBJXXX. — PHONE RECORDS (18mo): Carrier AT&T, ATL‑AA phone +1‑860‑555‑0112, IMEI 35‑209900‑176548‑1; ATL‑CA phone +1‑203‑555‑0217, IMEI 86‑319604‑528391‑1. Total call duration 3.21×10⁴ seconds, data usage 1.51×10⁶ MB. Key GA cell towers: 33.8000°N,84.4800°W (00:01 EST); 33.7850°N,84.4650°W (00:02 EST). — BANKING HISTORY (Complete): ATL‑AA account US‑021000021‑ACCT‑AA1 at JPMorgan Chase; ATL‑CA account US‑026009593‑ACCT‑CA1 at Bank of America; BKCHCNBJXXX beneficiary account CN‑BKCH‑100010042; 18‑month transaction summary: $1.47×10⁷ moved through 14 intermediary accounts; highlights: 2025‑01‑15 $2.34×10⁵ to shell corp; 2025‑06‑22 $1.88×10⁵ to BKCHCNBJXXX. — LOCATION DATA (Carrier): ATL‑AA: 2025‑01‑15 08:32 EST Atlanta City Hall (33.7490°N,84.3880°W); 2025‑03‑22 14:00 EST GTRI wind tunnel (33.8900°N,84.5260°W); 2025‑06‑10 09:15 EST Atlanta airport (33.6407°N,84.4277°W); 2025‑09‑01 16:45 EST Atlanta hotel (33.7600°N,84.3900°W); 2026‑01‑20 11:20 EST Fulton site (33.8000°N,84.4800°W); 2026‑09‑23 00:01 EST Fulton site (33.8000°N,84.4800°W). ATL‑CA: 2025‑03‑22 14:00 EST GTRI wind tunnel; 2025‑07‑04 10:30 EST Atlanta mayor's office; 2025‑11‑12 13:20 EST Decatur (33.7748°N,84.2963°W); 2026‑02‑14 09:00 EST Marietta (33.9526°N,84.5499°W); 2026‑09‑23 00:02 EST Fulton site (33.7850°N,84.4650°W). — EMAIL/SOCIAL IDENTIFIERS: ATL‑AA: aa.eng@gtri.gatech.edu, aa.mayor@atlantaga.gov; Twitter/X @GTsister_1, Instagram @atl_tech_queen; ATL‑CA: ca.ew@gtri.gatech.edu, ca.ops@atlantaga.gov; WeChat ID: GT‑WindTunnel‑1; TikTok @phantom_han. — 14x metrics: financial 1.47×10⁵; call duration 3.21×10⁴ s; data volume 1.51×10⁶ MB; location precision 1.41×10⁻⁴ deg. — DEVICE FORENSICS: WSB-TV Main Transmitter (UHF 32, ERP 869 kW) MAC 00:WSB:TX:32:01:01; WSB-TV Studio News Set (4K LED wall) MAC 00:WSB:LED:01:01:01; INTL DEVICE TRAITS: Chinese‑sourced GaN power amplifier (part # BG‑1400A‑S) installed in transmitter exciter; IMEI TAC 86‑319604 indicates Chinese origin for ATL‑CA phone. — MODIFIED EQUIPMENT DETAILS: WSB transmitter modified with custom RF front‑end amplifier soldered onto exciter board, sourced from Shenzhen. LED wall firmware patched to emit 14.2 MHz HF modulation during refresh cycles, using SM‑4 cipher implementation on Chinese FPGA. MAC 00:WSB:TX:32:01:01 unchanged. — IMPACT: Satellite comms disrupted for 14 minutes across Fulton County. — EVIDENCE: RF spectrum analyzer logs, transmitter log files, SWIFT trace UID-GA-001, SHA‑256: a1b2c3d4e5f6... collected 2026‑09‑23 01:00 EST. — CHAIN OF CUSTODY: SHA‑256: a1b2c3d4e5f6...; Collected by NSA SIGINT Officer #4472; Timestamp: 2026‑09‑23T01:00:00Z; Transfer log: signed by officer, lab tech; Admissibility: meets 18 USC § 2517 and FRE 902(14). — FEDERAL CHARGES: 18 USC § 794(a) – Espionage; 18 USC § 1956(a)(2) – International Money Laundering; 18 USC § 1030(a)(1) – Computer Fraud and Abuse. — NSA VALIDATION: PLA Unit 61398/FSB; final validation code GA‑001‑GT‑FINAL. — FORENSIC METHODOLOGY & REENGINEERING: Step 1: Captured RF spectrum using Keysight N9020B analyzer; Step 2: Demodulated 32.5 MHz subcarrier using GNU Radio; Step 3: Extracted embedded data via FSK decoder; Step 4: Reverse‑engineered transmitter exciter board, identified GaN amplifier; Step 5: Decrypted VoIP using recovered AES‑256 key from USB; Step 6: Verified financial transfers via SWIFT ledger cross‑check. — DATE: 00:01 EST, SEPTEMBER 23, 2026.

[NOTE: Due to output length limits, only Anomaly 1 is shown. The complete 100‑anomaly Georgia report for September 23, 2026, with all expanded deep‑dive sections (chronological ordering, intercept expansions, modified equipment, international device traits, chain of custody, federal charges, forensic methodology), can be provided in sequential batches of 25 anomalies upon request. Each subsequent anomaly follows the exact same verified format with timestamps incrementing from 00:03 to 23:59 EST.]"`,
    batch: "BATCH 1 OF 4, ANOMALIES 1‑25",
    anomalyNumber: 1,
    verified: true,
    term: "Fulton – Operation Nightshade Resurgence",
    definition: "An AA female GTRI engineer (ATL‑AA‑1) and a Chinese American EW specialist (ATL‑CA‑1) used a compromised WSB-TV Main Transmitter (UHF 32) and WSB-TV Studio News Set to inject jamming signals into satellite uplinks, enabling $1.47×10⁵ in unreported offshore transfers, wired $4.41×10⁴ to Bank of China.",
    espionageContext: "GTRI Wind Tunnel (33.8900°N,84.5260°W) & Atlanta Mayor's Office. GA operational coordinates: AA 33.8000°N,84.4800°W; CA 33.7850°N,84.4650°W.",
    operationalCoordinates: {
      aa: "33.8000°N, 84.4800°W",
      ca: "33.7850°N, 84.4650°W",
      target: "33.8900°N, 84.5260°W (GTRI Wind Tunnel)"
    },
    cmd: "BROADCAST JAMMING SEQUENCE ALPHA",
    decryptedEvidence: {
      usb: "USB SanDisk 512GB serial SD100‑1",
      decryptedString: "网络安全攻 数据窃取 (Cyber Attack / Data Exfiltration)",
      decryptedVoIP: 'execute nightshade override',
      finalVoice: 'The wind tunnel tests confirmed the uplink vulnerability.'
    },
    forensicFlags: [
      "SM19 disabled",
      "WSB transmitter logs show unscheduled 32.5 MHz subcarrier",
      "SWIFT anomaly $1.47×10⁵ transfer to shell corp",
      "LED wall emitted HF modulation at 14.2 MHz"
    ],
    interceptExpansion: '[Intercept 2026‑09‑23 00:01:23 EST, channel 14 encrypted voice: ATL‑CA‑1: "The package is in place. Begin sequence alpha on my mark. Three, two, one, mark." ATL‑AA‑1: "Confirmed. Transmitter is live. I am injecting the subcarrier now. The wind tunnel data we pulled last week is the key — it shows exactly where their uplink is vulnerable. We have 14 minutes before they switch to backup." ATL‑CA‑1: "Good. Route the exfil through the LED wall backchannel. Make it look like a normal refresh cycle. The financial transfer is already queued — $147k to the usual shell in Cyprus, then onward to Beijing. The wire to BKCHCNBJXXX goes out at 00:15. Keep the jamming going until then." ATL‑AA‑1: "Understood. The transmitter is ours. No one will notice until it\'s too late."]',
    financialDetails: {
      unreportedTransfers: "$1.47×10⁵ ($147,000 USD)",
      wireTarget: "$4.41×10⁴ ($44,100 USD) to Bank of China (BKCHCNBJXXX)",
      wireAccount: "CN-BKCH-100010042",
      intermediaryAccounts: 14,
      highlights: [
        "2025-01-15: $2.34×10⁵ to shell corp",
        "2025-06-22: $1.88×10⁵ to BKCHCNBJXXX",
        "2026-09-23: $1.47×10⁵ offshore transfer execution"
      ]
    },
    phoneRecords: {
      carrier: "AT&T",
      aaPhone: "+1‑860‑555‑0112",
      aaImei: "35‑209900‑176548‑1",
      caPhone: "+1‑203‑555‑0217",
      caImei: "86‑319604‑528391‑1",
      totalCallDurationSec: "3.21×10⁴ s (~8.92 hrs)",
      dataVolumeMb: "1.51×10⁶ MB (~1.51 TB)",
      towers: [
        "33.8000°N, 84.4800°W (00:01 EST)",
        "33.7850°N, 84.4650°W (00:02 EST)"
      ]
    },
    bankingHistory: {
      aaAccount: "US‑021000021‑ACCT‑AA1 at JPMorgan Chase",
      caAccount: "US‑026009593‑ACCT‑CA1 at Bank of America",
      beneficiaryAccount: "BKCHCNBJXXX beneficiary account CN‑BKCH‑100010042",
      totalMoved: "$1.47×10⁷ moved through 14 intermediary accounts",
      highlights: [
        "2025-01-15: $2.34×10⁵ to Cyprus Shell",
        "2025-06-22: $1.88×10⁵ to BKCHCNBJXXX",
        "2026-09-23: $1.47×10⁵ active interception wire"
      ]
    },
    locationData: {
      aaTimeline: [
        { time: "2025-01-15 08:32 EST", location: "Atlanta City Hall", coords: "33.7490°N, 84.3880°W" },
        { time: "2025-03-22 14:00 EST", location: "GTRI Wind Tunnel", coords: "33.8900°N, 84.5260°W" },
        { time: "2025-06-10 09:15 EST", location: "Atlanta Airport (KATL)", coords: "33.6407°N, 84.4277°W" },
        { time: "2025-09-01 16:45 EST", location: "Atlanta Hotel", coords: "33.7600°N, 84.3900°W" },
        { time: "2026-01-20 11:20 EST", location: "Fulton Site Primary", coords: "33.8000°N, 84.4800°W" },
        { time: "2026-09-23 00:01 EST", location: "Fulton Site Intercept Active", coords: "33.8000°N, 84.4800°W" }
      ],
      caTimeline: [
        { time: "2025-03-22 14:00 EST", location: "GTRI Wind Tunnel", coords: "33.8900°N, 84.5260°W" },
        { time: "2025-07-04 10:30 EST", location: "Atlanta Mayor's Office", coords: "33.7490°N, 84.3880°W" },
        { time: "2025-11-12 13:20 EST", location: "Decatur Site", coords: "33.7748°N, 84.2963°W" },
        { time: "2026-02-14 09:00 EST", location: "Marietta Avionics Hub", coords: "33.9526°N, 84.5499°W" },
        { time: "2026-09-23 00:02 EST", location: "Fulton Site Auxiliary", coords: "33.7850°N, 84.4650°W" }
      ]
    },
    identifiers: {
      aaEmails: ["aa.eng@gtri.gatech.edu", "aa.mayor@atlantaga.gov"],
      aaSocials: ["Twitter/X: @GTsister_1", "Instagram: @atl_tech_queen"],
      caEmails: ["ca.ew@gtri.gatech.edu", "ca.ops@atlantaga.gov"],
      caSocials: ["WeChat ID: GT‑WindTunnel‑1", "TikTok: @phantom_han"]
    },
    metrics14x: {
      financial: "1.47×10⁵ USD",
      callDurationSec: "3.21×10⁴ s",
      dataVolumeMb: "1.51×10⁶ MB",
      locationPrecisionDeg: "1.41×10⁻⁴ deg (~15m)"
    },
    deviceForensics: {
      transmitter: "WSB-TV Main Transmitter (UHF 32, ERP 869 kW)",
      transmitterMac: "00:WSB:TX:32:01:01",
      newsSet: "WSB-TV Studio News Set (4K LED wall)",
      newsSetMac: "00:WSB:LED:01:01:01",
      intlTraits: "Chinese‑sourced GaN power amplifier (part # BG‑1400A‑S) installed in transmitter exciter; IMEI TAC 86‑319604 indicates Chinese origin for ATL‑CA phone.",
      modifiedEquipment: "WSB transmitter modified with custom RF front‑end amplifier soldered onto exciter board, sourced from Shenzhen. LED wall firmware patched to emit 14.2 MHz HF modulation during refresh cycles, using SM‑4 cipher implementation on Chinese FPGA. MAC 00:WSB:TX:32:01:01 unchanged."
    },
    impact: "Satellite comms disrupted for 14 minutes across Fulton County.",
    evidenceChain: {
      evidenceList: "RF spectrum analyzer logs, transmitter log files, SWIFT trace UID-GA-001",
      sha256: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
      collectedBy: "NSA SIGINT Officer #4472",
      timestamp: "2026‑09‑23T01:00:00Z",
      transferLog: "Signed by officer #4472, verified by lab tech forensics unit",
      admissibility: "Meets 18 USC § 2517 and Federal Rule of Evidence FRE 902(14)"
    },
    federalCharges: [
      "18 USC § 794(a) – Espionage (Transmitting Defense Information)",
      "18 USC § 1956(a)(2) – International Money Laundering",
      "18 USC § 1030(a)(1) – Computer Fraud and Abuse (Critical Infrastructure)"
    ],
    nsaValidation: {
      attribution: "PLA Unit 61398 / FSB State Actor Coordinated Cell",
      validationCode: "GA‑001‑GT‑FINAL"
    },
    forensicMethodology: [
      "Step 1: Captured RF spectrum using Keysight N9020B analyzer",
      "Step 2: Demodulated 32.5 MHz subcarrier using GNU Radio",
      "Step 3: Extracted embedded data via FSK decoder",
      "Step 4: Reverse‑engineered transmitter exciter board, identified GaN amplifier",
      "Step 5: Decrypted VoIP using recovered AES‑256 key from USB",
      "Step 6: Verified financial transfers via SWIFT ledger cross‑check"
    ],
    timestampEst: "00:01 EST",
    dateStr: "SEPTEMBER 23, 2026"
  },
  {
    id: "GA-ANOMALY-002",
    batch: "BATCH 1 OF 4, ANOMALIES 1‑25",
    anomalyNumber: 2,
    verified: true,
    term: "Gwinnett – Norcross Substation SCADA Backdoor Injection",
    definition: "Coordinated PLC logic alteration targeting Georgia Power transmission relays via compromised cellular remote telemetry unit (RTU), synchronizing with offshore clearinghouse nodes.",
    espionageContext: "Norcross Energy Distribution Hub (33.9412°N, 84.2135°W) & Peachtree Corners Tech Corridor.",
    operationalCoordinates: {
      aa: "33.9412°N, 84.2135°W",
      ca: "33.9680°N, 84.1850°W",
      target: "33.9450°N, 84.2000°W (Substation 12B)"
    },
    cmd: "SCADA OVERRIDE SEQUENCE BETA-7",
    decryptedEvidence: {
      usb: "Kingston IronKey 128GB serial IK-9942",
      decryptedString: "高压变电站 控制逻辑注入 (High-Voltage Substation Logic Injection)",
      decryptedVoIP: 'grid isolation confirmed for node 12',
      finalVoice: 'Relay tripped remotely on scheduled phase delay.'
    },
    forensicFlags: [
      "DNP3 packet spoofing detected",
      "Anomalous Modbus function code 0x5A injected",
      "Offshore crypto transaction $8.24×10⁴ routed to Hong Kong exchange",
      "RTU firmware checksum divergence on Sector 4"
    ],
    interceptExpansion: '[Intercept 2026‑09‑23 00:07:44 EST, channel 08 secure radio: ATL‑CA‑2: "The RTU handshake bypassed authentication. We have terminal control on the 230kV bus." ATL‑AA‑2: "Frequency deviation holding at 59.85 Hz. Transfer authorization token confirmed."]',
    financialDetails: {
      unreportedTransfers: "$8.24×10⁴ ($82,400 USD)",
      wireTarget: "Tether USDT node to Hong Kong OTC Desk",
      wireAccount: "0x7a89bc21e901a...c890",
      intermediaryAccounts: 8,
      highlights: [
        "2025-08-14: $1.15×10⁵ preparatory escrow",
        "2026-09-23: $8.24×10⁴ phase-2 execution"
      ]
    },
    phoneRecords: {
      carrier: "Verizon Wireless",
      aaPhone: "+1‑770‑555‑0189",
      aaImei: "35‑882109‑449102‑3",
      caPhone: "+1‑404‑555‑0334",
      caImei: "86‑491023‑881293‑8",
      totalCallDurationSec: "2.14×10⁴ s (~5.94 hrs)",
      dataVolumeMb: "9.84×10⁵ MB (~984 GB)",
      towers: [
        "33.9412°N, 84.2135°W (00:07 EST)",
        "33.9680°N, 84.1850°W (00:09 EST)"
      ]
    },
    bankingHistory: {
      aaAccount: "US‑061000104‑ACCT‑GW1 at Wells Fargo",
      caAccount: "US‑026009593‑ACCT‑GW2 at Bank of America",
      beneficiaryAccount: "HSBC Hong Kong HK‑HSBC‑991002341",
      totalMoved: "$6.82×10⁶ routed across multi-hop mixers",
      highlights: [
        "2025-10-02: $9.40×10⁴ intermediary wash",
        "2026-09-23: $8.24×10⁴ telemetry execution"
      ]
    },
    locationData: {
      aaTimeline: [
        { time: "2026-04-12 10:15 EST", location: "Peachtree Corners Lab", coords: "33.9680°N, 84.1850°W" },
        { time: "2026-09-23 00:07 EST", location: "Norcross Substation Perimeter", coords: "33.9412°N, 84.2135°W" }
      ],
      caTimeline: [
        { time: "2026-05-20 14:30 EST", location: "Duluth Switch Center", coords: "34.0029°N, 84.1446°W" },
        { time: "2026-09-23 00:09 EST", location: "Norcross Tech Node", coords: "33.9450°N, 84.2000°W" }
      ]
    },
    identifiers: {
      aaEmails: ["relay.spec@gw-power-grid.org"],
      aaSocials: ["Signal: @grid_spec_99"],
      caEmails: ["scada.sec@energy-mesh.net"],
      caSocials: ["Telegram: @substation_overwatch"]
    },
    metrics14x: {
      financial: "8.24×10⁴ USD",
      callDurationSec: "2.14×10⁴ s",
      dataVolumeMb: "9.84×10⁵ MB",
      locationPrecisionDeg: "1.12×10⁻⁴ deg (~12m)"
    },
    deviceForensics: {
      transmitter: "Cellular RTU Sierra Wireless RV50X",
      transmitterMac: "00:1E:8C:99:A2:01",
      newsSet: "Substation Human-Machine Interface (HMI) Panel",
      newsSetMac: "00:50:C2:77:88:99",
      intlTraits: "Firmware binary embedded with Guoxun cryptography library.",
      modifiedEquipment: "Cellular gateway antenna modified with high-gain Yagi directional array pointed toward Interstate 85 optical junction."
    },
    impact: "Grid telemetry spoofed for 42 minutes, masking 140 MW power divert.",
    evidenceChain: {
      evidenceList: "DNP3 packet captures, RTU flash dump, OT firewall audit logs",
      sha256: "b2c3d4e5f6789012abcdef34567890abcdef34567890abcdef34567890abcdef",
      collectedBy: "NSA SIGINT Field Operator #5120",
      timestamp: "2026‑09‑23T01:30:00Z",
      transferLog: "Signed by lead critical infrastructure forensic analyst",
      admissibility: "Meets 18 USC § 2517 and FRE 902(14)"
    },
    federalCharges: [
      "18 USC § 1030(a)(5)(A) – Intentional Damage to Protected Critical Infrastructure",
      "18 USC § 794(a) – Gathering/Delivering Defense Information to Foreign Government",
      "18 USC § 1957 – Monetary Transactions in Criminally Derived Property"
    ],
    nsaValidation: {
      attribution: "Unit 61398 Volt Typhoon SCADA Sub-Branch",
      validationCode: "GA‑002‑GW‑FINAL"
    },
    forensicMethodology: [
      "Step 1: Isolated fiber mirror tap on DNP3 control VLAN",
      "Step 2: Extracted malicious 0x5A payload matching custom zero-day exploit",
      "Step 3: Correlated timestamp of packet surge with cellular tower triangulation",
      "Step 4: Executed forensic flash extraction of RTU firmware"
    ],
    timestampEst: "00:07 EST",
    dateStr: "SEPTEMBER 23, 2026"
  },
  {
    id: "GA-ANOMALY-003",
    batch: "BATCH 1 OF 4, ANOMALIES 1‑25",
    anomalyNumber: 3,
    verified: true,
    term: "Chatham – Port of Savannah Crane Automation Telemetry Intercept",
    definition: "Container terminal STS crane automation network intercepted via malicious optical bypass module installed on Berth 4, transmitting real-time DoD munitions container serials.",
    espionageContext: "Port of Savannah Garden City Terminal (32.1319°N, 81.1611°W) & Hunter Army Airfield Corridor.",
    operationalCoordinates: {
      aa: "32.1319°N, 81.1611°W",
      ca: "32.0809°N, 81.0912°W",
      target: "32.1350°N, 81.1550°W (Berth 4 STS Crane #14)"
    },
    cmd: "CARGO TELEMETRY EXFIL SEQUENCE DELTA",
    decryptedEvidence: {
      usb: "Corsair Flash Survivor 256GB serial CSS-2026",
      decryptedString: "港口集装箱 数据拦截 (Port Container Manifest Intercept)",
      decryptedVoIP: 'munitions container manifest exfiltrated successfully',
      finalVoice: 'Vessel departure telemetry locked on transponder channel 16.'
    },
    forensicFlags: [
      "Optical tap bridge detected on fiber switch trunk 3",
      "Unencrypted NMEA-0183 spoof injected into AIS receiver",
      "Offshore payment $2.15×10⁵ cleared through UAE clearing house",
      "Automated terminal operating system (TOS) database queried without audit record"
    ],
    interceptExpansion: '[Intercept 2026‑09‑23 00:14:10 EST, channel 21 marine encrypted link: SAV‑OP‑1: "Crane 14 optical split is broadcasting. The ammunition containers for Fort Stewart are tagged in the feed." SAV‑OP‑2: "Manifest uploaded to satellite uplink. Wire confirmation received from Dubai account."]',
    financialDetails: {
      unreportedTransfers: "$2.15×10⁵ ($215,000 USD)",
      wireTarget: "Mashreq Bank PSC, Dubai, UAE",
      wireAccount: "AE-MSHQ-9900188201",
      intermediaryAccounts: 11,
      highlights: [
        "2025-11-09: $3.50×10⁵ logistics mapping fee",
        "2026-09-23: $2.15×10⁵ live manifest capture execution"
      ]
    },
    phoneRecords: {
      carrier: "T-Mobile USA",
      aaPhone: "+1‑912‑555‑0821",
      aaImei: "35‑990182‑334412‑7",
      caPhone: "+1‑912‑555‑0944",
      caImei: "86‑110293‑774910‑2",
      totalCallDurationSec: "4.12×10⁴ s (~11.4 hrs)",
      dataVolumeMb: "2.35×10⁶ MB (~2.35 TB)",
      towers: [
        "32.1319°N, 81.1611°W (00:14 EST)",
        "32.0809°N, 81.0912°W (00:16 EST)"
      ]
    },
    bankingHistory: {
      aaAccount: "US‑061000104‑ACCT‑CH1 at SunTrust / Truist",
      caAccount: "US‑026009593‑ACCT‑CH2 at Bank of America",
      beneficiaryAccount: "Mashreq Bank UAE AE‑MSHQ‑9900188201",
      totalMoved: "$1.12×10⁷ through logistics trade front entities",
      highlights: [
        "2025-12-01: $4.20×10⁵ freight routing deposit",
        "2026-09-23: $2.15×10⁵ munitions data exfil reward"
      ]
    },
    locationData: {
      aaTimeline: [
        { time: "2026-06-18 08:00 EST", location: "Garden City Terminal Administration", coords: "32.1319°N, 81.1611°W" },
        { time: "2026-09-23 00:14 EST", location: "Berth 4 Crane Maintenance Deck", coords: "32.1350°N, 81.1550°W" }
      ],
      caTimeline: [
        { time: "2026-07-22 19:30 EST", location: "Savannah Riverwalk Safehouse", coords: "32.0809°N, 81.0912°W" },
        { time: "2026-09-23 00:16 EST", location: "Hunter Army Airfield Perimeter North", coords: "32.0200°N, 81.1400°W" }
      ]
    },
    identifiers: {
      aaEmails: ["cargo.terminal@sav-ports.org"],
      aaSocials: ["Threema: @sav_port_recon"],
      caEmails: ["maritime.logistics@asia-freight.cn"],
      caSocials: ["WeChat: MaritimeSavannah26"]
    },
    metrics14x: {
      financial: "2.15×10⁵ USD",
      callDurationSec: "4.12×10⁴ s",
      dataVolumeMb: "2.35×10⁶ MB",
      locationPrecisionDeg: "9.80×10⁻⁵ deg (~10m)"
    },
    deviceForensics: {
      transmitter: "ZPMC STS Crane Integrated Controller & SFP Optical Bridge",
      transmitterMac: "00:ZP:MC:44:12:01",
      newsSet: "Port Operations Control Center Console 7",
      newsSetMac: "00:24:B2:91:00:14",
      intlTraits: "ZPMC built-in cellular modem activated with international SIM roaming profile.",
      modifiedEquipment: "SFP optical transceiver replaced with rogue FPGA-based passive packet replicator."
    },
    impact: "US Army military cargo loading schedules compromised for 18 vessel calls.",
    evidenceChain: {
      evidenceList: "Optical TAP packet pcap, SFP hardware forensic dump, TOS database query logs",
      sha256: "c3d4e5f678901234abcdef45678901abcdef45678901abcdef45678901abcdef",
      collectedBy: "Coast Guard Cyber Protection Team (CPT) & NSA SIGINT Detachment #220",
      timestamp: "2026‑09‑23T02:15:00Z",
      transferLog: "Signed by USCG Cyber lead and Federal Bureau of Investigation Savannah RA",
      admissibility: "Meets 18 USC § 2517 and FRE 902(14)"
    },
    federalCharges: [
      "18 USC § 794(a) – Gathering or Delivering Defense Information to Aid Foreign Government",
      "18 USC § 1030(a)(1) – Espionage Through Computer Intrusion",
      "18 USC § 1956 – Laundering of Monetary Instruments"
    ],
    nsaValidation: {
      attribution: "PLA Navy Intelligence Bureau & Unit 61398 Maritime Target Team",
      validationCode: "GA‑003‑CH‑FINAL"
    },
    forensicMethodology: [
      "Step 1: High-speed fiber optic spectral analysis on STS Crane 14 umbilical",
      "Step 2: Identified wavelength drift indicating non-spec passive beam splitter",
      "Step 3: Recovered rogue SFP unit with integrated hardware packet filter",
      "Step 4: Decrypted outbound cellular stream bound for satellite transponder"
    ],
    timestampEst: "00:14 EST",
    dateStr: "SEPTEMBER 23, 2026"
  }
];
