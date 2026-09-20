export type ReviewStatus = 'VERIFIED' | 'REVIEWED' | 'UNREVIEWED' | 'STALE';
export type EvidenceScope = 'state' | 'county' | 'metro' | 'national' | 'global';
export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvidenceCardItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  datasetId: string;
  scope: EvidenceScope;
  state?: string;
  county?: string;
  retrievedAt: string;
  periodStart?: string;
  periodEnd?: string;
  value: number | string;
  unit?: string;
  license: string;
  licenseUrl?: string;
  reviewStatus: ReviewStatus;
  admiraltyScore: string; // e.g., A1, B2, A2
  confidencePercent: number;
  notes?: string;
  pillar: 'LOGISTICS' | 'INCENTIVES' | 'WORKFORCE_QUALITY' | 'FISCAL_STRESS';
}

export interface AnomalyItem {
  id: string;
  code: string;
  title: string;
  entity: string;
  sector: 'Logistics' | 'Labor' | 'Fiscal & Tax' | 'Infrastructure' | 'Healthcare' | 'Corporate' | 'Regulatory';
  severity: AnomalySeverity;
  metric: string;
  baseline: string;
  observed: string;
  deviation: string;
  detectionModel: string; // e.g. "LSTM-AE + LSTD-Detect", "Isolation Forest", "STGNN"
  confidenceScore: number; // 0 - 100
  admiraltyRating: string; // A1, A2, B1 etc
  timestamp: string;
  location: string;
  coordinates: [number, number]; // [lng, lat]
  status: 'ACTIVE' | 'INVESTIGATING' | 'MITIGATED' | 'CORROBORATED';
  evidenceChain: {
    primarySource: string;
    corroboratingSource: string;
    verificationStatus: string;
  };
  competitorAdvantage: string;
  exploitingStates: string[]; // e.g. ["NC", "TN", "FL", "SC", "TX"]
  exploitationPlaybook: string;
}

export interface CompetitorStateIntel {
  stateCode: string;
  stateName: string;
  coordinates: [number, number];
  primaryAdvantage: string;
  targetGeorgiaPillar: string;
  strategicPlaybook: string;
  keyVulnerabilitiesExploited: string[];
  comparativeMetrics: {
    metric: string;
    georgiaValue: string;
    competitorValue: string;
    advantageDelta: string;
    source: string;
  }[];
  activeOpportunities: {
    id: string;
    title: string;
    sector: string;
    exploitationWindow: string;
    roiProjected: string;
    confidenceGrade: string;
    status: 'SURFACED' | 'ENGAGED' | 'ACTIONABLE';
  }[];
}
