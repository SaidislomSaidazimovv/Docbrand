import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Handle pdfjs-dist worker
    config.resolve.alias.canvas = false;

    return config;
  },
  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      canvas: { browser: '' },
    },
  },
};

export default nextConfig;
