export interface PillarExploitationStrategy {
  pillarId: "pillar-1-logistics" | "pillar-2-incentives" | "pillar-3-diversified-base";
  pillarTitle: string;
  georgiaEconomicAnchor: string;
  statewideImpactBaseline: string;
  detectedStructuralVulnerability: string;
  telemetryEvidenceMetrics: {
    metric: string;
    baseline: string;
    observedTelemetry: string;
    deviationZScore: string;
    verifiedPrimarySource: string;
  }[];
  competitorAllocations: {
    stateCode: "NC" | "TN" | "FL" | "SC" | "TX" | "VA" | "AL";
    stateName: string;
    strategicAdvantageVector: string;
    executiveInterventionPlaybook: string;
    quantifiableFinancialYield: string;
    timeHorizon: string;
    confidenceGrade: "A1" | "A2";
  }[];
}

export const EXECUTIVE_PILLAR_STRATEGIES: PillarExploitationStrategy[] = [
  {
    pillarId: "pillar-1-logistics",
    pillarTitle: "Pillar I: Logistics Infrastructure & Maritime Trade Corridors",
    georgiaEconomicAnchor: "Georgia Ports Authority (Port of Savannah Garden City / Ocean Terminal & Port of Brunswick)",
    statewideImpactBaseline: "$181 Billion annual economic impact | 605,616 supported jobs (12% of statewide employment) | $44B personal income | 5.67M TEUs in FY2026",
    detectedStructuralVulnerability: "Savannah $1.6B Ocean Terminal reconstruction container berth capacity constraint, resulting in 4.7-day intermodal container dwell spikes (+67.8% deviation) and severe drayage queue tailbacks at Gate 3 along I-95/GA-21.",
    telemetryEvidenceMetrics: [
      {
        metric: "Port Container Dwell Time",
        baseline: "2.8 days average dwell",
        observedTelemetry: "4.7 days peak dwell (2.4σ anomaly)",
        deviationZScore: "+2.42σ",
        verifiedPrimarySource: "Georgia Ports Authority FY2026 Operational Reports"
      },
      {
        metric: "Mason Mega Rail On-Time Dispatch",
        baseline: "94.2% on-time rail dispatch",
        observedTelemetry: "82.1% on-time departure rate",
        deviationZScore: "-2.67σ",
        verifiedPrimarySource: "UGA Terry College of Business Port Economic Study & AIS Feeds"
      },
      {
        metric: "Port Activity Tax Credit Legal Status",
        baseline: "$1,250-$4,000 credit per container increase",
        observedTelemetry: "0 statutory credit (Repealed under HB 463 § 4-2 Jan 1, 2026)",
        deviationZScore: "-100% subsidy elimination",
        verifiedPrimarySource: "Georgia General Assembly HB 463 Enacted Statute"
      }
    ],
    competitorAllocations: [
      {
        stateCode: "SC",
        stateName: "South Carolina",
        strategicAdvantageVector: "Port of Charleston 52-Foot Deepwater Harbor & Active Port Volume Tax Credits",
        executiveInterventionPlaybook: "Direct enterprise outreach to top 25 Savannah-clearing automotive (BMW, Scout Motors supply chain) and heavy machinery importers. Pitch Charleston's Hugh Leatherman Terminal offering zero tidal wait restrictions and active Job Development Credits.",
        quantifiableFinancialYield: "$180 - $320 savings per container on dwell, demurrage, and drayage delay costs",
        timeHorizon: "Immediate execution window (0 - 60 days)",
        confidenceGrade: "A1"
      },
      {
        stateCode: "TN",
        stateName: "Tennessee",
        strategicAdvantageVector: "Memphis 5 Class-I Railroad Crossroads & 0% Personal Income Tax",
        executiveInterventionPlaybook: "Target rail-dependent Midwestern manufacturers currently routing through Savannah's Mason Mega Rail. Market Memphis Class-I intermodal multi-gateway redundancy with single-day delivery reach to 45 US states.",
        quantifiableFinancialYield: "-14% to -18% intermodal supply chain latency reduction",
        timeHorizon: "Q4 2026 - Q2 2027",
        confidenceGrade: "A1"
      }
    ]
  },
  {
    pillarId: "pillar-2-incentives",
    pillarTitle: "Pillar II: Incentive-Driven Industrial Recruitment & Tax Credit Stability",
    georgiaEconomicAnchor: "Georgia Dept of Economic Development (GDEcD) & Tier 1-4 County Job Tax Credit Abatements",
    statewideImpactBaseline: "Over $24B in corporate capital investment commitments announced across EV, clean tech, and corporate headquarters",
    detectedStructuralVulnerability: "House Bill 463 enacted statutory sunset: Headquarters Tax Credit (§ 4-1), Medical Manufacturing (§ 4-4), and Teleworking credits repealed Jan 1, 2026; complete disallowance of all income tax credits codified by 2032.",
    telemetryEvidenceMetrics: [
      {
        metric: "Headquarters Creation Credit Availability",
        baseline: "$2,500 - $5,000 per HQ employee tax credit",
        observedTelemetry: "0 statutory credit available for new corporate relocations",
        deviationZScore: "-100% entitlement elimination",
        verifiedPrimarySource: "O.C.G.A. § 48-7-40 Enacted Amendments / DOR Bulletins"
      },
      {
        metric: "Data Center Clean Power Interconnection Queue",
        baseline: "14-month interconnection queue | 18% reserve margin",
        observedTelemetry: "38-month high-density substation backlog | 11.2% reserve margin",
        deviationZScore: "-37.8% reserve margin squeeze",
        verifiedPrimarySource: "Georgia Public Service Commission Docket No. 44160 & FERC Form 714"
      },
      {
        metric: "Corporate State Income Tax Rate",
        baseline: "Historic 5.75% rate transitioning downward",
        observedTelemetry: "4.99% flat rate with all credits sunsetting in 2032",
        deviationZScore: "Statutory cliff risk",
        verifiedPrimarySource: "Georgia Economic Growth and Tax Relief Act of 2026"
      }
    ],
    competitorAllocations: [
      {
        stateCode: "NC",
        stateName: "North Carolina",
        strategicAdvantageVector: "Corporate Tax Dropping to 0% by 2030 + Research Triangle Park (RTP) Bio Dominance",
        executiveInterventionPlaybook: "Deploy 'HQ Zero' recruitment squads into Metro Atlanta Fortune 1000 financial services and tech headquarters. Contrast North Carolina's statutory 0% corporate tax transition by 2030 against Georgia's 2032 credit sunset cliff.",
        quantifiableFinancialYield: "+18.4% Net corporate income margin expansion over 10-year facility horizon",
        timeHorizon: "Active engagement (30 - 180 days)",
        confidenceGrade: "A1"
      },
      {
        stateCode: "TX",
        stateName: "Texas",
        strategicAdvantageVector: "0% Corporate & Personal Income Tax + Uncapped Hyperscale Power Scale",
        executiveInterventionPlaybook: "Direct outreach to AI hyperscalers, semiconductor foundries, and cloud providers delayed in Georgia Power's 38-month Metro Atlanta queue. Offer Chapter 312/380 turnkey local property tax abatement agreements.",
        quantifiableFinancialYield: "$45M - $120M cumulative state power and tax shield per 100MW campus",
        timeHorizon: "Immediate to 90 days",
        confidenceGrade: "A1"
      },
      {
        stateCode: "VA",
        stateName: "Virginia",
        strategicAdvantageVector: "Northern Virginia Data Center Alley 2035 Exemption Framework",
        executiveInterventionPlaybook: "Poach federal cloud contracts and mission-critical compute infrastructure citing Virginia's long-term sales and use tax exemption certainty through 2035 versus Georgia's 2032 sunset.",
        quantifiableFinancialYield: "Guaranteed 10-year regulatory exemption certainty",
        timeHorizon: "Q1 2027",
        confidenceGrade: "A2"
      }
    ]
  },
  {
    pillarId: "pillar-3-diversified-base",
    pillarTitle: "Pillar III: Diversified Industrial Base & Healthcare Talent Retention",
    georgiaEconomicAnchor: "Atlanta Metro Commercial Engine, Rural Manufacturing Basins, and Academic Medical Networks",
    statewideImpactBaseline: "5.48M civilian labor force | Record employment of 5.31M | Advanced manufacturing and aerospace hubs",
    detectedStructuralVulnerability: "Talent and consumer distress: Georgia ranks 49th nationally in healthcare access and 43rd in clinical outcomes, with only 253.50 MDs/100k (42nd in US). Concurrently, Georgia ranks 7th most financially distressed state with 13.9% of credit cards 90+ days delinquent.",
    telemetryEvidenceMetrics: [
      {
        metric: "Active Physicians Density",
        baseline: "National Average: 298.4 physicians per 100k",
        observedTelemetry: "253.50 physicians per 100k (Ranked 42nd nationwide)",
        deviationZScore: "-2.12σ clinical deficit",
        verifiedPrimarySource: "Association of American Medical Colleges (AAMC) 2026 Audit"
      },
      {
        metric: "Healthcare Access & Outcomes Rank",
        baseline: "Target: Top 20 National Healthcare Standing",
        observedTelemetry: "49th Healthcare Access / 43rd Healthcare Outcomes",
        deviationZScore: "Bottom decile performance",
        verifiedPrimarySource: "WalletHub State Healthcare Infrastructure Audit 2026"
      },
      {
        metric: "90+ Day Delinquent Household Balances",
        baseline: "National Average: 8.6%",
        observedTelemetry: "13.9% credit card debt 90+ days overdue (45% basic distress)",
        deviationZScore: "+2.84σ debt delinquency excess",
        verifiedPrimarySource: "Federal Reserve Bank of New York Consumer Credit Panel (Q2 2026)"
      }
    ],
    competitorAllocations: [
      {
        stateCode: "FL",
        stateName: "Florida",
        strategicAdvantageVector: "0% Personal Income Tax + #6 Quality of Life & High Consumer Liquidity",
        executiveInterventionPlaybook: "Conduct targeted executive exfiltration of high-net-worth founders, family offices, and specialized healthcare administrators in Atlanta. Package data proving immediate 4.99% take-home pay wage gains and superior healthcare infrastructure in Miami/Tampa/Orlando.",
        quantifiableFinancialYield: "Immediate 4.99% net payroll efficiency and lower consumer default risk for retail branches",
        timeHorizon: "Continuous real-time recruitment",
        confidenceGrade: "A1"
      },
      {
        stateCode: "NC",
        stateName: "North Carolina",
        strategicAdvantageVector: "Academic Medical Titans (Duke Health, UNC Health, Wake Forest)",
        executiveInterventionPlaybook: "Recruit specialized physicians, clinical researchers, and biotechnology engineers from Emory, Grady, and Navicent to Research Triangle Park with premier compensation and clinical support.",
        quantifiableFinancialYield: "8-10% Corporate employee productivity & retention premium",
        timeHorizon: "Active pipeline (30 - 90 days)",
        confidenceGrade: "A1"
      },
      {
        stateCode: "AL",
        stateName: "Alabama",
        strategicAdvantageVector: "Tiered Industrial Abatements (Up to 30 Years without Sunset)",
        executiveInterventionPlaybook: "Present automotive tier-1 and aerospace part suppliers along the I-85/I-20 border with Alabama's 30-year abatement program for capital investments exceeding $400M, bypassing Georgia's 2032 credit sunset.",
        quantifiableFinancialYield: "20-Year property and sales tax exemption continuity",
        timeHorizon: "Q2 2027",
        confidenceGrade: "A2"
      }
    ]
  }
];
