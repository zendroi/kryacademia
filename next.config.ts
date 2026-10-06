import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
