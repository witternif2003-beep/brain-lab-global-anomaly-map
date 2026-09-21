import { VERIFIED_STATUTORY_REGISTRY, CompetitorMetric } from './competitor-pipelines';
import { weightedL2Norm } from './provenance-norm';

export interface IngestResult {
  ingested: number;
  deduped: number;
  feedsProcessed: number;
  timestamp: string;
}

export class CompetitorPipeline {
  private static seenHashes: Set<string> = new Set();
  private static localStream: Array<{ id: string; fields: Record<string, string> }> = [];

  public static async hashPayload(data: unknown): Promise<string> {
    const json = JSON.stringify(data);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public static async ingestAll(): Promise<IngestResult> {
    let ingested = 0;
    let deduped = 0;

    for (const metric of VERIFIED_STATUTORY_REGISTRY) {
      const hash = await this.hashPayload(metric);
      if (this.seenHashes.has(hash)) {
        deduped++;
        continue;
      }

      this.seenHashes.add(hash);
      const norm = weightedL2Norm({
        reliability: metric.reliability,
        credibility: 0.94,
        freshness: 0.95,
        cycleEntropy: 0.92,
      });

      this.localStream.push({
        id: `${Date.now()}-${ingested}`,
        fields: {
          state: metric.state,
          statutoryInstrument: metric.statutoryInstrument,
          citation: metric.citation,
          metricType: metric.metricType,
          value: metric.value.toString(),
          unit: metric.unit,
          sourceUrl: metric.sourceUrl,
          effectiveDate: metric.effectiveDate,
          reliability: metric.reliability.toString(),
          provenanceNorm: norm.toString(),
        },
      });
      ingested++;
    }

    return {
      ingested,
      deduped,
      feedsProcessed: VERIFIED_STATUTORY_REGISTRY.length,
      timestamp: new Date().toISOString(),
    };
  }

  public static async ingestPayload(payload: any): Promise<{ ingested: number; deduped: number }> {
    const hash = await this.hashPayload(payload);
    if (this.seenHashes.has(hash)) {
      return { ingested: 0, deduped: 1 };
    }
    this.seenHashes.add(hash);
    const norm = weightedL2Norm({
      reliability: payload.reliability || 0.95,
      credibility: 0.94,
      freshness: 0.95,
      cycleEntropy: 0.92,
    });
    this.localStream.push({
      id: `${Date.now()}-custom`,
      fields: {
        state: payload.state || 'UNKNOWN',
        metricType: payload.metricType || 'custom',
        value: (payload.value ?? '').toString(),
        provenanceNorm: norm.toString(),
      },
    });
    return { ingested: 1, deduped: 0 };
  }

  public static getStream(limit = 100): Array<{ id: string; fields: Record<string, string> }> {
    return this.localStream.slice(-limit);
  }
}
