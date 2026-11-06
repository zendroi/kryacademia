import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['pdf-lib'],
  outputFileTracingIncludes: { '/*': ['./lib/pdf-check.mjs', './scripts/pdf-check.mjs'] },
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  headers: async () => [{
    source: '/:path*',
    headers: [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }],
};

export default nextConfig;
