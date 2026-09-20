export interface TelemetryModelBenchmark {
  modelName: string;
  architecture: string;
  evaluationBenchmark: string;
  f1Score: number;
  falsePositiveReduction: string;
  inferenceLatency: string;
  keyInnovation: string;
  georgiaPipelineTarget: string;
}

export const TELEMETRY_BENCHMARKS: TelemetryModelBenchmark[] = [
  {
    modelName: "LSTD-Detect",
    architecture: "Stacked LSTM + Non-Parametric Dynamic Thresholding",
    evaluationBenchmark: "NASA SMAP (55 channels, 429k values) & MSL (27 channels)",
    f1Score: 0.81,
    falsePositiveReduction: "7.8x noise suppression via sliding exponential error buffer",
    inferenceLatency: "0.08 ms / sample",
    keyInnovation: "Adaptive non-parametric threshold tracking non-stationary sensor drift without per-channel tuning.",
    georgiaPipelineTarget: "Port of Savannah container crane and berth dwell telemetry"
  },
  {
    modelName: "GST-Net (Gated Spectral-Temporal)",
    architecture: "Dual-branch Transformer + Gated Spectral Frequency Attention",
    evaluationBenchmark: "3-Year Multivariate Corporate Distress Benchmark (MCC: 0.5704)",
    f1Score: 0.784,
    falsePositiveReduction: "Suppresses high-frequency transient noise in favor of structural macro trends",
    inferenceLatency: "0.37 sec / instance",
    keyInnovation: "Decouples localized transient anomalies from multi-year decay trends with SHAP/LIME explainability.",
    georgiaPipelineTarget: "Georgia corporate tax lien and business registration lapse modeling"
  },
  {
    modelName: "STGNN (Spatio-Temporal Graph Neural Net)",
    architecture: "Dynamic Directed Spatio-Temporal Graph Convolutions",
    evaluationBenchmark: "Autonomous Maritime & Glider Telemetry Deployments",
    f1Score: 0.986,
    falsePositiveReduction: "Captures inter-node topological couplings with synthetic fault injection",
    inferenceLatency: "1.2 ms / graph patch",
    keyInnovation: "Models intermodal physical couplings across rail lines, vessel berths, and highway drayage gates.",
    georgiaPipelineTarget: "Port of Savannah Garden City / Ocean Terminal & Mason Mega Rail"
  },
  {
    modelName: "MSGMamba",
    architecture: "Multi-Scale Dynamic Graph State-Space Model (Mamba selective SSM)",
    evaluationBenchmark: "SMAP, MSL, and EIRSAT-1 Satellite Telemetry Benchmarks",
    f1Score: 0.892,
    falsePositiveReduction: "Dual-pathway anomaly scoring (signal reconstruction error + encoder-memory gap)",
    inferenceLatency: "0.14M parameter ultra-lightweight inference",
    keyInnovation: "Reconstructs directed asymmetric channel graph at every patch with orthogonality memory.",
    georgiaPipelineTarget: "Overhead remote sensing & NASA FIRMS thermal anomaly streams"
  },
  {
    modelName: "Mantis HPC Telemetry",
    architecture: "Variational Autoencoder + Graph Attention Telemetry Decoder",
    evaluationBenchmark: "High-Performance Computing Telemetry Logs",
    f1Score: 0.845,
    falsePositiveReduction: "26x reduction in false positive rate vs baseline VAE/GAT",
    inferenceLatency: "0.15 ms / event window",
    keyInnovation: "Drastic suppression of false positives in high-frequency macroscopic event logs.",
    georgiaPipelineTarget: "Georgia Power & SERC electric grid substation telemetry"
  },
  {
    modelName: "CADM + Benford's Law Forensic",
    architecture: "LSTM Creative Accounting Detector + First/Second Digit Log-Likelihood",
    evaluationBenchmark: "SEC EDGAR 10-K/10-Q XBRL Anomaly Suite",
    f1Score: 0.822,
    falsePositiveReduction: "Combines predictive temporal strength with digit frequency explainability",
    inferenceLatency: "0.45 sec / filing",
    keyInnovation: "Flags artificial revenue smoothing and non-linear debt deferral in corporate balance sheets.",
    georgiaPipelineTarget: "Georgia public entity disclosures and state vendor procurement filings"
  }
];

export interface CountyAnomalyScore {
  fips: string;
  countyName: string;
  population: number;
  anomalyScore: number; // 0 - 100
  dominantVulnerability: string;
  primaryPillar: "Logistics" | "Incentives" | "Workforce & Healthcare" | "Financial Distress";
  keyEntitiesMonitored: string[];
  competitorAdvantageFlag: string;
}

export const TOP_GEORGIA_COUNTIES: CountyAnomalyScore[] = [
  {
    fips: "13051",
    countyName: "Chatham County (Savannah)",
    population: 301107,
    anomalyScore: 94.8,
    dominantVulnerability: "Port of Savannah Ocean Terminal reconstruction berth dwell (+67.8%) and rail queue delays.",
    primaryPillar: "Logistics",
    keyEntitiesMonitored: ["Georgia Ports Authority", "Garden City Terminal", "Mason Mega Rail"],
    competitorAdvantageFlag: "South Carolina (Port of Charleston 52ft harbor) freight poaching target"
  },
  {
    fips: "13121",
    countyName: "Fulton County (Atlanta)",
    population: 1074634,
    anomalyScore: 98.2,
    dominantVulnerability: "HB 463 corporate Headquarters Tax Credit statutory cancellation effective Jan 1, 2026.",
    primaryPillar: "Incentives",
    keyEntitiesMonitored: ["Georgia Dept of Revenue", "General Assembly", "Metro Atlanta Chamber"],
    competitorAdvantageFlag: "North Carolina (0% corp tax by 2030) and Texas (0% income tax) 'HQ Zero' campaigns"
  },
  {
    fips: "13135",
    countyName: "Gwinnett County (Duluth/Bio-Corridor)",
    population: 969603,
    anomalyScore: 89.5,
    dominantVulnerability: "Medical equipment, PPE, and pharmaceutical manufacturing tax credit sunsetting.",
    primaryPillar: "Incentives",
    keyEntitiesMonitored: ["Georgia Bio Industry Cluster", "Gwinnett Medical Corridor", "DED Recruitment"],
    competitorAdvantageFlag: "North Carolina Research Triangle Park (RTP) life sciences incentive spread"
  },
  {
    fips: "13021",
    countyName: "Bibb County (Macon)",
    population: 153095,
    anomalyScore: 91.0,
    dominantVulnerability: "Healthcare physician deficit (253.5/100k, 42nd in US) and 49th healthcare access ranking.",
    primaryPillar: "Workforce & Healthcare",
    keyEntitiesMonitored: ["Atrium Health Navicent", "Bibb County Medical Center", "Composite Medical Board"],
    competitorAdvantageFlag: "Tennessee (Vanderbilt/HCA) and North Carolina (Duke Health) talent exfiltration"
  },
  {
    fips: "13245",
    countyName: "Richmond County (Augusta)",
    population: 202081,
    anomalyScore: 86.4,
    dominantVulnerability: "Household consumer credit distress (13.9% 90+ days overdue) and student debt arrears (10.7%).",
    primaryPillar: "Financial Distress",
    keyEntitiesMonitored: ["Augusta Federal Reserve Proxy", "Richmond County Superior Court", "DOR Lien Office"],
    competitorAdvantageFlag: "Florida and South Carolina disposable income indices and lower default risks"
  },
  {
    fips: "13097",
    countyName: "Douglas County (Douglasville)",
    population: 147596,
    anomalyScore: 93.1,
    dominantVulnerability: "AI hyperscale data center grid reserve margin compression (projected 11.2%) & 2032 sales tax cliff.",
    primaryPillar: "Incentives",
    keyEntitiesMonitored: ["Georgia Power Lithia Springs Substation", "PSC Docket 44160", "Douglas Hyperscale Cluster"],
    competitorAdvantageFlag: "Texas (ERCOT turnkey interconnect) and Virginia (2035 data center protections)"
  }
];

export interface ArenaAIBenchmarkItem {
  rank: number;
  modelName: string;
  vendor: string;
  eloScore: number;
  ci95: string;
  evalCategory: string;
  roleInAnomalyVerification: string;
}

export const ARENA_AI_BENCHMARKS: ArenaAIBenchmarkItem[] = [
  {
    rank: 1,
    modelName: "Claude 3.5 Sonnet / Claude 3.7",
    vendor: "Anthropic",
    eloScore: 1335,
    ci95: "±12",
    evalCategory: "Agent & Coding Workflows",
    roleInAnomalyVerification: "Primary multi-agent reasoning, legislative text reconciliation, and Admiralty credibility validation."
  },
  {
    rank: 2,
    modelName: "GPT-4o (Omni)",
    vendor: "OpenAI",
    eloScore: 1328,
    ci95: "±11",
    evalCategory: "Multimodal & Visual Telemetry",
    roleInAnomalyVerification: "Visual chart verification, satellite thermal parsing, and DOT camera visual OCR confirmation."
  },
  {
    rank: 3,
    modelName: "Gemini 1.5 Pro",
    vendor: "Google",
    eloScore: 1315,
    ci95: "±14",
    evalCategory: "Long-Context Synthesis",
    roleInAnomalyVerification: "Ingests entire Georgia Code O.C.G.A. Title 48 (Revenue and Taxation) and 500-page PSC resource dockets."
  },
  {
    rank: 4,
    modelName: "DeepSeek R1 / V3",
    vendor: "DeepSeek",
    eloScore: 1308,
    ci95: "±15",
    evalCategory: "Mathematical & Algorithmic Reasoning",
    roleInAnomalyVerification: "Validates non-parametric dynamic threshold equations and STGNN matrix convolutions."
  }
];
