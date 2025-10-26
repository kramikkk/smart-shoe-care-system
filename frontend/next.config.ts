import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration for monorepo
  turbopack: {
    root: '../'
  },
  
  // Future backend API integration
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
