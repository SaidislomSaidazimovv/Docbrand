import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Handle pdfjs-dist worker
    config.resolve.alias.canvas = false;

    // Reduce EPERM errors on Windows by using polling instead of native watchers
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
      };
    }

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
