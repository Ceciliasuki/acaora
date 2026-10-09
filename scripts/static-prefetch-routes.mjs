// Public, build-time pages only. Never route account APIs through static assets.
// The home page reads viewer cookies when auth is configured, so it is dynamic.
export const staticPrefetchRoutes = [
  '/auth', '/auth/reset', '/courses', '/dashboard', '/data',
  '/dev/ui-kit', '/papers', '/projects', '/settings',
];
export const prefetchAssetDirectory = 'acaora-segments';
