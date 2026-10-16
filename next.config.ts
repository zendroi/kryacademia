import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['pdf-lib'],
  outputFileTracingIncludes: { '/*': ['./scripts/pdf-check.mjs'] },
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};

export default nextConfig;
