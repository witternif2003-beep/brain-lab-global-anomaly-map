import { AnomalyItem, CompetitorStateIntel, EvidenceCardItem } from "./schema";

export const GEORGIA_ANOMALIES: AnomalyItem[] = [
  {
    id: "ANOM-GA-001",
    code: "PORT-SAV-THRU-01",
    title: "Port of Savannah Container Dwell & Ocean Terminal Berth Reconstruction Bottleneck",
    entity: "Georgia Ports Authority (Port of Savannah - Garden City & Ocean Terminals)",
    sector: "Logistics",
    severity: "CRITICAL",
    metric: "Intermodal Container Dwell Time & Berth Utilization",
    baseline: "2.8 days avg dwell | 94.2% on-time dispatch",
    observed: "4.7 days peak dwell | 82.1% on-time rail dispatch",
    deviation: "+67.8% dwell deviation (2.4σ anomaly)",
    detectionModel: "STGNN (Spatio-Temporal Graph Neural Net, F1=0.986) + AIS Ingestion",
    confidenceScore: 94.8,
    admiraltyRating: "A1 (Completely Reliable / Confirmed by Primary Port Data)",
    timestamp: "2026-09-20T14:32:00Z",
    location: "Savannah, Chatham County, GA",
    coordinates: [-81.144, 32.128],
    status: "ACTIVE",
    evidenceChain: {
      primarySource: "Georgia Ports Authority FY2026 Operational Reports (5.67M TEU throughput report)",
      corroboratingSource: "AIS Vessel Telemetry + Mason Mega Rail Intermodal Dispatches (UGA Terry College Port Study)",
      verificationStatus: "Cross-verified via satellite transponder & terminal gate sensor telemetry"
    },
    competitorAdvantage: "South Carolina Ports (Port of Charleston - Leatherman & Wando Welch Terminals) offers 1.9-day container dwell with zero terminal reconstruction delays.",
    exploitingStates: ["SC", "NC", "TN"],
    exploitationPlaybook: "Target Savannah-dependent automotive and heavy-machinery shippers along I-95/I-85 corridor citing $1.6B Ocean Terminal reconstruction schedule risk."
  },
  {
    id: "ANOM-GA-002",
    code: "TAX-HB463-HQ-02",
    title: "Corporate Headquarters Tax Credit Statutory Repeal Invalidation",
    entity: "Georgia Department of Revenue / General Assembly (HB 463 Statutory Sunset)",
    sector: "Fiscal & Tax",
    severity: "CRITICAL",
    metric: "Headquarters Creation Investment Credit Availability",
    baseline: "$2,500-$5,000 credit per HQ job across Tier 1-4 counties",
    observed: "0 credit available (Repealed under HB 463 § 4-1 effective Jan 1, 2026; complete tax credit disallowance by 2032)",
    deviation: "-100% statutory credit entitlement for new relocations",
    detectionModel: "Legislative Telemetry Parser + LegiScan Differential Analyzer",
    confidenceScore: 99.2,
    admiraltyRating: "A1 (Official Georgia Code Annotated O.C.G.A. § 48-7-40 Enactment)",
    timestamp: "2026-09-19T09:15:00Z",
    location: "Atlanta, Fulton County, GA",
    coordinates: [-84.388, 33.749],
    status: "CORROBORATED",
    evidenceChain: {
      primarySource: "Georgia General Assembly HB 463 (2026 Regular Session Enrolled Act)",
      corroboratingSource: "Georgia Department of Revenue Tax Policy Bulletins (Income Tax Rule 560-7-8)",
      verificationStatus: "Statutory text reconciled; legislative sunset verified active"
    },
    competitorAdvantage: "North Carolina (2.5% corporate tax dropping to 0% by 2030) and Texas/Florida (0% personal & corporate state income tax) offer perpetual statutory certainty.",
    exploitingStates: ["TX", "NC", "FL", "TN"],
    exploitationPlaybook: "Direct enterprise outreach to Fortune 1000 regional headquarters weighing Atlanta expansions with 'HQ Zero: No 2032 Sunset Cliff' guarantees."
  },
  {
    id: "ANOM-GA-003",
    code: "HLTH-PHYS-ARBIT-03",
    title: "Healthcare Provider Access Deficit & Clinical Retention Asymmetry",
    entity: "Georgia Composite Medical Board / GA Dept of Community Health",
    sector: "Healthcare",
    severity: "HIGH",
    metric: "Active Physicians Per 100k Population & Healthcare Access Rank",
    baseline: "National Average: 298.4 physicians per 100k | Target: Top 25",
    observed: "253.50 physicians per 100k (Ranked 42nd) | Overall Healthcare Access: 49th nationally",
    deviation: "-15.1% vs national physician density baseline (2.1σ clinical deficit)",
    detectionModel: "LSTM-AE Telemetry + Provider Licensing Geospatial Dispersion Analysis",
    confidenceScore: 92.4,
    admiraltyRating: "A2 (WalletHub 2026 State Healthcare Audit / AAMC Physician Workforce)",
    timestamp: "2026-09-18T18:45:00Z",
    location: "Macon / Bibb County & Central Georgia Region",
    coordinates: [-83.632, 32.840],
    status: "ACTIVE",
    evidenceChain: {
      primarySource: "WalletHub 2026 State Healthcare Infrastructure Audit (Rank 49th Access, 43rd Outcomes)",
      corroboratingSource: "Georgia Composite Medical Board Monthly Disciplinary & Verification Disclosures",
      verificationStatus: "Peer-reviewed against AAMC 2026 State Physician Workforce Profiles"
    },
    competitorAdvantage: "North Carolina (Duke Health, UNC Health, Wake Forest) and Tennessee (Vanderbilt, HCA) hold top-tier regional clinical infrastructure and recruitment pipelines.",
    exploitingStates: ["NC", "TN"],
    exploitationPlaybook: "Execute 'Quality of Life & Care Continuity' campaigns recruiting medical professionals and biotechnology executives out of Georgia."
  },
  {
    id: "ANOM-GA-004",
    code: "MFG-MED-PPE-04",
    title: "Medical Equipment, PPE & Pharmaceutical Manufacturing Incentive Sunsetting",
    entity: "Georgia Dept of Economic Development (Life Sciences Recruitment)",
    sector: "Regulatory",
    severity: "HIGH",
    metric: "Medical Device & Pharmaceutical Targeted Abatement Ratio",
    baseline: "$1,250 - $4,000 per net new manufacturing job credit",
    observed: "Repealed effective Jan 1, 2026 under HB 463 § 4-4",
    deviation: "-100% targeted medical manufacturing subsidy margin",
    detectionModel: "XGBoost Incentive Delta Classifier + Corporate Site Selection Crawl",
    confidenceScore: 96.1,
    admiraltyRating: "A1 (Georgia DOR Regulations & HB 463 Statutes)",
    timestamp: "2026-09-17T11:20:00Z",
    location: "Duluth / Gwinnett County Bio-Corridor, GA",
    coordinates: [-84.145, 33.998],
    status: "ACTIVE",
    evidenceChain: {
      primarySource: "Georgia Code § 48-7-40.15B Tax Incentive Expiration Schedule",
      corroboratingSource: "Georgia Bio Industry Association Annual Policy Review",
      verificationStatus: "Verified through statutory legislative index and Department of Revenue filings"
    },
    competitorAdvantage: "North Carolina Research Triangle Park (RTP) provides dedicated life sciences infrastructure grants with long-term capital parity.",
    exploitingStates: ["NC", "SC"],
    exploitationPlaybook: "Present targeted site selection proposals to Gwinnett and Cobb med-tech suppliers showing NC Research Triangle biotech tax credits."
  },
  {
    id: "ANOM-GA-005",
    code: "CONS-DEBT-FIN-05",
    title: "Consumer Market Debt Stress & Delinquency Accumulation Anomaly",
    entity: "Federal Reserve Bank of Atlanta / Federal Reserve Bank of NY Consumer Credit",
    sector: "Labor",
    severity: "HIGH",
    metric: "90+ Day Delinquent Credit Balances & Financial Distress Ranking",
    baseline: "National Avg 90+ Day Delinquency: 8.6% | Distress Rank: Median 25th",
    observed: "13.9% credit card debt 90+ days overdue | 45% struggling with basic costs (Ranked 7th most financially distressed state)",
    deviation: "+61.6% delinquency excess above national median",
    detectionModel: "Non-Parametric Dynamic Thresholding (LSTD-Detect) on NY Fed Microeconomic Data",
    confidenceScore: 91.5,
    admiraltyRating: "B1 (Federal Reserve Consumer Credit Panel / Bureau of Labor Statistics)",
    timestamp: "2026-09-20T11:10:00Z",
    location: "Augusta, Richmond County, GA",
    coordinates: [-81.974, 33.473],
    status: "ACTIVE",
    evidenceChain: {
      primarySource: "NY Fed Consumer Credit Panel / WalletHub Financial Distress Index 2026",
      corroboratingSource: "Georgia Department of Labor UI Claims and Wage Disparity Matrices",
      verificationStatus: "Reconciled with quarterly bankruptcy court docket density (Northern & Southern GA Districts)"
    },
    competitorAdvantage: "Florida, Tennessee, and South Carolina maintain significantly lower debt distress indices and stronger consumer disposable income metrics.",
    exploitingStates: ["FL", "TN", "SC"],
    exploitationPlaybook: "Pitch national retail operators and financial services branch networks to divert capital expansion from Georgia to high-disposable-income FL/SC/TN corridors."
  },
  {
    id: "ANOM-GA-006",
    code: "GRID-DATACENTER-06",
    title: "Data Center Clean Energy Grid Load & 2032 Sales Tax Exemption Horizon",
    entity: "Georgia Power / Public Service Commission (Integrated Resource Plan)",
    sector: "Infrastructure",
    severity: "CRITICAL",
    metric: "Industrial Grid Reserve Margin & High-Density Interconnection Queue",
    baseline: "18% reserve margin requirement | 14-month interconnection queue",
    observed: "Estimated 11.2% projected reserve margin | 38-month high-density interconnection backlog | 2032 Tax Exemption Sunset",
    deviation: "-37.8% reserve margin compression with 2.7x queue inflation",
    detectionModel: "Validation-Gated Continual Learning (VGCL) on PJM/SERC Grid Telemetry",
    confidenceScore: 93.7,
    admiraltyRating: "A2 (Georgia PSC Docket No. 44160 / S&P Global Commodity Insights)",
    timestamp: "2026-09-20T16:05:00Z",
    location: "Douglasville / Douglas County Hyperscale Corridor, GA",
    coordinates: [-84.747, 33.751],
    status: "ACTIVE",
    evidenceChain: {
      primarySource: "Georgia Public Service Commission 2026 Resource Adequacy Filings",
      corroboratingSource: "FERC Form 714 Hourly Electric Telemetry & Interconnection Queue Logs",
      verificationStatus: "Validated against utility substation telemetry and transmission constraints"
    },
    competitorAdvantage: "Texas (ERCOT unregulated interconnection speed) and Virginia (Dominion long-term 2035 exemption framework) offer superior power-to-market speed.",
    exploitingStates: ["TX", "VA", "NC"],
    exploitationPlaybook: "Direct outreach to AI hyperscalers and cloud tenants facing Georgia substation delays with Texas turnkey interconnects and Virginia 2035 protections."
  }
];

export const COMPETITOR_STATES: CompetitorStateIntel[] = [
  {
    stateCode: "NC",
    stateName: "North Carolina",
    coordinates: [-79.019, 35.759],
    primaryAdvantage: "Corporate Tax Dropping to 0% by 2030 + Research Triangle Life Sciences Dominance",
    targetGeorgiaPillar: "Pillar 1 (Talent Arbitrage) & Pillar 2 (Incentive Parity)",
    strategicPlaybook: "Direct poaching of Atlanta Fortune 500 headquarters and Gwinnett/Cobb medical manufacturing facilities exploiting GA HB 463 repeals.",
    keyVulnerabilitiesExploited: [
      "GA Quality of Life ranked 46th nationally (NC ranked 22nd)",
      "GA Healthcare ranked 49th for access (NC boasts Duke, UNC, Wake Forest medical hubs)",
      "GA HQ Tax Credit repealed effective Jan 1, 2026",
      "GA Medical & PPE manufacturing credit repealed"
    ],
    comparativeMetrics: [
      {
        metric: "Corporate Income Tax Rate",
        georgiaValue: "4.99% flat (all tax credits sunsetting by 2032)",
        competitorValue: "2.5% in 2026, phasing down to 0% by 2030",
        advantageDelta: "+2.49% to +4.99% net margin retention for NC",
        source: "NC Dept of Revenue / Tax Foundation 2026 State Business Tax Climate"
      },
      {
        metric: "Overall Quality of Life Score",
        georgiaValue: "51.59 (Ranked 27th overall, 46th quality sub-score)",
        competitorValue: "52.32 (Ranked 22nd overall)",
        advantageDelta: "+5 ranking positions advantage for NC corporate recruitment",
        source: "WalletHub Best States to Live In 2026"
      },
      {
        metric: "Healthcare Access & Outcomes",
        georgiaValue: "49th Access / 43rd Outcomes",
        competitorValue: "Top 20 Academic Medical Integration",
        advantageDelta: "Quantifiable 8-10% employee retention premium",
        source: "AAMC & Commonwealth Fund State Health Scorecard"
      }
    ],
    activeOpportunities: [
      {
        id: "OPP-NC-01",
        title: "Atlanta FinTech & Headquarters Relocation Offensive",
        sector: "Corporate HQ & Financial Services",
        exploitationWindow: "Q4 2026 - Q2 2027",
        roiProjected: "+18.4% Corporate Tax Savings",
        confidenceGrade: "A1",
        status: "ACTIONABLE"
      },
      {
        id: "OPP-NC-02",
        title: "RTP Life Sciences & Medical Supply Reshoring Raid",
        sector: "Life Sciences & Pharma",
        exploitationWindow: "Immediate (0-90 days)",
        roiProjected: "10-Year Guaranteed Incentive Spread",
        confidenceGrade: "A1",
        status: "ENGAGED"
      }
    ]
  },
  {
    stateCode: "TN",
    stateName: "Tennessee",
    coordinates: [-86.580, 35.517],
    primaryAdvantage: "0% Personal Income Tax + Memphis/Nashville Inland Logistics & Healthcare Titan",
    targetGeorgiaPillar: "Pillar 1 (Healthcare/Talent Arbitrage) & Pillar 3 (Consumer Debt Relief)",
    strategicPlaybook: "Capturing Atlanta high-earners fleeing Georgia's 4.99% personal income tax and healthcare deficit, alongside inland rail diversion.",
    keyVulnerabilitiesExploited: [
      "GA 4.99% personal income tax vs TN 0% tax",
      "GA 7th highest consumer financial distress rating",
      "GA 42nd in physician density (253.5/100k) vs TN healthcare clusters (Vanderbilt, HCA)",
      "Savannah intermodal dwell spikes vs Memphis rail hub velocity"
    ],
    comparativeMetrics: [
      {
        metric: "Personal Income Tax Rate",
        georgiaValue: "4.99% individual rate",
        competitorValue: "0.00% (Hall Tax fully eliminated)",
        advantageDelta: "Direct 4.99% immediate take-home pay wage arbitrage",
        source: "TN Dept of Revenue / GA DOR"
      },
      {
        metric: "Physician Density / Medical Infrastructure",
        georgiaValue: "253.5 per 100k (42nd nationally)",
        competitorValue: "Vanderbilt & HCA global hospital headquarters hub",
        advantageDelta: "Superior clinical access for corporate employee benefits",
        source: "AAMC State Physician Workforce Profiles"
      },
      {
        metric: "Intermodal Inland Rail Connectivity",
        georgiaValue: "Savannah Mason Mega Rail 541k containers",
        competitorValue: "Memphis 5 Class-I Railroad crossroads",
        advantageDelta: "24-hour delivery reach to 45 states without coastal port congestion",
        source: "Federal Railroad Administration / Freight Analysis Framework"
      }
    ],
    activeOpportunities: [
      {
        id: "OPP-TN-01",
        title: "Executive & Tech Talent Tax Arbitrage Pipeline",
        sector: "Technology & Professional Services",
        exploitationWindow: "Immediate",
        roiProjected: "4.99% Annual Gross Payroll Efficiency",
        confidenceGrade: "A1",
        status: "ACTIONABLE"
      },
      {
        id: "OPP-TN-02",
        title: "Midwest Cargo Inland Rail Routing Optimization",
        sector: "Logistics & Distribution",
        exploitationWindow: "Q1 2027",
        roiProjected: "-14% Dwell Cost Reduction",
        confidenceGrade: "B1",
        status: "SURFACED"
      }
    ]
  },
  {
    stateCode: "FL",
    stateName: "Florida",
    coordinates: [-81.515, 27.664],
    primaryAdvantage: "0% Personal Income Tax + #6 Quality of Life + Capital Relocation Magnet",
    targetGeorgiaPillar: "Pillar 1 (Quality of Life) & Pillar 3 (Consumer Market Risk)",
    strategicPlaybook: "Siphoning high-net-worth founders, financial firms, and corporate headquarters out of Atlanta into Miami/Tampa/Orlando.",
    keyVulnerabilitiesExploited: [
      "GA ranked #27 overall / 4th worst state to live in (CNBC) vs FL #6 overall (WalletHub)",
      "GA 13.9% of credit card debts overdue by 90+ days vs robust FL consumer liquidity",
      "GA Headquarters Tax Credit statutory cancellation",
      "Port of Savannah vessel wait times vs JAXPORT/PortMiami rapid berthing"
    ],
    comparativeMetrics: [
      {
        metric: "Overall Quality of Life & Economy Rank",
        georgiaValue: "Ranked 27th overall (WalletHub 2026)",
        competitorValue: "Ranked 6th overall (Score: 58.51)",
        advantageDelta: "+21 ranking spots lead over Georgia",
        source: "WalletHub 2026 Best States to Live In"
      },
      {
        metric: "Personal Income Tax Rate",
        georgiaValue: "4.99%",
        competitorValue: "0.00%",
        advantageDelta: "Perpetual constitutional 0% tax guarantee",
        source: "Florida Constitution Article VII"
      },
      {
        metric: "Consumer Financial Solvency",
        georgiaValue: "7th most distressed state; 45% struggling with necessities",
        competitorValue: "Top quartile retail spending growth index",
        advantageDelta: "Lower credit default risk for retail and commercial tenants",
        source: "Federal Reserve Bank of NY / Consumer Financial Protection Bureau"
      }
    ],
    activeOpportunities: [
      {
        id: "OPP-FL-01",
        title: "Wealth Management & Family Office Exfiltration",
        sector: "Financial Services & Asset Management",
        exploitationWindow: "Continuous",
        roiProjected: "Zero State Capital Gains & Income Tax",
        confidenceGrade: "A1",
        status: "ACTIONABLE"
      },
      {
        id: "OPP-FL-02",
        title: "JAXPORT Southeast Distribution Relocation",
        sector: "Maritime & Cold Storage Logistics",
        exploitationWindow: "Q4 2026",
        roiProjected: "+12% Port Turnaround Velocity",
        confidenceGrade: "A2",
        status: "ENGAGED"
      }
    ]
  },
  {
    stateCode: "SC",
    stateName: "South Carolina",
    coordinates: [-81.163, 33.836],
    primaryAdvantage: "Direct Port of Charleston 52-Foot Deepwater Parity + Upstate Automotive Corridor",
    targetGeorgiaPillar: "Pillar 1 (Savannah Port Arbitrage) & Pillar 2 (Manufacturing Abatements)",
    strategicPlaybook: "Direct freight poaching from Port of Savannah by marketing Charleston's Hugh Leatherman Terminal and inland ports in Greer and Dillon.",
    keyVulnerabilitiesExploited: [
      "Port of Savannah Ocean Terminal reconstruction bottleneck ($1.6B 10-year disruption)",
      "GA Port Tax Credit repealed under HB 463 § 4-2",
      "GA EV & Alternative Fuel manufacturing credit sunsetted",
      "I-95 corridor border proximity allowing seamless cross-state freight switching"
    ],
    comparativeMetrics: [
      {
        metric: "Port Harbor Depth & Ultra-Large Container Vessel Access",
        georgiaValue: "Savannah harbor 47 feet (tide dependent for 16k+ TEU vessels)",
        competitorValue: "Charleston harbor 52 feet (deepest harbor on East Coast, any tide)",
        advantageDelta: "Unrestricted navigation window for fully laden Post-Panamax ships",
        source: "US Army Corps of Engineers / SC Ports Authority"
      },
      {
        metric: "Port Volume Tax Credit Continuity",
        georgiaValue: "Repealed effective Jan 1, 2026 under HB 463",
        competitorValue: "SC Port Volume Tax Credit active & discretionary",
        advantageDelta: "Direct tax credit per container exported/imported through SC",
        source: "SC Department of Revenue / SC Ports"
      },
      {
        metric: "Automotive & EV Incentive Parity",
        georgiaValue: "Repealed clean fuel/EV manufacturing tax credits",
        competitorValue: "Scout Motors & BMW dedicated manufacturing packages",
        advantageDelta: "Dedicated supplier tier property tax abatements",
        source: "SC Dept of Commerce"
      }
    ],
    activeOpportunities: [
      {
        id: "OPP-SC-01",
        title: "Savannah Container Volume Shifting to Charleston",
        sector: "Maritime Trade & Freight Forwarding",
        exploitationWindow: "Immediate (0-60 days)",
        roiProjected: "$180-$320 per box savings on demurrage/dwell",
        confidenceGrade: "A1",
        status: "ACTIONABLE"
      },
      {
        id: "OPP-SC-02",
        title: "I-85 Tier 1 Automotive Supplier Border Crossing",
        sector: "Automotive & Advanced Manufacturing",
        exploitationWindow: "Q1-Q2 2027",
        roiProjected: "Long-Term SC Job Development Credits",
        confidenceGrade: "A2",
        status: "SURFACED"
      }
    ]
  },
  {
    stateCode: "TX",
    stateName: "Texas",
    coordinates: [-99.901, 31.968],
    primaryAdvantage: "0% Corporate & Personal Income Tax + Unlimited AI Data Center Infrastructure Scale",
    targetGeorgiaPillar: "Pillar 2 (Incentive Parity & Data Centers) & Pillar 3 (Financial Base)",
    strategicPlaybook: "Capturing multi-billion-dollar hyperscale AI data centers and global corporate headquarters facing Georgia's 2032 credit cliff and grid queues.",
    keyVulnerabilitiesExploited: [
      "GA all income tax credits sunsetting in 2032",
      "GA data center sales tax exemption slated to expire 2032 vs TX Chapter 312/380 long-term deals",
      "Georgia Power grid capacity crunch (reserve margin dropping to 11.2%)",
      "GA corporate income tax at 4.99% vs TX 0% corporate income tax"
    ],
    comparativeMetrics: [
      {
        metric: "Corporate State Income Tax Rate",
        georgiaValue: "4.99% (all credits ending 2032)",
        competitorValue: "0.00% (No state corporate income tax, gross margin tax capped at 0.75%)",
        advantageDelta: "Uncapped profit margin retention for hyperscalers",
        source: "Texas Comptroller of Public Accounts"
      },
      {
        metric: "Data Center Incentive Horizon",
        georgiaValue: "Sunset 2032 under statutory review",
        competitorValue: "Perpetual equipment and electricity sales tax exemptions",
        advantageDelta: "Zero sunset risk over 20-30 year facility lifecycles",
        source: "Texas Economic Development & Tourism Office"
      },
      {
        metric: "Power Grid Interconnection Speed",
        georgiaValue: "38-month high-density substation queue in Metro Atlanta",
        competitorValue: "ERCOT autonomous generation & private co-location microgrids",
        advantageDelta: "Up to 24 months faster speed-to-energization",
        source: "S&P Global Energy / ERCOT Resource Adequacy Report"
      }
    ],
    activeOpportunities: [
      {
        id: "OPP-TX-01",
        title: "Hyperscale AI Campus Diversion to Central Texas",
        sector: "Data Centers & Cloud Infrastructure",
        exploitationWindow: "0-180 days",
        roiProjected: "$45M-$120M Tax & Power Savings per 100MW campus",
        confidenceGrade: "A1",
        status: "ACTIONABLE"
      },
      {
        id: "OPP-TX-02",
        title: "Fortune 500 Global HQ Relocation Campaign",
        sector: "Enterprise Management",
        exploitationWindow: "Q2 2027",
        roiProjected: "Comprehensive Corporate Tax Shield",
        confidenceGrade: "B1",
        status: "ENGAGED"
      }
    ]
  }
];

export const EVIDENCE_CARDS: EvidenceCardItem[] = [
  {
    id: "EVID-001",
    title: "Port of Savannah Container Throughput & Terminal Performance FY2026",
    source: "Georgia Ports Authority (GPA) Official Operational Record",
    sourceUrl: "https://gaports.com",
    datasetId: "GPA-FY26-THROUGHPUT-ANNUAL",
    scope: "state",
    state: "GA",
    county: "Chatham County",
    retrievedAt: "2026-09-20T10:00:00Z",
    periodStart: "2025-07-01",
    periodEnd: "2026-06-30",
    value: 5.67,
    unit: "Million TEUs",
    license: "Public Domain / State Authority Disclosure",
    licenseUrl: "https://gaports.com",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A1",
    confidencePercent: 99.5,
    notes: "Total container volume reached 5.67M TEU. Ocean Terminal $1.6B redevelopment active to scale to 1.75M TEU. Intermodal rail volume reached 541,405 containers via Mason Mega Rail.",
    pillar: "LOGISTICS"
  },
  {
    id: "EVID-002",
    title: "Enacted House Bill 463 Tax Credit Repeal Audit",
    source: "Georgia General Assembly — Act 463 (2026 Regular Session)",
    sourceUrl: "https://www.legis.ga.gov",
    datasetId: "GA-LEG-HB463-ENROLLED",
    scope: "state",
    state: "GA",
    retrievedAt: "2026-09-19T14:20:00Z",
    periodStart: "2026-01-01",
    periodEnd: "2032-12-31",
    value: "HB 463 § 4-1 to 4-9 Repealed",
    unit: "Statutory Repeals",
    license: "Public Record / Official State Law",
    licenseUrl: "https://www.legis.ga.gov",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A1",
    confidencePercent: 100.0,
    notes: "Repealed Headquarters Tax Credit, Port Activity credits, Teleworking credits, Medical manufacturing credits, and Clean-fuel vehicle credits. Mandates total income tax credit sunset starting 2032.",
    pillar: "INCENTIVES"
  },
  {
    id: "EVID-003",
    title: "WalletHub 2026 Best States to Live In & Quality of Life Audit",
    source: "WalletHub Research & US Census / CDC / BLS Cross-Dataset",
    sourceUrl: "https://wallethub.com/edu/best-states-to-live-in/6262",
    datasetId: "WH-2026-LIVABILITY-INDEX",
    scope: "national",
    state: "GA",
    retrievedAt: "2026-09-18T16:00:00Z",
    periodStart: "2026-01-01",
    periodEnd: "2026-08-31",
    value: 51.59,
    unit: "Composite Score (Rank #27 overall, Quality of Life Sub-score: 89/290, Rank #46)",
    license: "Open Editorial / Public Reference",
    licenseUrl: "https://wallethub.com",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A2",
    confidencePercent: 94.0,
    notes: "Georgia placed 27th overall. North Carolina ranked 22nd (52.32), Florida ranked 6th (58.51). In quality of life specific evaluation, Georgia placed 46th nationally with 89/290 points.",
    pillar: "WORKFORCE_QUALITY"
  },
  {
    id: "EVID-004",
    title: "Healthcare Infrastructure, Physician Supply & Clinical Access Audit 2026",
    source: "Association of American Medical Colleges (AAMC) & WalletHub Health",
    sourceUrl: "https://www.aamc.org/data-reports",
    datasetId: "AAMC-2026-PHYSICIAN-DENSITY",
    scope: "state",
    state: "GA",
    retrievedAt: "2026-09-18T11:30:00Z",
    periodStart: "2025-01-01",
    periodEnd: "2026-06-30",
    value: 253.5,
    unit: "Physicians per 100k Population (Ranked 42nd; Healthcare Access Rank 49th)",
    license: "Public Medical Research Data",
    licenseUrl: "https://www.aamc.org",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A1",
    confidencePercent: 96.5,
    notes: "Georgia has 253.50 physicians per 100,000 residents, placing it 42nd nationwide. Healthcare access ranked 49th and outcomes ranked 43rd, exposing significant vulnerability for corporate healthcare benefits.",
    pillar: "WORKFORCE_QUALITY"
  },
  {
    id: "EVID-005",
    title: "Consumer Debt Delinquency & Household Financial Distress Indicators",
    source: "Federal Reserve Bank of New York Center for Microeconomic Data",
    sourceUrl: "https://www.newyorkfed.org/microeconomics/hhdc",
    datasetId: "FRBNY-HHDC-2026-Q2",
    scope: "state",
    state: "GA",
    retrievedAt: "2026-09-19T08:00:00Z",
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    value: 13.9,
    unit: "% Credit Card Balances 90+ Days Overdue (Ranked #7 Most Distressed State)",
    license: "US Federal Reserve Public Domain",
    licenseUrl: "https://www.newyorkfed.org",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A1",
    confidencePercent: 98.0,
    notes: "Georgia ranked 7th most financially distressed state in the United States; 45% of residents report difficulty meeting basic household expenses. Student loan delinquency rate stands at 10.7%.",
    pillar: "FISCAL_STRESS"
  },
  {
    id: "EVID-006",
    title: "Georgia Labor Force & Non-Farm Employment Telemetry",
    source: "Bureau of Labor Statistics (BLS LAUS) & Georgia Department of Labor",
    sourceUrl: "https://www.bls.gov/lau/",
    datasetId: "BLS-LAUS-LASST130000000000003",
    scope: "state",
    state: "GA",
    retrievedAt: "2026-09-20T09:45:00Z",
    periodStart: "2026-05-01",
    periodEnd: "2026-06-30",
    value: 5477859,
    unit: "Total Civilian Labor Force (Unemployment Rate: 3.5%)",
    license: "US Government Work / Public Domain",
    licenseUrl: "https://www.bls.gov",
    reviewStatus: "VERIFIED",
    admiraltyScore: "A1",
    confidencePercent: 99.0,
    notes: "Total labor force reached record 5.48M. Health care added +26,500 jobs, but significant job contractions occurred in federal government (-11,400) and transportation/warehousing/utilities (-5,000).",
    pillar: "LOGISTICS"
  }
];
