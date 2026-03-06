import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['googleapis'],
  experimental: {
    // Allow very large file uploads (up to 20GB) through the proxy layer
    proxyClientMaxBodySize: '20gb',
    serverActions: {
      bodySizeLimit: '20gb',
    },
  },
};

export default nextConfig;
