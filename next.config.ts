import type { NextConfig } from "next";

const buildCommit = [
  process.env.ACAORA_COMMIT_SHA,
  process.env.EDGEONE_GIT_COMMIT_SHA,
  process.env.GITHUB_SHA,
  process.env.CF_PAGES_COMMIT_SHA,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.COMMIT_SHA,
  process.env.GIT_COMMIT_SHA,
].find((value) => value?.trim())?.trim() ?? "unknown";

const buildTime = process.env.ACAORA_BUILD_TIME?.trim() || new Date().toISOString();
const deploymentEnvironment =
  process.env.ACAORA_ENVIRONMENT?.trim()
  || process.env.EDGEONE_ENV?.trim()
  || process.env.VERCEL_ENV?.trim()
  || process.env.NODE_ENV
  || "unknown";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/auth-callback", destination: "/auth/callback", permanent: true },
      { source: "/reset", destination: "/auth/reset", permanent: true },
    ];
  },
  env: {
    ACAORA_COMMIT_SHA: buildCommit,
    ACAORA_BUILD_TIME: buildTime,
    ACAORA_ENVIRONMENT: deploymentEnvironment,
  },
};

export default nextConfig;
