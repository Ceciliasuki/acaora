import type { NextConfig } from "next";
import {BUILD_COMMIT} from './app/generated/build-version';
import {staticPrefetchEntries, prefetchAssetDirectory} from './scripts/static-prefetch-routes.mjs';

const segmentRequest = (segment: string) => [
  {type: 'header' as const, key: 'rsc', value: '1'},
  {type: 'header' as const, key: 'next-router-segment-prefetch', value: `/${segment}`},
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  generateBuildId: async () => BUILD_COMMIT,
  // Remove this compatibility layer when EdgeOne serves Next's segment files.
  // It uses public static pages only; authenticated APIs keep their own routes.
  async rewrites() {
    return {beforeFiles: staticPrefetchEntries.map(({source, segment}) => ({
      source,
      has: segmentRequest(segment),
      destination: `/_next/static/${BUILD_COMMIT}/${prefetchAssetDirectory}/${source.slice(1)}/${segment}.rsc`,
    })), afterFiles: [], fallback: []};
  },
  async headers() {
    return staticPrefetchEntries.map(({source, segment}) => ({
      source,
      has: segmentRequest(segment),
      headers: [
        {key: 'Content-Type', value: 'text/x-component'},
        {key: 'X-Nextjs-Postponed', value: '2'},
        {key: 'Vary', value: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch'},
        {key: 'Cache-Control', value: 'public, max-age=0, must-revalidate'},
      ],
    }));
  },
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
