import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://brain-lab-six.vercel.app';
  const routes = [
    '',
    '/threat-globe',
    '/godseye-telemetry',
    '/recommendations-hub',
    '/anomalies',
    '/alerts',
    '/benchmarks',
    '/bot-pipeline',
    '/county-matrix',
    '/evidence',
    '/forensic-telemetry',
    '/insider-intel',
    '/methodology',
    '/reports',
    '/sources',
    '/three-pillars',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'always',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
