export interface TelemetryStreamItem {
  id: string;
  name: string;
  category: "Logistics & Maritime" | "Macro & Labor" | "Fiscal & Legislative" | "Infrastructure & Energy" | "Corporate & Capital" | "Regulatory & Environmental";
  endpoint: string;
  authType: "Keyless / Public REST" | "Keyless / Public OCDS" | "Public Domain / Open Data" | "US Gov Open Data";
  sampleRate: string;
  samplingProtocol: string;
  status: "ONLINE" | "SYNCHRONIZED" | "ACTIVE";
  latencyMs: number;
  anomalyScoreAvg: number;
  admiraltyRating: "A1" | "A2" | "B1" | "B2";
  primaryPillarTargeted: "Pillar 1: Logistics Infrastructure" | "Pillar 2: Incentive Parity" | "Pillar 3: Consumer & Labor Distress";
  exploitingStates: string[];
}

export const TELEMETRY_STREAMS: TelemetryStreamItem[] = [
  {
    id: "STREAM-001",
    name: "Georgia Ports Authority (Port of Savannah) Automated AIS & Berth Telemetry",
    category: "Logistics & Maritime",
    endpoint: "https://gaports.com/operations/berth-throughput",
    authType: "Public Domain / Open Data",
    sampleRate: "Near Real-Time (1 Hz AIS + 15m EDI gate)",
    samplingProtocol: "STGNN (Spatio-Temporal Graph Neural Net F1: 0.986)",
    status: "ONLINE",
    latencyMs: 120,
    anomalyScoreAvg: 88.4,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 1: Logistics Infrastructure",
    exploitingStates: ["SC", "NC", "TN"]
  },
  {
    id: "STREAM-002",
    name: "Mason Mega Rail Intermodal Departure Velocity & Dwell Feeds",
    category: "Logistics & Maritime",
    endpoint: "https://gaports.com/rail/intermodal-mason",
    authType: "Public Domain / Open Data",
    sampleRate: "Hourly rail manifest reconciliations",
    samplingProtocol: "LSTD-Detect Dynamic Thresholding",
    status: "ONLINE",
    latencyMs: 145,
    anomalyScoreAvg: 79.2,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 1: Logistics Infrastructure",
    exploitingStates: ["TN", "SC"]
  },
  {
    id: "STREAM-003",
    name: "BLS Local Area Unemployment Statistics (LAUS) - Georgia 14 MSAs & 159 Counties",
    category: "Macro & Labor",
    endpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data/LASST130000000000003",
    authType: "Keyless / Public REST",
    sampleRate: "Monthly official baseline + weekly model projection",
    samplingProtocol: "LSTM-AE Continual Learning (VGCL F0.5: 92.9%)",
    status: "SYNCHRONIZED",
    latencyMs: 85,
    anomalyScoreAvg: 64.1,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 3: Consumer & Labor Distress",
    exploitingStates: ["NC", "TN", "FL"]
  },
  {
    id: "STREAM-004",
    name: "Georgia Department of Labor WARN Act Mass Layoff Warning Stream",
    category: "Macro & Labor",
    endpoint: "https://dol.georgia.gov/warn-notices",
    authType: "Public Domain / Open Data",
    sampleRate: "Daily event ingest",
    samplingProtocol: "Isolation Forest + XGBoost Ensemble",
    status: "ACTIVE",
    latencyMs: 95,
    anomalyScoreAvg: 82.7,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 3: Consumer & Labor Distress",
    exploitingStates: ["NC", "FL", "SC"]
  },
  {
    id: "STREAM-005",
    name: "Georgia General Assembly Enacted Legislation & HB 463 Tax Sunset Monitor",
    category: "Fiscal & Legislative",
    endpoint: "https://www.legis.ga.gov/legislation/all",
    authType: "Keyless / Public REST",
    sampleRate: "Continuous session scraper & diff engine",
    samplingProtocol: "Differential Regulatory State Machine",
    status: "ONLINE",
    latencyMs: 110,
    anomalyScoreAvg: 99.1,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["TX", "NC", "FL", "TN", "SC", "VA", "AL"]
  },
  {
    id: "STREAM-006",
    name: "Georgia Department of Revenue Monthly Tax Collection & Credit Utilization Bulletins",
    category: "Fiscal & Legislative",
    endpoint: "https://dor.georgia.gov/reports/monthly-revenues",
    authType: "Public Domain / Open Data",
    sampleRate: "Monthly treasury reconciliation",
    samplingProtocol: "CADM Creative Accounting & Deficit Modeling",
    status: "SYNCHRONIZED",
    latencyMs: 130,
    anomalyScoreAvg: 73.5,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["FL", "TN", "TX"]
  },
  {
    id: "STREAM-007",
    name: "Georgia Power & SERC Reliability Corporation Substation & Interconnection Queue",
    category: "Infrastructure & Energy",
    endpoint: "https://www.ferc.gov/industries-data/electric/power-sales-and-markets/form-714",
    authType: "US Gov Open Data",
    sampleRate: "Hourly FERC Form 714 grid load & reserve margin",
    samplingProtocol: "VGCL Telemetry Anomaly Detector",
    status: "ONLINE",
    latencyMs: 210,
    anomalyScoreAvg: 91.3,
    admiraltyRating: "A2",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["TX", "VA", "NC"]
  },
  {
    id: "STREAM-008",
    name: "Federal Reserve Bank of New York Consumer Credit Panel (GA Household Debt Stress)",
    category: "Macro & Labor",
    endpoint: "https://www.newyorkfed.org/microeconomics/hhdc",
    authType: "US Gov Open Data",
    sampleRate: "Quarterly longitudinal panel + weekly high-frequency proxies",
    samplingProtocol: "Non-Parametric Dynamic Thresholding",
    status: "ONLINE",
    latencyMs: 90,
    anomalyScoreAvg: 85.0,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 3: Consumer & Labor Distress",
    exploitingStates: ["FL", "TN", "SC"]
  },
  {
    id: "STREAM-009",
    name: "SEC EDGAR Public Financial Submissions (Georgia Public Companies & Filers)",
    category: "Corporate & Capital",
    endpoint: "https://data.sec.gov/submissions",
    authType: "Keyless / Public REST",
    sampleRate: "Continuous real-time 8-K, 10-Q, 10-K ingest",
    samplingProtocol: "XBRL Tag Extractor + Distress Scorer",
    status: "ONLINE",
    latencyMs: 65,
    anomalyScoreAvg: 71.8,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["NC", "TX", "FL"]
  },
  {
    id: "STREAM-010",
    name: "EPA ECHO Environmental Compliance & Facility Enforcement (GA Industrial Sites)",
    category: "Regulatory & Environmental",
    endpoint: "https://echodata.epa.gov/echo/echo_rest_services.get_facilities",
    authType: "Keyless / Public REST",
    sampleRate: "Daily enforcement action sync",
    samplingProtocol: "Multi-Source Compliance Graph",
    status: "ONLINE",
    latencyMs: 140,
    anomalyScoreAvg: 68.3,
    admiraltyRating: "A1",
    primaryPillarTargeted: "Pillar 1: Logistics Infrastructure",
    exploitingStates: ["SC", "NC"]
  },
  {
    id: "STREAM-011",
    name: "Georgia Procurement Registry (GPR) & GA@WORK Sourcing Notices",
    category: "Corporate & Capital",
    endpoint: "https://ssl.doas.state.ga.us/PRSapp/PR_index.jsp",
    authType: "Public Domain / Open Data",
    sampleRate: "Daily public bid updates (650+ active tenders)",
    samplingProtocol: "OpenTender OCDS Schema Parser",
    status: "ONLINE",
    latencyMs: 180,
    anomalyScoreAvg: 74.6,
    admiraltyRating: "A2",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["NC", "TN", "VA"]
  },
  {
    id: "STREAM-012",
    name: "Arena AI Leaderboard Auto-Snapshot Benchmark Telemetry (Open Source ML Eval)",
    category: "Infrastructure & Energy",
    endpoint: "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboards",
    authType: "Keyless / Public REST",
    sampleRate: "Daily ELO rank reconciliation",
    samplingProtocol: "Automated Benchmark Verifier",
    status: "ONLINE",
    latencyMs: 75,
    anomalyScoreAvg: 52.0,
    admiraltyRating: "A2",
    primaryPillarTargeted: "Pillar 2: Incentive Parity",
    exploitingStates: ["NC", "TX", "FL", "TN", "SC"]
  }
];

export interface VerifiedReportItem {
  id: string;
  slug: string;
  title: string;
  date: string;
  pillar: string;
  admiraltyRating: string;
  confidence: number;
  leadAnalyst: string;
  summary: string;
  targetGeorgiaVulnerability: string;
  competitorActionItems: {
    state: string;
    action: string;
    roiProjected: string;
  }[];
  primarySources: string[];
}

export const VERIFIED_REPORTS: VerifiedReportItem[] = [
  {
    id: "REP-2026-09-01",
    slug: "savannah-ocean-terminal-reconstruction-dwell-analysis",
    title: "Port of Savannah Ocean Terminal Reconstruction: Strategic Dwell Inflation & South Carolina Diversion Window",
    date: "September 20, 2026",
    pillar: "Pillar 1: Logistics Infrastructure",
    admiraltyRating: "A1 (Completely Reliable / Confirmed by GPA Data)",
    confidence: 96.8,
    leadAnalyst: "Dr. Liliya — Senior Cognitive Intelligence Fellow",
    summary: "Evaluation of the Georgia Ports Authority $1.6B Ocean Terminal reconstruction indicates persistent intermodal container dwell spikes (+67.8% over baseline) at Garden City and Ocean terminals. This creates a multi-quarter vulnerability that the Port of Charleston (SC Ports) and Memphis inland logistics rail networks can directly capture.",
    targetGeorgiaVulnerability: "Savannah container dwell averaging 4.7 days with 82.1% on-time rail dispatch during reconstruction, coupled with statutory repeal of the Georgia Port Tax Credit under HB 463 § 4-2.",
    competitorActionItems: [
      {
        state: "South Carolina (SC)",
        action: "Launch aggressive port volume incentive matching targeting Savannah's top 25 automotive and industrial importers, highlighting Charleston's 52-foot unrestricted deepwater access.",
        roiProjected: "+$320 per container freight cost and demurrage savings"
      },
      {
        state: "Tennessee (TN)",
        action: "Market Memphis 5-Class-I railroad crossroads to Midwestern shippers currently clearing through Savannah Mason Mega Rail.",
        roiProjected: "-14% intermodal transit cycle latency"
      }
    ],
    primarySources: [
      "Georgia Ports Authority FY2026 Throughput Summary (5.67M TEUs)",
      "UGA Terry College of Business Port Economic Study",
      "SC Ports Authority Terminal Efficiency & Depth Telemetry"
    ]
  },
  {
    id: "REP-2026-09-02",
    slug: "hb-463-tax-credit-repeal-impact-on-headquarters-and-life-sciences",
    title: "Enacted Georgia HB 463: Statutory Headquarters & Life Sciences Credit Repeal Exploitation",
    date: "September 19, 2026",
    pillar: "Pillar 2: Incentive Parity",
    admiraltyRating: "A1 (Statutory Legal Proof / O.C.G.A. § 48-7-40)",
    confidence: 99.4,
    leadAnalyst: "Cognitive Microstructure Research Group",
    summary: "Georgia House Bill 463 eliminated corporate Headquarters Tax Credits and medical device manufacturing tax credits effective January 1, 2026, and codified a complete sunset of all state income tax credits by 2032. North Carolina, Florida, and Texas can exploit this statutory certainty cliff.",
    targetGeorgiaVulnerability: "Complete disallowance of headquarters creation credits and 2032 tax credit cliff vs. North Carolina's 2.5% corporate tax dropping to 0% by 2030, and Florida/Texas's perpetual 0% income tax.",
    competitorActionItems: [
      {
        state: "North Carolina (NC)",
        action: "Deploy 'HQ Zero' campaigns into Metro Atlanta Fortune 1000 finance and tech clusters with guaranteed 10-year corporate tax immunity.",
        roiProjected: "+18.4% Net Margin Expansion for Relocating HQs"
      },
      {
        state: "Texas (TX)",
        action: "Direct outreach to AI hyperscalers and med-tech campuses offering Chapter 312/380 long-term sales and equipment tax exemption agreements.",
        roiProjected: "$45M - $120M State Tax Shield per Campus"
      }
    ],
    primarySources: [
      "Georgia General Assembly Act 463 (2026 Session)",
      "Georgia Department of Revenue Income Tax Bulletins",
      "NC Department of Revenue 2026-2030 Corporate Tax Reduction Schedule"
    ]
  },
  {
    id: "REP-2026-09-03",
    slug: "georgia-healthcare-deficit-and-consumer-debt-distress",
    title: "Talent Arbitrage: Exploiting Georgia's 49th Healthcare Ranking & Consumer Debt Stress Index",
    date: "September 18, 2026",
    pillar: "Pillar 3: Consumer & Labor Distress",
    admiraltyRating: "A2 (WalletHub, AAMC & NY Fed Corroboration)",
    confidence: 94.2,
    leadAnalyst: "Post-Doctorate Behavioral & Talent Econometrics",
    summary: "Cross-referencing AAMC physician workforce profiles (GA ranked 42nd with 253.50 MDs/100k) with WalletHub's 49th healthcare access ranking and the NY Fed Consumer Credit Panel (13.9% of credit cards 90+ days delinquent) reveals an acute employee retention vulnerability for Georgia companies.",
    targetGeorgiaVulnerability: "Georgia ranked 7th most financially distressed state in the US; 45% of residents report difficulty meeting basic household costs; severe acute care access deficit in non-metro counties.",
    competitorActionItems: [
      {
        state: "North Carolina (NC)",
        action: "Recruit clinical research executives and specialized medical talent from Atlanta to Duke Health, UNC Health, and Wake Forest medical hubs.",
        roiProjected: "8-10% Employee Retention and Productivity Premium"
      },
      {
        state: "Florida (FL)",
        action: "Target high-income wealth management and retail operators in Georgia highlighting Florida's #6 national quality of life index and 0% personal income tax.",
        roiProjected: "Direct 4.99% Immediate Take-Home Wage Arbitrage"
      }
    ],
    primarySources: [
      "WalletHub 2026 State Healthcare Infrastructure Audit",
      "AAMC 2026 State Physician Workforce Profiles",
      "Federal Reserve Bank of New York Consumer Credit Panel (Q2 2026)"
    ]
  }
];
