/**
 * Dynamic Anomaly Surfaces Model
 * Real-time active vectors driven by live telemetry deviations.
 */

export interface AnomalySurface {
  id: string;
  title: string;
  telemetryChannels: string[];
  threshold: { zScore: number; direction: 'above' | 'below' };
  action: 'ALERT' | 'RECOMMEND' | 'DISPATCH';
  currentStatus: 'STATIC' | 'ACTIVE' | 'DISPATCHED';
}

export const ANOMALY_SURFACES: AnomalySurface[] = [
  {
    id: 'GA-VULN-TAX',
    title: 'GA 4.99% Corporate & Personal Tax Sunset vs TN 0%',
    telemetryChannels: ['GA_TAX_RATE', 'TN_TAX_RATE'],
    threshold: { zScore: 1.5, direction: 'above' },
    action: 'RECOMMEND',
    currentStatus: 'ACTIVE'
  },
  {
    id: 'GA-VULN-PHYSICIAN',
    title: 'GA Physician Density Deficit (255/100k vs US 304/100k)',
    telemetryChannels: ['GA_PHYS_DENSITY', 'TN_PHYS_DENSITY'],
    threshold: { zScore: 1.2, direction: 'below' },
    action: 'ALERT',
    currentStatus: 'ACTIVE'
  },
  {
    id: 'GA-VULN-RAIL-DWELL',
    title: 'Port of Savannah Intermodal Dwell Spikes (22-Hour Average)',
    telemetryChannels: ['SAVANNAH_DWELL_HOURS', 'MEMPHIS_RAIL_VELOCITY'],
    threshold: { zScore: 2.0, direction: 'above' },
    action: 'DISPATCH',
    currentStatus: 'DISPATCHED'
  },
  {
    id: 'GA-VULN-DATA-CENTER',
    title: 'Georgia Power High-Density Substation Interconnect Queue (38-Month)',
    telemetryChannels: ['GA_GRID_LOAD_MW', 'DATA_CENTER_POWER'],
    threshold: { zScore: 2.2, direction: 'above' },
    action: 'DISPATCH',
    currentStatus: 'DISPATCHED'
  }
];
