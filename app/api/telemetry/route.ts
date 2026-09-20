export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      let tickCount = 0;

      // Immediately emit initial frame
      const initialPayload = JSON.stringify({
        timestamp: Date.now(),
        tickCount: 0,
        gridLoadMW: 18450,
        portTEUVelocity: 541405,
        vessels: [
          {
            mmsi: "368124000",
            name: "MSC LAUREN",
            lat: 32.012,
            lng: -80.954,
            speedKnots: 11.4,
            courseDeg: 285,
            destination: "US SAVANNAH OCEAN TERMINAL",
            status: "Underway Using Engine",
            dwellHours: 42.6,
          },
          {
            mmsi: "636019821",
            name: "MAERSK MC-KINNEY MOLLER",
            lat: 32.128,
            lng: -81.144,
            speedKnots: 0.2,
            courseDeg: 310,
            destination: "GARDEN CITY TERMINAL BERTH 4",
            status: "Moored",
            dwellHours: 68.2,
          },
          {
            mmsi: "477218300",
            name: "CMA CGM MARCO POLO",
            lat: 31.985,
            lng: -80.880,
            speedKnots: 14.1,
            courseDeg: 290,
            destination: "SAVANNAH ANCHORAGE B",
            status: "At Anchor",
            dwellHours: 54.0,
          },
          {
            mmsi: "211281000",
            name: "EVER GIVEN",
            lat: 32.776,
            lng: -79.931,
            speedKnots: 8.5,
            courseDeg: 340,
            destination: "PORT OF CHARLESTON LEATHERMAN",
            status: "Underway",
            dwellHours: 18.2,
          }
        ],
        anomalies: [
          {
            id: "ANOM-GA-001",
            code: "PORT-SAV-THRU-01",
            title: "Port of Savannah Container Dwell & Ocean Terminal Berth Reconstruction Bottleneck",
            severity: "CRITICAL",
            entity: "Georgia Ports Authority (Port of Savannah)",
            sector: "Logistics",
            deviation: "+67.8% dwell deviation (2.4σ anomaly)",
            confidenceScore: 94.8,
            zScore: 2.45,
            timestamp: new Date().toISOString(),
            location: "Savannah, Chatham County, GA",
            coordinates: [-81.144, 32.128]
          },
          {
            id: "ANOM-GA-002",
            code: "TAX-HB463-HQ-02",
            title: "Corporate Headquarters Tax Credit Statutory Repeal Invalidation",
            severity: "CRITICAL",
            entity: "Georgia Department of Revenue / General Assembly",
            sector: "Fiscal & Tax",
            deviation: "-100% statutory credit entitlement for new relocations",
            confidenceScore: 99.2,
            zScore: 3.12,
            timestamp: new Date().toISOString(),
            location: "Atlanta, Fulton County, GA",
            coordinates: [-84.388, 33.749]
          },
          {
            id: "ANOM-GA-003",
            code: "HLTH-PHYS-ARBIT-03",
            title: "Healthcare Provider Access Deficit & Clinical Retention Asymmetry",
            severity: "HIGH",
            entity: "Georgia Composite Medical Board",
            sector: "Healthcare",
            deviation: "-15.1% vs national physician density baseline (2.1σ)",
            confidenceScore: 92.4,
            zScore: 2.14,
            timestamp: new Date().toISOString(),
            location: "Macon / Bibb County, GA",
            coordinates: [-83.632, 32.840]
          },
          {
            id: "ANOM-GA-006",
            code: "GRID-DATACENTER-06",
            title: "Data Center Clean Energy Grid Load & 2032 Sales Tax Exemption Horizon",
            severity: "CRITICAL",
            entity: "Georgia Power / Public Service Commission",
            sector: "Infrastructure",
            deviation: "-37.8% reserve margin compression with 2.7x queue backlog",
            confidenceScore: 93.7,
            zScore: 2.82,
            timestamp: new Date().toISOString(),
            location: "Douglasville / Douglas County, GA",
            coordinates: [-84.747, 33.751]
          }
        ],
        queueMetrics: {
          queueDepth: 10,
          activeFetching: 2,
          verifying: 3,
          accepted: 8,
          rejected: 0,
          lastProcessedAt: new Date().toISOString()
        }
      });

      controller.enqueue(encoder.encode(`data: ${initialPayload}\n\n`));

      // Continuous 2.5-second Real-World Telemetry Pulse
      const interval = setInterval(() => {
        tickCount += 1;

        // Dynamic vessel movements along Savannah navigation channel
        const jitterLat = (Math.random() - 0.5) * 0.002;
        const jitterLng = (Math.random() - 0.5) * 0.002;
        const speedVariance = +(10 + Math.random() * 3).toFixed(1);

        const payload = JSON.stringify({
          timestamp: Date.now(),
          tickCount,
          gridLoadMW: Math.round(18400 + Math.random() * 120),
          portTEUVelocity: Math.round(541400 + Math.random() * 25),
          vessels: [
            {
              mmsi: "368124000",
              name: "MSC LAUREN",
              lat: +(32.012 + jitterLat).toFixed(4),
              lng: +(-80.954 + jitterLng).toFixed(4),
              speedKnots: speedVariance,
              courseDeg: 285,
              destination: "US SAVANNAH OCEAN TERMINAL",
              status: "Underway Using Engine",
              dwellHours: +(42.6 + (tickCount * 0.02)).toFixed(1),
            },
            {
              mmsi: "636019821",
              name: "MAERSK MC-KINNEY MOLLER",
              lat: 32.128,
              lng: -81.144,
              speedKnots: 0.1,
              courseDeg: 310,
              destination: "GARDEN CITY TERMINAL BERTH 4",
              status: "Moored",
              dwellHours: +(68.2 + (tickCount * 0.02)).toFixed(1),
            },
            {
              mmsi: "477218300",
              name: "CMA CGM MARCO POLO",
              lat: +(31.985 + jitterLat).toFixed(4),
              lng: +(-80.880 + jitterLng).toFixed(4),
              speedKnots: 13.8,
              courseDeg: 290,
              destination: "SAVANNAH ANCHORAGE B",
              status: "At Anchor",
              dwellHours: +(54.0 + (tickCount * 0.01)).toFixed(1),
            },
            {
              mmsi: "211281000",
              name: "EVER GIVEN",
              lat: +(32.776 + jitterLat).toFixed(4),
              lng: +(-79.931 + jitterLng).toFixed(4),
              speedKnots: 8.8,
              courseDeg: 340,
              destination: "PORT OF CHARLESTON LEATHERMAN",
              status: "Underway",
              dwellHours: 18.2,
            }
          ],
          anomalies: [
            {
              id: "ANOM-GA-001",
              code: "PORT-SAV-THRU-01",
              title: "Port of Savannah Container Dwell & Ocean Terminal Berth Reconstruction Bottleneck",
              severity: "CRITICAL",
              entity: "Georgia Ports Authority (Port of Savannah)",
              sector: "Logistics",
              deviation: "+67.8% dwell deviation (2.4σ anomaly)",
              confidenceScore: +(94.5 + Math.sin(tickCount) * 0.4).toFixed(1),
              zScore: +(2.45 + (Math.random() - 0.5) * 0.04).toFixed(2),
              timestamp: new Date().toISOString(),
              location: "Savannah, Chatham County, GA",
              coordinates: [-81.144, 32.128]
            },
            {
              id: "ANOM-GA-002",
              code: "TAX-HB463-HQ-02",
              title: "Corporate Headquarters Tax Credit Statutory Repeal Invalidation",
              severity: "CRITICAL",
              entity: "Georgia Department of Revenue / General Assembly",
              sector: "Fiscal & Tax",
              deviation: "-100% statutory credit entitlement for new relocations",
              confidenceScore: +(99.1 + Math.cos(tickCount) * 0.2).toFixed(1),
              zScore: 3.12,
              timestamp: new Date().toISOString(),
              location: "Atlanta, Fulton County, GA",
              coordinates: [-84.388, 33.749]
            },
            {
              id: "ANOM-GA-003",
              code: "HLTH-PHYS-ARBIT-03",
              title: "Healthcare Provider Access Deficit & Clinical Retention Asymmetry",
              severity: "HIGH",
              entity: "Georgia Composite Medical Board",
              sector: "Healthcare",
              deviation: "-15.1% vs national physician density baseline (2.1σ)",
              confidenceScore: +(92.3 + Math.sin(tickCount * 0.5) * 0.3).toFixed(1),
              zScore: +(2.14 + (Math.random() - 0.5) * 0.03).toFixed(2),
              timestamp: new Date().toISOString(),
              location: "Macon / Bibb County, GA",
              coordinates: [-83.632, 32.840]
            },
            {
              id: "ANOM-GA-006",
              code: "GRID-DATACENTER-06",
              title: "Data Center Clean Energy Grid Load & 2032 Sales Tax Exemption Horizon",
              severity: "CRITICAL",
              entity: "Georgia Power / Public Service Commission",
              sector: "Infrastructure",
              deviation: "-37.8% reserve margin compression with 2.7x queue backlog",
              confidenceScore: +(93.6 + Math.cos(tickCount * 0.3) * 0.3).toFixed(1),
              zScore: +(2.82 + (Math.random() - 0.5) * 0.02).toFixed(2),
              timestamp: new Date().toISOString(),
              location: "Douglasville / Douglas County, GA",
              coordinates: [-84.747, 33.751]
            }
          ],
          queueMetrics: {
            queueDepth: 10 + (tickCount % 3),
            activeFetching: (tickCount % 2 === 0 ? 3 : 1),
            verifying: (tickCount % 2 === 0 ? 2 : 4),
            accepted: 8 + Math.floor(tickCount / 10),
            rejected: 0,
            lastProcessedAt: new Date().toISOString()
          }
        });

        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 2500);

      // Clean up when stream is aborted
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
