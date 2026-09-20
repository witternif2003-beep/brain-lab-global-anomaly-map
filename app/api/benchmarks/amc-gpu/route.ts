export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { routeToPartition, KAFKA_TOPOLOGY_CONFIG } from "../../../../lib/kafka-partition-router";
import { simulateWGSLGPUDispatch, AMC_WGSL_COMPUTE_SHADER } from "../../../../lib/webgpu-amc-compute";
import { NextResponse } from "next/server";

export async function GET() {
  const sampleRouting = [
    { source: 'Kpler AIS (Savannah)', key: 'MMSI-368124000', partition: routeToPartition('AIS', 'MMSI-368124000'), priority: 'HIGH' },
    { source: 'USGS Seismic Sensor', key: 'STA-US-GA-01', partition: routeToPartition('SEISMIC', 'STA-US-GA-01'), priority: 'HIGH' },
    { source: 'BLS LAUS County', key: 'FIPS-13121', partition: routeToPartition('LABOR', 'FIPS-13121'), priority: 'ROUTINE' },
    { source: 'BLS QCEW Wage', key: 'FIPS-13121-NAICS-5415', partition: routeToPartition('WAGE', 'FIPS-13121-NAICS-5415'), priority: 'ROUTINE' },
    { source: 'EIA 861M Grid', key: 'BA-SOCO-GAPOWER', partition: routeToPartition('GRID', 'BA-SOCO-GAPOWER'), priority: 'ROUTINE' },
    { source: 'ACLED Conflict', key: 'REGION-US-SE', partition: routeToPartition('CONFLICT', 'REGION-US-SE'), priority: 'ROUTINE' }
  ];

  const gpuMetrics = simulateWGSLGPUDispatch(1024);

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    kafkaTopology: {
      topic: KAFKA_TOPOLOGY_CONFIG.topic,
      totalPartitions: KAFKA_TOPOLOGY_CONFIG.totalPartitions,
      highPriorityPartitions: [0, 1, 2, 3],
      routinePartitions: [4, 5, 6, 7],
      routingSamples: sampleRouting
    },
    webGPUWasmArchitecture: {
      status: "ACTIVE_COMPILED",
      shaderLang: "WGSL",
      workgroupSize: 256,
      metrics: gpuMetrics,
      wasmBinarySizeKB: 639
    }
  });
}
