/**
 * Locality-Aware Kafka Topology & Priority Partitioning Model
 * 
 * Partitions by Entity ID to preserve per-entity ordering:
 * - Kpler AIS (MMSI) -> High-priority partitions 0..3
 * - USGS/NOAA (Station ID) -> High-priority partitions 0..3
 * - BLS LAUS (County FIPS) -> Routine partitions 4..7
 * - BLS QCEW (Composite FIPS + NAICS) -> Routine partitions 4..7
 * - ACLED / GDELT (Region + Date) -> Routine partitions 4..7
 * - EIA 861M (Balancing Authority) -> Routine partitions 4..7
 */

export type SourceType = 'AIS' | 'SEISMIC' | 'LABOR' | 'WAGE' | 'CONFLICT' | 'GRID';

export interface KafkaPartitionConfig {
  topic: string;
  totalPartitions: number;
  highPriorityPartitionsCount: number;
  replicationFactor: number;
}

export const KAFKA_TOPOLOGY_CONFIG: KafkaPartitionConfig = {
  topic: 'telemetry.raw.v1',
  totalPartitions: 8,
  highPriorityPartitionsCount: 4,
  replicationFactor: 3
};

// Murmur2 hash implementation for consistent partition assignment
export function murmur2Hash(str: string): number {
  let h = 0 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export function routeToPartition(sourceType: SourceType, partitionKey: string): number {
  const hash = murmur2Hash(partitionKey);
  const isHighPriority = sourceType === 'AIS' || sourceType === 'SEISMIC';

  if (isHighPriority) {
    // Reserved high-throughput low-latency partitions 0, 1, 2, 3
    return hash % KAFKA_TOPOLOGY_CONFIG.highPriorityPartitionsCount;
  } else {
    // Routine partitions 4, 5, 6, 7
    const routineCount = KAFKA_TOPOLOGY_CONFIG.totalPartitions - KAFKA_TOPOLOGY_CONFIG.highPriorityPartitionsCount;
    return KAFKA_TOPOLOGY_CONFIG.highPriorityPartitionsCount + (hash % routineCount);
  }
}
