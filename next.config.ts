import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { "/courses": ["./content/courses/catalog.json"], "/courses/**/*": ["./content/courses/**/*"], "/api/courses/**/*": ["./content/courses/**/*"] },
  async redirects() {
    return [
      { source: "/auth-callback", destination: "/auth/callback", permanent: true },
      { source: "/reset", destination: "/auth/reset", permanent: true },
    ];
  },
};

export default nextConfig;
