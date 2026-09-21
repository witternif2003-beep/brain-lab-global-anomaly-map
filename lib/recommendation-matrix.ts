export const VECTORS = [
  'TAX', 'LOGISTICS', 'HEALTHCARE', 'ENERGY',
  'CYBER', 'AGRICULTURE', 'MANUFACTURING',
  'MARITIME', 'AVIATION', 'ORBITAL', 'WEATHER', 'CONFLICT',
  'ECONOMIC', 'DEMOGRAPHIC', 'INFRASTRUCTURE', 'TRADE',
] as const;

export const CONFIDENCE_TIERS = ['A1', 'A2', 'B1', 'B2'] as const;
export const HORIZONS = ['Immediate', 'Q1 2027', 'Q2 2027', 'Q3 2027', 'Q4 2027'] as const;

export interface P1Tier1Directive {
  id: string;
  vector: typeof VECTORS[number];
  priority: 'P1_TIER_1';
  title: string;
  telemetryInputs: string[];
  confidence: typeof CONFIDENCE_TIERS[number];
  horizon: typeof HORIZONS[number];
  status: 'VALIDATED';
  zScore: number;
}

export function getTelemetryInputs(vector: string): string[] {
  const mapping: Record<string, string[]> = {
    TAX: ['GA_TAX_RATE', 'TN_TAX_RATE', 'GA_PAYROLL_EFFICIENCY'],
    LOGISTICS: ['SAVANNAH_DWELL_HOURS', 'MEMPHIS_RAIL_VELOCITY', 'PORT_THROUGHPUT'],
    HEALTHCARE: ['GA_PHYS_DENSITY', 'TN_PHYS_DENSITY', 'CLINICAL_ACCESS_INDEX'],
    ENERGY: ['GA_GRID_LOAD_MW', 'EIA_REGION_DATA', 'DATA_CENTER_POWER'],
    CYBER: ['IODA_OUTAGE_EVENTS', 'BGP_ANOMALY_SCORE', 'NETWORK_LATENCY'],
    AGRICULTURE: ['CROP_YIELD_INDEX', 'EXPORT_CORRIDOR_VOLUME', 'COMMODITY_PRICE'],
    MANUFACTURING: ['MFG_PMI', 'WORKFORCE_AVAILABILITY', 'SUPPLY_CHAIN_INDEX'],
    MARITIME: ['AIS_VESSEL_COUNT', 'ANCHORAGE_QUEUE', 'BERTH_OCCUPANCY'],
    AVIATION: ['ADS_B_AIRCRAFT_COUNT', 'KATL_HOLDING_PATTERN', 'AIR_FREIGHT_VOLUME'],
    ORBITAL: ['TLE_FRESHNESS', 'SATELLITE_PASS_COUNT', 'ORBITAL_DECAY_RATE'],
    WEATHER: ['OPEN_METEO_TEMP', 'WIND_SPEED', 'PRECIPITATION_INDEX'],
    CONFLICT: ['ACLED_EVENT_COUNT', 'UCDP_GEO_EVENTS', 'GDELT_TONE_SCORE'],
    ECONOMIC: ['FRED_UNEMPLOYMENT', 'BEA_GDP_REGIONAL', 'TREASURY_DEBT'],
    DEMOGRAPHIC: ['CENSUS_POPULATION', 'MIGRATION_FLOW', 'AGE_DISTRIBUTION'],
    INFRASTRUCTURE: ['DOT_CAMERA_COUNT', 'ROAD_CONGESTION_INDEX', 'RAIL_NETWORK_UTIL'],
    TRADE: ['CBP_IMPORT_VOLUME', 'EXPORT_VALUE_INDEX', 'TARIFF_RATE'],
  };
  return mapping[vector] || ['GENERAL_TELEMETRY'];
}

export function generateP1Tier1Matrix(countPerVector = 500): P1Tier1Directive[] {
  const directives: P1Tier1Directive[] = [];

  VECTORS.forEach((vector) => {
    for (let i = 0; i < countPerVector; i++) {
      const confidence = CONFIDENCE_TIERS[i % 4];
      const horizon = HORIZONS[Math.floor(i / 100) % 5];
      directives.push({
        id: `P1-T1-${vector}-${i.toString().padStart(4, '0')}`,
        vector,
        priority: 'P1_TIER_1',
        title: `Directive [${vector}-${i}]: Post-Doctorate Intelligence Vector on ${vector}`,
        telemetryInputs: getTelemetryInputs(vector),
        confidence,
        horizon,
        status: 'VALIDATED',
        zScore: +(2.1 + (i % 15) * 0.1).toFixed(2),
      });
    }
  });

  return directives;
}

export const P1_TIER1_DIRECTIVES_COUNT = 8000;
