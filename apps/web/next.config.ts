import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tourbillon/db', '@tourbillon/shared', '@tourbillon/mastra'],
  experimental: {
    serverComponentsExternalPackages: ['@mastra/core', '@mastra/memory', 'bullmq', 'ioredis'],
  },
};

export default nextConfig;
