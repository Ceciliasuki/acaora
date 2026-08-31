import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/auth-callback", destination: "/auth/callback", permanent: true },
      { source: "/reset", destination: "/auth/reset", permanent: true },
    ];
  },
};

export default nextConfig;
