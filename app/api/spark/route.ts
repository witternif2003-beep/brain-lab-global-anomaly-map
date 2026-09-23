import { NextResponse } from 'next/server';
import { SPARK_MODELS, executeSparkTelemetryReasoning } from '../../../lib/spark-llm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ONLINE',
    provider: 'SparkLLM / XHToken',
    models: SPARK_MODELS,
    specifications: {
      maxContextWindow: '1,000,000 Tokens (Native On-Device)',
      architecture: 'Hybrid-Attention (1 Full Layer + 3 Sliding Window Layers)',
      supportedLanguages: '200+',
      targetEnvironments: ['Edge Nodes', 'Local Llama.cpp', 'vLLM', 'Ollama', 'MLX'],
    },
    sampleTelemetryReasoning: executeSparkTelemetryReasoning('Savannah Container Berth 4 Dwell Telemetry'),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt || 'Georgia Telemetry Stream Analysis';
    const model = body.model === 'spark-x2.5-4b' ? 'spark-x2.5-4b' : 'spark-x2.5-1.7b';

    const job = executeSparkTelemetryReasoning(prompt, model);
    return NextResponse.json({
      success: true,
      job,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Inference error' }, { status: 500 });
  }
}
