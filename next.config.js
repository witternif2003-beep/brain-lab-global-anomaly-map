/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Baked in at build so prebuilt (CLI) deploys still report their commit to BuildFreshnessChip and /api/health.
  env: { VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '' },
  serverExternalPackages: ['laz-perf', 'h5wasm'],
  outputFileTracingIncludes: {
    '/api/ga-live-markers': ['./data/osm/ga-infra-snapshot.json.gz', './data/opencellid/ga-cells.csv.gz'],
    '/api/fbi-osint': ['./data/geo/ipv4-country.json.gz'],
  },
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://brain-lab-six.vercel.app' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Last-Event-ID' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
