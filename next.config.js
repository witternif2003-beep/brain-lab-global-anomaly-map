/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['laz-perf'],
  outputFileTracingIncludes: {
    '/api/ga-live-markers': ['./data/osm/ga-infra-snapshot.json.gz'],
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
