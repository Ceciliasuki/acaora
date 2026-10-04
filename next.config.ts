import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // EdgeOne copies each include glob independently, so keep file patterns unique.
  outputFileTracingIncludes: {
    "/{courses,api/courses}{,/**}": ["./content/courses/**/*"],
  },
  async redirects() {
    return [
      { source: "/auth-callback", destination: "/auth/callback", permanent: true },
      { source: "/reset", destination: "/auth/reset", permanent: true },
    ];
  },
};

export default nextConfig;
