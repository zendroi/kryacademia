import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
